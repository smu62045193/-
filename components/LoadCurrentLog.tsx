
import React, { useState, useEffect, useMemo } from 'react';
import { LoadCurrentData, LoadCurrentItem } from '../types';
import { fetchLoadCurrent, saveLoadCurrent, getInitialLoadCurrent } from '../services/dataService';
import { format, subMonths, addMonths, parseISO } from 'date-fns';
import { Save, Printer, Plus, Trash2, ChevronLeft, ChevronRight, RefreshCw, CheckCircle, X, Cloud, Filter, LayoutList, Edit2, Lock } from 'lucide-react';

interface LoadCurrentLogProps {
  currentDate: Date;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const LoadCurrentLog: React.FC<LoadCurrentLogProps> = ({ currentDate }) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(format(currentDate, 'yyyy-MM'));
  const [data, setData] = useState<LoadCurrentData>(getInitialLoadCurrent(format(currentDate, 'yyyy-MM')));
  const [activeFloor, setActiveFloor] = useState<string>('전체');

  // 페이지네이션 상태 - 15개씩 보기로 수정
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  useEffect(() => {
    loadData(currentMonth);
  }, [currentMonth]);

  // 층별 필터나 월이 변경되면 페이지를 1로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFloor, currentMonth]);

  const loadData = async (monthKey: string) => {
    setLoading(true);
    setIsEditMode(false);
    try {
      const fetched = await fetchLoadCurrent(monthKey);
      
      if (fetched && fetched.items && fetched.items.length > 0) {
        if (!fetched.date) fetched.date = monthKey;
        if (!fetched.period) {
          const [y, m] = monthKey.split('-');
          fetched.period = `${y}년 ${parseInt(m)}월`;
        }
        setData(fetched);
      } else {
        const prevMonthDate = subMonths(parseISO(`${monthKey}-01`), 1);
        const prevMonthKey = format(prevMonthDate, 'yyyy-MM');
        const prevData = await fetchLoadCurrent(prevMonthKey);

        if (prevData && prevData.items && prevData.items.length > 0) {
          const carriedItems: LoadCurrentItem[] = prevData.items.map(item => ({
            ...item,
            id: generateId()
          }));
          
          const [y, m] = monthKey.split('-');
          setData({
            date: monthKey,
            period: `${y}년 ${parseInt(m)}월`,
            items: carriedItems
          });
        } else {
          setData(getInitialLoadCurrent(monthKey));
        }
      }
    } catch (e) {
      console.error(e);
      setData(getInitialLoadCurrent(monthKey));
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => format(subMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => format(addMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'));
  };

  const handleSave = async () => {
    if (!data) return;
    setSaveStatus('loading');
    try {
      const success = await saveLoadCurrent(data);
      if (success) {
        setSaveStatus('success');
        setIsEditMode(false);
        alert('저장이 완료되었습니다.');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      setSaveStatus('error');
      alert('오류가 발생했습니다.');
    }
  };

  const handlePrint = () => {
    if (!filteredItems.length) return;

    const chunks: LoadCurrentItem[][] = [];
    let start = 0;
    while (start < filteredItems.length) {
      const size = chunks.length === 0 ? 25 : 30;
      chunks.push(filteredItems.slice(start, start + size));
      start += size;
    }

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;

    const [y, m] = currentMonth.split('-');
    const dynamicTitle = `${parseInt(m)}월 부하 전류 점검 기록부`;

    const approvalTable = `
      <table class="approval-table">
        <tr>
          <th rowspan="2" class="side-header">결<br/>재</th>
          <th>대 리</th>
          <th>과 장</th>
          <th>소 장</th>
        </tr>
        <tr><td></td><td></td><td></td></tr>
      </table>
    `;

    let pagesContent = '';
    chunks.forEach((chunk, index) => {
      const isFirstPage = index === 0;
      pagesContent += `
        <div class="print-page ${index < chunks.length - 1 ? 'page-break' : ''}">
          ${isFirstPage ? `
          <div class="header-flex">
            <div class="title-area">
              <div class="doc-title">${dynamicTitle}</div>
            </div>
            ${approvalTable}
          </div>

          <div class="info-row">
            <div>${activeFloor !== '전체' ? `[ ${activeFloor} ] 층 점검 내역` : '전체 층 점검 내역'}</div>
            <div>점검일자 : ${data?.period || data?.date}</div>
          </div>
          ` : ''}

          <table class="main-print-table">
            <thead>
              <tr>
                <th rowspan="2" style="width: 45px;">층</th>
                <th rowspan="2" style="width: 130px;">점검대상</th>
                <th rowspan="2" style="width: 45px;">순서</th>
                <th colSpan="3" style="background: #eff6ff !important;">좌측</th>
                <th colSpan="3" style="background: #fff7ed !important;">우측</th>
              </tr>
              <tr>
                <th style="width: 50px;">용량</th>
                <th style="width: 50px;">측정</th>
                <th>비고</th>
                <th style="width: 50px;">용량</th>
                <th style="width: 50px;">측정</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              ${chunk.map(item => `
                <tr>
                  <td>${item.floor || ''}</td>
                  <td>${item.targetL || ''}</td>
                  <td>${item.orderL || ''}</td>
                  <td>${item.capacityL || ''}</td>
                  <td style="font-weight: bold; color: blue !important;">${item.valueL || ''}</td>
                  <td>${item.noteL || ''}</td>
                  <td>${item.capacityR || ''}</td>
                  <td style="font-weight: bold; color: blue !important;">${item.valueR || ''}</td>
                  <td>${item.noteR || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>${dynamicTitle}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 25mm 12mm 10mm 12mm; }
            html, body { margin: 0 !important; padding: 0 !important; background: #f1f5f9; color: black; font-family: 'Noto Sans KR', sans-serif; line-height: 1.2; -webkit-print-color-adjust: exact; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { .no-print { display: none !important; } body { background: white !important; } .page-break { page-break-after: always; } }
            .print-page { width: 100%; background: white; box-sizing: border-box; }
            @media screen { .print-page { width: 210mm; min-height: 297mm; margin: 20px auto; padding: 25mm 12mm 10mm 12mm; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); } }
            table { border-collapse: collapse !important; width: 100% !important; table-layout: fixed !important; border: 1.5px solid black !important; }
            th, td { border: 1px solid black !important; text-align: center !important; overflow: hidden; height: 30px !important; font-size: 9px !important; padding: 0 2px !important; }
            th { font-weight: bold !important; background: #f3f4f6 !important; }
            .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; min-height: 90px; }
            .title-area { flex: 1; text-align: center; }
            .doc-title { font-size: 26pt; font-weight: 900; text-decoration: underline; text-underline-offset: 8px; margin: 0; line-height: 1; }
            .approval-table { width: 70mm !important; border: 1.5px solid black !important; margin-left: auto; flex-shrink: 0; table-layout: fixed !important; }
            .approval-table th { height: 22px !important; font-size: 9pt !important; background: #f3f4f6 !important; font-weight: bold; border: 1px solid black !important; }
            .approval-table td { height: 65px !important; border: 1px solid black !important; background: white !important; }
            .approval-table .side-header { width: 28px !important; font-size: 9pt; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: bold; font-size: 11pt; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
          ${pagesContent}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const updateItem = (id: string, field: keyof LoadCurrentItem, value: string) => {
    if (!data) return;
    const newItems = data.items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    setData({ ...data, items: newItems });
  };

  const addItem = () => {
    if (!data) return;
    const newItem: LoadCurrentItem = {
      id: generateId(),
      floor: activeFloor !== '전체' ? activeFloor : '',
      targetL: '', orderL: '', capacityL: '', valueL: '', noteL: '',
      orderR: '', capacityR: '', valueR: '', noteR: ''
    };
    setData({ ...data, items: [...(data.items || []), newItem] });
    // 새로 추가된 항목을 보기 위해 마지막 페이지로 이동
    setTimeout(() => {
        const newTotalPages = Math.ceil((data.items.length + 1) / ITEMS_PER_PAGE);
        setCurrentPage(newTotalPages);
    }, 0);
  };

  const deleteItem = async (id: string) => {
    if (!data) return;
    if (confirm('삭제하시겠습니까?')) {
      const newItems = data.items.filter(i => i.id !== id);
      const newData = { ...data, items: newItems };
      setData(newData);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputs = document.querySelectorAll('input:not([disabled]):not([type="hidden"]):not([readonly])');
      const index = Array.from(inputs).indexOf(e.currentTarget as any);
      if (index > -1 && index < inputs.length - 1) {
        (inputs[index + 1] as HTMLElement).focus();
      }
    }
  };

  const getFloorSortScore = (f: string) => {
    const s = f.toUpperCase().trim();
    if (s === '옥상' || s === 'RF' || s.includes('옥탑')) return 1000;
    if (s.startsWith('B') || s.startsWith('지하')) {
      const num = parseInt(s.replace(/[^0-9]/g, ''));
      return -1 * (isNaN(num) ? 99 : num);
    }
    const num = parseInt(s.replace(/[^0-9]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const availableFloors = useMemo(() => {
    const floors = new Set<string>();
    data.items.forEach(item => {
      if (item.floor && item.floor.trim() !== '' && item.floor !== '창고') {
        floors.add(item.floor);
      }
    });
    const sortedFloors = Array.from(floors).sort((a, b) => getFloorSortScore(b) - getFloorSortScore(a));
    return ['전체', ...sortedFloors];
  }, [data.items]);

  const filteredItems = useMemo(() => {
    if (activeFloor === '전체') return data.items;
    return data.items.filter(item => item.floor === activeFloor);
  }, [data.items, activeFloor]);

  // 페이지네이션 로직 적용
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  // 하단에 보일 페이지 번호 5개 계산 로직
  const visiblePageNumbers = useMemo(() => {
    const halfWindow = 2;
    let startPage = Math.max(1, currentPage - halfWindow);
    let endPage = Math.min(totalPages, startPage + 4);
    
    // 만약 마지막 페이지 근처라면 시작 페이지를 앞으로 당김
    if (endPage === totalPages) {
      startPage = Math.max(1, endPage - 4);
    }
    
    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  const [year, month] = currentMonth.split('-');
  
  const thClass = "border border-gray-300 p-2 bg-gray-50 font-bold text-center text-[12px] text-gray-700 h-10 align-middle";
  const tdClass = "border border-gray-300 p-0 h-10 align-middle relative bg-white";
  const inputClass = (editable: boolean) => `w-full h-full text-center outline-none bg-transparent text-black text-[12px] font-normal p-1 transition-all ${editable ? 'focus:bg-blue-50/30' : 'cursor-not-allowed'}`;

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6 animate-fade-in relative bg-white rounded-xl border border-gray-200 shadow-sm print:shadow-none print:border-none print:p-0">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4 print:hidden">
        <div className="flex items-center space-x-4">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft /></button>
          <h2 className="text-2xl font-bold text-gray-800">{year}년 {month}월</h2>
          <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><ChevronRight /></button>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => loadData(currentMonth)} 
            disabled={loading}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all text-sm disabled:opacity-50"
          >
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <button 
            onClick={() => setIsEditMode(!isEditMode)} 
            className={`flex items-center px-4 py-2 rounded-xl font-bold shadow-sm transition-all text-sm ${isEditMode ? 'bg-orange-50 text-white hover:bg-orange-600' : 'bg-gray-700 text-white hover:bg-gray-800'}`}
          >
            {isEditMode ? <Lock size={18} className="mr-2" /> : <Edit2 size={18} className="mr-2" />}
            {isEditMode ? '수정 취소' : '수정'}
          </button>
          <button 
            onClick={handleSave} 
            disabled={saveStatus === 'loading'}
            className={`flex items-center px-4 py-2 rounded-xl font-bold shadow-sm transition-all ${
              saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saveStatus === 'loading' ? (
              <RefreshCw size={18} className="mr-2 animate-spin" />
            ) : saveStatus === 'success' ? (
              <CheckCircle size={18} className="mr-2" />
            ) : (
              <Save size={18} className="mr-2" />
            )}
            {saveStatus === 'success' ? '저장완료' : '서버 저장'}
          </button>
          <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-xl hover:bg-gray-800 font-bold shadow-sm">
            <Printer size={18} className="mr-2" />미리보기
          </button>
        </div>
      </div>

      <div className="print:hidden flex flex-wrap items-center gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-500 min-w-max"><Filter size={16} />층별 필터:</div>
        <div className="flex flex-wrap gap-2">
          {availableFloors.map(f => (
            <button 
              key={f} 
              onClick={() => setActiveFloor(f)} 
              className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${activeFloor === f ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div id="load-current-print-area">
        <div className="text-center mb-6 pb-2 print:hidden border-b border-gray-100 flex flex-col items-center">
          <div className="flex items-center gap-3 mb-2">
            <LayoutList className="text-blue-600" size={28} />
            <h1 className="text-3xl font-black text-gray-800 tracking-tight">부하 전류 점검 기록부</h1>
          </div>
          <div className="flex items-center gap-3 bg-gray-50 px-6 py-3 rounded-2xl border border-gray-100 mt-2 shadow-inner">
            <span className="font-bold text-gray-500">측정 일자 :</span>
            <input 
              type="text" 
              value={data?.period || ''} 
              onChange={e => setData({...data, period: e.target.value})}
              readOnly={!isEditMode}
              className="font-black text-blue-600 bg-transparent outline-none w-64 text-center text-xl"
              placeholder="예: 2026년 1월 12~13일"
            />
          </div>
        </div>

        <div id="load-current-print-area-table" className="border border-gray-300 rounded-xl overflow-hidden shadow-sm bg-white">
          <table className="w-full border-collapse border-hidden table-fixed min-w-[1000px] print:min-w-0">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: '45px' }} className={thClass}>층</th>
                <th rowSpan={2} style={{ width: '130px' }} className={thClass}>점검대상</th>
                <th rowSpan={2} style={{ width: '45px' }} className={thClass}>순서</th>
                <th colSpan={3} className="border border-gray-300 p-2 font-bold bg-blue-50/50 text-blue-700 text-[13px] h-10">좌측</th>
                <th colSpan={3} className="border border-gray-300 p-2 font-bold bg-orange-50/50 text-orange-700 text-[13px] h-10">우측</th>
                <th rowSpan={2} style={{ width: '45px' }} className="border border-gray-300 p-2 bg-gray-50 text-[11px] font-bold text-gray-400 no-print">관리</th>
              </tr>
              <tr>
                <th style={{ width: '25px' }} className={thClass}>용량</th>
                <th style={{ width: '25px' }} className={thClass}>측정</th>
                <th className={thClass}>비고</th>
                <th style={{ width: '25px' }} className={thClass}>용량</th>
                <th style={{ width: '25px' }} className={thClass}>측정</th>
                <th className={thClass}>비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300 border-t border-gray-300">
              {paginatedItems.length === 0 ? (
                <tr><td colSpan={10} className="py-20 text-gray-400 italic text-center">점검 내역이 없습니다.</td></tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.id} className="group hover:bg-gray-50/50 transition-colors divide-x divide-gray-300">
                    <td className={tdClass}><input type="text" className={`${inputClass(isEditMode)} font-normal text-blue-600 ${isEditMode ? 'bg-orange-50/20' : ''}`} value={item.floor || ''} onChange={e => updateItem(item.id, 'floor', e.target.value)} onKeyDown={handleKeyDown} placeholder="층" readOnly={!isEditMode} /></td>
                    <td className={tdClass}><input type="text" className={`${inputClass(isEditMode)} ${isEditMode ? 'bg-orange-50/20' : ''}`} value={item.targetL || ''} onChange={e => updateItem(item.id, 'targetL', e.target.value)} onKeyDown={handleKeyDown} readOnly={!isEditMode} /></td>
                    <td className={tdClass}><input type="text" className={`${inputClass(isEditMode)} ${isEditMode ? 'bg-orange-50/20' : ''}`} value={item.orderL || ''} onChange={e => updateItem(item.id, 'orderL', e.target.value)} onKeyDown={handleKeyDown} readOnly={!isEditMode} /></td>
                    <td className={tdClass}><input type="text" className={`${inputClass(isEditMode)} ${isEditMode ? 'bg-orange-50/20' : ''}`} value={item.capacityL || ''} onChange={e => updateItem(item.id, 'capacityL', e.target.value)} onKeyDown={handleKeyDown} readOnly={!isEditMode} /></td>
                    <td className={tdClass}><input type="text" className={`${inputClass(isEditMode)} font-normal text-blue-700 ${isEditMode ? 'bg-orange-50/20' : ''}`} value={item.valueL || ''} onChange={e => updateItem(item.id, 'valueL', e.target.value)} onKeyDown={handleKeyDown} readOnly={!isEditMode} /></td>
                    <td className={tdClass}><input type="text" className={`${inputClass(isEditMode)} ${isEditMode ? 'bg-orange-50/20' : ''}`} value={item.noteL || ''} onChange={e => updateItem(item.id, 'noteL', e.target.value)} onKeyDown={handleKeyDown} readOnly={!isEditMode} /></td>
                    <td className={tdClass}><input type="text" className={`${inputClass(isEditMode)} ${isEditMode ? 'bg-orange-50/20' : ''}`} value={item.capacityR || ''} onChange={e => updateItem(item.id, 'capacityR', e.target.value)} onKeyDown={handleKeyDown} readOnly={!isEditMode} /></td>
                    <td className={tdClass}><input type="text" className={`${inputClass(isEditMode)} font-normal text-blue-700 ${isEditMode ? 'bg-orange-50/20' : ''}`} value={item.valueR || ''} onChange={e => updateItem(item.id, 'valueR', e.target.value)} onKeyDown={handleKeyDown} readOnly={!isEditMode} /></td>
                    <td className={tdClass}><input type="text" className={`${inputClass(isEditMode)} ${isEditMode ? 'bg-orange-50/20' : ''}`} value={item.noteR || ''} onChange={e => updateItem(item.id, 'noteR', e.target.value)} onKeyDown={handleKeyDown} readOnly={!isEditMode} /></td>
                    <td className="border border-gray-300 p-0 text-center no-print bg-white relative">
                      {isEditMode && (
                        <button onClick={() => deleteItem(item.id)} className="text-gray-300 hover:text-red-500 p-1 w-full h-full flex items-center justify-center transition-colors">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 UI - 번호 5개만 노출되도록 수정 */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2 py-4 no-print border-t border-gray-100">
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
                      : 'bg-white text-gray-400 border border-gray-100 hover:border-blue-200 hover:text-blue-500'
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

        {isEditMode && (
          <div className="mt-4 print:hidden px-1">
            <button 
              onClick={addItem}
              className="w-full py-3.5 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 flex items-center justify-center font-black transition-all group shadow-inner"
            >
              <Plus size={20} className="mr-2 group-hover:scale-125 transition-transform" />
              새 측정 항목 추가
            </button>
          </div>
        )}
      </div>

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

export default LoadCurrentLog;
