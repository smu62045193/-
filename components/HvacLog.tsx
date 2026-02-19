
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
import { format, subDays, startOfMonth } from 'date-fns';
import LogSheetLayout from './LogSheetLayout';
import { Save, RefreshCw, CheckCircle2 } from 'lucide-react';

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
  
  // 전일 누계값을 저장할 Ref (누계 계산용)
  const historySumsRef = useRef({ hvac: 0, boiler: 0 });
  const isInitialLoad = useRef(true);
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
    setLoading(true);
    setSaveStatus('idle');
    isInitialLoad.current = true;

    try {
      const monthStartStr = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const yesterdayStr = format(subDays(currentDate, 1), 'yyyy-MM-dd');

      // 사용자가 선택한 날짜의 정확히 하루 전날 데이터를 직접 호출
      const batchResults = await apiFetchBatch([
        { type: 'get', key: `HVAC_BOILER_${dateKey}` },
        { type: 'get', key: `HVAC_BOILER_${yesterdayStr}` }
      ]);
      
      const currentCombined = batchResults[0]?.data;
      const yesterdayCombined = batchResults[1]?.data;
      
      let finalHvac = currentCombined?.hvac_data || getInitialHvacLog(dateKey);
      let finalBoiler = currentCombined?.boiler_data || getInitialBoilerLog(dateKey);

      // 1. 냉·온수기 가스/살균제 연동
      if (yesterdayCombined?.hvac_data) {
        const yH = yesterdayCombined.hvac_data;
        // 가스 전일 지침 연동
        if (!finalHvac.gas.prev || finalHvac.gas.prev === '' || finalHvac.gas.prev === '0') {
          finalHvac.gas.prev = yH.gas?.curr || '0';
        }
        // 살균제 전일 재고 연동
        if (!finalHvac.sterilizer.prevStock || finalHvac.sterilizer.prevStock === '' || finalHvac.sterilizer.prevStock === '0') {
          finalHvac.sterilizer.prevStock = yH.sterilizer?.stock || '0';
        }
        // 전일 누계 저장 (금일 누계 계산용)
        // 매월 1일이면 전일 누계는 0으로 처리 (누계 초기화)
        historySumsRef.current.hvac = dateKey === monthStartStr ? 0 : safeParseFloat(yH.gas?.monthTotal);
      } else {
        historySumsRef.current.hvac = 0;
      }

      // 2. 보일러 가스/소금/청관제 연동
      if (yesterdayCombined?.boiler_data) {
        const yB = yesterdayCombined.boiler_data;
        // 가스 전일 지침 연동
        if (!finalBoiler.gas.prev || finalBoiler.gas.prev === '' || finalBoiler.gas.prev === '0') {
          finalBoiler.gas.prev = yB.gas?.curr || '0';
        }
        // 소금 전일 재고 연동
        if (!finalBoiler.salt.prevStock || finalBoiler.salt.prevStock === '' || finalBoiler.salt.prevStock === '0') {
          finalBoiler.salt.prevStock = yB.salt?.stock || '0';
        }
        // 청관제 전일 재고 연동
        if (!finalBoiler.cleaner.prevStock || finalBoiler.cleaner.prevStock === '' || finalBoiler.cleaner.prevStock === '0') {
          finalBoiler.cleaner.prevStock = yB.cleaner?.stock || '0';
        }
        // 전일 누계 저장
        historySumsRef.current.boiler = dateKey === monthStartStr ? 0 : safeParseFloat(yB.gas?.monthTotal);
      } else {
        historySumsRef.current.boiler = 0;
      }

      // 초기 로드 시 자동 계산 수행
      // 냉·온수기 가스
      const hp = safeParseFloat(finalHvac.gas.prev);
      const hc = safeParseFloat(finalHvac.gas.curr);
      const hUsage = Math.max(0, hc - hp);
      finalHvac.gas.usage = (hc > 0 && hc === hp) ? '0' : (hc > 0 ? hUsage.toString() : '');
      finalHvac.gas.monthTotal = Math.round(historySumsRef.current.hvac + hUsage).toString();

      // 보일러 가스
      const bp = safeParseFloat(finalBoiler.gas.prev);
      const bc = safeParseFloat(finalBoiler.gas.curr);
      const bUsage = Math.max(0, bc - bp);
      finalBoiler.gas.usage = (bc > 0 && bc === bp) ? '0' : (bc > 0 ? bUsage.toString() : '');
      finalBoiler.gas.monthTotal = Math.round(historySumsRef.current.boiler + bUsage).toString();

      // 약품 재고 (입고/사용 없으면 0으로 계산)
      const calcStock = (prev: string, inc: string, usd: string) => {
        return (safeParseFloat(prev) + safeParseFloat(inc) - safeParseFloat(usd)).toString();
      };
      finalHvac.sterilizer.stock = calcStock(finalHvac.sterilizer.prevStock, finalHvac.sterilizer.inQty, finalHvac.sterilizer.usedQty);
      finalBoiler.salt.stock = calcStock(finalBoiler.salt.prevStock, finalBoiler.salt.inQty, finalBoiler.salt.usedQty);
      finalBoiler.cleaner.stock = calcStock(finalBoiler.cleaner.prevStock, finalBoiler.cleaner.inQty, finalBoiler.cleaner.usedQty);

      setData(finalHvac);
      setBoilerData(finalBoiler);
      setTimeout(() => { isInitialLoad.current = false; }, 300);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  }, [dateKey, currentDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleManualSave = async () => {
    if (saveStatus === 'loading') return;
    setSaveStatus('loading');
    try {
      const success = await saveHvacBoilerCombined(data, boilerData);
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
        alert('저장이 완료되었습니다.');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) { 
        setSaveStatus('error'); 
    }
  };

  const updateHvacNestedField = (parent: 'gas' | 'sterilizer', field: string, value: string) => {
    setData(prev => {
      const newState = JSON.parse(JSON.stringify(prev));
      if (parent === 'gas') {
        newState.gas[field] = value;
        const p = safeParseFloat(newState.gas.prev);
        const c = safeParseFloat(newState.gas.curr);
        const u = Math.max(0, c - p);
        // 지침이 같으면 0, 아니면 차이값
        newState.gas.usage = (c > 0 && c === p) ? '0' : (c > 0 ? u.toString() : '');
        // 누계 합산
        newState.gas.monthTotal = Math.round(historySumsRef.current.hvac + u).toString();
      } else {
        newState.sterilizer[field] = value;
        const p = safeParseFloat(newState.sterilizer.prevStock);
        const i = safeParseFloat(newState.sterilizer.inQty); // 입력 없으면 safeParseFloat가 0 반환
        const u = safeParseFloat(newState.sterilizer.usedQty);
        newState.sterilizer.stock = (p + i - u).toString();
      }
      return newState;
    });
  };

  const updateBoilerNestedField = (parent: 'gas' | 'salt' | 'cleaner', field: string, value: string) => {
    setBoilerData(prev => {
      const newState = JSON.parse(JSON.stringify(prev));
      if (parent === 'gas') {
        newState.gas[field] = value;
        const p = safeParseFloat(newState.gas.prev);
        const c = safeParseFloat(newState.gas.curr);
        const u = Math.max(0, c - p);
        newState.gas.usage = (c > 0 && c === p) ? '0' : (c > 0 ? u.toString() : '');
        newState.gas.monthTotal = Math.round(historySumsRef.current.boiler + u).toString();
      } else {
        newState[parent][field] = value;
        const p = safeParseFloat(newState[parent].prevStock);
        const i = safeParseFloat(newState[parent].inQty);
        const u = safeParseFloat(newState[parent].usedQty);
        newState[parent].stock = (p + i - u).toString();
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
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
            body { background: #f1f5f9; font-family: 'Noto Sans KR', sans-serif; margin: 0; padding: 0; }
            .no-print { margin: 20px; display: flex; gap: 10px; justify-content: center; }
            .print-wrap { width: 100%; max-width: 210mm; margin: 0 auto; padding: 10mm; box-sizing: border-box; background: white; }
            @media print {
              @page { margin: 0; size: A4 portrait; }
              body { background: transparent !important; -webkit-print-color-adjust: exact; width: 100%; margin: 0; color: black !important; }
              .no-print { display: none !important; }
              .print-wrap { margin: 0; padding: 15mm 10mm; box-shadow: none !important; }
              table { width: 100% !important; border-collapse: collapse !important; border: 1.2px solid black !important; table-layout: fixed !important; margin-bottom: 5px; }
              th, td { border: 1.2px solid black !important; text-align: center !important; height: 28px !important; color: black !important; padding: 0px !important; }
              th { font-weight: bold !important; background-color: #f2f2f2 !important; font-size: 9pt !important; }
              td { font-size: 10pt !important; }
              input { border: none !important; width: 100% !important; text-align: center !important; font-size: 10pt !important; font-weight: bold !important; color: black !important; background: transparent !important; }
              h3 { font-size: 14pt !important; font-weight: 900 !important; border-left: 8px solid black !important; padding-left: 12px !important; margin: 15px 0 8px 0 !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">인쇄하기</button></div>
          <div class="print-wrap"><div id="print-body-content">${combinedContent.innerHTML}</div></div>
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
        {unit && <span className="text-[11px] text-gray-500 font-bold whitespace-nowrap min-w-[45px] text-left">{unit}</span>}
    </div>
  );

  return (
    <>
      <LogSheetLayout 
          title="기계설비 운전일지" 
          loading={loading} 
          saveStatus={saveStatus} 
          onPrint={handlePrint} 
          isEmbedded={isEmbedded} 
          onSave={handleManualSave} 
          onRefresh={() => loadData(true)} 
          hideSave={false} 
      >
        <div id="combined-hvac-boiler-area" className="bg-transparent space-y-4 p-1">
          <section className="max-w-[1050px] mx-auto">
            <h3 className="text-lg font-bold text-black mb-1 border-l-4 border-black pl-2">1. 냉·온수기 가동 현황</h3>
            <table className="w-full border-collapse bg-transparent border border-gray-300 mb-2">
                <thead>
                    <tr>
                        <th rowSpan={2} className={`${thClass} w-48`}>점검 항목</th>
                        <th colSpan={2} className={`${thClass} h-[45px] text-xl font-black text-black`}>
                            냉,온수기 (<select value={data.unitNo || ''} onChange={(e) => setData(prev => ({...prev, unitNo: e.target.value}))} className="bg-transparent text-black font-black outline-none border-none text-xl px-1 appearance-none"><option value="1">1</option><option value="2">2</option></select>) 호기
                        </th>
                    </tr>
                    <tr><th className={thClass}>10:00</th><th className={thClass}>15:00</th></tr>
                </thead>
                <tbody>
                    {[
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
                    ].map((row) => (
                      <tr key={row.key}>
                        <td className={`${thClass} text-left pl-3 font-medium`}>{row.label}</td>
                        <td className={tdClass}>{renderCellWithUnit((data[row.key as keyof HvacLogData] as any)?.time10, (v) => setData(prev => ({...prev, [row.key]: {...(prev[row.key as keyof HvacLogData] as any), time10: v}})), row.unit)}</td>
                        <td className={tdClass}>{renderCellWithUnit((data[row.key as keyof HvacLogData] as any)?.time15, (v) => setData(prev => ({...prev, [row.key]: {...(prev[row.key as keyof HvacLogData] as any), time15: v}})), row.unit)}</td>
                      </tr>
                    ))}
                    <tr>
                        <td className={`${thClass} text-left pl-3 font-medium`}>운 전 시 간</td>
                        <td colSpan={2} className={tdClass}>
                            <div className="flex items-center justify-center h-full px-4 gap-2">
                                <input type="text" className="w-24 text-center border border-gray-200 rounded px-1 font-bold text-blue-700" value={(data.hvacLogs?.[0]?.runTime || '').split('~')[0] || ''} onChange={e => handleTimeChange('hvac', 0, 'start', e.target.value)} placeholder="00:00" />
                                <span className="font-bold text-gray-400">~</span>
                                <input type="text" className="w-24 text-center border border-gray-200 rounded px-1 font-bold text-blue-700" value={(data.hvacLogs?.[0]?.runTime || '').split('~')[1] || ''} onChange={e => handleTimeChange('hvac', 0, 'end', e.target.value)} placeholder="00:00" />
                                <span className="ml-4 font-black text-blue-800">계: {data.totalRunTime || '0'} H</span>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <table className="w-full border-collapse border border-gray-300">
                  <thead><tr className="bg-gray-50"><th colSpan={4} className="p-1 text-xs font-black text-blue-800 border-b border-gray-300">냉,온수기 가스 사용량 (m³)</th></tr><tr><th className={thClass}>전일</th><th className={thClass}>금일</th><th className={thClass}>사용</th><th className={thClass}>누계</th></tr></thead>
                  <tbody><tr><td className={tdClass}>{renderCellWithUnit(data.gas?.prev, (v) => updateHvacNestedField('gas', 'prev', v), '', true)}</td><td className={tdClass}>{renderCellWithUnit(data.gas?.curr, (v) => updateHvacNestedField('gas', 'curr', v), '')}</td><td className={`${tdClass} font-black text-blue-700`}>{data.gas?.usage || '0'}</td><td className={`${tdClass} font-black text-emerald-700 bg-emerald-50/30`}>{data.gas?.monthTotal || '0'}</td></tr></tbody>
                </table>
                <table className="w-full border-collapse border border-gray-300">
                  <thead><tr className="bg-gray-50"><th colSpan={4} className="p-1 text-xs font-black text-blue-800 border-b border-gray-300">냉각탑 살균제 (kg)</th></tr><tr><th className={thClass}>전일</th><th className={thClass}>입고</th><th className={thClass}>사용</th><th className={thClass}>재고</th></tr></thead>
                  <tbody><tr><td className={tdClass}>{renderCellWithUnit(data.sterilizer?.prevStock, (v) => updateHvacNestedField('sterilizer', 'prevStock', v), '', true)}</td><td className={tdClass}>{renderCellWithUnit(data.sterilizer?.inQty, (v) => updateHvacNestedField('sterilizer', 'inQty', v), '')}</td><td className={tdClass}>{renderCellWithUnit(data.sterilizer?.usedQty, (v) => updateHvacNestedField('sterilizer', 'usedQty', v), '')}</td><td className={`${tdClass} font-black text-blue-700 bg-blue-50/30`}>{data.sterilizer?.stock || '0'}</td></tr></tbody>
                </table>
            </div>
          </section>
          
          <hr className="my-4 border-gray-200" />

          <section className="max-w-[1050px] mx-auto">
            <h3 className="text-lg font-bold text-black mb-1 border-l-4 border-black pl-2">2. 보일러 가동 현황</h3>
            <table className="w-full border-collapse bg-transparent border border-gray-300 mb-2">
              <thead>
                <tr>
                  <th rowSpan={2} className={`${thClass} w-72`}>가동 시간</th>
                  <th colSpan={2} className={thClass}>가스압력(kg/cm²)</th>
                  <th rowSpan={2} className={thClass}>증기압</th>
                  <th rowSpan={2} className={thClass}>배기온도</th>
                  <th rowSpan={2} className={thClass}>급수온도</th>
                  <th rowSpan={2} className={thClass}>수위</th>
                  <th rowSpan={2} className={`${thClass} w-20`}>계(H)</th>
                </tr>
                <tr><th className={thClass}>1차</th><th className={thClass}>2차</th></tr>
              </thead>
              <tbody>
                {boilerData.logs.map((log, lIdx) => (
                  <tr key={log.id}>
                    <td className={tdClass}>
                      <div className="flex items-center justify-center h-full px-2 gap-1">
                        <input type="text" className="w-[45%] border border-gray-200 rounded px-1 font-bold text-blue-700" value={(log.runTime || '').split('~')[0] || ''} onChange={e => handleTimeChange('boiler', lIdx, 'start', e.target.value)} placeholder="00:00" />
                        <span className="font-bold text-gray-400">~</span>
                        <input type="text" className="w-[45%] border border-gray-200 rounded px-1 font-bold text-blue-700" value={(log.runTime || '').split('~')[1] || ''} onChange={e => handleTimeChange('boiler', lIdx, 'end', e.target.value)} placeholder="00:00" />
                      </div>
                    </td>
                    <td className={tdClass}><input type="text" className="w-full text-center outline-none bg-transparent font-bold" value={log.gasPressure1} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, gasPressure1:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                    <td className={tdClass}><input type="text" className="w-full text-center outline-none bg-transparent font-bold" value={log.gasPressure2} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, gasPressure2:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                    <td className={tdClass}><input type="text" className="w-full text-center outline-none bg-transparent font-bold" value={log.steamPressure} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, steamPressure:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                    <td className={tdClass}><input type="text" className="w-full text-center outline-none bg-transparent font-bold" value={log.exhaustTemp} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, exhaustTemp:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                    <td className={tdClass}><input type="text" className="w-full text-center outline-none bg-transparent font-bold" value={log.supplyTemp} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, supplyTemp:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                    <td className={tdClass}><input type="text" className="w-full text-center outline-none bg-transparent font-bold" value={log.waterLevel} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, waterLevel:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                    {lIdx === 0 && <td rowSpan={3} className={`${tdClass} font-black text-blue-800 bg-gray-50/30`}>{boilerData.totalRunTime || '0'} H</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <table className="w-full border-collapse border border-gray-300">
                  <thead><tr className="bg-gray-50"><th colSpan={4} className="p-1 text-xs font-black text-blue-800 border-b border-gray-300">보일러 가스 사용량 (m³)</th></tr><tr><th className={thClass}>전일</th><th className={thClass}>금일</th><th className={thClass}>사용</th><th className={thClass}>누계</th></tr></thead>
                  <tbody><tr><td className={tdClass}>{renderCellWithUnit(boilerData.gas?.prev, (v) => updateBoilerNestedField('gas', 'prev', v), '', true)}</td><td className={tdClass}>{renderCellWithUnit(boilerData.gas?.curr, (v) => updateBoilerNestedField('gas', 'curr', v), '')}</td><td className={`${tdClass} font-black text-blue-700`}>{boilerData.gas?.usage || '0'}</td><td className={`${tdClass} font-black text-emerald-700 bg-emerald-50/30`}>{boilerData.gas?.monthTotal || '0'}</td></tr></tbody>
                </table>
                <div className="flex flex-col gap-1.5">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead><tr className="bg-gray-50"><th colSpan={4} className="p-1 text-[11px] font-black text-blue-800 border-b border-gray-300">소금 / 청관제 수불 (kg)</th></tr><tr><th className={thClass} style={{width:'20%'}}>구분</th><th className={thClass} style={{width:'25%'}}>전일</th><th className={thClass} style={{width:'25%'}}>입고</th><th className={thClass} style={{width:'25%'}}>사용</th><th className={thClass} style={{width:'25%'}}>재고</th></tr></thead>
                    <tbody>
                      <tr><td className={thClass}>소금</td><td className={tdClass}>{renderCellWithUnit(boilerData.salt?.prevStock, (v) => updateBoilerNestedField('salt', 'prevStock', v), '', true)}</td><td className={tdClass}>{renderCellWithUnit(boilerData.salt?.inQty, (v) => updateBoilerNestedField('salt', 'inQty', v), '')}</td><td className={tdClass}>{renderCellWithUnit(boilerData.salt?.usedQty, (v) => updateBoilerNestedField('salt', 'usedQty', v), '')}</td><td className={`${tdClass} font-black text-blue-700 bg-blue-50/10`}>{boilerData.salt?.stock || '0'}</td></tr>
                      <tr><td className={thClass}>청관제</td><td className={tdClass}>{renderCellWithUnit(boilerData.cleaner?.prevStock, (v) => updateBoilerNestedField('cleaner', 'prevStock', v), '', true)}</td><td className={tdClass}>{renderCellWithUnit(boilerData.cleaner?.inQty, (v) => updateBoilerNestedField('cleaner', 'inQty', v), '')}</td><td className={tdClass}>{renderCellWithUnit(boilerData.cleaner?.usedQty, (v) => updateBoilerNestedField('cleaner', 'usedQty', v), '')}</td><td className={`${tdClass} font-black text-blue-700 bg-blue-50/10`}>{boilerData.cleaner?.stock || '0'}</td></tr>
                    </tbody>
                  </table>
                </div>
            </div>
          </section>
        </div>
      </LogSheetLayout>
    </>
  );
};

export default HvacLog;
