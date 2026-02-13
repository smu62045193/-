import React, { useState, useEffect, useMemo } from 'react';
import { FireExtinguisherItem } from '../types';
import { fetchFireExtinguisherList, saveFireExtinguisherList, deleteFireExtinguisher, generateUUID } from '../services/dataService';
import { Save, Plus, Trash2, Printer, Filter, Edit2, RotateCcw, Flame, Check, AlertCircle, X, AlertTriangle, Cloud, CheckCircle, ChevronLeft, ChevronRight, Lock, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface FireExtinguisherCheckProps {
  isPopupMode?: boolean;
}

const ITEMS_PER_PAGE = 15;

const EXTINGUISHER_TYPES = [
  "ABC분말(3.3kg)",
  "하론3K(1211)",
  "CO2(4.6K)"
];

const getFloorScore = (f: any) => {
  const s = String(f || '').toUpperCase().trim();
  if (!s || s === '미지정') return -9999;
  if (s === '옥상' || s === 'RF' || s.includes('옥탑')) return 1000;
  if (s === '지하3~5층') return -3.5;
  if (s === '창고') return -10;
  if (s.startsWith('B') || s.startsWith('지하')) {
    const numStr = s.replace(/[^0-9]/g, '');
    const num = parseInt(numStr);
    return -1 * (isNaN(num) ? 0 : num);
  }
  const numStr = s.replace(/[^0-9]/g, '');
  const num = parseInt(numStr);
  return isNaN(num) ? 0 : num;
};

const formatToYYMM = (dateStr: string) => {
  if (!dateStr) return '';
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts[0].length === 4) return `${parts[0].substring(2)}/${parts[1]}`;
  }
  return dateStr;
};

const isUndergroundFloor = (floor: string) => {
  const f = floor.trim().toUpperCase();
  return f.startsWith('B') || f.startsWith('지하');
};

const isRooftopFloor = (floor: string) => {
  const f = floor.trim().toUpperCase();
  return f.includes('옥탑') || f.includes('옥상') || f.includes('RF');
};

