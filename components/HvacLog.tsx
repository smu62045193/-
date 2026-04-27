
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HvacLogData, HvacLogItem, BoilerLogData, BoilerLogItem } from '../types';
import { 
  getInitialHvacLog, 
  getInitialBoilerLog, 
  fetchDailyData, 
  saveDailyData, 
  apiFetchBatch,
  saveHvacBoilerCombined,
  getInitialDailyData,
  supabase,
  fetchAirEnvironmentLog,
  saveAirEnvironmentLog,
  fetchChemicalLog,
  saveChemicalLog,
  getInitialChemicalLog,
  fetchLatestChemicalLogBefore,
  fetchLatestHvacBoilerLogBefore
} from '../services/dataService';
import { format, subDays, parseISO, startOfMonth } from 'date-fns';
import LogSheetLayout from './LogSheetLayout';
import AirEnvironmentLog, { AirEnvironmentLogHandle } from './AirEnvironmentLog';
import { Save, RefreshCw, CheckCircle2, Cloud, X, Wind, Printer, Droplets } from 'lucide-react';

interface HvacLogProps {
  currentDate: Date;
  isEmbedded?: boolean;
  onUsageChange?: (hGas: string, bGas: string) => void;
  hvacData?: HvacLogData;
  boilerData?: BoilerLogData;
  onHvacChange?: (data: HvacLogData) => void;
  onBoilerChange?: (data: BoilerLogData) => void;
  chemicals?: any;
  onChemicalsChange?: (idx: number, field: string, value: string) => void;
  onChemicalsSave?: () => Promise<void>;
  onChemicalsRefresh?: () => void;
}

