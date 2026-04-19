
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
  getInitialBoilerLog,
  saveMechanicalChemicals
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
import { Plus, Trash2, LayoutList, RefreshCw, ArrowRightCircle, CheckCircle2, Save, Cloud, X, Printer, Car, Shield, Droplets, ClipboardCheck, Flame, Zap, Search, Calendar, History, ClipboardList, ArrowUpDown, Edit3, Settings } from 'lucide-react';
import SubstationLog from './SubstationLog';
import HvacLog from './HvacLog';
import FireFacilityCheck from './FireFacilityCheck';
import ElevatorLog from './ElevatorLog';
import AirEnvironmentLog from './AirEnvironmentLog';
import SubstationChecklistLog from './SubstationChecklistLog';
import { fetchWeatherInfo } from '../services/geminiService';
import { WORK_LOG_TABS } from '../constants';
import { 
  getAutomatedTasksFromDB,
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

const TaskRow: React.FC<TaskRowProps> = ({ item, isToday, onUpdate, onDelete }) => {
  // 'task_'가 포함된 ID는 수동 추가 항목, 나머지는 자동 등록 항목으로 판별
  const isManual = item?.id?.includes('task_');
  return (
    <div className="flex items-center space-x-2 py-1.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors px-3 rounded group">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isToday ? 'bg-blue-400' : 'bg-indigo-400'}`}></div>
      <input 
        type="text"
        value={item?.content || ''}
        onChange={(e) => onUpdate({ ...item, content: e.target.value })}
        className={`flex-1 text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-100 rounded px-2 h-9 border border-transparent focus:border-gray-100 font-medium !text-left ${isManual ? '!text-blue-500' : 'text-black'}`}
        placeholder={isToday ? "작업 내용을 입력하세요" : "예정 사항을 입력하세요"}
      />
      <button onClick={onDelete} className="text-gray-300 hover:text-red-500 p-2 transition-colors opacity-0 group-hover:opacity-100" title="삭제">
        <Trash2 size={16} />
      </button>
    </div>
  );
};

interface DetailedLogSectionProps {
  title: string;
  icon?: React.ReactNode;
  data: LogCategory;
  onUpdate: (newData: LogCategory) => void;
  onPrint?: () => void;
  onRefresh?: () => void;
  onSave?: () => void;
  saveStatus?: 'idle' | 'loading' | 'success' | 'error';
  hideBox?: boolean;
}

const DetailedLogSection: React.FC<DetailedLogSectionProps> = ({ title, icon, data, onUpdate, onPrint, onRefresh, onSave, saveStatus = 'idle', hideBox }) => {
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

  const content = (
    <div className="bg-white border border-black overflow-hidden shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-black">
        <div className="flex flex-col">
          <div className="bg-gray-50 px-5 py-3 border-b border-black flex justify-between items-center">
            <h4 className="text-[14px] font-bold text-black flex items-center">
              <CheckCircle2 size={16} className="mr-2 text-orange-600" />
              금일 작업내용
            </h4>
            <button 
              onClick={() => handleAddItem('today')} 
              className="text-xs flex items-center bg-white text-orange-600 px-3 py-1.5 rounded-md hover:bg-orange-50 transition-colors font-bold border border-orange-200 shadow-sm"
            >
              <Plus size={14} className="mr-1" /> 추가
            </button>
          </div>
          <div className="p-2 space-y-1 min-h-[200px] bg-white">
            {safeData.today.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-12 italic">등록된 작업이 없습니다.</p>
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

        <div className="flex flex-col">
          <div className="bg-gray-50 px-5 py-3 border-b border-black flex justify-between items-center">
            <h4 className="text-[14px] font-bold text-black flex items-center">
              <ArrowRightCircle size={16} className="mr-2 text-orange-600" />
              익일 예정사항
            </h4>
            <button 
              onClick={() => handleAddItem('tomorrow')} 
              className="text-xs flex items-center bg-white text-orange-600 px-3 py-1.5 rounded-md hover:bg-orange-50 transition-colors font-bold border border-orange-200 shadow-sm"
            >
              <Plus size={14} className="mr-1" /> 추가
            </button>
          </div>
          <div className="p-2 space-y-1 min-h-[200px] bg-white">
             {safeData.tomorrow.length === 0 ? (
               <p className="text-xs text-gray-400 text-center py-12 italic">등록된 예정사항이 없습니다.</p>
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

  if (hideBox) return content;

  return (
    <div className="bg-white border border-black overflow-hidden shadow-sm animate-fade-in-down">
      <div className="bg-gray-50 px-5 py-3 border-b border-black flex items-center justify-between">
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
              disabled={saveStatus === 'loading'}
              className={`flex items-center justify-center px-6 py-2.5 rounded-xl font-bold shadow-md transition-all text-sm active:scale-95 ${
                saveStatus === 'success' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {saveStatus === 'success' ? <CheckCircle2 size={18} className="mr-2" /> : <Save size={18} className="mr-2" />}
              {saveStatus === 'success' ? '저장완료' : '저장'}
            </button>
          )}
          {onPrint && (
            <button 
              onClick={onPrint}
              className="flex items-center justify-center px-6 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-bold shadow-md transition-all text-sm active:scale-95"
            >
              <Printer size={18} className="mr-2" />
              인쇄
            </button>
          )}
        </div>
      </div>
      {content}
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
  const [activeWorkLogSubTab, setActiveWorkLogSubTab] = useState<'electrical' | 'mechanical' | 'fire' | 'elevator' | 'handover' | 'parking' | 'security' | 'cleaning'>('electrical');
  const [activeChecklistTab, setActiveChecklistTab] = useState<'substation' | 'fire' | 'elevator' | 'gas' | 'septic'>('substation');
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
      
      const hasSavedData = !!serverDataResult?.workLog;

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

      // 카테고리별 루프 (forEach 대신 for...of 사용하여 async 처리)
      for (const key of categories) {
        const cat = (finalWorkLog[key as keyof WorkLogData] as LogCategory) || { today: [], tomorrow: [] };
        
        // 1. 자동화 작업 로드 (저장된 데이터가 없고, 내용이 하나도 없을 때만)
        if (!hasSavedData) {
          // 카테고리 매핑 (DB의 category 컬럼과 일치시킴)
          const categoryMap: Record<string, string> = {
            electrical: 'elec',
            mechanical: 'mech',
            fire: 'fire',
            elevator: 'elevator',
            parking: 'parking',
            security: 'security',
            cleaning: 'cleaning'
          };

          const dbCategory = categoryMap[key];

          if (dbCategory) {
            // DB 설정 로직 적용 (전기, 기계, 소방, 승강기, 주차, 경비, 미화)
            if (!cat.today || cat.today.length === 0) {
              const dbTasksToday = await getAutomatedTasksFromDB(dbCategory, dateKey);
              // 금일작업내용은 기존 하드코딩된 자동항목(점검표 연동 등)과 합침
              const hardcodedToday = automationMap[key] ? automationMap[key](dateKey) : [];
              cat.today = [...hardcodedToday, ...dbTasksToday];
            }
            if (!cat.tomorrow || cat.tomorrow.length === 0) {
              const dbTasksTomorrow = await getAutomatedTasksFromDB(dbCategory, tomorrowDateKey);
              const hardcodedTomorrow = automationMap[key] ? automationMap[key](tomorrowDateKey) : [];
              // 익일예정사항은 체크 해제 상태로 설정
              cat.tomorrow = [
                ...hardcodedTomorrow.map(t => ({ ...t, status: undefined })),
                ...dbTasksTomorrow.map(t => ({ ...t, status: undefined }))
              ];
            }
          } else {
            // 기타 카테고리 (handover 등)
            if (!cat.today || cat.today.length === 0) {
              cat.today = automationMap[key] ? automationMap[key](dateKey) : [];
            }
            if (!cat.tomorrow || cat.tomorrow.length === 0) {
              const autoTasksTomorrow = automationMap[key] ? automationMap[key](tomorrowDateKey) : [];
              cat.tomorrow = autoTasksTomorrow.map(t => ({ ...t, status: undefined }));
            }
          }

          // 2. 어제 날짜의 "익일 예정사항" 병합 (핵심 로직 - 무조건 어제로 고정됨)
          const yesterdayWorkLog = yesterdayDirectReport;
          const prevTomorrow = (yesterdayWorkLog && (yesterdayWorkLog as any)[key]?.tomorrow) ? ((yesterdayWorkLog as any)[key].tomorrow as TaskItem[]) : [];
          
          // 2-1. 오늘 데이터 중 '어제에서 가져온 항목(from_prev_)'인데 어제 익일예정사항에 없는 경우 삭제 (동기화)
          cat.today = cat.today.filter(todayItem => {
            if (todayItem.id.startsWith('from_prev_')) {
              const existsInYesterday = prevTomorrow.some(prev => 
                todayItem.id === `from_prev_${prev.id}` || 
                todayItem.id.startsWith(`from_prev_${prev.id}_`)
              );
              if (!existsInYesterday) {
                const normalizedToday = normalizeContent(todayItem.content);
                return prevTomorrow.some(prev => normalizeContent(prev.content) === normalizedToday);
              }
              return true;
            }
            return true;
          });

          // 2-2. 어제 익일예정사항에 있는 항목을 오늘 금일예정사항에 추가 (중복 제외)
          prevTomorrow.forEach(item => {
            if (item?.content?.trim()) {
              const isDuplicateById = cat.today.some(t => 
                t.id === `from_prev_${item.id}` || 
                t.id.startsWith(`from_prev_${item.id}_`)
              );
              if (!isDuplicateById) {
                const normalizedPrev = normalizeContent(item.content);
                const isDuplicateByContent = cat.today.some(t => normalizeContent(t.content) === normalizedPrev);
                if (!isDuplicateByContent) {
                  cat.today.push({ 
                    id: `from_prev_${item.id}`, 
                    content: item.content, 
                    frequency: item.frequency || '일일', 
                    status: '진행중' 
                  });
                }
              }
            }
          });
        }

        (finalWorkLog as any)[key] = cat;
      }

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

  const handleSaveChemicals = async () => {
    setSaveStatus('loading');
    try {
      const success = await saveMechanicalChemicals(dateKey, logData.mechanicalChemicals || INITIAL_CHEMICALS);
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

      if (activeTab === 'mechanical' || activeTab === 'mech_facility' || activeTab === 'checklist') {
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
        table { width: 100%; border-collapse: collapse; border: 1.2px solid black; table-layout: fixed; margin-bottom: 0px; }
        tr { height: 18px !important; }
        th, td { border: 1px solid black; padding: 0; text-align: center; font-size: 8.5pt; height: 18px !important; color: black; line-height: 18px !important; }
        td > div { height: 18px !important; line-height: 18px !important; }
        th { background-color: white !important; font-weight: normal; }
        td { background-color: white !important; }
        input { font-size: 8.5pt !important; border: none !important; background: transparent !important; text-align: center !important; width: 100% !important; }
        .flex-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; min-height: 100px; }
        .title-box { flex: 1; text-align: center; }
        .doc-title { font-size: 24pt; font-weight: 900; letter-spacing: 2px; line-height: 1.1; }
        .approval-table { width: 90mm !important; border: 1.5px solid black !important; margin-left: auto; flex-shrink: 0; }
        .approval-table th { height: 22px !important; font-size: 8.5pt !important; background: white !important; font-weight: normal; text-align: center; }
        .approval-table td { height: 65px !important; border: 1px solid black !important; background: white !important; }
        .approval-table .side-header { width: 26px !important; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold; font-size: 11pt; }
        .section-header { font-weight: bold; font-size: 11pt; margin-top: 12px; margin-bottom: 6px; border-left: 7px solid black; padding-left: 10px; line-height: 1.2; text-align: left; }
        .text-left { text-align: left; }
        .result-ok { color: black; font-weight: normal; }
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
              <tbody>${safeFire.items.map((item, idx, arr) => { const firstInCat = arr.findIndex(i => i.category === item.category) === idx; const catCount = arr.filter(i => i.category === item.category).length; return `<tr>${firstInCat ? `<td rowspan="${catCount}" style="font-weight:normal; background-color:white;">${item.category}</td>` : ''}<td class="text-left">• ${item.content}</td><td class="${item.result === '양호' ? 'result-ok' : 'result-bad'}">${item.result || '-'}</td></tr>`; }).join('')}<tr><td class="remarks-cell" style="font-weight:normal; background-color:white;">특이사항</td><td colspan="2" class="remarks-cell" style="white-space: pre-wrap; text-align: center !important;">${safeFire.remarks || ''}</td></tr></tbody>
            </table>
            <div class="section-header">2. 승강기 일상 점검</div>
            <table><thead><tr><th style="width:130px;">점 검 항 목</th>${elvLabels.map(l => `<th style="width:65px;">${l}</th>`).join('')}</tr></thead>
              <tbody>${safeElv.items.map(item => `<tr><td style="font-weight:normal; text-align:center !important;">${item.content}</td>${elvKeys.map(k => `<td class="${item.results[k] === '양호' ? 'result-ok' : 'result-bad'}">${item.results[k] || '-'}</td>`).join('')}</tr>`).join('')}<tr><td class="remarks-cell" style="font-weight:normal; background-color:white;">특이사항</td><td colspan="5" class="remarks-cell" style="white-space: pre-wrap; text-align: center !important;">${safeElv.remarks || ''}</td></tr></tbody>
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
            <style>tr, th, td { height: 20px !important; line-height: 20px !important; padding: 0 4px !important; } td > div { height: 20px !important; line-height: 20px !important; }</style>
            <div class="flex-header"><div class="title-box"><div class="doc-title">기계실 업무일지</div></div>${approvalTableHtml()}</div>
            <div class="info-row"><div>${formattedYear}년 ${formattedMonth}월 ${formattedDay}일 (${dayName})</div><div>${dutyInfo}</div></div>
            <div class="section-header">1. 업무일지</div>
            <table><thead><tr><th style="width:50%;">작 &nbsp; 업 &nbsp; 사 &nbsp; 항</th><th>예 &nbsp; 정 &nbsp; 사 &nbsp; 항</th></tr></thead>
              <tbody><tr style="height:260px;"><td class="text-left" style="vertical-align:top; padding:0px !important;">${generateFixedRowsHtml('mechanical', 'today', 13, 20)}</td><td class="text-left" style="vertical-align:top; padding:0px !important;">${generateFixedRowsHtml('mechanical', 'tomorrow', 13, 20)}</td></tr></tbody>
            </table>
            
            <div class="section-header">2. 소모품 사용 내역</div>
            <table><thead><tr><th style="width:18%;">품 명</th><th style="width:22%;">모 델 명</th><th style="width:10%;">수량</th><th style="width:18%;">품 명</th><th style="width:22%;">모 델 명</th><th style="width:10%;">수량</th></tr></thead>
              <tbody>${consumableRows.map(row => `<tr style="height:20px;"><td>${row.left?.itemName || ''}</td><td>${row.left?.modelName || ''}</td><td>${row.left?.outQty || ''}</td><td>${row.right?.itemName || ''}</td><td>${row.right?.modelName || ''}</td><td>${row.right?.outQty || ''}</td></tr>`).join('')}</tbody>
            </table>

            <div style="display: flex; gap: 8mm; align-items: flex-start; margin-top: 8px;">
              <div style="flex: 1;">
                <div class="section-header" style="margin-top:0;">3. 가스일일점검</div>
                <table><thead><tr><th style="width:60px;">구분</th><th>점검내용</th><th style="width:60px;">결과</th></tr></thead>
                  <tbody>${safeGas.items.map((item, idx, arr) => { const firstInCat = arr.findIndex(i => i.category === item.category) === idx; const catCount = arr.filter(i => i.category === item.category).length; return `<tr>${firstInCat ? `<td rowspan="${catCount}" style="background:white; font-weight:normal;">${item.category.replace(' ', '<br/>')}</td>` : ''}<td class="text-left" style="font-size:8pt;">• ${item.content}</td><td class="${item.result === '양호' ? 'result-ok' : 'result-bad'}">${item.result || ''}</td></tr>`; }).join('')}</tbody>
                </table>
              </div>
              <div style="flex: 1;">
                <div class="section-header" style="margin-top:0;">4. 정화조일일점검</div>
                <table><thead><tr><th>점검내용</th><th style="width:60px;">결과</th></tr></thead>
                  <tbody>${safeSeptic.items.map(item => `<tr><td class="text-left" style="font-size:8pt;">• ${item.content}</td><td class="${item.result === '양호' ? 'result-ok' : 'result-bad'}">${item.result || ''}</td></tr>`).join('')}</tbody>
                </table>
                <div class="section-header">5. 종균제 / 소독제</div>
                <table><thead><tr style="background:white;"><th>구 분</th><th>전일</th><th>입고</th><th>투입</th><th>재고</th></tr></thead>
                  <tbody>
                    <tr style="height:20px;"><td style="background:white; font-weight:normal;">종균제(l)</td><td>${chemicals.seed.prev}</td><td>${chemicals.seed.incoming}</td><td>${chemicals.seed.used}</td><td style="font-weight:normal; color:black;">${chemicals.seed.stock}</td></tr>
                    <tr style="height:20px;"><td style="background:white; font-weight:normal;">소독제(kg)</td><td>${chemicals.sterilizer.prev}</td><td>${chemicals.sterilizer.incoming}</td><td>${chemicals.sterilizer.used}</td><td style="font-weight:normal; color:black;">${chemicals.sterilizer.stock}</td></tr>
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
            <style>tr, th, td { height: 20px !important; line-height: 20px !important; } td > div { height: 20px !important; line-height: 20px !important; }</style>
            <div class="flex-header"><div class="title-box"><div class="doc-title">전기·소방·승강기<br/>업무일지</div></div>${approvalTableHtml()}</div>
            <div class="info-row"><div>${formattedYear}년 ${formattedMonth}월 ${formattedDay}일 (${dayName})</div><div>${dutyInfo}</div></div>
            <div class="section-header">1. 업무일지</div>
            <table><thead><tr><th style="width:70px;">구 분</th><th style="width:45%;">작 &nbsp; 업 &nbsp; 사 &nbsp; 항</th><th>예 &nbsp; 정 &nbsp; 사 &nbsp; 항</th></tr></thead>
              <tbody>
                <tr><td style="font-weight:normal; background:white;">전 기</td><td class="text-left">${generateFixedRowsHtml('electrical', 'today', 5, 20)}</td><td class="text-left">${generateFixedRowsHtml('electrical', 'tomorrow', 5, 20)}</td></tr>
                <tr><td style="font-weight:normal; background:white;">소 방</td><td class="text-left">${generateFixedRowsHtml('fire', 'today', 4, 20)}</td><td class="text-left">${generateFixedRowsHtml('fire', 'tomorrow', 4, 20)}</td></tr>
                <tr><td style="font-weight:normal; background:white;">승강기</td><td class="text-left">${generateFixedRowsHtml('elevator', 'today', 4, 20)}</td><td class="text-left">${generateFixedRowsHtml('elevator', 'tomorrow', 4, 20)}</td></tr>
                <tr><td style="font-weight:normal; background:white;">주 차</td><td class="text-left">${generateFixedRowsHtml('parking', 'today', 3, 20)}</td><td class="text-left">${generateFixedRowsHtml('parking', 'tomorrow', 3, 20)}</td></tr>
                <tr><td style="font-weight:normal; background:white;">특이사항</td><td class="text-left">${generateFixedRowsHtml('handover', 'today', 3, 20)}</td><td class="text-left">${generateFixedRowsHtml('handover', 'tomorrow', 3, 20)}</td></tr>
              </tbody>
            </table>
            <div class="section-header">2. 소모품 사용 내역</div>
            <table><thead><tr><th style="width:18%;">품 명</th><th style="width:22%;">모 델 명</th><th style="width:10%;">수량</th><th style="width:18%;">품 명</th><th style="width:22%;">모 델 명</th><th style="width:10%;">수량</th></tr></thead>
              <tbody>${consumableRows.map(row => `<tr style="height:20px;"><td>${row.left?.itemName || ''}</td><td>${row.left?.modelName || ''}</td><td>${row.left?.outQty || ''}</td><td>${row.right?.itemName || ''}</td><td>${row.right?.modelName || ''}</td><td>${row.right?.outQty || ''}</td></tr>`).join('')}</tbody>
            </table>
            <div class="section-header">3. 수변전반 점검표</div>
            <div style="display: flex; gap: 0;">
              <table style="width: 50%; border-right: none;" class="h-22">
                <thead><tr><th style="width:60px;">구분</th><th>점검내용</th><th style="width:70px;">결과</th></tr></thead>
                <tbody>
                  ${trItems.map((item, idx) => `<tr>${idx === 0 ? `<td rowSpan="${trItems.length}" style="font-weight:normal; background:white;">변압기</td>` : ''}<td class="text-left">&nbsp; • ${item.label}</td><td class="${item.result === '양호' ? 'result-ok' : 'result-bad'}">${item.result || ''}</td></tr>`).join('')}
                  ${vcbItems.map((item, idx) => `<tr>${idx === 0 ? `<td rowSpan="${vcbItems.length}" style="font-weight:normal; background:white;">VCB<br/>A B</td>` : ''}<td class="text-left">&nbsp; • ${item.label}</td><td class="${item.result === '양호' ? 'result-ok' : 'result-bad'}">${item.result || ''}</td></tr>`).join('')}
                </tbody>
              </table>
              <table style="width: 50%;" class="h-22">
                <thead><tr><th style="width:60px;">구분</th><th>점검내용</th><th style="width:70px;">결과</th></tr></thead>
                <tbody>
                  ${atsItems.map((item, idx) => `<tr>${idx === 0 ? `<td rowSpan="${atsItems.length + 1}" style="font-weight:normal; background:white;">ATS</td>` : ''}<td class="text-left">&nbsp; • ${item.label}</td><td class="${item.result === '양호' ? 'result-ok' : 'result-bad'}">${item.result || ''}</td></tr>`).join('')}
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

  const handleChemicalUpdate = (typeOrIdx: 'seed' | 'sterilizer' | number, field: keyof ChemicalStatusItem | string, value: string) => {
    setLogData(prev => {
      const currentChem = prev.mechanicalChemicals || JSON.parse(JSON.stringify(INITIAL_CHEMICALS));
      let type: 'seed' | 'sterilizer';
      if (typeof typeOrIdx === 'number') {
        type = typeOrIdx === 0 ? 'seed' : 'sterilizer';
      } else {
        type = typeOrIdx;
      }
      
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
    if (activeTab === 'mech_facility') return <HvacLog currentDate={currentDate} isEmbedded={true} onUsageChange={(h, b) => setUtility(p => ({...p, hvacGas: h, boilerGas: b}))} chemicals={logData.mechanicalChemicals} onChemicalsChange={handleChemicalUpdate} onChemicalsSave={handleSaveChemicals} onChemicalsRefresh={() => loadData(true)} />;
    if (activeTab === 'checklist') {
      const groupedGas: Record<string, GasCheckItem[]> = {};
      gasLog.items.forEach(item => {
        if (!groupedGas[item.category]) groupedGas[item.category] = [];
        groupedGas[item.category].push(item);
      });
      const gasCategories = ['정압실', '배관 계통', '연소 장치', '경보 장치'];

      return (
        <div className="space-y-2">
          {/* 작은박스: 서브탭 및 기능 버튼 */}
          <div className="w-full max-w-7xl bg-white mx-auto">
            <div className="flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
              <div className="flex items-stretch">
                {[
                  { id: 'substation', label: '변전실' },
                  { id: 'fire', label: '소방' },
                  { id: 'elevator', label: '승강기' },
                  { id: 'gas', label: '가스' },
                  { id: 'septic', label: '정화조' }
                ].map(subTab => (
                  <div 
                    key={subTab.id}
                    onClick={() => setActiveChecklistTab(subTab.id as any)} 
                    className={`flex items-center px-4 py-3 font-bold text-[14px] transition-colors relative shrink-0 whitespace-nowrap cursor-pointer bg-white ${
                      activeChecklistTab === subTab.id 
                        ? 'text-orange-600' 
                        : 'text-gray-500 hover:text-black'
                    }`}
                  >
                    {subTab.label}
                    {activeChecklistTab === subTab.id && (
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
                  onClick={() => loadData(() => false, true)}
                  disabled={loading}
                  className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
                >
                  <RefreshCw size={18} className="mr-1.5" />
                  새로고침
                </button>
                <button 
                  onClick={handleSaveAll}
                  disabled={saveStatus === 'saving' || loading}
                  className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50 ${
                    saveStatus === 'success' ? 'text-orange-600' : 'text-gray-500 hover:text-black'
                  }`}
                >
                  {saveStatus === 'success' ? <CheckCircle2 size={18} className="mr-1.5" /> : <Save size={18} className="mr-1.5" />}
                  {saveStatus === 'success' ? '저장완료' : '저장'}
                </button>
                {!(activeChecklistTab === 'substation' || activeChecklistTab === 'gas' || activeChecklistTab === 'septic' || activeChecklistTab === 'elevator') && (
                  <button 
                    onClick={() => handlePrintCategory('checklist')}
                    disabled={loading}
                    className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
                  >
                    <Printer size={18} className="mr-1.5" />
                    인쇄
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 데이터테이블 영역 */}
          <div className="max-w-7xl mx-auto space-y-2">
            {activeChecklistTab === 'substation' && (
              <div className="overflow-x-auto bg-white overflow-hidden">
                <SubstationChecklistLog currentDate={currentDate} isEmbedded={true} />
              </div>
            )}
            {activeChecklistTab === 'fire' && (
              <div className="overflow-x-auto bg-white overflow-hidden">
                <FireFacilityCheck currentDate={currentDate} />
              </div>
            )}
            {activeChecklistTab === 'elevator' && (
              <div className="overflow-x-auto bg-white overflow-hidden">
                <ElevatorLog currentDate={currentDate} />
              </div>
            )}
            {activeChecklistTab === 'gas' && (
              <div className="overflow-x-auto bg-white overflow-hidden">
                <table className="w-full border-collapse border border-black text-[13px] text-black font-normal text-center bg-white">
                  <thead>
                    <tr className="bg-white border-b border-black h-[32px]">
                      <th className="border-r border-black font-normal w-24 h-[32px]"><div className="flex items-center justify-center h-full px-2">구분</div></th>
                      <th className="border-r border-black font-normal h-[32px]"><div className="flex items-center justify-center h-full px-2">점검내용</div></th>
                      <th className="font-normal w-24 h-[32px]"><div className="flex items-center justify-center h-full px-2">결과</div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {gasCategories.map(cat => (
                      <React.Fragment key={cat}>
                        {groupedGas[cat]?.map((item, idx) => (
                          <tr key={item.id} className="bg-white border-b border-black last:border-0 h-[32px]">
                            {idx === 0 && (
                              <td rowSpan={groupedGas[cat].length} className="border-r border-black font-normal bg-white whitespace-pre-wrap w-24 h-[32px]">
                                <div className="flex items-center justify-center h-full px-2">{cat.replace(' ', '\n')}</div>
                              </td>
                            )}
                            <td className="border-r border-black text-center font-normal h-[32px]">
                              <div className="flex items-center justify-center h-full px-2">• {item.content}</div>
                            </td>
                            <td 
                              className={`text-center font-normal cursor-pointer w-24 h-[32px] ${item.result === '양호' ? 'text-blue-600' : 'text-red-600'}`} 
                              onClick={() => toggleGasResult(item.id)}
                            >
                              <div className="flex items-center justify-center h-full px-2">{item.result || '-'}</div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {activeChecklistTab === 'septic' && (
              <div className="overflow-x-auto bg-white overflow-hidden">
                <table className="w-full border-collapse border border-black text-[13px] text-black font-normal text-center bg-white">
                  <thead>
                    <tr className="bg-white border-b border-black h-[32px]">
                      <th className="border-r border-black font-normal h-[32px]"><div className="flex items-center justify-center h-full px-2">점검내용</div></th>
                      <th className="font-normal w-24 h-[32px]"><div className="flex items-center justify-center h-full px-2">결과</div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {septicLog.items.map(item => (
                      <tr key={item.id} className="bg-white border-b border-black last:border-0 h-[32px]">
                        <td className="border-r border-black text-center font-normal h-[32px]">
                          <div className="flex items-center justify-center h-full px-2">• {item.content}</div>
                        </td>
                        <td 
                          className={`text-center font-normal cursor-pointer w-24 h-[32px] ${item.result === '양호' ? 'text-blue-600' : 'text-red-600'}`} 
                          onClick={() => toggleSepticResult(item.id)}
                        >
                          <div className="flex items-center justify-center h-full px-2">{item.result || '-'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      );
    }
    if (activeTab === 'mechanical') {
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
            saveStatus={saveStatus}
          />
        </div>
      );
    }

    if (activeTab === 'electrical') {
      return (
        <div className="space-y-2">
          {/* 작은박스 1: 서브탭 및 기능 버튼 */}
          <div className="w-full max-w-7xl bg-white">
            <div className="flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
              <div className="flex items-stretch">
                {[
                  { id: 'electrical', label: '전기' },
                  { id: 'mechanical', label: '기계' },
                  { id: 'fire', label: '소방' },
                  { id: 'elevator', label: '승강기' },
                  { id: 'handover', label: '특이사항' },
                  { id: 'parking', label: '주차' },
                  { id: 'security', label: '경비' },
                  { id: 'cleaning', label: '미화' }
                ].map(subTab => (
                  <div 
                    key={subTab.id}
                    onClick={() => setActiveWorkLogSubTab(subTab.id as any)} 
                    className={`flex items-center px-4 py-3 font-bold text-[14px] transition-colors relative shrink-0 whitespace-nowrap cursor-pointer bg-white ${
                      activeWorkLogSubTab === subTab.id 
                        ? 'text-orange-600' 
                        : 'text-gray-500 hover:text-black'
                    }`}
                  >
                    {subTab.label}
                    {activeWorkLogSubTab === subTab.id && (
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
                  onClick={() => loadData(() => false, true)}
                  disabled={loading}
                  className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
                >
                  <RefreshCw size={18} className="mr-1.5" />
                  새로고침
                </button>
                <button 
                  onClick={handleSaveAll}
                  disabled={saveStatus === 'saving' || loading}
                  className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50 ${
                    saveStatus === 'success' ? 'text-orange-600' : 'text-gray-500 hover:text-black'
                  }`}
                >
                  {saveStatus === 'success' ? <CheckCircle2 size={18} className="mr-1.5" /> : <Save size={18} className="mr-1.5" />}
                  {saveStatus === 'success' ? '저장완료' : '저장'}
                </button>
                {(activeWorkLogSubTab === 'electrical' || activeWorkLogSubTab === 'mechanical') && (
                  <button 
                    onClick={() => handlePrintCategory(activeWorkLogSubTab)}
                    disabled={loading}
                    className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
                  >
                    <Printer size={18} className="mr-1.5" />
                    인쇄
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 작은박스 2: 금일 작업내용 + 익일 예정사항 */}
          <div className="max-w-7xl">
            {activeWorkLogSubTab === 'electrical' && (
              <DetailedLogSection 
                title="전기 업무일지" 
                icon={<Zap className="text-blue-600" size={20} />}
                data={logData?.electrical} 
                onUpdate={d => setLogData({...logData, electrical: d})} 
                hideBox={true}
              />
            )}
            {activeWorkLogSubTab === 'mechanical' && (
              <DetailedLogSection 
                title="기계 업무일지" 
                icon={<Settings className="text-slate-600" size={20} />}
                data={logData?.mechanical} 
                onUpdate={d => setLogData({...logData, mechanical: d})} 
                hideBox={true}
              />
            )}
            {activeWorkLogSubTab === 'fire' && (
              <DetailedLogSection 
                title="소방 업무일지" 
                icon={<Flame className="text-red-600" size={20} />}
                data={logData?.fire} 
                onUpdate={d => setLogData({...logData, fire: d})} 
                hideBox={true}
              />
            )}
            {activeWorkLogSubTab === 'elevator' && (
              <DetailedLogSection 
                title="승강기 업무일지" 
                icon={<ArrowUpDown className="text-blue-600" size={20} />}
                data={logData?.elevator} 
                onUpdate={d => setLogData({...logData, elevator: d})} 
                hideBox={true}
              />
            )}
            {activeWorkLogSubTab === 'handover' && (
              <DetailedLogSection 
                title="특이사항" 
                icon={<Edit3 className="text-slate-600" size={20} />}
                data={logData?.handover} 
                onUpdate={d => setLogData({...logData, handover: d})} 
                hideBox={true}
              />
            )}
            {activeWorkLogSubTab === 'parking' && (
              <DetailedLogSection 
                title="주차 관리" 
                icon={<Car className="text-blue-500" size={20} />} 
                data={logData?.parking} 
                onUpdate={d => setLogData({...logData, parking: d})} 
                hideBox={true}
              />
            )}
            {activeWorkLogSubTab === 'security' && (
              <DetailedLogSection 
                title="경비 보안" 
                icon={<Shield className="text-green-500" size={20} />} 
                data={logData?.security} 
                onUpdate={d => setLogData({...logData, security: d})} 
                hideBox={true}
              />
            )}
            {activeWorkLogSubTab === 'cleaning' && (
              <DetailedLogSection 
                title="미화 위생" 
                icon={<Droplets className="text-cyan-500" size={20} />} 
                data={logData?.cleaning} 
                onUpdate={d => setLogData({...logData, cleaning: d})} 
                hideBox={true}
              />
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-2 pb-32">

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-2xl border border-gray-200 shadow-sm"><RefreshCw size={48} className="animate-spin text-blue-500 mb-4" /><p className="text-gray-500 font-bold text-lg">데이터 동기화 중...</p></div>
      ) : (
        <>
          <div className="animate-fade-in space-y-2">
            <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
              <div className="flex shrink-0">
                {WORK_LOG_TABS.map(tab => (
                  <div 
                    key={tab.id} 
                    onClick={() => setActiveTab(tab.id)} 
                    className={`px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer ${activeTab === tab.id ? 'text-orange-600' : 'text-gray-500 hover:text-black'}`}
                  >
                    {tab.label}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="min-h-[400px]" key={activeTab}>{renderTabContent()}</div>
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
