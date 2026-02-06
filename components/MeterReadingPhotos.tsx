
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MeterPhotoData, MeterPhotoItem, Tenant, MeterReadingData } from '../types';
import { fetchMeterPhotos, saveMeterPhotos, fetchTenants, fetchMeterReading, saveMeterReading, uploadFile } from '../services/dataService';
import { analyzeMeterPhoto } from '../services/geminiService';
import { format, subMonths, addMonths, parseISO } from 'date-fns';
import { Camera, Plus, Trash2, Save, RefreshCw, X, Image as ImageIcon, Search, ChevronLeft, ChevronRight, Upload, Zap, ZapOff, Edit2, FileText, Calendar, RotateCcw, AlertTriangle, CheckCircle, Sparkles, Bot } from 'lucide-react';

interface MeterReadingPhotosProps {
  currentDate: Date;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const getFloorWeight = (floor: string) => {
  const f = floor.trim().toUpperCase();
  if (!f) return 9999;
  if (f.startsWith('B') || f.includes('지하')) {
    const num = parseInt(f.replace(/[^0-9]/g, '')) || 0;
    return 1000 + num;
  }
  if (f === 'RF' || f === '옥상' || f.includes('옥탑')) return 999;
  const num = parseInt(f.replace(/[^0-9]/g, '')) || 0;
  return num;
};

const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1200; 
        if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
        else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) { ctx.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL('image/jpeg', 0.6)); } 
        else { reject(new Error("Canvas context not available")); }
      };
      img.onerror = reject; img.src = e.target?.result as string;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
};

