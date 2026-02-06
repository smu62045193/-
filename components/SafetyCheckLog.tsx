
import React, { useState, useEffect } from 'react';
import { SafetyCheckData, SafetyCheckMeasurements, SubstationLogData, DailyData } from '../types';
import { 
  fetchSafetyCheck, 
  saveSafetyCheck, 
  getInitialSafetyCheck, 
  fetchSubstationLog, 
  saveSubstationLog, 
  fetchDailyData, 
  saveDailyData,
  fetchStaffList
} from '../services/dataService';
import { format, subMonths, addMonths, parseISO, getDay } from 'date-fns';
import { Save, Printer, ChevronLeft, ChevronRight, RefreshCw, CheckCircle, X, Cloud, Edit2, Lock } from 'lucide-react';

interface SafetyCheckLogProps {
  currentDate: Date;
  viewType?: 'general' | 'ev';
}

const SafetyCheckLog: React.FC<SafetyCheckLogProps> = ({ currentDate, viewType }) => {
  const [activeType, setActiveType] = useState<'general' | 'ev'>(viewType || 'general');
  const [currentMonth, setCurrentMonth] = useState(format(currentDate, 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isEditMode, setIsEditMode] = useState(false);
  
  const initialDate = format(currentDate, 'yyyy-MM-dd');
  const [data, setData] = useState<SafetyCheckData>(getInitialSafetyCheck(initialDate, activeType));

  const lowVoltageItems = [
    '인입구배선', '배·분전반', '배선용차단기', '누전차단기', '개폐기', '배선', '전동기', '전열설비', '용접기', '커패시터', '조명설비', '구내전선로', '기타설비'
  ];
  const highVoltageItems = [
    '가공전선로', '지중전선로', '수배전용개폐기', '배선(모선)', '피뢰기', '변성기', '전력퓨즈', '변압기', '수·배전반', '계전기류', '차단기류', '전력용커패시터', '보호설비', '부하설비', '접지설비', '기타설비'
  ];
  const evCheckCategories = [
    { label: '인입선', items: ['전선의 종류, 굵기, 지상고 등 시설 상태 확인'] },
    { label: '배 · 분전반', items: ['설치장소, 방수 · 방습조치, 방청여부, 공간확보 구조의 적정성 확인', '전원조건, 충전부접촉 방지, 외함 접지 확인'] },
    { label: '개폐기등', items: ['전원측에 개폐기, 과전류차단기가 시설되었는지 확인', '전로에 누전차단기 동작 및 상태를 확인'] },
    { label: '옥 내 배 선 및 기 구 등', items: ['전선굵기 적정성, 사용전선, 배선방법, 접속, 전로의 절연, 이격거리 적정성 확인', '배선기구의 충전부분이 노출되었는지 확인', '습기 많은 곳, 물기 있는 곳의 저압 배선기구 방습장치 확인', '저압 배선기구에 전선 접속시 전기적 완전접속 및 접속점에 장력이 않는지 확인'] },
    { label: '충 전 시 설', items: ['충전소 설치 주변 배수시설 확인', '외함의 발청, 누수여부, 고정상태, 차량과 충전기의 충돌방지 조치확인', '충전케이블 손상여부 확인', '충전부분이 노출되지 않는지 확인', '충전장의 철대, 금속제 외함 접지 적정성 확인', '침수 등의 위험이 없는 곳에 시설하였는지, 옥외에 설치시 비, 눈에 대한 충분한 방수 보호등급을 갖는 것인지 확인', '전기자동차 전용임을 나타내는 표지를 설치하였는지 확인', '분진이 많은 장소 등에는 충전설비를 설치하지않도록 확인 다만 일반 먼지가 많은곳은 설치가능', '충전장치 시설장소에 위험표지를 설치하였는지 확인'] },
    { label: '접지연속성', items: ['충전시설과 전기자동차 간의 장치접지가 연속적으로 연결되는지 확인'] },
    { label: '시험 및 측정', items: ['절연저항 : 도전부-대지간의 절연저항 측정', '접지저항 : 충전설비 금속제 외함 등의 접지저항 측정'] }
  ];

  useEffect(() => {
    if (viewType) setActiveType(viewType);
  }, [viewType]);

  useEffect(() => {
    const newMonth = format(currentDate, 'yyyy-MM');
    if (newMonth !== currentMonth) {
      setCurrentMonth(newMonth);
      setIsEditMode(false);
    } else {
      // 서버에서 로드된 데이터(lastUpdated 존재)가 있는 경우 달력 날짜에 의해 덮어쓰지 않음
      if (data && !data.lastUpdated) {
        setData(prev => ({ ...prev, date: format(currentDate, 'yyyy-MM-dd') }));
      }
    }
  }, [currentDate]);

  useEffect(() => {
    loadData(currentMonth);
  }, [currentMonth, activeType]);

  const loadData = async (monthStr: string) => {
    setLoading(true);
    const dateKey = format(currentDate, 'yyyy-MM-dd');
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    try {
      const fetched = await fetchSafetyCheck(monthStr, activeType);
      const isNewEntry = !fetched;
      let targetData = fetched ? { ...fetched } : getInitialSafetyCheck(dateKey, activeType);
      
      // 1. 전월 의견 복사 (신규 작성 시)
      if (isNewEntry) {
        const prevMonthDate = subMonths(parseISO(`${monthStr}-01`), 1);
        const prevMonthStr = format(prevMonthDate, 'yyyy-MM');
        const prevSafety = await fetchSafetyCheck(prevMonthStr, activeType);
        if (prevSafety && prevSafety.opinion) {
          targetData.opinion = prevSafety.opinion;
        }
      }

      // 2. 점검담당자 자동 선발 (직원현황 연동)
      if (!targetData.approver) {
        const staffList = await fetchStaffList();
        const facilityStaff = staffList.filter(s => 
          s.category === '시설' && 
          (!s.resignDate || s.resignDate === '' || s.resignDate > todayStr)
        );

        const bestDeputy = facilityStaff.find(s => s.jobTitle.includes('대리') && (!s.resignDate || s.resignDate === ''));
        if (bestDeputy) {
          targetData.approver = bestDeputy.name;
        } else {
          const bestChief = facilityStaff.find(s => s.jobTitle.includes('주임'));
          if (bestChief) targetData.approver = bestChief.name;
        }
      }
      
      // 3. 수변전반 데이터 연동 (일사용분석 실적치)
      if (activeType === 'general') {
        const subData = await fetchSubstationLog(targetData.date || dateKey);
        if (subData && subData.dailyStats) {
          targetData = {
            ...targetData,
            measurements: {
              ...(targetData.measurements || getInitialSafetyCheck(targetData.date || dateKey, 'general').measurements!),
              pf: { 
                ...targetData.measurements?.pf, 
                day: subData.dailyStats.powerFactor || targetData.measurements?.pf?.day || '' 
              },
              power: {
                ...targetData.measurements?.power,
                active: subData.dailyStats.activePower || targetData.measurements?.power?.active || '',
                reactive: subData.dailyStats.reactivePower || targetData.measurements?.power?.reactive || '',
                max: subData.dailyStats.maxPower || targetData.measurements?.power?.max || '',
                multiplier: targetData.measurements?.power?.multiplier || '1200'
              }
            }
          };
        }
      }
      setData(targetData);
    } catch (e) {
      console.error(e);
      setData(getInitialSafetyCheck(dateKey, activeType));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data) return;
    setSaveStatus('loading');
    const targetDateKey = data.date || format(currentDate, 'yyyy-MM-dd');

    try {
      const success = await saveSafetyCheck(data);
      if (success) {
        if (activeType === 'general' && data.measurements) {
          const subData = await fetchSubstationLog(targetDateKey);
          if (subData) {
            const updatedSubData: SubstationLogData = {
              ...subData,
              dailyStats: {
                ...subData.dailyStats,
                activePower: data.measurements.power?.active || subData.dailyStats.activePower,
                reactivePower: data.measurements.power?.reactive || subData.dailyStats.reactivePower,
                maxPower: data.measurements.power?.max || subData.dailyStats.maxPower,
                powerFactor: data.measurements.pf?.day || subData.dailyStats.powerFactor
              }
            };
            await saveSubstationLog(updatedSubData);

            const dailyData = await fetchDailyData(targetDateKey);
            if (dailyData) {
              await saveDailyData({
                ...dailyData,
                utility: {
                  ...dailyData.utility,
                  electricity: data.measurements.power?.active || dailyData.utility.electricity
                }
              });
            }
          }
        }
        setSaveStatus('success');
        setIsEditMode(false);
        alert('저장이 완료되었습니다.');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장에 실패했습니다.');
      }
    } catch (err) {
      setSaveStatus('error');
      alert('오류가 발생했습니다.');
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('safety-check-print-area');
    if (!printContent) return;
    const inputs = printContent.querySelectorAll('input');
    inputs.forEach(input => {
      const inputEl = input as HTMLInputElement;
      if (inputEl.type === 'checkbox' || inputEl.type === 'radio') {
        if (inputEl.checked) inputEl.setAttribute('checked', 'checked');
        else inputEl.removeAttribute('checked');
      } else {
        inputEl.setAttribute('value', inputEl.value);
      }
    });
    const textareas = printContent.querySelectorAll('textarea');
    textareas.forEach(ta => {
      const taEl = ta as HTMLTextAreaElement;
      taEl.innerHTML = taEl.value;
    });
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${activeType === 'general' ? '전기설비점검결과기록표' : '전기자동차 충전시설 점검 기록표'}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; background: #f1f5f9; color: black; line-height: 1.1; -webkit-print-color-adjust: exact; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { .no-print { display: none !important; } body { background: white !important; } }
            
            .print-page { 
              width: 210mm; 
              min-height: 297mm; 
              padding: 25mm 10mm 10mm 10mm; 
              margin: 0 auto; 
              box-sizing: border-box; 
              background: white; 
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            @media print { .print-page { box-shadow: none !important; margin: 0; width: 100%; } }

            input { background: transparent !important; border: none !important; outline: none !important; color: black !important; }
            textarea { resize: none; border: none !important; outline: none !important; color: black !important; text-align: left !important; }
            table, th, td { border: 1px solid black !important; color: black !important; border-collapse: collapse !important; }
            .flex-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; min-height: 0; }
            .title-box { flex: 1; text-align: center; }
            .doc-title { font-size: 24pt; font-weight: 900; margin: 0; text-decoration: underline; text-underline-offset: 8px; }
            .approval-table { width: 50mm !important; border: 1px solid black !important; border-collapse: collapse !important; table-layout: fixed !important; margin-left: auto; }
            .approval-table th { height: 22px !important; font-size: 8.5pt !important; background-color: #f3f4f6 !important; font-weight: bold; border: 1px solid black !important; text-align: center; }
            .approval-table td { height: 65px !important; border: 1px solid black !important; background: white !important; }
            .approval-table .side-header { width: 28px !important; font-size: 8.5pt; text-align: center; }
            
            .print-header-area { display: flex !important; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
          <div class="print-page">${printContent.innerHTML}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const updateResult = (category: string, content: string, result: '적합' | '부적합' | '요주의' | '해당없음') => {
    if (!data) return;
    const existingIdx = (data.items || []).findIndex(i => i.category === category && i.content === content);
    let newItems = [...(data.items || [])];
    if (existingIdx >= 0) newItems[existingIdx] = { ...newItems[existingIdx], result };
    else newItems.push({ id: Math.random().toString(), category, content, result, measure: '' });
    setData({ ...data, items: newItems });
  };

  const updateMeasurement = (section: keyof SafetyCheckMeasurements, field: string, value: string) => {
    if (!data || !data.measurements) return;
    const newMeasurements = { ...data.measurements };
    const sectionObj = newMeasurements[section];
    if (sectionObj) {
      // @ts-ignore
      newMeasurements[section] = { ...sectionObj, [field]: value };
      setData({ ...data, measurements: newMeasurements });
    }
  };

  const updateApprover = (val: string) => { if (data) setData({ ...data, approver: val }); };
  const updateOpinion = (val: string) => { if (data) setData({ ...data, opinion: val }); };
  const getResult = (category: string, content: string) => data?.items?.find(i => i.category === category && i.content === content)?.result || '';

  const handleGeneralClick = (category: string, content: string) => {
    if (!isEditMode) return;
    const current = getResult(category, content);
    let next: '적합' | '부적합' | '해당없음' = '적합';
    if (current === '' || current === '적합') next = '부적합';
    else if (current === '부적합') next = '해당없음';
    else if (current === '해당없음') next = '적합';
    updateResult(category, content, next);
  };

  /**
   * Defined handlePrevMonth to correctly navigate to the previous month.
   */
  const handlePrevMonth = () => {
    setCurrentMonth(prev => format(subMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'));
  };

  /**
   * Defined handleNextMonth to correctly navigate to the next month.
   */
  const handleNextMonth = () => {
    setCurrentMonth(prev => format(addMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'));
  };

  const [year, month] = currentMonth.split('-');
  const inputClass = "w-full h-full text-center border-none outline-none bg-white text-black text-[10px] p-0 font-medium disabled:bg-gray-50 disabled:text-gray-400";
  const headerClass = "border border-gray-300 bg-gray-50 text-center font-bold text-[10px] p-1 text-gray-700";
  const cellClass = "border border-gray-300 p-0 h-7 align-middle text-center text-[10px] text-gray-800 bg-white";

  const HeaderSection = ({ title }: { title: string }) => (
    <div className="flex-header print-header-area hidden print:flex mb-1">
      <div className="title-box"><h1 className="doc-title">{title}</h1></div>
      <table className="approval-table" style={{ width: '50mm' }}>
        <tbody>
          <tr><th rowSpan={2} className="side-header border border-black bg-gray-50">결<br/>재</th><th className="border border-black bg-gray-50 h-5 text-xs">과 장</th><th className="border border-black bg-gray-50 h-5 text-xs">소 장</th></tr>
          <tr><td className="border border-black h-[65px]"></td><td className="border border-black h-[65px]"></td></tr>
        </tbody>
      </table>
    </div>
  );

  const renderGeneralForm = () => (
    <div className="p-0 bg-white text-black w-full break-before-page">
      <HeaderSection title="전기설비점검결과기록표" />
      <div className="mb-2 text-base font-bold bg-white text-gray-900">설비명(상호) : 새마을운동 중앙회 대치동 사옥</div>
      <div className="mb-2 bg-white">
        <h3 className="font-bold text-base mb-1 border-l-4 border-gray-800 pl-2">1. 기본사항</h3>
        <table className="w-full border-collapse border border-gray-300 text-center text-[11px] bg-white">
          <tbody>
            <tr className="h-7"><td className="border border-gray-300 bg-gray-50 font-bold w-[12%] text-gray-700">수전전압/용량</td><td className="border border-gray-300 w-[22%] bg-white">22900 V / 1600 kW</td><td className="border border-gray-300 bg-gray-50 font-bold w-[12%] text-gray-700">발전전압/용량</td><td className="border border-gray-300 w-[22%] bg-white">380V / 500 kW</td><td className="border border-gray-300 bg-gray-50 font-bold w-[10%] text-gray-700">태양광</td><td className="border border-gray-300 w-[22%] text-right pr-2 bg-white">kW</td></tr>
            <tr className="h-7">
              <td className="border border-gray-300 bg-gray-50 font-bold text-gray-700">점검일자</td>
              <td className="border border-gray-300 p-0 bg-white">
                {isEditMode ? (
                  <input 
                    type="date" 
                    value={data.date || format(currentDate, 'yyyy-MM-dd')} 
                    onChange={e => setData({...data, date: e.target.value})}
                    className="w-full h-full text-center outline-none bg-blue-50 font-bold text-blue-700 text-[11px]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center font-bold bg-white text-[12px] text-blue-600">
                    {data.date ? format(parseISO(data.date), 'yyyy년 MM월 dd일') : format(currentDate, 'yyyy년 MM월 dd일')}
                  </div>
                )}
              </td>
              <td className="border border-gray-300 bg-gray-50 font-bold text-gray-700">점검종별</td><td className="border border-gray-300 bg-white text-gray-800">월차</td><td className="border border-gray-300 bg-gray-50 font-bold text-gray-700">점검횟수</td><td className="border border-gray-300 bg-white text-gray-800">1회</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mb-2 bg-white">
        <h3 className="font-bold text-base mb-1 border-l-4 border-gray-800 pl-2">2. 점검내역</h3>
        <div className="flex gap-2 bg-white">
          <div className="flex-1">
            <table className="w-full border-collapse border border-gray-300 text-center bg-white">
              <thead><tr className="h-7 bg-white"><th className={headerClass} rowSpan={2} style={{width:'35%'}}>저압 및 발전설비</th><th className={headerClass} rowSpan={2} style={{width:'15%'}}>판정</th><th className={headerClass} colSpan={2}>설비현황</th><th className={headerClass}>부적합</th><th className={headerClass} colSpan={2}>개 수</th></tr><tr className="h-6 bg-white text-[9px]"><th className={headerClass}>증</th><th className={headerClass}>감</th><th className={headerClass}>수량</th><th className={headerClass}>수량</th><th className={headerClass}>구분</th></tr></thead>
              <tbody>
                {Array.from({ length: 16 }).map((_, i) => {
                  let itemName = '';
                  if (i < 13) itemName = lowVoltageItems[i]; 
                  else if (i === 13) itemName = '발전기'; 
                  else if (i === 14) itemName = '차단장치'; 
                  else if (i === 15) itemName = '측정장치';
                  const res = getResult('low', itemName);
                  const isNA = res === '해당없음' || (!res && itemName === '커패시터');
                  const displayRes = res === '부적합' ? 'X' : (isNA ? '/' : (itemName ? 'O' : ''));
                  return (<tr key={i} className="h-6 bg-white"><td className={cellClass}>{itemName}</td><td className={`${cellClass} font-black transition-colors bg-white ${isEditMode ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'} ${displayRes === 'X' ? 'text-red-600' : 'text-blue-700'}`} onClick={() => handleGeneralClick('low', itemName)}>{displayRes}</td><td className={cellClass}></td><td className={cellClass}></td><td className={cellClass}></td><td className={cellClass}></td><td className={cellClass}></td></tr>);
                })}
              </tbody>
            </table>
          </div>
          <div className="flex-1">
            <table className="w-full border-collapse border border-gray-300 text-center bg-white">
              <thead><tr className="h-7 bg-white"><th className={headerClass} rowSpan={2} style={{width:'30%'}}>특고압설비</th><th className={headerClass} rowSpan={2} style={{width:'15%'}}>판정</th><th className={headerClass} colSpan={2}>설비현황</th><th className={headerClass}>부적합</th><th className={headerClass} colSpan={2}>개 수</th></tr><tr className="h-6 bg-white text-[9px]"><th className={headerClass}>증</th><th className={headerClass}>감</th><th className={headerClass}>수량</th><th className={headerClass}>수량</th><th className={headerClass}>구분</th></tr></thead>
              <tbody>
                {highVoltageItems.map((item, i) => {
                  const res = getResult('high', item);
                  const isNA = res === '해당없음' || (!res && (item === '가공전선로' || item === '전력용커패시터'));
                  const displayRes = res === '부적합' ? 'X' : (isNA ? '/' : (item ? 'O' : ''));
                  return (<tr key={i} className="h-6 bg-white"><td className={cellClass}>{item}</td><td className={`${cellClass} font-black transition-colors bg-white ${isEditMode ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'} ${displayRes === 'X' ? 'text-red-600' : 'text-blue-700'}`} onClick={() => handleGeneralClick('high', item)}>{displayRes}</td><td className={cellClass}></td><td className={cellClass}></td><td className={cellClass}></td><td className={cellClass}></td><td className={cellClass}></td></tr>);
                })}
              </tbody>
            </table>
          </div>
          <div className="flex-1">
            <table className="w-full border-collapse border border-gray-300 text-center bg-white" style={{ tableLayout: 'fixed' }}>
              <thead><tr className="h-7 bg-white"><th className={headerClass} colSpan={2} style={{ width: '40%' }}>구 분</th><th className={headerClass} style={{ width: '20%' }}>전압(V)</th><th className={headerClass} style={{ width: '20%' }}>전류(A)</th><th className={headerClass} style={{ width: '20%' }}>누설전류(mA)</th></tr></thead>
              <tbody>
                {['LV-1', 'LV-3', 'LV-5'].map((loc) => (<React.Fragment key={loc}>{['R', 'S', 'T', 'N'].map((phase, pIdx) => {
                      const mKey = loc.toLowerCase().replace('-', '') as 'lv1' | 'lv3' | 'lv5';
                      const vField = `v_${phase.toLowerCase()}`; const iField = `i_${phase.toLowerCase()}`; const lField = `l_${phase.toLowerCase()}`;
                      const mData = data.measurements?.[mKey];
                      return (
                        <tr key={phase} className="h-6 bg-white">
                          {pIdx === 0 && <td rowSpan={4} className={`${cellClass} bg-gray-50 font-bold text-gray-700`} style={{ width: '20%' }}>측정개소:<br/>{loc}<br/>ACB</td>}
                          <td className={`${cellClass} font-bold bg-white text-gray-600`} style={{ width: '20%' }}>{phase}</td>
                          <td className={cellClass}>
                            <input 
                              type="text" 
                              className={`${inputClass} ${isEditMode ? 'bg-orange-50 focus:bg-orange-100' : ''}`} 
                              value={(mData as any)?.[vField] || ''} 
                              onChange={e => updateMeasurement(mKey, vField, e.target.value)} 
                              readOnly={!isEditMode}
                            />
                          </td>
                          <td className={cellClass}>
                            <input 
                              type="text" 
                              className={`${inputClass} ${isEditMode ? 'bg-orange-50 focus:bg-orange-100' : ''}`} 
                              value={(mData as any)?.[iField] || ''} 
                              onChange={e => updateMeasurement(mKey, iField, e.target.value)} 
                              readOnly={!isEditMode}
                            />
                          </td>
                          <td className={cellClass}>
                            <input 
                              type="text" 
                              className={`${inputClass} font-bold text-blue-600 ${isEditMode ? 'bg-orange-50' : ''}`} 
                              value={(mData as any)?.[lField] || '양호'} 
                              onChange={e => updateMeasurement(mKey, lField, e.target.value)} 
                              readOnly={!isEditMode}
                            />
                          </td>
                        </tr>
                      );
                    })}</React.Fragment>))}
                <tr className="h-6 bg-white"><td className={`${cellClass} font-bold bg-gray-50 text-gray-700`}>역율(%)</td><td className={`${cellClass} font-bold bg-white text-gray-600`}>주간</td><td className={cellClass}><input type="text" className={`${inputClass} ${isEditMode ? 'bg-orange-50' : ''}`} value={data.measurements?.pf?.day || ''} onChange={e => updateMeasurement('pf', 'day', e.target.value)} readOnly={!isEditMode} /></td><td className={`${cellClass} font-bold bg-white text-gray-600`}>심야</td><td className={cellClass}><input type="text" className={`${inputClass} ${isEditMode ? 'bg-orange-50' : ''}`} value={data.measurements?.pf?.night || ''} onChange={e => updateMeasurement('pf', 'night', e.target.value)} readOnly={!isEditMode} /></td></tr>
                <tr className="h-6 bg-white"><td colSpan={2} className={`${cellClass} font-bold bg-gray-50 text-gray-700`}>유효전력량</td><td colSpan={3} className={cellClass}><input type="text" className={`${inputClass} font-black text-gray-900 ${isEditMode ? 'bg-orange-50' : ''}`} value={data.measurements?.power?.active || ''} onChange={e => updateMeasurement('power', 'active', e.target.value)} readOnly={!isEditMode} /></td></tr>
                <tr className="h-6 bg-white"><td colSpan={2} className={`${cellClass} font-bold bg-gray-50 text-gray-700`}>무효전력량</td><td colSpan={3} className={cellClass}><input type="text" className={`${inputClass} ${isEditMode ? 'bg-orange-50' : ''}`} value={data.measurements?.power?.reactive || ''} onChange={e => updateMeasurement('power', 'reactive', e.target.value)} readOnly={!isEditMode} /></td></tr>
                <tr className="h-6 bg-white"><td colSpan={2} className={`${cellClass} font-bold bg-gray-50 text-gray-700`}>최대전력</td><td className={cellClass}><input type="text" className={`${inputClass} font-black text-red-600 ${isEditMode ? 'bg-orange-50' : ''}`} value={data.measurements?.power?.max || ''} onChange={e => updateMeasurement('power', 'max', e.target.value)} readOnly={!isEditMode} /></td><td className={`${cellClass} font-bold bg-white text-gray-600`}>배율</td><td className={cellClass}><input type="text" className={`${inputClass} ${isEditMode ? 'bg-orange-50' : ''}`} value={data.measurements?.power?.multiplier || ''} onChange={e => updateMeasurement('power', 'multiplier', e.target.value)} readOnly={!isEditMode} /></td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[9px] mt-1 bg-white text-gray-500 font-medium">※ 점검결과의 판정은 O(적합), X(부적합), /(해당없음)으로 표시한다. (판정 칸 클릭 시 전환)</p>
      </div>
      <div className="mb-2 bg-white">
        <h3 className="font-bold text-base mb-1 border-l-4 border-gray-800 pl-2">3. 종합의견</h3>
        <div className={`border border-gray-300 min-h-[80px] bg-white w-full ${isEditMode ? 'ring-2 ring-orange-200' : ''}`}><textarea className={`w-full h-[80px] p-3 outline-none text-[12px] leading-tight bg-white font-medium text-gray-800 transition-colors ${isEditMode ? 'bg-orange-50 focus:bg-orange-100' : ''}`} style={{ textAlign: 'left' }} value={data.opinion || ''} onChange={(e) => updateOpinion(e.target.value)} readOnly={!isEditMode} placeholder="종합의견을 입력하세요."></textarea></div>
      </div>
      <div className="text-[10px] mb-2 bg-white text-red-600 font-bold">※ 전기설비의 개,보수 작업은 반드시 정전상태에서 시행하시기 바랍니다.</div>
      <div className="flex justify-end mt-2 bg-white">
        <table className="border-collapse border border-gray-300 w-[420px] bg-white shadow-sm"><tbody><tr className="h-9"><td className="border border-gray-300 bg-gray-50 font-bold w-12 text-center text-xs text-gray-600">확인</td><td className="border border-gray-300 bg-gray-50 font-bold w-24 text-center text-xs text-gray-600">점검담당자</td><td className="border border-gray-300 p-0 bg-white min-w-[120px]"><input type="text" className={`w-full h-full text-center outline-none bg-white font-black text-sm text-blue-700 ${isEditMode ? 'bg-orange-50' : ''}`} value={data?.approver || ''} onChange={e => updateApprover(e.target.value)} readOnly={!isEditMode} placeholder="성명 입력" /></td><td className="border border-gray-300 bg-white font-bold w-12 text-center text-xs text-gray-500">(인)</td></tr></tbody></table>
      </div>
    </div>
  );

  const renderEVForm = () => (
    <div className="p-0 bg-white text-black w-full break-before-page">
      <HeaderSection title="전기자동차 충전시설 점검 기록표" />
      <div className="text-right font-bold text-[12pt] mt-2 mb-1">
        점검일자 : {isEditMode ? (
          <input 
            type="date" 
            value={data.date || format(currentDate, 'yyyy-MM-dd')} 
            onChange={e => setData({...data, date: e.target.value})}
            className="border border-blue-200 bg-orange-50 px-2 py-0.5 rounded outline-none font-bold text-blue-700"
          />
        ) : (
          <span className="text-blue-600">{data.date ? format(parseISO(data.date), 'yyyy년 MM월 dd일') : format(currentDate, 'yyyy년 MM월 dd일')}</span>
        )}
      </div>
      <div className="mb-1.5">
        <h3 className="text-[14px] font-bold mb-1 border-l-4 border-gray-800 pl-2">1.점검자/확인사항</h3>
        <table className="w-full border-collapse border border-gray-300 text-[11px] bg-white"><tbody><tr className="h-[20px]"><td className="border border-gray-300 bg-gray-50 font-bold w-[15%] text-center text-gray-700">점검자(소속)</td><td className="border border-gray-300 w-[35%] text-center font-medium">새마을운동중앙회 대치동 사옥</td><td className="border border-gray-300 bg-gray-50 font-bold text-center text-gray-700">성 명</td><td className="border border-gray-300 w-[35%] p-0"><input type="text" className={`w-full h-full text-center outline-none bg-white font-black text-blue-700 ${isEditMode ? 'bg-orange-50' : ''}`} value={data?.approver || ''} onChange={e => updateApprover(e.target.value)} readOnly={!isEditMode} placeholder="(서명)" /></td></tr><tr className="h-[20px]"><td className="border border-gray-300 bg-gray-50 font-bold text-center text-gray-700">설 치 장 소</td><td className="border border-gray-300 text-center font-medium">B5F 주차장</td><td className="border border-gray-300 bg-gray-50 font-bold text-center text-gray-700">전기설비전압/용량</td><td className="border border-gray-300 text-center font-medium">22900 [V] / 1600 [kW]</td></tr></tbody></table>
      </div>
      <div className="mb-1.5">
        <h3 className="text-[14px] font-bold mb-1 border-l-4 border-gray-800 pl-2">2.충전시설/충전기사양</h3>
        <table className="w-full border-collapse border border-gray-300 text-[11px] bg-white"><tbody><tr className="h-[20px]"><td className="border border-gray-300 bg-gray-50 font-bold w-[15%] text-center text-gray-700">설치기수</td><td className="border border-gray-300 w-[35%] text-center font-medium">( 7 )kW ( 3 )기</td><td className="border border-gray-300 bg-gray-50 font-bold w-[15%] text-center text-gray-700">전압/용량</td><td className="border border-gray-300 w-[20%] text-center font-medium">220V 32A 60A</td><td className="border border-gray-300 bg-gray-50 font-bold w-[7%] text-center text-gray-700">대수</td><td className="border border-gray-300 w-[8%] text-center font-medium">3 EA</td></tr><tr className="h-[20px]"><td className="border border-gray-300 bg-gray-50 font-bold text-center text-gray-700">설치위치</td><td className="border border-gray-300"><div className="flex justify-center gap-4"><label className="flex items-center gap-1 font-medium"><input type="checkbox" checked readOnly /> 옥내</label><label className="flex items-center gap-1 font-medium"><input type="checkbox" /> 옥외</label><label className="flex items-center gap-1 font-medium text-gray-400"> 기타( )</label></div></td><td className="border border-gray-300 bg-gray-50 font-bold text-center text-gray-700">제조사</td><td className="border border-gray-300 text-center font-bold" colSpan={3}>(주) 에바</td></tr><tr className="h-[20px]"><td className="border border-gray-300 bg-gray-50 font-bold text-center text-gray-700">충전형식</td><td className="border border-gray-300"><div className="flex justify-center gap-4"><label className="flex items-center gap-1 font-medium"><input type="checkbox" /> DC차데모</label><label className="flex items-center gap-1 font-medium"><input type="checkbox" /> DC콤보</label><label className="flex items-center gap-1 font-medium"><input type="checkbox" checked readOnly /> AC단상</label></div></td><td className="border border-gray-300 bg-gray-50 font-bold text-center text-gray-700">모델명(일련번호)</td><td className="border border-gray-300 text-center font-medium" colSpan={3}>ELA007C01(EV-SCA-33283)</td></tr></tbody></table>
      </div>
      <div className="mb-1.5">
        <h3 className="text-[14px] font-bold mb-1 border-l-4 border-gray-800 pl-2">3.점검내용</h3>
        <table className="w-full border-collapse border border-gray-300 text-[9px] bg-white"><thead><tr className="bg-gray-50 h-[20px]"><th className="border border-gray-300 w-32 font-bold text-center text-gray-700">구 분</th><th className="border border-gray-300 font-bold text-center text-gray-700">점 검 항 목</th><th className="border border-gray-300 w-16 font-bold text-center text-gray-700">점검결과</th><th className="border border-gray-300 w-16 font-bold text-center text-gray-700">비 고</th></tr></thead>
          <tbody>
            {evCheckCategories.map((cat, catIdx) => (cat.items.map((itemText, itemIdx) => {
                const res = getResult('ev', itemText);
                const displayRes = res === '부적합' ? 'X' : (res === '해당없음' ? '/' : 'O');
                return (
                  <tr key={`ev-${catIdx}-${itemIdx}`} className="bg-white hover:bg-gray-50/50 transition-colors h-[20px]">
                    {itemIdx === 0 && <td rowSpan={cat.items.length} className="border border-gray-300 p-1.5 font-bold align-middle text-center bg-gray-50 text-gray-700">{cat.label}</td>}
                    <td className="border border-gray-300 p-1.5 text-left pl-4 font-medium text-gray-800">{itemText}</td>
                    <td 
                      className={`border border-gray-300 p-0 text-base font-black text-center align-middle transition-colors bg-white ${isEditMode ? 'cursor-pointer hover:bg-orange-50' : ''} ${displayRes === 'X' ? 'text-red-600' : 'text-blue-600'}`}
                      onClick={() => isEditMode && handleGeneralClick('ev', itemText)}
                    >
                      {displayRes}
                    </td>
                    <td className="border border-gray-300 p-0">
                      <input 
                        type="text" 
                        className={`w-full h-full text-center outline-none bg-transparent p-1 text-[9px] font-medium ${isEditMode ? 'bg-orange-50' : ''}`} 
                        value={data?.items?.find(i => i.category === 'ev' && i.content === itemText)?.measure || ''} 
                        onChange={(e) => { 
                          const existingIdx = (data.items || []).findIndex(i => i.category === 'ev' && i.content === itemText); 
                          let newItems = [...(data.items || [])]; 
                          if (existingIdx >= 0) newItems[existingIdx].measure = e.target.value; 
                          else newItems.push({ id: Math.random().toString(), category: 'ev', content: itemText, result: '적합', measure: e.target.value }); 
                          setData({ ...data, items: newItems }); 
                        }} 
                        readOnly={!isEditMode}
                      />
                    </td>
                  </tr>
                );
            })))}
          </tbody>
        </table>
      </div>
      <div className="mb-1.5">
        <div className="flex items-baseline gap-3 mb-1">
          <h3 className="text-[14px] font-bold border-l-4 border-gray-800 pl-2">4.종합의견</h3>
          <span className="text-[10px] font-normal text-gray-500">[비고] 점검결과는 ○(적합), ×(부적합), /(해당없음) 으로 표기</span>
        </div>
        <div className={`border border-gray-300 min-h-[60px] bg-white w-full ${isEditMode ? 'ring-2 ring-orange-200' : ''}`}>
          <textarea 
            className={`w-full h-[60px] p-3 outline-none text-[12px] font-medium text-gray-800 leading-tight transition-colors ${isEditMode ? 'bg-orange-50 focus:bg-orange-100' : 'bg-white'}`} 
            style={{ textAlign: 'left' }} 
            value={data.opinion || ''} 
            onChange={(e) => updateOpinion(e.target.value)}
            readOnly={!isEditMode}
            placeholder="종합의견을 입력하세요."
          ></textarea>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6 bg-white rounded-xl border border-gray-200 shadow-sm transition-all duration-300 print:shadow-none print:border-none print:p-0">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4 print:hidden bg-white">
        <div className="flex items-center space-x-4 bg-white">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-full bg-white transition-colors"><ChevronLeft /></button>
          <h2 className="text-2xl font-bold text-gray-800 bg-white">{year}년 {month}월</h2>
          <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-full bg-white transition-colors"><ChevronRight /></button>
        </div>
        <div className="flex gap-2 bg-white">
          <button onClick={() => loadData(currentMonth)} disabled={loading} className="flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200 transition-all text-sm disabled:opacity-50"><RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />새로고침</button>
          
          <button 
            onClick={() => setIsEditMode(!isEditMode)} 
            className={`flex items-center px-4 py-2 rounded-lg font-bold shadow-sm transition-all text-sm ${isEditMode ? 'bg-orange-50 text-white hover:bg-orange-600' : 'bg-gray-700 text-white hover:bg-gray-800'}`}
          >
            {isEditMode ? <Lock size={18} className="mr-2" /> : <Edit2 size={18} className="mr-2" />}
            {isEditMode ? '수정 취소' : '수정'}
          </button>

          <button onClick={handleSave} disabled={saveStatus === 'loading'} className={`flex items-center px-4 py-2 rounded-lg font-bold shadow-sm transition-all ${saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:bg-blue-400 active:scale-95`}>{saveStatus === 'loading' ? <RefreshCw size={18} className="mr-2 animate-spin" /> : saveStatus === 'success' ? <CheckCircle size={18} className="mr-2" /> : <Save size={18} className="mr-2" />} {saveStatus === 'success' ? '저장완료' : '서버 저장'}</button>
          
          <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 font-bold shadow-sm transition-colors text-sm"><Printer size={18} className="mr-2" />미리보기</button>
        </div>
      </div>
      {!viewType && (
        <div className="flex space-x-2 border-b border-gray-200 pb-1 print:hidden bg-white">
          <button onClick={() => setActiveType('general')} className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeType === 'general' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>전기설비점검</button>
          <button onClick={() => setActiveType('ev')} className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeType === 'ev' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>전기자동차</button>
        </div>
      )}
      <div id="safety-check-print-area" className="flex flex-col bg-white">
        {activeType === 'general' ? renderGeneralForm() : renderEVForm()}
      </div>
      <style>{` @keyframes scale-up { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } } .animate-scale-up { animation: scale-up 0.2s ease-out forwards; } @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } } .animate-fade-in { animation: fade-in 0.2s ease-out forwards; } `}</style>
    </div>
  );
};

export default SafetyCheckLog;
