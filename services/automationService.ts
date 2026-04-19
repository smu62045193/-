
import { TaskItem, ElevatorLogData, FireInspectionLogData, DutyStatus, StaffMember, AutoRegRow } from '../types';
import { HOLIDAYS } from '../constants';
import { parseISO, getDay, format, addDays, getMonth, differenceInDays } from 'date-fns';
import { fetchAutoRegSettings } from './dataService';

/**
 * 법정 고정 공휴일 목록 (MM-dd 형식)
 */
const FIXED_HOLIDAYS = [
  '01-01', // 신정
  '03-01', // 삼일절
  '05-01', // 근로자의 날
  '05-05', // 어린이날
  '06-06', // 현충일
  '08-15', // 광복절
  '10-03', // 개천절
  '10-09', // 한글날
  '12-25', // 성탄절
];

/**
 * 공휴일 여부 체크 (일요일 포함)
 */
export const isHolidayOrSunday = (date: Date): boolean => {
  const dateStr = format(date, 'yyyy-MM-dd');
  const mmdd = format(date, 'MM-dd');
  const day = getDay(date);
  
  return (
    day === 0 || 
    FIXED_HOLIDAYS.includes(mmdd) || 
    HOLIDAYS.some(h => h.date === dateStr)
  );
};

/**
 * 토요일, 일요일, 공휴일 포함 여부 체크 (휴무일)
 */
export const isNonWorkingDay = (date: Date): boolean => {
  const day = getDay(date);
  const dateStr = format(date, 'yyyy-MM-dd');
  const mmdd = format(date, 'MM-dd');
  
  return (
    day === 0 || 
    day === 6 || 
    FIXED_HOLIDAYS.includes(mmdd) || 
    HOLIDAYS.some(h => h.date === dateStr)
  );
};

/**
 * DB에서 설정된 자동 등록 항목 가져오기
 */
export const getAutomatedTasksFromDB = async (category: string, dateStr: string): Promise<TaskItem[]> => {
  const date = parseISO(dateStr);
  const day = getDay(date); // 0: 일, 1: 월, ..., 6: 토
  const isHoliday = isHolidayOrSunday(date); // 일요일 또는 공휴일 여부
  
  try {
    const settings = await fetchAutoRegSettings(category);
    const tasks: TaskItem[] = [];
    
    settings.forEach((setting: any) => {
      let shouldAdd = false;
      
      // 요일 체크
      switch(day) {
        case 0: if (setting.sun) shouldAdd = true; break;
        case 1: if (setting.mon) shouldAdd = true; break;
        case 2: if (setting.tue) shouldAdd = true; break;
        case 3: if (setting.wed) shouldAdd = true; break;
        case 4: if (setting.thu) shouldAdd = true; break;
        case 5: if (setting.fri) shouldAdd = true; break;
        case 6: if (setting.sat) shouldAdd = true; break;
      }
      
      // 공휴일 제외 체크
      const excludeHolidays = setting.excludeHolidays || setting.exclude_holidays;
      if (shouldAdd && excludeHolidays && isHoliday) {
        shouldAdd = false;
      }
      
      if (shouldAdd) {
        tasks.push({
          id: `db-auto-${category}-${setting.id}-${dateStr}`,
          content: setting.item || setting.item_name || '',
          frequency: '일일', // 기본값
          status: '완료'
        });
      }
    });
    
    return tasks;
  } catch (error) {
    console.error(`Error fetching automated tasks for ${category}:`, error);
    return [];
  }
};

/**
 * ELECTRICAL TASKS
 */
export const getAutomatedElectricalTasks = (dateStr: string): TaskItem[] => {
  // 기존 하드코딩 로직 삭제 (관리자 설정 로직으로 대체됨)
  return [];
};

/**
 * MECHANICAL TASKS
 */
export const getAutomatedMechanicalTasks = (dateStr: string): TaskItem[] => {
  // 기존 하드코딩 로직 삭제 (관리자 설정 로직으로 대체됨)
  return [];
};

/**
 * FIRE TASKS
 */
export const getAutomatedFireTasks = (dateStr: string, logData?: FireInspectionLogData): TaskItem[] => {
  const tasks: TaskItem[] = [];
  // 기존 하드코딩 로직 삭제 (관리자 설정 로직으로 대체됨)
  
  // 단, 점검표(FireInspectionLogData)에서 연동되는 '불량' 항목은 유지
  if (logData) {
    logData.items.forEach(item => {
      if (item.result === '불량') {
        tasks.push({ id: `auto-fire-log-${item.id}`, content: `[소방점검] ${item.category} - ${item.content}: 불량 (${item.remarks || '조치 필요'})`, frequency: '일일', status: '진행중' });
      }
    });
  }
  return tasks;
};

/**
 * ELEVATOR TASKS
 */
export const getAutomatedElevatorTasks = (dateStr: string, logData?: ElevatorLogData): TaskItem[] => {
  const tasks: TaskItem[] = [];
  // 기존 하드코딩 로직 삭제 (관리자 설정 로직으로 대체됨)

  // 점검표(ElevatorLogData)에서 연동되는 '불량/휴지' 항목은 유지
  if (logData) {
    const evLabels = ['1호기', '2호기', '3호기', '4호기', '5호기'];
    const evKeys = ['ev1', 'ev2', 'ev3', 'ev4', 'ev5'] as const;
    logData.items.forEach(item => {
      evKeys.forEach((key, idx) => {
        const result = item.results[key];
        if (result === '불량' || result === '휴지') {
          tasks.push({ id: `auto-ev-fault-${item.id}-${key}-${dateStr}`, content: `[${evLabels[idx]}] ${item.content} - ${result}${item.note ? ` (${item.note})` : ''}`, frequency: '일일', status: '진행중' });
        }
      });
    });
  }
  return tasks;
};

/**
 * PARKING TASKS
 */
export const getAutomatedParkingTasks = (dateStr: string): TaskItem[] => {
  // 기존 하드코딩 로직 삭제 (관리자 설정 로직으로 대체됨)
  return [];
};

/**
 * SECURITY TASKS
 */
export const getAutomatedSecurityTasks = (dateStr: string): TaskItem[] => {
  // 기존 하드코딩 로직 삭제 (관리자 설정 로직으로 대체됨)
  return [];
};

/**
 * CLEANING TASKS
 */
export const getAutomatedCleaningTasks = (dateStr: string): TaskItem[] => {
  // 기존 하드코딩 로직 삭제 (관리자 설정 로직으로 대체됨)
  return [];
};
