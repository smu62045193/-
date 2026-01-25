
import { 
  DailyData, 
  WorkLogData, 
  ConsumableItem, 
  SubstationChecklistData, 
  FireFacilityLogData, 
  ElevatorLogData, 
  GasLogData, 
  SepticLogData, 
  StaffMember, 
  WeeklyReportData, 
  ConsumableRequest, 
  ParkingChangeItem, 
  ParkingStatusItem, 
  Contractor, 
  GeneratorCheckData, 
  SubstationLogData, 
  MeterReadingData, 
  MeterPhotoData,
  BatteryCheckData, 
  LoadCurrentData, 
  SafetyCheckData, 
  HvacLogData, 
  BoilerLogData, 
  AirEnvironmentLogData, 
  WaterTankLogData, 
  ChemicalLogData, 
  FireExtinguisherItem, 
  FireInspectionLogData, 
  FireHistoryItem, 
  ElevatorInspectionItem, 
  ConstructionWorkItem, 
  AppointmentItem, 
  Tenant 
} from '../types';
import { GOOGLE_APPS_SCRIPT_URL } from '../constants';
import { format, addDays, parseISO } from 'date-fns';

/**
 * Utility: Deep Merge objects
 */
export const deepMerge = (target: any, source: any) => {
  const isObject = (item: any) => (item && typeof item === 'object' && !Array.isArray(item));
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target))
          Object.assign(output, { [key]: source[key] });
        else
          output[key] = deepMerge(target[key], source[key]);
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
};

/**
 * Utility: Storage helpers
 */
export const getFromStorage = (key: string, isJson: boolean = true) => {
  try {
    const val = localStorage.getItem(key);
    if (!val) return null;
    return isJson ? JSON.parse(val) : val;
  } catch (e) {
    console.error(`Error parsing storage for ${key}:`, e);
    return null;
  }
};

export const saveToCache = (key: string, data: any, isJson: boolean = true) => {
  const val = isJson ? JSON.stringify(data) : data;
  localStorage.setItem(key, val);
};

export const clearCache = (key: string) => {
  localStorage.removeItem(key);
};

/**
 * API: Core fetch and save
 */
const fetchFromApi = async (key: string) => {
  try {
    const url = `${GOOGLE_APPS_SCRIPT_URL}?date=${encodeURIComponent(key)}`;
    const response = await fetch(url);
    const result = await response.json();
    return result.status === 'success' ? result.data : null;
  } catch (error) {
    console.error(`Fetch API error for ${key}:`, error);
    return null;
  }
};

const saveToApi = async (key: string, data: any) => {
  try {
    const payload = { targetKey: key, ...data };
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    return result.status === 'success';
  } catch (error) {
    console.error(`Save API error for ${key}:`, error);
    return false;
  }
};

export const apiFetchRange = async (prefix: string, startDate: string, endDate: string) => {
  try {
    const url = `${GOOGLE_APPS_SCRIPT_URL}?prefix=${encodeURIComponent(prefix)}&startDate=${startDate}&endDate=${endDate}`;
    const response = await fetch(url);
    const result = await response.json();
    return result.status === 'success' ? (result.data || []) : [];
  } catch (error) {
    console.error("apiFetchRange error", error);
    return [];
  }
};

/**
 * Speed Optimization: 배치 요청 (여러 데이터 한 번에 가져오기)
 * Fallback: 배치 요청이 실패할 경우 개별 요청으로 전환하여 안정성 보장
 */
export const apiFetchBatch = async (requests: { type: 'get' | 'range', key?: string, prefix?: string, start?: string, end?: string }[]) => {
  try {
    const batchJson = JSON.stringify(requests);
    const url = `${GOOGLE_APPS_SCRIPT_URL}?batch=${encodeURIComponent(batchJson)}`;
    
    // URL 길이가 너무 길면 (브라우저 제한 대략 2~8KB) 개별 요청으로 즉시 전환
    if (url.length > 2000) {
      throw new Error("URL too long for GET batch");
    }

    const response = await fetch(url);
    const result = await response.json();
    
    if (result.status === 'success' && Array.isArray(result.data)) {
      return result.data;
    }
    throw new Error(result.message || "Batch request unsuccessful");

  } catch (error) {
    console.warn("apiFetchBatch failed, falling back to individual requests:", error);
    
    // 개별 요청 병렬 실행 (Fallback)
    const fallbackResults = await Promise.all(requests.map(async (req) => {
      if (req.type === 'get' && req.key) {
        const data = await fetchFromApi(req.key);
        return { key: req.key, data };
      } else if (req.type === 'range' && req.prefix && req.start && req.end) {
        const data = await apiFetchRange(req.prefix, req.start, req.end);
        return { key: req.prefix, data };
      }
      return null;
    }));
    
    return fallbackResults;
  }
};

/**
 * Speed Optimization Wrapper: 캐시 우선 반환 전략
 */
const fetchWithCache = async <T>(key: string, force: boolean = false): Promise<T | null> => {
  const cacheKey = key;
  if (!force) {
    const cached = getFromStorage(cacheKey);
    if (cached) {
      return cached as T;
    }
  }
  const server = await fetchFromApi(key);
  if (server) saveToCache(cacheKey, server);
  return server as T;
};

