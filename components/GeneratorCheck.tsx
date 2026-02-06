
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
  const [data, setData] = useState<GeneratorCheckData>(getInitialGeneratorCheck(format(currentDate, 'yyyy-MM')));

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
            body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; background: #f1f5f9; color: black; line-height: 1.1; -webkit-print-color-adjust: exact; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; } }
            .print-page { width: 210mm; min-height: 297mm; padding: 25mm 10mm 10mm 10mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
            table { width: 100%; border-collapse: collapse; border: 1.5px solid black; table-layout: fixed; }
            th, td { border: 1px solid black !important; padding: 0; text-align: center; font-size: 11px; height: 35px !important; background: white; }
            input { border: none !important; width: 100%; height: 100%; text-align: center; outline: none; background: white; font-weight: 500; font-size: 11px; }
            .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; min-height: 100px; }
            .doc-title { font-size: 26pt; font-weight: 900; }
            .approval-table { width: 85mm !important; border: 1.5px solid black !important; margin-left: auto; }
            .approval-table th { height: 24px !important; font-size: 9pt !important; background: #f3f4f6 !important; font-weight: bold; }
            .approval-table td { height: 70px !important; border: 1px solid black !important; background: white !important; }
            .approval-table .side-header { width: 26px !important; }
            .unit-label { font-size: 10pt; font-weight: bold; padding-right: 5px; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
          <div class="print-page">
            <div class="header-flex"><div class="title-area"><div class="doc-title">${monthNum}월 비상발전기 운전일지</div></div>
              <table class="approval-table"><tr><th rowspan="2" class="side-header">결<br/>재</th><th>담 당</th><th>주 임</th><th>대 리</th><th>과 장</th><th>소 장</th></tr><tr><td></td><td></td><td></td><td></td><td></td></tr></table>
            </div>
            ${printContent.innerHTML}
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

  const labelStyle = "border border-black bg-gray-50 p-1 font-bold text-center text-[11px] text-gray-700 w-32 h-[35px]";
  const cellStyle = "border border-black p-0 h-[35px] align-middle text-center bg-white text-[11px]";
  const inputStyle = `w-full h-full text-center outline-none text-black font-medium text-[11px] transition-all ${isEditMode ? 'bg-orange-50 focus:bg-orange-100' : 'bg-white cursor-not-allowed'}`;

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6 bg-white rounded-xl border border-gray-200 shadow-sm print:shadow-none">
      <div className="flex justify-between items-center border-b pb-4 print:hidden">
        <div className="flex items-center space-x-4">
          <button onClick={() => setCurrentMonth(prev => format(subMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'))} className="p-1 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
          <h2 className="text-2xl font-bold text-gray-800">{currentMonth.split('-')[0]}년 {currentMonth.split('-')[1]}월</h2>
          <button onClick={() => setCurrentMonth(prev => format(addMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'))} className="p-1 hover:bg-gray-100 rounded-full"><ChevronRight /></button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => loadData(currentMonth)} disabled={loading} className="flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-bold h-10 hover:bg-gray-200 transition-colors"><RefreshCw size={18} className={loading?'animate-spin':''} />새로고침</button>
          
          <button 
            onClick={() => setIsEditMode(!isEditMode)} 
            className={`flex items-center px-4 py-2 rounded-lg font-bold shadow-sm transition-all text-sm ${isEditMode ? 'bg-orange-50 text-white hover:bg-orange-600' : 'bg-gray-700 text-white hover:bg-gray-800'}`}
          >
            {isEditMode ? <Lock size={18} className="mr-2" /> : <Edit2 size={18} className="mr-2" />}
            {isEditMode ? '수정 취소' : '수정'}
          </button>

          <button 
            onClick={handleSave} 
            disabled={saveStatus==='loading'} 
            className={`flex items-center px-4 py-2 rounded-lg font-bold text-white h-10 shadow-sm ${
              saveStatus === 'loading' ? 'bg-blue-400' : saveStatus === 'success' ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saveStatus === 'loading' ? <RefreshCw size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
            서버저장
          </button>
          
          <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg font-bold h-10 shadow-sm hover:bg-gray-800 transition-colors"><Printer size={18} className="mr-2" />미리보기</button>
        </div>
      </div>

      <div id="generator-print-area">
        <div className="mb-8">
          <h3 className="text-lg font-bold mb-2 border-l-4 border-black pl-2">1. 비상 발전기 제원</h3>
          <table className="w-full border-collapse border border-black table-fixed">
            <tbody>
              <tr><td className={labelStyle}>제 조 사</td><td className={cellStyle}><input className={inputStyle} value={data.specs.manufacturer} onChange={e => updateSpec('manufacturer', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}>출 력</td><td className={cellStyle}><input className={inputStyle} value={data.specs.output} onChange={e => updateSpec('output', e.target.value)} readOnly={!isEditMode} /></td></tr>
              <tr><td className={labelStyle}>제작년도</td><td className={cellStyle}><input className={inputStyle} value={data.specs.year} onChange={e => updateSpec('year', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}>정격전압</td><td className={cellStyle}><input className={inputStyle} value={data.specs.voltage} onChange={e => updateSpec('voltage', e.target.value)} readOnly={!isEditMode} /></td></tr>
              <tr><td className={labelStyle}>제조번호</td><td className={cellStyle}><input className={inputStyle} value={data.specs.serialNo} onChange={e => updateSpec('serialNo', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}>정격전류</td><td className={cellStyle}><input className={inputStyle} value={data.specs.current} onChange={e => updateSpec('current', e.target.value)} readOnly={!isEditMode} /></td></tr>
              <tr><td className={labelStyle}>형 식</td><td className={cellStyle}><input className={inputStyle} value={data.specs.type} onChange={e => updateSpec('type', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}>회전속도</td><td className={cellStyle}><input className={inputStyle} value={data.specs.rpm} onChange={e => updateSpec('rpm', e.target.value)} readOnly={!isEditMode} /></td></tr>
              <tr><td className={labelStyle}>위 치</td><td className={cellStyle}><input className={inputStyle} value={data.specs.location} onChange={e => updateSpec('location', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}>여자방식</td><td className={cellStyle}><input className={inputStyle} value={data.specs.method} onChange={e => updateSpec('method', e.target.value)} readOnly={!isEditMode} /></td></tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-row gap-4 items-start bg-white">
          <div className="flex-[2.2]">
            <h3 className="text-lg font-bold mb-2 border-l-4 border-black pl-2">2. 무부하시 운전 및 점검</h3>
            <table className="w-full border-collapse border border-black table-fixed text-center">
              <tbody>
                <tr><td className={labelStyle}>점검일자</td><td colSpan={5} className={`${cellStyle} font-bold text-blue-600 text-[11px]`}>{data.test.checkDate} ({data.test.dayName})</td></tr>
                <tr><td className={labelStyle}>운전사유</td><td colSpan={5} className={cellStyle}><input className={inputStyle} value={data.test.reason} onChange={e => updateTestValue('reason', e.target.value)} readOnly={!isEditMode} /></td></tr>
                <tr><td className={labelStyle}>운전시간</td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.startTime} onChange={e => updateTestValue('startTime', e.target.value)} placeholder="00:00" readOnly={!isEditMode} /></td><td className="border border-black font-bold h-[35px] text-[11px]">~</td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.endTime} onChange={e => updateTestValue('endTime', e.target.value)} placeholder="00:00" readOnly={!isEditMode} /></td></tr>
                <tr><td className={labelStyle}>사용시간</td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.usedTime} onChange={e => updateTestValue('usedTime', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}>월간가동</td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.monthlyRunTime} onChange={e => updateTestValue('monthlyRunTime', e.target.value)} readOnly={!isEditMode} /></td></tr>
                <tr><td className={labelStyle}>월 가동회수</td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.monthlyRunCount} onChange={e => updateTestValue('monthlyRunCount', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}>총가동시간</td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.totalRunTime} onChange={e => updateTestValue('totalRunTime', e.target.value)} readOnly={!isEditMode} /></td></tr>
                <tr><td className={labelStyle}>연료사용(ℓ)</td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.fuelUsed} onChange={e => updateTestValue('fuelUsed', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}>연료누계(ℓ)</td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.fuelTotal} onChange={e => updateTestValue('fuelTotal', e.target.value)} readOnly={!isEditMode} /></td></tr>
                <tr><td className={labelStyle} rowSpan={3}>전 압(V)</td><td className="border border-black font-bold text-[11px] h-[35px] bg-gray-50">R-S/R-N</td><td className={cellStyle}><input className={inputStyle} value={data.test.voltsRS} onChange={e => updateTestValue('voltsRS', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle} rowSpan={3}>전 류(A)</td><td className="border border-black font-bold text-[11px] h-[35px] bg-gray-50">R</td><td className={cellStyle}><input className={inputStyle} value={data.test.ampR} onChange={e => updateTestValue('ampR', e.target.value)} readOnly={!isEditMode} /></td></tr>
                <tr><td className="border border-black font-bold text-[11px] h-[35px] bg-gray-50">S-T/S-N</td><td className={cellStyle}><input className={inputStyle} value={data.test.voltsST} onChange={e => updateTestValue('voltsST', e.target.value)} readOnly={!isEditMode} /></td><td className="border border-black font-bold text-[11px] h-[35px] bg-gray-50">S</td><td className={cellStyle}><input className={inputStyle} value={data.test.ampS} onChange={e => updateTestValue('ampS', e.target.value)} readOnly={!isEditMode} /></td></tr>
                <tr><td className="border border-black font-bold text-[11px] h-[35px] bg-gray-50">T-R/T-N</td><td className={cellStyle}><input className={inputStyle} value={data.test.voltsTR} onChange={e => updateTestValue('voltsTR', e.target.value)} readOnly={!isEditMode} /></td><td className="border border-black font-bold text-[11px] h-[35px] bg-gray-50">T</td><td className={cellStyle}><input className={inputStyle} value={data.test.ampT} onChange={e => updateTestValue('ampT', e.target.value)} readOnly={!isEditMode} /></td></tr>
                <tr><td className={labelStyle}>오일온도(℃)</td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.oilTemp} onChange={e => updateTestValue('oilTemp', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}>오일압력</td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.oilPressure} onChange={e => updateTestValue('oilPressure', e.target.value)} readOnly={!isEditMode} /></td></tr>
                <tr><td className={labelStyle}>회전속도</td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.rpmValue} onChange={e => updateTestValue('rpmValue', e.target.value)} readOnly={!isEditMode} /></td><td className={labelStyle}>배터리비중</td><td colSpan={2} className={cellStyle}><input className={inputStyle} value={data.test.batteryGravityValue} onChange={e => updateTestValue('batteryGravityValue', e.target.value)} readOnly={!isEditMode} /></td></tr>
              </tbody>
            </table>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-2 border-l-4 border-black pl-2">3. 점검사항</h3>
            <table className="w-full border-collapse border border-black">
              <thead><tr className="bg-gray-100 h-[35px]"><th className="border border-black text-[11px]">구분</th><th className="border border-black text-[11px] w-16">결과</th></tr></thead>
              <tbody>
                {(Object.keys(STATUS_LABELS) as Array<keyof GeneratorStatus>).map(key => (
                  <tr key={key} className="h-[35px]">
                    <td className="border border-black px-1 text-[11px] font-medium text-gray-600 bg-white text-center">{STATUS_LABELS[key]}</td>
                    <td 
                      className={`border border-black text-center font-black text-[11px] transition-colors ${isEditMode ? 'cursor-pointer' : 'cursor-default'} ${
                        data.status[key] === '양호' ? 'text-blue-600 bg-blue-50/10' : data.status[key] === '불량' ? 'text-red-600 bg-red-50' : 'text-gray-400'
                      }`}
                      onClick={() => toggleStatus(key)}
                    >
                      {data.status[key]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-bold mb-2 border-l-4 border-black pl-2">4. 특이사항</h3>
          <textarea 
            className={`w-full border border-black p-3 h-24 outline-none resize-none text-[11px] leading-relaxed font-medium transition-all ${isEditMode ? 'bg-orange-50 focus:bg-orange-100' : 'bg-white cursor-not-allowed'}`}
            value={data.note || ''}
            onChange={e => setData({...data, note: e.target.value})}
            placeholder="점검 결과 특이사항을 입력하세요."
            readOnly={!isEditMode}
          />
        </div>
      </div>

      <style>{`
        @keyframes scale-up { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-up { animation: scale-up 0.2s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default GeneratorCheck;
