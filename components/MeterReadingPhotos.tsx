import React, { useState, useEffect, useRef } from 'react';
import { MeterPhotoData, MeterPhotoItem, Tenant } from '../types';
import { fetchMeterPhotos, saveMeterPhotos, fetchTenants, fetchMeterReading, saveMeterReading } from '../services/dataService';
import { format, subMonths, addMonths, parseISO } from 'date-fns';
import { Camera, Plus, Trash2, Save, RefreshCw, X, Image as ImageIcon, Search, ChevronLeft, ChevronRight, Upload, Zap, ZapOff, Edit2, FileText, Calendar, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';

interface MeterReadingPhotosProps {
  currentDate: Date;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

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
        if (ctx) { ctx.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL('image/jpeg', 0.8)); } 
        else { reject(new Error("Canvas context not available")); }
      };
      img.onerror = reject; img.src = e.target?.result as string;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
};

const MeterReadingPhotos: React.FC<MeterReadingPhotosProps> = ({ currentDate }) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [currentMonth, setCurrentMonth] = useState(format(currentDate, 'yyyy-MM'));
  const [data, setData] = useState<MeterPhotoData>({ month: currentMonth, items: [] });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showForm, setShowForm] = useState(false);
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
    const photoSaveSuccess = await saveMeterPhotos(data);
    
    if (photoSaveSuccess) {
      try {
        const monthlyReadingData = await fetchMeterReading(currentMonth);
        if (monthlyReadingData && monthlyReadingData.items) {
          let updatedCount = 0;
          const updatedMonthlyItems = monthlyReadingData.items.map(mItem => {
            const matchedPhoto = data.items.find(pItem => 
              pItem.tenant === mItem.tenant && 
              pItem.floor === mItem.floor && 
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
        console.error("검침 기록 연동 중 오류 발생:", syncError);
      }
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } else {
      setSaveStatus('error');
      alert('저장 실패');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const resized = await resizeImage(file);
      setNewItem({ ...newItem, photo: resized });
    }
  };

  const toggleForm = () => {
    if (showForm && !editingId) {
      setShowForm(false);
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
      setShowForm(true);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const openEditForm = (item: MeterPhotoItem) => {
    setEditingId(item.id);
    setNewItem({ ...item });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    setShowForm(false);
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

  const filteredItems = data.items.filter(item => 
    item.tenant.includes(searchTerm) || item.floor.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header / Filter - Sticky 적용 */}
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
          <button onClick={toggleForm} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold shadow-md transition-all ${showForm && !editingId ? 'bg-gray-500 text-white hover:bg-gray-600' : 'bg-amber-600 text-white hover:bg-amber-700'}`}>
            {showForm && !editingId ? <X size={18} /> : <Plus size={18} />} {showForm && !editingId ? '닫기' : '사진 추가'}
          </button>
          <button 
            onClick={handleSave} 
            disabled={saveStatus === 'loading'}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold shadow-md transition-all ${saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {saveStatus === 'loading' ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
            {saveStatus === 'success' ? '저장/연동완료' : '서버저장 및 기록연동'}
          </button>
        </div>
      </div>

      {/* Add/Edit Inline Form */}
      {showForm && (
        <div className={`p-6 rounded-2xl border shadow-sm transition-all duration-300 animate-fade-in ${editingId ? 'bg-orange-50 border-orange-200 ring-2 ring-orange-100' : 'bg-amber-50/50 border-amber-200'}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg text-white shadow-sm ${editingId ? 'bg-orange-500' : 'bg-amber-600'}`}>
                {editingId ? <Edit2 size={18} /> : <Camera size={18} />}
              </div>
              <h3 className="text-lg font-bold text-gray-800">{editingId ? '검침 정보 수정' : '신규 검침 사진 등록'}</h3>
            </div>
            {editingId && (
              <button onClick={handleCancel} className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-white px-3 py-1.5 rounded-full border border-orange-200 shadow-sm hover:bg-orange-100 transition-colors">
                <RotateCcw size={14} /> 수정 취소
              </button>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left Side: Photo Upload */}
            <div className="lg:w-1/3">
              <label className="w-full aspect-video border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer bg-white hover:bg-amber-50 hover:border-amber-400 transition-all overflow-hidden relative group shadow-inner">
                {newItem.photo ? (
                  <img src={newItem.photo} className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Upload className="text-gray-400 mb-2" size={40} />
                    <span className="text-gray-500 font-bold text-sm">사진 선택 또는 촬영</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                {newItem.photo && <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold">사진 변경</div>}
              </label>
            </div>

            {/* Right Side: Inputs */}
            <div className="lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-black text-gray-400 mb-1.5 uppercase tracking-wider">입주사 선택 *</label>
                <select 
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none font-bold text-gray-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all bg-white"
                  value={`${newItem.tenant}|${newItem.floor}`}
                  onChange={e => {
                    const [name, floor] = e.target.value.split('|');
                    setNewItem({ ...newItem, tenant: name, floor });
                  }}
                >
                  <option value="">입주사 선택</option>
                  {tenants.map(t => <option key={t.id} value={`${t.name}|${t.floor}`}>{t.name} ({t.floor})</option>)}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-black text-gray-400 mb-1.5 uppercase tracking-wider">검침 구분</label>
                <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-inner">
                  <button 
                    onClick={() => setNewItem({ ...newItem, type: '일반' })}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-black transition-all ${newItem.type === '일반' ? 'bg-white text-blue-600 shadow-sm border border-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <Zap size={16} /> 일반 계량기
                  </button>
                  <button 
                    onClick={() => setNewItem({ ...newItem, type: '특수' })}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-black transition-all ${newItem.type === '특수' ? 'bg-white text-orange-600 shadow-sm border border-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <ZapOff size={16} /> 특수 계량기
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 mb-1.5 uppercase tracking-wider">당월 지침값</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none font-black text-blue-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 text-xl transition-all bg-white"
                  placeholder="0"
                  value={newItem.reading}
                  onChange={e => setNewItem({ ...newItem, reading: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 mb-1.5 uppercase tracking-wider">촬영 일자</label>
                <input 
                  type="date" 
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none font-bold text-gray-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all bg-white h-[52px]"
                  value={newItem.date}
                  onChange={e => setNewItem({ ...newItem, date: e.target.value })}
                />
              </div>

              <div className="md:col-span-2 flex gap-3 mt-2">
                <button onClick={handleCancel} className="flex-1 py-3.5 bg-white border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-all shadow-sm active:scale-95">취소</button>
                <button 
                  onClick={handleSubmit} 
                  className={`flex-[2] py-3.5 text-white rounded-xl font-black text-lg shadow-lg active:scale-95 transition-all ${editingId ? 'bg-orange-600 shadow-orange-200 hover:bg-orange-700' : 'bg-amber-600 shadow-amber-200 hover:bg-amber-700'}`}
                >
                  {editingId ? '정보 수정 완료' : '사진첩에 등록하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List Style Container */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center font-bold text-gray-500 text-xs uppercase tracking-wider">
          <div className="w-24 text-center">사진</div>
          <div className="flex-1 px-4">입주사 정보</div>
          <div className="w-40 text-center">당월 지침값</div>
          <div className="w-32 text-center">촬영 일자</div>
          <div className="w-32 text-center">관리</div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4 bg-white">
            <RefreshCw className="animate-spin text-amber-500" size={48} />
            <p className="text-gray-400 font-bold">사진 데이터를 불러오는 중...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-32 flex flex-col items-center gap-4 bg-white text-gray-400">
            <ImageIcon size={64} />
            <p className="font-bold text-lg">등록된 검침 사진이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredItems.map(item => (
              <div key={item.id} className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors group">
                {/* Photo Thumbnail */}
                <div className="w-20 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 shrink-0 relative cursor-pointer" onClick={() => openEditForm(item)}>
                  <img src={item.photo} alt={item.tenant} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className={`absolute bottom-0 right-0 p-0.5 rounded-tl-md ${item.type === '특수' ? 'bg-orange-50' : 'bg-blue-600'} text-white`}>
                    {item.type === '특수' ? <ZapOff size={8} /> : <Zap size={8} />}
                  </div>
                </div>

                {/* Tenant Info */}
                <div className="flex-1 px-4 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-gray-900 truncate text-base">{item.tenant}</h3>
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter shrink-0">{item.floor}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 font-medium">
                    <span className={`flex items-center gap-1 ${item.type === '특수' ? 'text-orange-600' : 'text-blue-600'} font-bold`}>
                      <FileText size={12} /> {item.type} 계량기
                    </span>
                  </div>
                </div>

                {/* Reading Value */}
                <div className="w-40 text-center">
                  <span className="text-xl font-black text-blue-700 bg-blue-50 px-4 py-1.5 rounded-xl border border-blue-100">
                    {item.reading || '0'}
                  </span>
                </div>

                {/* Date */}
                <div className="w-32 text-center flex flex-col items-center">
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs font-bold">
                    <Calendar size={14} className="text-gray-300" />
                    {item.date}
                  </div>
                </div>

                {/* Actions */}
                <div className="w-32 flex items-center justify-center gap-2">
                  <button 
                    onClick={() => openEditForm(item)}
                    className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"
                    title="수정"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDeleteRequest(item.id)}
                    className="p-2 text-red-400 hover:bg-red-100 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 삭제 확인 커스텀 모달 (새 창 스타일) */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-red-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-100">
                <AlertTriangle className="text-red-600" size={36} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">검침 사진 삭제</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                선택하신 검침 사진과 관련 정보를<br/>
                목록에서 <span className="text-red-600 font-bold">영구히 삭제</span>하시겠습니까?
              </p>
              
              <div className="flex gap-3">
                <button onClick={() => setDeleteTargetId(null)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center">
                  <X size={20} className="mr-2" />
                  취소
                </button>
                <button onClick={confirmDelete} className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-200 flex items-center justify-center active:scale-95">
                  <Trash2 size={20} className="mr-2" />
                  삭제 실행
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scale-up {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-up {
          animation: scale-up 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default MeterReadingPhotos;