/**
 * Daily Data
 */
export const getInitialDailyData = (date: string): DailyData => ({
  date,
  facilityDuty: { day: '', night: '', off: '', vacation: '', deputy: '', chief: '', leader: '' },
  securityDuty: { day: '', night: '', off: '', vacation: '', leader: '' },
  utility: { electricity: '', hvacGas: '', boilerGas: '' },
  workLog: {
    scheduled: [],
    electrical: { today: [], tomorrow: [] },
    substation: { today: [], tomorrow: [] },
    mechanical: { today: [], tomorrow: [] },
    mechanicalChemicals: {
      seed: { prev: '', incoming: '', used: '', stock: '' },
      sterilizer: { prev: '', incoming: '', used: '', stock: '' }
    },
    hvac: { today: [], tomorrow: [] },
    boiler: { today: [], tomorrow: [] },
    fire: { today: [], tomorrow: [] },
    elevator: { today: [], tomorrow: [] },
    parking: { today: [], tomorrow: [] },
    security: { today: [], tomorrow: [] },
    cleaning: { today: [], tomorrow: [] },
    handover: { today: [], tomorrow: [] },
  }
});

export const fetchDailyData = async (date: string, force = false): Promise<DailyData | null> => {
  return await fetchWithCache<DailyData>(`DAILY_${date}`, force);
};

export const saveDailyData = async (data: DailyData) => {
  saveToCache(`DAILY_${data.date}`, data);
  return await saveToApi(`DAILY_${data.date}`, data);
};

