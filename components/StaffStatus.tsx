import React, { useState, useRef, useEffect, useMemo } from 'react';
import { StaffMember } from '../types';
import { fetchStaffList, saveStaffList, uploadFile, deleteStaffMember } from '../services/dataService';
import { Save, Plus, Trash2, Search, Printer, Edit2, RotateCcw, UserPlus, Check, RefreshCw, Camera, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface StaffStatusProps {
  staffList: StaffMember[];
  setStaffList: React.Dispatch<React.SetStateAction<StaffMember[]>>;
  onBack?: () => void;
  isPopupMode?: boolean;
}

const ITEMS_PER_PAGE = 10;
const generateId = () => `staff_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

const StaffStatus: React.FC<StaffStatusProps> = ({ staffList, setStaffList, onBack, isPopupMode = false }) => {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialFormState: StaffMember = { id: '', category: '시설', jobTitle: '', birthDate: '', joinDate: '', resignDate: '', name: '', phone: '', area: '', note: '', photo: '' };
  const [formItem, setFormItem] = useState<StaffMember>(initialFormState);

  useEffect(() => {
    if (isPopupMode) {
      loadDataForPopup();
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id && id !== 'new') setEditId(id);
    } else {
      loadDataForPopup();
    }
  }, [isPopupMode]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'STAFF_SAVED') {
        loadDataForPopup(); 
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadDataForPopup = async () => {
    setLoading(true);
    const data = await fetchStaffList();
    if (isPopupMode) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id && id !== 'new') {
        const item = data.find(m => String(m.id) === String(id));
        if (item) setFormItem(item);
      }
    }
    setStaffList(data || []);
    setLoading(false);
  };

  const openIndependentWindow = (id: string = 'new') => {
    const width = 750;
    const height = 850; // 기존 650에서 850으로 높이 상향 조정 (스크롤 방지)
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'staff');
    url.searchParams.set('id', id);

    window.open(
      url.toString(),
      `StaffWin_${id}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,location=no`
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas'); 
          const MAX_WIDTH = 400; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH; 
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d'); 
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          setFormItem(prev => ({ ...prev, photo: canvas.toDataURL('image/jpeg', 0.8) }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = async () => {
    if (!formItem.name.trim()) { alert('성명은 필수입니다.'); return; }
    setLoading(true);
    try {
      const targetId = editId || generateId();
      let finalPhotoUrl = formItem.photo || '';
      
      if (finalPhotoUrl && finalPhotoUrl.startsWith('data:image')) {
        const fileName = `staff_${targetId}.jpg`;
        const uploadedUrl = await uploadFile('facility', 'staff', fileName, finalPhotoUrl);
        if (uploadedUrl) finalPhotoUrl = uploadedUrl;
      }

      const latestStaff = await fetchStaffList();
      const memberToSave = { 
        ...formItem, 
        id: targetId, 
        photo: finalPhotoUrl
      };

      let newList = [...latestStaff];
      if (editId) { 
        const idx = newList.findIndex(m => String(m.id) === String(editId)); 
        if (idx >= 0) newList[idx] = memberToSave; 
      } else { 
        newList = [memberToSave, ...newList]; 
      }

      const success = await saveStaffList(newList);
      if (success) { 
        if (window.opener) {
          window.opener.postMessage({ type: 'STAFF_SAVED' }, '*');
        }
        alert('성공적으로 저장되었습니다.'); 
        if (!editId) setFormItem(initialFormState);
        loadDataForPopup(); 
      } else {
        alert('서버 저장에 실패했습니다.');
      }
    } catch (e) { 
      console.error(e);
      alert('오류가 발생했습니다.'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleDeleteDirect = async (id: string) => {
    if (!confirm('해당 직원 정보를 영구적으로 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      const success = await deleteStaffMember(id);
      if (success) {
        setStaffList(prev => prev.filter(m => String(m.id) !== String(id)));
        alert('삭제되었습니다.');
      } else {
        alert('삭제 실패');
      }
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getRank = (m: StaffMember) => {
    const catOrder: Record<string, number> = { '현장대리인': 100, '시설': 200, '경비': 300, '미화': 400 };
    const base = catOrder[m.category] || 900;
    const title = m.jobTitle || '';
    let sub = 99;
    if (m.category === '현장대리인') {
      if (title.includes('소장')) sub = 1;
      else if (title.includes('과장')) sub = 2;
    } else if (m.category === '시설') {
      if (title.includes('대리')) sub = 1;
      else if (title.includes('주임')) sub = 2;
      else if (title.includes('기사')) sub = 3;
    } else if (m.category === '경비') {
      if (title.includes('반장')) sub = 1;
      else if (title.includes('대원')) sub = 2;
    } else if (m.category === '미화') {
      if (title.includes('반장')) sub = 1;
      else sub = 2;
    }
    return base + sub;
  };

  const filteredAndSortedList = useMemo(() => {
    return staffList
      .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.area.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        const rankA = getRank(a);
        const rankB = getRank(b);
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name);
      });
  }, [staffList, searchTerm]);

  const totalPages = Math.ceil(filteredAndSortedList.length / ITEMS_PER_PAGE);
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedList.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedList, currentPage]);

  const visiblePageNumbers = useMemo(() => {
    const halfWindow = 2;
    let startPage = Math.max(1, currentPage - halfWindow);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage === totalPages) startPage = Math.max(1, endPage - 4);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) if (i > 0) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) return;
    const activeStaffForPrint = filteredAndSortedList.filter(m => !m.resignDate || m.resignDate.trim() === '');
    const tableRows = activeStaffForPrint.map((m, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${m.category}</td>
        <td>${m.jobTitle || ''}</td>
        <td>${m.name}</td>
        <td>${m.birthDate || ''}</td>
        <td>${m.phone}</td>
        <td>${m.joinDate || ''}</td>
        <td>${m.area || ''}</td>
      </tr>`).join('');
    printWindow.document.write(`
      <html><head><title>직원 현황</title><style>
        @page { size: A4 portrait; margin: 0; }
        body { font-family: sans-serif; background: black; padding: 0; margin: 0; -webkit-print-color-adjust: exact; }
        .no-print { display: flex; justify-content: center; padding: 20px; }
        @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; } }
        .print-page { width: 210mm; min-height: 297mm; padding: 15mm 10mm 15mm 10mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
        h1 { text-align: center; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 20px; font-size: 24pt; font-weight: 900; }
        table { width: 100%; border-collapse: collapse; font-size: 8.5pt; table-layout: fixed; }
        th, td { border: 1px solid black; padding: 0 3px; text-align: center; word-break: break-all; height: 35px; line-height: 35px; }
        th { background: #f3f4f6; font-weight: bold; }
      </style></head><body>
        <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
        <div class="print-page">
          <h1>직원 현황 리스트</h1>
          <table>
            <thead><tr><th style="width:30px;">No</th><th style="width:70px;">구분</th><th style="width:60px;">직책</th><th style="width:60px;">성명</th><th style="width:85px;">생년월일</th><th style="width:110px;">전화번호</th><th style="width:85px;">입사일</th><th>담당구역</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </body></html>`);
    printWindow.document.close();
  };

  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col animate-fade-in">
          <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${editId ? 'bg-orange-50' : 'bg-blue-600'}`}>
                {editId ? <Edit2 size={20} /> : <UserPlus size={20} />}
              </div>
              <span className="font-black text-lg">{editId ? '직원 정보 수정' : '신규 직원 등록'}</span>
            </div>
            <button onClick={() => window.close()} className="p-1 hover:bg-white/20 rounded-full transition-colors text-white">
              <X size={24} />
            </button>
          </div>

          <div className="p-8 space-y-6 flex-1 overflow-y-auto scrollbar-hide">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex flex-col items-center">
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">직원 사진</label>
                <div onClick={() => fileInputRef.current?.click()} className="w-32 h-40 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer bg-slate-50 overflow-hidden group hover:border-blue-400 transition-all shadow-inner">
                  {formItem.photo ? (
                    <img src={formItem.photo} className="w-full h-full object-cover" alt="Staff" />
                  ) : (
                    <div className="flex flex-col items-center text-slate-300 group-hover:text-blue-400">
                      <Camera size={32} />
                      <span className="text-[10px] mt-2 font-bold uppercase">Upload</span>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-4">
                <div className="col-span-1">
                  <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">성명 *</label>
                  <input type="text" value={formItem.name} onChange={e => setFormItem({...formItem, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500" placeholder="성명" />
                </div>
                <div className="col-span-1">
                  <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">구분</label>
                  <select value={formItem.category} onChange={e => setFormItem({...formItem, category: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="시설">시설</option><option value="경비">경비</option><option value="미화">미화</option><option value="현장대리인">현장대리인</option>
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">직책</label>
                  <input type="text" value={formItem.jobTitle} onChange={e => setFormItem({...formItem, jobTitle: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="직책" />
                </div>
                <div className="col-span-1">
                  <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">생년월일</label>
                  <input type="date" value={formItem.birthDate || ''} onChange={e => setFormItem({...formItem, birthDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-1">
                  <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">입사일</label>
                  <input type="date" value={formItem.joinDate || ''} onChange={e => setFormItem({...formItem, joinDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-1">
                  <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">퇴사일</label>
                  <input type="date" value={formItem.resignDate || ''} onChange={e => setFormItem({...formItem, resignDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">전화번호</label>
                <input type="text" value={formItem.phone} onChange={e => setFormItem({...formItem, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="010-0000-0000" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">담당구역</label>
                <input type="text" value={formItem.area} onChange={e => setFormItem({...formItem, area: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="담당 업무/구역" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">비고</label>
              <textarea value={formItem.note} onChange={e => setFormItem({...formItem, note: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20" placeholder="기타 특이사항" />
            </div>
          </div>

          <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-4">
            <button onClick={() => window.close()} className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all hover:bg-slate-100 active:scale-95">닫기</button>
            <button onClick={handleRegister} disabled={loading} className={`flex-[2] py-3.5 ${editId ? 'bg-orange-50 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-2xl font-black text-base shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2`}>
              {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              서버에 데이터 저장
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] animate-fade-in">
      <div className="p-6 space-y-6">
        {/* 작은박스 1: 툴바 영역 */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-200 gap-4 print:hidden">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-[320px]">
              <input 
                type="text" 
                placeholder="성명 또는 담당구역 검색" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" 
              />
              <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button 
              onClick={() => loadDataForPopup()}
              disabled={loading}
              className="flex items-center justify-center px-4 py-2.5 bg-white text-emerald-600 border border-emerald-200 rounded-xl font-bold shadow-sm hover:bg-emerald-50 transition-all active:scale-95 text-sm"
            >
              <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
            <button onClick={() => openIndependentWindow()} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg text-sm font-black active:scale-95">
              <UserPlus size={18} /> 신규 직원 등록
            </button>
            <button onClick={handlePrint} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-amber-600 text-white px-5 py-2.5 rounded-xl hover:bg-amber-700 font-bold shadow-md text-sm transition-all active:scale-95">
              <Printer size={18} /> 미리보기
            </button>
          </div>
        </div>

        {/* 작은박스 2: 리스트 영역 */}
        <div className="bg-white rounded-xl border border-gray-300 overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-16 border border-gray-200">No</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-24 border border-gray-200">구분</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-24 border border-gray-200">직책</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-24 border border-gray-200">성명</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-32 border border-gray-200">생년월일</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-32 border border-gray-200">전화번호</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-28 border border-gray-200">입사일</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-28 border border-gray-200">퇴사일</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider border border-gray-200">담당구역</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-28 print:hidden border border-gray-200">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && paginatedList.length === 0 ? (
                <tr><td colSpan={10} className="py-24 text-center border border-gray-200"><RefreshCw size={32} className="animate-spin text-blue-500 mx-auto mb-3" /><p className="text-gray-400 font-medium">데이터를 불러오는 중...</p></td></tr>
              ) : filteredAndSortedList.length === 0 ? (
                <tr><td colSpan={10} className="py-24 text-center text-gray-400 italic text-sm border border-gray-200">등록된 직원이 없습니다.</td></tr>
              ) : (
                paginatedList.map((m, idx) => {
                  const globalIdx = filteredAndSortedList.length - ((currentPage - 1) * ITEMS_PER_PAGE + idx);
                  return (
                    <tr key={m.id} className="hover:bg-blue-50/30 transition-colors group text-center">
                      <td className="px-4 py-4 text-xs text-gray-400 font-mono border border-gray-200">{globalIdx}</td>
                      <td className="px-4 py-4 font-black text-blue-600 text-sm border border-gray-200">{m.category}</td>
                      <td className="px-4 py-4 text-sm font-medium text-slate-600 border border-gray-200">{m.jobTitle}</td>
                      <td className="px-4 py-4 text-sm font-black text-slate-900 border border-gray-200">{m.name}</td>
                      <td className="px-4 py-4 text-sm text-slate-500 font-mono border border-gray-200">{m.birthDate || '-'}</td>
                      <td className="px-4 py-4 text-sm text-slate-500 font-mono border border-gray-200">{m.phone}</td>
                      <td className="px-4 py-4 text-sm text-slate-500 font-mono border border-gray-200">{m.joinDate || '-'}</td>
                      <td className="px-4 py-4 text-sm text-rose-500 font-bold border border-gray-200">{m.resignDate || '-'}</td>
                      <td className="px-4 py-4 text-sm text-center text-slate-600 border border-gray-200">{m.area}</td>
                      <td className="px-4 py-4 print:hidden text-center border border-gray-200">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => openIndependentWindow(m.id)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all" title="수정"><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteDirect(m.id)} className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all" title="삭제"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
          
        {/* 페이지네이션 (두 번째 작은 박스 하단 외부에 위치) */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6 py-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-all active:scale-90"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-1.5 px-4">
              {visiblePageNumbers.map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-9 h-9 rounded-xl font-black text-xs transition-all ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 scale-110'
                      : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200 hover:border-blue-200 hover:text-blue-500'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-all active:scale-90"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffStatus;