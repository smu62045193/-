
import React, { useState, useEffect } from 'react';
import { GeneratorCheckData, GeneratorSpec, GeneratorTest, GeneratorStatus } from '../types';
import { fetchMeterReading, fetchGeneratorCheck, saveGeneratorCheck, getInitialGeneratorCheck } from '../services/dataService';
import { format, subMonths, addMonths, parseISO, getDay } from 'date-fns';
import { Save, Printer, ChevronLeft, ChevronRight, RefreshCw, CheckCircle, X, Cloud, Edit2, Lock } from 'lucide-react';

interface GeneratorCheckProps {
  currentDate: Date;
}

const STATUS_LABELS: Record<keyof GeneratorStatus, string> = {
  coolingWater: '냉각수 상태',
  startCircuit: '시동 회로',
  fuelStatus: '연료 상태',
  afterRun: '운전 후 상태',
  panel: '조작반 상태',
  engine: '엔진 상태',
  duringRun: '운전 중 상태',
  afterStop: '정지 후 상태',
  battery: '배터리 상태',
  gravity: '배터리 비중'
};

const GeneratorCheck: React.FC<GeneratorCheckProps> = ({ currentDate }) => {
  const [currentMonth, setCurrentMonth] = useState(format(currentDate, 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('spec');
  const [data, setData] = useState<GeneratorCheckData>(getInitialGeneratorCheck(format(currentDate, 'yyyy-MM')));

  const SUB_TABS = [
    { id: 'spec', label: '제원' },
    { id: 'test', label: '무부하시운전' },
    { id: 'status', label: '점검사항' },
    { id: 'note', label: '특이사항' },
  ];

  useEffect(() => {
    const newMonth = format(currentDate, 'yyyy-MM');
    if (newMonth !== currentMonth) {
      setCurrentMonth(newMonth);
      setIsEditMode(false);
    } else {
      // 데이터가 아예 없는 초기 상태인 경우에만 달력 날짜 동기화
      if (!data.test.startTime && !data.test.endTime && !data.test.usedTime && !data.lastUpdated) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        setData(prev => ({ 
          ...prev, 
          test: { 
            ...prev.test, 
            checkDate: dateStr, 
            dayName: dayNames[getDay(currentDate)] 
          } 
        }));
      }
    }
  }, [currentDate]);

  useEffect(() => { loadData(currentMonth); }, [currentMonth]);

  const loadData = async (monthStr: string) => {
    setLoading(true);
    try {
      const fetched = await fetchGeneratorCheck(monthStr);
      const initial = getInitialGeneratorCheck(monthStr);
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

      if (fetched) {
        // 1. 이미 데이터가 있는 경우 (기존 로직 유지)
        const dbDate = fetched.test?.checkDate || initial.test.checkDate;
        const dbDayName = fetched.test?.dayName || dayNames[getDay(parseISO(dbDate))];

        setData({ 
          ...fetched, 
          specs: { ...initial.specs, ...fetched.specs }, 
          test: { 
            ...initial.test, 
            ...fetched.test, 
            checkDate: dbDate, 
            dayName: dbDayName 
          } 
        });
      } else { 
        // 2. 데이터가 없는 경우 (전월 데이터에서 제원 및 점검값 복사)
        const prevMonthDate = subMonths(parseISO(`${monthStr}-01`), 1);
        const prevMonthStr = format(prevMonthDate, 'yyyy-MM');
        const prevFetched = await fetchGeneratorCheck(prevMonthStr);
        
        if (prevFetched) {
          // 전월의 제원(specs)과 점검값(test)을 모두 가져오되 날짜만 현재 월로 변경
          setData({
            ...initial,
            specs: { ...prevFetched.specs },
            test: { 
              ...prevFetched.test,
              checkDate: format(currentDate, 'yyyy-MM-dd'),
              dayName: dayNames[getDay(currentDate)]
            },
            status: { ...prevFetched.status },
            note: prevFetched.note || ''
          });
        } else {
          setData(initial); 
        }
      }
    } catch (e) { 
      setData(getInitialGeneratorCheck(monthStr)); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSave = async () => {
    if (!data) return;
    setSaveStatus('loading');
    try {
      if (await saveGeneratorCheck(data)) { 
        setSaveStatus('success'); 
        setIsEditMode(false);
        alert('저장이 완료되었습니다.');
        setTimeout(() => setSaveStatus('idle'), 3000); 
      }
      else { setSaveStatus('error'); alert('저장 실패'); }
    } catch (error) { setSaveStatus('error'); alert('저장 중 오류 발생'); }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('generator-print-area');
    if (!printContent) return;
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;
    const monthNum = parseInt(currentMonth.split('-')[1]);

    printWindow.document.write(`
      <html>
        <head>
          <title>${monthNum}월 비상발전기 운전일지</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
            @page { size: A4 portrait; margin: 0; }
            body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; background: black !important; color: black; line-height: 1.1; -webkit-print-color-adjust: exact; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; } }
            .print-page { width: 210mm; min-height: 297mm; padding: 25mm 10mm 10mm 10mm; margin: 20px auto; background: white !important; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
            table { width: 100%; border-collapse: collapse; border: 1px solid black; table-layout: fixed; }
            th, td { border: 1px solid black !important; padding: 0; text-align: center; font-size: 10px; height: 35px !important; background: white; }
            input { border: none !important; width: 100%; height: 100%; text-align: center; outline: none; background: white; font-weight: 500; font-size: 10px; }
            .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; min-height: 100px; }
            .title-area { flex: 1; text-align: center; }
            .doc-title { font-size: 26pt; font-weight: 900; line-height: 1.1; }
            .approval-table { width: 90mm !important; border: 1px solid black !important; margin-left: auto; table-layout: fixed !important; border-collapse: collapse !important; }
            .approval-table tr { height: auto !important; }
            .approval-table th { height: 24px !important; font-size: 9pt !important; background: white !important; font-weight: normal; text-align: center; padding: 0 !important; }
            .approval-table th:not(.side-header) { width: 25% !important; }
            .approval-table td { height: 70px !important; border: 1px solid black !important; background: white !important; padding: 0 !important; }
            .approval-table .side-header { width: 28px !important; line-height: 1.2 !important; }
            .unit-label { font-size: 10pt; font-weight: bold; padding-right: 5px; }
            .border-r-0 { border-right: none !important; }
            .border-l-0 { border-left: none !important; }
            .rounded-xl { border-radius: 0 !important; }
            #generator-print-area { display: flex !important; flex-direction: column !important; gap: 32px !important; }
            #generator-print-area > div { margin: 0 !important; }
            .hide-in-print-window { display: none !important; }
            .remarks-print-box { width: 100% !important; border: 1px solid black !important; min-height: 100px !important; line-height: 1.5 !important; font-size: 10px !important; display: block !important; padding: 12px !important; margin-top: 0 !important; box-sizing: border-box !important; visibility: visible !important; white-space: pre-wrap !important; text-align: left !important; }
            .print-no-border { border: none !important; }
            .voltage-label-print { font-size: 9px !important; }
            .voltage-label-print div { font-size: 9px !important; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
          <div class="print-page">
            <div class="header-flex"><div class="title-area"><div class="doc-title">${monthNum}월 비상발전기 운전일지</div></div>
              <table class="approval-table"><tr><th rowspan="2" class="side-header">결<br/><br/>재</th><th style="font-weight: normal;">주 임</th><th style="font-weight: normal;">대 리</th><th style="font-weight: normal;">과 장</th><th style="font-weight: normal;">소 장</th></tr><tr><td></td><td></td><td></td><td></td></tr></table>
            </div>
            <div id="generator-print-area">
              ${printContent.innerHTML}
            </div>
          </div>
          <script>window.onload = function() { const inputs = document.querySelectorAll('input'); inputs.forEach(i => i.setAttribute('value', i.value)); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const updateSpec = (f: keyof GeneratorSpec, v: string) => setData({ ...data, specs: { ...data.specs, [f]: v } });
  const updateTestValue = (f: keyof GeneratorTest, v: string) => setData(prev => ({ ...prev, test: { ...prev.test, [f]: v } }));
  const toggleStatus = (f: keyof GeneratorStatus) => {
    if (!isEditMode) return;
    setData({ ...data, status: { ...data.status, [f]: data.status[f] === '양호' ? '불량' : '양호' } });
  };

  const handleDateChange = (dateStr: string) => {
    if (!dateStr) return;
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    try {
      const date = parseISO(dateStr);
      const dayName = dayNames[getDay(date)];
      setData(prev => ({
        ...prev,
        test: {
          ...prev.test,
          checkDate: dateStr,
          dayName: dayName
        }
      }));
    } catch (e) {
      console.error("Invalid date format", e);
    }
  };

  const hasManagement = false; // 발전기 점검은 관리/비고 컬럼이 없음
  const rowPadding = hasManagement ? 'py-1' : 'py-2';
  const labelStyle = `border-b border-r border-black bg-white h-[40px] font-normal text-center text-[13px] text-black p-0`;
  const cellStyle = `border-b border-r border-black h-[40px] font-normal text-center bg-white text-[13px] text-black p-0`;
  const inputStyle = `w-full h-full text-center bg-transparent border-none outline-none shadow-none appearance-none text-black font-normal text-[13px] px-2 ${isEditMode ? 'bg-orange-50/30' : 'cursor-not-allowed'}`;

  return (
    <div className="max-w-7xl mx-auto space-y-2 pb-10 animate-fade-in">
      {/* 서브탭 메뉴 및 액션 버튼 */}
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
        <div className="flex items-stretch overflow-x-auto scrollbar-hide whitespace-nowrap">
          {/* 1. 날짜 선택 영역 (월 네비게이션) */}
          <div className="flex items-center shrink-0">
            <button 
              onClick={() => setCurrentMonth(prev => format(subMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'))} 
              className="px-2 py-3 text-gray-500 hover:text-black transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-2 py-3 text-[14px] font-bold text-black min-w-[100px] text-center">
              {currentMonth.split('-')[0]}년 {currentMonth.split('-')[1]}월
            </div>
            <button 
              onClick={() => setCurrentMonth(prev => format(addMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'))} 
              className="px-2 py-3 text-gray-500 hover:text-black transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center shrink-0 px-2">
            <div className="w-[1px] h-6 bg-black"></div>
          </div>

          {/* 2. 서브탭 메뉴 (제원 무부하시운전 점검사항 특이사항) */}
          <div className="flex items-stretch shrink-0">
            {SUB_TABS.map((tab) => (
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

          <div className="flex items-center shrink-0 px-2">
            <div className="w-[1px] h-6 bg-black"></div>
          </div>

          {/* 3. 액션 버튼 영역 (새로고침 수정 저장 인쇄) */}
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
              onClick={() => setIsEditMode(!isEditMode)} 
              className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap ${
                isEditMode ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              {isEditMode ? <CheckCircle size={18} className="mr-1.5" /> : <Edit2 size={18} className="mr-1.5" />}
              {isEditMode ? '수정완료' : '수정'}
              {isEditMode && <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />}
            </button>

            <button 
              onClick={handleSave} 
              disabled={saveStatus==='loading'} 
              className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50 ${
                saveStatus === 'success' ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              {saveStatus === 'loading' ? <RefreshCw size={18} className="animate-spin mr-1.5" /> : saveStatus === 'success' ? <CheckCircle size={18} className="mr-1.5" /> : <Save size={18} className="mr-1.5" />}
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
        </div>
      </div>
      <div className="w-full min-w-[1000px] main-screen-generator">
        <div id="generator-print-area">
          <div className={`mb-8 ${activeSubTab === 'spec' ? 'block' : 'hidden-in-ui'}`}>
            <h3 className="text-[15px] font-bold mb-2 border-l-4 border-black pl-2 hidden-in-ui">1. 비상 발전기 제원</h3>
            <div className="max-w-7xl mx-auto bg-white border-t border-l border-black print-no-border">
              <table className="w-full border-collapse text-center table-fixed">
                <colgroup>
                  <col className="w-32" />
                  <col />
                  <col className="w-32" />
                  <col />
                </colgroup>
                <tbody>
                  <tr><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">제 조 사</div></td><td className={cellStyle}><input className={inputStyle} value={data.specs.manufacturer} onChange={e => updateSpec('manufacturer', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">출 력</div></td><td className={cellStyle}><input className={inputStyle} value={data.specs.output} onChange={e => updateSpec('output', e.target.value)} readOnly={!isEditMode} /></td></tr>
                  <tr><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">제작년도</div></td><td className={cellStyle}><input className={inputStyle} value={data.specs.year} onChange={e => updateSpec('year', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">정격전압</div></td><td className={cellStyle}><input className={inputStyle} value={data.specs.voltage} onChange={e => updateSpec('voltage', e.target.value)} readOnly={!isEditMode} /></td></tr>
                  <tr><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">제조번호</div></td><td className={cellStyle}><input className={inputStyle} value={data.specs.serialNo} onChange={e => updateSpec('serialNo', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">정격전류</div></td><td className={cellStyle}><input className={inputStyle} value={data.specs.current} onChange={e => updateSpec('current', e.target.value)} readOnly={!isEditMode} /></td></tr>
                  <tr><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">형 식</div></td><td className={cellStyle}><input className={inputStyle} value={data.specs.type} onChange={e => updateSpec('type', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">회전속도</div></td><td className={cellStyle}><input className={inputStyle} value={data.specs.rpm} onChange={e => updateSpec('rpm', e.target.value)} readOnly={!isEditMode} /></td></tr>
                  <tr><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">위 치</div></td><td className={cellStyle}><input className={inputStyle} value={data.specs.location} onChange={e => updateSpec('location', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">여자방식</div></td><td className={cellStyle}><input className={inputStyle} value={data.specs.method} onChange={e => updateSpec('method', e.target.value)} readOnly={!isEditMode} /></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className={`flex flex-row gap-4 items-start print:flex ${activeSubTab === 'test' || activeSubTab === 'status' ? 'flex' : 'hidden-in-ui'}`}>
            <div className={`flex-[2.2] print:block ${activeSubTab === 'test' ? 'block' : 'hidden-in-ui'}`}>
              <h3 className="text-[15px] font-bold mb-2 border-l-4 border-black pl-2 hidden-in-ui">2. 무부하시 운전 및 점검</h3>
              <div className="max-w-7xl mx-auto bg-white border-t border-l border-black print-no-border">
                <table className="w-full border-collapse text-center table-fixed">
                  <colgroup>
                    <col className="w-[25%]" />
                    <col className="w-[12.5%]" />
                    <col className="w-[12.5%]" />
                    <col className="w-[25%]" />
                    <col className="w-[12.5%]" />
                    <col className="w-[12.5%]" />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td className={labelStyle}><div className="flex items-center justify-center h-full px-2">점검일자</div></td>
                      <td colSpan={5} className={cellStyle}>
                        {isEditMode ? (
                          <input 
                            type="date" 
                            className={inputStyle} 
                            value={data.test.checkDate} 
                            onChange={e => handleDateChange(e.target.value)} 
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal text-black">
                            {data.test.checkDate ? `${data.test.checkDate.split('-')[0]}년 ${data.test.checkDate.split('-')[1]}월 ${data.test.checkDate.split('-')[2]}일 ${data.test.dayName}요일` : ''}
                          </div>
                        )}
                      </td>
                    </tr>
                    <tr><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">운전사유</div></td><td colSpan={5} className={cellStyle}><input className={inputStyle} value={data.test.reason} onChange={e => updateTestValue('reason', e.target.value)} readOnly={!isEditMode} /></td></tr>
                    <tr>
                      <td className={labelStyle}><div className="flex items-center justify-center h-full px-2">운전시간</div></td>
                      <td colSpan={2} className={`${cellStyle} border-r-0`}><input className={inputStyle} value={data.test.startTime} onChange={e => updateTestValue('startTime', e.target.value)} placeholder="00:00" readOnly={!isEditMode} /></td>
                      <td className={`${labelStyle} border-l-0 border-r-0`}><div className="flex items-center justify-center h-full px-2">~</div></td>
                      <td colSpan={2} className={`${cellStyle} border-l-0`}><input className={inputStyle} value={data.test.endTime} onChange={e => updateTestValue('endTime', e.target.value)} placeholder="00:00" readOnly={!isEditMode} /></td>
                    </tr>
                    <tr><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">사용시간</div></td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.usedTime} onChange={e => updateTestValue('usedTime', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">월간가동</div></td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.monthlyRunTime} onChange={e => updateTestValue('monthlyRunTime', e.target.value)} readOnly={!isEditMode} /></td></tr>
                    <tr><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">월 가동회수</div></td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.monthlyRunCount} onChange={e => updateTestValue('monthlyRunCount', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">총가동시간</div></td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.totalRunTime} onChange={e => updateTestValue('totalRunTime', e.target.value)} readOnly={!isEditMode} /></td></tr>
                    <tr><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">연료사용(ℓ)</div></td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.fuelUsed} onChange={e => updateTestValue('fuelUsed', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">연료누계(ℓ)</div></td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.fuelTotal} onChange={e => updateTestValue('fuelTotal', e.target.value)} readOnly={!isEditMode} /></td></tr>
                    <tr>
                      <td className={labelStyle} rowSpan={3}><div className="flex items-center justify-center h-full px-2">전 압(V)</div></td>
                      <td className={`${labelStyle} voltage-label-print`}><div className="flex items-center justify-center h-full px-2">R-S/R-N</div></td>
                      <td className={cellStyle}><input className={inputStyle} value={data.test.voltsRS} onChange={e => updateTestValue('voltsRS', e.target.value)} readOnly={!isEditMode} /></td>
                      <td className={labelStyle} rowSpan={3}><div className="flex items-center justify-center h-full px-2">전 류(A)</div></td>
                      <td className={labelStyle}><div className="flex items-center justify-center h-full px-2">R</div></td>
                      <td className={cellStyle}><input className={inputStyle} value={data.test.ampR} onChange={e => updateTestValue('ampR', e.target.value)} readOnly={!isEditMode} /></td>
                    </tr>
                    <tr>
                      <td className={`${labelStyle} voltage-label-print`}><div className="flex items-center justify-center h-full px-2">S-T/S-N</div></td>
                      <td className={cellStyle}><input className={inputStyle} value={data.test.voltsST} onChange={e => updateTestValue('voltsST', e.target.value)} readOnly={!isEditMode} /></td>
                      <td className={labelStyle}><div className="flex items-center justify-center h-full px-2">S</div></td>
                      <td className={cellStyle}><input className={inputStyle} value={data.test.ampS} onChange={e => updateTestValue('ampS', e.target.value)} readOnly={!isEditMode} /></td>
                    </tr>
                    <tr>
                      <td className={`${labelStyle} voltage-label-print`}><div className="flex items-center justify-center h-full px-2">T-R/T-N</div></td>
                      <td className={cellStyle}><input className={inputStyle} value={data.test.voltsTR} onChange={e => updateTestValue('voltsTR', e.target.value)} readOnly={!isEditMode} /></td>
                      <td className={labelStyle}><div className="flex items-center justify-center h-full px-2">T</div></td>
                      <td className={cellStyle}><input className={inputStyle} value={data.test.ampT} onChange={e => updateTestValue('ampT', e.target.value)} readOnly={!isEditMode} /></td>
                    </tr>
                    <tr><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">오일온도(℃)</div></td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.oilTemp} onChange={e => updateTestValue('oilTemp', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">오일압력</div></td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.oilPressure} onChange={e => updateTestValue('oilPressure', e.target.value)} readOnly={!isEditMode} /></td></tr>
                    <tr><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">회전속도</div></td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.rpmValue} onChange={e => updateTestValue('rpmValue', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}><div className="flex items-center justify-center h-full px-2">배터리비중</div></td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.batteryGravityValue} onChange={e => updateTestValue('batteryGravityValue', e.target.value)} readOnly={!isEditMode} /></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className={`flex-1 print:block ${activeSubTab === 'status' ? 'block' : 'hidden-in-ui'}`}>
              <h3 className="text-[15px] font-bold mb-2 border-l-4 border-black pl-2 hidden-in-ui">3. 점검사항</h3>
              <div className="max-w-7xl mx-auto bg-white border-t border-l border-black print-no-border">
                {/* UI용 4열 테이블 */}
                <table className="w-full border-collapse text-center hide-in-print-window">
                  <thead>
                    <tr className="bg-white">
                      <th className={labelStyle}><div className="flex items-center justify-center h-full px-2">구분</div></th>
                      <th className={`${labelStyle} w-16`}><div className="flex items-center justify-center h-full px-2">결과</div></th>
                      <th className={labelStyle}><div className="flex items-center justify-center h-full px-2">구분</div></th>
                      <th className={`${labelStyle} w-16`}><div className="flex items-center justify-center h-full px-2">결과</div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const keys = Object.keys(STATUS_LABELS) as Array<keyof GeneratorStatus>;
                      const half = Math.ceil(keys.length / 2);
                      const leftKeys = keys.slice(0, half);
                      const rightKeys = keys.slice(half);
                      return leftKeys.map((key, index) => {
                        const rightKey = rightKeys[index];
                        return (
                          <tr key={key}>
                            <td className={labelStyle}><div className="flex items-center justify-center h-full px-2">{STATUS_LABELS[key]}</div></td>
                            <td 
                              className={`${cellStyle} transition-colors ${isEditMode ? 'cursor-pointer' : 'cursor-default'} ${
                                data.status[key] === '양호' ? 'bg-blue-50/10' : data.status[key] === '불량' ? 'bg-red-50' : 'text-gray-400'
                              }`}
                              onClick={() => toggleStatus(key)}
                            >
                              <div className="flex items-center justify-center h-full px-2">{data.status[key]}</div>
                            </td>
                            {rightKey ? (
                              <>
                                <td className={labelStyle}><div className="flex items-center justify-center h-full px-2">{STATUS_LABELS[rightKey]}</div></td>
                                <td 
                                  className={`${cellStyle} transition-colors ${isEditMode ? 'cursor-pointer' : 'cursor-default'} ${
                                    data.status[rightKey] === '양호' ? 'bg-blue-50/10' : data.status[rightKey] === '불량' ? 'bg-red-50' : 'text-gray-400'
                                  }`}
                                  onClick={() => toggleStatus(rightKey)}
                                >
                                  <div className="flex items-center justify-center h-full px-2">{data.status[rightKey]}</div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className={labelStyle}></td>
                                <td className={cellStyle}></td>
                              </>
                            )}
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>

                {/* 인쇄용 2열 테이블 (기존 유지) */}
                <table className="w-full border-collapse text-center hidden-in-ui border-t border-l border-black">
                  <thead>
                    <tr className="bg-white">
                      <th className={labelStyle}><div className="flex items-center justify-center h-full px-2">구분</div></th>
                      <th className={`${labelStyle} w-16`}><div className="flex items-center justify-center h-full px-2">결과</div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(STATUS_LABELS) as Array<keyof GeneratorStatus>).map((key) => (
                      <tr key={key}>
                        <td className={labelStyle}><div className="flex items-center justify-center h-full px-2">{STATUS_LABELS[key]}</div></td>
                        <td 
                          className={`${cellStyle} transition-colors ${isEditMode ? 'cursor-pointer' : 'cursor-default'} ${
                            data.status[key] === '양호' ? 'bg-blue-50/10' : data.status[key] === '불량' ? 'bg-red-50' : 'text-gray-400'
                          }`}
                          onClick={() => toggleStatus(key)}
                        >
                          <div className="flex items-center justify-center h-full px-2">{data.status[key]}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className={`${activeSubTab === 'note' ? 'block' : 'hidden-in-ui'}`}>
            <h3 className="text-[15px] font-bold mb-2 border-l-4 border-black pl-2 hidden-in-ui">4. 특이사항</h3>
            <div className="max-w-7xl mx-auto border-t border-l border-black bg-white print:hidden hide-in-print-window">
              <textarea 
                className={`w-full p-2 h-24 bg-transparent border-b border-r border-black outline-none shadow-none appearance-none text-[13px] leading-relaxed font-normal text-left transition-all ${isEditMode ? 'bg-orange-50/30' : 'cursor-not-allowed'}`}
                value={data.note || ''}
                onChange={e => setData({...data, note: e.target.value})}
                placeholder="점검 결과 특이사항을 입력하세요."
                readOnly={!isEditMode}
              />
            </div>
            {/* 인쇄 전용 특이사항 박스 */}
            <div className="hidden print:block w-full remarks-print-box">
              {data.note || '특이사항 없음'}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scale-up { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-up { animation: scale-up 0.2s ease-out forwards; }
        .hidden-in-ui { display: none; }
        @media print { .hidden-in-ui { display: block !important; } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default GeneratorCheck;
