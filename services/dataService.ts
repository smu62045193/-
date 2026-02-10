import { createClient } from '@supabase/supabase-js';
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
  ConsumableRequestItem, 
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
  Tenant,
  ShiftSettings,
  BatteryItem,
  TaskItem,
  VcbReadings,
  AcbReadings,
  PowerUsageReadings,
  DailyStats
} from '../types';
import { format, addDays, parseISO } from 'date-fns';

// Supabase configuration
const SUPABASE_URL = 'https://gvymrgekfdxqrkbrgroa.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_9BNvty62YwJwcy3xBmcpvQ_bziQ1VDD'; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * UUID 유효성 검사 및 생성 헬퍼
 */
export const isValidUUID = (uuid: string) => {
  const s = "" + uuid;
  const match = s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  return !!match;
};

export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * ID가 존재하면 유지하고 없으면 생성하는 헬퍼
 */
const ensureID = (id: string | undefined) => {
  if (id && id.trim() !== '') return id;
  return generateUUID();
};

/**
 * [Supabase 전용] Prefix와 테이블명 매핑 정의
 */
const PREFIX_TABLE_MAP: Record<string, string> = {
  "DAILY_": "daily_reports",
  "SUB_LOG_": "substation_logs",
  "GAS_LOG_": "gas_logs",
  "SEPTIC_LOG_": "septic_logs",
  "WEEKLY_": "weekly_reports",
  "FIRE_FAC_": "fire_facility_logs",
  "ELEV_LOG_": "elevator_logs",
  "METER_": "meter_readings",
  "GEN_CHECK_": "generator_checks",
  "BATTERY_": "battery_checks",
  "LOAD_": "load_currents",
  "SAFETY_general_": "safety_checks",
  "SAFETY_ev_": "safety_checks",
  "AIR_ENV_": "air_environment_logs",
  "HVAC_LOG_": "hvac_boiler_logs",
  "BOILER_LOG_": "hvac_boiler_logs",
  "HVAC_BOILER_": "hvac_boiler_logs",
  "SUB_CHECK_": "substation_checklists"
};

/**
 * DB 데이터를 앱 인터페이스로 매핑 (Snake to Camel)
 */
const mapFromDB = (prefix: string, item: any): any => {
  if (!item) return null;
  
  switch(prefix) {
    case "DAILY_":
      return {
        date: item.id,
        facilityDuty: item.facility_duty,
        securityDuty: item.security_duty,
        utility: item.utility,
        workLog: item.work_log,
        lastUpdated: item.last_updated
      };
    case "SUB_LOG_":
      return {
        date: item.date,
        vcb: item.vcb,
        acb: item.acb,
        powerUsage: item.power_usage,
        dailyStats: item.daily_stats
      };
    case "WEEKLY_":
      return {
        startDate: item.start_date,
        reportingDate: item.reporting_date,
        author: item.author,
        fields: item.fields,
        photos: item.photos,
        lastUpdated: item.last_updated
      };
    case "METER_":
      return {
        month: item.month,
        unitPrice: item.unit_price,
        totalBillInput: item.total_bill_input,
        totalUsageInput: item.total_usage_input,
        creationDate: item.creation_date,
        items: item.items || [],
        lastUpdated: item.last_updated
      };
    case "HVAC_LOG_":
      return item.hvac_data;
    case "BOILER_LOG_":
      return item.boiler_data;
    case "HVAC_BOILER_":
      return item; 
    default:
      return item.data || item;
  }
};

/**
 * 데이터 매퍼 (Mapper) - ID 보존 및 중복 방지 강화
 */
const mapParkingStatusToDB = (item: ParkingStatusItem) => ({
  id: ensureID(item.id), 
  date: item.date,
  type: item.type || null,
  location: item.location,
  company: item.company,
  prev_plate: item.prevPlate || null,
  plate_num: item.plateNum,
  note: item.note,
  last_updated: new Date().toISOString()
});

const mapParkingChangeToDB = (item: ParkingChangeItem) => ({
  id: ensureID(item.id),
  date: item.date,
  type: item.type,
  company: item.company,
  location: item.location,
  prev_plate: item.prevPlate || null,
  new_plate: item.newPlate,
  note: item.note,
  last_updated: new Date().toISOString()
});

/**
 * 승강기 점검 이력 매퍼
 */
const mapElevatorInspectionToDB = (item: ElevatorInspectionItem) => ({
  id: ensureID(item.id),
  date: item.date,
  company: item.company,
  content: item.content,
  note: item.note
});

/**
 * 소방 점검 이력 매퍼
 */
const mapFireHistoryToDB = (item: FireHistoryItem) => ({
  id: ensureID(item.id),
  date: item.date,
  company: item.company,
  content: item.content,
  note: item.note
});

/**
 * 소화기 관리 매퍼
 */
const mapFireExtinguisherToDB = (item: FireExtinguisherItem) => ({
  id: ensureID(item.id),
  manage_no: item.manageNo,
  type: item.type,
  floor: item.floor,
  company: item.company,
  serial_no: item.serialNo,
  phone: item.phone,
  cert_no: item.certNo,
  date: item.date,
  remarks: item.remarks
});

/**
 * Base64를 Blob으로 변환
 */
