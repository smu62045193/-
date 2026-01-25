
import React, { useState, useEffect, useMemo } from 'react';
import { ConstructionWorkItem, WorkPhoto } from '../types';
import { 
  fetchExternalWorkList, 
  saveExternalWorkList, 
  fetchInternalWorkList, 
  saveInternalWorkList 
} from '../services/dataService';
import { Save, Plus, Trash2, Upload, Download, Image as ImageIcon, RotateCcw, RefreshCw, Search, Edit2, Cloud, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface ConstructionLogProps {
  mode: 'external' | 'internal';
}

type WorkSource = 'external' | 'internal';
type WorkItemWithSource = ConstructionWorkItem & { source: WorkSource };

const generateId = () => Math.random().toString(36).substr(2, 9);

const formatImageUrl = (url: string) => {
  if (!url) return '';
  return url;
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
        const MAX_SIZE = 800;
        if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) { ctx.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL('image/jpeg', 0.6)); } else { reject(new Error("Canvas context not available")); }
      };
      img.onerror = reject; img.src = e.target?.result as string;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
};

const ConstructionLog: React.FC<ConstructionLogProps> = ({ mode }) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<WorkItemWithSource[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [deleteTargetItem, setDeleteTargetItem] = useState<WorkItemWithSource | null>(null);
  const [currentItem, setCurrentItem] = useState<WorkItemWithSource>({
    id: generateId(), date: new Date().toISOString().split('T')[0], category: '전기', company: '', content: '', photos: [], source: mode
  });

  // 모드별 사진 제한 개수 설정
  const PHOTO_LIMIT = mode === 'external' ? 20 : 10;

  useEffect(() => { loadData(); handleReset(false); }, [mode]);

  const loadData = async () => {
    setLoading(true);
    try {
      let fetchedItems: WorkItemWithSource[] = [];
      if (mode === 'external') {
        const externalData = await fetchExternalWorkList();
        fetchedItems = (externalData || []).map(i => ({ ...i, source: 'external' as WorkSource }));
      } else {
        const internalData = await fetchInternalWorkList();
        fetchedItems = (internalData || []).map(i => ({ ...i, source: 'internal' as WorkSource }));
      }
      fetchedItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setItems(fetchedItems);
    } catch (e) { setItems([]); } finally { setLoading(false); }
  };

  const getTitle = () => mode === 'external' ? '외부업체 공사' : '시설직 작업';

  const handleReset = (preserveDate: boolean = false) => {
    setCurrentItem(prev => ({
      id: generateId(), date: preserveDate ? prev.date : new Date().toISOString().split('T')[0], category: '전기', company: '', content: '', photos: [], source: mode
    }));
    setIsUpdateMode(false);
  };

  const handleEdit = (item: WorkItemWithSource) => { setCurrentItem({ ...item }); setIsUpdateMode(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleDelete = (e: React.MouseEvent, item: WorkItemWithSource) => {
    e.stopPropagation();
    setDeleteTargetItem(item);
  };

  const confirmDelete = async () => {
    if (!deleteTargetItem) return;
    
    const item = deleteTargetItem;
    const idStr = String(item.id);
    const originalItems = [...items];
    const newItems = items.filter(i => String(i.id) !== idStr);
    
    setItems(newItems);
    if (String(currentItem.id) === idStr) handleReset(true);
    setDeleteTargetItem(null);

    try {
      const isExternal = item.source === 'external';
      const saveFn = isExternal ? saveExternalWorkList : saveInternalWorkList;
      const listToSave = newItems.filter(i => i.source === item.source).map(({ source, ...rest }) => rest as ConstructionWorkItem);
      
      const success = await saveFn(listToSave);
      if (!success) {
        setItems(originalItems);
        alert('삭제 실패 (서버 저장 오류)');
      }
    } catch (e) {
      console.error(e);
      setItems(originalItems);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleSaveItem = async () => {
    if (!currentItem.content) { alert('내용은 필수입니다.'); return; }
    
    setLoading(true); 
    setShowSaveConfirm(false);
    try {
      const isExternal = currentItem.source === 'external';
      const saveFn = isExternal ? saveExternalWorkList : saveInternalWorkList;
      const currentList = items.filter(i => i.source === currentItem.source).map(({ source, ...rest }) => rest as ConstructionWorkItem);
      
      // 파일명 자동 변환 로직 적용: 작업내용_순번
      const renamedPhotos = currentItem.photos.map((photo, index) => ({
        ...photo,
        fileName: `${currentItem.content.trim()}_${index + 1}`
      }));

      const itemToSave: ConstructionWorkItem = { 
        id: currentItem.id, 
        date: currentItem.date, 
        category: currentItem.category, 
        company: currentItem.company, 
        content: currentItem.content, 
        photos: renamedPhotos 
      };

      let newList = [...currentList];
      const index = newList.findIndex(i => String(i.id) === String(itemToSave.id));
      if (index >= 0) newList[index] = itemToSave; else newList = [itemToSave, ...newList];
      newList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const success = await saveFn(newList);
      if (success) { 
        alert('저장되었습니다.');
        await loadData(); 
        handleReset(true); 
      } else {
        alert('저장 실패');
      }
    } catch (e) { 
      alert('오류 발생'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const fileList = Array.from(files) as File[]; const remaining = PHOTO_LIMIT - currentItem.photos.length;
    if (fileList.length > remaining) { alert(`최대 ${PHOTO_LIMIT}장까지만 가능합니다.`); return; }
    
    setLoading(true);
    const newPhotos: WorkPhoto[] = [];
    for (const file of fileList) { 
      try { 
        const resized = await resizeImage(file); 
        newPhotos.push({ id: generateId(), dataUrl: resized, fileName: file.name }); 
      } catch (err) { 
        alert(`${file.name} 처리 오류`); 
      } 
    }
    if (newPhotos.length > 0) setCurrentItem(prev => ({ ...prev, photos: [...prev.photos, ...newPhotos] }));
    setLoading(false);
    e.target.value = '';
  };

  const removePhoto = (photoId: string) => setCurrentItem(prev => ({ ...prev, photos: prev.photos.filter(p => String(p.id) !== String(photoId)) }));
  
  const downloadPhoto = (photo: WorkPhoto) => { 
    if (photo.dataUrl.startsWith('data:')) {
      const link = document.createElement('a'); 
      link.href = photo.dataUrl; 
      link.download = photo.fileName; 
      document.body.appendChild(link); 
      link.click(); 
      document.body.removeChild(link); 
    } else {
      window.open(photo.dataUrl, '_blank');
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const lowerSearch = searchTerm.toLowerCase();
    return items.filter(item => 
      (item.content || '').toLowerCase().includes(lowerSearch) ||
      (item.company || '').toLowerCase().includes(lowerSearch) ||
      (item.category || '').toLowerCase().includes(lowerSearch) ||
      (item.date || '').toLowerCase().includes(lowerSearch)
    );
  }, [items, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">{getTitle()} 관리 대장</h2>
          <div className="relative flex-1 md:w-64">
            <input 
              type="text" 
              placeholder="내용, 업체명 검색..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-black focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none shadow-inner transition-all"
            />
            <Search className="absolute left-3.5 top-2.5 text-gray-400 w-4 h-4" />
          </div>
        </div>
        <button onClick={loadData} className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-500 shrink-0">
           <RefreshCw size={18} className={loading && items.length > 0 ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className={`p-6 rounded-xl border shadow-sm animate-fade-in mb-6 transition-all duration-300 ${isUpdateMode ? 'bg-orange-50 border-orange-200' : 'bg-blue-50/50 border-blue-200'}`}>
        <h3 className="font-bold text-lg text-gray-800 mb-4 pb-2 border-b border-blue-100 flex items-center">
          <span className={`w-2 h-6 rounded-full mr-3 ${isUpdateMode ? 'bg-orange-500' : 'bg-blue-600'}`}></span>
          {isUpdateMode ? '작업 내역 수정' : '신규 작업 등록'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
          <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-500 mb-1">날짜</label><input type="date" value={currentItem.date} onChange={e => setCurrentItem({...currentItem, date: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black focus:ring-1 focus:ring-blue-400 outline-none"/></div>
          <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-500 mb-1">구분</label><select value={currentItem.category} onChange={e => setCurrentItem({...currentItem, category: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black focus:ring-1 focus:ring-blue-400 outline-none"><option value="전기">전기</option><option value="기계">기계</option><option value="소방">소방</option><option value="승강기">승강기</option><option value="영선">영선</option><option value="미화">미화</option></select></div>
          {mode === 'external' && <div className="md:col-span-3"><label className="block text-xs font-bold text-gray-500 mb-1">업체명</label><input type="text" value={currentItem.company || ''} onChange={e => setCurrentItem({...currentItem, company: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black placeholder:text-gray-300 focus:ring-1 focus:ring-blue-400 outline-none" placeholder="업체명"/></div>}
          <div className={mode === 'external' ? "md:col-span-5" : "md:col-span-8"}><label className="block text-xs font-bold text-gray-500 mb-1">내용</label><textarea value={currentItem.content} onChange={e => setCurrentItem({...currentItem, content: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black resize-none min-h-[42px] focus:ring-1 focus:ring-blue-400 outline-none"/></div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-600 mb-2">사진 첨부 ({currentItem.photos.length}/{PHOTO_LIMIT}) <span className="text-[10px] text-blue-500 ml-2">* 저장 시 파일명은 작업내용 기반으로 자동 부여됩니다.</span></label>
          <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2">
            {currentItem.photos.length < PHOTO_LIMIT && (
              <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-white hover:border-blue-400 transition-colors">
                <Upload size={20} className="text-gray-400" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload}/>
              </label>
            )}
            {currentItem.photos.map((photo) => (
              <div key={photo.id} className="relative aspect-square rounded-lg border border-gray-200 overflow-hidden group">
                <img src={formatImageUrl(photo.dataUrl)} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => downloadPhoto(photo)} className="p-1.5 bg-white rounded-full text-blue-600 hover:bg-blue-50" title="다운로드">
                    <Download size={14} />
                  </button>
                  <button onClick={() => removePhoto(photo.id)} className="p-1.5 bg-white rounded-full text-red-600 hover:bg-red-50" title="삭제">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-blue-100">
          <button onClick={() => handleReset(true)} className="flex items-center px-4 py-2 bg-white text-gray-600 rounded-lg hover:bg-gray-50 font-bold border border-gray-200 transition-all text-sm">
            <RotateCcw size={18} className="mr-2" /> 초기화
          </button>
          <button onClick={() => setShowSaveConfirm(true)} disabled={loading} className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md transition-all text-sm disabled:bg-gray-400 active:scale-95">
            <Save size={18} className="mr-2" /> {isUpdateMode ? '수정 완료' : '서버저장'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-16">No</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-32">날짜</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-24">구분</th>
                {mode === 'external' && <th className="px-4 py-3 text-left text-sm font-bold text-gray-500 uppercase tracking-wider w-48">업체명</th>}
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-500 uppercase tracking-wider">작업내용</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-20">사진</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-24">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={mode === 'external' ? 7 : 6} className="px-4 py-20 text-center text-gray-400 italic text-sm">
                    등록된 {getTitle()} 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${String(currentItem.id) === String(item.id) ? 'bg-orange-50 border-l-4 border-l-orange-400' : ''}`}>
                    <td className="px-4 py-3 text-center text-gray-400 font-mono text-xs">{filteredItems.length - idx}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{item.date}</td>
                    <td className="px-4 py-3 text-center text-sm font-bold text-blue-600">{item.category}</td>
                    {mode === 'external' && <td className="px-4 py-3 text-sm text-gray-800">{item.company || '-'}</td>}
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{item.content}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-blue-500 font-bold text-xs">
                        <ImageIcon size={14} />
                        {item.photos.length}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button onClick={() => handleEdit(item)} className="text-blue-500 hover:text-blue-700 p-1.5 rounded-lg hover:bg-blue-50" title="수정"><Edit2 size={16} /></button>
                        <button onClick={(e) => handleDelete(e, item)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50" title="삭제"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSaveConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-slate-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-100">
                <Cloud className="text-blue-600" size={36} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">서버저장 확인</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                {isUpdateMode ? '수정된 작업 내역을' : '작성하신 신규 작업 내역을'}<br/>
                서버에 안전하게 기록하시겠습니까?<br/>
                <span className="text-blue-600 text-xs font-bold mt-2 block">* 사진 파일명이 작업내용 기반으로 재정리됩니다.</span>
              </p>
              
              <div className="flex gap-3">
                <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center"><X size={20} className="mr-2" />취소</button>
                <button onClick={handleSaveItem} className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95"><CheckCircle size={20} className="mr-2" />확인</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTargetItem && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-red-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-100">
                <AlertTriangle className="text-red-600" size={36} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">작업 내역 삭제 확인</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                선택하신 {deleteTargetItem.category} 작업 내역을<br/>
                서버에서 <span className="text-red-600 font-bold">영구히 삭제</span>하시겠습니까?
              </p>
              
              <div className="flex gap-3">
                <button onClick={() => setDeleteTargetItem(null)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center">
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

export default ConstructionLog;
