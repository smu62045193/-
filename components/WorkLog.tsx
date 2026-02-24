
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  fetchDailyData, 
  saveDailyData, 
  fetchConsumables, 
  fetchSubstationChecklist, 
  saveSubstationChecklist, 
  getInitialSubstationChecklist, 
  deepMerge, 
  saveFireFacilityLog, 
  saveElevatorLog, 
  fetchFireFacilityLog, 
  fetchElevatorLog, 
  getInitialFireFacilityLog, 
  getInitialElevatorLog, 
  fetchGasLog, 
  fetchSepticLog, 
  getInitialGasLog, 
  getInitialSepticLog, 
  saveAirEnvironmentLog,
  saveGasLog,
  saveSepticLog,
  apiFetchBatch,
  saveSubstationLog,
  saveHvacBoilerCombined,
  supabase,
  apiFetchRange,
  getInitialHvacLog,
  getInitialBoilerLog
} from '../services/dataService';
import { 
  DailyData, 
  WorkLogData, 
  LogCategory, 
  TaskItem, 
  DutyStatus, 
  UtilityUsage, 
  SubstationChecklistData, 
  FireFacilityLogData, 
  ElevatorLogData, 
  MechanicalChemicals, 
  ChemicalStatusItem, 
  GasLogData, 
  SepticLogData, 
  WeatherData,
  GasCheckItem,
  SepticCheckItem,
  HvacLogData,
  BoilerLogData
} from '../types';
import { format, addDays, subDays, parseISO, startOfMonth } from 'date-fns';
import { Plus, Trash2, LayoutList, RefreshCw, ArrowRightCircle, CheckCircle2, Save, Cloud, X, Printer, Car, Shield, Droplets, ClipboardCheck, Flame, Zap, Search, Calendar, History, ClipboardList, ArrowUpDown, Edit3 } from 'lucide-react';
import SubstationLog from './SubstationLog';
import HvacLog from './HvacLog';
import FireFacilityCheck from './FireFacilityCheck';
import ElevatorLog from './ElevatorLog';
import AirEnvironmentLog from './AirEnvironmentLog';
import SubstationChecklistLog from './SubstationChecklistLog';
import { fetchWeatherInfo } from '../services/geminiService';
import { WORK_LOG_TABS } from '../constants';
import { 
  getAutomatedElectricalTasks, 
  getAutomatedMechanicalTasks, 
  getAutomatedFireTasks, 
  getAutomatedElevatorTasks, 
  getAutomatedParkingTasks,
  getAutomatedSecurityTasks,
  getAutomatedCleaningTasks
} from '../services/automationService';

const generateId = () => `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

const DEFAULT_DUTY: DutyStatus = { day: '', night: '', off: '', vacation: '', deputy: '', chief: '', leader: '' };
const DEFAULT_UTILITY: UtilityUsage = { electricity: '', hvacGas: '', boilerGas: '' };

const EMPTY_LOG_CATEGORY: LogCategory = { today: [], tomorrow: [] };
const INITIAL_CHEMICALS: MechanicalChemicals = {
  seed: { prev: '', incoming: '', used: '', stock: '' },
  sterilizer: { prev: '', incoming: '', used: '', stock: '' }
};

const INITIAL_WORKLOG: WorkLogData = {
  scheduled: [],
  electrical: { ...EMPTY_LOG_CATEGORY },
  substation: { ...EMPTY_LOG_CATEGORY },
  mechanical: { ...EMPTY_LOG_CATEGORY },
  mechanicalChemicals: { ...INITIAL_CHEMICALS },
  hvac: { ...EMPTY_LOG_CATEGORY },
  boiler: { ...EMPTY_LOG_CATEGORY },
  fire: { ...EMPTY_LOG_CATEGORY },
  elevator: { ...EMPTY_LOG_CATEGORY },
  parking: { ...EMPTY_LOG_CATEGORY },
  security: { ...EMPTY_LOG_CATEGORY },
  cleaning: { ...EMPTY_LOG_CATEGORY },
  handover: { ...EMPTY_LOG_CATEGORY },
};

// 딥카피 헬퍼
const getFreshInitialWorkLog = (): WorkLogData => JSON.parse(JSON.stringify(INITIAL_WORKLOG));

interface TaskRowProps {
  item: TaskItem;
  isToday: boolean;
  onUpdate: (updated: TaskItem) => void;
  onDelete: () => void;
}

const TaskRow: React.FC<TaskRowProps> = ({ item, isToday, onUpdate, onDelete }) => (
  <div className="flex items-center space-x-2 py-1.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors px-3 rounded group">
    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isToday ? 'bg-blue-400' : 'bg-indigo-400'}`}></div>
    <input 
      type="text"
      value={item?.content || ''}
      onChange={(e) => onUpdate({ ...item, content: e.target.value })}
      className="flex-1 text-sm text-black bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-100 rounded px-2 h-9 border border-transparent focus:border-gray-100 font-medium !text-left"
      placeholder={isToday ? "작업 내용을 입력하세요" : "예정 사항을 입력하세요"}
    />
    <button onClick={onDelete} className="text-gray-300 hover:text-red-500 p-2 transition-colors opacity-0 group-hover:opacity-100" title="삭제">
      <Trash2 size={16} />
    </button>
  </div>
);

interface DetailedLogSectionProps {
  title: string;
  icon?: React.ReactNode;
  data: LogCategory;
  onUpdate: (newData: LogCategory) => void;
  onPrint?: () => void;
  onRefresh?: () => void;
  onSave?: () => void;
}

