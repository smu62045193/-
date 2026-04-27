
import React, { useState, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ConstructionWorkItem, WorkPhoto } from '../types';
import { 
  fetchExternalWorkList, 
  fetchInternalWorkList,
  uploadFile,
  deleteConstructionWorkItem,
  generateUUID,
  saveConstructionWorkItem
} from '../services/dataService';
import { Save, Plus, Trash2, Upload, Download, Image as ImageIcon, RefreshCw, Search, Edit2, X, ChevronLeft, ChevronRight, HardHat } from 'lucide-react';

interface ConstructionLogProps {
  mode: 'external' | 'internal';
  isPopupMode?: boolean;
}

type WorkSource = 'external' | 'internal';
type WorkItemWithSource = ConstructionWorkItem & { source: WorkSource };

const ITEMS_PER_PAGE = 10;

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

const ConstructionLog: React.FC<ConstructionLogProps> = ({ mode, isPopupMode = false }) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<WorkItemWithSource[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [currentMode, setCurrentMode] = useState<WorkSource>(mode);
  const [currentItem, setCurrentItem] = useState<WorkItemWithSource>({
    id: generateUUID(), date: new Date().toISOString().split('T')[0], category: '전기', company: '', content: '', photos: [], source: mode
  });
  const [isManualCategory, setIsManualCategory] = useState(false);

  const PREDEFINED_CATEGORIES = ['전기', '기계', '소방', '승강기', '영선', '미화', '주차', '인테리어', '복구'];

  const PHOTO_LIMIT = currentMode === 'external' ? 20 : 10;

  useEffect(() => {
    if (isPopupMode) {
      const params = new URLSearchParams(window.location.search);
      const urlMode = params.get('mode') as WorkSource;
      const urlId = params.get('id');
      
      if (urlMode) setCurrentMode(urlMode);
      
      const loadInitial = async () => {
        setLoading(true);
        let list: ConstructionWorkItem[] = [];
        if ((urlMode || mode) === 'external') {
          list = await fetchExternalWorkList();
        } else {
          list = await fetchInternalWorkList();
        }
        
        if (urlId && urlId !== 'new') {
          const matched = list.find(i => String(i.id) === String(urlId));
          if (matched) {
            setCurrentItem({ ...matched, source: urlMode || mode });
            setEditId(urlId);
            if (!PREDEFINED_CATEGORIES.includes(matched.category)) {
              setIsManualCategory(true);
            }
          }
        } else {
          setCurrentItem(prev => ({ ...prev, source: urlMode || mode }));
        }
        setLoading(false);
      };
      loadInitial();
    } else {
      loadData();
    }
    
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'CONSTRUCTION_LOG_SAVED') {
        loadData();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mode, isPopupMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, mode]);

  const loadData = async () => {
    if (isPopupMode) return;
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

  const openIndependentWindow = (id: string = 'new') => {
    const width = 900;
    const height = 850;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'construction_log');
    url.searchParams.set('mode', mode);
    url.searchParams.set('id', id);

    window.open(
      url.toString(),
      `ConstLogWin_${mode}_${id}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,location=no`
    );
  };

  const handleSaveItem = async () => {
    if (!currentItem.content) { alert('내용은 필수입니다.'); return; }
    
    if (currentMode === 'external' && !currentItem.company?.trim()) {
      if (!confirm('업체명이 입력되지 않았습니다. 계속하시겠습니까?')) {
        return;
      }
    }

    setLoading(true); 
    try {
      const uploadedPhotos: WorkPhoto[] = [];
      for (let i = 0; i < currentItem.photos.length; i++) {
        const photo = currentItem.photos[i];
        if (photo.dataUrl.startsWith('data:image')) {
          const fileName = `work_${currentItem.id}_${photo.id}.jpg`;
          const publicUrl = await uploadFile('facility', 'construction', fileName, photo.dataUrl);
          uploadedPhotos.push({
            ...photo,
            dataUrl: publicUrl || photo.dataUrl,
            fileName: `${currentItem.content.trim()}_${i + 1}`
          });
        } else {
          uploadedPhotos.push(photo);
        }
      }

      const itemToSave: ConstructionWorkItem = { 
        id: currentItem.id, 
        date: currentItem.date.includes(' ~ ') ? currentItem.date.split(' ~ ')[0] : currentItem.date, 
        category: currentItem.category, 
        company: currentItem.company, 
        content: currentItem.content, 
        photos: uploadedPhotos 
      };

      // 리스트 전체 저장이 아닌 단일 항목 저장 함수 호출
      const success = await saveConstructionWorkItem(itemToSave, currentMode);
      
      if (success) { 
        if (window.opener) {
          window.opener.postMessage({ type: 'CONSTRUCTION_LOG_SAVED' }, '*');
        }
        alert('저장이 완료되었습니다.');
        if (isPopupMode) {
          window.close();
        } else {
          // 등록 성공 후 초기화 및 리스트 새로고침
          setCurrentItem({
            id: generateUUID(), date: new Date().toISOString().split('T')[0], category: '전기', company: '', content: '', photos: [], source: currentMode
          });
          setEditId(null);
          loadData();
        }
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
        newPhotos.push({ id: generateUUID(), dataUrl: resized, fileName: file.name }); 
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

  const handleDelete = async (e: React.MouseEvent, item: WorkItemWithSource) => {
    e.stopPropagation();
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      const success = await deleteConstructionWorkItem(String(item.id));
      if (success) {
        setItems(prev => prev.filter(i => String(i.id) !== String(item.id)));
        alert('삭제가 완료되었습니다.');
      } else {
        alert('서버 데이터 삭제에 실패했습니다.');
      }
    } catch (e) { alert('삭제 중 오류 발생'); } finally { setLoading(false); }
  };

  const handleDownloadAllImages = async (item: ConstructionWorkItem) => {
    if (!item.photos || item.photos.length === 0) {
      alert('다운로드할 이미지가 없습니다.');
      return;
    }

    try {
      const zip = new JSZip();
      const folderName = `${item.date}_${item.company || '작업'}_이미지`;
      
      const downloadPromises = item.photos.map(async (photo, index) => {
        if (!photo.dataUrl) return;
        try {
          let blob: Blob;
          if (photo.dataUrl.startsWith('data:')) {
            // Base64 처리
            const response = await fetch(photo.dataUrl);
            blob = await response.blob();
          } else {
            // URL 처리
            const response = await fetch(photo.dataUrl);
            blob = await response.blob();
          }

          // 확장자 추출 (없으면 jpg)
          let extension = 'jpg';
          const urlToParse = photo.dataUrl;
          if (urlToParse.includes('.')) {
            const parts = urlToParse.split('.');
            const lastPart = parts[parts.length - 1].split('?')[0].toLowerCase();
            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(lastPart)) {
              extension = lastPart;
            }
          } else if (photo.dataUrl.startsWith('data:image/')) {
            extension = photo.dataUrl.split(';')[0].split('/')[1];
          }
          
          zip.file(`${folderName}/image_${index + 1}.${extension}`, blob);
        } catch (error) {
          console.error(`이미지 다운로드 실패: ${photo.dataUrl}`, error);
        }
      });

      await Promise.all(downloadPromises);
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${folderName}.zip`);
    } catch (error) {
      console.error("압축 파일 생성 실패", error);
      alert("이미지 압축 중 오류가 발생했습니다.");
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

  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const visiblePageNumbers = useMemo(() => {
    const halfWindow = 2;
    let startPage = Math.max(1, currentPage - halfWindow);
    const endPage = Math.min(totalPages, startPage + 4);
    if (endPage === totalPages) startPage = Math.max(1, endPage - 4);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) if (i > 0) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col animate-fade-in">
          <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${editId ? 'bg-orange-50' : 'bg-blue-600'}`}>
                <HardHat size={20} />
              </div>
              <span className="font-black text-lg">{editId ? `${currentMode === 'external' ? '외부업체' : '시설직'} 작업 수정` : `${currentMode === 'external' ? '외부업체' : '시설직'} 신규 작업 등록`}</span>
            </div>
            <button onClick={() => window.close()} className="p-1 hover:bg-white/20 rounded-full transition-colors text-white">
              <X size={24} />
            </button>
          </div>

          <div className="p-8 space-y-6 flex-1 overflow-y-auto scrollbar-hide">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">작업일 *</label>
                <input 
                  type="date" 
                  value={currentItem.date.includes(' ~ ') ? currentItem.date.split(' ~ ')[0] : currentItem.date} 
                  onChange={e => {
                    setCurrentItem({...currentItem, date: e.target.value});
                  }} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">구분</label>
                <select 
                  value={isManualCategory ? '수동입력' : currentItem.category} 
                  onChange={e => {
                    if (e.target.value === '수동입력') {
                      setIsManualCategory(true);
                      setCurrentItem({...currentItem, category: ''});
                    } else {
                      setIsManualCategory(false);
                      setCurrentItem({...currentItem, category: e.target.value});
                    }
                  }} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                >
                  {PREDEFINED_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="수동입력">수동입력</option>
                </select>
                {isManualCategory && (
                  <input 
                    type="text" 
                    value={currentItem.category} 
                    onChange={e => setCurrentItem({...currentItem, category: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="구분 직접 입력" 
                  />
                )}
              </div>
              {currentMode === 'external' && (
                <div>
                  <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">업체명</label>
                  <input type="text" value={currentItem.company || ''} onChange={e => setCurrentItem({...currentItem, company: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500" placeholder="업체명" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">작업 내용 *</label>
              <textarea value={currentItem.content} onChange={e => setCurrentItem({...currentItem, content: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none h-32" placeholder="작업 내용을 구체적으로 입력하세요." />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">사진 첨부 ({currentItem.photos.length}/{PHOTO_LIMIT})</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {currentItem.photos.length < PHOTO_LIMIT && (
                  <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer bg-slate-50 hover:border-blue-400 hover:bg-blue-50 transition-all">
                    <Upload size={32} className="text-slate-300 mb-2" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload}/>
                  </label>
                )}
                {currentItem.photos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square rounded-2xl border border-slate-200 overflow-hidden group shadow-sm bg-white">
                    <img src={formatImageUrl(photo.dataUrl)} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => downloadPhoto(photo)} className="p-2 bg-white rounded-full text-blue-600 hover:bg-blue-50 shadow-md">
                        <Download size={16} />
                      </button>
                      <button onClick={() => removePhoto(photo.id)} className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50 shadow-md">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-blue-500 mt-3 font-bold">* 저장 시 사진은 압축되어 서버에 최적화 저장됩니다.</p>
            </div>
          </div>

          <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-4">
            <button onClick={() => window.close()} className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all hover:bg-slate-100 active:scale-95">닫기</button>
            <button onClick={handleSaveItem} disabled={loading} className={`flex-[2] py-3.5 ${editId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-2xl font-black text-base shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2`}>
              {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              서버에 데이터 저장
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-fade-in pb-10">
      <div className="w-full max-w-7xl mx-auto bg-white">
        <div className="flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
          <div className="flex items-stretch shrink-0">
            <div className="relative w-full sm:w-[250px] flex items-center bg-white border-none rounded-none">
              <input 
                type="text" 
                placeholder="내용, 업체명 검색..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-none text-[14px] font-bold bg-white text-black outline-none transition-all"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black" size={18} />
            </div>
          </div>

          <div className="flex items-center shrink-0 px-2">
            <div className="w-[1px] h-6 bg-black"></div>
          </div>

          <div className="flex items-center shrink-0">
            <button 
              onClick={loadData} 
              disabled={loading}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
              title="새로고침"
            >
              <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
            
            <button 
              onClick={() => openIndependentWindow()} 
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
            >
              <Plus size={18} className="mr-1.5" />
              등록
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto bg-white border border-black overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[1000px] border-collapse text-center">
            <thead>
              <tr className="bg-white border-b border-black h-[40px]">
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-16 border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">No</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-32 border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">일자</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-24 border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">구분</div></th>
                {mode === 'external' && <th className="text-[13px] font-normal text-black uppercase tracking-wider w-48 border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">업체명</div></th>}
                <th className="text-[13px] font-normal text-black uppercase tracking-wider border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">작업내용</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-20 border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">사진</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-24 px-2"><div className="flex items-center justify-center h-full px-2">관리</div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {paginatedItems.length === 0 ? (
                <tr className="h-[40px]">
                  <td colSpan={mode === 'external' ? 7 : 6} className="text-center text-gray-400 italic border-b border-black text-[13px] font-normal px-2">
                    <div className="flex items-center justify-center h-full py-24">
                      등록된 {mode === 'external' ? '외부업체' : '시설직'} 내역이 없습니다.
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const globalIdx = totalItems - ((currentPage - 1) * ITEMS_PER_PAGE + idx);
                  return (
                    <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group border-b border-black last:border-b-0 h-[40px]">
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2"><div className="flex items-center justify-center h-full px-2 font-mono text-xs">{globalIdx}</div></td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">{item.date}</div></td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2">
                        <div className="flex items-center justify-center h-full px-2">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">{item.category}</span>
                        </div>
                      </td>
                      {mode === 'external' && <td className="text-center text-black text-[13px] font-normal border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">{item.company || '-'}</div></td>}
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2 whitespace-pre-wrap"><div className="flex items-center justify-center h-full px-2">{item.content}</div></td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2">
                        <div className="flex items-center justify-center h-full px-2 gap-1 text-blue-500 font-bold text-xs">
                          <ImageIcon size={14} />
                          {item.photos.length}
                        </div>
                      </td>
                      <td className="text-center text-black text-[13px] font-normal px-2">
                        <div className="flex items-center justify-center h-full px-2 gap-1 py-1">
                          <button onClick={() => handleDownloadAllImages(item)} className="p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-all" title="이미지 전체 다운로드"><Download size={16} /></button>
                          <button onClick={() => openIndependentWindow(String(item.id))} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all" title="수정"><Edit2 size={16} /></button>
                          <button onClick={(e) => handleDelete(e, item)} className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all" title="삭제"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 UI - 미니멀 텍스트 스타일로 정밀 수정 */}
      {!loading && totalPages > 1 && (
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="p-2 bg-transparent border-none text-black disabled:text-gray-300 disabled:cursor-not-allowed transition-all active:scale-90 shadow-none cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="flex items-center gap-2">
            {visiblePageNumbers.map(pageNum => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-9 h-9 bg-transparent border-none transition-all active:scale-90 flex items-center justify-center ${
                  currentPage === pageNum
                    ? 'text-black font-bold scale-110 cursor-default'
                    : 'text-black font-normal hover:text-blue-500 cursor-pointer'
                }`}
              >
                <span className="text-[13px]">{pageNum}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="p-2 bg-transparent border-none text-black disabled:text-gray-300 disabled:cursor-not-allowed transition-all active:scale-90 shadow-none cursor-pointer"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ConstructionLog;
