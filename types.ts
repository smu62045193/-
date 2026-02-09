
import { ReactNode } from 'react';

export enum MenuId {
  DASHBOARD = 'DASHBOARD',
  WORK_LOG = 'WORK_LOG',
  SCHEDULE = 'SCHEDULE', 
  WEEKLY_WORK = 'WEEKLY_WORK',
  ELEC_CHECK = 'ELEC_CHECK',
  MECH_CHECK = 'MECH_CHECK',
  FIRE_CHECK = 'FIRE_CHECK',
  ELEVATOR_CHECK = 'ELEVATOR_CHECK',
  PARKING_CHECK = 'PARKING_CHECK',
  CONSUMABLES = 'CONSUMABLES',
  CONSTRUCTION = 'CONSTRUCTION',
  APPOINTMENTS = 'APPOINTMENTS',
  STAFF = 'STAFF',
  CONTRACTORS = 'CONTRACTORS',
}

export interface MenuItem {
  id: MenuId;
  label: string;
  icon?: ReactNode;
  subItems?: string[];
}

export interface WeatherData {
  condition: string;
  tempCurrent: number;
  tempMin: number;
  tempMax: number;
  icon: string;
  sourceUrl?: string;
  sourceTitle?: string;
}

export interface DutyStatus {
  day: string;
  night: string;
  off: string;
  vacation: string;
  deputy?: string; // 대리
  chief?: string;  // 주임
  leader?: string; // 반장
  shiftMode?: '2-shift' | '3-shift' | 'manual'; // 교대 모드
  baseDate?: string; // 순환 기준일
}

export interface ShiftSettings {
  mode: '2-shift' | '3-shift' | 'manual';
  baseDate: string;
  seedOrder: string[]; // 기준일 당시의 이름 순서 (이 순서대로 회전)
}

export interface UtilityUsage {
  electricity: string; // Usage for substation
  hvacGas: string;
  boilerGas: string;
}

// New interfaces for detailed work logs
export interface TaskItem {
  id: string;
  content: string;
  frequency: '일일' | '주간' | '월간';
  status?: '진행중' | '완료'; // Only used for 'Today'
}

export interface ScheduleItem {
  id: string;
  date: string; // YYYY-MM-DD
  category: string; // [전기]...
  content: string;
}

export interface LogCategory {
  today: TaskItem[];
  tomorrow: TaskItem[];
}

export interface ChemicalStatusItem {
  prev: string;
  incoming: string;
  used: string;
  stock: string;
}

export interface MechanicalChemicals {
  seed: ChemicalStatusItem;
  sterilizer: ChemicalStatusItem;
}

export interface WorkLogData {
  scheduled: ScheduleItem[]; 
  electrical: LogCategory;
  substation: LogCategory;
  mechanical: LogCategory;
  mechanicalChemicals?: MechanicalChemicals; // 기계 탭 약품 현황
  hvac: LogCategory;
  boiler: LogCategory;
  fire: LogCategory;
  elevator: LogCategory;
  parking: LogCategory;
  security: LogCategory;
  cleaning: LogCategory;
  handover: LogCategory;
}

export interface DailyData {
  date: string; // YYYY-MM-DD
  facilityDuty: DutyStatus;
  securityDuty: DutyStatus;
  utility: UtilityUsage;
  workLog: WorkLogData;
  lastUpdated?: string; // ISO String for sync tracking
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

// Staff Types
export type StaffCategory = '시설' | '경비' | '미화' | '현장대리인';

export interface StaffMember {
  id: string;
  category: StaffCategory;
  jobTitle: string; // New field for Job Title (직책)
  birthDate?: string; // 생년월일
  joinDate: string; // YYYY-MM-DD
  resignDate: string; // YYYY-MM-DD
  name: string;
  phone: string;
  area: string;
  note: string;
  photo?: string; // Base64 string for photo
}

// Weekly Report Types
export interface WeeklyWorkPhoto {
  id: string;
  dataUrl: string; // Base64
  title: string; // Photo Title / Location
  description: string;
}

export interface WeeklyFieldReport {
  thisWeek: string; // Multiline text
  results: string;  // Inspection Results (점검결과)
  nextWeek: string; // Multiline text
}

export interface WeeklyReportData {
  startDate: string; // Monday of the week
  reportingDate: string; // The Friday (or prev workday)
  author: string;
  fields: {
    electrical: WeeklyFieldReport;
    mechanical: WeeklyFieldReport;
    fire: WeeklyFieldReport;
    elevator: WeeklyFieldReport;
    parking: WeeklyFieldReport;
    security: WeeklyFieldReport;
    cleaning: WeeklyFieldReport;
    handover: WeeklyFieldReport; // 특이사항
  };
  photos: WeeklyWorkPhoto[];
  lastUpdated?: string;
}

// Consumables Items
export interface ConsumableItem {
  id: string;
  date: string;      // 날짜
  category: string;  // 구분 (전기, 소방...)
  itemName: string;  // 품명
  modelName: string; // 모델명
  details: string;   // 내역
  inQty: string;     // 입고
  outQty: string;    // 사용
  stockQty: string;  // 재고
  unit: string;      // 단위
  note: string;      // 비고
  minStock?: string; // 적정재고 (부족자재 자동판단 기준)
}

export interface ConsumableRequestItem {
  id: string;
  category?: string; // '전기', '소방', '기계', '공용'
  itemName: string;
  stock?: string;    // 재고
  qty: string;       // 수량 (with unit if needed)
  receivedDate?: string; // 입고일
  remarks: string;   // 비고
  