const MeterReadingPhotos: React.FC<MeterReadingPhotosProps> = ({ currentDate }) => {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  // AI 분석 기본값을 false(꺼짐)로 변경
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [currentMonth, setCurrentMonth] = useState(format(currentDate, 'yyyy-MM'));
  const [data, setData] = useState<MeterPhotoData>({ month: currentMonth, items: [] });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  
  const [newItem, setNewItem] = useState<Partial<MeterPhotoItem>>({
    floor: '',
    tenant: '',
    reading: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: '일반',
    photo: ''
  });

  useEffect(() => {
    loadData();
    loadTenants();
  }, [currentMonth]);

  const loadData = async () => {
    setLoading(true);
    const fetched = await fetchMeterPhotos(currentMonth);
    setData(fetched || { month: currentMonth, items: [] });
    setLoading(false);
  };

  const loadTenants = async () => {
    const fetched = await fetchTenants();
    setTenants(fetched || []);
  };

  const handleSave = async () => {
    setSaveStatus('loading');
    
    const uploadedItems = [...data.items];
    for (let i = 0; i < uploadedItems.length; i++) {
      const item = uploadedItems[i];
      if (item.photo && item.photo.startsWith('data:image')) {
        const fileName = `meter_${item.id}.jpg`;
        const publicUrl = await uploadFile('facility', 'meters', fileName, item.photo);
        if (publicUrl) {
          uploadedItems[i] = { ...item, photo: publicUrl };
        }
      }
    }

    const updatedData = { ...data, items: uploadedItems };
    const photoSaveSuccess = await saveMeterPhotos(updatedData);
    
    if (photoSaveSuccess) {
      setData(updatedData);
      try {
        const monthlyReadingData = await fetchMeterReading(currentMonth);
        if (monthlyReadingData && monthlyReadingData.items) {
          let updatedCount = 0;
          const updatedMonthlyItems = monthlyReadingData.items.map(mItem => {
            const matchedPhoto = updatedData.items.find(pItem => 
              pItem.tenant.trim() === mItem.tenant.trim() && 
              pItem.floor.trim() === mItem.floor.trim() && 
              pItem.type === mItem.note
            );
            if (matchedPhoto && matchedPhoto.reading) {
              updatedCount++;
              return { ...mItem, currentReading: matchedPhoto.reading };
            }
            return mItem;
          });
          
          if (updatedCount > 0) {
            await saveMeterReading({ ...monthlyReadingData, items: updatedMonthlyItems });
          }
        }
      } catch (syncError) {
        console.error("연동 중 오류:", syncError);
      }
      setSaveStatus('success');
      alert('저장이 완료되었습니다.');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } else {
      setSaveStatus('error');
      alert('저장에 실패했습니다.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const resized = await resizeImage(file);
      setNewItem(prev => ({ ...prev, photo: resized }));
      
      if (!isAiEnabled) return;

      setAnalyzing(true);
      try {
        const result = await analyzeMeterPhoto(resized, tenants);
        if (result) {
          const cleanReading = result.reading 
            ? Math.floor(parseFloat(result.reading.toString().replace(/,/g, ''))).toString() 
            : '';

          setNewItem(prev => ({
            ...prev,
            tenant: result.tenantName,
            floor: result.floor,
            type: result.type,
            reading: cleanReading
          }));
        }
      } catch (err) {
        console.error("AI 분석 실패", err);
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const handleOpenModal = (item?: MeterPhotoItem) => {
    if (item) {
      setEditingId(item.id);
      setNewItem({ ...item });
    } else {
      setEditingId(null);
      setNewItem({
        floor: '',
        tenant: '',
        reading: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        type: '일반',
        photo: ''
      });
    }
    setShowModal(true);
  };

  const handleCancel = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!newItem.photo || !newItem.tenant) {
      alert('사진과 입주사명은 필수입니다.');
      return;
    }

    if (editingId) {
      const updatedItems = data.items.map(item => 
        item.id === editingId ? { ...(newItem as MeterPhotoItem) } : item
      );
      setData({ ...data, items: updatedItems });
    } else {
      const item: MeterPhotoItem = {
        id: generateId(),
        floor: newItem.floor || '',
        tenant: newItem.tenant || '',
        reading: newItem.reading || '',
        date: newItem.date || format(new Date(), 'yyyy-MM-dd'),
        type: (newItem.type as '일반' | '특수') || '일반',
        photo: newItem.photo || ''
      };
      setData({ ...data, items: [item, ...data.items] });
    }
    setShowModal(false);
    setEditingId(null);
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    const newItems = data.items.filter(i => i.id !== deleteTargetId);
    setData({ ...data, items: newItems });
    setDeleteTargetId(null);
  };

  const filteredItems = useMemo(() => {
    return data.items
      .filter(item => 
        item.tenant.includes(searchTerm) || item.floor.includes(searchTerm)
      )
      .sort((a, b) => {
        const floorDiff = getFloorWeight(a.floor) - getFloorWeight(b.floor);
        if (floorDiff !== 0) return floorDiff;
        if (a.type === b.type) return 0;
        return a.type === '일반' ? -1 : 1;
      });
  }, [data.items, searchTerm]);

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* 상단 툴바 */}
      <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-[-16px] z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <button onClick={() => setCurrentMonth(prev => format(subMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'))} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft /></button>
            <h2 className="text-xl font-bold text-gray-800 tracking-tight">{currentMonth.split('-')[0]}년 {currentMonth.split('-')[1]}월</h2>
            <button onClick={() => setCurrentMonth(prev => format(addMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'))} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><ChevronRight /></button>
          </div>
          <div className="relative">
            <input 
              type="text" 
              placeholder="입주사/층 검색..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm w-64 focus:ring-2 focus:ring-amber-500 outline-none shadow-inner"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl font-bold shadow-md hover:bg-amber-700 transition-all active:scale-95">
            <Plus size={18} /> 사진 추가 등록
          </button>
          <button 
            onClick={handleSave} 
            disabled={saveStatus === 'loading'}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold shadow-md transition-all active:scale-95 ${saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {saveStatus === 'loading' ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
            {saveStatus === 'success' ? '저장/연동완료' : '서버저장 및 기록연동'}
          </button>
        </div>
      </div>

      {/* 리스트 영역 */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center font-bold text-gray-500 text-xs uppercase tracking-wider">
          <div className="w-24 text-center">사진</div>
          <div className="flex-1 px-4">입주사 정보</div>
          <div className="w-40 text-center">당월 지침값</div>
          <div className="w-32 text-center">촬영 일자</div>
          <div className="w-32 text-center">관리</div>
        </div>
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4 bg-white"><RefreshCw className="animate-spin text-amber-500" size={48} /><p className="text-gray-400 font-bold">사진 데이터를 불러오는 중...</p></div>
        ) : filteredItems.length === 0 ? (
          <div className="py-32 flex flex-col items-center gap-4 bg-white text-gray-400"><ImageIcon size={64} /><p className="font-bold text-lg">등록된 검침 사진이 없습니다.</p></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredItems.map(item => (
              <div key={item.id} className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors group">
                <div className="w-20 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 shrink-0 relative cursor-pointer" onClick={() => handleOpenModal(item)}>
                  <img src={item.photo} alt={item.tenant} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="flex-1 px-4 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-gray-900 truncate text-base">{item.tenant}</h3>
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter shrink-0">{item.floor}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 font-medium">
                    <span className={`flex items-center gap-1 ${item.type === '특수' ? 'text-orange-600' : 'text-blue-600'} font-bold`}><FileText size={12} /> {item.type} 계량기</span>
                  </div>
                </div>
                <div className="w-40 text-center"><span className="text-xl font-black text-blue-700 bg-blue-50 px-4 py-1.5 rounded-xl border border-blue-100">{item.reading || '0'}</span></div>
                <div className="w-32 text-center flex flex-col items-center"><div className="flex items-center gap-1.5 text-gray-500 text-xs font-bold"><Calendar size={14} className="text-gray-300" />{item.date}</div></div>
                <div className="w-32 flex items-center justify-center gap-2">
                  <button onClick={() => handleOpenModal(item)} className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors" title="수정"><Edit2 size={18} /></button>
                  <button onClick={() => handleDeleteRequest(item.id)} className="p-2 text-red-400 hover:bg-red-100 rounded-lg transition-colors" title="삭제"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 사진 추가/수정 모달 (새 창) */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-100 animate-scale-up flex flex-col max-h-[90vh]">
            {/* 모달 헤더 */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl text-white shadow-lg ${editingId ? 'bg-orange-500 shadow-orange-100' : 'bg-amber-600 shadow-amber-100'}`}>
                  {editingId ? <Edit2 size={24} /> : <Camera size={24} />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{editingId ? '검침 정보 수정' : '신규 검침 사진 등록'}</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{editingId ? 'Update Meter Data' : 'New Photo Entry'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsAiEnabled(!isAiEnabled)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all border shadow-sm active:scale-95 ${isAiEnabled ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                >
                  <Bot size={16} /> {isAiEnabled ? 'AI 분석 사용중' : 'AI 분석 꺼짐'}
                </button>
                <button onClick={handleCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={28} /></button>
              </div>
            </div>

            {/* 모달 본문 */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="flex flex-col lg:flex-row gap-10">
                {/* 왼쪽: 사진 업로드 영역 */}
                <div className="lg:w-1/2 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Photo Preview</label>
                  </div>
                  <label className="w-full aspect-[4/3] border-4 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center cursor-pointer bg-slate-50/30 hover:bg-amber-50/50 hover:border-amber-300 transition-all overflow-hidden relative group shadow-inner">
                    {newItem.photo ? (
                      <img src={newItem.photo} className="w-full h-full object-contain" alt="Meter" />
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-5 bg-white rounded-3xl shadow-md text-slate-400 group-hover:text-amber-500 group-hover:scale-110 transition-all">
                          <Upload size={40} />
                        </div>
                        <span className="text-slate-400 font-black text-sm">이미지 선택 또는 직접 촬영</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                  {analyzing && (
                    <div className="mt-4 flex items-center justify-center gap-3 bg-blue-50 text-blue-700 p-4 rounded-2xl font-black border border-blue-100 animate-pulse">
                      <Sparkles size={20} className="animate-spin" />
                      <span className="text-sm">AI가 계량기 수치를 정밀 분석 중입니다...</span>
                    </div>
                  )}
                </div>

                {/* 오른쪽: 정보 입력 영역 */}
                <div className="lg:w-1/2 flex flex-col gap-6">
                  <div>
                    <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">입주사 선택 *</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none font-black text-slate-800 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all text-base h-[60px]"
                      value={`${newItem.tenant}|${newItem.floor}`}
                      onChange={e => {
                        const [name, floor] = e.target.value.split('|');
                        setNewItem({ ...newItem, tenant: name, floor });
                      }}
                    >
                      <option value="">입주사 및 층수 선택</option>
                      {tenants.map(t => <option key={t.id} value={`${t.name}|${t.floor}`}>{t.name} ( {t.floor} )</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">검침 구분</label>
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner h-[60px]">
                      <button onClick={() => setNewItem({ ...newItem, type: '일반' })} className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-sm font-black transition-all ${newItem.type === '일반' ? 'bg-white text-blue-600 shadow-md scale-[1.02]' : 'text-slate-400'}`}><Zap size={18} /> 일반용</button>
                      <button onClick={() => setNewItem({ ...newItem, type: '특수' })} className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-sm font-black transition-all ${newItem.type === '특수' ? 'bg-white text-orange-600 shadow-md scale-[1.02]' : 'text-slate-400'}`}><ZapOff size={18} /> 특수용</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">당월 지침 (숫자만)</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none font-black text-blue-700 text-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all shadow-sm"
                        placeholder="0" 
                        value={newItem.reading} 
                        onChange={e => setNewItem({ ...newItem, reading: e.target.value.replace(/[^0-9]/g, '') })} 
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">촬영/입력 일자</label>
                      <input 
                        type="date" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold text-slate-700 text-lg focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all shadow-sm h-[72px]"
                        value={newItem.date} 
                        onChange={e => setNewItem({ ...newItem, date: e.target.value })} 
                      />
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-6 border-t border-slate-100 flex gap-4">
                    <button onClick={handleCancel} className="flex-1 py-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[24px] font-black text-base transition-all active:scale-95">CANCEL</button>
                    <button 
                      onClick={handleSubmit} 
                      className={`flex-[2] py-5 text-white rounded-[24px] font-black text-xl shadow-xl active:scale-95 transition-all tracking-widest ${editingId ? 'bg-orange-600 shadow-orange-100' : 'bg-amber-600 shadow-amber-100'}`}
                    >
                      {editingId ? 'UPDATE DATA' : 'REGISTER NOW'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-red-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-100">
                <AlertTriangle className="text-red-600" size={36} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">검침 사진 삭제</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">선택하신 검침 사진 정보를 목록에서 <span className="text-red-600 font-bold">영구히 삭제</span>하시겠습니까?</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTargetId(null)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center"><X size={20} className="mr-2" />취소</button>
                <button onClick={confirmDelete} className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-200 flex items-center justify-center active:scale-95"><Trash2 size={20} className="mr-2" />삭제 실행</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scale-up {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-up {
          animation: scale-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default MeterReadingPhotos;
