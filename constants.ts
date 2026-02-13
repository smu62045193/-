import { MenuId, MenuItem, Holiday } from './types';

// =================================================================================================
// [중요] 구글 앱스 스크립트 배포 후 발급받은 '웹 앱 URL'을 아래에 붙여넣으세요.
// =================================================================================================
export const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzG87NevLfuqw1wgJZGp3x0eMREtXjb1y95xodqfbxTrFqLCd1hKpIYggIwydJJyWC9/exec"; 

export const MENU_ITEMS: MenuItem[] = [
  { id: MenuId.DASHBOARD, label: '대시보드' },
  { id: MenuId.WORK_LOG, label: '업무일지' },
  { id: MenuId.WEEKLY_WORK, label: '주간업무' },
  { id: MenuId.CONSTRUCTION, label: '공사/작업', subItems: ['외부업체', '시설직'] },
  { id: MenuId.ELEC_CHECK, label: '전기점검', subItems: ['계량기검침', '비상발전기', '밧데리', '부하전류', '전기설비점검', '전기자동차'] },
  { id: MenuId.MECH_CHECK, label: '기계점검', subItems: ['저수조위생점검'] },
  { id: MenuId.FIRE_CHECK, label: '소방점검', subItems: ['소방점검이력', '소화기 관리대장'] },
  { id: MenuId.ELEVATOR_CHECK, label: '승강기점검', subItems: ['승강기점검이력'] },
  { id: MenuId.PARKING_CHECK, label: '주차점검', subItems: ['지정주차차량현황', '지정주차변경이력', '지정주차차량위치'] },
  { id: MenuId.CONSUMABLES, label: '소모품관리', subItems: ['관리대장', '자재신청서'] },
  { id: MenuId.APPOINTMENTS, label: '선임현황' },
  { id: MenuId.STAFF, label: '직원관리' },
  { id: MenuId.CONTRACTORS, label: '협력업체' },
];

export const WORK_LOG_TABS = [
  { id: 'electrical', label: '전기' },
  { id: 'checklist', label: '점검표' },
  { id: 'substation', label: '수변전반' },
  { id: 'mechanical', label: '기계' },
  { id: 'mech_facility', label: '기계설비' },
  { id: 'air_env', label: '대기환경' },
  { id: 'fire', label: '소방' },
  { id: 'elevator', label: '승강기' },
  { id: 'park_sec_clean', label: '주차/경비/미화' },
  { id: 'handover', label: '특이사항' },
];