const dataURLtoBlob = (dataurl: string) => {
  const arr = dataurl.split(',');
  if (arr.length < 2) return null;
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

/**
 * Supabase Storage 업로드
 */
export const uploadFile = async (bucket: string, folder: string, fileName: string, base64Data: string): Promise<string | null> => {
  if (!base64Data || !base64Data.startsWith('data:image')) return base64Data; 

  try {
    const blob = dataURLtoBlob(base64Data);
    if (!blob) return base64Data;
    const filePath = `${folder}/${fileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob, {
        upsert: true,
        contentType: blob.type
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return publicUrl;
  } catch (err) {
    console.error('Storage Upload Error:', err);
    return base64Data;
  }
};

/**
 * Storage Helpers
 */
export const getFromStorage = (key: string, isJson = true) => {
  const data = localStorage.getItem(key);
  if (!data) return null;
  return isJson ? JSON.parse(data) : data;
};

export const saveToCache = (key: string, data: any, isJson = true) => {
  localStorage.setItem(key, isJson ? JSON.stringify(data) : data);
};

export const clearCache = (key: string) => {
  localStorage.removeItem(key);
};

export const deepMerge = (target: any, source: any): any => {
  if (!source) return target;
  if (!target) return source;
  const output = { ...target };
  Object.keys(source).forEach(key => {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  });
  return output;
};

/**
 * Supabase 병렬 쿼리
 */
export const apiFetchBatch = async (requests: any[]): Promise<any[]> => {
  const promises = requests.map(async (req) => {
    try {
      if (req.type === 'get') {
        const data = await fetchSingleGeneric(req.key);
        return { key: req.key, data: data };
      } else if (req.type === 'range') {
        const data = await apiFetchRange(req.prefix, req.start, req.end);
        return { key: req.prefix, data: data };
      }
    } catch (e) {
      console.error(`Batch item error [${req.key || req.prefix}]:`, e);
      return { key: (req.key || req.prefix), data: null, error: e };
    }
    return null;
  });
  
  return await Promise.all(promises);
};

/**
 * Supabase 범위 쿼리
 */
export const apiFetchRange = async (prefix: string, start: string, end: string): Promise<any[]> => {
  const table = PREFIX_TABLE_MAP[prefix];
  if (!table) return [];

  try {
    let query = supabase.from(table).select("*");
    
    const isSpecialPrefix = (prefix === "DAILY_" || prefix === "HVAC_LOG_" || prefix === "BOILER_LOG_" || prefix === "AIR_ENV_");
    const startKey = isSpecialPrefix ? start : `${prefix}${start}`;
    const endKey = isSpecialPrefix ? end : `${prefix}${end}`;

    if (prefix === "HVAC_LOG_" || prefix === "BOILER_LOG_") {
      query = query.gte("id", `HVAC_BOILER_${start}`).lte("id", `HVAC_BOILER_${end}`);
    } else if (prefix === "DAILY_") {
      query = query.gte("id", start).lte("id", end);
    } else if (prefix === "AIR_ENV_") {
      query = query.gte("id", `AIR_ENV_${start}`).lte("id", `AIR_ENV_${end}`);
    } else {
      query = query.gte("id", startKey).lte("id", endKey);
    }

    const { data, error } = await query.order('id', { ascending: true });
    
    if (error) throw error;
    if (!data) return [];

    return data.map(item => ({
      key: item.id,
      data: mapFromDB(prefix, item)
    }));
  } catch (err) {
    console.error(`apiFetchRange failed for ${prefix}:`, err);
    return [];
  }
};

/**
 * 단일 키 기반 데이터 라우팅 함수 (Batch Get용)
 */
const fetchSingleGeneric = async (key: string): Promise<any> => {
  if (key.startsWith("DAILY_")) return await fetchDailyData(key.replace("DAILY_", ""), true);
  if (key.startsWith("GAS_LOG_")) return await fetchGasLog(key.replace("GAS_LOG_", ""));
  if (key.startsWith("SEPTIC_LOG_")) return await fetchSepticLog(key.replace("SEPTIC_LOG_", ""));
  if (key.startsWith("SUB_LOG_")) return await fetchSubstationLog(key.replace("SUB_LOG_", ""), true);
  if (key.startsWith("SUB_CHECK_")) return await fetchSubstationChecklist(key.replace("SUB_CHECK_", ""));
  if (key.startsWith("FIRE_FAC_")) return await fetchFireFacilityLog(key.replace("FIRE_FAC_", ""));
  if (key.startsWith("ELEV_LOG_")) return await fetchElevatorLog(key.replace("ELEV_LOG_", ""));
  
  if (key.startsWith("HVAC_BOILER_")) {
    const { data } = await supabase.from('hvac_boiler_logs').select("*").eq("id", key).maybeSingle();
    return mapFromDB("HVAC_BOILER_", data);
  }

  for (const prefix of Object.keys(PREFIX_TABLE_MAP)) {
    if (key.startsWith(prefix)) {
      const table = PREFIX_TABLE_MAP[prefix];
      const { data } = await supabase.from(table).select("*").eq("id", key).maybeSingle();
      return mapFromDB(prefix, data);
    }
  }
  return null;
};

/**
 * 초기 데이터 생성기
 */
export const getInitialDailyData = (date: string): DailyData => ({
  date,
  facilityDuty: { day: '', night: '', off: '', vacation: '', deputy: '', chief: '', shiftMode: 'manual', baseDate: '' },
  securityDuty: { day: '', night: '', off: '', vacation: '' },
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
    handover: { today: [], tomorrow: [] }
  }
});

export const getInitialSubstationChecklist = (date: string): SubstationChecklistData => ({
  date,
  items: [
    { id: 'tr_1', category: '변압기', label: '변압기 외관 청결상태', result: '양호' },
    { id: 'tr_2', category: '변압기', label: '단자부위 과열 및 변색여부', result: '양호' },
    { id: 'tr_3', category: '변압기', label: '이상음, 진동, 취기 발생유무', result: '양호' },
    { id: 'tr_4', category: '변압기', label: '접지선 접촉 및 단선유무', result: '양호' },
    { id: 'tr_5', category: '변압기', label: '온도상태 확인 및 환기팬 작동', result: '양호' },
    { id: 'tr_6', category: '변압기', label: '애자류 손상 및 오염상태', result: '양호' },
    { id: 'tr_7', category: '변압기', label: '반내 습기유입 및 부식상태', result: '양호' },
    { id: 'vcb_1', category: 'VCB A B', label: 'VCB 투입 및 개방상태 확인', result: '양호' },
    { id: 'vcb_2', category: 'VCB A B', label: '이상 소음 및 냄새 유무', result: '양호' },
    { id: 'vcb_3', category: 'VCB A B', label: '각종 계기 및 램프 점등상태', result: '양호' },
    { id: 'ats_1', category: 'ATS', label: 'ATS 절체상태 및 동작유무', result: '양호' },
    { id: 'ats_2', category: 'ATS', label: '단자부 변색 및 과열유무', result: '양호' },
    { id: 'ats_3', category: 'ATS', label: '조작배선 탈락 및 단선유무', result: '양호' },
    { id: 'ats_4', category: 'ATS', label: '반내 청결 및 먼지 퇴적상태', result: '양호' },
    { id: 'ats_5', category: 'ATS', label: '각종 릴레이 및 퓨즈 이상유무', result: '양호' },
    { id: 'ats_6', category: 'ATS', label: '비상전원 투입 대기상태', result: '양호' },
    { id: 'ats_7', category: 'ATS', label: '수동 절체 레버 비치상태', result: '양호' },
    { id: 'ats_8', category: 'ATS', label: '판넬 잠금 및 시건상태', result: '양호' },
    { id: 'ats_9', category: 'ATS', label: '주변 정리 정돈 상태', result: '양호' }
  ],
  approvers: { checker: '', manager: '' },
  note: ''
});

export const getInitialFireFacilityLog = (date: string): FireFacilityLogData => ({
  date,
  items: [
    { id: 'fire_1', category: '소방시설', content: '소화기는 정상 위치 여부', result: '양호', remarks: '' },
    { id: 'fire_2', category: '소방시설', content: '수신반제어/밸브류 정상 여부', result: '양호', remarks: '' },
    { id: 'fire_3', category: '소방시설', content: '유도등 상태가 양호한지 여부', result: '양호', remarks: '' },
    { id: 'fire_4', category: '피난방화시설', content: '소화전 주위 장애물 적치여부', result: '양호', remarks: '' },
    { id: 'fire_5', category: '피난방화시설', content: '계단·전실·복도 장애물 적치 여부', result: '양호', remarks: '' },
    { id: 'fire_6', category: '피난방화시설', content: '방화문 주위 장애물 적치 여부', result: '양호', remarks: '' },
    { id: 'fire_7', category: '화재예방조치', content: '가연물 및 위험물 사용 적정 여부', result: '양호', remarks: '' },
    { id: 'fire_8', category: '화재예방조치', content: '전기시설 사용 적정 여부', result: '양호', remarks: '' },
    { id: 'fire_9', category: '화재예방조치', content: '가스시설 사용 적정 여부', result: '양호', remarks: '' },
    { id: 'fire_10', category: '화기취급감독', content: '유류 관리 상태', result: '양호', remarks: '' },
    { id: 'fire_11', category: '화기취급감독', content: '전열기구 관리 상태', result: '양호', remarks: '' },
    { id: 'fire_12', category: '화기취급감독', content: '공사중 소화기 비치', result: '양호', remarks: '' },
    { id: 'fire_13', category: '기타', content: '쥐, 고양이등 침입에 취약점 상태', result: '양호', remarks: '' }
  ],
  remarks: '',
  approvers: { inspector: '', manager: '' }
});

export const getInitialElevatorLog = (date: string): ElevatorLogData => ({
  date,
  items: [
    { id: 'elv_1', category: '운행상태', content: '카내버튼상태', results: { ev1: '양호', ev2: '양호', ev3: '양호', ev4: '양호', ev5: '양호' }, note: '' },
    { id: 'elv_2', category: '운행상태', content: '카내조명상태', results: { ev1: '양호', ev2: '양호', ev3: '양호', ev4: '양호', ev5: '양호' }, note: '' },
    { id: 'elv_3', category: '운행상태', content: '카도어개폐상태', results: { ev1: '양호', ev2: '양호', ev3: '양호', ev4: '양호', ev5: '양호' }, note: '' },
    { id: 'elv_4', category: '운행상태', content: '카레벨상태', results: { ev1: '양호', ev2: '양호', ev3: '양호', ev4: '양호', ev5: '양호' }, note: '' },
    { id: 'elv_5', category: '운행상태', content: '카운행상태', results: { ev1: '양호', ev2: '양호', ev3: '양호', ev4: '양호', ev5: '양호' }, note: '' },
    { id: 'elv_6', category: '운행상태', content: '감시반이상유무', results: { ev1: '양호', ev2: '양호', ev3: '양호', ev4: '양호', ev5: '양호' }, note: '' },
    { id: 'elv_7', category: '운행상태', content: '기계실이상유무', results: { ev1: '양호', ev2: '양호', ev3: '양호', ev4: '양호', ev5: '양호' }, note: '' }
  ],
  remarks: '',
  inspector: ''
});

export const getInitialGasLog = (date: string): GasLogData => ({
  date,
  items: [
    { id: 'gas_1', category: '정압실', content: '정압기의 작동상태', result: '양호' },
    { id: 'gas_2', category: '정압실', content: '각 밸브의 개폐 상태', result: '양호' },
    { id: 'gas_3', category: '정압실', content: '배관 각이음부위의 누설 유무', result: '양호' },
    { id: 'gas_4', category: '정압실', content: '보안유지 관리 상태', result: '양호' },
    { id: 'gas_5', category: '정압실', content: '압력기록기의 작동 상태', result: '양호' },
    { id: 'gas_6', category: '정압실', content: '청결유지상태', result: '양호' },
    { id: 'gas_7', category: '배관 계통', content: '가스누설 차단장치의 작동상태', result: '양호' },
    { id: 'gas_8', category: '배관 계통', content: '배관부식 및 고정장치의 상태', result: '양호' },
    { id: 'gas_9', category: '배관 계통', content: '누설유무', result: '양호' },
    { id: 'gas_10', category: '배관 계통', content: '휠타의 청결상태', result: '양호' },
    { id: 'gas_11', category: '연소 장치', content: '정압기의 작동상태', result: '양호' },
    { id: 'gas_12', category: '연소 장치', content: '전자변의 작동상태', result: '양호' },
    { id: 'gas_13', category: '연소 장치', content: '가스량제어와 풍량제어의 연동상태', result: '양호' },
    { id: 'gas_14', category: '연소 장치', content: '버너의 막힘 손상유무', result: '양호' },
    { id: 'gas_15', category: '연소 장치', content: '각연결부분 누설유무', result: '양호' },
    { id: 'gas_16', category: '경보 장치', content: '가스 이상압 통보기의 상태', result: '양호' },
    { id: 'gas_17', category: '경보 장치', content: '감지기의 상태', result: '양호' }
  ]
});

export const getInitialSepticLog = (date: string): SepticLogData => ({
  date,
  items: [
    { id: 'sep_1', content: '조절 수위 및 배수 상태는 양호한가?', result: '양호' },
    { id: 'sep_2', content: '소독조의 염소 투입 상태는 양호한가?', result: '양호' },
    { id: 'sep_3', content: 'BLOWER의 상태는 양호한가?', result: '양호' },
    { id: 'sep_4', content: '악취 및 부유물은 없는가?', result: '양호' },
    { id: 'sep_5', content: 'PUMP의 소음 및 심한 진동은 없는가?', result: '양호' },
    { id: 'sep_6', content: '전원 PANEL은 정상인가?', result: '양호' },
    { id: 'sep_7', content: '정화조 내부의 청결 및 정리정돈은 양호한가?', result: '양호' },
    { id: 'sep_8', content: '급,배기휀의 작동상태는 양호한가?', result: '양호' },
    { id: 'sep_9', content: '감속기의 상태는 정상인가?', result: '양호' },
    { id: 'sep_10', content: '가연물 및 위험물 사용 적정 여부', result: '양호' }
  ]
});

export const getInitialSubstationLog = (date: string): SubstationLogData => ({
  date,
  vcb: {
    time9: { main: { v: '22.9', a: '', pf: '', hz: '60' }, tr1: { v: '22.9', a: '', pf: '' }, tr2: { v: '22.9', a: '', pf: '' }, tr3: { v: '22.9', a: '', pf: '' } },
    time21: { main: { v: '22.9', a: '', pf: '', hz: '60' }, tr1: { v: '22.9', a: '', pf: '' }, tr2: { v: '22.9', a: '', pf: '' }, tr3: { v: '22.9', a: '', pf: '' } }
  },
  acb: {
    time9: { acb1: { v: '', a: '', kw: '' }, acb2: { v: '', a: '', kw: '' }, acb3: { v: '', a: '', kw: '' }, trTemp: { tr1: '', tr2: '', tr3: '' } },
    time21: { acb1: { v: '', a: '', kw: '' }, acb2: { v: '', a: '', kw: '' }, acb3: { v: '', a: '', kw: '' }, trTemp: { tr1: '', tr2: '', tr3: '' } }
  },
  powerUsage: {
    prev: { activeMid: '', activeMax: '', activeLight: '', reactiveMid: '', reactiveMax: '' },
    curr: { activeMid: '', activeMax: '', activeLight: '', reactiveMid: '', reactiveMax: '' },
    usage: { activeMid: '', activeMax: '', activeLight: '', reactiveMid: '', reactiveMax: '' }
  },
  dailyStats: { activePower: '', reactivePower: '', monthTotal: '', maxPower: '', powerFactor: '', loadFactor: '', demandFactor: '' }
});

export const getInitialMeterReading = (month: string): MeterReadingData => ({ 
  month, 
  items: [],
  creationDate: format(new Date(), 'yyyy-MM-dd')
});

export const getInitialGeneratorCheck = (month: string): GeneratorCheckData => ({
  date: month,
  specs: { manufacturer: '', year: '', serialNo: '', type: '', output: '', voltage: '', current: '', rpm: '', method: '', location: '' },
  test: { checkDate: '', dayName: '', reason: '', startTime: '', endTime: '', usedTime: '', monthlyRunTime: '', monthlyRunCount: '', totalRunTime: '', fuelUsed: '', fuelTotal: '', voltsRS: '', voltsRN: '', voltsST: '', voltsSN: '', voltsTR: '', voltsTN: '', ampR: '', ampS: '', ampT: '', oilTemp: '', oilPressure: '', rpmValue: '', batteryGravityValue: '' },
  status: { coolingWater: '양호', startCircuit: '양호', fuelStatus: '양호', afterRun: '양호', panel: '양호', engine: '양호', duringRun: '양호', afterStop: '양호', battery: '양호', gravity: '양호' },
  note: ''
});

export const getInitialBatteryCheck = (month: string): BatteryCheckData => ({
  month, checkDate: '',
  items: [
    { id: 'bat-rec-acv', label: 'AC V', manufacturer: '', manufDate: '', spec: '', voltage: '', remarks: '', section: 'rectifier' },
    { id: 'bat-rec-dcv', label: 'DC V', manufacturer: '', manufDate: '', spec: '', voltage: '', remarks: '', section: 'rectifier' },
    { id: 'bat-ind-1', label: '1', manufacturer: '', manufDate: '', spec: '', voltage: '', remarks: '', section: 'battery' },
    { id: 'bat-ind-2', label: '2', manufacturer: '', manufDate: '', spec: '', voltage: '', remarks: '', section: 'battery' },
    { id: 'bat-ind-3', label: '3', manufacturer: '', manufDate: '', spec: '', voltage: '', remarks: '', section: 'battery' },
    { id: 'bat-ind-4', label: '4', manufacturer: '', manufDate: '', spec: '', voltage: '', remarks: '', section: 'battery' },
    { id: 'bat-ind-5', label: '5', manufacturer: '', manufDate: '', spec: '', voltage: '', remarks: '', section: 'battery' },
    { id: 'bat-ind-6', label: '6', manufacturer: '', manufDate: '', spec: '', voltage: '', remarks: '', section: 'battery' },
    { id: 'bat-ind-7', label: '7', manufacturer: '', manufDate: '', spec: '', voltage: '', remarks: '', section: 'battery' },
    { id: 'bat-ind-8', label: '8', manufacturer: '', manufDate: '', spec: '', voltage: '', remarks: '', section: 'battery' },
    { id: 'bat-ind-9', label: '9', manufacturer: '', manufDate: '', spec: '', voltage: '', remarks: '', section: 'battery' },
    { id: 'bat-gen-1', label: '10', manufacturer: '', manufDate: '', spec: '', voltage: '', remarks: '', section: 'generator' },
    { id: 'bat-gen-2', label: '11', manufacturer: '', manufDate: '', spec: '', voltage: '', remarks: '', section: 'generator' }
  ],
  approvers: { staff: '', assistant: '', manager: '', director: '' }
});

export const getInitialLoadCurrent = (month: string): LoadCurrentData => ({ date: month, period: '', items: [] });

export const getInitialSafetyCheck = (date: string, type: 'general' | 'ev'): SafetyCheckData => ({
  date, type, items: [], approver: '', opinion: '',
  measurements: type === 'general' ? {
    lv1: { v_r: '', v_s: '', v_t: '', v_n: '', i_r: '', i_s: '', i_t: '', i_n: '', l_r: '', l_s: '', l_t: '', l_n: '' },
    lv3: { v_r: '', v_s: '', v_t: '', v_n: '', i_r: '', i_s: '', i_t: '', i_n: '', l_r: '', l_s: '', l_t: '', l_n: '' },
    lv5: { v_r: '', v_s: '', v_t: '', v_n: '', i_r: '', i_s: '', i_t: '', i_n: '', l_r: '', l_s: '', l_t: '', l_n: '' },
    pf: { day: '', night: '' },
    power: { active: '', reactive: '', max: '', multiplier: '1200' }
  } : undefined
});

export const getInitialHvacLog = (date: string): HvacLogData => ({
  date,
  unitNo: '1',
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

export const getInitialAirEnvironmentLog = (date: string): AirEnvironmentLogData => ({
  date,
  emissions: [
    { id: '1', outletNo: '1', facilityName: '냉온수기1호기', runTime: '', remarks: '' },
    { id: '2', outletNo: '2', facilityName: '냉온수기2호기', runTime: '', remarks: '' },
    { id: '3', outletNo: '3', facilityName: '보일러', runTime: '', remarks: '' }
  ],
  preventions: [
    { id: '1', facilityName: '냉,온수기1호기', location: '기계실', gasUsage: '', pollutants: 'SOX, NOX, 먼지' },
    { id: '2', facilityName: '냉,온수기2호기', location: '기계실', gasUsage: '', pollutants: 'SOX, NOX, 먼지' },
    { id: '3', facilityName: '보일러', location: '기계실', gasUsage: '', pollutants: 'SOX, NOX, 먼지' }
  ],
  weatherCondition: '흐림',
  tempMin: '-1',
  tempMax: '7'
});

export const getInitialWaterTankLog = (date: string): WaterTankLogData => ({
  date,
  buildingName: '새마을운동중앙회 대치동사옥',
  location: '지하 6층 기계실',
  usage: '업무시설(빌딩)',
  items: [
    { id: '1', category: '저수조주위의 상태', criteria: ['청결하며 쓰레기·오물 등이 놓여 있지 아니할 것', '저수조 주위에 고인 물, 용수 등이 없을 것'], results: ['O', 'O'] },
    { id: '2', category: '저수조본체의 상태', criteria: ['균열 또는 누수되는 부분이 없을 것', '출입구나 접합부의 틈으로 빗물 등이 들어가지 아니할 것', '유출관·배수관등의 접합부분은 고정되고 방수·밀폐되어 있을 것'], results: ['O', 'O', 'O'] },
    { id: '3', category: '저수조윗부분의 상태', criteria: ['저수조의 윗부분에는 물을 오염시킬 우려가 있는 설비나기기 등이 놓여 있지 아니할 것', '저수조의 상부는 물이 고이지 아니하여야 하고 먼지 등 위생에 해로운 것이 쌓이지 아니할 것'], results: ['O', 'O'] },
    { id: '4', category: '저수조안의 상태', criteria: ['오물, 붉은 녹 등의 침식물, 저수조 내벽 및 내부구조물의 오염 또는 도장의 떨어짐 등이 없을 것', '수중 및 수면에 부유물질(浮遊物質)이 없을 것', '외벽도장이 벗겨져 빛이 투과하는 상태로 되어 있지 아니할 것'], results: ['O', 'O', 'O'] },
    { id: '5', category: '맨홀의 상태', criteria: ['뚜껑을 통하여 먼지나 그 밖에 위생에 해로운 부유물질이 들어 갈 수 없는 구조일 것', '점검을 하는 자 외의 자가 쉽게 열고 닫을 수 없도록 잠금장치가 안전할 것'], results: ['O', 'O'] },
    { id: '6', category: '월류관·통기관의 상태', criteria: ['관의 끝부분으로부터 먼지나 그 밖에 위생에 해로운 물질이 들어갈 수 없을 것', '관 끝부분의 방충망은 훼손되지 아니하고 망눈의 크기는 작은 동물 등의 침입을 막을 수 있을 것'], results: ['O', 'O'] },
    { id: '7', category: '냄새', criteria: ['물에 불쾌한 냄새가 나지 아니할 것'], results: ['O'] },
    { id: '8', category: '맛', criteria: ['물이 이상한 맛이 나지 아니할 것'], results: ['O'] },
    { id: '9', category: '색도', criteria: ['물에 이상한 색이 나타나지 아니할 것'], results: ['O'] },
    { id: '10', category: '탁도', criteria: ['물이 이상한 탁함이 나타나지 아니할 것'], results: ['O'] }
  ],
  inspector: ''
});

export const getInitialChemicalLog = (date: string): ChemicalLogData => ({
  date,
  items: [
    { id: '1', name: '종균제', unit: 'l', prevStock: '', received: '', used: '', currentStock: '', remark: '' },
    { id: '2', name: '소독제', unit: 'kg', prevStock: '', received: '', used: '', currentStock: '', remark: '' }
  ]
});

export const getInitialFireInspectionLog = (date: string): FireInspectionLogData => ({
  date,
  items: [
    { id: '1', category: '소방시설', content: '소화전/송수구 관리 상태', result: '양호', remarks: '' },
    { id: '2', category: '소방시설', content: '수신반 감시 및 동작 상태', result: '양호', remarks: '' }
  ],
  inspector: ''
});

export const fetchHvacLog = async (date: string, force = false): Promise<HvacLogData | null> => {
  try {
    const { data } = await supabase.from('hvac_boiler_logs').select('hvac_data').eq('id', `HVAC_BOILER_${date}`).maybeSingle();
    if (data?.hvac_data) return data.hvac_data as HvacLogData;
  } catch (e) {}
  return null;
};

export const saveHvacLog = async (data: HvacLogData): Promise<boolean> => {
  const { data: existing } = await supabase.from('hvac_boiler_logs').select('*').eq('id', `HVAC_BOILER_${data.date}`).maybeSingle();
  const dbData = { id: `HVAC_BOILER_${data.date}`, date: data.date, hvac_data: data, boiler_data: existing?.boiler_data || null, last_updated: new Date().toISOString() };
  const { error } = await supabase.from('hvac_boiler_logs').upsert(dbData);
  return !error;
};

export const fetchBoilerLog = async (date: string, force = false): Promise<BoilerLogData | null> => {
  try {
    const { data } = await supabase.from('hvac_boiler_logs').select('boiler_data').eq('id', `HVAC_BOILER_${date}`).maybeSingle();
    if (data?.boiler_data) return data.boiler_data as BoilerLogData;
  } catch (e) {}
  return null;
};

export const saveBoilerLog = async (data: BoilerLogData): Promise<boolean> => {
  const { data: existing } = await supabase.from('hvac_boiler_logs').select('*').eq('id', `HVAC_BOILER_${data.date}`).maybeSingle();
  const dbData = { id: `HVAC_BOILER_${data.date}`, date: data.date, boiler_data: data, hvac_data: existing?.hvac_data || null, last_updated: new Date().toISOString() };
  const { error } = await supabase.from('hvac_boiler_logs').upsert(dbData);
  return !error;
};

/**
 * 냉온수기 및 보일러 통합 저장
 */
export const saveHvacBoilerCombined = async (hvacData: HvacLogData | null, boilerData: BoilerLogData | null): Promise<boolean> => {
  const date = hvacData?.date || boilerData?.date;
  if (!date) return false;
  
  let finalHvac = hvacData;
  let finalBoiler = boilerData;
  
  if (!finalHvac || !finalBoiler) {
    const { data: existing } = await supabase.from('hvac_boiler_logs').select('*').eq('id', `HVAC_BOILER_${date}`).maybeSingle();
    if (!finalHvac) finalHvac = existing?.hvac_data || null;
    if (!finalBoiler) finalBoiler = existing?.boiler_data || null;
  }

  const dbData = { 
    id: `HVAC_BOILER_${date}`, 
    date: date, 
    hvac_data: finalHvac, 
    boiler_data: finalBoiler, 
    last_updated: new Date().toISOString() 
  };
  const { error = null } = await supabase.from('hvac_boiler_logs').upsert(dbData);
  return !error;
};

/**
 * Data Fetch & Save Functions (Supabase Only)
 */
export const fetchDailyData = async (date: string, force = false): Promise<DailyData | null> => {
  try {
    const { data } = await supabase.from('daily_reports').select('*').eq('id', date).maybeSingle();
    if (data) {
      const mapped = mapFromDB("DAILY_", data);
      return mapped;
    }
  } catch (e) {}
  return null;
};

export const saveDailyData = async (data: DailyData): Promise<boolean> => {
  const { error } = await supabase.from('daily_reports').upsert({ id: data.date, facility_duty: data.facilityDuty, security_duty: data.securityDuty, utility: data.utility, work_log: data.workLog, last_updated: new Date().toISOString() });
  return !error;
};

export const fetchStaffList = async (): Promise<StaffMember[]> => {
  try {
    const { data } = await supabase.from('staff_members').select('*');
    if (data && data.length > 0) return data.map(s => ({ 
      id: s.id, 
      name: s.name, 
      category: s.category, 
      jobTitle: s.job_title || '', 
      birthDate: s.birth_date || '', 
      joinDate: s.join_date || '', 
      resignDate: s.resign_date || '', 
      phone: s.phone || '', 
      area: s.area || '', 
      note: s.note || '', 
      photo: s.photo_url || s.photo 
    }));
  } catch (e) {}
  return [];
};

/**
 * 빈 문자열을 null로 변환하는 유틸리티
 */
const toNullIfEmpty = (val: string | undefined) => (!val || val.trim() === '') ? null : val;

export const saveStaffList = async (list: StaffMember[]): Promise<boolean> => {
  const dbData = list.map(s => ({ 
    id: ensureID(s.id), 
    name: s.name, 
    category: s.category, 
    job_title: s.jobTitle, 
    birth_date: toNullIfEmpty(s.birthDate), 
    join_date: toNullIfEmpty(s.joinDate), 
    resign_date: toNullIfEmpty(s.resignDate), 
    phone: s.phone, 
    area: s.area, 
    note: s.note, 
    photo_url: s.photo 
  }));
  const { error } = await supabase.from('staff_members').upsert(dbData);
  return !error;
};

/**
 * 직원 정보 영구 삭제
 */
export const deleteStaffMember = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('staff_members').delete().eq('id', id);
  return !error;
};

export const fetchShiftSettings = async (): Promise<ShiftSettings | null> => {
  try {
    const { data } = await supabase.from('system_settings').select('data').eq('id', 'SHIFT_SETTINGS').maybeSingle();
    if (data?.data) return data.data as ShiftSettings;
  } catch (e) {}
  return null;
};

export const saveShiftSettings = async (settings: ShiftSettings): Promise<boolean> => {
  const { error = null } = await supabase.from('system_settings').upsert({ id: 'SHIFT_SETTINGS', data: settings, last_updated: new Date().toISOString() });
  return !error;
};

export const fetchConsumables = async (): Promise<ConsumableItem[]> => {
  try {
    const { data } = await supabase.from('system_settings').select('data').eq('id', 'CONSUMABLES_DB').maybeSingle();
    if (data?.data?.consumables) return data.data.consumables;
  } catch (e) {}
  return [];
};

export const saveConsumables = async (list: ConsumableItem[]): Promise<boolean> => {
  const { error = null } = await supabase.from('system_settings').upsert({ id: 'CONSUMABLES_DB', data: { consumables: list }, last_updated: new Date().toISOString() });
  return !error;
};

export const fetchAppointmentList = async (): Promise<AppointmentItem[]> => {
  try {
    const { data } = await supabase.from('system_settings').select('data').eq('id', 'APPOINTMENT_DB').maybeSingle();
    if (data?.data?.appointmentList) return data.data.appointmentList;
  } catch (e) {}
  return [];
};

export const saveAppointmentList = async (list: AppointmentItem[]): Promise<boolean> => {
  const { error = null } = await supabase.from('system_settings').upsert({ id: 'APPOINTMENT_DB', data: { appointmentList: list }, last_updated: new Date().toISOString() });
  return !error;
};

export const fetchSubstationChecklist = async (date: string): Promise<SubstationChecklistData | null> => {
  try {
    const { data } = await supabase.from('substation_checklists').select('*').eq('id', `SUB_CHECK_${date}`).maybeSingle();
    if (data) return { date: data.date, items: data.items, approvers: data.approvers, note: data.note };
  } catch (e) {}
  return null;
};

export const saveSubstationChecklist = async (data: SubstationChecklistData): Promise<boolean> => {
  const { error = null } = await supabase.from('substation_checklists').upsert({ id: `SUB_CHECK_${data.date}`, date: data.date, items: data.items, approvers: data.approvers, note: data.note, last_updated: new Date().toISOString() });
  return !error;
};

export const fetchFireFacilityLog = async (date: string): Promise<FireFacilityLogData | null> => {
  try {
    const { data } = await supabase.from('fire_facility_logs').select('*').eq('id', `FIRE_FAC_${date}`).maybeSingle();
    if (data) return { date: data.date, items: data.items, remarks: data.remarks, approvers: data.approvers };
  } catch (e) {}
  return null;
};

export const saveFireFacilityLog = async (data: FireFacilityLogData): Promise<boolean> => {
  const { error = null } = await supabase.from('fire_facility_logs').upsert({ id: `FIRE_FAC_${data.date}`, date: data.date, items: data.items, remarks: data.remarks, approvers: data.approvers, last_updated: new Date().toISOString() });
  return !error;
};

export const fetchElevatorLog = async (date: string): Promise<ElevatorLogData | null> => {
  try {
    const { data } = await supabase.from('elevator_logs').select('*').eq('id', `ELEV_LOG_${date}`).maybeSingle();
    if (data) return { date: data.date, items: data.items, remarks: data.remarks, inspector: data.inspector };
  } catch (e) {}
  return null;
};

export const saveElevatorLog = async (data: ElevatorLogData): Promise<boolean> => {
  const { error = null } = await supabase.from('elevator_logs').upsert({ id: `ELEV_LOG_${data.date}`, date: data.date, items: data.items, remarks: data.remarks, inspector: data.inspector, last_updated: new Date().toISOString() });
  return !error;
};

export const fetchGasLog = async (date: string): Promise<GasLogData | null> => {
  try {
    const { data } = await supabase.from('gas_logs').select('*').eq('id', `GAS_LOG_${date}`).maybeSingle();
    if (data) return { date: data.date, items: data.items };
  } catch (e) {}
  return null;
};

export const saveGasLog = async (data: GasLogData): Promise<boolean> => {
  const { error = null } = await supabase.from('gas_logs').upsert({ id: `GAS_LOG_${data.date}`, date: data.date, items: data.items, last_updated: new Date().toISOString() });
  return !error;
};

export const fetchSepticLog = async (date: string): Promise<SepticLogData | null> => {
  try {
    const { data } = await supabase.from('septic_logs').select('*').eq('id', `SEPTIC_LOG_${date}`).maybeSingle();
    if (data) return { date: data.date, items: data.items };
  } catch (e) {}
  return null;
};

export const saveSepticLog = async (data: SepticLogData): Promise<boolean> => {
  const { error = null } = await supabase.from('septic_logs').upsert({ id: `SEPTIC_LOG_${data.date}`, date: data.date, items: data.items, last_updated: new Date().toISOString() });
  return !error;
};

export const fetchWeeklyReport = async (date: string): Promise<WeeklyReportData | null> => {
  try {
    const { data } = await supabase.from('weekly_reports').select('*').eq('id', `WEEKLY_${date}`).maybeSingle();
    if (data) return mapFromDB("WEEKLY_", data);
  } catch (err) {}
  return null;
};

export const saveWeeklyReport = async (data: WeeklyReportData): Promise<boolean> => {
  const dbData = { id: `WEEKLY_${data.startDate}`, start_date: data.startDate, reporting_date: data.reportingDate, author: data.author, fields: data.fields, photos: data.photos, last_updated: new Date().toISOString() };
  const { error = null } = await supabase.from('weekly_reports').upsert(dbData);
  return !error;
};

export const fetchWeeklyReportList = async (): Promise<any[]> => {
  try {
    const { data } = await supabase.from('weekly_reports').select('*').order('start_date', { ascending: false });
    if (data && data.length > 0) return data.map(r => ({ key: r.id, data: mapFromDB("WEEKLY_", r) }));
  } catch (err) {}
  return [];
};

export const fetchDateRangeData = async (start: string, days: number): Promise<any[]> => {
  const end = format(addDays(parseISO(start), days), 'yyyy-MM-dd');
  return await apiFetchRange("DAILY_", start, end);
};

export const fetchExternalWorkList = async (): Promise<ConstructionWorkItem[]> => {
  try {
    const { data } = await supabase.from('construction_logs').select('*').eq('source', 'external').order('date', { ascending: false });
    if (data && data.length > 0) return data.map(w => ({ id: w.id, date: w.date, category: w.category, company: w.company, content: w.content, photos: w.photos || [] }));
  } catch (e) {}
  return [];
};

export const saveExternalWorkList = async (list: ConstructionWorkItem[]): Promise<boolean> => {
  const dbData = list.map(w => ({ id: ensureID(w.id), date: w.date, category: w.category, company: w.company, content: w.content, photos: w.photos, source: 'external' }));
  const { error = null } = await supabase.from('construction_logs').upsert(dbData);
  return !error;
};

export const fetchInternalWorkList = async (): Promise<ConstructionWorkItem[]> => {
  try {
    const { data } = await supabase.from('construction_logs').select('*').eq('source', 'internal').order('date', { ascending: false });
    if (data && data.length > 0) return data.map(w => ({ id: w.id, date: w.date, category: w.category, company: w.company, content: w.content, photos: w.photos || [] }));
  } catch (e) {}
  return [];
};

export const saveInternalWorkList = async (list: ConstructionWorkItem[]): Promise<boolean> => {
  const dbData = list.map(w => ({ id: ensureID(w.id), date: w.date, category: w.category, company: w.company, content: w.content, photos: w.photos, source: 'internal' }));
  const { error = null } = await supabase.from('construction_logs').upsert(dbData);
  return !error;
};

/**
 * 공사/작업 로그 영구 삭제
 */
export const deleteConstructionWorkItem = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('construction_logs').delete().eq('id', id);
  return !error;
};

/**
 * 소화기 데이터 삭제
 */
export const deleteFireExtinguisher = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('fire_extinguishers').delete().eq('id', id);
  return !error;
};

export const fetchConsumableRequests = async (): Promise<ConsumableRequest[]> => {
  try {
    const { data } = await supabase.from('system_settings').select('data').eq('id', 'CONSUMABLES_REQ_DB').maybeSingle();
    if (data?.data?.consumableReq) return data.data.consumableReq;
  } catch (e) {}
  return [];
};

export const saveConsumableRequests = async (list: ConsumableRequest[]): Promise<boolean> => {
  const { error = null } = await supabase.from('system_settings').upsert({ id: 'CONSUMABLE_REQ_DB', data: { consumableReq: list }, last_updated: new Date().toISOString() });
  return !error;
};

export const fetchParkingChangeList = async (): Promise<ParkingChangeItem[]> => {
  try {
    const { data } = await supabase.from('parking_changes').select('*').order('date', { ascending: false });
    if (data && data.length > 0) return data.map(p => ({ id: p.id, date: p.date, type: p.type, company: p.company, location: p.location, prev_plate: p.prev_plate, new_plate: p.new_plate, note: p.note }));
  } catch (e) {}
  return [];
};

export const saveParkingChangeList = async (list: ParkingChangeItem[]): Promise<boolean> => {
  const dbData = list.map(mapParkingChangeToDB);
  const { error = null } = await supabase.from('parking_changes').upsert(dbData);
  return !error;
};

export const fetchParkingStatusList = async (): Promise<ParkingStatusItem[]> => {
  try {
    const { data } = await supabase.from('parking_status').select('*').order('location', { ascending: true });
    if (data && data.length > 0) return data.map(p => ({ 
      id: p.id, 
      date: p.date, 
      type: p.type, 
      location: p.location, 
      company: p.company, 
      prev_plate: p.prev_plate, 
      plate_num: p.plate_num,   
      note: p.note 
    }));
  } catch (e) {}
  return [];
};

export const saveParkingStatusList = async (list: ParkingStatusItem[]): Promise<boolean> => {
  const dbData = list.map(mapParkingStatusToDB);
  const { error = null } = await supabase.from('parking_status').upsert(dbData);
  return !error;
};

/**
 * 지정주차 차량 정보 개별 삭제
 */
export const deleteParkingStatusItem = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('parking_status').delete().eq('id', id);
  return !error;
};

export const fetchParkingLayout = async (): Promise<any> => {
  try {
    const { data } = await supabase.from('system_settings').select('data').eq('id', 'PARKING_LAYOUT').maybeSingle();
    if (data?.data) return data.data;
  } catch (e) {}
  return null;
};

export const saveParkingLayout = async (layout: any): Promise<boolean> => {
  const { error = null } = await supabase.from('system_settings').upsert({ id: 'PARKING_LAYOUT', data: layout, last_updated: new Date().toISOString() });
  return !error;
};

/**
 * 협력업체 데이터 조회
 * DB 구조 변경 없이 중요 업체 여부를 판단하기 위해 note 필드의 [중요] 접두사 감지
 */
export const fetchContractors = async (): Promise<Contractor[]> => {
  try {
    const { data } = await supabase.from('contractors').select('*');
    if (data && data.length > 0) return data.map(c => {
      const isImportant = (c.note || '').startsWith('[중요] ');
      const cleanNote = isImportant ? c.note.replace('[중요] ', '') : c.note;
      
      return { 
        id: c.id, 
        name: c.name, 
        type: c.type, 
        contactPerson: c.contact_person, 
        phoneMain: c.phone_main, 
        phoneMobile: c.phone_mobile, 
        fax: c.fax, 
        note: cleanNote,
        isImportant: isImportant
      };
    });
  } catch (e) {}
  return [];
};

/**
 * 협력업체 데이터 저장
 * 수파베이스 스키마(컬럼) 변경 없이 기능을 제공하기 위해 
 * isImportant가 true일 경우 note 필드 앞에 [중요] 접두사를 붙여서 저장함
 */
export const saveContractors = async (list: Contractor[]): Promise<boolean> => {
  const dbData = list.map(c => {
    // 중요업체 체크 시 note 필드 앞에 식별자 추가
    const finalNote = c.isImportant ? `[중요] ${c.note || ''}` : (c.note || '');
    
    return { 
      id: ensureID(c.id), 
      name: c.name, 
      type: c.type, 
      contact_person: c.contactPerson, 
      phone_main: c.phoneMain, 
      phone_mobile: c.phoneMobile, 
      fax: c.fax, 
      note: finalNote
      // is_important 컬럼이 DB에 없으므로 전송 데이터에서 제외하여 오류 방지
    };
  });
  const { error = null } = await supabase.from('contractors').upsert(dbData);
  return !error;
};

/**
 * 협력업체 개별 삭제
 */
export const deleteContractor = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('contractors').delete().eq('id', id);
  return !error;
};

export const fetchMeterReading = async (month: string): Promise<MeterReadingData | null> => {
  try {
    const { data } = await supabase.from('meter_readings').select('*').eq('id', `METER_${month}`).maybeSingle();
    if (data) return mapFromDB("METER_", data);
  } catch (err) {}
  return null;
};

export const saveMeterReading = async (data: MeterReadingData): Promise<boolean> => {
  const dbData = { 
    id: `METER_${data.month}`, 
    month: data.month, 
    unit_price: data.unitPrice, 
    total_bill_input: data.totalBillInput, 
    total_usage_input: data.totalUsageInput, 
    creation_date: data.creationDate,
    items: data.items, 
    last_updated: new Date().toISOString() 
  };
  const { error = null } = await supabase.from('meter_readings').upsert(dbData);
  return !error;
};

export const fetchGeneratorCheck = async (month: string): Promise<GeneratorCheckData | null> => {
  try {
    const { data } = await supabase.from('generator_checks').select('*').eq('id', `GEN_CHECK_${month}`).maybeSingle();
    if (data) return { date: data.date, specs: data.specs, test: data.test, status: data.status, note: data.note };
  } catch (err) {}
  return null;
};

export const saveGeneratorCheck = async (data: GeneratorCheckData): Promise<boolean> => {
  const dbData = { id: `GEN_CHECK_${data.date}`, date: data.date, specs: data.specs, test: data.test, status: data.status, note: data.note, last_updated: new Date().toISOString() };
  const { error = null } = await supabase.from('generator_checks').upsert(dbData);
  return !error;
};

export const fetchSubstationLog = async (date: string, force = false): Promise<SubstationLogData | null> => {
  try {
    const { data } = await supabase.from('substation_logs').select('*').eq('id', `SUB_LOG_${date}`).maybeSingle();
    if (data) return mapFromDB("SUB_LOG_", data);
  } catch (e) {}
  return null;
};

export const saveSubstationLog = async (data: SubstationLogData): Promise<boolean> => {
  const { error = null } = await supabase.from('substation_logs').upsert({ id: `SUB_LOG_${data.date}`, date: data.date, vcb: data.vcb, acb: data.acb, power_usage: data.powerUsage, daily_stats: data.dailyStats, last_updated: new Date().toISOString() });
  return !error;
};

export const fetchTenants = async (): Promise<Tenant[]> => {
  try {
    const { data } = await supabase.from('tenants').select('*');
    if (data && data.length > 0) return data.map(t => ({ id: t.id, floor: t.floor, name: t.name, area: t.area?.toString(), contact: t.contact, refPower: t.ref_power?.toString(), note: t.note }));
  } catch (e) {}
  return [];
};

export const saveTenants = async (list: Tenant[]): Promise<boolean> => {
  const dbData = list.map(t => ({ id: ensureID(t.id), floor: t.floor, name: t.name, area: parseFloat(t.area?.replace(/,/g, '') || '0'), contact: t.contact, ref_power: parseFloat(t.refPower?.replace(/,/g, '') || '0'), note: t.note }));
  const { error = null } = await supabase.from('tenants').upsert(dbData);
  return !error;
};

export const fetchMeterPhotos = async (month: string): Promise<MeterPhotoData | null> => {
  try {
    const { data } = await supabase.from('meter_photo_records').select('*').eq('id', `METER_PHOTOS_${month}`).maybeSingle();
    if (data) return { month: data.month, items: data.items };
  } catch (e) {}
  return null;
};

export const saveMeterPhotos = async (data: MeterPhotoData): Promise<boolean> => {
  const { error = null } = await supabase.from('meter_photo_records').upsert({ id: `METER_PHOTOS_${data.month}`, month: data.month, items: data.items, last_updated: new Date().toISOString() });
  return !error;
};

export const fetchBatteryCheck = async (month: string): Promise<BatteryCheckData | null> => {
  try {
    const { data } = await supabase.from('battery_checks').select('*').eq('id', `BATTERY_${month}`).maybeSingle();
    if (data) return { month: data.month, checkDate: data.check_date, items: data.items, approvers: data.approvers };
  } catch (err) {}
  return null;
};

export const saveBatteryCheck = async (data: BatteryCheckData): Promise<boolean> => {
  const dbData = { id: `BATTERY_${data.month}`, month: data.month, check_date: data.checkDate, items: data.items, approvers: data.approvers, last_updated: new Date().toISOString() };
  const { error = null } = await supabase.from('battery_checks').upsert(dbData);
  return !error;
};

export const fetchLoadCurrent = async (month: string): Promise<LoadCurrentData | null> => {
  try {
    const { data } = await supabase.from('load_currents').select('*').eq('id', `LOAD_${month}`).maybeSingle();
    if (data) return { date: data.date, period: data.period, items: data.items };
  } catch (err) {}
  return null;
};

export const saveLoadCurrent = async (data: LoadCurrentData): Promise<boolean> => {
  const dbData = { id: `LOAD_${data.date}`, date: data.date, period: data.period, items: data.items, last_updated: new Date().toISOString() };
  const { error = null } = await supabase.from('load_currents').upsert(dbData);
  return !error;
};

export const fetchSafetyCheck = async (month: string, type: 'general' | 'ev'): Promise<SafetyCheckData | null> => {
  try {
    const { data } = await supabase.from('safety_checks').select('*').eq('id', `SAFETY_${type}_${month}`).maybeSingle();
    if (data) return { date: data.date, type: data.type as 'general' | 'ev', items: data.items, measurements: data.measurements, approver: data.approver, opinion: data.opinion };
  } catch (err) {}
  return null;
};

export const saveSafetyCheck = async (data: SafetyCheckData): Promise<boolean> => {
  const monthKey = data.date.substring(0, 7);
  const dbData = { id: `SAFETY_${data.type}_${monthKey}`, date: data.date, type: data.type, items: data.items, measurements: data.measurements, approver: data.approver, opinion: data.opinion, last_updated: new Date().toISOString() };
  const { error = null } = await supabase.from('safety_checks').upsert(dbData);
  return !error;
};

export const fetchAirEnvironmentLog = async (dateStr: string): Promise<AirEnvironmentLogData | null> => {
  try {
    const { data } = await supabase.from('air_environment_logs').select('*').eq('id', `AIR_ENV_${dateStr}`).maybeSingle();
    if (data) {
      return { 
        date: data.date, 
        emissions: data.emissions, 
        preventions: data.preventions,
        weatherCondition: data.weather_condition,
        tempMin: data.temp_min,
        tempMax: data.temp_max
      };
    }
  } catch (e) {}
  return null;
};

export const saveAirEnvironmentLog = async (data: AirEnvironmentLogData): Promise<boolean> => {
  const { error = null } = await supabase.from('air_environment_logs').upsert({ 
    id: `AIR_ENV_${data.date}`, 
    date: data.date, 
    emissions: data.emissions, 
    preventions: data.preventions,
    weather_condition: data.weatherCondition,
    temp_min: data.tempMin,
    temp_max: data.tempMax,
    last_updated: new Date().toISOString() 
  });
  return !error;
};

export const fetchWaterTankLog = async (month: string): Promise<WaterTankLogData | null> => {
  try {
    const { data } = await supabase.from('water_tank_logs').select('*').eq('id', `WATER_TANK_${month}`).maybeSingle();
    if (data) return { date: data.date, buildingName: data.building_name, location: data.location, usage: data.usage, items: data.items, inspector: data.inspector, lastUpdated: data.last_updated };
  } catch (err) {}
  return null;
};

export const saveWaterTankLog = async (data: WaterTankLogData): Promise<boolean> => {
  const dbData = { id: `WATER_TANK_${data.date.substring(0, 7)}`, date: data.date, building_name: data.buildingName, location: data.location, usage: data.usage, items: data.items, inspector: data.inspector, last_updated: new Date().toISOString() };
  const { error = null } = await supabase.from('water_tank_logs').upsert(dbData);
  return !error;
};

export const fetchChemicalLog = async (date: string): Promise<ChemicalLogData | null> => {
  try {
    const { data } = await supabase.from('chemical_logs').select('*').eq('id', `CHEM_LOG_${date}`).maybeSingle();
    if (data) return { date: data.date, items: data.items };
  } catch (e) {}
  return null;
};

export const saveChemicalLog = async (data: ChemicalLogData): Promise<boolean> => {
  const { error = null } = await supabase.from('chemical_logs').upsert({ id: `CHEM_LOG_${data.date}`, date: data.date, items: data.items, last_updated: new Date().toISOString() });
  return !error;
};

export const fetchFireExtinguisherList = async (): Promise<FireExtinguisherItem[]> => {
  try {
    const { data } = await supabase.from('fire_extinguishers').select('*').order('manage_no', { ascending: true });
    if (data && data.length > 0) return data.map(item => ({ 
      id: item.id, 
      manageNo: item.manage_no, 
      type: item.type, 
      floor: item.floor, 
      company: item.company, 
      serial_no: item.serial_no, 
      phone: item.phone, 
      cert_no: item.cert_no, 
      date: item.date, 
      remarks: item.remarks 
    }));
  } catch (err) {}
  return [];
};

export const saveFireExtinguisherList = async (list: FireExtinguisherItem[]): Promise<boolean> => {
  const dbData = list.map(mapFireExtinguisherToDB);
  const { error = null } = await supabase.from('fire_extinguishers').upsert(dbData);
  return !error;
};

export const fetchLinkedKeywords = async (type: string): Promise<string[]> => {
  try {
    const { data } = await supabase.from('system_settings').select('data').eq('id', `KEYWORDS_${type}`).maybeSingle();
    if (data?.data) return data.data as string[];
  } catch (e) {}
  return [];
};

export const saveLinkedKeywords = async (type: string, keywords: string[]): Promise<boolean> => {
  const { error = null } = await supabase.from('system_settings').upsert({ id: `KEYWORDS_${type}`, data: keywords, last_updated: new Date().toISOString() });
  return !error;
};

export const fetchFireInspectionLog = async (date: string): Promise<FireInspectionLogData | null> => {
  try {
    const { data } = await supabase.from('fire_inspection_logs').select('*').eq('id', `FIRE_INSP_${date}`).maybeSingle();
    if (data) return { date: data.date, items: data.items, inspector: data.inspector };
  } catch (e) {}
  return null;
};

export const saveFireInspectionLog = async (data: FireInspectionLogData): Promise<boolean> => {
  const { error = null } = await supabase.from('fire_inspection_logs').upsert({ id: `FIRE_INSP_${data.date}`, date: data.date, items: data.items, inspector: data.inspector, last_updated: new Date().toISOString() });
  return !error;
};

export const fetchFireHistoryList = async (): Promise<FireHistoryItem[]> => {
  try {
    const { data } = await supabase.from('fire_inspection_history').select('*').order('date', { ascending: false });
    if (data && data.length > 0) return data;
  } catch (err) {}
  return [];
};

export const saveFireHistoryList = async (list: FireHistoryItem[]): Promise<boolean> => {
  const dbData = list.map(mapFireHistoryToDB);
  const { error = null } = await supabase.from('fire_inspection_history').upsert(dbData);
  return !error;
};

export const fetchElevatorInspectionList = async (): Promise<ElevatorInspectionItem[]> => {
  try {
    const { data } = await supabase.from('elevator_inspections').select('*').order('date', { ascending: false });
    if (data && data.length > 0) return data;
  } catch (err) {}
  return [];
};

export const saveElevatorInspectionList = async (list: ElevatorInspectionItem[]): Promise<boolean> => {
  const dbData = list.map(mapElevatorInspectionToDB);
  const { error = null } = await supabase.from('elevator_inspections').upsert(dbData);
  return !error;
};

/**
 * 로고 및 직인 설정 조회
 */
export const fetchLogoSealSettings = async (): Promise<{ logo?: string; seal?: string } | null> => {
  try {
    const { data } = await supabase.from('system_settings').select('data').eq('id', 'LOGO_SEAL').maybeSingle();
    return data?.data || null;
  } catch (e) {
    return null;
  }
};

/**
 * 로고 및 직인 설정 저장
 */
export const saveLogoSealSettings = async (settings: { logo?: string; seal?: string }): Promise<boolean> => {
  try {
    const { error = null } = await supabase.from('system_settings').upsert({ 
      id: 'LOGO_SEAL', 
      data: settings, 
      last_updated: new Date().toISOString() 
    });
    return !error;
  } catch (e) {
    return false;
  }
};