  // Legacy/Optional fields
  spec?: string; 
  unit?: string;
  price?: string; 
  amount?: number; 
  purpose?: string; 
}

export interface ConsumableRequest {
  id: string;
  date: string;
  category?: string; // Legacy field, kept for compatibility
  department: string;
  drafter: string; // 기안자
  items: ConsumableRequestItem[];
  totalAmount: number;
  status?: string;
}

// Parking Types
export interface ParkingChangeItem {
  id: string;
  date: string;      // 날짜
  type: '추가' | '변경'; // 구분
  company: string;   // 업체
  location: string;  // 위치
  prevPlate: string; // 변경전차량번호
  newPlate: string;  // 변경차량번호
  note: string;      // 비고
}

export interface ParkingStatusItem {
  id: string;
  date: string;      // 날짜 (New)
  type?: string;     // 구분 (New)
  location: string;  // 위치 (예: B2-1)
  company: string;   // 업체명
  prevPlate?: string;// 변경전차량번호 (New)
  plateNum: string;  // 변경후차량번호 (Current)
  note: string;      // 비고
}

// Contractor Types
export interface Contractor {
  id: string;
  name: string;      // 업체명
  type: string;      // 업종 (전기, 기계, 소방, 승강기 등)
  contactPerson: string; // 담당자
  phoneMain: string;   // 대표번호 (New)
  phoneMobile: string; // 핸드폰 (New)
  fax: string;         // 팩스 (New)
  note: string;      // 비고
  isImportant?: boolean; // 중요업체 여부
}

// Emergency Generator Types
export interface GeneratorSpec {
  manufacturer: string;
  year: string;
  serialNo: string;
  type: string;
  output: string;
  voltage: string;
  current: string;
  rpm: string;
  method: string;
  location: string;
}

export interface GeneratorTest {
  checkDate: string;
  dayName: string;
  reason: string;
  startTime: string;
  endTime: string;
  usedTime: string;
  monthlyRunTime: string;
  monthlyRunCount: string;
  totalRunTime: string;
  fuelUsed: string;
  fuelTotal: string;
  
  // Voltages
  voltsRS: string;
  voltsRN: string;
  voltsST: string;
  voltsSN: string;
  voltsTR: string;
  voltsTN: string;

  // Currents
  ampR: string;
  ampS: string;
  ampT: string;

