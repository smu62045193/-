
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MeterPhotoData, MeterPhotoItem, Tenant, MeterReadingData } from '../types';
import { fetchMeterPhotos, saveMeterPhotos, fetchTenants, fetchMeterReading, saveMeterReading, uploadFile, generateUUID } from '../services/dataService';
import { analyzeMeterPhoto } from '../services/geminiService';
import { format, subMonths, addMonths, parseISO } from 'date-fns';
import { Camera, Plus, Trash2, Save, RefreshCw, X, Image as ImageIcon, Search, ChevronLeft, ChevronRight, Upload, Zap, ZapOff, Edit2, FileText, Calendar, RotateCcw, AlertTriangle, CheckCircle, Sparkles, Bot, Maximize2 } from 'lucide-react';

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

// Fixed Error: Define missing MeterReadingPhotosProps interface
interface MeterReadingPhotosProps {
  currentDate: Date;
  isPopupMode?: boolean;
}

const MeterReadingPhotos: React.FC<MeterReadingPhotosProps> = ({ currentDate, isPopupMode = false }) => {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (isPopupMode) {
      const params = new URLSearchParams(window.location.search);
      const month = params.get('month');
      if (month) return month;
    }
    return format(currentDate, 'yyyy-MM');
  });
  const [data, setData] = useState<MeterPhotoData>({ month: currentMonth, items: [] });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newItem, setNewItem] = useState<Partial<MeterPhotoItem>>(() => {
    let initialDate = format(new Date(), 'yyyy-MM-dd');
    if (isPopupMode) {
      const params = new URLSearchParams(window.location.search);
      const month = params.get('month');
      if (month && month !== format(new Date(), 'yyyy-MM')) {
        initialDate = `${month}-01`;
      }
    }
    return {
      floor: '', tenant: '', reading: '', date: initialDate, type: '일반', photo: ''
    };
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    loadTenants();

    if (isPopupMode) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id && id !== 'new') setEditingId(id);
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'METER_PHOTO_SAVED') loadData();
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentMonth, isPopupMode]);

  useEffect(() => {
    if (isPopupMode && editingId && data.items.length > 0) {
      const item = data.items.find(i => String(i.id) === String(editingId));
      if (item) setNewItem({ ...item });
    }
  }, [editingId, data.items, isPopupMode]);

  const loadData = async () => {
    setLoading(true);
    const fetched = await fetchMeterPhotos(currentMonth);
    setData(fetched || { month: currentMonth, items: [] });
    setLoading(false);
  };

  const loadTenants = async () => {
    const fetched = await fetchTenants();
    if (fetched) {
      fetched.sort((a, b) => {
        const weightA = getFloorWeight(a.floor);
        const weightB = getFloorWeight(b.floor);
        if (weightA !== weightB) return weightA - weightB;
        return a.name.localeCompare(b.name);
      });
      setTenants(fetched);
    } else {
      setTenants([]);
    }
  };

  const openIndependentWindow = (id: string = 'new') => {
    const width = 850;
    const height = 800;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'meter_photo');
    url.searchParams.set('id', id);
    url.searchParams.set('month', currentMonth);
    window.open(url.toString(), `MeterPhotoWin_${id}`, `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,location=no`);
  };

  const handleSave = async () => {
    setSaveStatus('loading');
    const uploadedItems = [...data.items];
    for (let i = 0; i < uploadedItems.length; i++) {
      const item = uploadedItems[i];
      if (item.photo && item.photo.startsWith('data:image')) {
        const fileName = `meter_${item.id}.jpg`;
        const publicUrl = await uploadFile('facility', 'meters', fileName, item.photo);
        if (publicUrl) uploadedItems[i] = { ...item, photo: publicUrl };
      }
    }
    const updatedData = { ...data, items: uploadedItems };
    if (await saveMeterPhotos(updatedData)) {
      setData(updatedData);
      try {
        const monthlyReadingData = await fetchMeterReading(currentMonth);
        if (monthlyReadingData && monthlyReadingData.items) {
          const normalize = (str: string) => (str || '').replace(/\s+/g, '');
          const updatedMonthlyItems = monthlyReadingData.items.map(mItem => {
            const matchedPhoto = updatedData.items.find(pItem => 
              normalize(pItem.tenant) === normalize(mItem.tenant) && 
              normalize(pItem.floor) === normalize(mItem.floor) && 
              normalize(pItem.type) === normalize(mItem.note)
            );
            return matchedPhoto && matchedPhoto.reading ? { ...mItem, currentReading: matchedPhoto.reading } : mItem;
          });
          await saveMeterReading({ ...monthlyReadingData, items: updatedMonthlyItems });
        }
      } catch (syncError) {}
      setSaveStatus('success');
      window.alert('저장이 완료되었습니다.');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } else {
      setSaveStatus('error');
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
        if (result) setNewItem(prev => ({ ...prev, tenant: result.tenantName, floor: result.floor, type: result.type, reading: result.reading ? Math.floor(parseFloat(result.reading.toString().replace(/,/g, ''))).toString() : '' }));
      } catch (err) {} finally { setAnalyzing(false); }
    }
  };

  const handleSubmit = async () => {
    if (!newItem.photo || !newItem.tenant) { window.alert('사진과 입주사명은 필수입니다.'); return; }
    setLoading(true);
    try {
      const targetMonth = newItem.date ? newItem.date.substring(0, 7) : currentMonth;
      
      let finalPhotoUrl = newItem.photo;
      if (finalPhotoUrl.startsWith('data:image')) {
        const fileName = `meter_${editingId || generateUUID()}_${Date.now()}.jpg`;
        const publicUrl = await uploadFile('facility', 'meters', fileName, finalPhotoUrl);
        if (publicUrl) finalPhotoUrl = publicUrl;
      }

      const latestData = await fetchMeterPhotos(targetMonth);
      let updatedItems = Array.isArray(latestData?.items) ? [...latestData.items] : [];
      const itemToSave: MeterPhotoItem = { id: editingId || generateUUID(), floor: newItem.floor || '', tenant: newItem.tenant || '', reading: newItem.reading || '', date: newItem.date || format(new Date(), 'yyyy-MM-dd'), type: (newItem.type as '일반' | '특수') || '일반', photo: finalPhotoUrl };
      
      if (editingId) {
        const existingIndex = updatedItems.findIndex(item => item.id === editingId);
        if (existingIndex >= 0) {
          updatedItems[existingIndex] = itemToSave;
        } else {
          updatedItems = [itemToSave, ...updatedItems];
        }
      } else {
        updatedItems = [itemToSave, ...updatedItems];
      }

      const success = await saveMeterPhotos({ month: targetMonth, items: updatedItems });
      if (success) {
        // 월별검침기록(MeterReadingLog)에도 당월지침 반영
        try {
          const monthlyReadingData = await fetchMeterReading(targetMonth);
          if (monthlyReadingData && monthlyReadingData.items) {
            const normalize = (str: string) => (str || '').replace(/\s+/g, '');
            const updatedMonthlyItems = monthlyReadingData.items.map(mItem => {
              if (normalize(mItem.tenant) === normalize(itemToSave.tenant) && 
                  normalize(mItem.floor) === normalize(itemToSave.floor) && 
                  normalize(mItem.note) === normalize(itemToSave.type)) {
                return { ...mItem, currentReading: itemToSave.reading };
              }
              return mItem;
            });
            await saveMeterReading({ ...monthlyReadingData, items: updatedMonthlyItems });
          }
        } catch (syncError) { console.error('Sync error:', syncError); }

        if (editingId && targetMonth !== currentMonth) {
          const oldData = await fetchMeterPhotos(currentMonth);
          if (oldData && oldData.items) {
            const filteredOld = oldData.items.filter(item => item.id !== editingId);
            await saveMeterPhotos({ month: currentMonth, items: filteredOld });
          }
        }
        if (window.opener) window.opener.postMessage({ type: 'METER_PHOTO_SAVED' }, '*');
        window.alert('저장되었습니다.'); window.close();
      } else {
        window.alert('저장에 실패했습니다.');
      }
    } catch (e) {
      window.alert('오류가 발생했습니다.');
    } finally { setLoading(false); }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    
    const itemToDelete = data.items.find(i => i.id === id);
    const newItems = data.items.filter(i => i.id !== id);
    
    // UI 즉시 반영
    setData({ ...data, items: newItems });
    
    const success = await saveMeterPhotos({ ...data, items: newItems });
    if (success) {
      // 월별검침기록(MeterReadingLog)에서 당월지침 삭제
      if (itemToDelete) {
        try {
          const monthlyReadingData = await fetchMeterReading(data.month);
          if (monthlyReadingData && monthlyReadingData.items) {
            const normalize = (str: string) => (str || '').replace(/\s+/g, '');
            const updatedMonthlyItems = monthlyReadingData.items.map(mItem => {
              if (normalize(mItem.tenant) === normalize(itemToDelete.tenant) && 
                  normalize(mItem.floor) === normalize(itemToDelete.floor) && 
                  normalize(mItem.note) === normalize(itemToDelete.type)) {
                return { ...mItem, currentReading: '' };
              }
              return mItem;
            });
            await saveMeterReading({ ...monthlyReadingData, items: updatedMonthlyItems });
          }
        } catch (syncError) { console.error('Sync error:', syncError); }
      }
      window.alert('삭제되었습니다.');
    } else {
      // 실패 시 롤백
      setData(data);
      window.alert('삭제에 실패했습니다.');
    }
  };

  const filteredItems = useMemo(() => {
    return data.items
      .filter(item => item.tenant.includes(searchTerm) || item.floor.includes(searchTerm))
      .sort((a, b) => {
        const floorDiff = getFloorWeight(a.floor) - getFloorWeight(b.floor);
        if (floorDiff !== 0) return floorDiff;
        return a.type === '일반' ? -1 : 1;
      });
  }, [data.items, searchTerm]);

  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-100 animate-scale-up flex flex-col max-h-[90vh]">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl text-white shadow-lg ${editingId ? 'bg-orange-50' : 'bg-amber-600'}`}>
                {editingId ? <Edit2 size={24} /> : <Camera size={24} />}
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight">{editingId ? '검침 정보 수정' : '신규 검침 사진 등록'}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{editingId ? 'Update Meter Data' : 'New Photo Entry'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setIsAiEnabled(!isAiEnabled)} className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all border shadow-sm active:scale-95 ${isAiEnabled ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-400 border-slate-200'}`}><Bot size={16} /> {isAiEnabled ? 'AI 분석 사용중' : 'AI 분석 꺼짐'}</button>
              <button onClick={() => window.close()} className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"><X size={28} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-8">
            <div className="flex flex-col lg:flex-row gap-10">
              <div className="lg:w-1/2 flex flex-col">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Photo Preview</label>
                <label className="w-full aspect-[4/3] border-4 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center cursor-pointer bg-slate-50/30 hover:bg-amber-50/50 hover:border-amber-300 transition-all overflow-hidden relative group shadow-inner">
                  {newItem.photo ? <img src={newItem.photo} className="w-full h-full object-contain" alt="Meter" /> : <div className="flex flex-col items-center gap-3"><div className="p-5 bg-white rounded-3xl shadow-md text-slate-400 group-hover:text-amber-500 group-hover:scale-110 transition-all"><Upload size={40} /></div><span className="text-slate-400 font-black text-sm">이미지 선택 또는 직접 촬영</span></div>}
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
                {analyzing && <div className="mt-4 flex items-center justify-center gap-3 bg-blue-50 text-blue-700 p-4 rounded-2xl font-black border border-blue-100 animate-pulse"><Sparkles size={20} className="animate-spin" /><span className="text-sm">AI가 계량기 수치를 정밀 분석 중입니다...</span></div>}
              </div>
              <div className="lg:w-1/2 flex flex-col gap-6">
                <div><label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">입주사 선택 *</label><select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none font-black text-slate-800 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all text-base h-[60px]" value={`${newItem.tenant}|${newItem.floor}`} onChange={e => { const [name, floor] = e.target.value.split('|'); setNewItem({ ...newItem, tenant: name, floor }); }}><option value="">입주사 및 층수 선택</option>{tenants.map(t => <option key={t.id} value={`${t.name}|${t.floor}`}>{t.name} ( {t.floor} )</option>)}</select></div>
                <div><label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">검침 구분</label><div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner h-[60px]"><button onClick={() => setNewItem({ ...newItem, type: '일반' })} className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-sm font-black transition-all ${newItem.type === '일반' ? 'bg-white text-blue-600 shadow-md scale-[1.02]' : 'text-slate-400'}`}><Zap size={18} /> 일반용</button><button onClick={() => setNewItem({ ...newItem, type: '특수' })} className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-sm font-black transition-all ${newItem.type === '특수' ? 'bg-white text-orange-600 shadow-md scale-[1.02]' : 'text-slate-400'}`}><ZapOff size={18} /> 특수용</button></div></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col"><label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">당월 지침 (숫자만)</label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none font-black text-blue-700 text-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all shadow-sm" placeholder="0" value={newItem.reading} onChange={e => setNewItem({ ...newItem, reading: e.target.value.replace(/[^0-9]/g, '') })} /></div>
                  <div className="flex flex-col"><label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">촬영/입력 일자</label><input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold text-slate-700 text-lg focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all shadow-sm h-[72px]" value={newItem.date} onChange={e => setNewItem({ ...newItem, date: e.target.value })} /></div>
                </div>
                <div className="mt-auto pt-6 border-t border-slate-100 flex gap-4"><button onClick={() => window.close()} className="flex-1 py-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[24px] font-black text-base transition-all active:scale-95">CANCEL</button><button onClick={handleSubmit} disabled={loading} className={`flex-[2] py-5 text-white rounded-[24px] font-black text-xl shadow-xl active:scale-95 transition-all tracking-widest ${editingId ? 'bg-orange-600 shadow-orange-100' : 'bg-amber-600 shadow-amber-100'} disabled:bg-slate-400`}>{loading ? 'SAVING...' : editingId ? 'UPDATE DATA' : 'REGISTER NOW'}</button></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in relative">
      <div className="flex flex-col md:flex-row justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-200 gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center space-x-2">
            <button onClick={() => setCurrentMonth(prev => format(subMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'))} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft /></button>
            <h2 className="text-xl font-bold text-gray-800 tracking-tight">{currentMonth}</h2>
            <button onClick={() => setCurrentMonth(prev => format(addMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'))} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><ChevronRight /></button>
          </div>
          <div className="relative w-[320px]">
            <input type="text" placeholder="입주사/층 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm font-bold" />
            <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto justify-end">
          <button onClick={() => openIndependentWindow()} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-bold shadow-md hover:bg-amber-700 transition-all active:scale-95 whitespace-nowrap text-sm"><Plus size={18} /> 사진 추가 등록</button>
          <button onClick={handleSave} disabled={saveStatus === 'loading'} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow-md transition-all active:scale-95 whitespace-nowrap text-sm ${saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{saveStatus === 'loading' ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}{saveStatus === 'success' ? '저장/연동완료' : '서버저장'}</button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center gap-4 bg-white rounded-2xl shadow-sm border border-gray-100"><RefreshCw className="animate-spin text-amber-500" size={48} /><p className="text-gray-400 font-bold">사진 데이터를 불러오는 중...</p></div>
      ) : filteredItems.length === 0 ? (
        <div className="py-32 flex flex-col items-center gap-4 bg-white text-gray-400 rounded-2xl shadow-sm border border-gray-100"><ImageIcon size={64} /><p className="font-bold text-lg">등록된 검침 사진이 없습니다.</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white rounded-[24px] overflow-hidden border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col relative animate-scale-up">
              <div className="aspect-[4/3] w-full overflow-hidden relative cursor-pointer" onClick={() => openIndependentWindow(item.id)}>
                <img src={item.photo} alt={item.tenant} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute top-3 left-3 px-3 py-1 bg-amber-600 text-white rounded-full text-[10px] font-black shadow-md uppercase tracking-wider">{item.floor}</div>
              </div>
              <div className="p-4 flex-1 flex flex-col gap-3">
                <h3 className="font-black text-gray-900 truncate text-base mb-1">{item.tenant}</h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md self-start ${item.type === '특수' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{item.type} 계량기</span>
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 shadow-inner flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">지침값</span><span className="text-xl font-black text-blue-700 tracking-tighter">{item.reading ? parseInt(item.reading).toLocaleString() : '0'}</span></div>
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50"><div className="flex items-center gap-1.5 text-gray-400 text-[10px] font-bold"><Calendar size={12} />{item.date}</div><div className="flex items-center gap-1"><button onClick={() => openIndependentWindow(item.id)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><Edit2 size={16} /></button><button onClick={() => handleDeleteRequest(item.id)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={16} /></button></div></div>
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{` @keyframes scale-up { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } } .animate-scale-up { animation: scale-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; } `}</style>
    </div>
  );
};

export default MeterReadingPhotos;