const HvacLog: React.FC<HvacLogProps> = ({ 
  currentDate, 
  isEmbedded = false, 
  onUsageChange,
  hvacData: externalHvacData,
  boilerData: externalBoilerData,
  onHvacChange,
  onBoilerChange,
  chemicals: externalChemicals,
  onChemicalsChange,
  onChemicalsSave,
  onChemicalsRefresh
}) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isPrintEnabledHvac, setIsPrintEnabledHvac] = useState(false);
  const [isPrintEnabledAirEnv, setIsPrintEnabledAirEnv] = useState(false);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  
  const [internalHvacData, setInternalHvacData] = useState<HvacLogData>(getInitialHvacLog(dateKey));
  const [internalBoilerData, setInternalBoilerData] = useState<BoilerLogData>(getInitialBoilerLog(dateKey));
  const [chemicalData, setChemicalData] = useState<any>(null);
  
  const data = externalHvacData || internalHvacData;
  const boilerData = externalBoilerData || internalBoilerData;
  const setData = onHvacChange || setInternalHvacData;
  const setBoilerData = onBoilerChange || setInternalBoilerData;

  const [activeSubTab, setActiveSubTab] = useState<'hvac' | 'boiler' | 'air_env' | 'chemicals'>('hvac');
  const airEnvRef = useRef<AirEnvironmentLogHandle>(null);
  
  const prevDayInfoRef = useRef({
    hvacMonthTotal: 0,
    boilerMonthTotal: 0,
    hvacStock: 0,
    saltStock: 0,
    cleanerStock: 0
  });

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

  const applyCalculations = useCallback((hvac: HvacLogData, boiler: BoilerLogData) => {
    const nextHvac = JSON.parse(JSON.stringify(hvac)) as HvacLogData;
    const nextBoiler = JSON.parse(JSON.stringify(boiler)) as BoilerLogData;
    const monthStartStr = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const is1st = dateKey === monthStartStr;

    if (nextHvac.gas) {
      const prev = safeParseFloat(nextHvac.gas.prev);
      const curr = safeParseFloat(nextHvac.gas.curr);
      const usage = Math.max(0, curr - prev);
      nextHvac.gas.usage = curr > 0 ? Math.round(usage).toString() : '';
      const baseTotal = is1st ? 0 : prevDayInfoRef.current.hvacMonthTotal;
      nextHvac.gas.monthTotal = curr > 0 ? Math.round(baseTotal + usage).toString() : Math.round(baseTotal).toString();
    }

    if (nextHvac.sterilizer) {
      const prev = safeParseFloat(nextHvac.sterilizer.prevStock);
      const incoming = safeParseFloat(nextHvac.sterilizer.inQty);
      const used = safeParseFloat(nextHvac.sterilizer.usedQty);
      nextHvac.sterilizer.stock = Math.round(prev + incoming - used).toString();
    }

    if (nextBoiler.gas) {
      const prev = safeParseFloat(nextBoiler.gas.prev);
      const curr = safeParseFloat(nextBoiler.gas.curr);
      const usage = Math.max(0, curr - prev);
      nextBoiler.gas.usage = curr > 0 ? Math.round(usage).toString() : '';
      const baseTotal = is1st ? 0 : prevDayInfoRef.current.boilerMonthTotal;
      nextBoiler.gas.monthTotal = curr > 0 ? Math.round(baseTotal + usage).toString() : Math.round(baseTotal).toString();
    }

    if (nextBoiler.salt) {
      const prev = safeParseFloat(nextBoiler.salt.prevStock);
      const incoming = safeParseFloat(nextBoiler.salt.inQty);
      const used = safeParseFloat(nextBoiler.salt.usedQty);
      nextBoiler.salt.stock = Math.round(prev + incoming - used).toString();
    }
    if (nextBoiler.cleaner) {
      const prev = safeParseFloat(nextBoiler.cleaner.prevStock);
      const incoming = safeParseFloat(nextBoiler.cleaner.inQty);
      const used = safeParseFloat(nextBoiler.cleaner.usedQty);
      nextBoiler.cleaner.stock = Math.round(prev + incoming - used).toString();
    }

    return { nextHvac, nextBoiler };
  }, [dateKey, currentDate]);

  const loadData = useCallback(async (isRefresh = false) => {
    setIsPrintEnabledHvac(false);
    setIsPrintEnabledAirEnv(false);
    if (activeSubTab === 'air_env' && isRefresh) {
      if (airEnvRef.current) {
        await airEnvRef.current.handleSyncData();
      }
      return;
    }
    
    setLoading(true);
    setSaveStatus('idle');
    isInitialLoad.current = true;

    try {
      const latestCombined = await fetchLatestHvacBoilerLogBefore(dateKey);

      const yesterdayHvac = latestCombined?.hvac_data;
      const yesterdayBoiler = latestCombined?.boiler_data;

      prevDayInfoRef.current = {
        hvacMonthTotal: safeParseFloat(yesterdayHvac?.gas?.monthTotal),
        boilerMonthTotal: safeParseFloat(yesterdayBoiler?.gas?.monthTotal),
        hvacStock: safeParseFloat(yesterdayHvac?.sterilizer?.stock),
        saltStock: safeParseFloat(yesterdayBoiler?.salt?.stock),
        cleanerStock: safeParseFloat(yesterdayBoiler?.cleaner?.stock)
      };

      const { data: todayCombined } = await supabase
        .from('hvac_boiler_logs')
        .select('*')
        .eq('id', `HVAC_BOILER_${dateKey}`)
        .maybeSingle();

      const finalHvac = todayCombined?.hvac_data || getInitialHvacLog(dateKey);
      const finalBoiler = todayCombined?.boiler_data || getInitialBoilerLog(dateKey);

      if (!finalHvac.gas?.prev || finalHvac.gas.prev === '0' || finalHvac.gas.prev === '') {
        if (yesterdayHvac?.gas?.curr) finalHvac.gas.prev = yesterdayHvac.gas.curr;
      }
      if (!finalHvac.sterilizer?.prevStock || finalHvac.sterilizer.prevStock === '0' || finalHvac.sterilizer.prevStock === '') {
        finalHvac.sterilizer.prevStock = prevDayInfoRef.current.hvacStock.toString();
      }

      if (!finalBoiler.gas?.prev || finalBoiler.gas.prev === '0' || finalBoiler.gas.prev === '') {
        if (yesterdayBoiler?.gas?.curr) finalBoiler.gas.prev = yesterdayBoiler.gas.curr;
      }
      if (!finalBoiler.salt?.prevStock || finalBoiler.salt.prevStock === '0' || finalBoiler.salt.prevStock === '') {
        finalBoiler.salt.prevStock = prevDayInfoRef.current.saltStock.toString();
      }
      if (!finalBoiler.cleaner?.prevStock || finalBoiler.cleaner.prevStock === '0' || finalBoiler.cleaner.prevStock === '') {
        finalBoiler.cleaner.prevStock = prevDayInfoRef.current.cleanerStock.toString();
      }

      const { nextHvac, nextBoiler } = applyCalculations(finalHvac, finalBoiler);
      setData(nextHvac);
      setBoilerData(nextBoiler);

      // Fetch chemical data
      const chem = await fetchChemicalLog(dateKey);
      const latestChem = await fetchLatestChemicalLogBefore(dateKey);
      
      const finalChem = chem || getInitialChemicalLog(dateKey);
      
      if (latestChem && latestChem.items) {
        finalChem.items = finalChem.items.map((item: any) => {
          const yItem = latestChem.items.find((yi: any) => yi.name === item.name);
          if (yItem && (!item.prevStock || item.prevStock === '0' || item.prevStock === '')) {
            const prevStock = yItem.currentStock || '0';
            const received = safeParseFloat(item.received);
            const used = safeParseFloat(item.used);
            return {
              ...item,
              prevStock,
              currentStock: (safeParseFloat(prevStock) + received - used).toString()
            };
          }
          return item;
        });
      }
      setChemicalData(finalChem);

      setTimeout(() => { isInitialLoad.current = false; }, 300);
    } catch (e) { 
      console.error("Load failed:", e); 
      setData(getInitialHvacLog(dateKey));
      setBoilerData(getInitialBoilerLog(dateKey));
      setChemicalData(getInitialChemicalLog(dateKey));
    } finally { 
      setLoading(false); 
    }
  }, [dateKey, currentDate, applyCalculations, activeSubTab, setData, setBoilerData]);

  useEffect(() => { 
    if (!externalHvacData || !externalBoilerData) {
      loadData(); 
    }
  }, [loadData, externalHvacData, externalBoilerData]);

  const handleManualSave = async () => {
    if (activeSubTab === 'air_env') {
      if (airEnvRef.current) {
        await airEnvRef.current.handleSave();
        setIsPrintEnabledAirEnv(true);
      }
      return;
    }

    if (activeSubTab === 'chemicals') {
      if (onChemicalsSave) {
        await onChemicalsSave();
        return;
      }
      if (!chemicalData) return;
      setSaveStatus('loading');
      try {
        const success = await saveChemicalLog(chemicalData);
        if (success) {
          setSaveStatus('success');
          alert('종균제/소독제가 저장이되었습니다.');
          setTimeout(() => setSaveStatus('idle'), 3000);
        } else {
          setSaveStatus('error');
          alert('저장에 실패했습니다.');
        }
      } catch (e) {
        setSaveStatus('error');
        alert('오류가 발생했습니다.');
      }
      return;
    }

    if (saveStatus === 'loading') return;
    setSaveStatus('loading');
    try {
      const success = await saveHvacBoilerCombined(data, boilerData);
      
      if (success) {
        setSaveStatus('success');
        setIsPrintEnabledHvac(true);
        alert('냉온수기/보일러 일지가 저장되었습니다.');
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
      const next = { ...prev, [parent]: { ...prev[parent], [field]: value } };
      const { nextHvac } = applyCalculations(next, boilerData);
      return nextHvac;
    });
  };

  const updateBoilerNestedField = (parent: 'gas' | 'salt' | 'cleaner', field: string, value: string) => {
    setBoilerData(prev => {
      const next = { ...prev, [parent]: { ...prev[parent], [field]: value } };
      const { nextBoiler } = applyCalculations(data, next);
      return nextBoiler;
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

  const handleChemicalUpdate = (idx: number, field: string, value: string) => {
    if (onChemicalsChange) {
      onChemicalsChange(idx, field, value);
      return;
    }
    if (!chemicalData) return;
    const newItems = [...chemicalData.items];
    const item = { ...newItems[idx], [field]: value };
    
    // Calculate stock
    const prev = safeParseFloat(item.prevStock);
    const received = safeParseFloat(item.received);
    const used = safeParseFloat(item.used);
    item.currentStock = (prev + received - used).toString();
    
    newItems[idx] = item;
    setChemicalData({ ...chemicalData, items: newItems });
  };

  const handlePrint = () => {
    if (activeSubTab === 'air_env') {
      if (airEnvRef.current) {
        airEnvRef.current.handlePrint();
      }
      return;
    }
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
            body { background: black; font-family: sans-serif; margin: 0; padding: 0; }
            .hidden-in-ui { display: block !important; }
            .no-print { margin: 20px; display: flex; gap: 10px; justify-content: center; }
            .print-wrap { width: 100%; max-width: 210mm; margin: 0 auto; padding: 15mm 10mm 20mm 10mm; box-sizing: border-box; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
            @media print {
              @page { margin: 0; size: A4 portrait; }
              body { background: transparent !important; -webkit-print-color-adjust: exact; width: 100%; margin: 0; color: black !important; letter-spacing: -0.8px; }
              .no-print { display: none !important; }
              .print-wrap { margin: 0; padding: 15mm 10mm 20mm 10mm; box-shadow: none !important; }
              table { width: 100% !important; border-collapse: collapse !important; border: 1.2px solid black !important; table-layout: fixed !important; margin-bottom: 0px; }
              tr { height: 25px !important; }
              th, td { border: 1px solid black !important; text-align: center !important; height: 25px !important; color: black !important; padding: 0px !important; line-height: 25px !important; background-color: white !important; }
              td > div { height: 25px !important; line-height: 25px !important; }
              th { font-weight: normal !important; background-color: white !important; font-size: 8.5pt !important; height: 25px !important; line-height: 25px !important; }
              td { font-size: 8.5pt !important; background-color: white !important; height: 25px !important; line-height: 25px !important; }
              input { border: none !important; width: 100% !important; text-align: center !important; font-size: 8.5pt !important; height: 100% !important; font-weight: normal !important; color: black !important; background: transparent !important; letter-spacing: -0.5px; }
              input::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; }
              h3 { font-size: 14pt !important; margin-bottom: 4px !important; font-weight: 900 !important; border-left: 7px solid black !important; padding-left: 12px !important; margin-top: 10px !important; color: black !important; line-height: 1.2 !important; }
              .unit-span { font-size: 7.5pt !important; font-weight: bold !important; margin-left: 1px !important; }
              select { appearance: none !important; border: none !important; background: transparent !important; text-align: center !important; width: auto !important; font-weight: 900 !important; font-size: 13pt !important; color: black !important; padding: 0 !important; margin: 0 !important; }
              .unit-header { font-size: 13pt !important; font-weight: 900 !important; color: black !important; height: 36px !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
          <div class="print-wrap"><div id="print-body-content">${combinedContent.innerHTML}</div></div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const thClass = "border border-black bg-white text-[13px] font-normal text-center h-[32px] align-middle text-black";
  const tdClass = "border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black";

  const renderCell = (value: string | undefined, onChange: (val: string) => void, isReadonly = false) => (
    <div className="flex items-center h-full w-full px-2">
      <input 
        type="text" 
        className={`w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none ${isReadonly ? 'cursor-not-allowed opacity-70' : ''}`} 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)} 
        readOnly={isReadonly} 
      />
    </div>
  );

  const renderCellWithUnit = (value: string | undefined, onChange: (val: string) => void, unit: string, isReadonly = false) => (
    <div className="relative flex items-center justify-center h-full w-full">
      <div className={`${unit ? 'w-[70px]' : 'w-full'} flex justify-center`}>
        <input 
          type="text" 
          className={`w-full h-full text-[13px] font-normal ${unit ? 'text-right pr-1' : 'text-center'} bg-transparent border-none outline-none shadow-none appearance-none ${isReadonly ? 'cursor-not-allowed opacity-70' : ''}`} 
          value={value || ''} 
          onChange={(e) => onChange(e.target.value)} 
          readOnly={isReadonly} 
        />
      </div>
      {unit && (
        <span className="absolute right-1.5 text-[13px] font-normal whitespace-nowrap text-black pointer-events-none">
          {unit}
        </span>
      )}
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
    <LogSheetLayout
      title=""
      loading={loading}
      saveStatus={saveStatus}
      onRefresh={() => loadData(true)}
      onSave={handleManualSave}
      onPrint={handlePrint}
      isEmbedded={isEmbedded}
      hideSave={false}
      hideHeader={true}
    >
      {/* Sub-tab Menu */}
      <div className="w-full max-w-7xl bg-white mx-auto overflow-hidden print:hidden">
        <div className="flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
          <div className="flex items-stretch">
            <div
              onClick={() => setActiveSubTab('hvac')}
              className={`relative px-4 py-3 text-[14px] font-bold transition-colors whitespace-nowrap flex items-center shrink-0 cursor-pointer bg-white ${
                activeSubTab === 'hvac' ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              냉,온수기
              {activeSubTab === 'hvac' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
              )}
            </div>
            <div
              onClick={() => setActiveSubTab('boiler')}
              className={`relative px-4 py-3 text-[14px] font-bold transition-colors whitespace-nowrap flex items-center shrink-0 cursor-pointer bg-white ${
                activeSubTab === 'boiler' ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              보일러
              {activeSubTab === 'boiler' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
              )}
            </div>
            <div
              onClick={() => setActiveSubTab('air_env')}
              className={`relative px-4 py-3 text-[14px] font-bold transition-colors whitespace-nowrap flex items-center shrink-0 cursor-pointer bg-white ${
                activeSubTab === 'air_env' ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              대기환경
              {activeSubTab === 'air_env' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
              )}
            </div>
            <div
              onClick={() => setActiveSubTab('chemicals')}
              className={`relative px-4 py-3 text-[14px] font-bold transition-colors whitespace-nowrap flex items-center shrink-0 cursor-pointer bg-white ${
                activeSubTab === 'chemicals' ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              종균제/소독제
              {activeSubTab === 'chemicals' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
              )}
            </div>
          </div>
          
          <div className="flex items-center shrink-0 px-2">
            <div className="w-[1px] h-6 bg-black"></div>
          </div>

          <div className="flex items-center shrink-0">
            <button 
              onClick={() => loadData(true)} 
              disabled={loading} 
              className="relative px-4 py-3 text-[14px] font-bold text-gray-500 hover:text-black transition-colors whitespace-nowrap disabled:opacity-50 flex items-center shrink-0"
            >
              <RefreshCw size={16} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>

            <button 
              onClick={handleManualSave} 
              disabled={loading || saveStatus === 'loading'} 
              className={`relative px-4 py-3 text-[14px] font-bold transition-colors whitespace-nowrap flex items-center shrink-0 ${
                saveStatus === 'success' ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              {saveStatus === 'loading' ? (
                <RefreshCw size={16} className="mr-1.5 animate-spin" />
              ) : saveStatus === 'success' ? (
                <CheckCircle2 size={16} className="mr-1.5" />
              ) : (
                <Save size={16} className="mr-1.5" />
              )}
              {saveStatus === 'success' ? '저장완료' : '저장'}
            </button>

            {activeSubTab !== 'chemicals' && activeSubTab !== 'boiler' && (
              <button 
                onClick={handlePrint} 
                disabled={(activeSubTab === 'hvac' && !isPrintEnabledHvac) || (activeSubTab === 'air_env' && !isPrintEnabledAirEnv)}
                className={`relative px-4 py-3 font-bold transition-colors whitespace-nowrap flex items-center shrink-0 disabled:opacity-50 text-[14px] ${
                  ((activeSubTab === 'hvac' && !isPrintEnabledHvac) || (activeSubTab === 'air_env' && !isPrintEnabledAirEnv)) ? 'text-gray-300' : 'text-gray-500 hover:text-black'
                }`}
              >
                <Printer size={16} className="mr-1.5" />
                인쇄
              </button>
            )}
          </div>
        </div>
      </div>

      <div id="combined-hvac-boiler-area" className="bg-transparent space-y-0 p-1">
        <section className={`max-w-7xl mx-auto ${activeSubTab === 'hvac' ? '' : 'hidden-in-ui'}`}>
          <h3 className="text-lg font-bold text-black mb-1 border-l-4 border-black pl-2 hidden-in-ui">1. 냉·온수기 가동 현황</h3>
          <div className="flex flex-col gap-2">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-white border border-black text-center text-black">
                    <thead>
                        <tr className="border-b border-black h-[32px]">
                            <th rowSpan={2} className={`${thClass} w-48`}>점검 항목</th>
                            <th colSpan={2} className={`${thClass} h-[32px] text-[13px] font-normal text-black`}>
                                냉,온수기 (<span className="hidden print:inline-block">{data.unitNo || '\u00A0\u00A0\u00A0'}</span><select value={data.unitNo || ''} onChange={(e) => setData(prev => ({...prev, unitNo: e.target.value}))} className="bg-transparent text-black font-normal outline-none cursor-pointer px-1 appearance-none border-none text-[13px] print:hidden"><option value=""> </option><option value="1">1</option><option value="2">2</option></select>) 호기
                            </th>
                        </tr>
                        <tr className="border-b border-black h-[32px]"><th className={thClass}>10:00</th><th className={thClass}>15:00</th></tr>
                    </thead>
                    <tbody>
                        {hvacMainRows.map((row) => (
                          <tr key={row.key} className="border-b border-black h-[32px]">
                            <td className={`${thClass} text-center font-normal`}>{row.label}</td>
                            <td className={tdClass}>{renderCellWithUnit((data[row.key as keyof HvacLogData] as any)?.time10, (v) => setData(prev => ({...prev, [row.key]: {...(prev[row.key as keyof HvacLogData] as any), time10: v}})), row.unit)}</td>
                            <td className={tdClass}>{renderCellWithUnit((data[row.key as keyof HvacLogData] as any)?.time15, (v) => setData(prev => ({...prev, [row.key]: {...(prev[row.key as keyof HvacLogData] as any), time15: v}})), row.unit)}</td>
                          </tr>
                        ))}
                        <tr className="border-b border-black h-[32px]">
                            <td className={`${thClass} text-center font-normal`}>운 전 시 간</td>
                            <td colSpan={2} className={tdClass}>
                                <div className="flex items-center justify-center h-full px-2">
                                    <input type="text" className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" value={(data.hvacLogs?.[0]?.runTime || '').split('~')[0] || ''} onChange={e => handleTimeChange('hvac', 0, 'start', e.target.value)} placeholder="00:00" />
                                    <span className="px-1 font-normal text-black">~</span>
                                    <input type="text" className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" value={(data.hvacLogs?.[0]?.runTime || '').split('~')[1] || ''} onChange={e => handleTimeChange('hvac', 0, 'end', e.target.value)} placeholder="00:00" />
                                </div>
                            </td>
                        </tr>
                        <tr className="border-b border-black h-[32px]"><td className={`${thClass} text-center font-normal`}>총 가 동 시 간</td><td colSpan={2} className={tdClass}><input type="text" className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" value={data.totalRunTime ? `${data.totalRunTime} H` : ''} readOnly /></td></tr>
                    </tbody>
                </table>
            </div>
            <div className="flex flex-col gap-2">
                <table className="w-full border-collapse bg-white table-fixed border border-black text-center text-black">
                  <thead><tr className="border-b border-black h-[32px]"><th className={`${thClass} w-[20%] whitespace-nowrap`}>구분</th><th className={`${thClass} w-[20%]`}>전일(m³)</th><th className={`${thClass} w-[20%]`}>금일(m³)</th><th className={`${thClass} w-[20%]`}>사용(m³)</th><th className={`${thClass} w-[20%]`}>누계(m³)</th></tr></thead>
                  <tbody><tr className="border-b border-black h-[32px]"><td className={`${thClass} whitespace-nowrap font-normal`}>냉,온수기 가스 사용량</td><td className={tdClass}>{renderCellWithUnit(data.gas?.prev, (v) => updateHvacNestedField('gas', 'prev', v), '')}</td><td className={tdClass}>{renderCellWithUnit(data.gas?.curr, (v) => updateHvacNestedField('gas', 'curr', v), '')}</td><td className={tdClass}>{renderCellWithUnit(data.gas?.usage, () => {}, '', true)}</td><td className={tdClass}>{renderCellWithUnit(data.gas?.monthTotal, () => {}, '', true)}</td></tr></tbody>
                </table>
                <table className="w-full border-collapse bg-white table-fixed border border-black text-center text-black">
                  <thead><tr className="border-b border-black h-[32px]"><th className={`${thClass} w-[20%] whitespace-nowrap`}>구분</th><th className={`${thClass} w-[20%]`}>전일(kg)</th><th className={`${thClass} w-[20%]`}>입고(kg)</th><th className={`${thClass} w-[20%]`}>사용(kg)</th><th className={`${thClass} w-[20%]`}>재고(kg)</th></tr></thead>
                  <tbody><tr className="border-b border-black h-[32px]"><td className={`${thClass} whitespace-nowrap font-normal`}>냉각탑 살균제</td><td className={tdClass}>{renderCellWithUnit(data.sterilizer?.prevStock, (v) => updateHvacNestedField('sterilizer', 'prevStock', v), '')}</td><td className={tdClass}>{renderCellWithUnit(data.sterilizer?.inQty, (v) => updateHvacNestedField('sterilizer', 'inQty', v), '')}</td><td className={tdClass}>{renderCellWithUnit(data.sterilizer?.usedQty, (v) => updateHvacNestedField('sterilizer', 'usedQty', v), '')}</td><td className={tdClass}>{renderCellWithUnit(data.sterilizer?.stock, () => {}, '', true)}</td></tr></tbody>
                </table>
            </div>
          </div>
        </section>
        
        <hr className="my-6 border-t-2 border-black opacity-20 hidden-in-ui" />

        <section className={`max-w-7xl mx-auto ${activeSubTab === 'boiler' ? '' : 'hidden-in-ui'}`}>
          <h3 className="text-lg font-bold text-black mb-1 border-l-4 border-black pl-2 hidden-in-ui">2. 보일러 가동 현황</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white border border-black text-center text-black">
              <thead>
                <tr className="border-b border-black h-[32px]">
                  <th rowSpan={2} className="border border-black text-[13px] font-normal text-center h-[32px] align-middle text-black w-72 whitespace-nowrap">운전시간(H)</th>
                  <th colSpan={2} className="border border-black text-[13px] font-normal text-center h-[32px] align-middle text-black">가스압력(kg/cm²)</th>
                  <th rowSpan={2} className="border border-black text-[13px] font-normal text-center h-[32px] align-middle text-black">증기압<br/>(kg/cm²)</th>
                  <th rowSpan={2} className="border border-black text-[13px] font-normal text-center h-[32px] align-middle text-black">배기온도<br/>(℃)</th>
                  <th rowSpan={2} className="border border-black text-[13px] font-normal text-center h-[32px] align-middle text-black">급수온도<br/>(℃)</th>
                  <th rowSpan={2} className="border border-black text-[13px] font-normal text-center h-[32px] align-middle text-black">급탕온도<br/>(℃)</th>
                  <th rowSpan={2} className="border border-black text-[13px] font-normal text-center h-[32px] align-middle text-black">수위(%)</th>
                </tr>
                <tr className="border-b border-black h-[32px]"><th className="border border-black text-[13px] font-normal text-center h-[32px] align-middle text-black">1차</th><th className="border border-black text-[13px] font-normal text-center h-[32px] align-middle text-black">2차</th></tr>
              </thead>
              <tbody>
                {boilerData.logs.map((log, lIdx) => (
                  <tr key={log.id} className="border-b border-black h-[32px]">
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">
                      <div className="flex items-center justify-center h-full px-2 gap-1">
                        <input 
                          type="text" 
                          className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" 
                          value={(log.runTime || '').split('~')[0] || ''} 
                          onChange={e => handleTimeChange('boiler', lIdx, 'start', e.target.value)} 
                          placeholder="00:00"
                        />
                        <span className="font-normal text-black text-[13px]">~</span>
                        <input 
                          type="text" 
                          className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" 
                          value={(log.runTime || '').split('~')[1] || ''} 
                          onChange={e => handleTimeChange('boiler', lIdx, 'end', e.target.value)} 
                          placeholder="00:00"
                        />
                      </div>
                    </td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black"><input type="text" className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" value={log.gasPressure1} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, gasPressure1:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black"><input type="text" className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" value={log.gasPressure2} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, gasPressure2:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black"><input type="text" className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" value={log.steamPressure} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, steamPressure:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black"><input type="text" className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" value={log.exhaustTemp} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, exhaustTemp:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black"><input type="text" className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" value={log.supplyTemp} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, supplyTemp:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black"><input type="text" className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" value={log.hotWaterTemp} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, hotWaterTemp:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black"><input type="text" className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" value={log.waterLevel} onChange={e => { const nl=[...boilerData.logs]; nl[lIdx]={...log, waterLevel:e.target.value}; setBoilerData({...boilerData, logs:nl}); }} /></td>
                  </tr>
                ))}
                <tr className="border-b border-black">
                  <td className={`${thClass} whitespace-nowrap`}>총 가 동 시 간</td>
                  <td colSpan={7} className={tdClass}>
                    <div className="flex items-center justify-center h-full">
                      <input type="text" className="w-full h-full text-center outline-none font-normal text-black text-[13px] bg-transparent" value={boilerData.totalRunTime ? `${boilerData.totalRunTime} H` : ''} readOnly />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <table className="w-full border-collapse bg-transparent table-fixed border border-black text-center text-black">
              <thead><tr className="border-b border-black"><th className={`${thClass} w-[20%] whitespace-nowrap`}>구분</th><th className={`${thClass} w-[20%]`}>전일(m³)</th><th className={`${thClass} w-[20%]`}>금일(m³)</th><th className={`${thClass} w-[20%]`}>사용(m³)</th><th className={`${thClass} w-[20%]`}>누계(m³)</th></tr></thead>
              <tbody><tr className="border-b border-black"><td className={`${thClass} font-normal`}>보일러 가스 사용량</td><td className={tdClass}>{renderCellWithUnit(boilerData.gas?.prev, (v) => updateBoilerNestedField('gas', 'prev', v), '')}</td><td className={tdClass}>{renderCellWithUnit(boilerData.gas?.curr, (v) => updateBoilerNestedField('gas', 'curr', v), '')}</td><td className={tdClass}>{renderCellWithUnit(boilerData.gas?.usage, () => {}, '', true)}</td><td className={tdClass}>{renderCellWithUnit(boilerData.gas?.monthTotal, () => {}, '', true)}</td></tr></tbody>
            </table>
            
            <table className="w-full border-collapse bg-transparent table-fixed border border-black text-center text-black">
              <thead>
                <tr className="border-b border-black">
                  <th className={`${thClass} w-[20%] whitespace-nowrap`}>구분</th>
                  <th className={`${thClass} w-[20%]`}>전일(kg)</th>
                  <th className={`${thClass} w-[20%]`}>입고(kg)</th>
                  <th className={`${thClass} w-[20%]`}>사용(kg)</th>
                  <th className={`${thClass} w-[20%]`}>재고(kg)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-black">
                  <td className={`${thClass} font-normal`}>소금</td>
                  <td className={tdClass}>{renderCellWithUnit(boilerData.salt?.prevStock, (v) => updateBoilerNestedField('salt', 'prevStock', v), '')}</td>
                  <td className={tdClass}>{renderCellWithUnit(boilerData.salt?.inQty, (v) => updateBoilerNestedField('salt', 'inQty', v), '')}</td>
                  <td className={tdClass}>{renderCellWithUnit(boilerData.salt?.usedQty, (v) => updateBoilerNestedField('salt', 'usedQty', v), '')}</td>
                  <td className={tdClass}>
                    <div className="w-full h-full flex items-center justify-center font-normal text-black bg-transparent">
                      {boilerData.salt?.stock || '0'}
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-black">
                  <td className={`${thClass} font-normal`}>청관제</td>
                  <td className={tdClass}>{renderCellWithUnit(boilerData.cleaner?.prevStock, (v) => updateBoilerNestedField('cleaner', 'prevStock', v), '')}</td>
                  <td className={tdClass}>{renderCellWithUnit(boilerData.cleaner?.inQty, (v) => updateBoilerNestedField('cleaner', 'inQty', v), '')}</td>
                  <td className={tdClass}>{renderCellWithUnit(boilerData.cleaner?.usedQty, (v) => updateBoilerNestedField('cleaner', 'usedQty', v), '')}</td>
                  <td className={tdClass}>
                    <div className="w-full h-full flex items-center justify-center font-normal text-black bg-transparent">
                      {boilerData.cleaner?.stock || '0'}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className={`max-w-7xl mx-auto ${activeSubTab === 'air_env' ? '' : 'hidden'}`}>
          <AirEnvironmentLog ref={airEnvRef} currentDate={currentDate} />
        </section>

        <section className={`max-w-7xl mx-auto ${activeSubTab === 'chemicals' ? '' : 'hidden'}`}>
          <table className="w-full border-collapse bg-white border border-black text-center text-[13px] font-normal text-black table-fixed">
            <thead>
              <tr className="border-b border-black h-[32px]">
                <th className="border border-black text-[13px] font-normal text-center h-[32px] align-middle text-black w-[20%] print:w-32">구분</th>
                <th className="border border-black text-[13px] font-normal text-center h-[32px] align-middle text-black w-[20%] print:w-auto">전일</th>
                <th className="border border-black text-[13px] font-normal text-center h-[32px] align-middle text-black w-[20%] print:w-auto">입고</th>
                <th className="border border-black text-[13px] font-normal text-center h-[32px] align-middle text-black w-[20%] print:w-auto">투입</th>
                <th className="border border-black text-[13px] font-normal text-center h-[32px] align-middle text-black w-[20%] print:w-auto">재고</th>
              </tr>
            </thead>
            <tbody>
              {externalChemicals ? (
                <>
                  <tr className="border-b border-black h-[32px]">
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">종균제(l)</td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">
                      <div className="flex items-center h-full w-full px-2"><input type="text" value={externalChemicals.seed.prev || ''} onChange={e => onChemicalsChange?.(0, 'prev', e.target.value)} className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" placeholder="0" /></div>
                    </td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">
                      <div className="flex items-center h-full w-full px-2"><input type="text" value={externalChemicals.seed.incoming || ''} onChange={e => onChemicalsChange?.(0, 'incoming', e.target.value)} className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" placeholder="0" /></div>
                    </td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">
                      <div className="flex items-center h-full w-full px-2"><input type="text" value={externalChemicals.seed.used || ''} onChange={e => onChemicalsChange?.(0, 'used', e.target.value)} className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" placeholder="0" /></div>
                    </td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">
                      <div className="flex items-center justify-center h-full w-full px-2">{externalChemicals.seed.stock || '0'}</div>
                    </td>
                  </tr>
                  <tr className="border-b border-black h-[32px]">
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">소독제(kg)</td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">
                      <div className="flex items-center h-full w-full px-2"><input type="text" value={externalChemicals.sterilizer.prev || ''} onChange={e => onChemicalsChange?.(1, 'prev', e.target.value)} className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" placeholder="0" /></div>
                    </td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">
                      <div className="flex items-center h-full w-full px-2"><input type="text" value={externalChemicals.sterilizer.incoming || ''} onChange={e => onChemicalsChange?.(1, 'incoming', e.target.value)} className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" placeholder="0" /></div>
                    </td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">
                      <div className="flex items-center h-full w-full px-2"><input type="text" value={externalChemicals.sterilizer.used || ''} onChange={e => onChemicalsChange?.(1, 'used', e.target.value)} className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" placeholder="0" /></div>
                    </td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">
                      <div className="flex items-center justify-center h-full w-full px-2">{externalChemicals.sterilizer.stock || '0'}</div>
                    </td>
                  </tr>
                </>
              ) : (
                chemicalData?.items?.map((item: any, idx: number) => (
                  <tr key={item.id} className="border-b border-black h-[32px]">
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">{item.name}</td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">
                      <div className="flex items-center h-full w-full px-2"><input type="text" value={item.prevStock || ''} onChange={e => handleChemicalUpdate(idx, 'prevStock', e.target.value)} className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" placeholder="0" /></div>
                    </td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">
                      <div className="flex items-center h-full w-full px-2"><input type="text" value={item.received || ''} onChange={e => handleChemicalUpdate(idx, 'received', e.target.value)} className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" placeholder="0" /></div>
                    </td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">
                      <div className="flex items-center h-full w-full px-2"><input type="text" value={item.used || ''} onChange={e => handleChemicalUpdate(idx, 'used', e.target.value)} className="w-full h-full text-[13px] font-normal text-center bg-transparent border-none outline-none shadow-none appearance-none" placeholder="0" /></div>
                    </td>
                    <td className="border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black">
                      <div className="flex items-center justify-center h-full w-full px-2">{item.currentStock || '0'}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </LogSheetLayout>
  );
};

export default HvacLog;