export const fetchDateRangeData = async (startDate: string, daysCount: number) => {
  const start = parseISO(startDate);
  const end = addDays(start, daysCount - 1);
  return await apiFetchRange("DAILY_", format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
};

/**
 * Consumables
 */
export const fetchConsumables = async (): Promise<ConsumableItem[]> => {
  const res = await fetchWithCache<any>('CONSUMABLES_DB');
  return res?.consumables || [];
};

export const saveConsumables = async (list: ConsumableItem[]) => {
  return await saveToApi('CONSUMABLES_DB', { consumables: list });
};

/**
 * Substation Checklist
 */
export const getInitialSubstationChecklist = (date: string): SubstationChecklistData => ({
  date,
  items: [
    { id: 'tr-1', category: '변압기', label: '변압기 외관 청결상태', result: '양호' },
    { id: 'tr-2', category: '변압기', label: '단자부위 과열 및 변색여부', result: '양호' },
    { id: 'tr-3', category: '변압기', label: '이상음, 진동, 취기 발생유무', result: '양호' },
    { id: 'tr-4', category: '변압기', label: '접지선 접촉 및 단선유무', result: '양호' },
    { id: 'tr-5', category: '변압기', label: '온도상태 확인 및 환기팬 작동', result: '양호' },
    { id: 'tr-6', category: '변압기', label: '애자류 손상 및 오염상태', result: '양호' },
    { id: 'tr-7', category: '변압기', label: '반내 습기유입 및 부식상태', result: '양호' },
    { id: 'vcb-1', category: 'VCB AB', label: 'VCB 투입 및 개방상태 확인', result: '양호' },
    { id: 'vcb-2', category: 'VCB AB', label: '이상 소음 및 냄새 유무', result: '양호' },
    { id: 'vcb-3', category: 'VCB AB', label: '각종 계기 및 램프 점등상태', result: '양호' },
    { id: 'ats-1', category: 'ATS', label: 'ATS 절체상태 및 동작유무', result: '양호' },
    { id: 'ats-2', category: 'ATS', label: '단자부 변색 및 과열유무', result: '양호' },
    { id: 'ats-3', category: 'ATS', label: '조작배선 탈락 및 단선유무', result: '양호' },
    { id: 'ats-4', category: 'ATS', label: '반내 청결 및 먼지 퇴적상태', result: '양호' },
    { id: 'ats-5', category: 'ATS', label: '각종 릴레이 및 퓨즈 이상유무', result: '양호' },
    { id: 'ats-6', category: 'ATS', label: '비상전원 투입 대기상태', result: '양호' },
    { id: 'ats-7', category: 'ATS', label: '수동 절체 레버 비치상태', result: '양호' },
    { id: 'ats-8', category: 'ATS', label: '판넬 잠금 및 시건상태', result: '양호' },
    { id: 'ats-9', category: 'ATS', label: '주변 정리 정돈 상태', result: '양호' },
  ],
  approvers: { checker: '', manager: '' },
  note: ''
});

export const fetchSubstationChecklist = async (date: string): Promise<SubstationChecklistData | null> => {
  return await fetchWithCache<SubstationChecklistData>(`SUB_CHECK_${date}`);
};

export const saveSubstationChecklist = async (data: SubstationChecklistData) => {
  return await saveToApi(`SUB_CHECK_${data.date}`, data);
};

/**
 * Fire Facility Log
 */
export const getInitialFireFacilityLog = (date: string): FireFacilityLogData => ({
  date,
  items: [
    { id: 'ff-1', category: '소 방 시 설', content: '소화기는 정상 위치 여부', result: '양호', remarks: '' },
    { id: 'ff-2', category: '소 방 시 설', content: '수신반제어/밸브류 정상 여부', result: '양호', remarks: '' },
    { id: 'ff-3', category: '소 방 시 설', content: '유도등 상태가 양호한지 여부', result: '양호', remarks: '' },
    { id: 'ff-4', category: '피 난 방 화 시 설', content: '소화전 주위 장애물 적치여부', result: '양호', remarks: '' },
    { id: 'ff-5', category: '피 난 방 화 시 설', content: '계단·전실·복도 장애물 적치 여부', result: '양호', remarks: '' },
    { id: 'ff-6', category: '피 난 방 화 시 설', content: '방화문 주위 장애물 적치 여부', result: '양호', remarks: '' },
    { id: 'ff-7', category: '화 재 예 방 조 치', content: '가연물 및 위험물 사용 적정 여부', result: '양호', remarks: '' },
    { id: 'ff-8', category: '화 재 예 방 조 치', content: '전기시설 사용 적정 여부', result: '양호', remarks: '' },
    { id: 'ff-9', category: '화 재 예 방 조 치', content: '가스시설 사용 적정 여부', result: '양호', remarks: '' },
    { id: 'ff-10', category: '화 기 취 급 감 독', content: '유류 관리 상태', result: '양호', remarks: '' },
    { id: 'ff-11', category: '화 기 취 급 감 독', content: '전열기구 관리 상태', result: '양호', remarks: '' },
    { id: 'ff-12', category: '화 기 취 급 감 독', content: '공사중 소화기 비치', result: '양호', remarks: '' },
    { id: 'ff-13', category: '기 타', content: '쥐, 고양이등 침입에 취약점 상태', result: '양호', remarks: '' }
  ],
  remarks: '',
  approvers: { inspector: '', manager: '' }
});

export const fetchFireFacilityLog = async (date: string): Promise<FireFacilityLogData | null> => {
  return await fetchWithCache<FireFacilityLogData>(`FIRE_FACILITY_LOG_${date}`);
};

export const saveFireFacilityLog = async (data: FireFacilityLogData) => {
  return await saveToApi(`FIRE_FACILITY_LOG_${data.date}`, data);
};

/**
 * Elevator Log
 */
export const getInitialElevatorLog = (date: string): ElevatorLogData => ({
  date,
  items: [
    { id: 'evl-1', category: '운행상태', content: '카 내 버 튼 상 태', results: { ev1: '양호', ev2: '양호', ev3: '양호', ev4: '양호', ev5: '양호' }, note: '' },
    { id: 'evl-2', category: '운행상태', content: '카 내 조 명 상 태', results: { ev1: '양호', ev2: '양호', ev3: '양호', ev4: '양호', ev5: '양호' }, note: '' },
    { id: 'evl-3', category: '운행상태', content: '카 도 어 개 폐 상 태', results: { ev1: '양호', ev2: '양호', ev3: '양호', ev4: '양호', ev5: '양호' }, note: '' },
    { id: 'evl-4', category: '운행상태', content: '카 레 벨 상 태', results: { ev1: '양호', ev2: '양호', ev3: '양호', ev4: '양호', ev5: '양호' }, note: '' },
    { id: 'evl-5', category: '운행상태', content: '카 운 행 상 태', results: { ev1: '양호', ev2: '양호', ev3: '양호', ev4: '양호', ev5: '양호' }, note: '' },
    { id: 'evl-6', category: '이상유무', content: '감 시 반 이 상 유 무', results: { ev1: '양호', ev2: '양호', ev3: '양호', ev4: '양호', ev5: '양호' }, note: '' },
    { id: 'evl-7', category: '이상유무', content: '기 계 실 이 상 유 무', results: { ev1: '양호', ev2: '양호', ev3: '양호', ev4: '양호', ev5: '양호' }, note: '' }
  ],
  remarks: '',
  inspector: ''
});

export const fetchElevatorLog = async (date: string): Promise<ElevatorLogData | null> => {
  return await fetchWithCache<ElevatorLogData>(`ELEVATOR_LOG_${date}`);
};

export const saveElevatorLog = async (data: ElevatorLogData) => {
  return await saveToApi(`ELEVATOR_LOG_${data.date}`, data);
};

/**
 * Gas Log
 */
export const getInitialGasLog = (date: string): GasLogData => ({
  date,
  items: [
    { id: 'gas-1', category: '정압실', content: '정압기의 작동상태', result: '양호' },
    { id: 'gas-2', category: '정압실', content: '각 밸브의 개폐 상태', result: '양호' },
    { id: 'gas-3', category: '정압실', content: '배관 각이음부위의 누설 유무', result: '양호' },
    { id: 'gas-4', category: '정압실', content: '보안유지 관리 상태', result: '양호' },
    { id: 'gas-5', category: '정압실', content: '압력기록기의 작동 상태', result: '양호' },
    { id: 'gas-6', category: '정압실', content: '청결유지상태', result: '양호' },
    { id: 'gas-7', category: '배관 계통', content: '가스누설 차단장치의 작동상태', result: '양호' },
    { id: 'gas-8', category: '배관 계통', content: '배관부식 및 고정장치의 상태', result: '양호' },
    { id: 'gas-9', category: '배관 계통', content: '누설유무', result: '양호' },
    { id: 'gas-10', category: '배관 계통', content: '휠타의 청결상태', result: '양호' },
    { id: 'gas-11', category: '연소 장치', content: '정압기의 작동상태', result: '양호' },
    { id: 'gas-12', category: '연소 장치', content: '전자변의 작동상태', result: '양호' },
    { id: 'gas-13', category: '연소 장치', content: '가스량제어와 풍량제어의 연동상태', result: '양호' },
    { id: 'gas-14', category: '연소 장치', content: '버너의 막힘 손상유무', result: '양호' },
    { id: 'gas-15', category: '연소 장치', content: '각연결부분 누설유무', result: '양호' },
    { id: 'gas-16', category: '경보 장치', content: '가스 이상압 통보기의 상태', result: '양호' },
    { id: 'gas-17', category: '경보 장치', content: '감지기의 상태', result: '양호' }
  ]
});

export const fetchGasLog = async (date: string): Promise<GasLogData | null> => {
  return await fetchWithCache<GasLogData>(`GAS_LOG_${date}`);
};

export const saveGasLog = async (data: GasLogData) => {
  return await saveToApi(`GAS_LOG_${data.date}`, data);
};

/**
 * Septic Log
 */
export const getInitialSepticLog = (date: string): SepticLogData => ({
  date,
  items: [
    { id: 'sep-1', content: '조절 수위 및 배수 상태는 양호한가?', result: '양호' },
    { id: 'sep-2', content: '소독조의 염소 투입 상태는 양호한가?', result: '양호' },
    { id: 'sep-3', content: 'BLOWER의 상태는 양호한가?', result: '양호' },
    { id: 'sep-4', content: '악취 및 부유물은 없는가?', result: '양호' },
    { id: 'sep-5', content: 'PUMP의 소음 및 심한 진동은 없는가?', result: '양호' },
    { id: 'sep-6', content: '전원 PANEL은 정상인가?', result: '양호' },
    { id: 'sep-7', content: '정화조 내부의 청결 및 정리정돈은 양호한가?', result: '양호' },
    { id: 'sep-8', content: '급,배기휀의 작동상태는 양호한가?', result: '양호' },
    { id: 'sep-9', content: '감속기의 상태는 정상인가?', result: '양호' },
    { id: 'sep-10', content: '가연물 및 위험물 사용 적정 여부', result: '양호' }
  ]
});

export const fetchSepticLog = async (date: string): Promise<SepticLogData | null> => {
  return await fetchWithCache<SepticLogData>(`SEPTIC_LOG_${date}`);
};

export const saveSepticLog = async (data: SepticLogData) => {
  return await saveToApi(`SEPTIC_LOG_${data.date}`, data);
};

/**
 * Staff
 */
export const fetchStaffList = async (): Promise<StaffMember[]> => {
  const res = await fetchWithCache<any>('STAFF_DB_MASTER');
  return res?.staff || [];
};

export const saveStaffList = async (list: StaffMember[]) => {
  return await saveToApi('STAFF_DB_MASTER', { staff: list });
};

/**
 * Weekly Report
 */
export const fetchWeeklyReport = async (date: string): Promise<WeeklyReportData | null> => {
  return await fetchWithCache<WeeklyReportData>(`WEEKLY_REPORT_${date}`);
};

export const saveWeeklyReport = async (data: WeeklyReportData) => {
  return await saveToApi(`WEEKLY_REPORT_${data.startDate}`, data);
};

export const fetchWeeklyReportList = async (): Promise<{key: string, data: WeeklyReportData}[]> => {
  return await apiFetchRange("WEEKLY_REPORT_", "2024-01-01", "2034-12-31");
};

/**
 * Consumable Requests
 */
export const fetchConsumableRequests = async (): Promise<ConsumableRequest[]> => {
  const res = await fetchWithCache<any>('CONSUMABLE_REQ_DB');
  return res?.consumableReq || [];
};

export const saveConsumableRequests = async (list: ConsumableRequest[]) => {
  return await saveToApi('CONSUMABLE_REQ_DB', { consumableReq: list });
};

/**
 * Parking
 */
export const fetchParkingChangeList = async (): Promise<ParkingChangeItem[]> => {
  const res = await fetchWithCache<any>('PARKING_CHANGE_DB');
  return res?.parkingChange || [];
};

export const saveParkingChangeList = async (list: ParkingChangeItem[]) => {
  return await saveToApi('PARKING_CHANGE_DB', { parkingChange: list });
};

export const fetchParkingStatusList = async (): Promise<ParkingStatusItem[]> => {
  const res = await fetchWithCache<any>('PARKING_STATUS_DB');
  return res?.parkingStatus || [];
};

export const saveParkingStatusList = async (list: ParkingStatusItem[]) => {
  return await saveToApi('PARKING_STATUS_DB', { parkingStatus: list });
};

/**
 * Parking Layout
 */
export const fetchParkingLayout = async (): Promise<any> => {
  const res = await fetchWithCache<any>('PARKING_LAYOUT_DB');
  return res?.layout || null;
};

export const saveParkingLayout = async (layout: any) => {
  return await saveToApi('PARKING_LAYOUT_DB', { layout });
};

/**
 * Contractors
 */
export const fetchContractors = async (): Promise<Contractor[]> => {
  const res = await fetchWithCache<any>('CONTRACTOR_DB');
  return res?.contractors || [];
};

export const saveContractors = async (list: Contractor[]) => {
  return await saveToApi('CONTRACTOR_DB', { contractors: list });
};

/**
 * Generator Check
 */
export const getInitialGeneratorCheck = (month: string): GeneratorCheckData => ({
  date: month,
  specs: { 
    manufacturer: '한관전기', 
    year: '2005년 10월', 
    serialNo: '8610E0657', 
    type: 'DEGP-6001', 
    output: '600/500Kw', 
    voltage: '380/220v 60Hz', 
    current: '1140/950A', 
    rpm: '1600rpm', 
    method: 'B-LESS', 
    location: 'B6F비상발전기실' 
  },
  test: { 
    checkDate: `${month}-01`, 
    dayName: '',
    reason: '비상발전기 무부하시 운전 및 점검', 
    startTime: '',
    endTime: '',
    usedTime: '', 
    monthlyRunTime: '', 
    monthlyRunCount: '', 
    totalRunTime: '', 
    fuelUsed: '', 
    fuelTotal: '', 
    voltsRS: '', voltsRN: '', voltsST: '', voltsSN: '', voltsTR: '', voltsTN: '', 
    ampR: '', ampS: '', ampT: '', 
    oilTemp: '', 
    oilPressure: '', 
    rpmValue: '', 
    batteryGravityValue: '' 
  },
  status: { 
    coolingWater: '양호', 
    startCircuit: '양호', 
    fuelStatus: '양호', 
    afterRun: '양호', 
    panel: '양호', 
    engine: '양호', 
    duringRun: '양호', 
    afterStop: '양호', 
    battery: '양호',
    gravity: '양호'
  },
  note: ''
});

export const fetchGeneratorCheck = async (month: string): Promise<GeneratorCheckData | null> => {
  return await fetchWithCache<GeneratorCheckData>(`GEN_CHECK_${month}`);
};

export const saveGeneratorCheck = async (data: GeneratorCheckData) => {
  return await saveToApi(`GEN_CHECK_${data.date}`, data);
};

/**
 * Substation Log
 */
export const getInitialSubstationLog = (date: string): SubstationLogData => ({
  date,
  vcb: {
    time9: { 
      main: { v: '22.9', a: '', pf: '', hz: '60' }, 
      tr1: { v: '22.9', a: '', pf: '' }, 
      tr2: { v: '22.9', a: '', pf: '' }, 
      tr3: { v: '22.9', a: '', pf: '' } 
    },
    time21: { 
      main: { v: '22.9', a: '', pf: '', hz: '60' }, 
      tr1: { v: '22.9', a: '', pf: '' }, 
      tr2: { v: '22.9', a: '', pf: '' }, 
      tr3: { v: '22.9', a: '', pf: '' } 
    }
  },
  acb: {
    time9: { 
      acb1: { v: '', a: '', kw: '' }, 
      acb2: { v: '', a: '', kw: '' }, 
      acb3: { v: '', a: '', kw: '' }, 
      trTemp: { tr1: '', tr2: '', tr3: '' } 
    },
    time21: { 
      acb1: { v: '', a: '', kw: '' }, 
      acb2: { v: '', a: '', kw: '' }, 
      acb3: { v: '', a: '', kw: '' }, 
      // Fixed Type Error: Property name '처리' should be 'tr2' as per AcbReadings interface.
      trTemp: { tr1: '', tr2: '', tr3: '' } 
    }
  },
  powerUsage: {
    prev: { activeMid: '', activeMax: '', activeLight: '', reactiveMid: '', reactiveMax: '' },
    curr: { activeMid: '', activeMax: '', activeLight: '', reactiveMid: '', reactiveMax: '' },
    usage: { activeMid: '', activeMax: '', activeLight: '', reactiveMid: '', reactiveMax: '' }
  },
  dailyStats: { activePower: '0', reactivePower: '0', monthTotal: '0', maxPower: '0', powerFactor: '0', loadFactor: '0', demandFactor: '0' }
});

export const fetchSubstationLog = async (date: string, force = false): Promise<SubstationLogData | null> => {
  return await fetchWithCache<SubstationLogData>(`SUB_LOG_${date}`, force);
};

export const saveSubstationLog = async (data: SubstationLogData) => {
  saveToCache(`SUB_LOG_${data.date}`, data);
  return await saveToApi(`SUB_LOG_${data.date}`, data);
};

/**
 * Meter Reading
 */
export const getInitialMeterReading = (month: string): MeterReadingData => ({
  month,
  items: []
});

export const fetchMeterReading = async (month: string): Promise<MeterReadingData | null> => {
  return await fetchWithCache<MeterReadingData>(`METER_${month}`);
};

export const saveMeterReading = async (data: MeterReadingData) => {
  return await saveToApi(`METER_${data.month}`, data);
};

/**
 * Meter Photos
 */
export const fetchMeterPhotos = async (month: string): Promise<MeterPhotoData | null> => {
  return await fetchWithCache<MeterPhotoData>(`METER_PHOTO_${month}`);
};

export const saveMeterPhotos = async (data: MeterPhotoData) => {
  return await saveToApi(`METER_PHOTO_${data.month}`, data);
};

/**
 * Battery Check
 */
export const getInitialBatteryCheck = (month: string): BatteryCheckData => ({
  month,
  checkDate: `${month}-01`,
  items: [
    // 1. 정류기반
    { id: 'bat-rec-acv', section: 'rectifier', label: 'AC V', manufacturer: '현대중공업', manufDate: '', spec: '배선용차단기 50A HBS-53(3상3선식)', voltage: '', remarks: '' },
    { id: 'bat-rec-dcv', section: 'rectifier', label: 'DC V', manufacturer: '현대중공업', manufDate: '', spec: '배선용차단기 100A HBS-102(단상)', voltage: '', remarks: '' },
    
    // 2. 정류기반 밧데리 개별전류 (1~9)
    ...Array.from({ length: 9 }).map((_, i) => ({ 
      id: `bat-ind-${i + 1}`, 
      section: 'battery' as const, 
      label: `${i + 1}`, 
      manufacturer: '세방전지ROCKET', 
      manufDate: '21/8/30', 
      spec: 'RP100-12(12V/100AH/20HR)', 
      voltage: '', 
      remarks: '' 
    })),
    
    // 3. 비상용 발전기 (10, 11)
    { id: 'bat-gen-10', section: 'generator', label: '10', manufacturer: '세방전지ROCKET', manufDate: '22/8/30', spec: 'RP200-12(12V/200AH/20HR)', voltage: '', remarks: '' },
    { id: 'bat-gen-11', section: 'generator', label: '11', manufacturer: '세방전지ROCKET', manufDate: '22/8/30', spec: 'RP200-12(12V/200AH/20HR)', voltage: '', remarks: '' }
  ],
  approvers: { staff: '', assistant: '', manager: '', director: '' }
});

export const fetchBatteryCheck = async (month: string): Promise<BatteryCheckData | null> => {
  return await fetchWithCache<BatteryCheckData>(`BATTERY_${month}`);
};

export const saveBatteryCheck = async (data: BatteryCheckData) => {
  return await saveToApi(`BATTERY_${data.month}`, data);
};

/**
 * Load Current
 */
export const getInitialLoadCurrent = (month: string): LoadCurrentData => {
  const [y, m] = month.split('-');
  return {
    date: month,
    period: `${y}년 ${parseInt(m)}월`,
    items: []
  };
};

export const fetchLoadCurrent = async (month: string): Promise<LoadCurrentData | null> => {
  return await fetchWithCache<LoadCurrentData>(`LOAD_${month}`);
};

export const saveLoadCurrent = async (data: LoadCurrentData) => {
  return await saveToApi(`LOAD_${data.date}`, data);
};

/**
 * Safety Check
 */
export const getInitialSafetyCheck = (date: string, type: 'general' | 'ev'): SafetyCheckData => ({
  date,
  type,
  items: [],
  measurements: type === 'general' ? {
    lv1: { v_r: '', v_s: '', v_t: '', v_n: '', i_r: '', i_s: '', i_t: '', i_n: '', l_r: '', l_s: '', l_t: '', l_n: '' },
    lv3: { v_r: '', v_s: '', v_t: '', v_n: '', i_r: '', i_s: '', i_t: '', i_n: '', l_r: '', l_s: '', l_t: '', l_n: '' },
    lv5: { v_r: '', v_s: '', v_t: '', v_n: '', i_r: '', i_s: '', i_t: '', i_n: '', l_r: '', l_s: '', l_t: '', l_n: '' },
    pf: { day: '', night: '' },
    power: { active: '', reactive: '', max: '', multiplier: '' }
  } : undefined,
  approver: ''
});

export const fetchSafetyCheck = async (month: string, type: 'general' | 'ev'): Promise<SafetyCheckData | null> => {
  return await fetchWithCache<SafetyCheckData>(`SAFETY_${type}_${month}`);
};

export const saveSafetyCheck = async (data: SafetyCheckData) => {
  return await saveToApi(`SAFETY_${data.type}_${data.date.substring(0, 7)}`, data);
};

/**
 * HVAC Log
 */
export const getInitialHvacLog = (date: string): HvacLogData => ({
  date,
  unitNo: '',
  inletTempColdHot: { time10: '', time15: '' },
  outletTempColdHot: { time10: '', time15: '' },
  outletPressColdHot: { time10: '', time15: '' },
  inletTempCooling: { time10: '', time15: '' },
  outletTempCooling: { time10: '', time15: '' },
  outletPressCooling: { time10: '', time15: '' },
  tempLowGen: { time10: '', time15: '' },
  tempHighGen: { time10: '', time15: '' },
  tempExhaust: { time10: '', time15: '' },
  pressGen: { time10: '', time15: '' },
  pressGas1: { time10: '', time15: '' },
  pressGas2: { time10: '', time15: '' },
  valveOpening: { time10: '', time15: '' },
  hvacLogs: [{ id: '1', runTime: '' }],
  totalRunTime: '',
  gas: { prev: '', curr: '', usage: '', monthTotal: '' },
  sterilizer: { prevStock: '', inQty: '', usedQty: '', stock: '' }
});

export const fetchHvacLog = async (date: string, force = false): Promise<HvacLogData | null> => {
  return await fetchWithCache<HvacLogData>(`HVAC_LOG_${date}`, force);
};

export const saveHvacLog = async (data: HvacLogData) => {
  saveToCache(`HVAC_LOG_${data.date}`, data);
  return await saveToApi(`HVAC_LOG_${data.date}`, data);
};

/**
 * Boiler Log
 */
export const getInitialBoilerLog = (date: string): BoilerLogData => ({
  date,
  logs: [
    { id: '1', runTime: '', gasPressure1: '', gasPressure2: '', steamPressure: '', exhaustTemp: '', supplyTemp: '', hotWaterTemp: '', waterLevel: '' },
    { id: '2', runTime: '', gasPressure1: '', gasPressure2: '', steamPressure: '', exhaustTemp: '', supplyTemp: '', hotWaterTemp: '', waterLevel: '' },
    { id: '3', runTime: '', gasPressure1: '', gasPressure2: '', steamPressure: '', exhaustTemp: '', supplyTemp: '', hotWaterTemp: '', waterLevel: '' }
  ],
  totalRunTime: '',
  gas: { prev: '', curr: '', usage: '', monthTotal: '' },
  salt: { prevStock: '', inQty: '', usedQty: '', stock: '' },
  cleaner: { prevStock: '', inQty: '', usedQty: '', stock: '' }
});

export const fetchBoilerLog = async (date: string, force = false): Promise<BoilerLogData | null> => {
  return await fetchWithCache<BoilerLogData>(`BOILER_LOG_${date}`, force);
};

export const saveBoilerLog = async (data: BoilerLogData) => {
  saveToCache(`BOILER_LOG_${data.date}`, data);
  return await saveToApi(`BOILER_LOG_${data.date}`, data);
};

/**
 * Air Environment Log
 */
export const getInitialAirEnvironmentLog = (date: string): AirEnvironmentLogData => ({
  date,
  emissions: [
    { id: 'em-1', outletNo: '1', facilityName: '냉온수기 1호기', runTime: '', remarks: '운휴' },
    { id: 'em-2', outletNo: '2', facilityName: '냉온수기 2호기', runTime: '', remarks: '운휴' },
    { id: 'em-3', outletNo: '3', facilityName: '보 일 러', runTime: '', remarks: '운휴' }
  ],
  preventions: [
    { id: 'pr-1', facilityName: '냉온수기 1호기', location: 'B6F 기계실', gasUsage: '', pollutants: 'SOX , NOX , 먼지' },
    { id: 'pr-2', facilityName: '냉온수기 2호기', location: 'B6F 기계실', gasUsage: '', pollutants: 'SOX , NOX , 먼지' },
    { id: 'pr-3', facilityName: '보일러', location: 'B6F 기계실', gasUsage: '', pollutants: 'SOX , NOX , 먼지' }
  ]
});

export const fetchAirEnvironmentLog = async (date: string): Promise<AirEnvironmentLogData | null> => {
  return await fetchWithCache<AirEnvironmentLogData>(`AIR_ENV_${date}`);
};

export const saveAirEnvironmentLog = async (data: AirEnvironmentLogData) => {
  return await saveToApi(`AIR_ENV_${data.date}`, data);
};

/**
 * Water Tank
 */
export const getInitialWaterTankLog = (date: string): WaterTankLogData => ({
  date,
  buildingName: '새마을운동중앙회 대치동 사옥',
  location: '서울특별시 강남구 영동대로 316(대치동,새마을운동중앙회)',
  usage: '사무용',
  inspector: '',
  items: [
    { id: 'wt-1', category: '저수조 주위의 상태', criteria: ['청결하며 쓰레기·오물 등이 놓여 있지 아니할 것', '저수조 주위에 고인 물, 용수 등이 없을 것'], results: ['O', 'O'] },
    { id: 'wt-2', category: '저수조 본체의 상태', criteria: ['균열 또는 누수되는 부분이 없을 것', '출입구나 접합부의 틈으로 빗물 등이 들어가지 아니할 것', '유출관·배수관등의 접합부분은 고정되고 방수·밀폐되어 있을 것'], results: ['O', 'O', 'O'] },
    { id: 'wt-3', category: '저수조 윗부분의 상태', criteria: ['저수조의 윗부분에는 물을 오염시킬 우려가 있는 설비나기기 등이 놓여 있지 아니할 것', '저수조의 상부는 물이 고이지 아니하여야 하고 먼지 등 위생에 해로운 것이 쌓이지 아니할 것'], results: ['O', 'O'] },
    { id: 'wt-4', category: '저수조 안의 상태', criteria: ['오물, 붉은 녹 등의 침식물, 저수조 내벽 및 내부구조물의 오염 또는 도장의 떨어짐 등이 없을 것', '수중 및 수면에 부유물질(浮遊物質)이 없을 것', '외벽도장이 벗겨져 빛이 투과하는 상태로 되어 있지 아니할 것'], results: ['O', 'O', 'O'] },
    { id: 'wt-5', category: '맨홀의 상태', criteria: ['뚜껑을 통하여 먼지나 그 밖에 위생에 해로운 부유물질이 들어 갈 수 없는 구조일 것', '점검을 하는 자 외의 자가 쉽게 열고 닫을 수 없도록 장금장치가 안전할 것'], results: ['O', 'O'] },
    { id: 'wt-6', category: '월류관·통기관의 상태', criteria: ['관의 끝부분으로부터 먼지나 그 밖에 위생에 해로운 물질이 들어갈 수 없을 것', '관 끝부분의 방충망은 훼손되지 아니하고 망눈의 크기는 작은 동물 등의 침입을 막을 수 있을 것'], results: ['O', 'O'] },
    { id: 'wt-7', category: '냄새', criteria: ['물에 불쾌한 냄새가 나지 아니할 것'], results: ['O'] },
    { id: 'wt-8', category: '맛', criteria: ['물이 이상한 맛이 나지 아니할 것'], results: ['O'] },
    { id: 'wt-9', category: '색도', criteria: ['물에 이상한 색이 나타나지 아니할 것'], results: ['O'] },
    { id: 'wt-10', category: '탁도', criteria: ['물이 이상한 탁함이 나타나지 아니할 것'], results: ['O'] }
  ]
});

export const fetchWaterTankLog = async (month: string): Promise<WaterTankLogData | null> => {
  return await fetchWithCache<WaterTankLogData>(`WATER_TANK_${month}`);
};

export const saveWaterTankLog = async (data: WaterTankLogData) => {
  const monthKey = data.date.substring(0, 7);
  return await saveToApi(`WATER_TANK_${monthKey}`, data);
};

/**
 * Chemical Log
 */
export const getInitialChemicalLog = (date: string): ChemicalLogData => ({
  date,
  items: []
});

export const fetchChemicalLog = async (date: string): Promise<ChemicalLogData | null> => {
  return await fetchWithCache<ChemicalLogData>(`CHEMICAL_${date}`);
};

export const saveChemicalLog = async (data: ChemicalLogData) => {
  return await saveToApi(`CHEMICAL_${data.date}`, data);
};

/**
 * Fire Extinguishers
 */
export const fetchFireExtinguisherList = async (): Promise<FireExtinguisherItem[]> => {
  const res = await fetchWithCache<any>('FIRE_EXT_DB');
  return res?.fireExtList || [];
};

export const saveFireExtinguisherList = async (list: FireExtinguisherItem[]) => {
  return await saveToApi('FIRE_EXT_DB', { fireExtList: list });
};

/**
 * Tenants
 */
export const fetchTenants = async (): Promise<Tenant[]> => {
  const res = await fetchWithCache<any>('TENANT_DB');
  return res?.tenants || [];
};

export const saveTenants = async (list: Tenant[]) => {
  return await saveToApi('TENANT_DB', { tenants: list });
};

/**
 * Elevator Inspection History
 */
export const fetchElevatorInspectionList = async (): Promise<ElevatorInspectionItem[]> => {
  const res = await fetchWithCache<any>('ELEVATOR_INSPECTION_DB');
  return res?.inspectionList || [];
};

export const saveElevatorInspectionList = async (list: ElevatorInspectionItem[]) => {
  return await saveToApi('ELEVATOR_INSPECTION_DB', { inspectionList: list });
};

/**
 * Construction Logs
 */
export const fetchExternalWorkList = async (): Promise<ConstructionWorkItem[]> => {
  const res = await fetchWithCache<any>('EXTERNAL_WORK_DB');
  return res?.workList || [];
};

export const saveExternalWorkList = async (list: ConstructionWorkItem[]) => {
  return await saveToApi('EXTERNAL_WORK_DB', { workList: list });
};

export const fetchInternalWorkList = async (): Promise<ConstructionWorkItem[]> => {
  const res = await fetchWithCache<any>('INTERNAL_WORK_DB');
  return res?.workList || [];
};

export const saveInternalWorkList = async (list: ConstructionWorkItem[]) => {
  return await saveToApi('INTERNAL_WORK_DB', { workList: list });
};

/**
 * Appointments
 */
export const fetchAppointmentList = async (): Promise<AppointmentItem[]> => {
  const res = await fetchWithCache<any>('APPOINTMENT_DB');
  return res?.appointmentList || [];
};

export const saveAppointmentList = async (list: AppointmentItem[]) => {
  return await saveToApi('APPOINTMENT_DB', { appointmentList: list });
};

/**
 * Fire Inspection Log (Alternative)
 */
export const getInitialFireInspectionLog = (date: string): FireInspectionLogData => ({
  date,
  items: [],
  inspector: ''
});

export const fetchFireInspectionLog = async (date: string): Promise<FireInspectionLogData | null> => {
  return await fetchWithCache<FireInspectionLogData>(`FIRE_INSP_LOG_${date}`);
};

export const saveFireInspectionLog = async (data: FireInspectionLogData) => {
  return await saveToApi(`FIRE_INSP_LOG_${data.date}`, data);
};

/**
 * Fire History
 */
export const fetchFireHistoryList = async (): Promise<FireHistoryItem[]> => {
  const res = await fetchWithCache<any>('FIRE_INSPECTION_HISTORY_DB');
  return res?.fireHistoryList || [];
};

export const saveFireHistoryList = async (list: FireHistoryItem[]) => {
  return await saveToApi('FIRE_INSPECTION_HISTORY_DB', { fireHistoryList: list });
};