  // Etc
  oilTemp: string;
  oilPressure: string;
  rpmValue: string;
  batteryGravityValue: string;
}

export interface GeneratorStatus {
  coolingWater: '양호' | '불량';
  startCircuit: '양호' | '불량';
  fuelStatus: '양호' | '불량';
  afterRun: '양호' | '불량';
  panel: '양호' | '불량';
  engine: '양호' | '불량';
  duringRun: '양호' | '불량';
  afterStop: '양호' | '불량';
  battery: '양호' | '불량';
  gravity: '양호' | '불량';
}

export interface GeneratorCheckData {
  date: string; // Key (YYYY-MM)
  specs: GeneratorSpec;
  test: GeneratorTest;
  status: GeneratorStatus;
  note: string;
}

// Substation Log Types
export interface VcbReadings {
  main: { v: string; a: string; pf: string; hz: string };
  tr1: { v: string; a: string; pf: string };
  tr2: { v: string; a: string; pf: string };
  tr3: { v: string; a: string; pf: string };
}

export interface AcbReadings {
  acb1: { v: string; a: string; kw: string };
  acb2: { v: string; a: string; kw: string };
  acb3: { v: string; a: string; kw: string };
  trTemp: { tr1: string; tr2: string; tr3: string };
}

export interface PowerUsageReadings {
  activeMid: string;
  activeMax: string;
  activeLight: string;
  reactiveMid: string;
  reactiveMax: string;
}

export interface DailyStats {
  activePower: string;
  reactivePower: string;
  monthTotal: string;
  maxPower: string;
  powerFactor: string;
  loadFactor: string;
  demandFactor: string;
}

export interface SubstationLogData {
  date: string;
  vcb: {
    time9: VcbReadings;
    time21: VcbReadings;
  };
  acb: {
    time9: AcbReadings;
    time21: AcbReadings;
  };
  powerUsage: {
    prev: PowerUsageReadings;
    curr: PowerUsageReadings;
    usage: PowerUsageReadings;
  };
  dailyStats: DailyStats;
}

// Meter Reading Types
export interface Tenant {
  id: string;
  floor: string;
  name: string; // 입주사명
  area: string; // 전용면적
  contact: string; // 연락처
  refPower?: string; // 기준전력 (월)
  note: string; // 비고
}

export interface MeterReadingItem {
  id: string;
  floor: string;
  tenant: string;
  area: string;
  refPower?: string; // 기준전력 (월)
  currentReading: string;
  prevReading: string;
  multiplier: string;
  note: string;
}

export interface MeterReadingData {
  month: string; // YYYY-MM
  unitPrice?: string; // kWh당 단가
  totalBillInput?: string; // 수동 입력 총액
  totalUsageInput?: string; // 수동 입력 총사용량
  creationDate?: string; // 내역서 작성일 (YYYY-MM-DD)
  items: MeterReadingItem[];
  lastUpdated?: string;
}

export interface MeterPhotoItem {
  id: string;
  floor: string;
  tenant: string;
  reading: string;
  date: string;
  type: '일반' | '특수'; // 구분 추가
  photo: string; // Drive URL or Base64
}

export interface MeterPhotoData {
  month: string; // YYYY-MM
  items: MeterPhotoItem[];
}

// Battery Check Types
export interface BatteryItem {
  id: string;
  label: string;       
  manufacturer: string; 
  manufDate: string;   
  spec: string;        
  voltage: string;     
  remarks: string;     
  section?: 'rectifier' | 'battery' | 'generator';
}

export interface BatteryCheckData {
  month: string; // YYYY-MM
  checkDate: string; 
  items: BatteryItem[];
  approvers: {
    staff: string;
    assistant: string;
    manager: string;
    director: string;
  };
}

// Substation Checklist Types
export interface SubstationCheckItem {
  id: string;
  category: string;
  label: string;
  /**
   * Fixed Type Error: Added empty string to allow initial state values in dataService and SubstationChecklistLog.
   */
  result: '양호' | '불량' | '';
}

export interface SubstationChecklistData {
  date: string; // YYYY-MM-DD
  items: SubstationCheckItem[];
  approvers: {
    checker: string;
    manager: string;
  };
  note: string;
}

// Load Current Types
export interface LoadCurrentItem {
  id: string;
  floor: string;      // 추가된 필드
  // Left Side
  targetL: string;    // 점검대상(좌)
  orderL: string;     // 순서
  capacityL: string;  // 용량(A)
  valueL: string;     // 측정치
  noteL: string;      // 비고