// Variable Holidays (Lunar New Year, Chuseok, Buddha's Birthday and Substitutes) 2024-2033
export const HOLIDAYS: Holiday[] = [
  // 2024
  { date: '2024-02-09', name: '설날 연휴' },
  { date: '2024-02-10', name: '설날' },
  { date: '2024-02-11', name: '설날 연휴' },
  { date: '2024-02-12', name: '대체공휴일' },
  { date: '2024-04-10', name: '국회의원선거' },
  { date: '2024-05-06', name: '대체공휴일' },
  { date: '2024-05-15', name: '부처님오신날' },
  { date: '2024-09-16', name: '추석 연휴' },
  { date: '2024-09-17', name: '추석' },
  { date: '2024-09-18', name: '추석 연휴' },
  
  // 2025
  { date: '2025-01-28', name: '설날 연휴' },
  { date: '2025-01-29', name: '설날' },
  { date: '2025-01-30', name: '설날 연휴' },
  { date: '2025-03-03', name: '대체공휴일' },
  { date: '2025-05-05', name: '어린이날/부처님오신날' },
  { date: '2025-05-06', name: '대체공휴일' },
  { date: '2025-10-05', name: '추석' },
  { date: '2025-10-06', name: '추석 연휴' },
  { date: '2025-10-07', name: '추석 연휴' },
  { date: '2025-10-08', name: '대체공휴일' },

  // 2026
  { date: '2026-02-16', name: '설날 연휴' },
  { date: '2026-02-17', name: '설날' },
  { date: '2026-02-18', name: '설날 연휴' },
  { date: '2026-05-24', name: '부처님오신날' },
  { date: '2026-05-25', name: '대체공휴일' },
  { date: '2026-09-24', name: '추석 연휴' },
  { date: '2026-09-25', name: '추석' },
  { date: '2026-09-26', name: '추석 연휴' },
  { date: '2026-09-27', name: '대체공휴일' },

  // 2027
  { date: '2027-02-06', name: '설날 연휴' },
  { date: '2027-02-07', name: '설날' },
  { date: '2027-02-08', name: '설날 연휴' },
  { date: '2027-02-09', name: '대체공휴일' },
  { date: '2027-05-13', name: '부처님오신날' },
  { date: '2027-09-14', name: '추석 연휴' },
  { date: '2027-09-15', name: '추석' },
  { date: '2027-09-16', name: '추석 연휴' },

  // 2028
  { date: '2028-01-26', name: '설날 연휴' },
  { date: '2028-01-27', name: '설날' },
  { date: '2028-01-28', name: '설날 연휴' },
  { date: '2028-05-02', name: '부처님오신날' },
  { date: '2028-10-02', name: '추석 연휴' },
  { date: '2028-10-03', name: '추석/개천절' },
  { date: '2028-10-04', name: '추석 연휴' },
  { date: '2028-10-05', name: '대체공휴일' },

  // 2029
  { date: '2029-02-12', name: '설날 연휴' },
  { date: '2029-02-13', name: '설날' },
  { date: '2029-02-14', name: '설날 연휴' },
  { date: '2029-05-20', name: '부처님오신날' },
  { date: '2029-05-21', name: '대체공휴일' },
  { date: '2029-09-21', name: '추석 연휴' },
  { date: '2029-09-22', name: '추석' },
  { date: '2029-09-23', name: '추석 연휴' },
  { date: '2029-09-24', name: '대체공휴일' },

  // 2030
  { date: '2030-02-02', name: '설날 연휴' },
  { date: '2030-02-03', name: '설날' },
  { date: '2030-02-04', name: '설날 연휴' },
  { date: '2030-02-05', name: '대체공휴일' },
  { date: '2030-05-09', name: '부처님오신날' },
  { date: '2030-09-11', name: '추석 연휴' },
  { date: '2030-09-12', name: '추석' },
  { date: '2030-09-13', name: '추석 연휴' },

  // 2031
  { date: '2031-01-22', name: '설날 연휴' },
  { date: '2031-01-23', name: '설날' },
  { date: '2031-01-24', name: '설날 연휴' },
  { date: '2031-05-28', name: '부처님오신날' },
  { date: '2031-09-30', name: '추석 연휴' },
  { date: '2031-10-01', name: '추석' },
  { date: '2031-10-02', name: '추석 연휴' },

  // 2032
  { date: '2032-02-10', name: '설날 연휴' },
  { date: '2032-02-11', name: '설날' },
  { date: '2032-02-12', name: '설날 연휴' },
  { date: '2032-05-16', name: '부처님오신날' },
  { date: '2032-05-17', name: '대체공휴일' },
  { date: '2032-09-18', name: '추석 연휴' },
  { date: '2032-09-19', name: '추석' },
  { date: '2032-09-20', name: '추석 연휴' },
  { date: '2032-09-21', name: '대체공휴일' },

  // 2033
  { date: '2033-01-30', name: '설날 연휴' },
  { date: '2033-01-31', name: '설날' },
  { date: '2033-02-01', name: '설날 연휴' },
  { date: '2033-05-06', name: '부처님오신날' },
  { date: '2033-10-07', name: '추석 연휴' },
  { date: '2033-10-08', name: '추석' },
  { date: '2033-10-09', name: '추석/한글날' },
  { date: '2033-10-10', name: '대체공휴일' },
];