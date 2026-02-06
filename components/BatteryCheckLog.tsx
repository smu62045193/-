
import React, { useState, useEffect } from 'react';
import { BatteryCheckData, BatteryItem } from '../types';
import { fetchBatteryCheck, saveBatteryCheck, getInitialBatteryCheck } from '../services/dataService';
import { format, subMonths, addMonths, parseISO } from 'date-fns';
import { Save, Printer, ChevronLeft, ChevronRight, RefreshCw, CheckCircle, X, Cloud, Edit2, Lock } from 'lucide-react';

interface BatteryCheckLogProps {
  currentDate: Date;
}

const BatteryCheckLog: React.FC<BatteryCheckLogProps> = ({ currentDate }) => {
  const [currentMonth, setCurrentMonth] = useState(format(currentDate, 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isEditMode, setIsEditMode] = useState(false);
  const [data, setData] = useState<BatteryCheckData>(getInitialBatteryCheck(format(currentDate, 'yyyy-MM')));

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
        setData(fetched);
      } else {
        // 데이터가 없는 경우 전월 데이터 찾기
        const prevMonthDate = subMonths(parseISO(`${monthStr}-01`), 1);
        const prevMonthStr = format(prevMonthDate, 'yyyy-MM');
        const prevFetched = await fetchBatteryCheck(prevMonthStr);

        if (prevFetched && prevFetched.items) {
          // 전월의 모든 항목(제조사, 년월일, 규격, 전압, 비고)을 현재로 복사
          const carriedItems = initial.items.map(initItem => {
            const prevItem = prevFetched.items.find(pi => pi.label === initItem.label && pi.section === initItem.section);
            return prevItem ? {
              ...initItem,
              manufacturer: prevItem.manufacturer || '',
              manufDate: prevItem.manufDate || '',
              spec: prevItem.spec || '',
              voltage: prevItem.voltage || '',
              remarks: prevItem.remarks || ''
            } : initItem;
          });
          
          setData({ 
            ...initial, 
            checkDate: format(currentDate, 'yyyy-MM-dd'),
            items: carriedItems 
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
            body { font-family: sans-serif; padding: 0; margin: 0; background: #f1f5f9; color: black; line-height: 1.2; -webkit-print-color-adjust: exact; }
            table { table-layout: fixed !important; width: 100% !important; border-collapse: collapse !important; border: 1px solid black !important; }
            th, td { border: 1px solid black !important; height: 40px !important; font-size: 9pt !important; text-align: center; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; } }
            .print-page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 25mm 10mm 10mm 10mm; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
            .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; min-height: 100px; }
            .title-area { flex: 1; text-align: center; }
            .doc-title { font-size: 25pt; font-weight: 900; line-height: 1.1; }
            .approval-table { width: 90mm !important; border: 1.5px solid black !important; margin-left: auto; }
            .approval-table th { height: 24px !important; font-size: 8pt !important; background: #f3f4f6 !important; font-weight: bold; text-align: center; }
            .approval-table td { height: 70px !important; border: 1px solid black !important; }
            .approval-table .side-header { width: 28px !important; }
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
                <tr><th rowspan="2" class="side-header">결<br/>재</th><th>담 당</th><th>주 임</th><th>대 리</th><th>과 장</th><th>소 장</th></tr>
                <tr><td></td><td></td><td></td><td></td><td></td></tr>
              </table>
            </div>
            ${printContent.innerHTML}
          </div>
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
  const inputClass = `w-full text-center h-full outline-none text-black font-medium text-sm p-1 transition-all`;
  const editableInputClass = (isEditing: boolean) => `${inputClass} ${isEditing ? 'bg-orange-50 focus:bg-orange-100' : 'bg-white cursor-not-allowed'}`;
  const headerClass = "border border-gray-300 p-1.5 bg-gray-50 text-gray-700 font-bold text-[13px]";
  const cellClass = "border border-gray-300 p-0 h-[40px] align-middle";
  
  const recItems = data?.items?.filter(i => i.section === 'rectifier') || [];
  const batItems = data?.items?.filter(i => i.section === 'battery') || [];
  const genItems = data?.items?.filter(i => i.section === 'generator') || [];

  const renderTableSection = (title: string, items: BatteryItem[], sectionIndex: number) => (
    <div className="mb-6">
      <h3 className="text-lg font-bold mb-2 text-black border-l-4 border-black pl-2">{sectionIndex}. {title}</h3>
      <table className="w-full border-collapse text-center text-sm text-black border border-gray-300 table-fixed">
        <thead>
          <tr className="bg-gray-50">
            <th className={`${headerClass} w-20`}>구분</th>
            <th className={`${headerClass} w-[130px]`}>제조업체</th>
            <th className={`${headerClass} w-[95px]`}>제조년월일</th>
            <th className={`${headerClass}`}>규격/차단기</th>
            <th className={`${headerClass} w-24`}>전압</th>
            <th className={`${headerClass} w-24`}>비고</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="h-[40px]">
              <td className="border border-gray-300 bg-gray-50 font-bold text-gray-700">{item.label}</td>
              <td className={cellClass}>
                <input 
                  type="text" 
                  className={editableInputClass(isEditMode)} 
                  value={item.manufacturer || ''} 
                  onChange={e => updateItem(item.id, 'manufacturer', e.target.value)} 
                  onKeyDown={handleKeyDown}
                  readOnly={!isEditMode} 
                />
              </td>
              <td className={cellClass}>
                <input 
                  type="text" 
                  className={editableInputClass(isEditMode)} 
                  value={item.manufDate || ''} 
                  onChange={e => updateItem(item.id, 'manufDate', e.target.value)} 
                  onKeyDown={handleKeyDown}
                  readOnly={!isEditMode} 
                />
              </td>
              <td className={cellClass}>
                <input 
                  type="text" 
                  className={`${editableInputClass(isEditMode)} !text-left px-3`} 
                  value={item.spec || ''} 
                  onChange={e => updateItem(item.id, 'spec', e.target.value)} 
                  onKeyDown={handleKeyDown}
                  readOnly={!isEditMode} 
                />
              </td>
              <td className={cellClass}>
                <input 
                  type="text" 
                  className={`${editableInputClass(isEditMode)} font-bold text-blue-700`} 
                  value={item.voltage || ''} 
                  onChange={e => updateItem(item.id, 'voltage', e.target.value)} 
                  onKeyDown={handleKeyDown} 
                  readOnly={!isEditMode} 
                />
              </td>
              <td className={cellClass}>
                <input 
                  type="text" 
                  className={editableInputClass(isEditMode)} 
                  value={item.remarks || ''} 
                  onChange={e => updateItem(item.id, 'remarks', e.target.value)} 
                  onKeyDown={handleKeyDown} 
                  readOnly={!isEditMode}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6 bg-white rounded-xl border border-gray-200 shadow-sm print:shadow-none print:border-none print:p-0">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4 print:hidden">
        <div className="flex items-center space-x-4">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft /></button>
          <h2 className="text-2xl font-bold text-gray-800">{year}년 {month}월</h2>
          <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><ChevronRight /></button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => loadData(currentMonth)} disabled={loading} className="flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200 transition-all text-sm active:scale-95 disabled:opacity-50"><RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />새로고침</button>
          <button onClick={() => setIsEditMode(!isEditMode)} className={`flex items-center px-4 py-2 rounded-lg font-bold shadow-sm transition-all text-sm ${isEditMode ? 'bg-orange-50 text-white hover:bg-orange-600' : 'bg-gray-700 text-white hover:bg-gray-800'}`}>{isEditMode ? <Lock size={18} className="mr-2" /> : <Edit2 size={18} className="mr-2" />}{isEditMode ? '수정 취소' : '수정'}</button>
          <button onClick={handleSave} disabled={saveStatus === 'loading'} className={`flex items-center px-4 py-2 rounded-lg font-bold shadow-sm transition-all ${saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{saveStatus === 'loading' ? <RefreshCw size={18} className="mr-2 animate-spin" /> : saveStatus === 'success' ? <CheckCircle size={18} className="mr-2" /> : <Save size={18} className="mr-2" />}{saveStatus === 'success' ? '저장완료' : '서버 저장'}</button>
          <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 font-bold shadow-sm text-sm transition-all"><Printer size={18} className="mr-2" />미리보기</button>
        </div>
      </div>

      <div id="battery-check-print-area">
        <div className="text-right font-bold text-[12pt] mb-2">
          점검일자 : {isEditMode ? (
            <input 
              type="date" 
              value={data.checkDate || format(currentDate, 'yyyy-MM-dd')} 
              onChange={e => setData({...data, checkDate: e.target.value})}
              className="border border-blue-200 bg-orange-50 px-2 py-0.5 rounded outline-none font-bold text-blue-700"
            />
          ) : (
            <span className="text-blue-600">{data.checkDate ? format(parseISO(data.checkDate), 'yyyy년 MM월 dd일') : format(currentDate, 'yyyy년 MM월 dd일')}</span>
          )}
        </div>

        {renderTableSection('정류기반', recItems, 1)}
        {renderTableSection('정류기반 밧데리 개별전류', batItems, 2)}
        {renderTableSection('비상용 발전기', genItems, 3)}
      </div>

      <style>{`
        @keyframes scale-up { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-up { animation: scale-up 0.2s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default BatteryCheckLog;