  // Right Side
  orderR: string;     // 순서
  capacityR: string;  // 용량(A)
  valueR: string;     // 측정치
  noteR: string;      // 비고
}

export interface LoadCurrentData {
  date: string; // YYYY-MM (Key)
  period?: string; // 출력용 점검일자 (예: 2026년 1월 12~13일)
  items: LoadCurrentItem[];
  lastUpdated?: string;
}

// Safety Check Types (직무고시)
export interface SafetyCheckItem {
  id: string;
  category: string;
  content: string;
  result: '적합' | '부적합' | '요주의' | '해당없음';
  measure: string; // 조치사항
}

export interface SafetyCheckMeasurements {
  lv1: { v_r: string; v_s: string; v_t: string; v_n: string; i_r: string; i_s: string; i_t: string; i_n: string; l_r: string; l_s: string; l_t: string; l_n: string };
  lv3: { v_r: string; v_s: string; v_t: string; v_n: string; i_r: string; i_s: string; i_t: string; i_n: string; l_r: string; l_s: string; l_t: string; l_n: string };
  lv5: { v_r: string; v_s: string; v_t: string; v_n: string; i_r: string; i_s: string; i_t: string; i_n: string; l_r: string; l_s: string; l_t: string; l_n: string };
  pf: { day: string; night: string };
  power: { active: string; reactive: string; max: string; multiplier: string };
}

export interface SafetyCheckData {
  date: string; // YYYY-MM-DD
  type: 'general' | 'ev'; // 전기설비 or 전기차
  items: SafetyCheckItem[];
  measurements?: SafetyCheckMeasurements; // For General Inspection record
  approver: string; // 점검자
  opinion?: string; // 종합의견 필드 추가
  lastUpdated?: string;
}

// HVAC Log Types
export interface HvacLogItem {
  time10: string;
  time15: string;
}

export interface HvacLogOperationRow {
    id: string;
    runTime: string;
}

export interface HvacLogData {
  date: string;
  unitNo: string; // 호기
  
  // Main Table Items
  inletTempColdHot: HvacLogItem; // 냉, 온수 입구온도
  outletTempColdHot: HvacLogItem; // 냉, 온수 출구온도
  outletPressColdHot: HvacLogItem; // 냉, 온수 출구압력
  inletTempCooling: HvacLogItem; // 냉각수 입구온도
  outletTempCooling: HvacLogItem; // 냉각수 출구온도
  outletPressCooling: HvacLogItem; // 냉각수 출구압력
  tempLowGen: HvacLogItem; // 저온 재생기 온도
  tempHighGen: HvacLogItem; // 고온 재생기 온도
  tempExhaust: HvacLogItem; // 배기 가스 온도
  pressGen: HvacLogItem; // 재생기 압력
  pressGas1: HvacLogItem; // 1차 가스 압력
  pressGas2: HvacLogItem; // 2차 가스 압력
  valveOpening: HvacLogItem; // 제어 밸브 개도
  
  hvacLogs: HvacLogOperationRow[]; // 가동 시간 행 (시작~종료)
  totalRunTime: string; // 총 가동 시간

  // Gas Usage
  gas: {
      prev: string;
      curr: string;
      usage: string;
      monthTotal: string;
  };

  // Sterilizer
  sterilizer: {
      prevStock: string;
      inQty: string;
      usedQty: string;
      stock: string;
  };

  lastUpdated?: string;
}

// Boiler Log Types
export interface BoilerLogItem {
  id: string; // identifier for the row
  runTime: string; // 가동시간
  gasPressure1: string; // 가스압력 1차
  gasPressure2: string; // 가스압력 2차
  steamPressure: string; // 증기압
  exhaustTemp: string; // 배기가스 온도
  supplyTemp: string; // 급수 온도
  hotWaterTemp: string; // 급탕 온도
  waterLevel: string; // 수위 상태
}

export interface BoilerLogData {
  date: string;
  logs: BoilerLogItem[]; // Array of log rows (usually 3 rows)
  totalRunTime: string; // 총 가동 시간

  // Gas Usage
  gas: {
      prev: string;
      curr: string;
      usage: string;
      monthTotal: string;
  };

  // Chemicals
  salt: {
      prevStock: string;
      inQty: string;
      usedQty: string;
      stock: string;
  };
  cleaner: {
      prevStock: string;
      inQty: string;
      usedQty: string;
      stock: string;
  };
  
