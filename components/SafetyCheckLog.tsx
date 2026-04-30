
import React, { useState, useEffect } from 'react';
import { SafetyCheckData, SafetyCheckMeasurements, SubstationLogData, DailyData, SafetyCheckSpecs } from '../types';
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
import { Save, Printer, ChevronLeft, ChevronRight, RefreshCw, CheckCircle, X, Cloud, Edit2, Lock, CheckCircle2 } from 'lucide-react';

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
  const [activeSubTab, setActiveSubTab] = useState(viewType === 'ev' ? 'ev-basic' : 'basic');
  
  const initialDate = format(currentDate, 'yyyy-MM-dd');
  const [data, setData] = useState<SafetyCheckData>(getInitialSafetyCheck(initialDate, activeType));

  const DEFAULT_OPINION = ` 1.수변전실 정류기반 배터리(9EA),비상발전기 배터리(2EA) 교체주기3년 경과 추후 교체요망\n 2.수변전실,전압계,역율계,주파수계 및 스위치노후화로 인한 계측 불량,추후 교체요망\n 3.고압측 ATS배터리 추후 교체요망`;

  const GENERAL_SUB_TABS = [
    { id: 'basic', label: '기본사항' },
    { id: 'low', label: '저압및발전설비' },
    { id: 'high', label: '특고압설비' },
    { id: 'check', label: '점검' },
    { id: 'opinion', label: '종합의견' },
  ];

  const EV_SUB_TABS = [
    { id: 'ev-basic', label: '기본사항' },
    { id: 'ev-facility', label: '충전시설' },
    { id: 'ev-content', label: '점검내용' },
    { id: 'ev-opinion', label: '종합의견' },
  ];

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
    { label: "옥내배선 및\n기구등", items: ['전선굵기 적정성, 사용전선, 배선방법, 접속, 전로의 절연, 이격거리 적정성 확인', '배선기구의 충전부분이 노출되었는지 확인', '습기 많은 곳, 물기 있는 곳의 저압 배선기구 방습장치 확인', '저압 배선기구에 전선 접속시 전기적 완전접속 및 접속점에 장력이 않는지 확인'] },
    { label: '충 전 시 설', items: ['충전소 설치 주변 배수시설 확인', '외함의 발청, 누수여부, 고정상태, 차량과 충전기의 충돌방지 조치확인', '충전케이블 손상여부 확인', '충전부분이 노출되지 않는지 확인', '충전장의 철대, 금속제 외함 접지 적정성 확인', '침수 등의 위험이 없는 곳에 시설하였는지, 옥외에 설치시 비, 눈에 대한 충분한 방수 보호등급을 갖는 것인지 확인', '전기자동차 전용임을 나타내는 표지를 설치하였는지 확인', '분진이 많은 장소 등에는 충전설비를 설치하지않도록 확인 다만 일반 먼지가 많은곳은 설치가능', '충전장치 시설장소에 위험표지를 설치하였는지 확인'] },
    { label: '접지연속성', items: ['충전시설과 전기자동차 간의 장치접지가 연속적으로 연결되는지 확인'] },
    { label: '시험 및 측정', items: ['절연저항 : 도전부-대지간의 절연저항 측정', '접지저항 : 충전설비 금속제 외함 등의 접지저항 측정'] }
  ];

  useEffect(() => {
    if (viewType) {
      setActiveType(viewType);
      setActiveSubTab(viewType === 'ev' ? 'ev-basic' : 'basic');
    }
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
            body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; background: black; color: black; line-height: 1.1; -webkit-print-color-adjust: exact; }
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

            /* 미리보기/인쇄 시 모서리 직각 강제 적용 */
            .print-page * { border-radius: 0 !important; }
            .print-page .rounded-xl { border-radius: 0 !important; }
            
            /* 미리보기/인쇄 시 테이블 스타일 강제 고정 (원래 높이 및 테두리) */
            .print-page table { border: 1px solid black !important; border-collapse: collapse !important; }
            .print-page th { padding: 4px !important; height: 28px !important; border: 1px solid black !important; }
            .print-page td { padding: 0 !important; height: 28px !important; border: 1px solid black !important; }
            
            /* 우측 정렬 보정 */
            .print-page .justify-end { display: flex !important; justify-content: flex-end !important; }
            .print-no-border { border: none !important; }

            input { background: transparent !important; border: none !important; outline: none !important; color: black !important; text-align: center !important; }
            textarea { resize: none; border: none !important; outline: none !important; color: black !important; text-align: left !important; }
            table, th, td { border: 1px solid black !important; color: black !important; border-collapse: collapse !important; font-size: 9px !important; text-align: center !important; }
            .bg-gray-50, .bg-gray-100, .bg-gray-200 { background-color: white !important; }
            .flex-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; min-height: 0; }
            .title-box { flex: 1; text-align: center; }
            .doc-title { font-size: 24pt; font-weight: 900; margin: 0; text-decoration: underline; text-underline-offset: 8px; }
            .approval-table { width: 50mm !important; border: 1px solid black !important; border-collapse: collapse !important; table-layout: fixed !important; margin-left: auto; }
            .approval-table th { height: 22px !important; font-size: 8.5pt !important; background-color: white !important; font-weight: normal; border: 1px solid black !important; text-align: center; }
            .approval-table td { height: 65px !important; border: 1px solid black !important; background: white !important; }
            .approval-table .side-header { width: 28px !important; font-size: 8.5pt; text-align: center; }
            .print-page div { min-width: auto !important; border-color: black !important; }
            .print-page div.border, .print-page div.border-gray-300 { border-width: 1px !important; border-color: black !important; }
            
            ${activeType === 'ev' ? `
              .print-page .ev-table-1 tr.h-\\[40px\\], .print-page .ev-table-2 tr.h-\\[40px\\] { height: 23px !important; } 
              .print-page .ev-table-1 td, .print-page .ev-table-1 th, .print-page .ev-table-2 td, .print-page .ev-table-2 th { 
                padding: 1px !important; 
                line-height: 1 !important; 
                height: 23px !important;
                vertical-align: middle !important;
                font-size: 10px !important;
              } 
              .print-page .ev-table-1 input, .print-page .ev-table-2 input { 
                padding: 0 !important; 
                height: 21px !important; 
                font-size: 10px !important; 
                line-height: 1 !important;
                margin: 0 !important;
                text-align: center !important;
              }

              .print-page .ev-table-3 tr.h-\\[40px\\] { height: 23px !important; } 
              .print-page .ev-table-3 td, .print-page .ev-table-3 th { 
                padding: 1px !important; 
                line-height: 1 !important; 
                height: 23px !important;
                vertical-align: middle !important;
                font-size: 10px !important;
              } 
              .print-page .ev-table-3 input { 
                padding: 0 !important; 
                height: 21px !important; 
                font-size: 10px !important; 
                line-height: 1 !important;
                margin: 0 !important;
                text-align: center !important;
              }

              .print-page .flex { gap: 4px !important; } 
              .print-page .opinion-row { height: 50px !important; min-height: 50px !important; } 
              .print-page .opinion-textarea { 
                height: 50px !important; 
                min-height: 50px !important; 
                padding: 4px !important; 
                font-size: 10px !important;
                line-height: 1.2 !important;
              }
              .print-page .approval-table th { height: 22px !important; font-size: 8.5pt !important; } 
              .print-page .approval-table td { height: 65px !important; } 
              .print-page .approval-table .side-header { height: 87px !important; font-size: 8.5pt !important; }
            ` : ''}
            ${activeType === 'general' ? '.print-page .text-\\[13px\\] { font-size: 10px !important; } .print-page .text-\\[12px\\] { font-size: 10px !important; } .print-page textarea { font-size: 10px !important; } .print-page input { font-size: 10px !important; text-align: center !important; } .print-page .text-blue-600 { font-size: 13px !important; } .print-page .check-section-2 th, .print-page .check-section-2 td, .print-page .check-section-2 div { font-size: 9px !important; } .print-page .check-section-2 input { padding-left: 4px !important; padding-right: 4px !important; }' : ''}

            .print-header-area { display: flex !important; }
            .hidden-in-ui { display: block !important; }
            .print\\:hidden { display: none !important; }
            .print\\:block { display: block !important; }
            .print\\:flex { display: flex !important; }
            .print\\:flex-row { flex-direction: row !important; }
            .print\\:border-none { border: none !important; }
            .print\\:rounded-none { border-radius: 0 !important; }
            .print\\:shadow-none { box-shadow: none !important; }
            .print\\:border { border-width: 1px !important; border-style: solid !important; }
            .print\\:border-black { border-color: black !important; }
            .print\\:border-b-0 { border-bottom-width: 0 !important; }
            .print\\:max-w-none { max-width: none !important; }
            .print\\:p-0 { padding: 0 !important; }
            .print\\:p-1 { padding: 0.25rem !important; }
            .print\\:py-0 { padding-top: 0 !important; padding-bottom: 0 !important; }
            .print\\:h-7 { height: 1.75rem !important; }
            .print\\:w-1\\/2 { width: 50% !important; }
            .print\\:w-\\[40\\%\\] { width: 40% !important; }
            .print\\:w-\\[20\\%\\] { width: 20% !important; }
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
    const newItems = [...(data.items || [])];
    if (existingIdx >= 0) newItems[existingIdx] = { ...newItems[existingIdx], result };
    else newItems.push({ id: Math.random().toString(), category, content, result, measure: '' });
    setData({ ...data, items: newItems });
  };

  const updateMeasurement = (section: keyof SafetyCheckMeasurements, field: string, value: string) => {
    if (!data || !data.measurements) return;
    const newMeasurements = { ...data.measurements };
    const sectionObj = newMeasurements[section];
    if (sectionObj) {
      // @ts-expect-error: dynamic field assignment
      newMeasurements[section] = { ...sectionObj, [field]: value };
      setData({ ...data, measurements: newMeasurements });
    }
  };

  const updateApprover = (val: string) => { if (data) setData({ ...data, approver: val }); };
  const updateOpinion = (val: string) => { if (data) setData({ ...data, opinion: val }); };
  const handleSpecChange = (field: keyof SafetyCheckSpecs, value: string) => {
    if (!data) return;
    setData({
      ...data,
      specs: {
        ...data.specs,
        [field]: value
      }
    });
  };
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
  const inputClass = "w-full h-full text-center bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal px-2 text-black";
  const headerClass = "border-b border-r border-black bg-white text-center font-normal text-[13px] text-black whitespace-nowrap h-[36px] p-0";
  const cellClass = "border-b border-r border-black text-center text-[13px] text-black bg-white h-[36px] p-0 font-normal";

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
      <div className="mb-2 text-base font-bold bg-white text-gray-900 hidden print:block">설비명(상호) : 새마을운동 중앙회 대치동 사옥</div>

      <div className={`mb-2 bg-white ${activeSubTab === 'basic' ? 'block' : 'hidden-in-ui'} print:block`}>
        <h3 className="font-bold text-base mb-1 border-l-4 border-gray-800 pl-2 hidden-in-ui">1. 기본사항</h3>
        <div className="max-w-7xl mx-auto overflow-hidden">
          <table className="w-full border-collapse text-center text-[13px] bg-white border border-black">
            <tbody>
              <tr className="h-[36px]"><td className="border-b border-r border-black bg-white font-normal w-[12%] text-black p-0"><div className="flex items-center justify-center h-full px-2">수전전압/용량</div></td><td className="border-b border-r border-black w-[22%] bg-white p-0"><div className="flex items-center justify-center h-full px-2">22900 V / 1600 kW</div></td><td className="border-b border-r border-black bg-white font-normal w-[12%] text-black p-0"><div className="flex items-center justify-center h-full px-2">발전전압/용량</div></td><td className="border-b border-r border-black w-[22%] bg-white p-0"><div className="flex items-center justify-center h-full px-2">380V / 500 kW</div></td><td className="border-b border-r border-black bg-white font-normal w-[10%] text-black p-0"><div className="flex items-center justify-center h-full px-2">태양광</div></td><td className="border-b border-r border-black w-[22%] text-right bg-white p-0"><div className="flex items-center justify-end h-full px-2">kW</div></td></tr>
              <tr className="h-[36px]">
                <td className="border-b border-r border-black bg-white font-normal text-black p-0"><div className="flex items-center justify-center h-full px-2">점검일자</div></td>
                <td className="border-b border-r border-black p-0 bg-white">
                  {isEditMode ? (
                    <input 
                      type="date" 
                      value={data.date || format(currentDate, 'yyyy-MM-dd')} 
                      onChange={e => setData({...data, date: e.target.value})}
                      className="w-full h-full text-center bg-transparent border-none outline-none shadow-none appearance-none font-normal text-black text-[13px] px-2"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-normal bg-white text-[13px] text-black px-2">
                      {data.date ? format(parseISO(data.date), 'yyyy년 MM월 dd일') : format(currentDate, 'yyyy년 MM월 dd일')}
                    </div>
                  )}
                </td>
                <td className="border-b border-r border-black bg-white font-normal text-black p-0"><div className="flex items-center justify-center h-full px-2">점검종별</div></td><td className="border-b border-r border-black bg-white text-black p-0"><div className="flex items-center justify-center h-full px-2">월차</div></td><td className="border-b border-r border-black bg-white font-normal text-black p-0"><div className="flex items-center justify-center h-full px-2">점검횟수</div></td><td className="border-b border-r border-black bg-white text-black p-0"><div className="flex items-center justify-center h-full px-2">1회</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className={`mb-2 bg-white ${['low', 'high', 'check'].includes(activeSubTab) ? 'block' : 'hidden-in-ui'} print:block check-section-2`}>
        <h3 className="font-bold text-base mb-1 border-l-4 border-gray-800 pl-2 hidden-in-ui">2. 점검내역</h3>
        <div className="flex gap-2 bg-white flex-col sm:flex-row print:flex-row">
          <div className={`${activeSubTab === 'low' ? 'block w-full' : 'hidden-in-ui'} print:block print:w-[40%]`} style={activeSubTab === 'low' ? {} : { flex: '1.2' }}>
            <div className="max-w-7xl mx-auto overflow-hidden">
              <table className="w-full border-collapse text-center bg-white border border-black" style={{ tableLayout: 'fixed' }}>
                <thead><tr className="bg-white"><th className={headerClass} rowSpan={2} style={{width:'30%'}}><div className="flex items-center justify-center h-full px-2">저압 및 발전설비</div></th><th className={headerClass} rowSpan={2} style={{width:'12%'}}><div className="flex items-center justify-center h-full px-2">판정</div></th><th className={headerClass} colSpan={2} style={{width:'20%'}}><div className="flex items-center justify-center h-full px-2">설비현황</div></th><th className={headerClass} style={{width:'14%'}}><div className="flex items-center justify-center h-full px-2">부적합</div></th><th className={headerClass} colSpan={2} style={{width:'24%'}}><div className="flex items-center justify-center h-full px-2">개 수</div></th></tr><tr className="bg-white text-[13px]"><th className={headerClass} style={{width:'10%'}}><div className="flex items-center justify-center h-full px-2">증</div></th><th className={headerClass} style={{width:'10%'}}><div className="flex items-center justify-center h-full px-2">감</div></th><th className={headerClass} style={{width:'14%'}}><div className="flex items-center justify-center h-full px-2">수량</div></th><th className={headerClass} style={{width:'12%'}}><div className="flex items-center justify-center h-full px-2">수량</div></th><th className={headerClass} style={{width:'12%'}}><div className="flex items-center justify-center h-full px-2">구분</div></th></tr></thead>
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
                    return (<tr key={i} className="bg-white"><td className={cellClass}><div className="flex items-center justify-center h-full px-2">{itemName}</div></td><td className={`${cellClass} font-normal transition-colors bg-white ${isEditMode ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'} ${displayRes === 'X' ? 'text-red-600' : 'text-black'}`} onClick={() => handleGeneralClick('low', itemName)}><div className="flex items-center justify-center h-full px-2">{displayRes}</div></td><td className={cellClass}><div className="flex items-center justify-center h-full px-2"></div></td><td className={cellClass}><div className="flex items-center justify-center h-full px-2"></div></td><td className={cellClass}><div className="flex items-center justify-center h-full px-2"></div></td><td className={cellClass}><div className="flex items-center justify-center h-full px-2"></div></td><td className={cellClass}><div className="flex items-center justify-center h-full px-2"></div></td></tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className={`${activeSubTab === 'high' ? 'block w-full' : 'hidden-in-ui'} print:block print:w-[40%]`} style={activeSubTab === 'high' ? {} : { flex: '1.2' }}>
            <div className="max-w-7xl mx-auto overflow-hidden">
              <table className="w-full border-collapse text-center text-[13px] bg-white border border-black" style={{ tableLayout: 'fixed' }}>
                <thead><tr className="bg-white"><th className={headerClass} rowSpan={2} style={{width:'30%'}}><div className="flex items-center justify-center h-full px-2">특고압설비</div></th><th className={headerClass} rowSpan={2} style={{width:'12%'}}><div className="flex items-center justify-center h-full px-2">판정</div></th><th className={headerClass} colSpan={2} style={{width:'20%'}}><div className="flex items-center justify-center h-full px-2">설비현황</div></th><th className={headerClass} style={{width:'14%'}}><div className="flex items-center justify-center h-full px-2">부적합</div></th><th className={headerClass} colSpan={2} style={{width:'24%'}}><div className="flex items-center justify-center h-full px-2 text-[13px]">개 수</div></th></tr><tr className="bg-white text-[13px]"><th className={headerClass} style={{width:'10%'}}><div className="flex items-center justify-center h-full px-2">증</div></th><th className={headerClass} style={{width:'10%'}}><div className="flex items-center justify-center h-full px-2">감</div></th><th className={headerClass} style={{width:'14%'}}><div className="flex items-center justify-center h-full px-2">수량</div></th><th className={headerClass} style={{width:'12%'}}><div className="flex items-center justify-center h-full px-2">수량</div></th><th className={headerClass} style={{width:'12%'}}><div className="flex items-center justify-center h-full px-2">구분</div></th></tr></thead>
                <tbody>
                  {highVoltageItems.map((item, i) => {
                    const res = getResult('high', item);
                    const isNA = res === '해당없음' || (!res && (item === '가공전선로' || item === '전력용커패시터'));
                    const displayRes = res === '부적합' ? 'X' : (isNA ? '/' : (item ? 'O' : ''));
                    return (<tr key={i} className="bg-white"><td className={cellClass}><div className="flex items-center justify-center h-full px-2">{item}</div></td><td className={`${cellClass} font-normal transition-colors bg-white ${isEditMode ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'} ${displayRes === 'X' ? 'text-red-600' : 'text-black'}`} onClick={() => handleGeneralClick('high', item)}><div className="flex items-center justify-center h-full px-2">{displayRes}</div></td><td className={cellClass}><div className="flex items-center justify-center h-full px-2"></div></td><td className={cellClass}><div className="flex items-center justify-center h-full px-2"></div></td><td className={cellClass}><div className="flex items-center justify-center h-full px-2"></div></td><td className={cellClass}><div className="flex items-center justify-center h-full px-2"></div></td><td className={cellClass}><div className="flex items-center justify-center h-full px-2"></div></td></tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className={`${activeSubTab === 'check' ? 'block w-full' : 'hidden-in-ui'} print:block print:w-[20%]`} style={activeSubTab === 'check' ? {} : { flex: '0.6' }}>
            <div className="max-w-7xl mx-auto overflow-hidden">
              <table className="w-full border-collapse text-center bg-white border border-black" style={{ tableLayout: 'fixed' }}>
                <thead><tr className="bg-white"><th className={headerClass} colSpan={2} style={{ width: '34%' }}><div className="flex items-center justify-center h-full px-2">구 분</div></th><th className={headerClass} style={{ width: '22%' }}><div className="flex items-center justify-center h-full px-2">전압</div></th><th className={headerClass} style={{ width: '22%' }}><div className="flex items-center justify-center h-full px-2">전류</div></th><th className={headerClass} style={{ width: '22%' }}><div className="flex items-center justify-center h-full px-2 text-[13px]">누설</div></th></tr></thead>
                <tbody>
                  {['LV-1', 'LV-3', 'LV-5'].map((loc) => (<React.Fragment key={loc}>{['R', 'S', 'T', 'N'].map((phase, pIdx) => {
                        const mKey = loc.toLowerCase().replace('-', '') as 'lv1' | 'lv3' | 'lv5';
                        const vField = `v_${phase.toLowerCase()}`; const iField = `i_${phase.toLowerCase()}`; const lField = `l_${phase.toLowerCase()}`;
                        const mData = data.measurements?.[mKey];
                        return (
                          <tr key={phase} className="bg-white">
                             {pIdx === 0 && <td rowSpan={4} className={`${cellClass} bg-white font-normal text-black`} style={{ width: '22%' }}><div className="flex items-center justify-center h-full px-2">{loc}<br/>ACB</div></td>}
                             <td className={`${cellClass} font-normal bg-white text-black`} style={{ width: '12%' }}><div className="flex items-center justify-center h-full px-2">{phase}</div></td>
                            <td className={cellClass}>
                              <input 
                                type="text" 
                                className={`${inputClass} ${isEditMode ? 'bg-orange-50' : ''}`} 
                                value={(mData as any)?.[vField] || ''} 
                                onChange={e => updateMeasurement(mKey, vField, e.target.value)} 
                                readOnly={!isEditMode}
                              />
                            </td>
                            <td className={cellClass}>
                              <input 
                                type="text" 
                                className={`${inputClass} ${isEditMode ? 'bg-orange-50' : ''}`} 
                                value={(mData as any)?.[iField] || ''} 
                                onChange={e => updateMeasurement(mKey, iField, e.target.value)} 
                                readOnly={!isEditMode}
                              />
                            </td>
                            <td className={cellClass}>
                              {isEditMode ? (
                                <select 
                                  className={`${inputClass} font-normal text-black bg-orange-50`} 
                                  value={(mData as any)?.[lField] || '양호'} 
                                  onChange={e => updateMeasurement(mKey, lField, e.target.value)}
                                >
                                  <option value="양호">양호</option>
                                  <option value="불량">불량</option>
                                </select>
                              ) : (
                                <div className={`${inputClass} font-normal text-black flex items-center justify-center whitespace-nowrap tracking-tighter`}>
                                  {String((mData as any)?.[lField] || '양호').replace(/\s/g, '')}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}</React.Fragment>))}
                  <tr className="bg-white"><td className={`${cellClass} font-normal bg-white text-black`}><div className="flex items-center justify-center h-full px-1 whitespace-nowrap tracking-tighter">역율</div></td><td className={`${cellClass} font-normal bg-white text-black`}><div className="flex items-center justify-center h-full px-1 whitespace-nowrap tracking-tighter">주간</div></td><td colSpan={3} className={cellClass}><input type="text" className={`${inputClass} ${isEditMode ? 'bg-orange-50' : ''}`} value={data.measurements?.pf?.day || ''} onChange={e => updateMeasurement('pf', 'day', e.target.value)} readOnly={!isEditMode} /></td></tr>
                  <tr className="bg-white"><td colSpan={2} className={`${cellClass} font-normal bg-white text-black`}><div className="flex items-center justify-center h-full px-1 whitespace-nowrap tracking-tighter">유효전력량</div></td><td colSpan={3} className={cellClass}><input type="text" className={`${inputClass} font-normal text-black ${isEditMode ? 'bg-orange-50' : ''}`} value={data.measurements?.power?.active || ''} onChange={e => updateMeasurement('power', 'active', e.target.value)} readOnly={!isEditMode} /></td></tr>
                  <tr className="bg-white"><td colSpan={2} className={`${cellClass} font-normal bg-white text-black`}><div className="flex items-center justify-center h-full px-1 whitespace-nowrap tracking-tighter">무효전력량</div></td><td colSpan={3} className={cellClass}><input type="text" className={`${inputClass} ${isEditMode ? 'bg-orange-50' : ''}`} value={data.measurements?.power?.reactive || ''} onChange={e => updateMeasurement('power', 'reactive', e.target.value)} readOnly={!isEditMode} /></td></tr>
                  <tr className="bg-white"><td colSpan={2} className={`${cellClass} font-normal bg-white text-black`}><div className="flex items-center justify-center h-full px-1 whitespace-nowrap tracking-tighter">최대전력</div></td><td colSpan={3} className={cellClass}><input type="text" className={`${inputClass} font-normal text-black ${isEditMode ? 'bg-orange-50' : ''}`} value={data.measurements?.power?.max || ''} onChange={e => updateMeasurement('power', 'max', e.target.value)} readOnly={!isEditMode} /></td></tr>
                  <tr className="bg-white"><td colSpan={2} className={`${cellClass} font-normal bg-white text-black`}><div className="flex items-center justify-center h-full px-1 whitespace-nowrap tracking-tighter">배율</div></td><td colSpan={3} className={cellClass}><input type="text" className={`${inputClass} ${isEditMode ? 'bg-orange-50' : ''}`} value={data.measurements?.power?.multiplier || ''} onChange={e => updateMeasurement('power', 'multiplier', e.target.value)} readOnly={!isEditMode} /></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <p className="text-[9px] mt-1 bg-white text-gray-500 font-medium hidden-in-ui">※ 점검결과의 판정은 O(적합), X(부적합), /(해당없음)으로 표시한다. (판정 칸 클릭 시 전환)</p>
      </div>
      <div className={`mb-2 bg-white ${activeSubTab === 'opinion' ? 'block' : 'hidden-in-ui'} print:block`}>
        <h3 className="font-bold text-base mb-1 border-l-4 border-gray-800 pl-2 hidden-in-ui">3. 종합의견</h3>
        
        {/* UI 전용: 데이터 테이블 형식 */}
        <div className="print:hidden border border-black overflow-hidden bg-white">
          <table className="w-full border-collapse text-center table-fixed">
            <tbody className="bg-white">
              <tr className="bg-white">
                <td className="p-0">
                  <textarea
                    className={`w-full p-3 h-[400px] outline-none resize-none overflow-hidden text-[13px] leading-relaxed font-normal text-left transition-all ${isEditMode ? 'bg-orange-50' : 'bg-white cursor-not-allowed'}`}
                    value={data.opinion || (activeType === 'general' ? DEFAULT_OPINION : '')}
                    onChange={e => updateOpinion(e.target.value)}
                    readOnly={!isEditMode}
                    placeholder="종합의견을 입력하세요."
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 인쇄 전용: 기존 레이아웃 유지 (절대 수정 금지) */}
        <div className="hidden print:block border border-black overflow-hidden bg-white shadow-none">
          <div 
            className="w-full min-h-[80px] p-3 outline-none text-[12px] leading-tight bg-white font-normal text-black whitespace-pre-wrap" 
            style={{ textAlign: 'left' }} 
          >
            {data.opinion || (activeType === 'general' ? DEFAULT_OPINION : '')}
          </div>
        </div>
      </div>
      <div className={`text-[12px] mb-2 bg-white text-red-600 font-bold ${activeSubTab === 'opinion' ? 'block' : 'hidden-in-ui'} print:block`}>※ 전기설비의 개,보수 작업은 반드시 정전상태에서 시행하시기 바랍니다.</div>
      <div className={`flex justify-end mt-2 bg-white ${activeSubTab === 'opinion' ? 'flex' : 'hidden-in-ui'} print:flex`}>
        <div className="overflow-hidden">
          <table className="border-collapse w-[320px] bg-white border border-black">
            <tbody>
              <tr className="h-[40px]">
                <td className="border-r border-black bg-white font-normal w-12 text-center text-[13px] text-black p-0"><div className="flex items-center justify-center h-full px-2">확인</div></td>
                <td className="border-r border-black bg-white font-normal w-24 text-center text-[13px] text-black p-0"><div className="flex items-center justify-center h-full px-2">점검담당자</div></td>
                <td className="border-r border-black p-0 bg-white min-w-[120px]">
                  <input 
                    type="text" 
                    className={`w-full h-full text-center outline-none bg-white font-normal text-[13px] text-black ${isEditMode ? 'bg-orange-50' : ''}`} 
                    value={data?.approver || ''} 
                    onChange={e => updateApprover(e.target.value)} 
                    readOnly={!isEditMode} 
                    placeholder="성명 입력" 
                  />
                </td>
                <td className="bg-white font-normal w-12 text-center text-[13px] text-gray-500 p-0"><div className="flex items-center justify-center h-full px-2">(인)</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderEVForm = () => (
    <div className="p-0 bg-white text-black w-full break-before-page">
      <HeaderSection title="전기자동차 충전시설 점검 기록표" />
      <div className="text-right font-normal text-[14px] mt-2 mb-1 hidden-in-ui">
        점검일자 : {isEditMode ? (
          <input 
            type="date" 
            value={data.date || format(currentDate, 'yyyy-MM-dd')} 
            onChange={e => setData({...data, date: e.target.value})}
            className="border-b-2 border-blue-500 bg-blue-50/30 outline-none text-sm font-bold text-black py-0.5 px-2 transition-all rounded-none w-32 text-center"
          />
        ) : (
          <span className="text-black text-[14px]">{data.date ? format(parseISO(data.date), 'yyyy년 MM월 dd일') : format(currentDate, 'yyyy년 MM월 dd일')}</span>
        )}
      </div>
      <div className={`mb-1.5 ${activeSubTab === 'ev-basic' ? 'block' : 'hidden-in-ui'} print:block max-w-7xl mx-auto print:max-w-none`}>
        <h3 className="text-sm font-bold mb-1 border-l-4 border-gray-800 pl-2 hidden-in-ui">1.점검자/확인사항</h3>
        <div className="border-t border-l border-black overflow-hidden bg-white print-no-border ev-table-1">
          <table className="w-full border-collapse text-[13px] bg-white text-center text-black font-normal">
            <tbody>
              <tr className="h-[40px]">
                <td className="border-b border-r border-black bg-white font-normal w-[15%] text-center text-black p-0"><div className="flex items-center justify-center h-full px-2">점검자(소속)</div></td>
                <td className="border-b border-r border-black w-[35%] text-center font-normal p-0"><div className="flex items-center justify-center h-full px-2">새마을운동중앙회 대치동 사옥</div></td>
                <td className="border-b border-r border-black bg-white font-normal text-center text-black p-0"><div className="flex items-center justify-center h-full px-2">성 명</div></td>
                <td className="border-b border-r border-black w-[35%] p-0">
                  <input type="text" className={`w-full h-full text-center outline-none bg-white font-normal text-black ${isEditMode ? 'bg-orange-50' : ''}`} value={data?.approver || ''} onChange={e => updateApprover(e.target.value)} readOnly={!isEditMode} placeholder="(서명)" />
                </td>
              </tr>
              <tr className="h-[40px]">
                <td className="border-b border-r border-black bg-white font-normal text-center text-black p-0"><div className="flex items-center justify-center h-full px-2">설 치 장 소</div></td>
                <td className="border-b border-r border-black text-center font-normal p-0"><div className="flex items-center justify-center h-full px-2">B5F 주차장</div></td>
                <td className="border-b border-r border-black bg-white font-normal text-center text-black p-0"><div className="flex items-center justify-center h-full px-2">전기설비전압/용량</div></td>
                <td className="border-b border-r border-black text-center font-normal p-0"><div className="flex items-center justify-center h-full px-2">22900 [V] / 1600 [kW]</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className={`mb-1.5 ${activeSubTab === 'ev-facility' ? 'block' : 'hidden-in-ui'} print:block max-w-7xl mx-auto print:max-w-none`}>
        <h3 className="text-sm font-bold mb-1 border-l-4 border-gray-800 pl-2 hidden-in-ui">2.충전시설/충전기사양</h3>
        <div className="border-t border-l border-black overflow-hidden bg-white print-no-border ev-table-2">
          <table className="w-full border-collapse text-[13px] bg-white text-center text-black font-normal">
            <tbody>
              <tr className="h-[40px]">
                <td className="border-b border-r border-black bg-white font-normal w-[15%] text-center text-black p-0"><div className="flex items-center justify-center h-full px-2">설치기수</div></td>
                <td className="border-b border-r border-black w-[35%] text-center font-normal p-0">
                  {isEditMode ? (
                    <input 
                      type="text" 
                      value={data.specs?.evInstallCount || ''} 
                      onChange={e => handleSpecChange('evInstallCount', e.target.value)}
                      className="w-full h-full text-center outline-none bg-orange-50 p-1"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full px-2">{data.specs?.evInstallCount || '( 7 )kW ( 3 )기'}</div>
                  )}
                </td>
                <td className="border-b border-r border-black bg-white font-normal w-[15%] text-center text-black p-0"><div className="flex items-center justify-center h-full px-2">전압/용량</div></td>
                <td className="border-b border-r border-black w-[20%] text-center font-normal p-0">
                  {isEditMode ? (
                    <input 
                      type="text" 
                      value={data.specs?.evVoltageCurrent || ''} 
                      onChange={e => handleSpecChange('evVoltageCurrent', e.target.value)}
                      className="w-full h-full text-center outline-none bg-orange-50 p-1"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full px-2">{data.specs?.evVoltageCurrent || '220V 32A 60A'}</div>
                  )}
                </td>
                <td className="border-b border-r border-black bg-white font-normal w-[7%] text-center text-black p-0"><div className="flex items-center justify-center h-full px-2">대수</div></td>
                <td className="border-b border-r border-black w-[8%] text-center font-normal p-0">
                  {isEditMode ? (
                    <input 
                      type="text" 
                      value={data.specs?.evUnitCount || ''} 
                      onChange={e => handleSpecChange('evUnitCount', e.target.value)}
                      className="w-full h-full text-center outline-none bg-orange-50 p-1"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full px-2">{data.specs?.evUnitCount || '3 EA'}</div>
                  )}
                </td>
              </tr>
              <tr className="h-[40px]">
                <td className="border-b border-r border-black bg-white font-normal text-center text-black p-0"><div className="flex items-center justify-center h-full px-2">설치위치</div></td>
                <td className="border-b border-r border-black p-0">
                  <div className="flex justify-center items-center h-full gap-4 px-2">
                    <label className="flex items-center gap-1 font-normal"><input type="checkbox" checked readOnly /> 옥내</label>
                    <label className="flex items-center gap-1 font-normal"><input type="checkbox" /> 옥외</label>
                    <label className="flex items-center gap-1 font-normal text-gray-400"> 기타( )</label>
                  </div>
                </td>
                <td className="border-b border-r border-black bg-white font-normal text-center text-black p-0"><div className="flex items-center justify-center h-full px-2">제조사</div></td>
                <td className="border-b border-r border-black text-center font-normal p-0" colSpan={3}>
                  {isEditMode ? (
                    <input 
                      type="text" 
                      value={data.specs?.evManufacturer || ''} 
                      onChange={e => handleSpecChange('evManufacturer', e.target.value)}
                      className="w-full h-full text-center outline-none bg-orange-50 p-1"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full px-2">{data.specs?.evManufacturer || '(주) 에바'}</div>
                  )}
                </td>
              </tr>
              <tr className="h-[40px]">
                <td className="border-b border-r border-black bg-white font-normal text-center text-black p-0"><div className="flex items-center justify-center h-full px-2">충전형식</div></td>
                <td className="border-b border-r border-black p-0">
                  <div className="flex justify-center items-center h-full gap-4 px-2">
                    <label className="flex items-center gap-1 font-normal"><input type="checkbox" /> DC차데모</label>
                    <label className="flex items-center gap-1 font-normal"><input type="checkbox" /> DC콤보</label>
                    <label className="flex items-center gap-1 font-normal"><input type="checkbox" checked readOnly /> AC단상</label>
                  </div>
                </td>
                <td className="border-b border-r border-black bg-white font-normal text-center text-black p-0"><div className="flex items-center justify-center h-full px-2">모델명(일련번호)</div></td>
                <td className="border-b border-r border-black text-center font-normal p-0" colSpan={3}>
                  {isEditMode ? (
                    <input 
                      type="text" 
                      value={data.specs?.evModelSerial || ''} 
                      onChange={e => handleSpecChange('evModelSerial', e.target.value)}
                      className="w-full h-full text-center outline-none bg-orange-50 p-1"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full px-2">{data.specs?.evModelSerial || 'ELA007C01(EV-SCA-33283)'}</div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className={`mb-1.5 ${activeSubTab === 'ev-content' ? 'block' : 'hidden-in-ui'} print:block max-w-7xl mx-auto print:max-w-none`}>
        <h3 className="text-sm font-bold mb-1 border-l-4 border-gray-800 pl-2 hidden-in-ui">3.점검내용</h3>
        <div className="border-t border-l border-black overflow-hidden bg-white print-no-border ev-table-3">
          <table className="w-full border-collapse text-[13px] bg-white text-center text-black font-normal">
            <thead>
              <tr className="bg-white h-[40px]">
                <th className="border-b border-r border-black w-24 font-normal text-center text-black p-0"><div className="flex items-center justify-center h-full px-2">구 분</div></th>
                <th className="border-b border-r border-black font-normal text-center text-black p-0"><div className="flex items-center justify-center h-full px-2">점 검 항 목</div></th>
                <th className="border-b border-r border-black w-16 font-normal text-center text-black p-0"><div className="flex items-center justify-center h-full px-2">점검결과</div></th>
                <th className="border-b border-r border-black w-16 font-normal text-center text-black p-0"><div className="flex items-center justify-center h-full px-2">비 고</div></th>
              </tr>
            </thead>
            <tbody>
              {evCheckCategories.map((cat, catIdx) => (cat.items.map((itemText, itemIdx) => {
                  const res = getResult('ev', itemText);
                  const displayRes = res === '부적합' ? 'X' : (res === '해당없음' ? '/' : 'O');
                  return (
                    <tr key={`ev-${catIdx}-${itemIdx}`} className="bg-white hover:bg-gray-50/50 transition-colors h-[40px]">
                      {itemIdx === 0 && <td rowSpan={cat.items.length} className="border-b border-r border-black p-0 font-normal align-middle text-center bg-white text-black whitespace-pre-line"><div className="flex items-center justify-center h-full px-2">{cat.label}</div></td>}
                      <td className="border-b border-r border-black p-0 text-left font-normal text-black"><div className="flex items-center h-full px-2">{itemText === '전선의 종류, 굵기, 지상고 등 시설 상태 확인' ? '  ' + itemText : itemText}</div></td>
                      <td 
                        className={`border-b border-r border-black p-0 text-[13px] font-normal text-center align-middle transition-colors bg-white ${isEditMode ? 'cursor-pointer hover:bg-orange-50' : ''} ${displayRes === 'X' ? 'text-red-600' : 'text-black'}`}
                        onClick={() => isEditMode && handleGeneralClick('ev', itemText)}
                      >
                        <div className="flex items-center justify-center h-full px-2">{displayRes}</div>
                      </td>
                      <td className="border-b border-r border-black p-0">
                        <input 
                          type="text" 
                          className={`w-full h-full text-center outline-none bg-transparent p-1 text-[13px] font-normal text-black ${isEditMode ? 'bg-orange-50' : ''}`} 
                          value={data?.items?.find(i => i.category === 'ev' && i.content === itemText)?.measure || ''} 
                          onChange={(e) => { 
                            const existingIdx = (data.items || []).findIndex(i => i.category === 'ev' && i.content === itemText); 
                            const newItems = [...(data.items || [])]; 
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
      </div>
      <div className={`mb-1.5 ${activeSubTab === 'ev-opinion' ? 'block' : 'hidden-in-ui'} print:block max-w-7xl mx-auto print:max-w-none`}>
        <div className="hidden-in-ui mb-1">
          <div className="flex items-baseline gap-3">
            <h3 className="text-sm font-bold border-l-4 border-gray-800 pl-2">4.종합의견</h3>
            <span className="text-[12px] font-normal text-gray-500">[비고] 점검결과는 ○(적합), ×(부적합), /(해당없음) 으로 표기</span>
          </div>
        </div>

        {/* UI 전용: 데이터 테이블 형식 */}
        <div className="print:hidden border-t border-l border-black overflow-hidden bg-white">
          <table className="w-full border-collapse text-center table-fixed">
            <tbody className="bg-white">
              <tr className="bg-white">
                <td className="p-0 border-b border-r border-black">
                  <textarea
                    className={`w-full p-3 h-24 outline-none resize-none text-[13px] leading-relaxed font-normal text-left transition-all ${isEditMode ? 'bg-orange-50' : 'bg-white cursor-not-allowed'}`}
                    value={data.opinion || ''}
                    onChange={e => updateOpinion(e.target.value)}
                    readOnly={!isEditMode}
                    placeholder="종합의견을 입력하세요."
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 인쇄 전용: 기존 레이아웃 유지 (절대 수정 금지) */}
        <div className="hidden print:block border border-black rounded-xl overflow-hidden bg-white shadow-sm print:border print:border-black print:rounded-none print:shadow-none">
          <textarea 
            className="w-full h-[50px] p-3 outline-none text-[12px] font-normal text-black leading-tight opinion-textarea" 
            style={{ textAlign: 'left' }} 
            value={data.opinion || ''} 
            readOnly 
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-2 pb-10 animate-fade-in transition-all duration-300">
      {/* 상단 통합 컨트롤/탭 바 */}
      <div className="w-full max-w-7xl mx-auto bg-white border-b border-black print:hidden flex items-stretch whitespace-nowrap mb-2 overflow-x-auto scrollbar-hide">
        {/* 날짜 선택 (월 네비게이션) */}
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

        {/* 구분선 1 */}
        <div className="flex items-center px-2 shrink-0">
          <div className="w-[1px] h-6 bg-black"></div>
        </div>

        {/* 서브탭 메뉴 */}
        <div className="flex items-center">
          {(activeType === 'general' ? GENERAL_SUB_TABS : EV_SUB_TABS).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`relative px-4 py-3 text-[14px] font-bold transition-all shrink-0 flex items-center ${
                activeSubTab === tab.id ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              {tab.label}
              {activeSubTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
              )}
            </button>
          ))}
        </div>

        {/* 구분선 2 */}
        <div className="flex items-center px-2 shrink-0">
          <div className="w-[1px] h-6 bg-black"></div>
        </div>

        {/* 버튼 그룹 */}
        <div className="flex items-center">
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
            {isEditMode ? <Lock size={18} className="mr-1.5" /> : <Edit2 size={18} className="mr-1.5" />}
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
            {saveStatus === 'loading' ? (
              <RefreshCw size={18} className="mr-1.5 animate-spin" />
            ) : saveStatus === 'success' ? (
              <CheckCircle2 size={18} className="mr-1.5" />
            ) : (
              <Save size={18} className="mr-1.5" />
            )}
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

        {/* 점검일자 (EV 탭 메인화면) */}
        {activeType === 'ev' && (
          <>
            {/* 구분선 3 */}
            <div className="flex items-center px-2 shrink-0">
              <div className="w-[1px] h-6 bg-black"></div>
            </div>
            <div className="flex items-center px-4 py-3 text-[14px] font-bold text-gray-700 shrink-0">
              <span className="mr-2 whitespace-nowrap">점검일자 :</span>
              {isEditMode ? (
                <input 
                  type="date" 
                  value={data.date || format(currentDate, 'yyyy-MM-dd')} 
                  onChange={e => setData({...data, date: e.target.value})}
                  className="border-b-2 border-blue-500 bg-blue-50/30 outline-none text-sm font-bold text-black py-0.5 px-2 transition-all rounded-none w-32 text-center"
                />
              ) : (
                <span className="text-black whitespace-nowrap">{data.date ? format(parseISO(data.date), 'yyyy년 MM월 dd일') : format(currentDate, 'yyyy년 MM월 dd일')}</span>
              )}
            </div>
          </>
        )}
      </div>
      {!viewType && (
        <div className="flex space-x-2 border-b border-gray-200 pb-1 print:hidden bg-white px-1">
          <button onClick={() => { setActiveType('general'); setActiveSubTab('basic'); }} className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeType === 'general' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>전기설비점검</button>
          <button onClick={() => { setActiveType('ev'); setActiveSubTab('ev-basic'); }} className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeType === 'ev' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>전기자동차</button>
        </div>
      )}
      {/* 하단 데이터 박스 */}
      <div id="safety-check-print-area" className="bg-white overflow-x-auto">
        <div className="min-w-[1000px]">
          {activeType === 'general' ? renderGeneralForm() : renderEVForm()}
        </div>
      </div>
      <style>{` .hidden-in-ui { display: none; } @media print { .hidden-in-ui { display: block !important; } } @keyframes scale-up { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } } .animate-scale-up { animation: scale-up 0.2s ease-out forwards; } @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } } .animate-fade-in { animation: fade-in 0.2s ease-out forwards; } .ui-table-border-fix { border-style: hidden; } `}</style>
    </div>
  );
};

export default SafetyCheckLog;