const FireExtinguisherCheck: React.FC<FireExtinguisherCheckProps> = ({ isPopupMode = false }) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<FireExtinguisherItem[]>([]);
  const [activeFloor, setActiveFloor] = useState<string>('전체');
  const [editId, setEditId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const initialFormState: FireExtinguisherItem = {
    id: '', manageNo: '', type: 'ABC분말(3.3kg)', floor: '', company: '', serialNo: '', phone: '', certNo: '', date: '', remarks: ''
  };
  const [formItem, setFormItem] = useState<FireExtinguisherItem>(initialFormState);

  useEffect(() => {
    loadData();

    if (isPopupMode) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id && id !== 'new') {
        setEditId(id);
      }
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'FIRE_EXT_SAVED') {
        loadData();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPopupMode]);

  useEffect(() => {
    if (isPopupMode && editId && items.length > 0) {
      const matched = items.find(i => String(i.id) === String(editId));
      if (matched) setFormItem(matched);
    }
  }, [editId, items, isPopupMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFloor, items.length]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetched = await fetchFireExtinguisherList();
      setItems(fetched || []);
    } catch (e: any) {
      console.error("데이터 로드 실패", String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const openIndependentWindow = (id: string = 'new') => {
    const width = 600;
    const height = 750;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'fire_extinguisher');
    url.searchParams.set('id', id);

    window.open(
      url.toString(),
      `FireExtWin_${id}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,location=no`
    );
  };

  const handleCancelEdit = () => {
    if (isPopupMode) {
      window.close();
    } else {
      setEditId(null);
      setFormItem(initialFormState);
    }
  };

  const handleRegister = async () => {
    if (!formItem.manageNo?.trim()) {
      alert('관리번호는 필수입니다.');
      return;
    }
    setLoading(true);
    try {
      const latestList = await fetchFireExtinguisherList();
      let newList = [...(latestList || [])];
      
      const targetId = editId || generateUUID();
      const itemToSave = { ...formItem, id: targetId };

      if (editId) {
        newList = newList.map(item => String(item.id) === String(editId) ? itemToSave : item);
      } else {
        newList = [itemToSave, ...newList];
      }

      const success = await saveFireExtinguisherList(newList);
      if (success) {
        if (window.opener) {
          window.opener.postMessage({ type: 'FIRE_EXT_SAVED' }, '*');
        }
        alert('저장이 완료되었습니다.');
        // 팝업 모드일 때 창을 닫지 않고 수정 모드로 유지 (요청사항)
        if (!editId) {
          setEditId(targetId);
          setFormItem(itemToSave);
        }
      } else {
        alert('저장 실패 (서버 오류)');
      }
    } catch (e: any) {
      alert('오류가 발생했습니다: ' + String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    const idStr = String(id);
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    setLoading(true);
    try {
      const success = await deleteFireExtinguisher(idStr);
      if (success) {
        setItems(prev => prev.filter(i => String(i.id) !== idStr));
        alert('삭제가 완료되었습니다.');
      } else {
        alert('삭제 실패 (서버 오류)');
      }
    } catch (e: any) {
      console.error(String(e));
      alert('오류가 발생했습니다: ' + String(e));
    } finally {
      setLoading(false);
    }
  };

  const filteredItemsSorted = useMemo<FireExtinguisherItem[]>(() => {
    const safeItems = Array.isArray(items) ? items : [];
    let filtered = [...safeItems];
    if (activeFloor === '지하1~6층') filtered = filtered.filter(item => isUndergroundFloor(item.floor));
    else if (activeFloor === '옥탑') filtered = filtered.filter(item => isRooftopFloor(item.floor));
    else if (activeFloor !== '전체') filtered = filtered.filter(item => item.floor === activeFloor);

    return filtered.sort((a, b) => {
      const scoreDiff = getFloorScore(b.floor) - getFloorScore(a.floor);
      if (scoreDiff !== 0) return scoreDiff;
      return (String(a.manageNo || '')).localeCompare(String(b.manageNo || ''), 'en', { numeric: true });
    });
  }, [items, activeFloor]);

  const totalPages = Math.ceil(filteredItemsSorted.length / ITEMS_PER_PAGE);
  const paginatedFlatItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItemsSorted.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItemsSorted, currentPage]);

  const displayGroups = useMemo(() => {
    const groups: Record<string, FireExtinguisherItem[]> = {};
    paginatedFlatItems.forEach(item => {
      const key = item.floor || '미지정';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    const sortedKeys = Object.keys(groups).sort((a, b) => getFloorScore(String(b)) - getFloorScore(String(a)));
    return sortedKeys.map(key => ({ floor: key, items: groups[key] }));
  }, [paginatedFlatItems]);

  const filterButtons = useMemo(() => {
    const uniqueFloors = Array.from(new Set(items.map(i => i.floor))).filter((f): f is string => !!f && typeof f === 'string' && f.trim() !== '');
    const aboveGround = uniqueFloors
      .filter((f: string) => !isUndergroundFloor(f) && !isRooftopFloor(f))
      .sort((a, b) => getFloorScore(String(b)) - getFloorScore(String(a)));
    const hasUnderground = uniqueFloors.some((f: string) => isUndergroundFloor(f));
    const hasRooftop = uniqueFloors.some((f: string) => isRooftopFloor(f));
    const btns = ['전체'];
    if (hasRooftop) btns.push('옥탑');
    btns.push(...aboveGround);
    if (hasUnderground) btns.push('지하1~6층');
    return btns;
  }, [items]);

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
    const flatRows: any[] = [];
    let globalIdx = 1;
    const fullGroups: Record<string, FireExtinguisherItem[]> = {};
    filteredItemsSorted.forEach((item: FireExtinguisherItem) => {
      const key = String(item.floor || '미지정');
      if (!fullGroups[key]) fullGroups[key] = [];
      fullGroups[key].push(item);
    });
    const sortedKeys = Object.keys(fullGroups).sort((a: string, b: string) => getFloorScore(b) - getFloorScore(a));
    sortedKeys.forEach((floor: string) => {
      flatRows.push({ isHeader: true, floor: floor });
      const currentGroup = fullGroups[floor];
      if (currentGroup) {
        currentGroup.forEach((item: FireExtinguisherItem) => {
          flatRows.push({ isHeader: false, globalIndex: globalIdx++, ...item });
        });
      }
    });
    if (flatRows.length === 0) return;
    const chunks: any[][] = [];
    let start = 0;
    while (start < flatRows.length) {
      const size = chunks.length === 0 ? 28 : 31;
      chunks.push(flatRows.slice(start, start + size));
      start += size;
    }
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;
    const tableHeader = `
      <thead>
        <tr>
          <th style="width: 30px;">No</th>
          <th style="width: 80px;">관리번호</th>
          <th style="width: 100px;">종 류</th>
          <th style="width: 70px;">층 별</th>
          <th style="width: 70px;">정비업체</th>
          <th style="width: 70px;">제조번호</th>
          <th style="width: 90px;">전화번호</th>
          <th style="width: 70px;">검정번호</th>
          <th style="width: 50px;">일 자</th>
        </tr>
      </thead>
    `;
    let pagesContent = '';
    chunks.forEach((chunk, index) => {
      const isFirstPage = index === 0;
      const rowsHtml = chunk.map(row => {
        if (row.isHeader) return `<tr><td colspan="9" style="background-color: #f3f4f6 !important; font-weight: bold; text-align: left; padding: 8px 10px; border-top: 1.5px solid black; font-size: 10pt;">[ ${row.floor} ]</td></tr>`;
        return `<tr><td>${row.globalIndex}</td><td>${row.manageNo || ''}</td><td>${row.type || ''}</td><td>${row.floor || ''}</td><td>${row.company || ''}</td><td>${row.serialNo || ''}</td><td>${row.phone || ''}</td><td>${row.certNo || ''}</td><td>${formatToYYMM(row.date || '')}</td></tr>`;
      }).join('');
      pagesContent += `<div class="print-page ${index < chunks.length - 1 ? 'page-break' : ''}">${isFirstPage ? `<div class="header-flex"><div class="title-area"><div class="doc-title">소화기 관리대장</div></div></div>` : ''}<table class="main-print-table">${tableHeader}<tbody>${rowsHtml}</tbody></table></div>`;
    });
    printWindow.document.write(`
      <html><head><title>소화기 관리대장 미리보기</title><style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
        @page { size: A4 portrait; margin: 0; }
        body { font-family: 'Noto Sans KR', sans-serif; background: #f1f5f9; padding: 0; margin: 0; color: black; line-height: 1.2; -webkit-print-color-adjust: exact; }
        .no-print { display: flex; justify-content: center; padding: 20px; }
        @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; } }
        .print-page { width: 210mm; min-height: 297mm; padding: 25mm 12mm 10mm 12mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
        @media print { .print-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; } }
        .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; min-height: 100px; }
        .title-area { flex: 1; text-align: center; }
        .doc-title { font-size: 28pt; font-weight: 900; text-decoration: underline; text-underline-offset: 8px; }
        table.main-print-table { width: 100%; border-collapse: collapse; border: 1.5px solid black; table-layout: fixed; }
        th, td { border: 1px solid black; padding: 4px 2px; text-align: center; font-size: 8.5pt; height: 28px; }
        th { background-color: #f3f4f6 !important; font-weight: bold; }
      </style></head><body><div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>${pagesContent}</body></html>`);
    printWindow.document.close();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const inputs = document.querySelectorAll('.form-input');
      const index = Array.from(inputs).indexOf(e.target as any);
      if (index > -1 && index < inputs.length - 1) (inputs[index + 1] as HTMLElement).focus();
      else if (index === inputs.length - 1) handleRegister();
    }
  };

  const inputClass = "w-full border border-gray-300 rounded px-4 py-2.5 !text-[14px] bg-white text-black focus:ring-2 focus:ring-blue-500 outline-none h-[45px] font-bold shadow-inner";

  // 팝업 모드일 때의 UI
  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 animate-fade-in">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${editId ? 'bg-orange-50' : 'bg-blue-600'}`}>
                {editId ? <Edit2 size={24} /> : <Plus size={24} />}
              </div>
              <span className="font-black text-xl tracking-tight">{editId ? '소화기 정보 수정' : '신규 소화기 등록'}</span>
            </div>
            <button onClick={() => window.close()} className="p-1 hover:bg-white/20 rounded-full transition-colors text-white">
              <X size={28} />
            </button>
          </div>

          <div className="p-8 space-y-6 flex-1 overflow-y-auto scrollbar-hide">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">관리번호 *</label>
                <input type="text" className={`${inputClass} form-input text-blue-700`} value={formItem.manageNo} onChange={(e) => setFormItem({...formItem, manageNo: e.target.value})} onKeyDown={handleKeyDown} placeholder="예: 001" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">종류</label>
                <select className={`${inputClass} form-input`} value={formItem.type} onChange={(e) => setFormItem({...formItem, type: e.target.value})}>
                  {EXTINGUISHER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">층별</label>
                <input type="text" className={`${inputClass} form-input`} value={formItem.floor} onChange={(e) => setFormItem({...formItem, floor: e.target.value})} onKeyDown={handleKeyDown} placeholder="예: 1F" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">정비업체</label>
                <input type="text" className={`${inputClass} form-input`} value={formItem.company} onChange={(e) => setFormItem({...formItem, company: e.target.value})} onKeyDown={handleKeyDown} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">제조번호</label>
                <input type="text" className={`${inputClass} form-input`} value={formItem.serialNo} onChange={(e) => setFormItem({...formItem, serialNo: e.target.value})} onKeyDown={handleKeyDown} />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">전화번호</label>
                <input type="text" className={`${inputClass} form-input`} value={formItem.phone} onChange={(e) => setFormItem({...formItem, phone: e.target.value})} onKeyDown={handleKeyDown} placeholder="010-..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">검정번호</label>
                <input type="text" className={`${inputClass} form-input`} value={formItem.certNo} onChange={(e) => setFormItem({...formItem, certNo: e.target.value})} onKeyDown={handleKeyDown} />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">일자</label>
                <input type="month" className={`${inputClass} form-input`} value={formItem.date} onChange={(e) => setFormItem({...formItem, date: e.target.value})} onKeyDown={handleKeyDown} />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">비고</label>
              <textarea className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-24 font-medium shadow-inner" value={formItem.remarks} onChange={(e) => setFormItem({...formItem, remarks: e.target.value})} placeholder="특이사항 입력" />
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
            <button onClick={() => window.close()} className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all hover:bg-slate-100 active:scale-95">닫기</button>
            <button 
              onClick={handleRegister} 
              disabled={loading}
              className={`flex-[2] py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 ${
                loading ? 'bg-slate-400 cursor-wait' : editId ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? <RefreshCw size={24} className="animate-spin" /> : <Save size={24} />}
              서버에 데이터 저장
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 메인 리스트 뷰 UI
  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-4 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-200 pb-4 print:hidden gap-4">
        <div className="flex items-center gap-2">
          <Flame className="text-red-600" size={24} />
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">소화기 관리대장</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={loadData} 
            disabled={loading} 
            className="flex items-center px-4 py-2.5 bg-white text-emerald-600 border border-emerald-200 rounded-xl font-bold shadow-sm hover:bg-emerald-50 transition-all text-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <button 
            onClick={() => openIndependentWindow()}
            className="flex items-center px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all text-sm active:scale-95"
          >
            <Plus size={18} className="mr-2" />
            신규 소화기 등록
          </button>
          <button onClick={handlePrint} className="flex items-center px-4 py-2.5 bg-gray-700 text-white rounded-xl hover:bg-gray-800 font-bold shadow-sm transition-colors text-sm active:scale-95">
            <Printer size={18} className="mr-2" />
            미리보기
          </button>
        </div>
      </div>

      <div className="print:hidden flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-black text-gray-400 uppercase tracking-widest min-w-max"><Filter size={16} /></div>
        <div className="flex overflow-x-auto whitespace-nowrap gap-2 scrollbar-hide pb-1">
          {filterButtons.map(f => (
            <button 
              key={f} 
              onClick={() => setActiveFloor(f)} 
              className={`px-5 py-2 rounded-xl text-xs font-black border transition-all ${
                activeFloor === f 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100 scale-105' 
                  : 'bg-white text-gray-400 border-gray-200 hover:border-blue-200 hover:text-blue-500'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center min-w-[1000px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest w-12">No</th>
                <th className="px-3 py-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest w-32">관리번호</th>
                <th className="px-3 py-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest w-44">종 류</th>
                <th className="px-3 py-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest w-32">층 별</th>
                <th className="px-3 py-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest w-24">정비업체</th>
                <th className="px-3 py-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest w-24">제조번호</th>
                <th className="px-3 py-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest w-32">전화번호</th>
                <th className="px-3 py-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest w-24">검정번호</th>
                <th className="px-3 py-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest w-24">일 자</th>
                <th className="px-3 py-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest">비 고</th>
                <th className="px-3 py-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest w-28 print:hidden">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && items.length === 0 ? (
                 <tr><td colSpan={11} className="py-24 text-center text-gray-400 font-bold">로딩 중...</td></tr>
              ) : paginatedFlatItems.length === 0 ? (
                 <tr><td colSpan={11} className="py-24 text-center text-gray-400 italic">표시할 데이터가 없습니다.</td></tr>
              ) : displayGroups.map(group => (
                <React.Fragment key={group.floor}>
                  <tr className="bg-slate-50/50"><td colSpan={11} className="text-left pl-6 py-3 border-b border-gray-200 text-blue-800 font-black text-sm uppercase tracking-widest">[ {String(group.floor)} ]</td></tr>
                  {group.items.map((item: FireExtinguisherItem) => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-3 py-4 text-[11px] text-gray-400 font-mono">{filteredItemsSorted.findIndex(fi => fi.id === item.id) + 1}</td>
                      <td className="px-3 py-4 text-sm font-black text-slate-800">{item.manageNo || ''}</td>
                      <td className="px-3 py-4 text-[12px] font-bold text-slate-600">{item.type || ''}</td>
                      <td className="px-3 py-4 text-[12px] font-bold text-slate-600">{item.floor || ''}</td>
                      <td className="px-3 py-4 text-[12px] text-slate-500">{item.company || '-'}</td>
                      <td className="px-3 py-4 text-[12px] text-slate-500">{item.serialNo || '-'}</td>
                      <td className="px-3 py-4 text-[12px] text-slate-500 font-mono">{item.phone || '-'}</td>
                      <td className="px-3 py-4 text-[12px] text-slate-500">{item.certNo || '-'}</td>
                      <td className="px-3 py-4 text-[12px] text-blue-600 font-bold">{formatToYYMM(item.date || '')}</td>
                      <td className="px-3 py-4 text-[11px] text-slate-400 italic text-left pl-4 max-w-[150px] truncate">{item.remarks || '-'}</td>
                      <td className="px-3 py-4 print:hidden">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openIndependentWindow(item.id)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all shadow-sm border border-blue-100" title="수정"><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteItem(item.id)} className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all shadow-sm border border-red-100" title="삭제"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-center gap-2">
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
                      : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
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

export default FireExtinguisherCheck;