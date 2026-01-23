import { format, startOfMonth, subDays } from 'date-fns';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetchRange, clearCache, deepMerge, fetchDailyData, fetchSubstationLog, getFromStorage, getInitialSubstationLog, saveDailyData, saveSubstationLog, saveToCache } from '../services/dataService';
import { AcbReadings, PowerUsageReadings, SubstationLogData, VcbReadings } from '../types';
import LogSheetLayout from './LogSheetLayout';

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
  
  const historySumRef = useRef<number>(0);
  const isInitialLoad = useRef(true);
  const lastLoadedDate = useRef<string>('');
  const lastSyncedUsageRef = useRef<string>('');

  const safeParseFloat = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const cleaned = val.toString().replace(/,/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  useEffect(() => {
    const currentUsage = data.dailyStats?.activePower;
    if (onUsageChange && currentUsage && currentUsage !== '0' && currentUsage !== lastSyncedUsageRef.current) {
      lastSyncedUsageRef.current = currentUsage;
      onUsageChange(currentUsage);
    }
  }, [data.dailyStats?.activePower, onUsageChange]);

  const calculateDailyAnalysis = useCallback((currentData: SubstationLogData, hSum: number) => {
    if (!currentData) return getInitialSubstationLog(dateKey);
    
    const newData = JSON.parse(JSON.stringify(currentData)) as SubstationLogData; 
    const { powerUsage, dailyStats } = newData;

    if (!powerUsage?.usage || !dailyStats) return newData;

    // 장비 교체 여부 확인 (어느 하나라도 사용량이 빈칸이면 교체 상황으로 간주)
    const isEquipmentReplaced = 
      powerUsage.usage.activeMid === '' || 
      powerUsage.usage.activeMax === '' || 
      powerUsage.usage.activeLight === '' ||
      powerUsage.usage.reactiveMid === '' ||
      powerUsage.usage.reactiveMax === '';

    if (isEquipmentReplaced) {
      dailyStats.activePower = '';
      dailyStats.reactivePower = '';
      dailyStats.monthTotal = Math.round(hSum).toString(); // 전일 누계치만 표시
      dailyStats.maxPower = '';
      dailyStats.powerFactor = '';
      dailyStats.loadFactor = '';
      dailyStats.demandFactor = '';
      return newData;
    }

    const activeMid = safeParseFloat(powerUsage.usage.activeMid);
    const activeMax = safeParseFloat(powerUsage.usage.activeMax);
    const activeLight = safeParseFloat(powerUsage.usage.activeLight);
    const totalActive = activeMid + activeMax + activeLight;

    const reactiveMid = safeParseFloat(powerUsage.usage.reactiveMid);
    const reactiveMax = safeParseFloat(powerUsage.usage.reactiveMax);
    const totalReactive = reactiveMid + reactiveMax;

    dailyStats.activePower = totalActive.toString();
    dailyStats.reactivePower = totalReactive.toString();
    dailyStats.monthTotal = Math.round(hSum + totalActive).toString();

    const vcbMain = newData.vcb?.time9?.main || newData.vcb?.time21?.main;
    if (vcbMain && (vcbMain.pf || vcbMain.a)) {
      const kVA_Const = 1.7321 * 22.9; 
      const pfNum = safeParseFloat(vcbMain.pf);
      const currentA = safeParseFloat(vcbMain.a);
      const maxPowerNum = kVA_Const * currentA * (pfNum / 100);
      dailyStats.maxPower = maxPowerNum > 0 ? Math.round(maxPowerNum).toString() : '0';

      if (totalActive > 0) {
        const pfCalc = (totalActive / Math.sqrt(Math.pow(totalActive, 2) + Math.pow(totalReactive, 2))) * 100;
        dailyStats.powerFactor = isNaN(pfCalc) ? '0' : pfCalc.toFixed(1);
      }

      if (maxPowerNum > 0 && totalActive > 0) {
        const loadFactorCalc = ((totalActive / 24) / maxPowerNum) * 100;
        dailyStats.loadFactor = isNaN(loadFactorCalc) ? '0' : loadFactorCalc.toFixed(1);
      }

      if (maxPowerNum > 0) {
        const demandFactorCalc = (maxPowerNum / 1600) * 100;
        dailyStats.demandFactor = isNaN(demandFactorCalc) ? '0' : demandFactorCalc.toFixed(1);
      }
    }

    return newData;
  }, [dateKey]);

  const loadData = useCallback(async (force = false) => {
    setData(getInitialSubstationLog(dateKey));
    setLoading(true);
    isInitialLoad.current = true;
    setSaveStatus('idle');

    if (force) clearCache(`SUB_LOG_${dateKey}`);

    try {
      const monthStart = startOfMonth(currentDate);
      const monthStartStr = format(monthStart, 'yyyy-MM-dd');
      const yesterdayStr = format(subDays(currentDate, 1), 'yyyy-MM-dd');
      
      let hSum = 0;
      if (currentDate.getDate() > 1) {
        const dailyRows = await apiFetchRange("DAILY_", monthStartStr, yesterdayStr);
        dailyRows.forEach(row => {
          if (row.data?.utility?.electricity) {
            hSum += safeParseFloat(row.data.utility.electricity);
          }
        });
      }
      historySumRef.current = hSum;

      const fetched = await fetchSubstationLog(dateKey, force);
      const cachedDraft = getFromStorage(`SUB_LOG_${dateKey}`, true);
      
      let baseData = fetched || getInitialSubstationLog(dateKey);
      let finalData: SubstationLogData = cachedDraft ? deepMerge(baseData, cachedDraft) : baseData;

      const isPrevEmpty = !finalData.powerUsage.prev?.activeMid || finalData.powerUsage.prev.activeMid === '0' || finalData.powerUsage.prev.activeMid === '';
      
      if (isPrevEmpty) {
          const yesterdaySubDraft = getFromStorage(`SUB_LOG_${yesterdayStr}`, true);
          if (yesterdaySubDraft?.powerUsage?.curr && yesterdaySubDraft.powerUsage.curr.activeMid !== '') {
            finalData.powerUsage.prev = { ...yesterdaySubDraft.powerUsage.curr };
          } else {
            const searchStart = format(subDays(currentDate, 30), 'yyyy-MM-dd');
            const recentLogs = await apiFetchRange("SUB_LOG_", searchStart, yesterdayStr);
            
            if (recentLogs.length > 0) {
              recentLogs.sort((a, b) => b.key.localeCompare(a.key));
              const latestLog = recentLogs[0].data;
              
              if (latestLog?.powerUsage?.curr && latestLog.powerUsage.curr.activeMid !== '') {
                finalData.powerUsage.prev = { ...latestLog.powerUsage.curr };
              }
            }
          }
      }

      if (finalData.powerUsage.prev?.activeMid !== '' && finalData.powerUsage.curr?.activeMid !== '') {
         const fields: (keyof PowerUsageReadings)[] = ['activeMid', 'activeMax', 'activeLight', 'reactiveMid', 'reactiveMax'];
         fields.forEach(field => {
            const p = safeParseFloat(finalData.powerUsage.prev[field]);
            const c = safeParseFloat(finalData.powerUsage.curr[field]);
            if (c > 0) {
              if (c < p) {
                finalData.powerUsage.usage[field] = ''; // 장비 교체 시 빈칸 처리
              } else {
                finalData.powerUsage.usage[field] = Math.round((c - p) * 1200).toString();
              }
            }
         });
      }

      const analyzedData = calculateDailyAnalysis(finalData, hSum);
      setData(analyzedData);
      lastLoadedDate.current = dateKey;
      setTimeout(() => { isInitialLoad.current = false; }, 300);
    } catch (e) { 
      console.error("Substation load error:", e); 
      setData(getInitialSubstationLog(dateKey));
    } finally { 
      setLoading(false); 
    }
  }, [dateKey, currentDate, calculateDailyAnalysis]);

  useEffect(() => { loadData(false); }, [dateKey]);

  useEffect(() => {
    if (isInitialLoad.current || loading) return;
    saveToCache(`SUB_LOG_${dateKey}`, data, true);
  }, [data, dateKey, loading]);

  const handleSave = async () => {
    if (saveStatus === 'loading') return;
    setSaveStatus('loading');
    try {
      const success = await saveSubstationLog(data);
      if (success) {
        const currentDaily = await fetchDailyData(dateKey);
        await saveDailyData({
          ...currentDaily,
          utility: { ...currentDaily.utility, electricity: data.dailyStats.activePower }
        });
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장에 실패했습니다.');
      }
    } catch (e) { setSaveStatus('error'); }
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
    if (row === 'prev' || row === 'usage') return; 
    setData(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as SubstationLogData;
      if (next.powerUsage) {
        next.powerUsage[row][field] = value;
        if (row === 'curr') {
          const p = safeParseFloat(next.powerUsage.prev[field]);
          const c = safeParseFloat(next.powerUsage.curr[field]);
          if (c > 0) {
            if (c < p) {
              next.powerUsage.usage[field] = ''; // 장비 교체 시 빈칸 처리
            } else {
              next.powerUsage.usage[field] = Math.round((c - p) * 1200).toString();
            }
          } else {
            next.powerUsage.usage[field] = '';
          }
        }
      }
      return calculateDailyAnalysis(next, historySumRef.current);
    });
  };

  const handlePrint = () => {
    const printContent = document.getElementById('substation-log-print-area');
    if (!printContent) return;
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const formattedYear = format(currentDate, 'yyyy');
    const formattedMonth = format(currentDate, 'MM');
    const formattedDay = format(currentDate, 'dd');
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
            body { 
              background: #f1f5f9 !important; 
              font-family: sans-serif; 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact;
              width: 100%; 
              margin: 0; 
              padding: 0; 
            }
            .no-print { margin: 20px; display: flex; gap: 10px; justify-content: center; }
            @media print { .no-print { display: none !important; } body { background: white !important; } }
            
            .print-page { 
              width: 210mm; 
              min-height: 297mm;
              padding: 25mm 10mm 10mm 10mm;
              margin: 0 auto;
              box-sizing: border-box;
              background: white !important;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            @media print { .print-page { box-shadow: none !important; margin: 0; } }

            table { 
              width: 100% !important; 
              border-collapse: collapse !important; 
              border: 1.2px solid black !important; 
              table-layout: fixed !important; 
              margin-bottom: 12px; 
              background: white !important; 
            }
            th, td { 
              border: 1px solid black !important; 
              border-color: black !important;
              border-style: solid !important;
              text-align: center !important; 
              height: 42px !important; 
              color: black !important; 
              background: white !important; 
              box-sizing: border-box !important;
              padding: 0 !important;
              border-width: 1px !important;
            }
            th { 
              font-weight: bold !important; 
              height: 38px !important; 
              font-size: 8.5pt !important; 
              background-color: #f9fafb !important;
            }
            td { 
              font-size: 10pt !important; 
            }
            input { 
              border: none !important; 
              width: 100% !important; 
              text-align: center !important; 
              font-size: 10.5pt !important; 
              height: 100% !important; 
              font-weight: bold !important; 
              color: black !important; 
              background: transparent !important; 
            }
            .flex-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; min-height: 100px; }
            .title-box { flex: 1; text-align: center; }
            .doc-title { font-size: 32pt; font-weight: 900; letter-spacing: 4px; white-space: nowrap; margin: 0; padding: 0; line-height: 1.0; color: black !important; }
            
            .approval-table { 
              width: 90mm !important; 
              border: 1.5px solid black !important; 
              border-collapse: collapse !important; 
              margin-left: auto; 
              flex-shrink: 0; 
              table-layout: fixed !important;
            }
            .approval-table th { 
              height: 22px !important; 
              font-size: 8.5pt !important; 
              background: #f3f4f6 !important; 
              padding: 0 !important; 
              font-weight: bold; 
              border: 1px solid black !important;
            }
            .approval-table td { 
              height: 70px !important; 
              border: 1px solid black !important;
              background: white !important;
            }
            .approval-table .side-header { 
              width: 28px !important; 
            }
            
            .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold; font-size: 11pt; clear: both; color: black !important; }
            
            h3 { 
              font-size: 12.5pt !important; 
              margin-top: 15px !important; 
              margin-bottom: 8px !important; 
              font-weight: 900 !important; 
              border-left: 7px solid black !important; 
              padding-left: 10px; 
              color: black !important; 
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button>
          </div>
          <div class="print-page">
            <div class="flex-header">
              <div class="title-box">
                <div class="doc-title">수변전반일지</div>
              </div>
              <table class="approval-table">
                <tr>
                  <th rowspan="2" class="side-header">결<br>재</th>
                  <th>담 당</th>
                  <th>주 임</th>
                  <th>대 리</th>
                  <th>과 장</th>
                  <th>소 장</th>
                </tr>
                <tr><td></td><td></td><td></td><td></td><td></td></tr>
              </table>
            </div>
            
            <div class="info-row">
              <div>${formattedYear}년 ${formattedMonth}월 ${formattedDay}일 ${formattedDayName}</div>
            </div>

            <div class="overflow-visible">
              ${printContent.innerHTML}
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const inputClass = "w-full text-center h-full py-2 outline-none bg-transparent text-black text-sm font-bold focus:ring-1 focus:ring-gray-400";
  const readonlyInputClass = "w-full text-center h-full py-2 outline-none bg-transparent text-black text-sm font-extrabold cursor-not-allowed opacity-80 bg-gray-50/30";
  const thClass = "border border-black px-0.5 py-2 font-bold bg-gray-50 text-gray-700 align-middle text-xs";
  const tdClass = "border border-black p-0 h-10 align-middle relative bg-transparent";

  return (
    <LogSheetLayout title="수변전반 일지" loading={loading} saveStatus={saveStatus} onUsageChange={onUsageChange} onRefresh={() => loadData(true)} onSave={handleSave} onPrint={handlePrint} isEmbedded={isEmbedded} hideSave={false}>
      <div id="substation-log-print-area" className="bg-white text-black">
        <section className="mb-6">
          <h3 className="text-lg font-bold text-black mb-2 border-l-4 border-black pl-2">1. VCB (특고압수전반)</h3>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full border-collapse text-center table-fixed bg-white print:min-w-0 border-black">
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: '40px' }} className={thClass}>구분</th>
                  <th colSpan={4} className={thClass}>특고압수전반 (MAIN VCB)</th>
                  <th colSpan={3} className={thClass}>VCB1 (TR1)</th>
                  <th colSpan={3} className={thClass}>VCB2 (TR2)</th>
                  <th colSpan={3} className={thClass}>VCB3 (TR3)</th>
                </tr>
                <tr>
                  <th className={thClass}>전압(kV)</th><th className={thClass}>전류(A)</th><th className={thClass}>역률(%)</th><th className={thClass}>Hz</th>
                  <th className={thClass}>전압(kV)</th><th className={thClass}>전류(A)</th><th className={thClass}>역률(%)</th>
                  <th className={thClass}>전압(kV)</th><th className={thClass}>전류(A)</th><th className={thClass}>역률(%)</th>
                  <th className={thClass}>전압(kV)</th><th className={thClass}>전류(A)</th><th className={thClass}>역률(%)</th>
                </tr>
              </thead>
              <tbody>
                {['time9', 'time21'].map((time) => (
                  <tr key={time}>
                    <td className="border border-black font-bold text-xs bg-gray-50 text-gray-700">{time === 'time9' ? '09:00' : '21:00'}</td>
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

        <section className="mb-6">
          <h3 className="text-lg font-bold text-black mb-2 border-l-4 border-black pl-2">2. ACB / 변압기 온도</h3>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full border-collapse text-center table-fixed bg-white print:min-w-0 border-black">
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: '40px' }} className={thClass}>구분</th>
                  <th colSpan={3} className={thClass}>LV1 PANEL (ACB1)</th>
                  <th colSpan={3} className={thClass}>LV3 PANEL (ACB2)</th>
                  <th colSpan={3} className={thClass}>LV5 PANEL (ACB3)</th>
                  <th colSpan={3} className={thClass}>변압기 온도</th>
                </tr>
                <tr>
                  <th className={thClass}>전압(V)</th><th className={thClass}>전류(A)</th><th className={thClass}>전력(kW)</th>
                  <th className={thClass}>전압(V)</th><th className={thClass}>전류(A)</th><th className={thClass}>전력(kW)</th>
                  <th className={thClass}>전압(V)</th><th className={thClass}>전류(A)</th><th className={thClass}>전력(kW)</th>
                  <th className={thClass}>TR1(℃)</th><th className={thClass}>TR2(℃)</th><th className={thClass}>TR3(℃)</th>
                </tr>
              </thead>
              <tbody>
                {['time9', 'time21'].map((time) => (
                  <tr key={time}>
                    <td className="border border-black font-bold text-xs bg-gray-50 text-gray-700">{time === 'time9' ? '09:00' : '21:00'}</td>
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

        <section className="mb-6">
          <h3 className="text-lg font-bold text-black mb-2 border-l-4 border-black pl-2">3. 전력량 사용 현황</h3>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full border-collapse text-center table-fixed bg-white border-black">
              <thead>
                <tr>
                  <th className={thClass} style={{ width: '100px' }}>구분</th>
                  <th className={thClass}>유효전력 중간(kWh)</th>
                  <th className={thClass}>유효전력 최대(kWh)</th>
                  <th className={thClass}>유효전력 경부하(kWh)</th>
                  <th className={thClass}>무효전력 중간(kVarh)</th>
                  <th className={thClass}>무효전력 최대(kVarh)</th>
                </tr>
              </thead>
              <tbody>
                {['prev', 'curr', 'usage'].map((row) => {
                  const isReadOnlyRow = row === 'usage' || row === 'prev';
                  return (
                    <tr key={row}>
                      <td className="border border-black font-bold text-xs bg-gray-50 text-gray-700">{row === 'prev' ? '전일지침' : row === 'curr' ? '금일지침' : '사용량'}</td>
                      <td className={tdClass}><input type="text" className={isReadOnlyRow ? readonlyInputClass : inputClass} value={data.powerUsage?.[row as 'prev' | 'curr' | 'usage']?.activeMid || ''} onChange={isReadOnlyRow ? undefined : e => updatePower(row as any, 'activeMid', e.target.value)} readOnly={isReadOnlyRow} /></td>
                      <td className={tdClass}><input type="text" className={isReadOnlyRow ? readonlyInputClass : inputClass} value={data.powerUsage?.[row as 'prev' | 'curr' | 'usage']?.activeMax || ''} onChange={isReadOnlyRow ? undefined : e => updatePower(row as any, 'activeMax', e.target.value)} readOnly={isReadOnlyRow} /></td>
                      <td className={tdClass}><input type="text" className={isReadOnlyRow ? readonlyInputClass : inputClass} value={data.powerUsage?.[row as 'prev' | 'curr' | 'usage']?.activeLight || ''} onChange={isReadOnlyRow ? undefined : e => updatePower(row as any, 'activeLight', e.target.value)} readOnly={isReadOnlyRow} /></td>
                      <td className={tdClass}><input type="text" className={isReadOnlyRow ? readonlyInputClass : inputClass} value={data.powerUsage?.[row as 'prev' | 'curr' | 'usage']?.reactiveMid || ''} onChange={isReadOnlyRow ? undefined : e => updatePower(row as any, 'reactiveMid', e.target.value)} readOnly={isReadOnlyRow} /></td>
                      <td className={tdClass}><input type="text" className={isReadOnlyRow ? readonlyInputClass : inputClass} value={data.powerUsage?.[row as 'prev' | 'curr' | 'usage']?.reactiveMax || ''} onChange={isReadOnlyRow ? undefined : e => updatePower(row as any, 'reactiveMax', e.target.value)} readOnly={isReadOnlyRow} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-bold text-black mb-2 border-l-4 border-black pl-2">4. 일 사용량 분석</h3>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full border-collapse table-fixed bg-white border-black">
              <thead>
                <tr>
                  <th className={thClass} style={{ width: '100px' }}>구분</th>
                  <th className={thClass}>유효(kWh)</th>
                  <th className={thClass}>무효(kVarh)</th>
                  <th className={thClass}>금월누계(kWh)</th>
                  <th className={thClass}>최대(kW)</th>
                  <th className={thClass}>역율(%)</th>
                  <th className={thClass}>부하율(%)</th>
                  <th className={thClass}>수용율(%)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="h-10">
                  <td className="border border-black font-bold text-sm bg-gray-50 text-gray-700 text-center">금일 사용량</td>
                  <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.activePower || ''} readOnly /></td>
                  <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.reactivePower || ''} readOnly /></td>
                  <td className={tdClass}><input type="text" className={`${readonlyInputClass} font-black text-base`} value={data.dailyStats?.monthTotal || ''} readOnly /></td>
                  <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.maxPower || ''} readOnly /></td>
                  <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.powerFactor || ''} readOnly /></td>
                  <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.loadFactor || ''} readOnly /></td>
                  <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.demandFactor || ''} readOnly /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </LogSheetLayout>
  );
};

export default SubstationLog;
