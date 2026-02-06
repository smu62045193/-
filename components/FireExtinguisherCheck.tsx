
import React, { useState, useEffect, useMemo } from 'react';
import { FireExtinguisherItem } from '../types';
import { fetchFireExtinguisherList, saveFireExtinguisherList, deleteFireExtinguisher, generateUUID } from '../services/dataService';
import { Save, Plus, Trash2, Printer, Filter, Edit2, RotateCcw, Flame, Check, AlertCircle, X, AlertTriangle, Cloud, CheckCircle, ChevronLeft, ChevronRight, Lock, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

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

// 지하층 판별 함수 (B1~B6 또는 지하1층~지하6층)
const isUndergroundFloor = (floor: string) => {
  const f = floor.trim().toUpperCase();
  return f.startsWith('B') || f.startsWith('지하');
};

// 옥탑층 판별 함수 (옥탑, 옥상, RF 포함)
const isRooftopFloor = (floor: string) => {
  const f = floor.trim().toUpperCase();
  return f.includes('옥탑') || f.includes('옥상') || f.includes('RF');
};

const FireExtinguisherCheck: React.FC = () => {
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
  }, []);

  // 필터 변경 시 페이지 리셋
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

  const handleEdit = (item: FireExtinguisherItem) => {
    setFormItem({ ...item });
    setEditId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setFormItem(initialFormState);
  };

  const handleRegister = async () => {
    if (!formItem.manageNo?.trim()) {
      alert('관리번호는 필수입니다.');
      return;
    }
    setLoading(true);
    const originalList = [...items];
    try {
      let newItems = [...items];
      if (editId) {
        newItems = newItems.map(item => String(item.id) === String(editId) ? { ...formItem } : item);
      } else {
        const itemToAdd = { ...formItem, id: generateUUID() };
        newItems = [itemToAdd, ...newItems];
      }
      setItems(newItems);
      const success = await saveFireExtinguisherList(newItems);
      if (success) {
        setFormItem({ ...initialFormState, floor: formItem.floor });
        setEditId(null);
        alert('저장이 완료되었습니다.');
      } else {
        setItems(originalList);
        alert('저장 실패 (서버 오류)');
      }
    } catch (e: any) {
      setItems(originalList);
      alert('오류가 발생했습니다: ' + String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setLoading(true);
    try {
      const success = await saveFireExtinguisherList(items);
      if (success) {
        alert('저장이 완료되었습니다.');
      } else {
        alert('저장 실패');
      }
    } catch (e: any) {
      alert('오류가 발생했습니다: ' + String(e));
    } finally {
      setLoading(false);
    }
  };

  // 삭제 프로세스 개선: 모달 없이 즉시 삭제 실행
  const handleDeleteItem = async (id: string) => {
    const idStr = String(id);
    setLoading(true);
    try {
      const success = await deleteFireExtinguisher(idStr);
      if (success) {
        setItems(prev => prev.filter(i => String(i.id) !== idStr));
        if (String(editId) === idStr) handleCancelEdit();
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

  // 필터링된 항목 계산
  const filteredItemsSorted = useMemo<FireExtinguisherItem[]>(() => {
    const safeItems = Array.isArray(items) ? items : [];
    
    let filtered = [...safeItems];
    
    if (activeFloor === '지하1~6층') {
      filtered = filtered.filter(item => isUndergroundFloor(item.floor));
    } else if (activeFloor === '옥탑') {
      filtered = filtered.filter(item => isRooftopFloor(item.floor));
    } else if (activeFloor !== '전체') {
      filtered = filtered.filter(item => item.floor === activeFloor);
    }

    return filtered.sort((a: FireExtinguisherItem, b: FireExtinguisherItem) => {
      const scoreDiff = getFloorScore(b.floor) - getFloorScore(a.floor);
      if (scoreDiff !== 0) return scoreDiff;
      return (String(a.manageNo || '')).localeCompare(String(b.manageNo || ''), 'en', { numeric: true });
    });
  }, [items, activeFloor]);

  // 페이지네이션 로직
  const totalPages = Math.ceil(filteredItemsSorted.length / ITEMS_PER_PAGE);
  const paginatedFlatItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItemsSorted.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItemsSorted, currentPage]);

  // 현재 페이지 아이템들을 다시 그룹화하여 렌더링
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
    // Fix: Explicitly using a type guard to ensure uniqueFloors is string[] and resolve 'unknown' errors below.
    const uniqueFloors = Array.from(new Set(items.map(i => i.floor))).filter((f): f is string => !!f && typeof f === 'string' && f.trim() !== '');
    const aboveGround = uniqueFloors
      // Fix: Explicitly typed callback parameter as string to fix 'unknown' assignability error.
      .filter((f: string) => !isUndergroundFloor(f) && !isRooftopFloor(f))
      // Fix: Explicitly typed sort parameters to ensure type consistency.
      .sort((a: string, b: string) => getFloorScore(String(b)) - getFloorScore(String(a)));
    // Fix: Explicitly typed callback parameter as string to fix 'unknown' assignability error.
    const hasUnderground = uniqueFloors.some((f: string) => isUndergroundFloor(f));
    // Fix: Explicitly typed callback parameter as string to fix 'unknown' assignability error.
    const hasRooftop = uniqueFloors.some((f: string) => isRooftopFloor(f));
    const btns = ['전체'];
    if (hasRooftop) btns.push('옥탑');
    // Fix: uniqueFloors typing fix above ensures aboveGround is string[], making this spread operation safe.
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
    for (let i = startPage; i <= endPage; i++) pages.push(i);
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
    const sortedKeys = Object.keys(fullGroups).sort((a: string, b: string) => {
        return getFloorScore(b) - getFloorScore(a);
    });
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

  const updateItemInTable = (id: string, field: keyof FireExtinguisherItem, value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const inputs = document.querySelectorAll('.form-input');
      const index = Array.from(inputs).indexOf(e.target as any);
      if (index > -1 && index < inputs.length - 1) (inputs[index + 1] as HTMLElement).focus();
      else if (index === inputs.length - 1) handleRegister();
    }
  };

  const inputClass = "w-full border border-gray-300 rounded px-2 py-2 !text-[12px] bg-white text-black focus:ring-2 focus:ring-blue-500 outline-none h-[38px] font-normal";
  const tableInputClass = "w-full h-full text-center outline-none bg-transparent text-black p-1 focus:bg-blue-50 !text-[12px] font-normal flex items-center justify-center min-h-[32px]";

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-4 animate-fade-in">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4 print:hidden">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center"><Flame className="mr-2 text-red-600" />소화기 관리대장</h2>
        <div className="flex gap-2">
          {/* 새로고침 버튼 추가 */}
          <button onClick={loadData} disabled={loading} className="flex items-center px-4 py-2 bg-gray-100 text-gray-600 border border-gray-200 rounded hover:bg-gray-200 font-bold shadow-sm transition-colors text-sm disabled:opacity-50">
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />새로고침
          </button>
          <button onClick={handleSaveAll} disabled={loading} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold shadow-sm transition-colors text-sm disabled:opacity-50"><Save size={18} className="mr-2" />서버저장</button>
          <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 font-bold shadow-sm transition-colors text-sm"><Printer size={18} className="mr-2" />미리보기</button>
        </div>
      </div>

      <div className={`p-6 rounded-xl border shadow-sm print:hidden transition-all duration-300 ${editId ? 'bg-orange-50 border-orange-200' : 'bg-blue-50/50 border-blue-200'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-700 flex items-center">
            {editId ? <Edit2 size={18} className="mr-2 text-orange-600" /> : <Plus size={18} className="mr-2 text-blue-600" />}
            {editId ? '소화기 정보 수정' : '신규 소화기 등록'}
          </h3>
          {editId && <button onClick={handleCancelEdit} className="text-sm flex items-center text-gray-500 hover:text-gray-700 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm font-bold"><RotateCcw size={12} className="mr-1" />수정 취소</button>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-3 items-end">
          {/* Added explicit Event type to solve 'unknown' type error in onChange handlers */}
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">관리번호 *</label><input type="text" className={`${inputClass} form-input`} value={formItem.manageNo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormItem({...formItem, manageNo: e.target.value})} onKeyDown={handleKeyDown} placeholder="예: 001" /></div>
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">종류</label><select className={`${inputClass} form-input`} value={formItem.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormItem({...formItem, type: e.target.value})}>{EXTINGUISHER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">층별</label><input type="text" className={`${inputClass} form-input`} value={formItem.floor} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormItem({...formItem, floor: e.target.value})} onKeyDown={handleKeyDown} placeholder="예: 1F" /></div>
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">정비업체</label><input type="text" className={`${inputClass} form-input`} value={formItem.company} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormItem({...formItem, company: e.target.value})} onKeyDown={handleKeyDown} /></div>
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">제조번호</label><input type="text" className={`${inputClass} form-input`} value={formItem.serialNo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormItem({...formItem, serialNo: e.target.value})} onKeyDown={handleKeyDown} /></div>
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">전화번호</label><input type="text" className={`${inputClass} form-input`} value={formItem.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormItem({...formItem, phone: e.target.value})} onKeyDown={handleKeyDown} placeholder="010-..." /></div>
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">검정번호</label><input type="text" className={`${inputClass} form-input`} value={formItem.certNo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormItem({...formItem, certNo: e.target.value})} onKeyDown={handleKeyDown} /></div>
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">일자</label><input type="month" className={`${inputClass} form-input`} value={formItem.date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormItem({...formItem, date: e.target.value})} onKeyDown={handleKeyDown} /></div>
          <div className="col-span-1"><button onClick={handleRegister} disabled={loading} className={`w-full text-white rounded-lg font-bold h-[38px] transition-colors shadow-md text-sm flex items-center justify-center gap-1 ${editId ? 'bg-orange-50 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>{loading ? '...' : (editId ? <><Check size={14} />수정</> : <><Plus size={14} />등록</>)}</button></div>
          <div className="col-span-full"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">비고</label><input type="text" className={`${inputClass} form-input`} value={formItem.remarks} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormItem({...formItem, remarks: e.target.value})} onKeyDown={handleKeyDown} placeholder="특이사항 입력" /></div>
        </div>
      </div>

      <div className="print:hidden flex items-center gap-4 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-500 min-w-max"><Filter size={16} />층별 필터:</div>
        <div className="flex overflow-x-auto whitespace-nowrap gap-2 scrollbar-hide pb-1">
          {filterButtons.map(f => (
            <button 
              key={f} 
              onClick={() => setActiveFloor(f)} 
              className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                activeFloor === f 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm scale-105' 
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-white hover:border-gray-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center min-w-[1000px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-12">No</th>
                <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-32">관리번호</th>
                <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-44">종 류</th>
                <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-32">층 별</th>
                <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-24">정비업체</th>
                <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-24">제조번호</th>
                <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-32">전화번호</th>
                <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-24">검정번호</th>
                <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-24">일 자</th>
                <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-24">비 고</th>
                <th className="p-2 !text-[12px] font-normal text-gray-500 w-24 print:hidden">관리</th>
              </tr>
            </thead>
            <tbody>
              {paginatedFlatItems.length === 0 ? (
                 <tr><td colSpan={11} className="py-20 text-center text-gray-400 italic">표시할 소화기가 없습니다.</td></tr>
              ) : displayGroups.map(group => (
                <React.Fragment key={group.floor}>
                  <tr className="bg-gray-100 font-normal"><td colSpan={11} className="text-left pl-4 py-2 border-b border-gray-300 text-blue-900 !text-[12px]">[ {String(group.floor)} ]</td></tr>
                  {group.items.map((item: FireExtinguisherItem, idx: number) => (
                    <tr key={item.id} className={`hover:bg-gray-50 border-b border-gray-100 last:border-0 group ${String(editId) === String(item.id) ? 'bg-orange-50' : ''}`}>
                      <td className="p-2 !text-[12px] text-gray-400 font-normal">
                        {/* 전체 목록에서의 인덱스 계산 */}
                        {filteredItemsSorted.findIndex(fi => fi.id === item.id) + 1}
                      </td>
                      {/* Added explicit Event type to solve 'unknown' type error in onChange handlers in table rows */}
                      <td className="p-0 border-r border-gray-100"><input type="text" className={`${tableInputClass} font-normal`} value={item.manageNo || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItemInTable(item.id, 'manageNo', e.target.value)} /></td>
                      <td className="p-0 border-r border-gray-100"><div className={tableInputClass}>{item.type || ''}</div></td>
                      <td className="p-0 border-r border-gray-100"><input type="text" className={tableInputClass} value={item.floor || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItemInTable(item.id, 'floor', e.target.value)} /></td>
                      <td className="p-0 border-r border-gray-100"><input type="text" className={tableInputClass} value={item.company || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItemInTable(item.id, 'company', e.target.value)} /></td>
                      <td className="p-0 border-r border-gray-100"><input type="text" className={tableInputClass} value={item.serialNo || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItemInTable(item.id, 'serialNo', e.target.value)} /></td>
                      <td className="p-0 border-r border-gray-100"><input type="text" className={tableInputClass} value={item.phone || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItemInTable(item.id, 'phone', e.target.value)} /></td>
                      <td className="p-0 border-r border-gray-100"><input type="text" className={tableInputClass} value={item.certNo || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItemInTable(item.id, 'certNo', e.target.value)} /></td>
                      <td className="p-0 border-r border-gray-100"><input type="text" className={tableInputClass} value={formatToYYMM(item.date || '')} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItemInTable(item.id, 'date', e.target.value)} /></td>
                      <td className="p-0 border-r border-gray-100"><input type="text" className={`${tableInputClass} text-left px-2 font-normal`} value={item.remarks || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItemInTable(item.id, 'remarks', e.target.value)} /></td>
                      <td className="p-2 text-center print:hidden">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleEdit(item)} className="text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={16} /></button>
                          {/* 삭제 버튼 프로세스 개선 */}
                          <button onClick={() => handleDeleteItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-center gap-2">
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
                      : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200 hover:border-blue-200 hover:text-blue-200'
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
