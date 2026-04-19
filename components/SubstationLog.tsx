
import { format, startOfMonth, subDays, parseISO } from 'date-fns';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDailyData, fetchSubstationLog, getInitialSubstationLog, saveDailyData, saveSubstationLog, getInitialDailyData } from '../services/dataService';
import { AcbReadings, PowerUsageReadings, SubstationLogData, VcbReadings, DailyData } from '../types';
import LogSheetLayout from './LogSheetLayout';
import { Save, RefreshCw, CheckCircle2, Cloud, X, Zap, Printer, CheckCircle } from 'lucide-react';

interface SubstationLogProps {
  currentDate: Date;
  isEmbedded?: boolean;
  onUsageChange?: (val: string) => void;
}

const SubstationLog: React.FC<SubstationLogProps> = ({ currentDate, isEmbedded = false, onUsageChange }) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  
  const [data, setData] = useState<SubstationLogData>(getInitialSubstationLog(dateKey));
  const [activeSubTab, setActiveSubTab] = useState<'vcb' | 'acb' | 'usage' | 'analysis'>('vcb');

  const subTabs = [
    { id: 'vcb', label: 'VCB' },
    { id: 'acb', label: 'ACB/변압기온도' },
    { id: 'usage', label: '전력량' },
    { id: 'analysis', label: '일사용량' },
  ];
  
  const historySumRef = useRef<number>(0);
  const isInitialLoad = useRef(true);
  const lastSyncedUsageRef = useRef<string>('');

  const safeParseFloat = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const cleaned = val.toString().replace(/,/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const normalizePowerReadings = (raw: any): PowerUsageReadings => {
    const result: PowerUsageReadings = { activeMid: '', activeMax: '', activeLight: '', reactiveMid: '', reactiveMax: '' };
    if (!raw || typeof raw !== 'object') return result;
    
    result.activeMid = String(raw.activeMid || raw.active_mid || raw["중간"] || raw["active_mid"] || '').trim();
    result.activeMax = String(raw.activeMax || raw.active_max || raw["최대"] || raw["active_max"] || '').trim();
    result.activeLight = String(raw.activeLight || raw.active_light || raw["경부하"] || raw["active_light"] || '').trim();
    result.reactiveMid = String(raw.reactiveMid || raw.reactive_mid || raw["무효중간"] || raw["reactive_mid"] || '').trim();
    result.reactiveMax = String(raw.reactiveMax || raw.reactive_max || raw["무효최대"] || raw["reactive_max"] || '').trim();

    return result;
  };

  const calculateDailyAnalysis = useCallback((currentData: SubstationLogData, hSum: number) => {
    if (!currentData) return getInitialSubstationLog(dateKey);
    
    const newData = JSON.parse(JSON.stringify(currentData)) as SubstationLogData; 
    const { powerUsage, dailyStats } = newData;

    if (!powerUsage || !dailyStats) return newData;

    const fields: (keyof PowerUsageReadings)[] = ['activeMid', 'activeMax', 'activeLight', 'reactiveMid', 'reactiveMax'];
    let totalActiveUsage = 0;
    let totalReactiveUsage = 0;
    let hasCurrentReadings = false;

    fields.forEach(f => {
      const p = safeParseFloat(powerUsage.prev[f]);
      const cStr = String(powerUsage.curr[f]).trim();
      const c = safeParseFloat(cStr);
      
      if (cStr !== '' && c >= 0) {
        hasCurrentReadings = true;
        let diff = 0;
        if (c < p) {
          const rolloverBase = p < 100000 ? 100000 : 1000000;
          diff = (rolloverBase + c) - p;
        } else {
          diff = c - p;
        }
        
        const usage = Math.round(diff * 1200);
        powerUsage.usage[f] = usage.toString();
        
        if (f.startsWith('active')) totalActiveUsage += usage;
        else if (f.startsWith('reactive')) totalReactiveUsage += usage;
      } else {
        powerUsage.usage[f] = '';
      }
    });

    dailyStats.activePower = hasCurrentReadings ? totalActiveUsage.toString() : '0';
    dailyStats.reactivePower = hasCurrentReadings ? totalReactiveUsage.toString() : '0';
    dailyStats.monthTotal = Math.round(hSum + totalActiveUsage).toString();

    const vcbMain = newData.vcb?.time9?.main || newData.vcb?.time21?.main;
    if (vcbMain && (vcbMain.pf || vcbMain.a)) {
      const kVA_Const = 1.7321 * 22.9; 
      const pfNum = safeParseFloat(vcbMain.pf);
      const currentA = safeParseFloat(vcbMain.a);
      const maxPowerNum = kVA_Const * currentA * (pfNum / 100);
      dailyStats.maxPower = maxPowerNum > 0 ? Math.round(maxPowerNum).toString() : '0';

      if (totalActiveUsage > 0) {
        const totalApparent = Math.sqrt(Math.pow(totalActiveUsage, 2) + Math.pow(totalReactiveUsage, 2));
        const pfCalc = (totalActiveUsage / totalApparent) * 100;
        dailyStats.powerFactor = isNaN(pfCalc) ? '0' : pfCalc.toFixed(1);
      } else {
        dailyStats.powerFactor = '0';
      }
      
      if (maxPowerNum > 0 && totalActiveUsage > 0) {
        const loadFactorCalc = ((totalActiveUsage / 24) / maxPowerNum) * 100;
        dailyStats.loadFactor = isNaN(loadFactorCalc) ? '0' : loadFactorCalc.toFixed(1);
      } else {
        dailyStats.loadFactor = '0';
      }
      
      if (maxPowerNum > 0) {
        const demandFactorCalc = (maxPowerNum / 1600) * 100;
        dailyStats.demandFactor = isNaN(demandFactorCalc) ? '0' : demandFactorCalc.toFixed(1);
      } else {
        dailyStats.demandFactor = '0';
      }
    } else {
      dailyStats.maxPower = '0';
      dailyStats.powerFactor = '0';
      dailyStats.loadFactor = '0';
      dailyStats.demandFactor = '0';
    }

    return newData;
  }, [dateKey]);

  useEffect(() => {
    const currentUsage = data.dailyStats?.activePower;
    if (onUsageChange && currentUsage && currentUsage !== '0' && currentUsage !== lastSyncedUsageRef.current) {
      lastSyncedUsageRef.current = currentUsage;
      onUsageChange(currentUsage);
    }
  }, [data.dailyStats?.activePower, onUsageChange]);

  const loadData = useCallback(async (force = false) => {
    setLoading(true);
    isInitialLoad.current = true;
    setSaveStatus('idle');

    try {
      const monthStartStr = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const yesterdayStr = format(subDays(currentDate, 1), 'yyyy-MM-dd');
      
      let hSum = 0;
      let yesterdayDataForBase = null;

      if (dateKey !== monthStartStr) {
        const yesterdayLog = await fetchSubstationLog(yesterdayStr, true);
        if (yesterdayLog) {
          yesterdayDataForBase = yesterdayLog;
          const stats = yesterdayLog.dailyStats || (yesterdayLog as any).daily_stats;
          hSum = safeParseFloat(stats?.monthTotal);
        }
      }
      
      historySumRef.current = hSum;

      const fetched = await fetchSubstationLog(dateKey, force);
      const finalData: SubstationLogData = fetched || getInitialSubstationLog(dateKey);

      const rawPU = (finalData.powerUsage || (finalData as any).power_usage) || {};
      finalData.powerUsage = {
        prev: normalizePowerReadings(rawPU.prev || rawPU["이전"]),
        curr: normalizePowerReadings(rawPU.curr || rawPU["현재"]),
        usage: normalizePowerReadings(rawPU.usage || rawPU["사용량"])
      };

      const currentPrevMid = finalData.powerUsage.prev.activeMid;
      const isPrevEmpty = !currentPrevMid || currentPrevMid.trim() === '' || currentPrevMid === '0';
      
      if (isPrevEmpty && yesterdayDataForBase) {
        const yPU = yesterdayDataForBase.powerUsage || (yesterdayDataForBase as any).power_usage;
        if (yPU) {
          const yCurrRaw = yPU.curr || yPU["현재"] || yPU.current;
          if (yCurrRaw) finalData.powerUsage.prev = normalizePowerReadings(yCurrRaw);
        }
      }

      const analyzedData = calculateDailyAnalysis(finalData, hSum);
      setData(analyzedData);
      setTimeout(() => { isInitialLoad.current = false; }, 300);
    } catch (e) { 
      console.error("Substation load error:", e); 
      setData(getInitialSubstationLog(dateKey));
    } finally { 
      setLoading(false); 
    }
  }, [dateKey, currentDate, calculateDailyAnalysis]);

  useEffect(() => { loadData(false); }, [dateKey]);

  const handleSave = async () => {
    if (saveStatus === 'loading') return;
    setSaveStatus('loading');
    try {
      const success = await saveSubstationLog(data);
      if (success) {
        setSaveStatus('success');
        // alert() 제거 (LogSheetLayout에서 모달로 처리)
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장에 실패했습니다.');
      }
    } catch (e) { 
      console.error(e);
      setSaveStatus('error'); 
    }
  };

  const updateVcb = (time: 'time9' | 'time21', section: keyof VcbReadings, field: string, value: string) => {
    if (field === 'v') return; 
    setData(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as SubstationLogData;
      const targetSection = (next.vcb[time] as any)[section];
      if (targetSection) {
        targetSection[field] = value;
        if (section === 'main' && field === 'pf') {
          if (next.vcb[time].tr1) next.vcb[time].tr1.pf = value;
          if (next.vcb[time].tr2) next.vcb[time].tr2.pf = value;
          if (next.vcb[time].tr3) next.vcb[time].tr3.pf = value;
        }
      }
      return calculateDailyAnalysis(next, historySumRef.current);
    });
  };

  const updateAcb = (time: 'time9' | 'time21', section: keyof AcbReadings, field: string, value: string) => {
    setData(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as SubstationLogData;
      const targetSection = (next.acb[time] as any)[section];
      if (targetSection) targetSection[field] = value;
      return next;
    });
  };

  const updatePower = (row: 'prev' | 'curr' | 'usage', field: keyof PowerUsageReadings, value: string) => {
    if (row === 'usage') return; 
    setData(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as SubstationLogData;
      if (next.powerUsage) {
        next.powerUsage[row][field] = value;
      }
      return calculateDailyAnalysis(next, historySumRef.current);
    });
  };

  const handlePrint = () => {
    const printContent = document.getElementById('substation-log-print-area');
    if (!printContent) return;
    const formattedYear = format(currentDate, 'yyyy');
    const formattedMonth = format(currentDate, 'MM');
    const formattedDay = format(currentDate, 'dd');
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const formattedDayName = days[currentDate.getDay()];
    
    const inputs = printContent.querySelectorAll('input');
    inputs.forEach(input => { input.setAttribute('value', input.value); });
    
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>수변전반일지 - ${dateKey}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page { margin: 0; size: A4 portrait; }
            body { font-family: sans-serif; background: black !important; margin: 0; padding: 0; }
            .no-print { margin: 20px; display: flex; gap: 10px; justify-content: center; }
            @media print { .no-print { display: none !important; } }
            .print-page { width: 210mm; min-height: 297mm; padding: 25mm 10mm 10mm 10mm; margin: 0 auto; box-sizing: border-box; background: white !important; }
            table { width: 100% !important; border-collapse: collapse !important; border: 1.2px solid black !important; table-layout: fixed !important; margin-bottom: 12px; }
            th, td { border: 1px solid black !important; text-align: center !important; height: 42px !important; color: black !important; }
            th { font-weight: normal !important; font-size: 8.5pt !important; background-color: white !important; }
            td { font-size: 10pt !important; }
            input { border: none !important; width: 100% !important; text-align: center !important; font-size: 10.5pt !important; font-weight: normal !important; color: black !important; background: transparent !important; }
            .flex-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; min-height: 100px; }
            .title-box { flex: 1; text-align: center; }
            .doc-title { font-size: 32pt; font-weight: 900; letter-spacing: 4px; }
            .approval-table { width: 90mm !important; border: 1.5px solid black !important; }
            .approval-table th { height: 22px !important; font-size: 8.5pt !important; background: white !important; font-weight: normal; }
            .approval-table td { height: 70px !important; }
            .approval-table .side-header { width: 28px !important; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold; font-size: 11pt; }
            h3 { font-size: 12.5pt !important; margin-top: 15px !important; margin-bottom: 8px !important; font-weight: 900 !important; border-left: 7px solid black !important; padding-left: 10px; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
          <div class="print-page">
            <div class="flex-header">
              <div class="title-box"><div class="doc-title">수변전반일지</div></div>
              <table class="approval-table">
                <tr><th rowspan="2" class="side-header">결<br>재</th><th>담 당</th><th>주 임</th><th>대 리</th><th>과 장</th><th>소 장</th></tr>
                <tr><td></td><td></td><td></td><td></td><td></td></tr>
              </table>
            </div>
            <div class="info-row"><div>${formattedYear}년 ${formattedMonth}월 ${formattedDay}일 ${formattedDayName}</div></div>
            <div class="overflow-visible">${printContent.innerHTML}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const inputClass = "w-full text-center h-full bg-transparent border-none outline-none shadow-none appearance-none text-black text-[13px] font-normal px-2 focus:ring-0";
  const readonlyInputClass = "w-full text-center h-full bg-transparent border-none outline-none shadow-none appearance-none text-black text-[13px] font-normal px-2 cursor-not-allowed";
  const thClass = "border border-black bg-white font-normal text-center text-[13px] text-black h-[32px]";
  const tdClass = "border border-black p-0 h-[32px] relative bg-white text-center text-black";

  return (
    <>
      <LogSheetLayout 
        title="" 
        loading={loading} 
        saveStatus={saveStatus} 
        onRefresh={() => loadData(true)} 
        onSave={handleSave} 
        onPrint={handlePrint} 
        isEmbedded={isEmbedded} 
        hideSave={false}
        hideHeader={true}
      >
        <style>{`
          .ui-hidden { display: none !important; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
        <div className="w-full max-w-7xl bg-white mx-auto mb-6 overflow-hidden print:hidden">
          <div className="flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
            <div className="flex items-stretch">
              {subTabs.map(tab => (
                <div
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={`relative px-4 py-3 text-[14px] font-bold transition-colors whitespace-nowrap flex items-center shrink-0 cursor-pointer bg-white ${
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

            <div className="flex items-center shrink-0">
              <button 
                onClick={() => loadData(true)} 
                disabled={loading} 
                className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
              >
                <RefreshCw size={18} className="mr-1.5" />
                새로고침
              </button>

              <button 
                onClick={handleSave} 
                disabled={loading || saveStatus === 'loading'} 
                className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50 ${
                  saveStatus === 'success' ? 'text-orange-600' : 'text-gray-500 hover:text-black'
                }`}
              >
                {saveStatus === 'success' ? <CheckCircle2 size={18} className="mr-1.5" /> : <Save size={18} className="mr-1.5" />}
                {saveStatus === 'success' ? '저장완료' : '저장'}
              </button>

              {activeSubTab === 'vcb' && (
                <button 
                  onClick={handlePrint} 
                  className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
                >
                  <Printer size={18} className="mr-1.5" />
                  인쇄
                </button>
              )}
            </div>
          </div>
        </div>

        <div id="substation-log-print-area" className="w-full max-w-7xl mx-auto bg-white text-black">
          <section className={`mb-6 ${activeSubTab === 'vcb' ? '' : 'ui-hidden'}`}>
            <h3 className="ui-hidden text-lg font-bold text-black mb-2 border-l-4 border-black pl-2">1. VCB (특고압수전반)</h3>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse border border-black text-center table-fixed">
                <thead>
                  <tr className="bg-white border-b border-black h-[32px]">
                    <th rowSpan={2} style={{ width: '40px' }} className={thClass}>
                      <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">구분</div>
                    </th>
                    <th colSpan={4} className={thClass}>
                      <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">특고압수전반 (MAIN VCB)</div>
                    </th>
                    <th colSpan={3} className={thClass}>
                      <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">VCB1 (TR1)</div>
                    </th>
                    <th colSpan={3} className={thClass}>
                      <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">VCB2 (TR2)</div>
                    </th>
                    <th colSpan={3} className={thClass}>
                      <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">VCB3 (TR3)</div>
                    </th>
                  </tr>
                  <tr className="bg-white border-b border-black h-[32px]">
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전압(kV)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전류(A)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">역률(%)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">Hz</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전압(kV)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전류(A)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">역률(%)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전압(kV)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전류(A)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">역률(%)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전압(kV)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전류(A)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">역률(%)</div></th>
                  </tr>
                </thead>
                <tbody>
                  {['time9', 'time21'].map((time) => (
                    <tr key={time} className="bg-white border-b border-black h-[32px]">
                      <td className={tdClass}>
                        <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">
                          {time === 'time9' ? '09:00' : '21:00'}
                        </div>
                      </td>
                      <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.vcb?.[time as 'time9' | 'time21']?.main?.v || ''} readOnly /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.main?.a || ''} onChange={e => updateVcb(time as any, 'main', 'a', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.main?.pf || ''} onChange={e => updateVcb(time as any, 'main', 'pf', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.main?.hz || ''} onChange={e => updateVcb(time as any, 'main', 'hz', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr1?.v || ''} readOnly /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr1?.a || ''} onChange={e => updateVcb(time as any, 'tr1', 'a', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr1?.pf || ''} onChange={e => updateVcb(time as any, 'tr1', 'pf', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr2?.v || ''} readOnly /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr2?.a || ''} onChange={e => updateVcb(time as any, 'tr2', 'a', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr2?.pf || ''} onChange={e => updateVcb(time as any, 'tr2', 'pf', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr3?.v || ''} readOnly /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr3?.a || ''} onChange={e => updateVcb(time as any, 'tr3', 'a', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr3?.pf || ''} onChange={e => updateVcb(time as any, 'tr3', 'pf', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`mb-6 ${activeSubTab === 'acb' ? '' : 'ui-hidden'}`}>
            <h3 className="ui-hidden text-lg font-bold text-black mb-2 border-l-4 border-black pl-2">2. ACB / 변압기 온도</h3>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse border border-black text-center table-fixed">
                <thead>
                  <tr className="bg-white border-b border-black h-[32px]">
                    <th rowSpan={2} style={{ width: '40px' }} className={thClass}>
                      <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">구분</div>
                    </th>
                    <th colSpan={3} className={thClass}>
                      <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">LV1 PANEL (ACB1)</div>
                    </th>
                    <th colSpan={3} className={thClass}>
                      <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">LV3 PANEL (ACB2)</div>
                    </th>
                    <th colSpan={3} className={thClass}>
                      <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">LV5 PANEL (ACB3)</div>
                    </th>
                    <th colSpan={3} className={thClass}>
                      <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">변압기 온도</div>
                    </th>
                  </tr>
                  <tr className="bg-white border-b border-black h-[32px]">
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전압(V)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전류(A)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전력(kW)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전압(V)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전류(A)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전력(kW)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전압(V)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전류(A)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">전력(kW)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">TR1(℃)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">TR2(℃)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">TR3(℃)</div></th>
                  </tr>
                </thead>
                <tbody>
                  {['time9', 'time21'].map((time) => (
                    <tr key={time} className="bg-white border-b border-black h-[32px]">
                      <td className={tdClass}>
                        <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">
                          {time === 'time9' ? '09:00' : '21:00'}
                        </div>
                      </td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb1?.v || ''} onChange={e => updateAcb(time as any, 'acb1', 'v', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb1?.a || ''} onChange={e => updateAcb(time as any, 'acb1', 'a', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb1?.kw || ''} onChange={e => updateAcb(time as any, 'acb1', 'kw', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb2?.v || ''} onChange={e => updateAcb(time as any, 'acb2', 'v', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb2?.a || ''} onChange={e => updateAcb(time as any, 'acb2', 'a', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb2?.kw || ''} onChange={e => updateAcb(time as any, 'acb2', 'kw', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb3?.v || ''} onChange={e => updateAcb(time as any, 'acb3', 'v', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb3?.a || ''} onChange={e => updateAcb(time as any, 'acb3', 'a', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb3?.kw || ''} onChange={e => updateAcb(time as any, 'acb3', 'kw', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.trTemp?.tr1 || ''} onChange={e => updateAcb(time as any, 'trTemp', 'tr1', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.trTemp?.tr2 || ''} onChange={e => updateAcb(time as any, 'trTemp', 'tr2', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.trTemp?.tr3 || ''} onChange={e => updateAcb(time as any, 'trTemp', 'tr3', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`mb-6 ${activeSubTab === 'usage' ? '' : 'ui-hidden'}`}>
            <h3 className="ui-hidden text-lg font-bold text-black mb-2 border-l-4 border-black pl-2">3. 전력량 사용 현황</h3>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse border border-black text-center table-fixed">
                <thead>
                  <tr className="bg-white border-b border-black h-[32px]">
                    <th className={thClass} style={{ width: '100px' }}>
                      <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">구분</div>
                    </th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">유효전력 중간(kWh)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">유효전력 최대(kWh)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">유효전력 경부하(kWh)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">무효전력 중간(kVarh)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">무효전력 최대(kVarh)</div></th>
                  </tr>
                </thead>
                <tbody>
                  {['prev', 'curr', 'usage'].map((row) => {
                    const isReadOnlyRow = row === 'usage';
                    const rowLabel = row === 'prev' ? '전일지침' : row === 'curr' ? '금일지침' : '사용량';
                    return (
                      <tr key={row} className="bg-white border-b border-black h-[32px]">
                        <td className={tdClass}>
                          <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">
                            {rowLabel}
                          </div>
                        </td>
                        <td className={tdClass}>
                          <input 
                            type="text" 
                            className={isReadOnlyRow ? readonlyInputClass : inputClass} 
                            value={data.powerUsage?.[row as 'prev' | 'curr' | 'usage']?.activeMid || ''} 
                            onChange={isReadOnlyRow ? undefined : e => updatePower(row as any, 'activeMid', e.target.value)} 
                            readOnly={isReadOnlyRow} 
                          />
                        </td>
                        <td className={tdClass}>
                          <input 
                            type="text" 
                            className={isReadOnlyRow ? readonlyInputClass : inputClass} 
                            value={data.powerUsage?.[row as 'prev' | 'curr' | 'usage']?.activeMax || ''} 
                            onChange={isReadOnlyRow ? undefined : e => updatePower(row as any, 'activeMax', e.target.value)} 
                            readOnly={isReadOnlyRow} 
                          />
                        </td>
                        <td className={tdClass}>
                          <input 
                            type="text" 
                            className={isReadOnlyRow ? readonlyInputClass : inputClass} 
                            value={data.powerUsage?.[row as 'prev' | 'curr' | 'usage']?.activeLight || ''} 
                            onChange={isReadOnlyRow ? undefined : e => updatePower(row as any, 'activeLight', e.target.value)} 
                            readOnly={isReadOnlyRow} 
                          />
                        </td>
                        <td className={tdClass}>
                          <input 
                            type="text" 
                            className={isReadOnlyRow ? readonlyInputClass : inputClass} 
                            value={data.powerUsage?.[row as 'prev' | 'curr' | 'usage']?.reactiveMid || ''} 
                            onChange={isReadOnlyRow ? undefined : e => updatePower(row as any, 'reactiveMid', e.target.value)} 
                            readOnly={isReadOnlyRow} 
                          />
                        </td>
                        <td className={tdClass}>
                          <input 
                            type="text" 
                            className={isReadOnlyRow ? readonlyInputClass : inputClass} 
                            value={data.powerUsage?.[row as 'prev' | 'curr' | 'usage']?.reactiveMax || ''} 
                            onChange={isReadOnlyRow ? undefined : e => updatePower(row as any, 'reactiveMax', e.target.value)} 
                            readOnly={isReadOnlyRow} 
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className={activeSubTab === 'analysis' ? '' : 'ui-hidden'}>
            <h3 className="ui-hidden text-lg font-bold text-black mb-2 border-l-4 border-black pl-2">4. 일 사용량 분석</h3>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse border border-black text-center table-fixed">
                <thead>
                  <tr className="bg-white border-b border-black h-[32px]">
                    <th className={thClass} style={{ width: '100px' }}>
                      <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">구분</div>
                    </th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">유효(kWh)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">무효(kVarh)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">금월누계(kWh)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">최대(kW)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">역율(%)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">부하율(%)</div></th>
                    <th className={thClass}><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">수용율(%)</div></th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white border-b border-black h-[32px]">
                    <td className={tdClass}>
                      <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">금일 사용량</div>
                    </td>
                    <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.activePower || '0'} readOnly /></td>
                    <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.reactivePower || '0'} readOnly /></td>
                    <td className={tdClass}><input type="text" className={`${readonlyInputClass} font-black text-base`} value={data.dailyStats?.monthTotal || '0'} readOnly /></td>
                    <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.maxPower || '0'} readOnly /></td>
                    <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.powerFactor || '0'} readOnly /></td>
                    <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.loadFactor || '0'} readOnly /></td>
                    <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.demandFactor || '0'} readOnly /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </LogSheetLayout>
    </>
  );
};

export default SubstationLog;
