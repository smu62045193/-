import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HvacLogData, HvacLogItem, BoilerLogData, BoilerLogItem } from '../types';
import { fetchHvacLog, saveHvacLog, getInitialHvacLog, fetchBoilerLog, saveBoilerLog, getInitialBoilerLog, fetchDateRangeData, saveToCache, getFromStorage, fetchDailyData, saveDailyData, apiFetchRange, clearCache } from '../services/dataService';
import { format, startOfMonth, differenceInDays, subDays, parseISO } from 'date-fns';
import LogSheetLayout from './LogSheetLayout';

interface HvacLogProps {
  currentDate: Date;
  isEmbedded?: boolean;
  onUsageChange?: (hGas: string, bGas: string) => void;
}

const HvacLog: React.FC<HvacLogProps> = ({ currentDate, isEmbedded = false, onUsageChange }) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  
  const [data, setData] = useState<HvacLogData>(getInitialHvacLog(dateKey));
  const [boilerData, setBoilerData] = useState<BoilerLogData>(getInitialBoilerLog(dateKey));
  
  // 기준 누계값 (전일자 누계)
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

    if (force) {
      clearCache(`HVAC_${dateKey}`);
      clearCache(`BOILER_${dateKey}`);
    }

    try {
      const cachedHvac = getFromStorage(`HVAC_${dateKey}`);
      const cachedBoiler = getFromStorage(`BOILER_${dateKey}`);
      const [hvac, boiler] = await Promise.all([fetchHvacLog(dateKey, force), fetchBoilerLog(dateKey, force)]);
      
      let finalHvac = hvac || cachedHvac || getInitialHvacLog(dateKey);
      let finalBoiler = boiler || cachedBoiler || getInitialBoilerLog(dateKey);

      const yesterdayStr = format(subDays(currentDate, 1), 'yyyy-MM-dd');
      const searchStart = format(subDays(currentDate, 14), 'yyyy-MM-dd');

      let hBase = 0;
      let bBase = 0;

      // --- 냉온수기 데이터 연동 로직 ---
      const recentHvacLogs = await apiFetchRange("HVAC_LOG_", searchStart, yesterdayStr);
      if (recentHvacLogs.length > 0) {
        recentHvacLogs.sort((a, b) => b.key.localeCompare(a.key));
        const latest = recentHvacLogs[0];
        const latestDate = parseISO(latest.key.replace('HVAC_LOG_', ''));
        
        // 가스 전일 지침 및 이전 누계값 기준 설정
        if (latestDate.getMonth() === currentDate.getMonth() && latestDate.getFullYear() === currentDate.getFullYear()) {
          hBase = safeParseFloat(latest.data?.gas?.monthTotal);
        }

        if (!finalHvac.gas?.prev || finalHvac.gas.prev === '0' || finalHvac.gas.prev === '') {
          if (latest.data?.gas?.curr && finalHvac.gas) finalHvac.gas.prev = latest.data.gas.curr;
        }

        // 살균제 전일 재고 연동
        if (!finalHvac.sterilizer?.prevStock || finalHvac.sterilizer.prevStock === '0' || finalHvac.sterilizer.prevStock === '') {
          if (latest.data?.sterilizer?.stock && finalHvac.sterilizer) {
            finalHvac.sterilizer.prevStock = latest.data.sterilizer.stock;
          }
        }
      }

      // --- 보일러 데이터 연동 로직 ---
      const recentBoilerLogs = await apiFetchRange("BOILER_LOG_", searchStart, yesterdayStr);
      if (recentBoilerLogs.length > 0) {
        recentBoilerLogs.sort((a, b) => b.key.localeCompare(a.key));
        const latest = recentBoilerLogs[0];
        const latestDate = parseISO(latest.key.replace('BOILER_LOG_', ''));

        // 가스 전일 지침 및 이전 누계값 기준 설정
        if (latestDate.getMonth() === currentDate.getMonth() && latestDate.getFullYear() === currentDate.getFullYear()) {
          bBase = safeParseFloat(latest.data?.gas?.monthTotal);
        }

        if (!finalBoiler.gas?.prev || finalBoiler.gas.prev === '0' || finalBoiler.gas.prev === '') {
          if (latest.data?.gas?.curr && finalBoiler.gas) finalBoiler.gas.prev = latest.data.gas.curr;
        }

        // 소금 및 청관제 전일 재고 연동
        if (!finalBoiler.salt?.prevStock || finalBoiler.salt.prevStock === '0' || finalBoiler.salt.prevStock === '') {
          if (latest.data?.salt?.stock && finalBoiler.salt) finalBoiler.salt.prevStock = latest.data.salt.stock;
        }
        if (!finalBoiler.cleaner?.prevStock || finalBoiler.cleaner.prevStock === '0' || finalBoiler.cleaner.prevStock === '') {
          if (latest.data?.cleaner?.stock && finalBoiler.cleaner) finalBoiler.cleaner.prevStock = latest.data.cleaner.stock;
        }
      }

      historySumsRef.current = { hvac: hBase, boiler: bBase };

      // 초기 계산 수행 (사용량 정수 처리)
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

      // 약품 재고 업데이트
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

  useEffect(() => {
    if (isInitialLoad.current || loading) return;
    saveToCache(`HVAC_${dateKey}`, data);
    saveToCache(`BOILER_${dateKey}`, boilerData);
  }, [data, boilerData, dateKey, loading]);

  const handleManualSave = async () => {
    if (saveStatus === 'loading') return;
    setSaveStatus('loading');
    try {
      await Promise.all([saveHvacLog(data), saveBoilerLog(boilerData)]);
      const currentDaily = await fetchDailyData(dateKey);
      await saveDailyData({
        ...currentDaily,
        utility: { ...currentDaily.utility, hvacGas: data.gas.usage, boilerGas: boilerData.gas.usage }
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) { setSaveStatus('error'); }
  };

  const updateHvacNestedField = (parent: 'gas' | 'sterilizer', field: string, value: string) => {
    setData(prev => {
      if (!prev) return prev;
      const newState = { ...prev };
      if (parent === 'gas') {
        const updated = { ...prev.gas, [field]: value };
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
        const updated = { ...prev.sterilizer, [field]: value };
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
      const target = (prev as any)[parent];
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
                border: 1.5px solid black !important; 
                table-layout: fixed !important; 
                margin-bottom: 3px; 
              }
              th, td { 
                border: 1.2px solid black !important; 
                text-align: center !important; 
                height: 27px !important; 
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
          <script>window.onload = function() { const inputs = document.querySelectorAll('input'); inputs.forEach(input => input.setAttribute('value', input.value)); }</script>
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
    <LogSheetLayout title="기계설비 운전일지" loading={loading} saveStatus={saveStatus} onPrint={handlePrint} isEmbedded={isEmbedded} onSave={handleManualSave} onRefresh={() => loadData(true)} hideSave={false} hideRefresh={false}>
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
                                    <input type="text" className="w-24 text-center outline-none bg-transparent font-bold text-sm text-gray-500" value={(data.hvacLogs?.[0]?.runTime || '').split('~')[0] || ''} onChange={e => handleTimeChange('hvac', 0, 'start', e.target.value)} />
                                    <span className="px-4 font-bold text-gray-400">~</span>
                                    <input type="text" className="w-24 text-center outline-none bg-transparent font-bold text-sm text-gray-500" value={(data.hvacLogs?.[0]?.runTime || '').split('~')[1] || ''} onChange={e => handleTimeChange('hvac', 0, 'end', e.target.value)} />
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
                  <thead><tr><th className={`${thClass} w-[20%] whitespace-nowrap`}>구분</th><th className={`${thClass} w-[20%]`}>전일(kg)</th><th className={`${thClass} w-[20%]`}>입고(kg)</th><th className={`${thClass} w-[20%]`}>투입(kg)</th><th className={`${thClass} w-[20%]`}>재고(kg)</th></tr></thead>
                  <tbody><tr><td className={`${thClass} whitespace-nowrap font-medium`}>냉각탑 살균제</td><td className={tdClass}>{renderCellWithUnit(data.sterilizer?.prevStock, (v) => updateHvacNestedField('sterilizer', 'prevStock', v), '')}</td><td className={tdClass}>{renderCellWithUnit(data.sterilizer?.inQty, (v) => updateHvacNestedField('sterilizer', 'inQty', v), '')}</td><td className={tdClass}>{renderCellWithUnit(data.sterilizer?.usedQty, (v) => updateHvacNestedField('sterilizer', 'usedQty', v), '')}</td><td className={tdClass}>{renderCellWithUnit(data.sterilizer?.stock, () => {}, '', true)}</td></tr></tbody>
                </table>
            </div>
          </div>
        </section>
        <hr className="border-t border-gray-300 max-w-[1050px] mx-auto mt-1 mb-1" />
        <section className="max-w-[1050px] mx-auto">
          <h3 className="text-lg font-bold text-black mb-1 border-l-4 border-black pl-2">2. 보일러 가동 현황</h3>
          <div className="flex flex-col gap-2">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-transparent border border-gray-300">
                    <thead>
                        <tr><th rowSpan={2} className={`${thClass} w-28`}>운전시간(H)</th><th colSpan={2} className={thClass}>가스압력(kg/cm²)</th><th rowSpan={2} className={thClass}>증기압<br/>(kg/cm²)</th><th rowSpan={2} className={thClass}>배기온도<br/>(℃)</th><th rowSpan={2} className={thClass}>급수온도<br/>(℃)</th><th rowSpan={2} className={thClass}>급탕온도<br/>(℃)</th><th rowSpan={2} className={thClass}>수위(%)</th></tr>
                        <tr><th className={thClass}>1차</th><th className={thClass}>2차</th></tr>
                    </thead>
                    <tbody>
                        {boilerData.logs?.map((log, idx) => (
                            <tr key={log.id}>
                                <td className={tdClass}><div className="flex items-center justify-center h-full px-1"><input type="text" className="flex-1 min-w-0 text-center outline-none bg-transparent font-bold text-[11px] text-gray-500" value={(log.runTime || '').split('~')[0] || ''} onChange={e => handleTimeChange('boiler', idx, 'start', e.target.value)} /><span className="font-bold text-gray-400">~</span><input type="text" className="flex-1 min-w-0 text-center outline-none bg-transparent font-bold text-[11px] text-gray-500" value={(log.runTime || '').split('~')[1] || ''} onChange={e => handleTimeChange('boiler', idx, 'end', e.target.value)} /></div></td>
                                <td className={tdClass}><input type="text" className="w-full h-full text-center outline-none bg-transparent font-bold" value={log.gasPressure1 || ''} onChange={e => setBoilerData(prev => { if (!prev) return prev; const nl = [...(prev.logs || [])]; nl[idx].gasPressure1 = e.target.value; return {...prev, logs: nl}; })} /></td>
                                <td className={tdClass}><input type="text" className="w-full h-full text-center outline-none bg-transparent font-bold" value={log.gasPressure2 || ''} onChange={e => setBoilerData(prev => { if (!prev) return prev; const nl = [...(prev.logs || [])]; nl[idx].gasPressure2 = e.target.value; return {...prev, logs: nl}; })} /></td>
                                <td className={tdClass}><input type="text" className="w-full h-full text-center outline-none bg-transparent font-bold" value={log.steamPressure || ''} onChange={e => setBoilerData(prev => { if (!prev) return prev; const nl = [...(prev.logs || [])]; nl[idx].steamPressure = e.target.value; return {...prev, logs: nl}; })} /></td>
                                <td className={tdClass}><input type="text" className="w-full h-full text-center outline-none bg-transparent font-bold" value={log.exhaustTemp || ''} onChange={e => setBoilerData(prev => { if (!prev) return prev; const nl = [...(prev.logs || [])]; nl[idx].exhaustTemp = e.target.value; return {...prev, logs: nl}; })} /></td>
                                <td className={tdClass}><input type="text" className="w-full h-full text-center outline-none bg-transparent font-bold" value={log.supplyTemp || ''} onChange={e => setBoilerData(prev => { if (!prev) return prev; const nl = [...(prev.logs || [])]; nl[idx].supplyTemp = e.target.value; return {...prev, logs: nl}; })} /></td>
                                <td className={tdClass}><input type="text" className="w-full h-full text-center outline-none bg-transparent font-bold" value={log.hotWaterTemp || ''} onChange={e => setBoilerData(prev => { if (!prev) return prev; const nl = [...(prev.logs || [])]; nl[idx].hotWaterTemp = e.target.value; return {...prev, logs: nl}; })} /></td>
                                <td className={tdClass}><input type="text" className="w-full h-full text-center outline-none bg-transparent font-bold" value={log.waterLevel || ''} onChange={e => setBoilerData(prev => { if (!prev) return prev; const nl = [...(prev.logs || [])]; nl[idx].waterLevel = e.target.value; return {...prev, logs: nl}; })} /></td>
                            </tr>
                        ))}
                        <tr><td className={`${thClass} font-extrabold bg-gray-50`}>총 가 동 시 간</td><td colSpan={7} className={tdClass}><input type="text" className="w-full h-full text-center outline-none !text-red-700 font-black text-base bg-transparent" value={boilerData.totalRunTime ? `${boilerData.totalRunTime} H` : ''} readOnly /></td></tr>
                    </tbody>
                </table>
            </div>
            <div className="flex flex-col gap-1.5">
                <table className="w-full border-collapse bg-transparent table-fixed border border-gray-300">
                  <thead><tr><th className={thClass}>구분</th><th className={thClass}>전일(m³)</th><th className={thClass}>금일(m³)</th><th className={thClass}>사용(m³)</th><th className={thClass}>누계(m³)</th></tr></thead>
                  <tbody><tr><td className={`${thClass} whitespace-nowrap font-medium`}>보일러 가스 사용량</td><td className={tdClass}>{renderCellWithUnit(boilerData.gas?.prev, (v) => updateBoilerNestedField('gas', 'prev', v), '')}</td><td className={tdClass}>{renderCellWithUnit(boilerData.gas?.curr, (v) => updateBoilerNestedField('gas', 'curr', v), '')}</td><td className={tdClass}>{renderCellWithUnit(boilerData.gas?.usage, () => {}, '', true)}</td><td className={tdClass}>{renderCellWithUnit(boilerData.gas?.monthTotal, () => {}, '', true)}</td></tr></tbody>
                </table>
                <table className="w-full border-collapse bg-transparent table-fixed border border-gray-300">
                  <thead><tr><th className={thClass}>구분</th><th className={thClass}>전일(kg)</th><th className={thClass}>입고(kg)</th><th className={thClass}>사용(kg)</th><th className={thClass}>재고(kg)</th></tr></thead>
                  <tbody>
                    <tr><td className={`${thClass} font-medium`}>소금</td><td className={tdClass}><input className="w-full text-center outline-none bg-transparent font-bold" value={boilerData.salt?.prevStock || ''} onChange={e => updateBoilerNestedField('salt', 'prevStock', e.target.value)} /></td><td className={tdClass}><input className="w-full text-center outline-none bg-transparent font-bold" value={boilerData.salt?.inQty || ''} onChange={e => updateBoilerNestedField('salt', 'inQty', e.target.value)} /></td><td className={tdClass}><input className="w-full text-center outline-none bg-transparent font-bold" value={boilerData.salt?.usedQty || ''} onChange={e => updateBoilerNestedField('salt', 'usedQty', e.target.value)} /></td><td className={tdClass}><div className="font-bold text-blue-700 h-full flex items-center justify-center">{boilerData.salt?.stock || '0'}</div></td></tr>
                    <tr><td className={`${thClass} font-medium`}>청관제</td><td className={tdClass}><input className="w-full text-center outline-none bg-transparent font-bold" value={boilerData.cleaner?.prevStock || ''} onChange={e => updateBoilerNestedField('cleaner', 'prevStock', e.target.value)} /></td><td className={tdClass}><input className="w-full text-center outline-none bg-transparent font-bold" value={boilerData.cleaner?.inQty || ''} onChange={e => updateBoilerNestedField('cleaner', 'inQty', e.target.value)} /></td><td className={tdClass}><input className="w-full text-center outline-none bg-transparent font-bold" value={boilerData.cleaner?.usedQty || ''} onChange={e => updateBoilerNestedField('cleaner', 'usedQty', e.target.value)} /></td><td className={tdClass}><div className="font-bold text-blue-700 h-full flex items-center justify-center">{boilerData.cleaner?.stock || '0'}</div></td></tr>
                  </tbody>
                </table>
            </div>
          </div>
        </section>
      </div>
    </LogSheetLayout>
  );
};

export default HvacLog;