const DetailedLogSection: React.FC<DetailedLogSectionProps> = ({ title, icon, data, onUpdate, onPrint, onRefresh, onSave }) => {
  const safeData: LogCategory = {
    today: data?.today || [],
    tomorrow: data?.tomorrow || []
  };

  const handleAddItem = (type: 'today' | 'tomorrow') => {
    const newItem: TaskItem = { 
      id: generateId(), 
      content: '', 
      frequency: '일일', 
      status: type === 'today' ? '완료' : undefined 
    };
    onUpdate({ ...safeData, [type]: [...safeData[type], newItem] });
  };

  const handleUpdateItem = (type: 'today' | 'tomorrow', index: number, updatedItem: TaskItem) => {
    const newList = [...safeData[type]];
    newList[index] = updatedItem;
    onUpdate({ ...safeData, [type]: newList });
  };

  const handleDeleteItem = (type: 'today' | 'tomorrow', index: number) => {
    const newList = safeData[type].filter((_, i) => i !== index);
    onUpdate({ ...safeData, [type]: newList });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm animate-fade-in-down">
      <div className="bg-gray-50/50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="font-bold text-gray-800">{title}</h4>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button 
              onClick={onRefresh}
              className="flex items-center justify-center px-4 py-2 bg-white text-emerald-600 rounded-xl hover:bg-emerald-50 border border-gray-200 font-bold shadow-sm transition-all text-sm active:scale-95"
            >
              <RefreshCw size={18} className="mr-2" />
              새로고침
            </button>
          )}
          {onSave && (
            <button 
              onClick={onSave}
              className="flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-md transition-all text-sm active:scale-95"
            >
              <Save size={18} className="mr-2" />
              서버저장
            </button>
          )}
          {onPrint && (
            <button 
              onClick={onPrint}
              className="flex items-center justify-center px-6 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-bold shadow-md transition-all text-sm active:scale-95"
            >
              <Printer size={18} className="mr-2" />
              미리보기
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
        <div className="p-5">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-blue-50">
            <h4 className="text-sm font-bold text-blue-700 flex items-center">
              <CheckCircle2 size={16} className="mr-2 text-blue-500" />
              금일 작업내용
            </h4>
            <button 
              onClick={() => handleAddItem('today')} 
              className="text-xs flex items-center bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors font-bold border border-blue-100"
            >
              <Plus size={14} className="mr-1" /> 추가
            </button>
          </div>
          <div className="space-y-1 min-h-[100px]">
            {safeData.today.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6 italic">등록된 작업이 없습니다.</p>
            ) : (
              safeData.today.map((item, idx) => (
                <TaskRow 
                  key={item?.id || idx} 
                  item={item} 
                  isToday={true} 
                  onUpdate={(u) => handleUpdateItem('today', idx, u)} 
                  onDelete={() => handleDeleteItem('today', idx)} 
                />
              ))
            )}
          </div>
        </div>

        <div className="p-5 bg-indigo-50/10">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-indigo-50">
            <h4 className="text-sm font-bold text-indigo-700 flex items-center">
              <ArrowRightCircle size={16} className="mr-2 text-indigo-500" />
              익일 예정사항
            </h4>
            <button 
              onClick={() => handleAddItem('tomorrow')} 
              className="text-xs flex items-center bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors font-bold border border-blue-100"
            >
              <Plus size={14} className="mr-1" /> 추가
            </button>
          </div>
          <div className="space-y-1 min-h-[100px]">
             {safeData.tomorrow.length === 0 ? (
               <p className="text-xs text-gray-400 text-center py-6 italic">등록된 예정사항이 없습니다.</p>
             ) : (
              safeData.tomorrow.map((item, idx) => (
                <TaskRow 
                  key={item?.id || idx} 
                  item={item} 
                  isToday={false} 
                  onUpdate={(u) => handleUpdateItem('tomorrow', idx, u)} 
                  onDelete={() => handleDeleteItem('tomorrow', idx)} 
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface WorkLogProps {
  currentDate: Date;
}

const WorkLog: React.FC<WorkLogProps> = ({ currentDate }) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [facilityDuty, setFacilityDuty] = useState<DutyStatus>(DEFAULT_DUTY);
  const [securityDuty, setSecurityDuty] = useState<DutyStatus>(DEFAULT_DUTY);
  const [utility, setUtility] = useState<UtilityUsage>(DEFAULT_UTILITY);
  const [logData, setLogData] = useState<WorkLogData>(getFreshInitialWorkLog());
  const [activeTab, setActiveTab] = useState('electrical');
  const [weather, setWeather] = useState<WeatherData | null>(null);

  const [gasLog, setGasLog] = useState<GasLogData>(getInitialGasLog(''));
  const [septicLog, setSepticLog] = useState<SepticLogData>(getInitialSepticLog(''));
  
  const [hvacGasReadings, setHvacGasReadings] = useState<HvacLogData>(getInitialHvacLog(''));
  const [boilerGasReadings, setBoilerGasReadings] = useState<BoilerLogData>(getInitialBoilerLog(''));
  const historySumsRef = useRef({ hvac: 0, boiler: 0 });

  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const tomorrowDateKey = format(addDays(currentDate, 1), 'yyyy-MM-dd');
  
  const isInitialLoad = useRef(true);

  const safeParseFloat = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const cleaned = val.toString().replace(/,/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const calculateGasAnalysis = useCallback((hvac: HvacLogData, boiler: BoilerLogData, sums: {hvac: number, boiler: number}) => {
    const nextHvac = JSON.parse(JSON.stringify(hvac)) as HvacLogData;
    const nextBoiler = JSON.parse(JSON.stringify(boiler)) as BoilerLogData;

    if (nextHvac.gas) {
      const p = safeParseFloat(nextHvac.gas.prev);
      const c = safeParseFloat(nextHvac.gas.curr);
      if (c > 0) {
        const u = Math.max(0, c - p);
        nextHvac.gas.usage = Math.round(u).toString();
        nextHvac.gas.monthTotal = Math.round(sums.hvac + u).toString();
      } else {
        nextHvac.gas.usage = '';
        nextHvac.gas.monthTotal = Math.round(sums.hvac).toString();
      }
    }

    if (nextBoiler.gas) {
      const p = safeParseFloat(nextBoiler.gas.prev);
      const c = safeParseFloat(nextBoiler.gas.curr);
      if (c > 0) {
        const u = Math.max(0, c - p);
        nextBoiler.gas.usage = Math.round(u).toString();
        nextBoiler.gas.monthTotal = Math.round(sums.boiler + u).toString();
      } else {
        nextBoiler.gas.usage = '';
        nextBoiler.gas.monthTotal = Math.round(sums.boiler).toString();
      }
    }

    return { nextHvac, nextBoiler };
  }, []);

  const loadData = useCallback(async (isCancelled: () => boolean, force = false) => {
    setLoading(true);
    isInitialLoad.current = true;
    try {
      const monthStart = startOfMonth(currentDate);
      const monthStartStr = format(monthStart, 'yyyy-MM-dd');
      const searchStart = format(subDays(currentDate, 14), 'yyyy-MM-dd');
      const yesterdayStr = format(subDays(currentDate, 1), 'yyyy-MM-dd');

      const batchResults = await apiFetchBatch([
        { type: 'get', key: `DAILY_${dateKey}` },
        { type: 'get', key: `GAS_LOG_${dateKey}` },
        { type: 'get', key: `SEPTIC_LOG_${dateKey}` },
        { type: 'range', prefix: "DAILY_", start: searchStart, end: yesterdayStr },
        { type: 'get', key: `HVAC_BOILER_${dateKey}` },
        { type: 'range', prefix: "HVAC_LOG_", start: monthStartStr, end: yesterdayStr },
        { type: 'range', prefix: "BOILER_LOG_", start: monthStartStr, end: yesterdayStr }
      ]);

      if (isCancelled()) return;

      const serverDataResult = batchResults[0]?.data as DailyData;
      const gasData = batchResults[1]?.data as GasLogData;
      const septicData = batchResults[2]?.data as SepticLogData;
      const recentLogs = batchResults[3]?.data || [];
      const hvacBoilerCombined = batchResults[4]?.data;
      const hvacHistory = batchResults[5]?.data || [];
      const boilerHistory = batchResults[6]?.data || [];

      const { data: yDailyRaw } = await supabase
        .from('daily_reports')
        .select('work_log')
        .eq('id', yesterdayStr)
        .maybeSingle();
      const yesterdayDirectReport = yDailyRaw?.work_log as WorkLogData;

      setGasLog(gasData || getInitialGasLog(dateKey));
      setSepticLog(septicData || getInitialSepticLog(dateKey));

      let hSum = 0; let bSum = 0;
      let hLatestRecord = null; let bLatestRecord = null;

      if (hvacHistory.length > 0) {
        const filtered = hvacHistory.filter((row: any) => row.key.replace('HVAC_LOG_', '') < dateKey);
        filtered.forEach((row: any) => {
          const u = row.data?.gas?.usage || row.data?.hvac_data?.gas?.usage;
          if (u) hSum += safeParseFloat(u);
        });
        const sorted = [...filtered].sort((a:any, b:any) => b.key.localeCompare(a.key));
        if (sorted.length > 0) hLatestRecord = sorted[0].data;
      }

      if (boilerHistory.length > 0) {
        const filtered = boilerHistory.filter((row: any) => row.key.replace('BOILER_LOG_', '') < dateKey);
        filtered.forEach((row: any) => {
          const u = row.data?.gas?.usage || row.data?.boiler_data?.gas?.usage;
          if (u) bSum += safeParseFloat(u);
        });
        const sorted = [...filtered].sort((a:any, b:any) => b.key.localeCompare(a.key));
        if (sorted.length > 0) bLatestRecord = sorted[0].data;
      }
      
      historySumsRef.current = { hvac: hSum, boiler: bSum };

      const initialH = hvacBoilerCombined?.hvac_data || getInitialHvacLog(dateKey);
      const initialB = hvacBoilerCombined?.boiler_data || getInitialBoilerLog(dateKey);

      if (hLatestRecord && (!initialH.gas?.prev || initialH.gas.prev === '0' || initialH.gas.prev === '')) {
        const lastCurr = hLatestRecord.gas?.curr || hLatestRecord.hvac_data?.gas?.curr;
        if (lastCurr) initialH.gas.prev = lastCurr;
      }
      if (bLatestRecord && (!initialB.gas?.prev || initialB.gas.prev === '0' || initialB.gas.prev === '')) {
        const lastCurr = bLatestRecord.gas?.curr || bLatestRecord.boiler_data?.gas?.curr;
        if (lastCurr) initialB.gas.prev = lastCurr;
      }

      const analyzedGas = calculateGasAnalysis(initialH, initialB, { hvac: hSum, boiler: bSum });
      setHvacGasReadings(analyzedGas.nextHvac);
      setBoilerGasReadings(analyzedGas.nextBoiler);

      // 어제 날짜 데이터만 정확히 추출 (무조건 어제 날짜로 변경 요청 사항 적용)
      const rawWorkLog = serverDataResult?.workLog || getFreshInitialWorkLog();
      const currentScheduled = Array.isArray(rawWorkLog?.scheduled) ? rawWorkLog.scheduled : [];
      
      const finalWorkLog: WorkLogData = deepMerge(getFreshInitialWorkLog(), { ...rawWorkLog, scheduled: currentScheduled });

      if (yesterdayDirectReport && yesterdayDirectReport.mechanicalChemicals) {
        if (!finalWorkLog.mechanicalChemicals) {
          finalWorkLog.mechanicalChemicals = JSON.parse(JSON.stringify(INITIAL_CHEMICALS));
        }
        const chemKeys = ['seed', 'sterilizer'] as const;
        chemKeys.forEach(key => {
          const currentChem = finalWorkLog.mechanicalChemicals![key];
          const yesterdayChem = yesterdayDirectReport.mechanicalChemicals![key];
          const yesterdayStock = yesterdayChem.stock || (yesterdayChem as any).currentStock || '0';
          if (yesterdayStock && (!currentChem.prev || currentChem.prev === '' || currentChem.prev === '0')) {
            currentChem.prev = String(yesterdayStock);
          }
        });
      }

      if (finalWorkLog.mechanicalChemicals) {
        ['seed', 'sterilizer'].forEach((key) => {
          const chem = finalWorkLog.mechanicalChemicals![key as 'seed' | 'sterilizer'];
          const p = safeParseFloat(chem.prev);
          const i = safeParseFloat(chem.incoming);
          const u = safeParseFloat(chem.used);
          chem.stock = (p + i - u).toString();
        });
      }

      const categories = ['electrical', 'substation', 'mechanical', 'hvac', 'boiler', 'fire', 'elevator', 'parking', 'security', 'cleaning', 'handover'];
      const automationMap: Record<string, (d: string) => TaskItem[]> = {
        electrical: getAutomatedElectricalTasks,
        mechanical: getAutomatedMechanicalTasks,
        fire: getAutomatedFireTasks,
        elevator: getAutomatedElevatorTasks,
        parking: getAutomatedParkingTasks,
        security: getAutomatedSecurityTasks,
        cleaning: getAutomatedCleaningTasks,
        substation: () => [],
        handover: () => [],
        hvac: () => [],
        boiler: () => []
      };

      const normalizeContent = (text: string) => (text || '').replace(/\s+/g, '').trim();

      categories.forEach((key) => {
        const cat = (finalWorkLog[key as keyof WorkLogData] as LogCategory) || { today: [], tomorrow: [] };
        
        // 1. 자동화 작업 로드 (내용이 하나도 없을 때만)
        if (!cat.today || cat.today.length === 0) {
          cat.today = automationMap[key] ? automationMap[key](dateKey) : [];
        }
        if (!cat.tomorrow || cat.tomorrow.length === 0) {
          const autoTasksTomorrow = automationMap[key] ? automationMap[key](tomorrowDateKey) : [];
          cat.tomorrow = autoTasksTomorrow.map(t => ({ ...t, status: undefined }));
        }

        // 2. 어제 날짜의 "익일 예정사항" 병합 (핵심 로직 - 무조건 어제로 고정됨)
        const yesterdayWorkLog = yesterdayDirectReport;
        if (yesterdayWorkLog && (yesterdayWorkLog as any)[key]?.tomorrow) {
          const prevTomorrow = (yesterdayWorkLog as any)[key].tomorrow as TaskItem[];
          prevTomorrow.forEach(item => {
            if (item?.content?.trim()) {
              const normalizedPrev = normalizeContent(item.content);
              // 현재 'today'에 이미 같은 내용이 있는지 체크
              const isDuplicate = cat.today.some(t => normalizeContent(t.content) === normalizedPrev);
              if (!isDuplicate) {
                cat.today.push({ 
                  id: `from_prev_${item.id}_${Date.now()}_${Math.random().toString(36).substr(2,4)}`, 
                  content: item.content, 
                  frequency: item.frequency || '일일', 
                  status: '진행중' 
                });
              }
            }
          });
        }
        (finalWorkLog as any)[key] = cat;
      });

      setLogData(finalWorkLog);
      setFacilityDuty(serverDataResult?.facilityDuty || DEFAULT_DUTY);
      setSecurityDuty(serverDataResult?.securityDuty || DEFAULT_DUTY);
      setUtility(serverDataResult?.utility || DEFAULT_UTILITY);
      
      fetchWeatherInfo(dateKey).then(w => { if (w) setWeather(w); });
      setTimeout(() => { if (!isCancelled()) isInitialLoad.current = false; }, 500);
    } catch (error) { console.error("WorkLog Load Error:", error); } finally { if (!isCancelled()) setLoading(false); }
  }, [dateKey, currentDate, tomorrowDateKey, calculateGasAnalysis]);

  useEffect(() => {
    let cancelled = false;
    loadData(() => cancelled);
    return () => { cancelled = true; };
  }, [dateKey, loadData]);

  const handleSaveAll = async () => {
    setSaveStatus('loading');
    try {
      const updatedUtility = {
        ...utility,
        hvacGas: hvacGasReadings.gas?.usage || '',
        boilerGas: boilerGasReadings.gas?.usage || ''
      };

      const success = await saveDailyData({ 
        date: dateKey, 
        facilityDuty, 
        securityDuty, 
        utility: updatedUtility, 
        workLog: logData,
        lastUpdated: new Date().toISOString()
      });

      if (activeTab === 'mechanical' || activeTab === 'mech_facility') {
        await Promise.all([
          saveGasLog(gasLog),
          saveSepticLog(septicLog),
          saveHvacBoilerCombined(hvacGasReadings, boilerGasReadings)
        ]);
      }

      if (success) { 
        setSaveStatus('success'); 
        alert('저장이 완료되었습니다.');
        setTimeout(() => setSaveStatus('idle'), 3000); 
      } else { 
        setSaveStatus('error'); 
        alert('데이터 저장에 실패했습니다.'); 
      }
    } catch (err) { 
      setSaveStatus('error'); 
      alert('저장 중 오류가 발생했습니다.'); 
    }
  };

  const updateDutyField = (field: keyof DutyStatus, value: string) => {
    setFacilityDuty(prev => ({ ...prev, [field]: value }));
  };

  const handlePrintCategory = async (catId: string) => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    const isTop10mm = catId === 'checklist' || catId === 'mech_facility';
    const dynamicPadding = isTop10mm ? '10mm 12mm 25mm 12mm' : '25mm 12mm 10mm 12mm';

    const commonStyle = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
        @page { size: A4 portrait; margin: 0; }
        body { font-family: "Noto Sans KR", sans-serif; background: black; margin: 0; padding: 0; color: black; line-height: 1.1; -webkit-print-color-adjust: exact; }
        .no-print { margin: 20px; display: flex; gap: 10px; justify-content: center; }
        @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; } }
        .print-page { width: 210mm; min-height: 297mm; padding: ${dynamicPadding}; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; box-sizing: border-box; display: flex; flex-direction: column; }
        table { width: 100%; border-collapse: collapse; border: 1.2px solid black; table-layout: fixed; margin-bottom: 8px; }
        th, td { border: 1px solid black; padding: 0; text-align: center; font-size: 8.5pt; height: 22px; color: black; line-height: 22px; }
        th { background-color: #f2f2f2 !important; font-weight: bold; }
        .flex-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; min-height: 100px; }
        .title-box { flex: 1; text-align: center; }
        .doc-title { font-size: 24pt; font-weight: 900; letter-spacing: 2px; line-height: 1.1; }
        .approval-table { width: 90mm !important; border: 1.5px solid black !important; margin-left: auto; flex-shrink: 0; }
        .approval-table th { height: 22px !important; font-size: 8.5pt !important; background: #f3f4f6 !important; font-weight: bold; text-align: center; }
        .approval-table td { height: 65px !important; border: 1px solid black !important; background: white !important; }
        .approval-table .side-header { width: 26px !important; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold; font-size: 11pt; }
        .section-header { font-weight: bold; font-size: 11pt; margin-top: 12px; margin-bottom: 6px; border-left: 7px solid black; padding-left: 10px; line-height: 1.2; text-align: left; }
        .text-left { text-align: left; }
        .result-ok { color: blue; font-weight: bold; }
        .result-bad { color: red; font-weight: bold; }
        .h-22 td, .h-22 th { height: 22px !important; }
      </style>
    `;

    const formattedYear = format(currentDate, 'yyyy');
    const formattedMonth = format(currentDate, 'MM');
    const formattedDay = format(currentDate, 'dd');
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const dayName = days[currentDate.getDay()];
    
    const dutyInfo = `${facilityDuty.day ? `주간 : ${facilityDuty.day} / ` : ''}당직 : ${facilityDuty.night || ''}`;

    let bodyHtml: string;

    if (catId === 'checklist') {
        const [fireData, elvData] = await Promise.all([fetchFireFacilityLog(dateKey), fetchElevatorLog(dateKey)]);
        const safeFire = fireData || getInitialFireFacilityLog(dateKey);
        const safeElv = elvData || getInitialElevatorLog(dateKey);
        const elvLabels = ['1호기', '2호기', '3호기', '4호기', '5호기'];
        const elvKeys = ['ev1', 'ev2', 'ev3', 'ev4', 'ev5'] as const;

        bodyHtml = `
          <div class="print-page">
            <style>th, td { height: 30px !important; line-height: 30px !important; } .remarks-cell { height: 110px !important; line-height: 1.5 !important; padding: 8px !important; vertical-align: middle !important; text-align: center !important; } .text-left { text-align: left !important; padding-left: 10px !important; }</style>
            <div class="section-header" style="margin-top:0;">1. 소방 시설 점검</div>
            <table><thead><tr><th style="width:130px;">구 분</th><th>점 검 내 용</th><th style="width:80px;">결 과</th></tr></thead>
              <tbody>${safeFire.items.map((item, idx, arr) => { const firstInCat = arr.findIndex(i => i.category === item.category) === idx; const catCount = arr.filter(i => i.category === item.category).length; return `<tr>${firstInCat ? `<td rowspan="${catCount}" style="font-weight:bold; background-color:#fafafa;">${item.category}</td>` : ''}<td class="text-left">• ${item.content}</td><td class="${item.result === '양호' ? 'result-ok' : 'result-bad'}">${item.result || '-'}</td></tr>`; }).join('')}<tr><td class="remarks-cell" style="font-weight:bold; background-color:#fafafa;">특이사항</td><td colspan="2" class="remarks-cell" style="white-space: pre-wrap; text-align: center !important;">${safeFire.remarks || ''}</td></tr></tbody>
            </table>
            <div class="section-header">2. 승강기 일상 점검</div>
            <table><thead><tr><th style="width:130px;">점 검 항 목</th>${elvLabels.map(l => `<th style="width:65px;">${l}</th>`).join('')}</tr></thead>
              <tbody>${safeElv.items.map(item => `<tr><td style="font-weight:500; text-align:center !important;">${item.content}</td>${elvKeys.map(k => `<td class="${item.results[k] === '양호' ? 'result-ok' : 'result-bad'}">${item.results[k] || '-'}</td>`).join('')}</tr>`).join('')}<tr><td class="remarks-cell" style="font-weight:bold; background-color:#fafafa;">특이사항</td><td colspan="5" class="remarks-cell" style="white-space: pre-wrap; text-align: center !important;">${safeElv.remarks || ''}</td></tr></tbody>
            </table>
          </div>
        `;
    } else if (catId === 'mechanical') {
        const [gasData, septicData, consumables] = await Promise.all([fetchGasLog(dateKey), fetchSepticLog(dateKey), fetchConsumables()]);
        const safeGas = gasData || getInitialGasLog(dateKey);
        const safeSeptic = septicData || getInitialSepticLog(dateKey);
        
        const dailyConsumables = (consumables || []).filter(c => c.date === dateKey && parseFloat(c.outQty || '0') > 0 && (c.category === '기계' || c.category === '공용'));
        const aggMap = new Map();
        dailyConsumables.forEach(c => {
          const key = `${c.itemName.trim()}_${(c.modelName || '').trim()}`;
          if (aggMap.has(key)) {
            const item = aggMap.get(key);
            item.outQty = (parseFloat(item.outQty) + parseFloat(c.outQty)).toString();
          } else {
            aggMap.set(key, { ...c });
          }
        });
        const usedConsumables = Array.from(aggMap.values());

        const consumableRows = []; for (let i = 0; i < 2; i++) consumableRows.push({ left: usedConsumables[i] || null, right: usedConsumables[i + 2] || null });
        const chemicals = logData.mechanicalChemicals || INITIAL_CHEMICALS;

        bodyHtml = `
          <div class="print-page">
            <style>th, td { height: 19px !important; padding: 0 4px !important; }</style>
            <div class="flex-header"><div class="title-box"><div class="doc-title">기계실 업무일지</div></div>${approvalTableHtml()}</div>
            <div class="info-row"><div>${formattedYear}년 ${formattedMonth}월 ${formattedDay}일 (${dayName})</div><div>${dutyInfo}</div></div>
            <div class="section-header">1. 업무일지</div>
            <table><thead><tr><th style="width:50%;">작 &nbsp; 업 &nbsp; 사 &nbsp; 항</th><th>예 &nbsp; 정 &nbsp; 사 &nbsp; 항</th></tr></thead>
              <tbody><tr style="height:209px;"><td class="text-left" style="vertical-align:top; padding:0px !important;">${generateFixedRowsHtml('mechanical', 'today', 11, 19)}</td><td class="text-left" style="vertical-align:top; padding:0px !important;">${generateFixedRowsHtml('mechanical', 'tomorrow', 11, 19)}</td></tr></tbody>
            </table>
            
            <div class="section-header">2. 소모품 사용 내역</div>
            <table><thead><tr><th style="width:18%;">품 명</th><th style="width:22%;">모 델 명</th><th style="width:10%;">수량</th><th style="width:18%;">품 명</th><th style="width:22%;">모 델 명</th><th style="width:10%;">수량</th></tr></thead>
              <tbody>${consumableRows.map(row => `<tr style="height:22px;"><td>${row.left?.itemName || ''}</td><td>${row.left?.modelName || ''}</td><td>${row.left?.outQty || ''}</td><td>${row.right?.itemName || ''}</td><td>${row.right?.modelName || ''}</td><td>${row.right?.outQty || ''}</td></tr>`).join('')}</tbody>
            </table>

            <div style="display: flex; gap: 8mm; align-items: flex-start; margin-top: 8px;">
              <div style="flex: 1;">
                <div class="section-header" style="margin-top:0;">3. 가스일일점검</div>
                <table><thead><tr><th style="width:60px;">구분</th><th>점검내용</th><th style="width:60px;">결과</th></tr></thead>
                  <tbody>${safeGas.items.map((item, idx, arr) => { const firstInCat = arr.findIndex(i => i.category === item.category) === idx; const catCount = arr.filter(i => i.category === item.category).length; return `<tr>${firstInCat ? `<td rowspan="${catCount}" style="background:#f9f9f9; font-weight:bold;">${item.category.replace(' ', '<br/>')}</td>` : ''}<td class="text-left" style="font-size:8pt;">• ${item.content}</td><td class="${item.result === '양호' ? 'result-ok' : 'result-bad'}">${item.result || ''}</td></tr>`; }).join('')}</tbody>
                </table>
              </div>
              <div style="flex: 1;">
                <div class="section-header" style="margin-top:0;">4. 정화조일일점검</div>
                <table><thead><tr><th>점검내용</th><th style="width:60px;">결과</th></tr></thead>
                  <tbody>${safeSeptic.items.map(item => `<tr><td class="text-left" style="font-size:8pt;">• ${item.content}</td><td class="${item.result === '양호' ? 'result-ok' : 'result-bad'}">${item.result || ''}</td></tr>`).join('')}</tbody>
                </table>
                <div class="section-header">5. 종균제 / 소독제</div>
                <table><thead><tr style="background:#f8f9fa;"><th>구 분</th><th>전일</th><th>입고</th><th>투입</th><th>재고</th></tr></thead>
                  <tbody>
                    <tr style="height:19px;"><td style="background:#f9f9f9; font-weight:bold;">종균제(l)</td><td>${chemicals.seed.prev}</td><td>${chemicals.seed.incoming}</td><td>${chemicals.seed.used}</td><td style="font-weight:bold; color:blue;">${chemicals.seed.stock}</td></tr>
                    <tr style="height:19px;"><td style="background:#f9f9f9; font-weight:bold;">소독제(kg)</td><td>${chemicals.sterilizer.prev}</td><td>${chemicals.sterilizer.incoming}</td><td>${chemicals.sterilizer.used}</td><td style="font-weight:bold; color:blue;">${chemicals.sterilizer.stock}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
    } else if (catId === 'electrical') {
        const [subCheckData, consumables] = await Promise.all([fetchSubstationChecklist(dateKey), fetchConsumables()]);
        
        const dailyConsumables = (consumables || []).filter(c => c.date === dateKey && parseFloat(c.outQty || '0') > 0 && (c.category === '전기' || c.category === '소방'));
        const aggMap = new Map();
        dailyConsumables.forEach(c => {
          const key = `${c.itemName.trim()}_${(c.modelName || '').trim()}`;
          if (aggMap.has(key)) {
            const item = aggMap.get(key);
            item.outQty = (parseFloat(item.outQty) + parseFloat(c.outQty)).toString();
          } else {
            aggMap.set(key, { ...c });
          }
        });
        const usedConsumables = Array.from(aggMap.values());

        const consumableRows = []; for (let i = 0; i < 2; i++) consumableRows.push({ left: usedConsumables[i] || null, right: usedConsumables[i + 2] || null });
        const safeCheckItems = subCheckData?.items || getInitialSubstationChecklist(dateKey).items;
        const trItems = safeCheckItems.filter(i => i.category === '변압기');
        const vcbItems = safeCheckItems.filter(i => i.category === 'VCB A B');
        const atsItems = safeCheckItems.filter(i => i.category === 'ATS');

        bodyHtml = `
          <div class="print-page">
            <div class="flex-header"><div class="title-box"><div class="doc-title">전기·소방·승강기<br/>업무일지</div></div>${approvalTableHtml()}</div>
            <div class="info-row"><div>${formattedYear}년 ${formattedMonth}월 ${formattedDay}일 (${dayName})</div><div>${dutyInfo}</div></div>
            <div class="section-header">1. 업무일지</div>
            <table><thead><tr><th style="width:70px;">구 분</th><th style="width:45%;">작 &nbsp; 업 &nbsp; 사 &nbsp; 항</th><th>예 &nbsp; 정 &nbsp; 사 &nbsp; 항</th></tr></thead>
              <tbody>
                <tr><td style="font-weight:bold; background:#f9f9f9;">전 기</td><td class="text-left">${generateFixedRowsHtml('electrical', 'today', 5, 22)}</td><td class="text-left">${generateFixedRowsHtml('electrical', 'tomorrow', 5, 22)}</td></tr>
                <tr><td style="font-weight:bold; background:#f9f9f9;">소 방</td><td class="text-left">${generateFixedRowsHtml('fire', 'today', 4, 22)}</td><td class="text-left">${generateFixedRowsHtml('fire', 'tomorrow', 4, 22)}</td></tr>
                <tr><td style="font-weight:bold; background:#f9f9f9;">승강기</td><td class="text-left">${generateFixedRowsHtml('elevator', 'today', 4, 22)}</td><td class="text-left">${generateFixedRowsHtml('elevator', 'tomorrow', 4, 22)}</td></tr>
                <tr><td style="font-weight:bold; background:#f9f9f9;">특이사항</td><td class="text-left">${generateFixedRowsHtml('handover', 'today', 3, 22)}</td><td class="text-left">${generateFixedRowsHtml('handover', 'tomorrow', 3, 22)}</td></tr>
              </tbody>
            </table>
            <div class="section-header">2. 소모품 사용 내역</div>
            <table><thead><tr><th style="width:18%;">품 명</th><th style="width:22%;">모 델 명</th><th style="width:10%;">수량</th><th style="width:18%;">품 명</th><th style="width:22%;">모 델 명</th><th style="width:10%;">수량</th></tr></thead>
              <tbody>${consumableRows.map(row => `<tr style="height:22px;"><td>${row.left?.itemName || ''}</td><td>${row.left?.modelName || ''}</td><td>${row.left?.outQty || ''}</td><td>${row.right?.itemName || ''}</td><td>${row.right?.modelName || ''}</td><td>${row.right?.outQty || ''}</td></tr>`).join('')}</tbody>
            </table>
            <div class="section-header">3. 수변전반 점검표</div>
            <div style="display: flex; gap: 0;">
              <table style="width: 50%; border-right: none;" class="h-22">
                <thead><tr><th style="width:60px;">구분</th><th>점검내용</th><th style="width:70px;">결과</th></tr></thead>
                <tbody>
                  ${trItems.map((item, idx) => `<tr>${idx === 0 ? `<td rowSpan="${trItems.length}" style="font-weight:bold; background:#f9f9f9;">변압기</td>` : ''}<td class="text-left">&nbsp; • ${item.label}</td><td class="${item.result === '양호' ? 'result-ok' : 'result-bad'}">${item.result || ''}</td></tr>`).join('')}
                  ${vcbItems.map((item, idx) => `<tr>${idx === 0 ? `<td rowSpan="${vcbItems.length}" style="font-weight:bold; background:#f9f9f9;">VCB<br/>A B</td>` : ''}<td class="text-left">&nbsp; • ${item.label}</td><td class="${item.result === '양호' ? 'result-ok' : 'result-bad'}">${item.result || ''}</td></tr>`).join('')}
                </tbody>
              </table>
              <table style="width: 50%;" class="h-22">
                <thead><tr><th style="width:60px;">구분</th><th>점검내용</th><th style="width:70px;">결과</th></tr></thead>
                <tbody>
                  ${atsItems.map((item, idx) => `<tr>${idx === 0 ? `<td rowSpan="${atsItems.length + 1}" style="font-weight:bold; background:#f9f9f9;">ATS</td>` : ''}<td class="text-left">&nbsp; • ${item.label}</td><td class="${item.result === '양호' ? 'result-ok' : 'result-bad'}">${item.result || ''}</td></tr>`).join('')}
                  <tr><td class="text-left">&nbsp;</td><td></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        `;
    } else {
        const catLabel = WORK_LOG_TABS.find(t => t.id === catId)?.label || catId;
        const catData = (logData as any)[catId] as LogCategory;
        bodyHtml = `
          <div class="print-page">
            <div class="flex-header"><div class="title-box"><div class="doc-title">${catLabel} 작업일지</div></div>${approvalTableHtml()}</div>
            <div class="info-row"><div>${formattedYear}년 ${formattedMonth}월 ${formattedDay}일 (${dayName})</div><div>날씨: ${weather?.condition || '맑음'}</div></div>
            <div class="section-header">금일 작업 내용</div>
            <div style="border:1.2px solid black; padding:15px; min-height:250px; text-align:left;">${catData.today.filter(t => t.content.trim()).map(t => `<div style="margin-bottom:8px;">• ${t.content}</div>`).join('') || '내역 없음'}</div>
            <div class="section-header">익일 예정 사항</div>
            <div style="border:1.2px solid black; padding:15px; min-height:250px; text-align:left;">${catData.tomorrow.filter(t => t.content.trim()).map(t => `<div style="margin-bottom:8px;">• ${t.content}</div>`).join('') || '내역 없음'}</div>
          </div>
        `;
    }

    printWindow.document.write(`<html><head><title>업무일지 - ${dateKey}</title>${commonStyle}</head><body><div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>${bodyHtml}</body></html>`);
    printWindow.document.close();

    function approvalTableHtml(isSimple = false) {
      if (isSimple) return `<table class="approval-table" style="width: 50mm;"><tr><th rowspan="2" class="side-header">결<br/>재</th><th style="height:22px;">과 장</th><th style="height:22px;">소 장</th></tr><tr><td></td><td></td></tr></table>`;
      return `<table class="approval-table"><tr><th rowspan="2" class="side-header">결<br/>재</th><th>담 당</th><th>주 임</th><th>대 리</th><th>과 장</th><th>소 장</th></tr><tr><td></td><td></td><td></td><td></td><td></td></tr></table>`;
    }

    function generateFixedRowsHtml(cat: keyof WorkLogData, type: 'today' | 'tomorrow', count: number, rowHeight: number = 22) {
      const tasks = (logData[cat] as LogCategory)?.[type] || [];
      const contents = tasks.map(t => t.content).filter(Boolean);
      let html = '';
      for (let i = 0; i < count; i++) {
        const text = contents[i] ? `&nbsp; • ${contents[i]}` : '&nbsp;';
        html += `<div style="height: ${rowHeight}px; line-height: ${rowHeight}px; padding: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; font-size: 8.5pt; border-bottom: 0.5px solid #eee;">${text}</div>`;
      }
      return html;
    }
  };

  const handleChemicalUpdate = (type: 'seed' | 'sterilizer', field: keyof ChemicalStatusItem, value: string) => {
    setLogData(prev => {
      const currentChem = prev.mechanicalChemicals || JSON.parse(JSON.stringify(INITIAL_CHEMICALS));
      const target = { ...currentChem[type], [field]: value };
      const p = safeParseFloat(target.prev);
      const i = safeParseFloat(target.incoming);
      const u = safeParseFloat(target.used);
      target.stock = (p + i - u).toString();
      return { ...prev, mechanicalChemicals: { ...currentChem, [type]: target } };
    });
  };

  const handleGasReadingUpdate = (type: 'hvac' | 'boiler', field: string, value: string) => {
    if (type === 'hvac') {
      setHvacGasReadings(prev => {
        const next = { ...prev, gas: { ...prev.gas, [field]: value } } as HvacLogData;
        return calculateGasAnalysis(next, boilerGasReadings, historySumsRef.current).nextHvac;
      });
    } else {
      setBoilerGasReadings(prev => {
        const next = { ...prev, gas: { ...prev.gas, [field]: value } } as BoilerLogData;
        return calculateGasAnalysis(hvacGasReadings, next, historySumsRef.current).nextBoiler;
      });
    }
  };

  const toggleGasResult = (id: string) => {
    setGasLog(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, result: item.result === '양호' ? '불량' : '양호' } : item)
    }));
  };

  const toggleSepticResult = (id: string) => {
    setSepticLog(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, result: item.result === '양호' ? '불량' : '양호' } : item)
    }));
  };

  const renderTabContent = () => {
    if (activeTab === 'substation') return <SubstationLog currentDate={currentDate} isEmbedded={true} onUsageChange={val => setUtility(p => ({...p, electricity: val}))} />;
    if (activeTab === 'mech_facility') return <HvacLog currentDate={currentDate} isEmbedded={true} onUsageChange={(h, b) => setUtility(p => ({...p, hvacGas: h, boilerGas: b}))} />;
    if (activeTab === 'air_env') return <AirEnvironmentLog currentDate={currentDate} />;
    if (activeTab === 'checklist') return (
      <div className="space-y-2">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gray-50/50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="text-blue-500" size={20} />
              <h4 className="font-bold text-gray-800">일일 점검 내역</h4>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => loadData(() => false, true)}
                className="flex items-center justify-center px-4 py-2 bg-white text-emerald-600 rounded-xl hover:bg-emerald-50 border border-gray-200 font-bold shadow-sm transition-all text-sm active:scale-95"
              >
                <RefreshCw size={18} className="mr-2" />
                새로고침
              </button>
              <button 
                onClick={handleSaveAll}
                className="flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-md transition-all text-sm active:scale-95"
              >
                <Save size={18} className="mr-2" />
                서버저장
              </button>
              <button 
                onClick={() => handlePrintCategory('checklist')}
                className="flex items-center justify-center px-6 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-bold shadow-md transition-all text-sm active:scale-95"
              >
                <Printer size={18} className="mr-2" />
                미리보기
              </button>
            </div>
          </div>
          <div className="p-1 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <FireFacilityCheck currentDate={currentDate} />
            < ElevatorLog currentDate={currentDate} />
          </div>
        </div>
      </div>
    );
    if (activeTab === 'park_sec_clean') return (
      <div className="space-y-2">
        <DetailedLogSection title="주차 관리" icon={<Car className="text-blue-500" size={20} />} data={logData?.parking} onUpdate={d => setLogData({...logData, parking: d})} onRefresh={() => loadData(() => false, true)} onSave={handleSaveAll} />
        <DetailedLogSection title="경비 보안" icon={<Shield className="text-green-500" size={20} />} data={logData?.security} onUpdate={d => setLogData({...logData, security: d})} onRefresh={() => loadData(() => false, true)} onSave={handleSaveAll} />
        <DetailedLogSection title="미화 위생" icon={<Droplets className="text-cyan-500" size={20} />} data={logData?.cleaning} onUpdate={d => setLogData({...logData, cleaning: d})} onRefresh={() => loadData(() => false, true)} onSave={handleSaveAll} />
      </div>
    );

    if (activeTab === 'mechanical') {
      const groupedGas: Record<string, GasCheckItem[]> = {};
      gasLog.items.forEach(item => {
        if (!groupedGas[item.category]) groupedGas[item.category] = [];
        groupedGas[item.category].push(item);
      });
      const gasCategories = ['정압실', '배관 계통', '연소 장치', '경보 장치'];

      return (
        <div className="space-y-2">
          <DetailedLogSection 
            title="기계 업무일지" 
            icon={<LayoutList className="text-blue-600" size={20} />}
            data={logData.mechanical} 
            onUpdate={d => setLogData({...logData, mechanical: d})} 
            onPrint={() => handlePrintCategory('mechanical')}
            onRefresh={() => loadData(() => false, true)}
            onSave={handleSaveAll}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50/50 px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <Flame className="text-orange-500" size={20} />
                <h4 className="font-bold text-gray-800">가스일일점검</h4>
              </div>
              <div className="p-4 overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr><th className="border border-gray-200 p-2 w-16">구분</th><th className="border border-gray-200 p-2">점검내용</th><th className="border border-gray-200 p-2 w-16 text-center">결과</th></tr>
                  </thead>
                  <tbody>
                    {gasCategories.map(cat => (
                      <React.Fragment key={cat}>
                        {groupedGas[cat]?.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            {idx === 0 && <td rowSpan={groupedGas[cat].length} className="border border-gray-200 p-2 text-center font-bold bg-gray-50/50 whitespace-pre-wrap">{cat.replace(' ', '\n')}</td>}
                            <td className="border border-gray-200 p-2 text-left">• {item.content}</td>
                            <td className={`border border-gray-200 p-2 text-center font-bold cursor-pointer transition-colors ${item.result === '양호' ? 'text-blue-600 hover:bg-blue-50' : 'text-red-600 hover:bg-red-50'}`} onClick={() => toggleGasResult(item.id)}>{item.result || '-'}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-gray-50/50 px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <Droplets className="text-blue-500" size={20} />
                  <h4 className="font-bold text-gray-800">정화조일일점검</h4>
                </div>
                <div className="p-4">
                  <table className="w-full border-collapse border border-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr><th className="border border-gray-200 p-2">점검내용</th><th className="border border-gray-200 p-2 w-16 text-center">결과</th></tr>
                    </thead>
                    <tbody>
                      {septicLog.items.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="border border-gray-200 p-2 text-left">• {item.content}</td>
                          <td className={`border border-gray-200 p-2 text-center font-bold cursor-pointer transition-colors ${item.result === '양호' ? 'text-blue-600 hover:bg-blue-50' : 'text-red-600 hover:bg-red-50'}`} onClick={() => toggleSepticResult(item.id)}>{item.result || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-gray-50/50 px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <Droplets className="text-cyan-600" size={20} />
                  <h4 className="font-bold text-gray-800">종균제 / 소독제 수불 현황</h4>
                </div>
                <div className="p-4">
                  <table className="w-full border-collapse border border-gray-200 text-center text-xs table-fixed">
                    <thead className="bg-gray-50">
                      <tr><th className="border border-gray-200 p-2 w-20">구분</th><th className="border border-gray-200 p-2">전일</th><th className="border border-gray-200 p-2">입고</th><th className="border border-gray-200 p-2">투입</th><th className="border border-gray-200 p-2 text-blue-600">재고</th></tr>
                    </thead>
                    <tbody>
                      {['seed', 'sterilizer'].map(key => {
                        return (
                          <tr key={key}>
                            <td className="border border-gray-300 p-2 font-bold bg-gray-50/30 whitespace-nowrap">{key === 'seed' ? '종균제' : '소독제'}</td>
                            <td className="border border-gray-300 p-0"><input type="text" value={logData.mechanicalChemicals?.[key as 'seed'|'sterilizer']?.prev || ''} onChange={e => handleChemicalUpdate(key as any, 'prev', e.target.value)} className="w-full h-full text-center outline-none bg-transparent py-2" placeholder="0" /></td>
                            <td className="border border-gray-300 p-0"><input type="text" value={logData.mechanicalChemicals?.[key as 'seed'|'sterilizer']?.incoming || ''} onChange={e => handleChemicalUpdate(key as any, 'incoming', e.target.value)} className="w-full h-full text-center outline-none bg-transparent py-2" placeholder="0" /></td>
                            <td className="border border-gray-300 p-0"><input type="text" value={logData.mechanicalChemicals?.[key as 'seed'|'sterilizer']?.used || ''} onChange={e => handleChemicalUpdate(key as any, 'used', e.target.value)} className="w-full h-full text-center outline-none bg-transparent py-2" placeholder="0" /></td>
                            <td className="border border-gray-300 p-0 bg-blue-50 font-bold text-blue-700">{logData.mechanicalChemicals?.[key as 'seed'|'sterilizer']?.stock || '0'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const getTabIcon = () => {
      switch(activeTab) {
        case 'electrical': return <Zap className="text-blue-600" size={20} />;
        case 'fire': return <Flame className="text-red-600" size={20} />;
        case 'elevator': return <ArrowUpDown className="text-blue-600" size={20} />;
        case 'handover': return <Edit3 className="text-slate-600" size={20} />;
        default: return null;
      }
    };

    const getTabLabel = () => {
      if (activeTab === 'electrical') return "전기 업무일지";
      return WORK_LOG_TABS.find(t => t.id === activeTab)?.label || '';
    };

    return (
      <div className="space-y-2">
        <DetailedLogSection 
          title={getTabLabel()} 
          icon={getTabIcon()}
          data={(logData as any)?.[activeTab]} 
          onUpdate={d => setLogData({...logData, [activeTab]: d})} 
          onPrint={(activeTab === 'electrical' || activeTab === 'mechanical') ? () => handlePrintCategory(activeTab) : undefined}
          onRefresh={() => loadData(() => false, true)}
          onSave={handleSaveAll}
        />
        {activeTab === 'electrical' && <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-2"><SubstationChecklistLog currentDate={currentDate} isEmbedded={true} /></div>}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-2 pb-32">
      <div className="mb-2 print:hidden">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center">
            <ClipboardList className="mr-3 text-blue-600" size={32} />
            업무 일지
          </h2>
          <p className="text-gray-500 text-base font-medium">시설 관리 업무 기록 및 일일 점검 내역을 관리합니다.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-2xl border border-gray-200 shadow-sm"><RefreshCw size={48} className="animate-spin text-blue-500 mb-4" /><p className="text-gray-500 font-bold text-lg">데이터 동기화 중...</p></div>
      ) : (
        <>
          <div className="animate-fade-in space-y-2">
            <div className="flex overflow-x-auto whitespace-nowrap gap-2 pb-2 mb-2 scrollbar-hide items-center">
              <div className="mr-3 text-slate-400 p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                <LayoutList size={22} />
              </div>
              {WORK_LOG_TABS.map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id)} 
                  className={`px-6 py-3 rounded-2xl text-sm font-black transition-all duration-300 border ${
                    activeTab === tab.id 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100 scale-105' 
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="min-h-[400px]">{renderTabContent()}</div>
          </div>
        </>
      )}
      
      <style>{`
        @keyframes scale-up {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-up {
          animation: scale-up 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default WorkLog;
