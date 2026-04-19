
import React, { useState, useEffect } from 'react';
import { BatteryCheckData, BatteryItem } from '../types';
import { fetchBatteryCheck, saveBatteryCheck, getInitialBatteryCheck } from '../services/dataService';
import { format, subMonths, addMonths, parseISO } from 'date-fns';
import { Save, Printer, ChevronLeft, ChevronRight, RefreshCw, CheckCircle, X, Cloud, Edit2, Lock, CheckCircle2 } from 'lucide-react';

interface BatteryCheckLogProps {
  currentDate: Date;
}

const BatteryCheckLog: React.FC<BatteryCheckLogProps> = ({ currentDate }) => {
  const [currentMonth, setCurrentMonth] = useState(format(currentDate, 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('rectifier');
  const [data, setData] = useState<BatteryCheckData>(getInitialBatteryCheck(format(currentDate, 'yyyy-MM')));

  const SUB_TABS = [
    { id: 'rectifier', label: '정류기반' },
    { id: 'battery', label: '개별전류' },
    { id: 'generator', label: '발전기' },
    { id: 'remarks', label: '특이사항' },
  ];

  useEffect(() => {
    const newMonth = format(currentDate, 'yyyy-MM');
    if (newMonth !== currentMonth) {
      setCurrentMonth(newMonth);
      setIsEditMode(false);
    } else {
      // 서버에서 로드된 데이터가 없고 전압/비고 등 입력값이 없는 초기 상태인 경우에만 날짜 동기화
      const hasNoData = data.items.every(it => !it.voltage && !it.remarks);
      if (hasNoData && !data.lastUpdated) {
        setData(prev => ({ ...prev, checkDate: format(currentDate, 'yyyy-MM-dd') }));
      }
    }
  }, [currentDate]);

  useEffect(() => {
    loadData(currentMonth);
  }, [currentMonth]);

  const loadData = async (monthStr: string) => {
    setLoading(true);
    setIsEditMode(false);
    try {
      const fetched = await fetchBatteryCheck(monthStr);
      const initial = getInitialBatteryCheck(monthStr);
      
      if (fetched) {
        // Fix corrupted section data for bat-gen-2 (label '11')
        const fixedItems = fetched.items.map(item => {
          if (item.id === 'bat-gen-2' || item.label === '11') {
            return { ...item, section: 'generator' as const };
          }
          return item;
        });
        setData({ ...fetched, items: fixedItems });
      } else {
        // 데이터가 없는 경우 전월 데이터 찾기
        const prevMonthDate = subMonths(parseISO(`${monthStr}-01`), 1);
        const prevMonthStr = format(prevMonthDate, 'yyyy-MM');
        const prevFetched = await fetchBatteryCheck(prevMonthStr);

        if (prevFetched && prevFetched.items) {
          // 전월의 항목 중 구분(label), 제조사(manufacturer), 년월일(manufDate), 규격(spec)만 현재로 복사
          const carriedItems = initial.items.map(initItem => {
            const prevItem = prevFetched.items.find(pi => pi.label === initItem.label);
            return prevItem ? {
              ...initItem,
              manufacturer: prevItem.manufacturer || '',
              manufDate: prevItem.manufDate || '',
              spec: prevItem.spec || ''
            } : initItem;
          });
          
          setData({ 
            ...initial, 
            checkDate: format(currentDate, 'yyyy-MM-dd'),
            items: carriedItems,
            note: prevFetched.note || ''
          });
        } else {
          initial.checkDate = format(currentDate, 'yyyy-MM-dd');
          setData(initial);
        }
      }
    } catch (e) {
      console.error(e);
      const initial = getInitialBatteryCheck(monthStr);
      initial.checkDate = format(currentDate, 'yyyy-MM-dd');
      setData(initial);
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

  const handleLoadPreviousData = async () => {
    if (!window.confirm('전월 데이터를 불러오시겠습니까? 현재 입력된 내용(전압, 비고 제외)이 덮어씌워집니다.')) return;
    
    setLoading(true);
    try {
      const prevMonthDate = subMonths(parseISO(`${currentMonth}-01`), 1);
      const prevMonthStr = format(prevMonthDate, 'yyyy-MM');
      const prevFetched = await fetchBatteryCheck(prevMonthStr);

      if (prevFetched && prevFetched.items) {
        const carriedItems = data.items.map(currentItem => {
          const prevItem = prevFetched.items.find(pi => pi.label === currentItem.label);
          return prevItem ? {
            ...currentItem,
            manufacturer: prevItem.manufacturer || '',
            manufDate: prevItem.manufDate || '',
            spec: prevItem.spec || ''
          } : currentItem;
        });
        
        setData({ ...data, items: carriedItems });
        alert('전월 데이터를 성공적으로 불러왔습니다.');
      } else {
        alert('전월 데이터가 없습니다.');
      }
    } catch (e) {
      console.error(e);
      alert('전월 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data) return;
    setSaveStatus('loading');
    
    try {
      const success = await saveBatteryCheck(data);
      if (success) {
        setSaveStatus('success');
        setIsEditMode(false);
        alert('저장이 완료되었습니다.');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장 실패');
      }
    } catch (error) {
      setSaveStatus('error');
      alert('오류가 발생했습니다.');
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('battery-check-print-area');
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;

    const [y, m] = currentMonth.split('-');
    const titleLine1 = `${parseInt(m)}월 정류기반/비상발전기`;
    const titleLine2 = `밧데리 점검`;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>${titleLine1} ${titleLine2}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { font-family: sans-serif; padding: 0; margin: 0; background: black !important; color: black; line-height: 1.2; -webkit-print-color-adjust: exact; }
            table { table-layout: fixed !important; width: 100% !important; border-collapse: collapse !important; border: 1px solid black !important; margin-bottom: 10px !important; }
            tr { height: 30px !important; }
            th, td { border: 1px solid black !important; height: 30px !important; font-size: 11px !important; text-align: center; padding: 0 !important; line-height: 1 !important; vertical-align: middle !important; }
            
            /* Column Widths */
            th:nth-child(1), td:nth-child(1) { width: 65px !important; }
            th:nth-child(2), td:nth-child(2) { width: 145px !important; }
            th:nth-child(3), td:nth-child(3) { width: 90px !important; }
            
            /* Alignment for Spec Column */
            td:nth-child(4) input { text-align: center !important; }
            
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; } }
            .print-page { width: 210mm; min-height: 297mm; margin: 20px auto; padding: 25mm 10mm 10mm 10mm; background: white !important; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
            
            /* Preview Window Visibility Fix */
            .print-page .print\\:hidden { display: none !important; }
            .print-page .hidden.print\\:block { display: block !important; }
            
            .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; min-height: 100px; }
            .title-area { flex: 1; text-align: center; }
            .doc-title { font-size: 25pt; font-weight: 900; line-height: 1.1; }
            .approval-table { width: 90mm !important; border: 1px solid black !important; margin-left: auto; table-layout: fixed !important; border-collapse: collapse !important; }
            .approval-table tr { height: auto !important; }
            .approval-table th { height: 24px !important; font-size: 9pt !important; background: white !important; font-weight: normal; text-align: center; padding: 0 !important; }
            .approval-table th:not(.side-header) { width: 25% !important; }
            .approval-table td { height: 70px !important; border: 1px solid black !important; padding: 0 !important; }
            .approval-table .side-header { width: 28px !important; }
            .print-page div { min-width: auto !important; }
            .print-page div.border-black:not(.remarks-print-box) { border: none !important; }
            .rounded-xl { border-radius: 0 !important; }
            .print\\:rounded-xl { border-radius: 0 !important; }
            .print\\:border { border: 1px solid black !important; }
            .print\\:border-none { border: none !important; }
            .print\\:rounded-none { border-radius: 0 !important; }
            .print\\:shadow-none { box-shadow: none !important; }
            .hidden-in-ui { display: block !important; margin-bottom: 8px !important; font-size: 13px !important; }
            .print\\:p-6 { padding: 0 !important; }
            .print\\:p-0 { padding: 0 !important; }
            .print\\:shadow-sm { box-shadow: none !important; }
            .remarks-print-box { width: 100% !important; border: 1px solid black !important; height: 100px !important; line-height: 1.5 !important; font-size: 11px !important; display: block !important; padding: 12px !important; margin-top: 0 !important; box-sizing: border-box !important; visibility: visible !important; white-space: pre-wrap !important; }
            input { border: none !important; width: 100%; height: 100%; text-align: center !important; outline: none; background: transparent !important; font-size: 11px !important; padding: 0 !important; margin: 0 !important; color: black !important; }
            td:nth-child(4) input { text-align: center !important; padding: 0 !important; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
          <div class="print-page">
            <div class="header-flex">
              <div class="title-area">
                <div class="doc-title">${titleLine1}<br/>${titleLine2}</div>
              </div>
              <table class="approval-table">
                <tr><th rowspan="2" class="side-header">결<br/><br/>재</th><th>주 임</th><th>대 리</th><th>과 장</th><th>소 장</th></tr>
                <tr><td></td><td></td><td></td><td></td></tr>
              </table>
            </div>
            ${printContent.innerHTML}
          </div>
          <script>window.onload = function() { const inputs = document.querySelectorAll('input'); inputs.forEach(i => i.setAttribute('value', i.value)); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const updateItem = (id: string, field: keyof BatteryItem, value: string) => {
    if (!data) return;
    const newItems = data.items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    setData({ ...data, items: newItems });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputs = Array.from(document.querySelectorAll('input:not([disabled]):not([type="hidden"]):not([readonly])'));
      const index = inputs.indexOf(e.currentTarget as HTMLElement);
      if (index > -1 && index < inputs.length - 1) {
        (inputs[index + 1] as HTMLElement).focus();
      }
    }
  };

  const [year, month] = currentMonth.split('-');
  
  const recItems = data?.items?.filter(i => i.section === 'rectifier') || [];
  const batItems = data?.items?.filter(i => i.section === 'battery') || [];
  const genItems = data?.items?.filter(i => i.section === 'generator') || [];

  const renderTableSection = (title: string, items: BatteryItem[], sectionIndex: number) => (
    <div className="mb-2 max-w-7xl mx-auto">
      <h3 className="text-lg font-bold mb-3 text-black border-l-4 border-black pl-2 hidden-in-ui">{sectionIndex}. {title}</h3>
      <div className="bg-white print:border-none print:rounded-none print:shadow-none">
        <table className="w-full border-collapse text-center table-fixed border border-black">
          <thead>
            <tr className="bg-white border-b border-black h-[40px]">
              <th className="w-20 border-r border-black p-0">
                <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal text-black">구분</div>
              </th>
              <th className="w-[160px] border-r border-black p-0">
                <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal text-black">제조업체</div>
              </th>
              <th className="w-[100px] border-r border-black p-0">
                <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal text-black">제조년월일</div>
              </th>
              <th className="border-r border-black p-0">
                <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal text-black">규격/차단기</div>
              </th>
              <th className="w-24 border-r border-black p-0">
                <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal text-black">전압</div>
              </th>
              <th className="w-24 p-0">
                <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal text-black">비고</div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {items.map((item) => (
              <tr key={item.id} className="bg-white border-b border-black h-[40px] last:border-b-0">
                <td className="border-r border-black p-0">
                  <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal text-black">{item.label}</div>
                </td>
                <td className="border-r border-black p-0">
                  <div className="flex items-center h-full">
                    <input 
                      type="text" 
                      className={`bg-transparent border-none outline-none shadow-none appearance-none w-full h-full text-center text-[13px] font-normal px-2 ${isEditMode ? 'bg-orange-50/30' : ''}`}
                      value={item.manufacturer || ''} 
                      onChange={e => updateItem(item.id, 'manufacturer', e.target.value)} 
                      onKeyDown={handleKeyDown}
                      readOnly={!isEditMode} 
                    />
                  </div>
                </td>
                <td className="border-r border-black p-0">
                  <div className="flex items-center h-full">
                    <input 
                      type="text" 
                      className={`bg-transparent border-none outline-none shadow-none appearance-none w-full h-full text-center text-[13px] font-normal px-2 ${isEditMode ? 'bg-orange-50/30' : ''}`}
                      value={item.manufDate || ''} 
                      onChange={e => updateItem(item.id, 'manufDate', e.target.value)} 
                      onKeyDown={handleKeyDown}
                      readOnly={!isEditMode} 
                    />
                  </div>
                </td>
                <td className="border-r border-black p-0">
                  <div className="flex items-center h-full">
                    <input 
                      type="text" 
                      className={`bg-transparent border-none outline-none shadow-none appearance-none w-full h-full text-left text-[13px] font-normal px-2 ${isEditMode ? 'bg-orange-50/30' : ''}`}
                      value={item.spec || ''} 
                      onChange={e => updateItem(item.id, 'spec', e.target.value)} 
                      onKeyDown={handleKeyDown}
                      readOnly={!isEditMode} 
                    />
                  </div>
                </td>
                <td className="border-r border-black p-0">
                  <div className="flex items-center h-full">
                    <input 
                      type="text" 
                      className={`bg-transparent border-none outline-none shadow-none appearance-none w-full h-full text-center text-[13px] font-normal px-2 text-blue-700 ${isEditMode ? 'bg-orange-50/30' : ''}`}
                      value={item.voltage || ''} 
                      onChange={e => updateItem(item.id, 'voltage', e.target.value)} 
                      onKeyDown={handleKeyDown} 
                      readOnly={!isEditMode} 
                    />
                  </div>
                </td>
                <td className="p-0">
                  <div className="flex items-center h-full">
                    <input 
                      type="text" 
                      className={`bg-transparent border-none outline-none shadow-none appearance-none w-full h-full text-center text-[13px] font-normal px-2 ${isEditMode ? 'bg-orange-50/30' : ''}`}
                      value={item.remarks || ''} 
                      onChange={e => updateItem(item.id, 'remarks', e.target.value)} 
                      onKeyDown={handleKeyDown} 
                      readOnly={!isEditMode}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-2 pb-10 animate-fade-in">
      {/* 통합 컨트롤 및 탭 바 (밑줄형 탭 구성) */}
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide whitespace-nowrap border-b border-black mb-2">
        {/* 1. 날짜 선택 (월 네비게이션) */}
        <div className="flex items-center shrink-0">
          <button 
            onClick={handlePrevMonth} 
            className="px-2 py-3 text-gray-500 hover:text-black transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="px-2 py-3 text-[14px] font-bold text-black min-w-[100px] text-center">
            {year}년 {month}월
          </div>
          <button 
            onClick={handleNextMonth} 
            className="px-2 py-3 text-gray-500 hover:text-black transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 구분선 (검정색 1px) */}
        <div className="flex items-center shrink-0 px-2">
          <div className="w-[1px] h-6 bg-black"></div>
        </div>

        {/* 2. 서브탭 메뉴 (정류기반 개별전류 발전기 특이사항) */}
        <div className="flex items-stretch shrink-0">
          {SUB_TABS.map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`relative px-4 py-3 text-[14px] font-bold transition-all shrink-0 cursor-pointer flex items-center h-full bg-white ${
                activeSubTab === tab.id ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              {tab.label}
              {activeSubTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
              )}
            </div>
          ))}
        </div>

        {/* 구분선 (검정색 1px) */}
        <div className="flex items-center shrink-0 px-2">
          <div className="w-[1px] h-6 bg-black"></div>
        </div>

        {/* 3. 액션 버튼들 (새로고침 수정 저장 인쇄) */}
        <div className="flex items-center shrink-0">
          {isEditMode && (
            <button 
              onClick={handleLoadPreviousData} 
              disabled={loading} 
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
            >
              <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              전월 데이터
            </button>
          )}
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
            onClick={() => setIsEditMode(!isEditMode)} 
            className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap ${
              isEditMode ? 'text-orange-600' : 'text-gray-500 hover:text-black'
            }`}
          >
            {isEditMode ? <CheckCircle2 size={18} className="mr-1.5" /> : <Edit2 size={18} className="mr-1.5" />}
            {isEditMode ? '수정완료' : '수정'}
            {isEditMode && <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />}
          </button>

          <button 
            onClick={handleSave} 
            disabled={saveStatus === 'loading'} 
            className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50 ${
              saveStatus === 'success' ? 'text-orange-600' : 'text-gray-500 hover:text-black'
            }`}
          >
            {saveStatus === 'loading' ? <RefreshCw size={18} className="mr-1.5 animate-spin" /> : saveStatus === 'success' ? <CheckCircle2 size={18} className="mr-1.5" /> : <Save size={18} className="mr-1.5" />}
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

        {/* 4. 점검일자 */}
        <>
          {/* 구분선 (검정색 1.5px) */}
          <div className="flex items-center shrink-0 px-2">
            <div className="w-[1px] h-6 bg-black"></div>
          </div>
          <div className="flex items-center px-4 py-3 text-[14px] font-bold text-gray-700 shrink-0">
            <span className="mr-2 whitespace-nowrap">점검일자 :</span>
            {isEditMode ? (
              <input 
                type="date" 
                value={data.checkDate || format(currentDate, 'yyyy-MM-dd')} 
                onChange={e => setData({...data, checkDate: e.target.value})}
                className="border-b-2 border-blue-500 bg-blue-50/30 outline-none text-sm font-bold text-black py-0.5 px-2 transition-all rounded-none w-32 text-center"
              />
            ) : (
              <span className="text-black whitespace-nowrap">{data.checkDate ? format(parseISO(data.checkDate), 'yyyy년 MM월 dd일') : format(currentDate, 'yyyy년 MM월 dd일')}</span>
            )}
          </div>
        </>
      </div>

      {/* 하단 데이터 박스 */}
      <div id="battery-check-print-area" className="bg-white border-none print:border border-black print:rounded-xl p-0 print:p-6 shadow-none print:shadow-sm overflow-x-auto">
        <div className="min-w-[1000px]">
          <div className="hidden print:block text-right font-normal text-[11pt] mb-2">
            점검일자 : <span className="text-black">{data.checkDate ? format(parseISO(data.checkDate), 'yyyy년 MM월 dd일') : format(currentDate, 'yyyy년 MM월 dd일')}</span>
          </div>

          <div className={activeSubTab === 'rectifier' ? 'block' : 'hidden-in-ui'}>
            {renderTableSection('정류기반', recItems, 1)}
          </div>
          <div className={activeSubTab === 'battery' ? 'block' : 'hidden-in-ui'}>
            {renderTableSection('개별전류', batItems, 2)}
          </div>
          <div className={activeSubTab === 'generator' ? 'block' : 'hidden-in-ui'}>
            {renderTableSection('발전기', genItems, 3)}
          </div>
          <div className={activeSubTab === 'remarks' ? 'block' : 'hidden-in-ui'}>
            <div className="mb-2 max-w-7xl mx-auto">
              <h3 className="text-lg font-bold mb-3 text-black border-l-4 border-black pl-2 hidden-in-ui">4. 특이사항</h3>
              
              {/* UI 전용: 데이터 테이블 형식 (헤더 삭제) */}
              <div className={`print:hidden bg-white transition-all ${isEditMode ? 'ring-2 ring-orange-200' : ''}`}>
                <table className="w-full border-collapse text-center table-fixed border border-black">
                  <tbody className="bg-white">
                    <tr className="bg-white">
                      <td className="p-0">
                        <textarea
                          className={`w-full p-3 h-24 bg-transparent border-none outline-none shadow-none appearance-none resize-none text-[13px] leading-relaxed font-normal text-left transition-all ${isEditMode ? 'bg-orange-50/30' : 'bg-white cursor-not-allowed'}`}
                          value={data.note || ''}
                          onChange={e => setData({ ...data, note: e.target.value })}
                          readOnly={!isEditMode}
                          placeholder="특이사항을 입력하세요."
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 인쇄 전용: 기존 레이아웃 유지 (절대 수정 금지) */}
              <div className="hidden print:block border border-black rounded-xl overflow-hidden bg-white shadow-sm print:border-none print:rounded-none print:shadow-none p-4 print:p-0">
                <div className="w-full h-[100px] text-[11px] whitespace-pre-wrap text-black border border-black text-left remarks-print-box">
                  {data.note || '특이사항 없음'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scale-up { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-up { animation: scale-up 0.2s ease-out forwards; }
        .hidden-in-ui { display: none; }
        @media print { .hidden-in-ui { display: block !important; } }
        .ui-table-border-fix { border-style: hidden; }
      `}</style>
    </div>
  );
};

export default BatteryCheckLog;