  lastUpdated?: string;
}

// Air Environment Log Types
export interface AirEmissionItem {
  id: string;
  outletNo: string;
  facilityName: string;
  runTime: string; // 가동 시간 (starts with ~ usually)
  remarks: string;
}

export interface AirPreventionItem {
  id: string;
  facilityName: string;
  location: string;
  gasUsage: string;
  pollutants: string;
}

export interface AirEnvironmentLogData {
  date: string;
  emissions: AirEmissionItem[];
  preventions: AirPreventionItem[];
  lastUpdated?: string;
  weatherCondition?: string; // 추가된 필드
  tempMin?: string;          // 추가된 필드
  tempMax?: string;          // 추가된 필드
}

// Water Tank Log Types
export interface WaterTankCheckItem {
  id: string;
  category: string; // 조사사항
  criteria: string[]; // 점검기준 (Array of strings for multiple criteria lines)
  results: ('O' | 'X' | '')[]; // 적부 (각 점검기준에 대응)
}

export interface WaterTankLogData {
  date: string;
  buildingName: string;
  location: string;
  usage: string;
  items: WaterTankCheckItem[];
  inspector: string; // 점검자
  lastUpdated?: string;
}

// Chemical Log Types
export interface ChemicalLogItem {
  id: string;
  name: string; // 약품명
  unit: string; // 단위
  prevStock: string; // 전일재고
  received: string; // 입고
  used: string; // 투입/사용
  currentStock: string; // 현재재고
  remark: string; // 비고
}

export interface ChemicalLogData {
  date: string;
  items: ChemicalLogItem[];
  lastUpdated?: string;
}

// Gas Daily Inspection Types
export interface GasCheckItem {
  id: string;
  category: string; // 구분
  content: string; // 점검내용
  result: '양호' | '불량' | ''; // 점검결과
}

export interface GasLogData {
  date: string;
  items: GasCheckItem[];
  lastUpdated?: string;
}

// Septic Tank Daily Inspection Types
export interface SepticCheckItem {
  id: string;
  content: string; // 일일 점검 내용
  result: '양호' | '불량' | ''; // 점검결과
}

export interface SepticLogData {
  date: string;
  items: SepticCheckItem[];
  lastUpdated?: string;
}

// Fire Extinguisher Log Types
export interface FireExtinguisherItem {
  id: string;
  manageNo: string; // 관리번호
  type: string;     // 종류
  floor: string;    // 층별
  company: string;  // 정비업체
  serialNo: string; // 제조번호
  phone: string;    // 전화번호
  certNo: string;   // 검정번호
  date: string;     // 일자
  remarks: string;  // 비고
}

// Fire Inspection Log Types (New)
export interface FireInspectionItem {
  id: string;
  category: string;
  content: string;
  result: '양호' | '불량' | '';
  remarks: string;
}

export interface FireInspectionLogData {
  date: string;
  items: FireInspectionItem[];
  inspector: string;
  lastUpdated?: string;
}

// Fire Facility Inspection Log Types
export interface FireFacilityCheckItem {
  id: string;
  category: string; // 구분 (소화설비, 경보설비 등)
  content: string;  // 점검항목
  result: '양호' | '불량' | ''; // 점검결과
  remarks: string;  // 비고
}

export interface FireFacilityLogData {
  date: string;
  items: FireFacilityCheckItem[];
  remarks: string; // 하단 통합 특이사항
  approvers: {
    inspector: string; // 점검자
    manager: string;   // 관리자
  };
  lastUpdated?: string;
}

// 소방 점검 이력 타입
export interface FireHistoryItem {
  id: string;
  date: string;
  company: string;
  content: string;
  note: string;
}

// Elevator Daily Log Types
export type ElevatorResult = '양호' | '불량' | '휴지' | '';

export interface ElevatorLogItem {
  id: string;
  category: string; // 구분
  content: string;  // 점검항목
  results: {
    ev1: ElevatorResult;
    ev2: ElevatorResult;
    ev3: ElevatorResult;
    ev4: ElevatorResult;
    ev5: ElevatorResult;
  };
  note: string; // 비고
}

export interface ElevatorLogData {
  date: string;
  items: ElevatorLogItem[];
  remarks: string; // 하단 특이사항 전체 기록 필드
  inspector: string;
  lastUpdated?: string;
}

// Elevator Inspection History Types
export interface ElevatorInspectionItem {
  id: string;
  date: string;    // 날짜
  company: string; // 업체
  content: string; // 내용
  note: string;    // 비고
}

// Construction / Work Logs
export interface WorkPhoto {
  id: string;
  dataUrl: string; // Base64 string
  fileName: string;
}

export interface ConstructionWorkItem {
  id: string;
  date: string;        // YYYY-MM-DD
  category: string;    // 구분 (전기, 설비, 영선 등)
  company?: string;    // 업체명 (Optional, mainly for external)
  content: string;     // 내용
  photos: WorkPhoto[]; // Max 10 photos
}

// Appointment Status Types
export interface AppointmentItem {
  id: string;
  category: string;      // 전기, 기계, 소방, 승강기
  title: string;         // 직책
  name: string;          // 선임자
  agency: string;        // 기관
  phone: string;         // 전화번호
  fax: string;           // 팩스번호
  appointmentDate: string; // 선임일자
  trainingDate: string;    // 교육일자
  license: string;       // 자격증
  note: string;          // 비고
}
