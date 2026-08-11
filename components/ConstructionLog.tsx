import React, { useState, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ConstructionWorkItem, WorkPhoto, Contractor, SubcontractorLog } from '../types';
import { 
  fetchExternalWorkList, 
  fetchInternalWorkList,
  uploadFile,
  deleteConstructionWorkItem,
  generateUUID,
  saveConstructionWorkItem,
  fetchContractors
} from '../services/dataService';
import { 
  Save, Plus, Trash2, Upload, Download, Image as ImageIcon, 
  RefreshCw, Search, Edit2, X, ChevronLeft, ChevronRight, 
  HardHat, ChevronDown, ChevronUp 
} from 'lucide-react';
import { format } from 'date-fns';

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
  const [coopPartners, setCoopPartners] = useState<Contractor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const [currentMode, setCurrentMode] = useState<WorkSource>(mode);
  const [currentItem, setCurrentItem] = useState<WorkItemWithSource>({
    id: generateUUID(),
    date: `${new Date().toISOString().split('T')[0]} ~ `,
    category: '전기',
    company: '',
    contactPerson: '',
    phoneMain: '',
    phoneMobile: '',
    note: '',
    content: '',
    photos: [],
    subcontractors: [],
    source: mode
  });
  const [isManualCategory, setIsManualCategory] = useState(false);

  // 협력(하청) 업체 추가용 서브 상태
  const [subStartDate, setSubStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [subEndDate, setSubEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [subCompany, setSubCompany] = useState<string>('');
  const [subWorker, setSubWorker] = useState<string>('');
  const [subPhone, setSubPhone] = useState<string>('');
  const [subWorkContent, setSubWorkContent] = useState<string>('');
  const [editingSubId, setEditingSubId] = useState<string | null>(null);

  const PREDEFINED_CATEGORIES = ['전기', '기계', '소방', '승강기', '영선', '미화', '주차', '인테리어', '복구'];

  const getDatesInRange = (dateStr: string): string[] => {
    if (!dateStr) return [];
    const parts = dateStr.split('~').map(p => p.trim());
    const startDateStr = parts[0];
    const endDateStr = parts[1];
    
    if (!startDateStr) return [];
    
    const start = new Date(startDateStr);
    let end: Date;
    
    if (!endDateStr) {
      if (dateStr.includes('~')) {
        const todayStr = new Date().toISOString().split('T')[0];
        end = new Date(todayStr);
      } else {
        return [startDateStr];
      }
    } else {
      end = new Date(endDateStr);
    }
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return [startDateStr];
    }
    
    const dates: string[] = [];
    let current = new Date(start);
    while (current <= end) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }
    return dates;
  };

  const datesInRange = useMemo(() => getDatesInRange(currentItem.date), [currentItem.date]);
  const isProgressing = useMemo(() => {
    return currentItem.date.includes('~') && !currentItem.date.split('~')[1]?.trim();
  }, [currentItem.date]);
  const [selectedUploadDate, setSelectedUploadDate] = useState<string>('');
  const [hideEmptyDates, setHideEmptyDates] = useState<boolean>(true);

  const exactMatch = useMemo(() => {
    if (!currentItem.company) return false;
    return coopPartners.some(p => p.name.trim().toLowerCase() === currentItem.company?.trim().toLowerCase());
  }, [coopPartners, currentItem.company]);

  useEffect(() => {
    if (datesInRange.length > 0) {
      if (!selectedUploadDate || !datesInRange.includes(selectedUploadDate)) {
        setSelectedUploadDate(datesInRange[0]);
      }
    } else {
      setSelectedUploadDate('');
    }
  }, [datesInRange, selectedUploadDate]);

  useEffect(() => {
    loadCoopPartners();

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
            let formattedDate = matched.date || '';
            if (formattedDate && !formattedDate.includes('~')) {
              formattedDate = `${formattedDate.trim()} ~ `;
            }
            setCurrentItem({ 
              ...matched, 
              date: formattedDate, 
              source: urlMode || mode,
              subcontractors: matched.subcontractors || []
            });
            setEditId(urlId);
            if (!PREDEFINED_CATEGORIES.includes(matched.category)) {
              setIsManualCategory(true);
            }
          }
        } else {
          const today = new Date().toISOString().split('T')[0];
          setCurrentItem(prev => ({ ...prev, date: `${today} ~ `, source: urlMode || mode }));
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

  const loadCoopPartners = async () => {
    try {
      const coops = await fetchContractors();
      setCoopPartners(coops || []);
    } catch (e) {
      console.error('loadCoopPartners error:', e);
    }
  };

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
      fetchedItems.sort((a, b) => {
        const aNoEnd = a.date && a.date.includes('~') && !a.date.split('~')[1]?.trim();
        const bNoEnd = b.date && b.date.includes('~') && !b.date.split('~')[1]?.trim();
        
        if (aNoEnd !== bNoEnd) {
          return aNoEnd ? -1 : 1;
        }
        
        const aStart = a.date && a.date.includes('~') ? a.date.split('~')[0].trim() : (a.date || '');
        const bStart = b.date && b.date.includes('~') ? b.date.split('~')[0].trim() : (b.date || '');
        return bStart.localeCompare(aStart);
      });
      setItems(fetchedItems);
    } catch (e) { setItems([]); } finally { setLoading(false); }
  };

  const openIndependentWindow = (id: string = 'new') => {
    const width = 950;
    const height = 900;
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

  const handleLoadCoopInfo = () => {
    if (!currentItem.company?.trim()) {
      alert('업체명을 입력해주세요.');
      return;
    }
    const match = coopPartners.find(p => p.name.trim().toLowerCase() === currentItem.company?.trim().toLowerCase());
    if (match) {
      setCurrentItem(prev => ({
        ...prev,
        contactPerson: match.contactPerson || prev.contactPerson || '',
        phoneMain: match.phoneMain || prev.phoneMain || '',
        phoneMobile: match.phoneMobile || prev.phoneMobile || ''
      }));
      alert(`[${match.name}] 협력업체 정보를 성공적으로 불러왔습니다.`);
    } else {
      alert('입력하신 업체명과 일치하는 등록된 협력업체가 없습니다.');
    }
  };

  const handleSaveItem = async () => {
    if (!currentItem.content) { alert('작업 내용은 필수입니다.'); return; }
    
    if (currentMode === 'external' && !currentItem.company?.trim()) {
      if (!confirm('업체명이 입력되지 않았습니다. 계속하시겠습니까?')) {
        return;
      }
    }

    setLoading(true); 
    try {
      const uploadedPhotos: WorkPhoto[] = [];
      const dates = getDatesInRange(currentItem.date);
      const defaultDate = dates[0] || new Date().toISOString().split('T')[0];

      const photosByDate: { [date: string]: WorkPhoto[] } = {};
      dates.forEach(dt => {
        photosByDate[dt] = [];
      });

      currentItem.photos.forEach(photo => {
        const pDate = photo.date || defaultDate;
        if (!photosByDate[pDate]) {
          photosByDate[pDate] = [];
        }
        photosByDate[pDate].push(photo);
      });

      for (const dVal of Object.keys(photosByDate)) {
        const dayPhotos = photosByDate[dVal];
        for (let idx = 0; idx < dayPhotos.length; idx++) {
          const photo = dayPhotos[idx];
          const fileNum = idx + 1;
          const cleanContent = currentItem.content.trim().split('\n')[0].replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s_-]+/g, '').substring(0, 30);
          const targetPhotoName = `${cleanContent}-${dVal}-${fileNum}`;

          if (photo.dataUrl.startsWith('data:image')) {
            const fileName = `work_${currentItem.id}_${photo.id}.jpg`;
            const publicUrl = await uploadFile('facility', 'construction', fileName, photo.dataUrl);
            uploadedPhotos.push({
              ...photo,
              dataUrl: publicUrl || photo.dataUrl,
              fileName: targetPhotoName,
              date: dVal
            });
          } else {
            uploadedPhotos.push({
              ...photo,
              fileName: targetPhotoName,
              date: dVal
            });
          }
        }
      }

      const itemToSave: ConstructionWorkItem = { 
        id: currentItem.id, 
        date: currentItem.date, 
        category: currentItem.category, 
        company: currentItem.company, 
        contactPerson: currentItem.contactPerson,
        phoneMain: currentItem.phoneMain,
        phoneMobile: currentItem.phoneMobile,
        content: currentItem.content, 
        photos: uploadedPhotos,
        subcontractors: currentItem.subcontractors || []
      };

      const success = await saveConstructionWorkItem(itemToSave, currentMode);
      
      if (success) { 
        if (window.opener) {
          window.opener.postMessage({ type: 'CONSTRUCTION_LOG_SAVED' }, '*');
        }
        alert('저장이 완료되었습니다.');
        if (isPopupMode) {
          window.close();
        } else {
          setCurrentItem({
            id: generateUUID(),
            date: `${new Date().toISOString().split('T')[0]} ~ `,
            category: '전기',
            company: '',
            contactPerson: '',
            phoneMain: '',
            phoneMobile: '',
            note: '',
            content: '',
            photos: [],
            subcontractors: [],
            source: currentMode
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
    const fileList = Array.from(files) as File[];
    
    const dates = getDatesInRange(currentItem.date);
    const targetDate = selectedUploadDate || dates[0] || new Date().toISOString().split('T')[0];

    const currentDayPhotos = currentItem.photos.filter(p => (p.date || dates[0]) === targetDate);
    const remaining = 15 - currentDayPhotos.length;

    if (fileList.length > remaining) { 
      alert(`해당 일자(${targetDate})의 사진은 최대 15장까지만 가능합니다. (현재 ${currentDayPhotos.length}장 등록됨, 추가 가능: ${remaining}장)`); 
      return; 
    }
    
    setLoading(true);
    const newPhotos: WorkPhoto[] = [];
    for (const file of fileList) { 
      try { 
        const resized = await resizeImage(file); 
        newPhotos.push({ 
          id: generateUUID(), 
          dataUrl: resized, 
          fileName: file.name,
          date: targetDate
        }); 
      } catch (err) { 
        alert(`${file.name} 처리 오류`); 
      } 
    }
    if (newPhotos.length > 0) {
      setCurrentItem(prev => ({ 
        ...prev, 
        photos: [...prev.photos, ...newPhotos] 
      }));
    }
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
            const response = await fetch(photo.dataUrl);
            blob = await response.blob();
          } else {
            const response = await fetch(photo.dataUrl);
            blob = await response.blob();
          }

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
          
          const nameInZip = photo.fileName || `image_${index + 1}`;
          zip.file(`${folderName}/${nameInZip}.${extension}`, blob);
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
      (item.date || '').toLowerCase().includes(lowerSearch) ||
      (item.contactPerson || '').toLowerCase().includes(lowerSearch) ||
      (item.phoneMain || '').toLowerCase().includes(lowerSearch) ||
      (item.phoneMobile || '').toLowerCase().includes(lowerSearch)
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
            {/* 날짜 및 구분 세션 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">시작일 *</label>
                <input 
                  type="date" 
                  value={currentItem.date.includes('~') ? currentItem.date.split('~')[0].trim() : currentItem.date} 
                  onChange={e => {
                    const start = e.target.value;
                    const parts = currentItem.date.split('~');
                    const end = parts[1] ? parts[1].trim() : '';
                    setCurrentItem({...currentItem, date: `${start} ~ ${end}`});
                  }} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">종료일</label>
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={isProgressing} 
                      onChange={(e) => {
                        const parts = currentItem.date.split('~');
                        const start = parts[0] ? parts[0].trim() : new Date().toISOString().split('T')[0];
                        if (e.target.checked) {
                          setCurrentItem({ ...currentItem, date: `${start} ~ ` });
                        } else {
                          const end = parts[1] && parts[1].trim() ? parts[1].trim() : start;
                          setCurrentItem({ ...currentItem, date: `${start} ~ ${end}` });
                        }
                      }}
                      className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-bold text-amber-600">진행중</span>
                  </label>
                </div>
                <input 
                  type="date" 
                  value={currentItem.date.includes('~') ? (currentItem.date.split('~')[1] || '').trim() : ''} 
                  onChange={e => {
                    const end = e.target.value;
                    const parts = currentItem.date.split('~');
                    const start = parts[0] ? parts[0].trim() : currentItem.date;
                    setCurrentItem({...currentItem, date: `${start} ~ ${end}`});
                  }} 
                  disabled={isProgressing}
                  className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500 ${isProgressing ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`} 
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
            </div>

            {/* 외부업체 전용: 업체명 & 연락처 정보 */}
            {currentMode === 'external' && (
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">업체명 *</label>
                      {exactMatch && (
                        <span className="text-[10px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded border border-green-200 animate-pulse">협력업체 매칭됨</span>
                      )}
                    </div>
                    {currentItem.company?.trim() && (
                      <button 
                        type="button" 
                        onClick={handleLoadCoopInfo} 
                        className="text-[11px] font-black text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200"
                      >
                        <RefreshCw size={10} className="animate-spin-slow" />
                        협력업체 연락처 불러오기
                      </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    list="coop-partners"
                    value={currentItem.company || ''} 
                    onChange={e => {
                      const val = e.target.value;
                      const match = coopPartners.find(p => p.name.trim().toLowerCase() === val.trim().toLowerCase());
                      if (match) {
                        setCurrentItem(prev => ({
                          ...prev,
                          company: val,
                          contactPerson: match.contactPerson || prev.contactPerson || '',
                          phoneMain: match.phoneMain || prev.phoneMain || '',
                          phoneMobile: match.phoneMobile || prev.phoneMobile || ''
                        }));
                      } else {
                        setCurrentItem(prev => ({ ...prev, company: val }));
                      }
                    }} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="업체명을 입력하세요 (협력업체 자동 매칭 가능)" 
                  />
                  <datalist id="coop-partners">
                    {coopPartners.map(p => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">담당자</label>
                    <input 
                      type="text" 
                      value={currentItem.contactPerson || ''} 
                      onChange={e => setCurrentItem({...currentItem, contactPerson: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder="담당자 성명" 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">대표번호</label>
                    <input 
                      type="text" 
                      value={currentItem.phoneMain || ''} 
                      onChange={e => setCurrentItem({...currentItem, phoneMain: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder="02-..." 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">휴대폰</label>
                    <input 
                      type="text" 
                      value={currentItem.phoneMobile || ''} 
                      onChange={e => setCurrentItem({...currentItem, phoneMobile: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder="010-..." 
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">작업 내용 *</label>
              <textarea value={currentItem.content} onChange={e => setCurrentItem({...currentItem, content: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none h-28" placeholder="작업 내용을 구체적으로 입력하세요." />
            </div>

            {/* 외부업체 전용: 협력(하청) 업체 및 작업자 이력 관리 섹션 */}
            {currentMode === 'external' && (
              <div className="border-t border-slate-200 pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-slate-950 rounded-full"></div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">협력(하청) 업체 및 작업자 이력</h3>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">시작일</label>
                      <input 
                        type="date" 
                        value={subStartDate} 
                        onChange={e => setSubStartDate(e.target.value)} 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">종료일</label>
                      <input 
                        type="date" 
                        value={subEndDate} 
                        onChange={e => setSubEndDate(e.target.value)} 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">협력(하청) 업체명</label>
                      <input 
                        type="text" 
                        value={subCompany} 
                        onChange={e => setSubCompany(e.target.value)} 
                        placeholder="예: 모더너스 협력" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">작업자</label>
                      <input 
                        type="text" 
                        value={subWorker} 
                        onChange={e => setSubWorker(e.target.value)} 
                        placeholder="예: 김작업 외 2명" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">휴대폰</label>
                      <input 
                        type="text" 
                        value={subPhone} 
                        onChange={e => setSubPhone(e.target.value)} 
                        placeholder="예: 010-1234-5678" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">작업내용</label>
                      <input 
                        type="text" 
                        value={subWorkContent} 
                        onChange={e => setSubWorkContent(e.target.value)} 
                        placeholder="예: 천장 마감 작업" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1 gap-2">
                    {editingSubId ? (
                      <>
                        <button 
                          type="button" 
                          onClick={() => {
                            setEditingSubId(null);
                            setSubCompany('');
                            setSubWorker('');
                            setSubPhone('');
                            setSubWorkContent('');
                          }}
                          className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-black text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                        >
                          수정 취소
                        </button>
                        <button 
                          type="button" 
                          onClick={() => {
                            setCurrentItem(prev => ({
                              ...prev,
                              subcontractors: (prev.subcontractors || []).map(item => {
                                if (item.id === editingSubId) {
                                  return {
                                    ...item,
                                    startDate: subStartDate,
                                    endDate: subEndDate,
                                    company: subCompany.trim() || '-',
                                    workerName: subWorker.trim() || '-',
                                    phone: subPhone.trim() || '-',
                                    workContent: subWorkContent.trim() || '-'
                                  };
                                }
                                return item;
                              })
                            }));
                            setEditingSubId(null);
                            setSubCompany('');
                            setSubWorker('');
                            setSubPhone('');
                            setSubWorkContent('');
                          }}
                          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                        >
                          <Save size={14} />수정 완료
                        </button>
                      </>
                    ) : (
                      <button 
                        type="button" 
                        onClick={() => {
                          const newSub = {
                            id: generateUUID(),
                            startDate: subStartDate,
                            endDate: subEndDate,
                            company: subCompany.trim() || '-',
                            workerName: subWorker.trim() || '-',
                            phone: subPhone.trim() || '-',
                            workContent: subWorkContent.trim() || '-'
                          };
                          setCurrentItem(prev => ({
                            ...prev,
                            subcontractors: [...(prev.subcontractors || []), newSub]
                          }));
                          setSubCompany('');
                          setSubWorker('');
                          setSubPhone('');
                          setSubWorkContent('');
                        }}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                      >
                        <Plus size={14} />이력 추가
                      </button>
                    )}
                  </div>
                </div>

                {/* 추가된 이력 목록 */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">추가된 이력 목록 (총 {(currentItem.subcontractors || []).length}건)</label>
                  {(!currentItem.subcontractors || currentItem.subcontractors.length === 0) ? (
                    <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      추가된 하청업체/작업자 이력이 없습니다.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-60 overflow-y-auto w-full">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-500 border-b border-slate-200">
                            <th className="py-2.5 font-bold border-r border-slate-200 w-32">기간 (작업일)</th>
                            <th className="py-2.5 font-bold border-r border-slate-200 w-36">업체명</th>
                            <th className="py-2.5 font-bold border-r border-slate-200 w-28">작업자</th>
                            <th className="py-2.5 font-bold border-r border-slate-200 w-32">휴대폰</th>
                            <th className="py-2.5 font-bold border-r border-slate-200">작업내용</th>
                            <th className="py-2.5 font-bold w-20">관리</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {(currentItem.subcontractors || []).map(sub => (
                            <tr key={sub.id} className="hover:bg-slate-50/50">
                              <td className="py-2 border-r border-slate-200 font-mono">
                                {sub.startDate === sub.endDate ? sub.startDate : `${sub.startDate} ~ ${sub.endDate}`}
                              </td>
                              <td className="py-2 border-r border-slate-200 font-black text-blue-700">{sub.company}</td>
                              <td className="py-2 border-r border-slate-200 font-bold">{sub.workerName}</td>
                              <td className="py-2 border-r border-slate-200 font-bold text-slate-600">{sub.phone}</td>
                              <td className="py-2 border-r border-slate-200 font-bold text-slate-600 text-left px-2 truncate max-w-xs" title={sub.workContent}>{sub.workContent}</td>
                              <td className="py-2">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      setEditingSubId(sub.id);
                                      setSubStartDate(sub.startDate);
                                      setSubEndDate(sub.endDate);
                                      setSubCompany(sub.company === '-' ? '' : sub.company);
                                      setSubWorker(sub.workerName === '-' ? '' : sub.workerName);
                                      setSubPhone(sub.phone === '-' ? '' : sub.phone);
                                      setSubWorkContent(sub.workContent === '-' ? '' : sub.workContent);
                                    }}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center justify-center"
                                    title="수정"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      if (editingSubId === sub.id) {
                                        setEditingSubId(null);
                                        setSubCompany('');
                                        setSubWorker('');
                                        setSubPhone('');
                                        setSubWorkContent('');
                                      }
                                      setCurrentItem(prev => ({
                                        ...prev,
                                        subcontractors: (prev.subcontractors || []).filter(item => item.id !== sub.id)
                                      }));
                                    }}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center justify-center"
                                    title="삭제"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 사진 첨부 섹션 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">사진 첨부 (총 {currentItem.photos.length}장)</label>
                {datesInRange.length > 1 && (
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={hideEmptyDates} 
                      onChange={(e) => setHideEmptyDates(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer text-xs"
                    />
                    <span className="text-[11px] font-bold text-slate-500 select-none">사진 없는 날짜 숨기기</span>
                  </label>
                )}
              </div>
              
              {/* 일자별 탭 선택기 */}
              {datesInRange.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                  {datesInRange
                    .filter((dateVal, index) => {
                      if (!hideEmptyDates) return true;
                      const countForThisDate = currentItem.photos.filter(p => (p.date || datesInRange[0]) === dateVal).length;
                      return index === 0 || index === datesInRange.length - 1 || countForThisDate > 0 || selectedUploadDate === dateVal;
                    })
                    .map((dateVal) => {
                      const countForThisDate = currentItem.photos.filter(p => (p.date || datesInRange[0]) === dateVal).length;
                      const isSelected = selectedUploadDate === dateVal;
                      const formattedTabDate = dateVal.includes('-') ? dateVal.split('-').slice(1).join('-') : dateVal;
                      return (
                        <button
                          key={dateVal}
                          type="button"
                          onClick={() => setSelectedUploadDate(dateVal)}
                          className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
                            isSelected 
                              ? 'bg-blue-600 text-white shadow-md' 
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {formattedTabDate} [{countForThisDate}/15장]
                        </button>
                      );
                    })}
                </div>
              )}

              {/* 현재 선택된 일자 표시 */}
              {selectedUploadDate && (
                <div className="mb-3 text-[11px] font-extrabold text-blue-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block animate-pulse"></span>
                  현재 선택된 일자: {selectedUploadDate} (최대 15장 등록 가능)
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {currentItem.photos.filter(p => (p.date || datesInRange[0]) === selectedUploadDate).length < 15 && (
                  <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer bg-slate-50 hover:border-blue-400 hover:bg-blue-50 transition-all">
                    <Upload size={32} className="text-slate-300 mb-2" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload}/>
                  </label>
                )}
                {currentItem.photos
                  .filter(photo => (photo.date || datesInRange[0]) === selectedUploadDate)
                  .map((photo) => (
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
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-12 border-r border-black px-2"><div className="flex items-center justify-center h-full">NO</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-32 border-r border-black px-2"><div className="flex items-center justify-center h-full">일자</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-20 border-r border-black px-2"><div className="flex items-center justify-center h-full">구분</div></th>
                {mode === 'external' && (
                  <>
                    <th className="text-[13px] font-normal text-black uppercase tracking-wider w-36 border-r border-black px-2"><div className="flex items-center justify-center h-full">업체명</div></th>
                    <th className="text-[13px] font-normal text-black uppercase tracking-wider w-24 border-r border-black px-2"><div className="flex items-center justify-center h-full">담당자</div></th>
                    <th className="text-[13px] font-normal text-black uppercase tracking-wider w-28 border-r border-black px-2"><div className="flex items-center justify-center h-full">대표번호</div></th>
                    <th className="text-[13px] font-normal text-black uppercase tracking-wider w-28 border-r border-black px-2"><div className="flex items-center justify-center h-full">휴대폰</div></th>
                  </>
                )}
                <th className="text-[13px] font-normal text-black uppercase tracking-wider border-r border-black px-2"><div className="flex items-center justify-center h-full">작업내용</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-16 border-r border-black px-2"><div className="flex items-center justify-center h-full">사진</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-24 px-2"><div className="flex items-center justify-center h-full">관리</div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {paginatedItems.length === 0 ? (
                <tr className="h-[40px]">
                  <td colSpan={mode === 'external' ? 10 : 6} className="text-center text-gray-400 italic border-b border-black text-[13px] font-normal px-2">
                    <div className="flex items-center justify-center h-full py-24">
                      등록된 {mode === 'external' ? '외부업체' : '시설직'} 내역이 없습니다.
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const globalIdx = totalItems - ((currentPage - 1) * ITEMS_PER_PAGE + idx);
                  const isNoEnd = item.date && item.date.includes('~') && !item.date.split('~')[1]?.trim();
                  const isExpanded = !!expandedIds[item.id];
                  const hasSubcontractors = item.subcontractors && item.subcontractors.length > 0;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className={`transition-colors group border-b border-black h-[40px] ${
                        isNoEnd 
                          ? 'bg-amber-50/90 hover:bg-amber-100/90 font-bold' 
                          : 'hover:bg-blue-50/40'
                      }`}>
                        <td className="text-center text-black text-[13px] font-normal border-r border-black px-2">
                          <div className="flex items-center justify-center h-full font-mono text-xs">{isNoEnd ? "" : globalIdx}</div>
                        </td>
                        <td className="text-center text-black text-[13px] font-normal border-r border-black px-2">
                          <div className="flex items-center justify-center h-full px-2 gap-1.5">
                            <span>
                              {(() => {
                                if (item.date && item.date.includes('~')) {
                                  const parts = item.date.split('~');
                                  if (parts[0] && parts[1] && parts[0].trim() === parts[1].trim()) {
                                    return parts[0].trim();
                                  }
                                  if (parts[0] && !parts[1]?.trim()) {
                                    return `${parts[0].trim()} ~`;
                                  }
                                  return item.date;
                                }
                                return item.date;
                              })()}
                            </span>
                            {isNoEnd && item.date && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-200 text-amber-900 border border-amber-300 font-black text-[10px] scale-95 animate-pulse">
                                진행중
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-center text-black text-[13px] font-normal border-r border-black px-2">
                          <div className="flex items-center justify-center h-full">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">{item.category}</span>
                          </div>
                        </td>
                        {mode === 'external' && (
                          <>
                            <td className="text-center text-black text-[13px] font-normal border-r border-black px-2">
                              <div className="flex items-center justify-center h-full gap-1">
                                <span className="font-bold text-blue-900">{item.company || '-'}</span>
                                {hasSubcontractors && (
                                  <button 
                                    onClick={() => setExpandedIds(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                    className="px-1.5 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 text-[10px] font-black flex items-center gap-0.5 transition-colors"
                                    title="하청/작업자 이력 토글"
                                  >
                                    <span>하청 {item.subcontractors!.length}건</span>
                                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="text-center text-black text-[13px] font-normal border-r border-black px-2">
                              <div className="flex items-center justify-center h-full">{item.contactPerson || '-'}</div>
                            </td>
                            <td className="text-center text-black text-[13px] font-normal border-r border-black px-2">
                              <div className="flex items-center justify-center h-full font-mono text-xs">{item.phoneMain || '-'}</div>
                            </td>
                            <td className="text-center text-black text-[13px] font-normal border-r border-black px-2">
                              <div className="flex items-center justify-center h-full font-mono text-xs">{item.phoneMobile || '-'}</div>
                            </td>
                          </>
                        )}
                        <td className="text-center text-black text-[13px] font-normal border-r border-black px-2 whitespace-pre-wrap">
                          <div className="flex items-center justify-center h-full px-2">{item.content}</div>
                        </td>
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

                      {/* 하청/작업자 이력 서브 테이블 확장 */}
                      {mode === 'external' && hasSubcontractors && isExpanded && (
                        <tr className="bg-slate-50/50 border-b border-black">
                          <td colSpan={10} className="p-3 bg-[#FCFDFE]">
                            <div className="max-w-[1100px] mx-auto border border-black rounded-lg bg-white overflow-hidden shadow-sm">
                              <table className="w-full text-center border-collapse">
                                <thead>
                                  <tr className="bg-slate-100 text-slate-800 border-b border-black font-bold h-8 text-[12px]">
                                    <th className="border-r border-black font-bold w-40">기간 (작업일)</th>
                                    <th className="border-r border-black font-bold w-52">협력(하청) 업체명</th>
                                    <th className="border-r border-black font-bold w-40">작업자</th>
                                    <th className="border-r border-black font-bold w-44">휴대폰</th>
                                    <th className="font-bold text-center">작업내용</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.subcontractors!.map(sub => (
                                    <tr key={sub.id} className="h-8 border-b border-gray-100 last:border-b-0 hover:bg-slate-50 text-[11px]">
                                      <td className="border-r border-black font-mono text-[11px]">
                                        {sub.startDate === sub.endDate ? sub.startDate : `${sub.startDate} ~ ${sub.endDate}`}
                                      </td>
                                      <td className="border-r border-black text-blue-800 font-bold text-[11px]">{sub.company}</td>
                                      <td className="border-r border-black font-bold text-gray-700 text-[11px]">{sub.workerName}</td>
                                      <td className="border-r border-black font-bold text-gray-600 text-[11px]">{sub.phone}</td>
                                      <td className="font-medium text-gray-600 text-left px-3 text-[11px] truncate max-w-md" title={sub.workContent}>{sub.workContent}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 UI */}
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
