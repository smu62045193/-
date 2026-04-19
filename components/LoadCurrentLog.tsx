
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  const [currentMonth, setCurrentMonth] = useState(format(currentDate, 'yyyy-MM'));
  const [data, setData] = useState<LoadCurrentData>(getInitialLoadCurrent(format(currentDate, 'yyyy-MM')));
  const [activeFloor, setActiveFloor] = useState<string>('전체');
  const [isEditingPeriod, setIsEditingPeriod] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // 페이지네이션 상태 - 15개씩 보기로 수정
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    loadData(currentMonth);
  }, [currentMonth]);

  // 층별 필터나 월이 변경되면 페이지를 1로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFloor, currentMonth]);

  // Removed popup submit handlers as per user request to use inline editing

  const loadData = async (monthKey: string) => {
    setLoading(true);
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
        window.alert('저장이 완료되었습니다.');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        window.alert('저장에 실패했습니다.');
      }
    } catch (error) {
      setSaveStatus('error');
      window.alert('오류가 발생했습니다.');
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
            <div>점검일자 : ${data?.period || data?.date}</div>
          </div>
          ` : ''}

          <table class="main-print-table">
            <thead>
              <tr>
                <th rowspan="2" style="width: 45px;">층</th>
                <th rowspan="2" style="width: 130px;">점검대상</th>
                <th rowspan="2" style="width: 45px;">순서</th>
                <th colSpan="3" style="background: white !important;">좌측</th>
                <th colSpan="3" style="background: white !important;">우측</th>
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
                  <td style="font-weight: normal; color: black !important;">${item.valueL || ''}</td>
                  <td>${item.noteL || ''}</td>
                  <td>${item.capacityR || ''}</td>
                  <td style="font-weight: normal; color: black !important;">${item.valueR || ''}</td>
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
            html, body { margin: 0 !important; padding: 0 !important; padding-right: 0.5mm !important; background: black; color: black; font-family: 'Noto Sans KR', sans-serif; line-height: 1.2; -webkit-print-color-adjust: exact; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { .no-print { display: none !important; } html, body { background: white !important; } .page-break { page-break-after: always; } }
            .print-page { width: 100%; background: white; box-sizing: border-box; }
            @media screen { .print-page { width: 210mm; min-height: 297mm; margin: 20px auto; padding: 25mm 12mm 10mm 12mm; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); background: white; } body { background: black !important; } }
            table { border-collapse: collapse !important; width: 100% !important; table-layout: fixed !important; border: 1px solid black !important; box-sizing: border-box; }
            th, td { border: 1px solid black !important; text-align: center !important; height: 30px !important; font-size: 10px !important; padding: 0 2px !important; word-break: break-all; }
            th { font-weight: normal !important; background: white !important; }
            .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; min-height: 90px; }
            .title-area { flex: 1; text-align: center; }
            .doc-title { font-size: 26pt; font-weight: 900; text-decoration: underline; text-underline-offset: 8px; margin: 0; line-height: 1; }
            .approval-table { width: 70mm !important; border: 1px solid black !important; margin-left: auto; flex-shrink: 0; table-layout: fixed !important; }
            .approval-table th { height: 22px !important; font-size: 9pt !important; background: white !important; font-weight: normal; border: 1px solid black !important; }
            .approval-table td { height: 65px !important; border: 1px solid black !important; background: white !important; }
            .approval-table .side-header { width: 28px !important; font-size: 9pt; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: normal; font-size: 11pt; }
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

  const deleteItem = (id: string) => {
    if (!data) return;
    if (window.confirm('삭제하시겠습니까?')) {
      const newItems = data.items.filter(i => String(i.id) !== String(id));
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
    const items = [...data.items];
    
    // 수정 모드가 아닐 때만 정렬 수행 (수정 중에는 행이 갑자기 이동하면 불편하므로)
    if (!isEditing) {
      items.sort((a, b) => {
        // 1. 층별 정렬
        const floorA = getFloorSortScore(a.floor || '');
        const floorB = getFloorSortScore(b.floor || '');
        if (floorA !== floorB) return floorB - floorA; // 높은 층부터 (RF -> 7F -> B1)

        // 2. 점검대상 정렬 (사용자 지정 순서: 일반 -> 특수 -> 일반 업체 -> 특수 업체)
        const getTargetWeight = (t: string) => {
          if (t.includes('일반 업체')) return 3;
          if (t.includes('특수 업체')) return 4;
          if (t.includes('일반')) return 1;
          if (t.includes('특수')) return 2;
          return 10;
        };

        const targetA = (a.targetL || '').trim();
        const targetB = (b.targetL || '').trim();
        const weightA = getTargetWeight(targetA);
        const weightB = getTargetWeight(targetB);

        if (weightA !== weightB) return weightA - weightB;
        if (targetA !== targetB) return targetA.localeCompare(targetB, 'ko', { numeric: true });

        // 3. 순서 정렬
        const orderA = parseInt((a.orderL || '0').replace(/[^0-9]/g, '')) || 0;
        const orderB = parseInt((b.orderL || '0').replace(/[^0-9]/g, '')) || 0;
        return orderA - orderB;
      });
    }

    if (activeFloor === '전체') return items;
    return items.filter(item => item.floor === activeFloor);
  }, [data.items, activeFloor, isEditing]);

  // 페이지네이션 로직 적용
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    if (activeFloor !== '전체') return filteredItems;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage, activeFloor]);

  // 하단에 보일 페이지 번호 5개 계산 로직
  const visiblePageNumbers = useMemo(() => {
    const halfWindow = 2;
    let startPage = Math.max(1, currentPage - halfWindow);
    const endPage = Math.min(totalPages, startPage + 4);
    
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
  
  const thClass = "border-b border-r border-black p-0 bg-white font-normal text-center text-[13px] text-black whitespace-nowrap h-[40px]";
  const tdClass = "border-b border-r border-black p-0 text-[13px] text-black text-center font-normal bg-white h-[40px]";

  return (
    <div className="max-w-7xl mx-auto space-y-2 pb-10 animate-fade-in relative">
      {/* 층 필터 박스 (밑줄형 탭으로 수정) */}
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
        <div className="flex shrink-0">
          {availableFloors.map(f => (
            <div 
              key={f} 
              onClick={() => setActiveFloor(f)} 
              className={`px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer bg-white ${
                activeFloor === f 
                  ? 'text-orange-600' 
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              {f}
              {activeFloor === f && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 상단 컨트롤 박스 (밑줄형 탭 스타일로 수정) */}
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide whitespace-nowrap border-b border-black mb-2">
        {/* 1. 날짜 선택 */}
        <div className="flex items-center shrink-0">
          <button onClick={handlePrevMonth} className="px-2 py-3 transition-colors text-gray-500 hover:text-black"><ChevronLeft size={20} /></button>
          <div className="text-[14px] font-bold text-black min-w-[100px] text-center">{year}년 {month}월</div>
          <button onClick={handleNextMonth} className="px-2 py-3 transition-colors text-gray-500 hover:text-black"><ChevronRight size={20} /></button>
        </div>

        {/* 구분선 (검정색 1px) */}
        <div className="px-2 flex items-center">
          <div className="w-px h-6 bg-black"></div>
        </div>

        {/* 2. 액션 버튼들 */}
        <div className="flex items-center shrink-0">
          <button 
            onClick={() => loadData(currentMonth)} 
            disabled={loading}
            className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          
          <button 
            onClick={() => setIsEditing(!isEditing)} 
            className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap ${
              isEditing ? 'text-orange-600' : 'text-gray-500 hover:text-black'
            }`}
          >
            {isEditing ? <Lock size={18} className="mr-1.5" /> : <Edit2 size={18} className="mr-1.5" />}
            {isEditing ? '수정완료' : '수정'}
            {isEditing && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
            )}
          </button>

          <button 
            onClick={handleSave} 
            disabled={saveStatus === 'loading'}
            className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50 ${
              saveStatus === 'success' ? 'text-orange-600' : 'text-gray-500 hover:text-black'
            }`}
          >
            {saveStatus === 'loading' ? <RefreshCw size={18} className="mr-1.5 animate-spin" /> : saveStatus === 'success' ? <CheckCircle size={18} className="mr-1.5" /> : <Save size={18} className="mr-1.5" />}
            {saveStatus === 'success' ? '저장완료' : '저장'}
          </button>
          
          <button 
            onClick={handlePrint} 
            className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
          >
            <Printer size={18} className="mr-1.5" />
            인쇄
          </button>
        </div>

        {/* 구분선 (검정색 1px) */}
        <div className="px-2 flex items-center">
          <div className="w-px h-6 bg-black"></div>
        </div>

        {/* 3. 점검일자 */}
        <div className="flex items-center shrink-0">
          <div className="flex items-center font-bold text-[14px] text-black px-4 py-3 h-full">
            <span className="whitespace-nowrap">점검일자 :</span>
            {isEditingPeriod ? (
              <input 
                type="text" 
                value={data?.period || ''} 
                autoFocus
                onBlur={() => setIsEditingPeriod(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingPeriod(false);
                }}
                onChange={e => setData({...data, period: e.target.value})}
                className="border border-gray-300 bg-orange-50 px-2 py-0.5 rounded outline-none font-bold text-black ml-2 w-32 text-center"
                placeholder="점검일자 입력"
              />
            ) : (
              <div className="flex items-center gap-1 cursor-pointer ml-2" onClick={() => setIsEditingPeriod(true)}>
                <span className="text-black">
                  {data?.period || '입력'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <div id="load-current-print-area-table" className="bg-white border border-black overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[1000px] print:min-w-0 border-collapse">
            <thead>
              <tr className="bg-white h-[40px]">
                <th rowSpan={2} style={{ width: '100px' }} className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">층</div></th>
                <th rowSpan={2} style={{ width: '160px' }} className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">점검대상</div></th>
                <th rowSpan={2} style={{ width: '80px' }} className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">순서</div></th>
                <th colSpan={3} className={`${thClass} text-black`}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">좌측</div></th>
                <th colSpan={3} className={`${thClass} text-black print:border-r-0`}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">우측</div></th>
                <th rowSpan={2} style={{ width: '80px' }} className={`${thClass} text-black no-print border-r-0`}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">관리</div></th>
              </tr>
              <tr className="bg-white h-[40px]">
                <th style={{ width: '60px' }} className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">용량</div></th>
                <th style={{ width: '60px' }} className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">측정</div></th>
                <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">비고</div></th>
                <th style={{ width: '60px' }} className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">용량</div></th>
                <th style={{ width: '60px' }} className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">측정</div></th>
                <th className={`${thClass} print:border-r-0`}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">비고</div></th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {paginatedItems.length === 0 ? (
                <tr className="h-[40px]">
                  <td colSpan={10} className={`${tdClass} py-20 text-gray-400 italic border-b-0 border-r-0`}>
                    <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">점검 내역이 없습니다.</div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, index) => {
                  const isLastRow = index === paginatedItems.length - 1;
                  const rowTdClass = `${tdClass} ${isLastRow ? 'border-b-0' : ''}`;
                  return (
                    <tr key={item.id} className="text-center h-[40px]">
                      <td className={rowTdClass}>
                        <div className="flex items-center h-full">
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={item.floor || ''} 
                              onChange={(e) => updateItem(item.id, 'floor', e.target.value)}
                              className="bg-transparent border-none outline-none shadow-none appearance-none w-full h-full text-center text-[13px] font-normal px-2"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full px-2 text-[13px] font-normal text-black">{item.floor || ''}</div>
                          )}
                        </div>
                      </td>
                      <td className={rowTdClass}>
                        <div className="flex items-center h-full">
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={item.targetL || ''} 
                              onChange={(e) => updateItem(item.id, 'targetL', e.target.value)}
                              className="bg-transparent border-none outline-none shadow-none appearance-none w-full h-full text-center text-[13px] font-normal px-2"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full px-2 text-[13px] font-normal text-black">{item.targetL || ''}</div>
                          )}
                        </div>
                      </td>
                      <td className={rowTdClass}>
                        <div className="flex items-center h-full">
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={item.orderL || ''} 
                              onChange={(e) => updateItem(item.id, 'orderL', e.target.value)}
                              className="bg-transparent border-none outline-none shadow-none appearance-none w-full h-full text-center text-[13px] font-normal px-2"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full px-2 text-[13px] font-normal text-black">{item.orderL || ''}</div>
                          )}
                        </div>
                      </td>
                      <td className={rowTdClass}>
                        <div className="flex items-center h-full">
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={item.capacityL || ''} 
                              onChange={(e) => updateItem(item.id, 'capacityL', e.target.value)}
                              className="bg-transparent border-none outline-none shadow-none appearance-none w-full h-full text-center text-[13px] font-normal px-2"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full px-2 text-[13px] font-normal text-black">{item.capacityL || ''}</div>
                          )}
                        </div>
                      </td>
                      <td className={rowTdClass}>
                        <div className="flex items-center h-full">
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={item.valueL || ''} 
                              onChange={(e) => updateItem(item.id, 'valueL', e.target.value)}
                              className="bg-transparent border-none outline-none shadow-none appearance-none w-full h-full text-center text-[13px] font-normal px-2 text-black"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full px-2 text-[13px] font-normal text-black">{item.valueL || ''}</div>
                          )}
                        </div>
                      </td>
                      <td className={rowTdClass}>
                        <div className="flex items-center h-full">
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={item.noteL || ''} 
                              onChange={(e) => updateItem(item.id, 'noteL', e.target.value)}
                              className="bg-transparent border-none outline-none shadow-none appearance-none w-full h-full text-center text-[13px] font-normal px-2"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full px-2 text-[13px] font-normal text-black">{item.noteL || ''}</div>
                          )}
                        </div>
                      </td>
                      <td className={rowTdClass}>
                        <div className="flex items-center h-full">
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={item.capacityR || ''} 
                              onChange={(e) => updateItem(item.id, 'capacityR', e.target.value)}
                              className="bg-transparent border-none outline-none shadow-none appearance-none w-full h-full text-center text-[13px] font-normal px-2"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full px-2 text-[13px] font-normal text-black">{item.capacityR || ''}</div>
                          )}
                        </div>
                      </td>
                      <td className={rowTdClass}>
                        <div className="flex items-center h-full">
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={item.valueR || ''} 
                              onChange={(e) => updateItem(item.id, 'valueR', e.target.value)}
                              className="bg-transparent border-none outline-none shadow-none appearance-none w-full h-full text-center text-[13px] font-normal px-2 text-black"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full px-2 text-[13px] font-normal text-black">{item.valueR || ''}</div>
                          )}
                        </div>
                      </td>
                      <td className={`${rowTdClass} print:border-r-0`}>
                        <div className="flex items-center h-full">
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={item.noteR || ''} 
                              onChange={(e) => updateItem(item.id, 'noteR', e.target.value)}
                              className="bg-transparent border-none outline-none shadow-none appearance-none w-full h-full text-center text-[13px] font-normal px-2"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full px-2 text-[13px] font-normal text-black">{item.noteR || ''}</div>
                          )}
                        </div>
                      </td>
                      <td className={`${rowTdClass} no-print border-r-0`}>
                        <div className="flex items-center justify-center h-full gap-1">
                          <button 
                            onClick={() => deleteItem(item.id)} 
                            className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white p-2 rounded-lg transition-all"
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </button>
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
        {isEditing && (
          <div className="mt-4 flex justify-center no-print">
            <button
              onClick={() => {
                const newItem: LoadCurrentItem = {
                  id: generateId(),
                  floor: activeFloor !== '전체' ? activeFloor : '',
                  targetL: '',
                  orderL: '',
                  capacityL: '',
                  valueL: '',
                  noteL: '',
                  orderR: '',
                  capacityR: '',
                  valueR: '',
                  noteR: ''
                };
                setData({ ...data, items: [...data.items, newItem] });
              }}
              className="flex items-center justify-center px-6 py-2 bg-white text-gray-600 border border-gray-300 rounded-xl font-bold shadow-sm hover:bg-gray-50 transition-all active:scale-95"
            >
              <Plus size={18} className="mr-2" />
              행 추가
            </button>
          </div>
        )}
      </div>

      {/* Modal removed as it's now a popup window */}

        {/* 페이지네이션 UI - 미니멀 텍스트 스타일로 정밀 수정 */}
        {activeFloor === '전체' && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6 no-print">
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
