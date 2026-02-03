
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HvacLogData, HvacLogItem, BoilerLogData, BoilerLogItem } from '../types';
import { 
  getInitialHvacLog, 
  getInitialBoilerLog, 
  fetchDailyData, 
  saveDailyData, 
  apiFetchBatch,
  saveHvacBoilerCombined,
  getInitialDailyData
} from '../services/dataService';
import { format, subDays, parseISO } from 'date-fns';
import LogSheetLayout from './LogSheetLayout';
import { Save, RefreshCw, CheckCircle2, Cloud, X } from 'lucide-react';

interface HvacLogProps {
  currentDate: Date;
  isEmbedded?: boolean;
  onUsageChange?: (hGas: string, bGas: string) => void;
}

const HvacLog: React.FC<HvacLogProps> = ({ currentDate, isEmbedded = false, onUsageChange }) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  
  const [data, setData] = useState<HvacLogData>(getInitialHvacLog(dateKey));
  const [boilerData, setBoilerData] = useState<BoilerLogData>(getInitialBoilerLog(dateKey));
  
  const historySumsRef = useRef({ hvac: 0, boiler: 0 });
  const isInitialLoad = useRef(true);
  const lastLoadedDate = useRef<string>('');
  const lastSyncedUsageRef = useRef({ hvac: '', boiler: '' });

  const safeParseFloat = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const cleaned = val.toString().replace(/,/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  useEffect(() => {
    const hUsage = data.gas?.usage || '0';
    const bUsage = boilerData.gas?.usage || '0';
    
    if (onUsageChange && (hUsage !== lastSyncedUsageRef.current.hvac || bUsage !== lastSyncedUsageRef.current.boiler)) {
      lastSyncedUsageRef.current = { hvac: hUsage, boiler: bUsage };
      onUsageChange(hUsage, bUsage);
    }
  }, [data.gas?.usage, boilerData.gas?.usage, onUsageChange]);

  const calculateHourDiff = (timeRange: string): number => {
    if (!timeRange || !timeRange.includes('~')) return 0;
    const parts = timeRange.split('~').map(s => s.trim());
    if (parts.length < 2) return 0;
    const [start, end] = parts;
    const sParts = start.split(':');
    const eParts = end.split(':');
    if (sParts.length < 2 || eParts.length < 2) return 0;
    const sH = parseInt(sParts[0]); const sM = parseInt(sParts[1]);
    const eH = parseInt(eParts[0]); const eM = parseInt(eParts[1]);
    if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return 0;
    const startMinutes = sH * 60 + sM;
    let endMinutes = eH * 60 + eM;
    if (endMinutes < startMinutes) endMinutes += 24 * 60;
    return (endMinutes - startMinutes) / 60;
  };

  const loadData = useCallback(async (force = false) => {
    setData(getInitialHvacLog(dateKey));
    setBoilerData(getInitialBoilerLog(dateKey));

    setLoading(true);
    setSaveStatus('idle');
    isInitialLoad.current = true;

    try {
      const yesterdayStr = format(subDays(currentDate, 1), 'yyyy-MM-dd');
      const searchStart = format(subDays(currentDate, 14), 'yyyy-MM-dd');

      const batchResults = await apiFetchBatch([
        { type: 'get', key: `HVAC_BOILER_${dateKey}` },
        { type: 'range', prefix: "HVAC_LOG_", start: searchStart, end: yesterdayStr },
        { type: 'range', prefix: "BOILER_LOG_", start: searchStart, end: yesterdayStr }
      ]);
      
      const combinedRow = batchResults[0]?.data;
      const hvacFromServer = combinedRow?.hvac_data as HvacLogData;
      const boilerFromServer = combinedRow?.boiler_data as BoilerLogData;
      
      const recentHvacLogs = batchResults[1]?.data || [];
      const recentBoilerLogs = batchResults[2]?.data || [];

      let finalHvac = hvacFromServer || getInitialHvacLog(dateKey);
      let finalBoiler = boilerFromServer || getInitialBoilerLog(dateKey);

      if (finalBoiler.logs.length < 3) {
        const initial = getInitialBoilerLog(dateKey);
        finalBoiler.logs = [
          ...finalBoiler.logs,
          ...initial.logs.slice(finalBoiler.logs.length)
        ];
      }

      let hBase = 0;
      let bBase = 0;

      if (recentHvacLogs.length > 0) {
        recentHvacLogs.sort((a: any, b: any) => b.key.localeCompare(a.key));
        const latest = recentHvacLogs[0];
        const datePart = latest.key.replace('HVAC_BOILER_', '').replace('HVAC_LOG_', '');
        const latestDate = parseISO(datePart);
        
        if (latestDate.getMonth() === currentDate.getMonth() && latestDate.getFullYear() === currentDate.getFullYear()) {
          hBase = safeParseFloat(latest.data?.gas?.monthTotal);
        }
        
        if (finalHvac.gas && (!finalHvac.gas.prev || finalHvac.gas.prev === '0' || finalHvac.gas.prev === '')) {
          if (latest.data?.gas?.curr) finalHvac.gas.prev = latest.data.gas.curr;
        }
        if (finalHvac.sterilizer && (!finalHvac.sterilizer.prevStock || finalHvac.sterilizer.prevStock === '0' || finalHvac.sterilizer.prevStock === '')) {
          if (latest.data?.sterilizer?.stock) {
            finalHvac.sterilizer.prevStock = latest.data.sterilizer.stock;
          }
        }
      }

      if (recentBoilerLogs.length > 0) {
        recentBoilerLogs.sort((a: any, b: any) => b.key.localeCompare(a.key));
        const latest = recentBoilerLogs[0];
        const datePart = latest.key.replace('HVAC_BOILER_', '').replace('BOILER_LOG_', '');
        const latestDate = parseISO(datePart);
        
        if (latestDate.getMonth() === currentDate.getMonth() && latestDate.getFullYear() === currentDate.getFullYear()) {
          bBase = safeParseFloat(latest.data?.gas?.monthTotal);
        }
        
        if (finalBoiler.gas && (!finalBoiler.gas.prev || finalBoiler.gas.prev === '0' || finalBoiler.gas.prev === '')) {
          if (latest.data?.gas?.curr) finalBoiler.gas.prev = latest.data.gas.curr;
        }
        if (finalBoiler.salt && (!finalBoiler.salt.prevStock || finalBoiler.salt.prevStock === '0' || finalBoiler.salt.prevStock === '')) {
          if (latest.data?.salt?.stock) finalBoiler.salt.prevStock = latest.data.salt.stock;
        }
        if (finalBoiler.cleaner && (!finalBoiler.cleaner.prevStock || finalBoiler.cleaner.prevStock === '0' || finalBoiler.cleaner.prevStock === '')) {
          if (latest.data?.cleaner?.stock) finalBoiler.cleaner.prevStock = latest.data.cleaner.stock;
        }
      }

      historySumsRef.current = { hvac: hBase, boiler: bBase };

      if (finalHvac.gas) {
        const p = safeParseFloat(finalHvac.gas.prev);
        const c = safeParseFloat(finalHvac.gas.curr);
        if (c > 0 && c < p) {
          finalHvac.gas.usage = '';
          finalHvac.gas.monthTotal = Math.round(hBase).toString();
        } else {
          const hUsage = Math.max(0, c - p);
          finalHvac.gas.usage = hUsage > 0 ? Math.round(hUsage).toString() : (finalHvac.gas.curr ? '0' : '');
          finalHvac.gas.monthTotal = Math.round(hBase + hUsage).toString();
        }
      }
      if (finalBoiler.gas) {
        const p = safeParseFloat(finalBoiler.gas.prev);
        const c = safeParseFloat(finalBoiler.gas.curr);
        if (c > 0 && c < p) {
          finalBoiler.gas.usage = '';
          finalBoiler.gas.monthTotal = Math.round(bBase).toString();
        } else {
          const bUsage = Math.max(0, c - p);
          finalBoiler.gas.usage = bUsage > 0 ? Math.round(bUsage).toString() : (finalBoiler.gas.curr ? '0' : '');
          finalBoiler.gas.monthTotal = Math.round(bBase + bUsage).toString();
        }
      }

      if (finalHvac.sterilizer) {
          const p = safeParseFloat(finalHvac.sterilizer.prevStock);
          const i = safeParseFloat(finalHvac.sterilizer.inQty);
          const u = safeParseFloat(finalHvac.sterilizer.usedQty);
          finalHvac.sterilizer.stock = (p + i - u).toString();
      }
      if (finalBoiler.salt) {
          const p = safeParseFloat(finalBoiler.salt.prevStock);
          const i = safeParseFloat(finalBoiler.salt.inQty);
          const u = safeParseFloat(finalBoiler.salt.usedQty);
          finalBoiler.salt.stock = (p + i - u).toString();
      }
      if (finalBoiler.cleaner) {
          const p = safeParseFloat(finalBoiler.cleaner.prevStock);
          const i = safeParseFloat(finalBoiler.cleaner.inQty);
          const u = safeParseFloat(finalBoiler.cleaner.usedQty);
          finalBoiler.cleaner.stock = (p + i - u).toString();
      }

      setData(finalHvac);
      setBoilerData(finalBoiler);
      lastLoadedDate.current = dateKey;
      setTimeout(() => { isInitialLoad.current = false; }, 300);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [dateKey, currentDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleManualSave = async () => {
    setShowSaveConfirm(false);
    if (saveStatus === 'loading') return;
    setSaveStatus('loading');
    try {
      // 1. 상세 로그 저장 (통합 테이블)
      const success = await saveHvacBoilerCombined(data, boilerData);
      
      // 2. 메인 일지 동기화 (가스 사용량 업데이트)
      let currentDaily = await fetchDailyData(dateKey, true);
      if (!currentDaily) currentDaily = getInitialDailyData(dateKey);
      
      await saveDailyData({
        ...currentDaily,
        utility: { 
            ...currentDaily.utility, 
            hvacGas: data.gas?.usage || '', 
            boilerGas: boilerData.gas?.usage || '' 
        },
        lastUpdated: new Date().toISOString()
      });
      
      if (success) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장에 실패했습니다.');
      }
    } catch (err) { 
        console.error(err);
        setSaveStatus('error'); 
    }
  };

  const updateHvacNestedField = (parent: 'gas' | 'sterilizer', field: string, value: string) => {
    setData(prev => {
      if (!prev) return prev;
      const newState = { ...prev };
      if (parent === 'gas') {
        const currentGas = prev.gas || { prev: '', curr: '', usage: '', monthTotal: '' };
        const updated = { ...currentGas, [field]: value };
        const p = safeParseFloat(updated.prev);
        const c = safeParseFloat(updated.curr);
        if (c > 0 && c < p) {
          updated.usage = '';
          updated.monthTotal = Math.round(historySumsRef.current.hvac).toString();
        } else {
          const u = Math.max(0, c - p);
          updated.usage = u > 0 ? Math.round(u).toString() : '0';
          updated.monthTotal = Math.round(historySumsRef.current.hvac + u).toString();
        }
        newState.gas = updated;
      } else {
        const currentSterilizer = prev.sterilizer || { prevStock: '', inQty: '', usedQty: '', stock: '' };
        const updated = { ...currentSterilizer, [field]: value };
        const p = safeParseFloat(updated.prevStock);
        const i = safeParseFloat(updated.inQty);
        const u = safeParseFloat(updated.usedQty);
        updated.stock = (p + i - u).toString();
        newState.sterilizer = updated;
      }
      return newState;
    });
  };

  const updateBoilerNestedField = (parent: 'gas' | 'salt' | 'cleaner', field: string, value: string) => {
    setBoilerData(prev => {
      if (!prev) return prev;
      const target = (prev as any)[parent] || { prevStock: '', inQty: '', usedQty: '', stock: '', prev: '', curr: '', usage: '', monthTotal: '' };
      const updated = { ...target, [field]: value };
      const newState = { ...prev };
      if (parent === 'gas') {
        const p = safeParseFloat(updated.prev);
        const c = safeParseFloat(updated.curr);
        if (c > 0 && c < p) {
          updated.usage = '';
          updated.monthTotal = Math.round(historySumsRef.current.boiler).toString();
        } else {
          const u = Math.max(0, c - p);
          updated.usage = u > 0 ? Math.round(u).toString() : '0';
          updated.monthTotal = Math.round(historySumsRef.current.boiler + u).toString();
        }
        newState.gas = updated;
      } else {
        const p = safeParseFloat(updated.prevStock);
        const i = safeParseFloat(updated.inQty);
        const u = safeParseFloat(updated.usedQty);
        updated.stock = (p + i - u).toString();
        (newState as any)[parent] = updated;
      }
      return newState;
    });
  };

  const handleTimeChange = (type: 'hvac' | 'boiler', idx: number, part: 'start' | 'end', val: string) => {
    if (type === 'hvac') {
      setData(prev => {
        const newLogs = [...prev.hvacLogs];
        const currentLog = newLogs[idx] || { id: (idx + 1).toString(), runTime: '' };
        const [start, end] = (currentLog.runTime || '').split('~').map(s => s.trim());
        const newRange = part === 'start' ? `${val}~${end || ''}` : `${start || ''}~${val}`;
        newLogs[idx] = { ...currentLog, runTime: newRange };
        let total = 0;
        newLogs.forEach(log => { total += calculateHourDiff(log.runTime); });
        return { ...prev, hvacLogs: newLogs, totalRunTime: total > 0 ? total.toFixed(1) : '' };
      });
    } else {
      setBoilerData(prev => {
        const newLogs = [...prev.logs];
        const currentLog = newLogs[idx];
        const [start, end] = (currentLog.runTime || '').split('~').map(s => s.trim());
        const newRange = part === 'start' ? `${val}~${end || ''}` : `${start || ''}~${val}`;
        newLogs[idx] = { ...currentLog, runTime: newRange };
        let total = 0;
        newLogs.forEach(log => { total += calculateHourDiff(log.runTime); });
        return { ...prev, logs: newLogs, totalRunTime: total > 0 ? total.toFixed(1) : '' };
      });
    }
  };

  const handlePrint = () => {
    const combinedContent = document.getElementById('combined-hvac-boiler-area');
    if (!combinedContent) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>기계설비운전일지 - ${dateKey}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { 
              background: #f1f5f9; 
              font-family: sans-serif; 
              margin: 0; 
              padding: 0;
            }
            .no-print { 
              margin: 20px; 
              display: flex; 
              gap: 10px; 
              justify-content: center; 
            }
            .print-wrap {
              width: 100%;
              max-width: 210mm;
              margin: 0 auto;
              padding: 10mm 10mm 20mm 10mm;
              box-sizing: border-box;
              background: white;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            @media print {
              @page { 
                margin: 0; 
                size: A4 portrait; 
              }
              body { 
                background: transparent !important; 
                -webkit-print-color-adjust: exact; 
                width: 100%; 
                margin: 0; 
                color: black !important; 
                letter-spacing: -0.8px; 
              }
              .no-print { display: none !important; }
              .print-wrap {
                margin: 0;
                padding: 10mm 10mm 20mm 10mm;
                box-shadow: none !important;
              }
              table { 
                width: 100% !important; 
                border-collapse: collapse !important; 
                border: 1.2px solid black !important; 
                table-layout: fixed !important; 
                margin-bottom: 3px; 
              }
              th, td { 
                border: 1.2px solid black !important; 
                text-align: center !important; 
                height: 26px !important; 
                color: black !important; 
                padding: 0px !important; 
                line-height: 1.0 !important; 
              }
              th { 
                font-weight: bold !important; 
                background-color: #f2f2f2 !important; 
                font-size: 8.5pt !important; 
                height: 25px !important; 
              }
              td { 
                font-size: 9.5pt !important; 
              }
              input { 
                border: none !important; 
                width: 100% !important; 
                text-align: center !important; 
                font-size: 9.5pt !important; 
                height: 100% !important; 
                font-weight: bold !important; 
                color: black !important; 
                background: transparent !important; 
                letter-spacing: -0.5px; 
              }
              h3 { 
                font-size: 14pt !important; 
                margin-bottom: 6px !important; 
                font-weight: 900 !important; 
                border-left: 7px solid black !important; 
                padding-left: 12px !important; 
                margin-top: 15px !important; 
                color: black !important; 
                line-height: 1.2 !important;
              }
              .unit-span { font-size: 7.5pt !important; font-weight: bold !important; margin-left: 1px !important; }
              select { appearance: none !important; border: none !important; background: transparent !important; text-align: center !important; width: auto !important; font-weight: 900 !important; font-size: 13pt !important; color: black !important; padding: 0 !important; margin: 0 !important; }
              .unit-header { font-size: 13pt !important; font-weight: 900 !important; color: black !important; height: 36px !important; }
              hr { margin-top: 5px !important; margin-bottom: 5px !important; border-top: 1.5px solid black !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button>
          </div>
          <div class="print-wrap">
            <div id="print-body-content">${combinedContent.innerHTML}</div>
          </div>
          <script>window.onload = function() { const inputs = document.querySelectorAll('input'); inputs.forEach(input => i.setAttribute('value', i.value)); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const thClass = "border border-gray-300 bg-gray-50 p-2 font-bold text-center align-middle text-sm text-gray-700 h-9";
  const tdClass = "border border-gray-300 p-0 h-9 relative bg-transparent";

  const renderCellWithUnit = (value: string | undefined, onChange: (val: string) => void, unit: string, isReadonly = false) => (
    <div className="flex items-center h-full w-full">
        <input type="text" className={`flex-1 min-w-0 h-full text-center outline-none bg-transparent text-black text-sm font-bold px-2 ${isReadonly ? 'cursor-not-allowed opacity-70' : ''}`} value={value || ''} onChange={(e) => onChange(e.target.value)} readOnly={isReadonly} />
        {unit && <span className="text-[11px] text-gray-500 font-bold whitespace-nowrap min-w-[45px] text-left unit-span">{unit}</span>}
    </div>
  );

  const hvacMainRows = [
    { label: '냉, 온수 입구온도', unit: '℃', key: 'inletTempColdHot' },
    { label: '냉, 온수 출구온도', unit: '℃', key: 'outletTempColdHot' },
    { label: '냉, 온수 출구압력', unit: 'kg/cm²', key: 'outletPressColdHot' },
    { label: '냉각수 입구온도', unit: '℃', key: 'inletTempCooling' },
    { label: '냉각수 출구온도', unit: '℃', key: 'outletTempCooling' },
    { label: '냉각수 출력압력', unit: 'kg/cm²', key: 'outletPressCooling' },
    { label: '저온 재생기 온도', unit: '℃', key: 'tempLowGen' },
    { label: '고온 재생기 온도', unit: '℃', key: 'tempHighGen' },
    { label: '배기 가스 온도', unit: '℃', key: 'tempExhaust' },
    { label: '재 생 기  압 력', unit: 'mmHg', key: 'pressGen' },
    { label: '1 차 가 스 압 력', unit: 'kg/㎠', key: 'pressGas1' },
    { label: '2 차 가 스 압 력', unit: '㎜Aq', key: 'pressGas2' },
    { label: '제 어 밸 브 개 도', unit: '%', key: 'valveOpening' },
  ];

  return (
    <>
      <LogSheetLayout 
          title="기계설비 운전일지" 
          loading={loading} 
          saveStatus={saveStatus} 
          onPrint={handlePrint} 
          isEmbedded={isEmbedded} 
          onSave={() => setShowSaveConfirm(true)} 
          onRefresh={() => loadData(true)} 
          hideSave={true} 
          hideRefresh={false}
      >
        <div id="combined-hvac-boiler-area" className="bg-transparent space-y-2 p-1">
          <section className="max-w-[1050px] mx-auto">
            <h3 className="text-lg font-bold text-black mb-1 border-l-4 border-black pl-2">1. 냉·온수기 가동 현황</h3>
            <div className="flex flex-col gap-2">
              <div className="overflow-x-auto">
                  <table className="w-full border-collapse bg-transparent border border-gray-300">
                      <thead>
                          <tr>
                              <th rowSpan={2} className={`${thClass} w-48`}>점검 항목</th>
                              <th colSpan={2} className={`${thClass} h-[45px] text-xl font-black text-black unit-header`}>
                                  냉,온수기 (<span className="hidden print:inline-block">{data.unitNo || ''}</span><select value={data.unitNo || ''} onChange={(e) => setData(prev => ({...prev, unitNo: e.target.value}))} className="bg-transparent text-black font-black outline-none cursor-pointer px-1 appearance-none border-none text-xl print:hidden"><option value=""> </option><option value="1">1</option><option value="2">2</option></select>) 호기
                              </th>
                          </tr>
                          <tr><th className={thClass}>10:00</th><th className={thClass}>15:00</th></tr>
                      </thead>
                      <tbody>
                          {hvacMainRows.map((row) => (
                            <tr key={row.key}>
                              <td className={`${thClass} text-left pl-3 font-medium`}>{row.label}</td>
                              <td className={tdClass}>{renderCellWithUnit((data[row.key as keyof HvacLogData] as any)?.time10, (v) => setData(prev => ({...prev, [row.key]: {...(prev[row.key as keyof HvacLogData] as any), time10: v}})), row.unit)}</td>
                              <td className={tdClass}>{renderCellWithUnit((data[row.key as keyof HvacLogData] as any)?.time15, (v) => setData(prev => ({...prev, [row.key]: {...(prev[row.key as keyof HvacLogData] as any), time15: v}})), row.unit)}</td>
                            </tr>
                          ))}
                          <tr>
                              <td className={`${thClass} text-left pl-3 font-medium`}>운 전 시 간</td>
                              <td colSpan={2} className={tdClass}>
                                  <div className="flex items-center justify-center h-full px-4">
                                      <input type="text" className="w-28 text-center outline-none bg-white border border-gray-200 rounded px-2 font-bold text-sm text-blue-700 shadow-sm" value={(data.hvacLogs?.[0]?.runTime || '').split('~')[0] || ''} onChange={e => handleTimeChange('hvac', 0, 'start', e.target.value)} placeholder="00:00" />
                                      <span className="px-6 font-bold text-gray-800">~</span>
                                      <input type="text" className="w-28 text-center outline-none bg-white border border-gray-200 rounded px-2 font-bold text-sm text-blue-700 shadow-sm" value={(data.hvacLogs?.[0]?.runTime || '').split('~')[1] || ''} onChange={e => handleTimeChange('hvac', 0, 'end', e.target.value)} placeholder="00:00" />
                                  </div>
                              </td>
                          </tr>
                          <tr><td className={`${thClass} text-left pl-3 font-medium`}>총 가 동 시 간</td><td colSpan={2} className={tdClass}><input type="text" className="w-full h-full text-center outline-none font-extrabold text-blue-700 text-base bg-transparent" value={data.totalRunTime ? `${data.totalRunTime} H` : ''} readOnly /></td></tr>
                      </tbody>
                  </table>
              </div>
              <div className="flex flex-col gap-1.5">
                  <table className="w-full border-collapse bg-transparent table-fixed border border-gray-300">
                    <thead><tr><th className={`${thClass} w-[20%] whitespace-nowrap`}>구분</th><th className={`${thClass} w-[20%]`}>전일(m³)</th><th className={`${thClass} w-[20%]`}>금일(m³)</th><th className={`${thClass} w-[20%]`}>사용(m³)</th><th className={`${thClass} w-[20%]`}>누계(m³)</th></tr></thead>
                    <tbody><tr><td className={`${thClass} whitespace-nowrap font-medium`}>냉,온수기 가스 사용량</td><td className={tdClass}>{renderCellWithUnit(data.gas?.prev, (v) => updateHvacNestedField('gas', 'prev', v), '')}</td><td className={tdClass}>{renderCellWithUnit(data.gas?.curr, (v) => updateHvacNestedField('gas', 'curr', v), '')}</td><td className={tdClass}>{renderCellWithUnit(data.gas?.usage, () => {}, '', true)}</td><td className={tdClass}>{renderCellWithUnit(data.gas?.monthTotal, () => {}, '', true)}</td></tr></tbody>
                  </table>
                  <table className="w-full border-collapse bg-transparent table-fixed border border-gray-300">
                    <thead><tr><th className={`${thClass} w-[20%] whitespace-nowrap`}>구분</th><th className={`${thClass} w-[20%]`}>전일(kg)</th><th className={`${thClass} w-[20%]`}>입고(kg)</th><th className={`${thClass} w-[20%]`}>사용(kg)</th><th className={`${thClass} w-[20%]`}>재고(kg)</th></tr></thead>
                    <tbody><tr><td className={`${thClass} whitespace-nowrap font-medium`}>냉각탑 살균제</td><td className={tdClass}>{renderCellWithUnit(data.sterilizer?.prevStock, (v) => updateHvacNestedField('sterilizer', 'prevStock', v), '')}</td><td className={tdClass}>{renderCellWithUnit(data.sterilizer?.inQty, (v) => updateHvacNestedField('sterilizer', 'inQty', v), '')}</td><td className={tdClass}>{renderCellWithUnit(data.sterilizer?.usedQty, (v) => updateHvacNestedField('sterilizer', 'usedQty', v), '')}</td><td className={tdClass}>{renderCellWithUnit(data.sterilizer?.stock, () => {}, '', true)}</td></tr></tbody>
                  </table>
              </div>
            </div>
          </section>
          
          <hr className="my-6 border-t-2 border-gray-800 opacity-20" />

          <section className="max-w-[1050px] mx-auto">
            <h3 className="text-lg font-bold text-black mb-1 border-l-4 border-black pl-2">2. 보일러 가동 현황</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-transparent border border-gray-300">
                <thead>
                  <tr>
                    <th rowSpan={2} className={`${thClass} w-72 whitespace-nowrap`}>운전시간(H)</th>
                    <th colSpan={2} className={thClass}>가스압력(kg/cm²)</th>
                    <th rowSpan={2} className={thClass}>증기압<br/>(kg/cm²)</th>
                    <th rowSpan={2} className={thClass}>배기온도<br/>(℃)</th>
                    <th rowSpan={2} className={thClass}>급수온도<br/>(℃)</th>
                    <th rowSpan={2} className={thClass}>급탕온도<br/>(℃)</th>
                    <th rowSpan={2} className={thClass}>수위(%)</th>
                  </tr>
                  <tr><th className={thClass}>1차</th><th className={thClass}>2차</th></tr>
                </thead>
                <tbody>
                  {boilerData.logs.map((log, lIdx) => (
                    <tr key={log.id}>
                      <td className={tdClass}>
                        <div className="flex items-center justify-center h-full px-2 gap-1">
                          <input 
                            type="text" 
                            className="w-[45%] h-full text-center outline-none bg-white border border-gray-100 rounded px-1 font-bold text-xs text-blue-700 shadow-sm" 
                            value={(log.runTime || '').split('~')[0] || ''} 
                            onChange={e => handleTimeChange('boiler', lIdx, 'start', e.target.value)} 
                            placeholder="00:00"
                          />
                          <span className="font-bold text-gray-400 text-[10px]">~</span>
                          <input 
                            type="text" 
                            className="w-[45%] h-full text-center outline-none bg-white border border-gray-100 rounded px-1 font-bold text-xs text-blue-700 shadow-sm" 
                            value={(log.runTime || '').split('~')[1] || ''} 
                            onChange={e => handleTimeChange('boiler', lIdx, 'end', e.target.value)} 
                            placeholder="00:00"
                          />
                        </div>
                      </td>
                      <td className={tdClass}><input type="text" className="w-full h-full text-center outline-none bg-transparent font-bold text-sm" value={log.gasPressure1} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, gasPressure1:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                      <td className={tdClass}><input type="text" className="w-full h-full text-center outline-none bg-transparent font-bold text-sm" value={log.gasPressure2} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, gasPressure2:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                      <td className={tdClass}><input type="text" className="w-full h-full text-center outline-none bg-transparent font-bold text-sm" value={log.steamPressure} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, steamPressure:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                      <td className={tdClass}><input type="text" className="w-full h-full text-center outline-none bg-transparent font-bold text-sm" value={log.exhaustTemp} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, exhaustTemp:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                      <td className={tdClass}><input type="text" className="w-full h-full text-center outline-none bg-transparent font-bold text-sm" value={log.supplyTemp} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, supplyTemp:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                      <td className={tdClass}><input type="text" className="w-full h-full text-center outline-none bg-transparent font-bold text-sm" value={log.hotWaterTemp} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, hotWaterTemp:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                      <td className={tdClass}><input type="text" className="w-full h-full text-center outline-none bg-transparent font-bold text-sm" value={log.waterLevel} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, waterLevel:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                    </tr>
                  ))}
                  <tr>
                    <td className={`${thClass} whitespace-nowrap`}>총 가 동 시 간</td>
                    <td colSpan={7} className={tdClass}>
                      <div className="flex items-center justify-center h-full">
                        <input type="text" className="w-full h-full text-center outline-none font-extrabold text-blue-700 text-base bg-transparent" value={boilerData.totalRunTime ? `${boilerData.totalRunTime} H` : ''} readOnly />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-1.5 mt-2">
              <table className="w-full border-collapse bg-transparent table-fixed border border-gray-300">
                <thead><tr><th className={`${thClass} w-[20%] whitespace-nowrap`}>구분</th><th className={`${thClass} w-[20%]`}>전일(m³)</th><th className={`${thClass} w-[20%]`}>금일(m³)</th><th className={`${thClass} w-[20%]`}>사용(m³)</th><th className={`${thClass} w-[20%]`}>누계(m³)</th></tr></thead>
                <tbody><tr><td className={`${thClass} font-medium`}>보일러 가스 사용량</td><td className={tdClass}>{renderCellWithUnit(boilerData.gas?.prev, (v) => updateBoilerNestedField('gas', 'prev', v), '')}</td><td className={tdClass}>{renderCellWithUnit(boilerData.gas?.curr, (v) => updateBoilerNestedField('gas', 'curr', v), '')}</td><td className={tdClass}>{renderCellWithUnit(boilerData.gas?.usage, () => {}, '', true)}</td><td className={tdClass}>{renderCellWithUnit(boilerData.gas?.monthTotal, () => {}, '', true)}</td></tr></tbody>
              </table>
              
              <table className="w-full border-collapse bg-transparent table-fixed border border-gray-300 mt-1.5">
                <thead>
                  <tr>
                    <th className={`${thClass} w-[20%] whitespace-nowrap`}>구분</th>
                    <th className={`${thClass} w-[20%]`}>전일(kg)</th>
                    <th className={`${thClass} w-[20%]`}>입고(kg)</th>
                    <th className={`${thClass} w-[20%]`}>사용(kg)</th>
                    <th className={`${thClass} w-[20%]`}>재고(kg)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={`${thClass} font-medium`}>소금</td>
                    <td className={tdClass}>{renderCellWithUnit(boilerData.salt?.prevStock, (v) => updateBoilerNestedField('salt', 'prevStock', v), '')}</td>
                    <td className={tdClass}>{renderCellWithUnit(boilerData.salt?.inQty, (v) => updateBoilerNestedField('salt', 'inQty', v), '')}</td>
                    <td className={tdClass}>{renderCellWithUnit(boilerData.salt?.usedQty, (v) => updateBoilerNestedField('salt', 'usedQty', v), '')}</td>
                    <td className={tdClass}>
                      <div className="w-full h-full flex items-center justify-center font-bold text-blue-600 bg-gray-50/30">
                        {boilerData.salt?.stock || '0'}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className={`${thClass} font-medium`}>청관제</td>
                    <td className={tdClass}>{renderCellWithUnit(boilerData.cleaner?.prevStock, (v) => updateBoilerNestedField('cleaner', 'prevStock', v), '')}</td>
                    <td className={tdClass}>{renderCellWithUnit(boilerData.cleaner?.inQty, (v) => updateBoilerNestedField('cleaner', 'inQty', v), '')}</td>
                    <td className={tdClass}>{renderCellWithUnit(boilerData.cleaner?.usedQty, (v) => updateBoilerNestedField('cleaner', 'usedQty', v), '')}</td>
                    <td className={tdClass}>
                      <div className="w-full h-full flex items-center justify-center font-bold text-blue-600 bg-gray-50/30">
                        {boilerData.cleaner?.stock || '0'}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* 전기 탭과 동일한 하단 저장 버튼 위치 */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 flex justify-center lg:static lg:bg-transparent lg:border-none lg:p-0 mt-12 z-40 print:hidden">
          <button 
            onClick={() => setShowSaveConfirm(true)} 
            disabled={saveStatus === 'loading'} 
            className={`px-10 py-4 rounded-2xl shadow-xl transition-all duration-300 font-bold text-xl flex items-center justify-center space-x-3 w-full max-xl active:scale-95 ${saveStatus === 'loading' ? 'bg-blue-400 text-white cursor-wait' : saveStatus === 'success' ? 'bg-green-600 text-white' : saveStatus === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {saveStatus === 'loading' ? (
              <><RefreshCw size={24} className="animate-spin" /><span>데이터 동기화 중...</span></>
            ) : saveStatus === 'success' ? (
              <><CheckCircle2 size={24} /><span>저장 완료</span></>
            ) : (
              <><Save size={24} /><span>기계설비 데이터 서버 저장</span></>
            )}
          </button>
        </div>
      </LogSheetLayout>

      {/* 저장 확인 모달 */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-blue-100">
                <Cloud className="text-blue-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">기계설비 데이터 서버 저장</h3>
              <p className="text-gray-500 mb-8 leading-relaxed font-medium">
                입력하신 <span className="text-blue-600 font-bold">냉온수기 및 보일러 계측 기록</span>을<br/>
                서버에 안전하게 기록하시겠습니까?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors flex items-center justify-center active:scale-95"><X size={18} className="mr-2" />취소</button>
                <button onClick={handleManualSave} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95"><CheckCircle2 size={18} className="mr-2" />확인</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HvacLog;
