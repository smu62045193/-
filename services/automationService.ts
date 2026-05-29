
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
  '07-17', // 제헌절
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
 * 매월 첫 번째 월요일을 기준(1주차의 첫 날인 월요일)으로 날짜의 마일리안 주차를 계산합니다.
 * 첫 번째 월요일 이전의 일은 주차가 없는 것으로 판단해 0을 반환합니다.
 */
export const getCustomWeekOccurrence = (d: Date): number => {
  const currentYear = d.getFullYear();
  const currentMonthNum = d.getMonth();
  
  // 첫 번째 월요일 찾기 (1일 ~ 7일 중 요일이 월요일(1)인 날)
  let m1 = 1;
  for (let dayNum = 1; dayNum <= 7; dayNum++) {
    const tempDate = new Date(currentYear, currentMonthNum, dayNum);
    if (tempDate.getDay() === 1) { // 1: 월요일
      m1 = dayNum;
      break;
    }
  }

  const dateVal = d.getDate();
  if (dateVal < m1) {
    return 0; // 첫 번째 월요일 이전은 주차 없음
  }

  return Math.floor((dateVal - m1) / 7) + 1;
};

/**
 * 월간 자동등록 설정이 특정 날짜에 해당하는지 체크
 */
export const isMonthlySettingMatched = (setting: any, date: Date): boolean => {
  // Parse item name and metadata if it is stored as JSON
  const itemText = setting.item || setting.item_name || '';
  let weekSelect = '1주차';
  let specificDay = '';
  let prevDay = false;
  let nextDay = false;

  if (itemText.includes('__MONTHLY_JSON__')) {
    const parts = itemText.split('__MONTHLY_JSON__');
    try {
      const meta = JSON.parse(parts[1]);
      weekSelect = meta.weekSelect || '1주차';
      specificDay = meta.specificDay || '';
      prevDay = !!meta.prevDay;
      nextDay = !!meta.nextDay;
    } catch (e) {
      console.error('Failed to parse monthly json:', e);
    }
  } else {
    // If it's not JSON format, it's not a monthly setting
    return false;
  }

  const checkScheduleForDate = (d: Date): boolean => {
    const dDay = getDay(d);
    
    // 1. Day of week check
    let dayMatched = false;
    switch(dDay) {
      case 0: if (setting.sun) dayMatched = true; break;
      case 1: if (setting.mon) dayMatched = true; break;
      case 2: if (setting.tue) dayMatched = true; break;
      case 3: if (setting.wed) dayMatched = true; break;
      case 4: if (setting.thu) dayMatched = true; break;
      case 5: if (setting.fri) dayMatched = true; break;
      case 6: if (setting.sat) dayMatched = true; break;
    }

    if (weekSelect === '일자지정') {
      const targetDay = parseInt(specificDay, 10);
      return !isNaN(targetDay) && d.getDate() === targetDay;
    }

    if (weekSelect === '말일') {
      // Check if d is the last day of its month
      const tomorrow = addDays(d, 1);
      return tomorrow.getDate() === 1;
    }

    // Week based: '1주차', '2주차', '3주차', '4주차', '5주차', '월초'
    if (dayMatched) {
      // 해당 요일의 월 기준 등장 횟수 (매월 첫 번째 월요일을 기준으로 주차 계산)
      const occurrence = getCustomWeekOccurrence(d);
      if (occurrence === 0) return false; // 첫 번째 월요일 이전은 주차 없음
      switch (weekSelect) {
        case '월초': return occurrence === 1;
        case '1주차': return occurrence === 1;
        case '2주차': return occurrence === 2;
        case '3주차': return occurrence === 3;
        case '4주차': return occurrence === 4;
        case '5주차': return occurrence === 5;
      }
    }

    if (weekSelect === '월초') {
      return d.getDate() === 1;
    }

    return false;
  };

  // Exclude holiday check
  const excludeHolidays = !!(setting.excludeHolidays || setting.exclude_holidays);

  if (excludeHolidays) {
    if (isNonWorkingDay(date)) {
      // If today is a weekend/holiday, we never run today (the scheduled task is shifted)
      return false;
    }

    // Today is a working day.
    // Find all scheduled dates in this specific month (same month and year as 'date')
    const currentYear = date.getFullYear();
    const currentMonthNum = date.getMonth();
    const daysInMonth = new Date(currentYear, currentMonthNum + 1, 0).getDate();

    const scheduledDates: Date[] = [];
    for (let dNum = 1; dNum <= daysInMonth; dNum++) {
      const testDate = new Date(currentYear, currentMonthNum, dNum);
      if (checkScheduleForDate(testDate)) {
        scheduledDates.push(testDate);
      }
    }

    // For each potential scheduled date S, check if its actual run date under holiday shifting maps to today
    for (const S of scheduledDates) {
      let runDate: Date = S;

      if (isNonWorkingDay(S)) {
        // A. 1주차 + 공휴일 특수 처리: 2주차 같은 요일로 등록
        if (weekSelect === '1주차' && getCustomWeekOccurrence(S) === 1) {
          const plus7 = addDays(S, 7);
          if (plus7.getMonth() === S.getMonth()) {
            runDate = plus7;
          }
        }

        // B. 만약 여전히 휴무일이라면, 동일한 월 내에서 전일/익일 로직 수행 (월 이탈 방지)
        if (isNonWorkingDay(runDate)) {
          if (prevDay) {
            let temp = addDays(S, -1);
            let found = false;
            while (temp.getMonth() === S.getMonth()) {
              if (!isNonWorkingDay(temp)) {
                runDate = temp;
                found = true;
                break;
              }
              temp = addDays(temp, -1);
            }
            // 월을 이탈할 시, 익일(이후 근무일)로 자동 대체하여 같은 달 내에서 처리
            if (!found) {
              let tempForward = addDays(S, 1);
              while (tempForward.getMonth() === S.getMonth()) {
                if (!isNonWorkingDay(tempForward)) {
                  runDate = tempForward;
                  break;
                }
                tempForward = addDays(tempForward, 1);
              }
            }
          } else if (nextDay) {
            let temp = addDays(S, 1);
            let found = false;
            while (temp.getMonth() === S.getMonth()) {
              if (!isNonWorkingDay(temp)) {
                runDate = temp;
                found = true;
                break;
              }
              temp = addDays(temp, 1);
            }
            // 월을 이탈할 시, 전일(이전 근무일)로 자동 대체하여 같은 달 내에서 처리
            if (!found) {
              let tempBackward = addDays(S, -1);
              while (tempBackward.getMonth() === S.getMonth()) {
                if (!isNonWorkingDay(tempBackward)) {
                  runDate = tempBackward;
                  break;
                }
                tempBackward = addDays(tempBackward, -1);
              }
            }
          }
        }
      }

      // 만약 도출된 최종 실행일이 오늘 날짜(date)와 동일하면 매칭 성공!
      if (!isNonWorkingDay(runDate) && runDate.getDate() === date.getDate()) {
        return true;
      }
    }

    return false;
  } else {
    // Standard schedule check (no holiday exclusion or shifting)
    return checkScheduleForDate(date);
  }
};

/**
 * 년간 자동등록 설정이 특정 날짜에 해당하는지 체크
 */
export const isYearlySettingMatched = (setting: any, date: Date): boolean => {
  const itemText = setting.item || setting.item_name || '';
  let monthSelect = '1월';
  let weekSelect = '1주차';
  let prevDay = false;
  let nextDay = false;

  if (itemText.includes('__YEARLY_JSON__')) {
    const parts = itemText.split('__YEARLY_JSON__');
    try {
      const meta = JSON.parse(parts[1]);
      monthSelect = meta.monthSelect || '1월';
      weekSelect = meta.weekSelect || '1주차';
      prevDay = !!meta.prevDay;
      nextDay = !!meta.nextDay;
    } catch (e) {
      console.error('Failed to parse yearly json:', e);
    }
  } else {
    return false;
  }

  const checkScheduleForDate = (d: Date): boolean => {
    const dMonth = d.getMonth() + 1; // 1 ~ 12
    const dDay = getDay(d);

    // Month check
    let monthMatched = false;
    if (monthSelect.endsWith('월')) {
      const targetMonth = parseInt(monthSelect.replace('월', ''), 10);
      if (dMonth === targetMonth) monthMatched = true;
    } else if (monthSelect === '짝수달') {
      if (dMonth % 2 === 0) monthMatched = true;
    } else if (monthSelect === '홀수달') {
      if (dMonth % 2 !== 0) monthMatched = true;
    } else if (monthSelect === '반기') {
      // Half-yearly (Jan and Jul starts)
      if (dMonth === 1 || dMonth === 7) monthMatched = true;
    } else if (monthSelect === '분기') {
      // Quarterly (Jan, Apr, Jul, Oct starts)
      if (dMonth === 1 || dMonth === 4 || dMonth === 7 || dMonth === 10) monthMatched = true;
    }

    if (!monthMatched) return false;

    // Day of week check
    let dayMatched = false;
    switch(dDay) {
      case 0: if (setting.sun) dayMatched = true; break;
      case 1: if (setting.mon) dayMatched = true; break;
      case 2: if (setting.tue) dayMatched = true; break;
      case 3: if (setting.wed) dayMatched = true; break;
      case 4: if (setting.thu) dayMatched = true; break;
      case 5: if (setting.fri) dayMatched = true; break;
      case 6: if (setting.sat) dayMatched = true; break;
    }

    if (!dayMatched) return false;

    // Week based check: '1주차', '2주차', '3주차', '4주차', '5주차'
    // 해당 요일의 월 기준 등장 횟수 (매월 첫 번째 월요일을 기준으로 주차 계산)
    const occurrence = getCustomWeekOccurrence(d);
    if (occurrence === 0) return false; // 첫 번째 월요일 이전은 주차 없음
    switch (weekSelect) {
      case '1주차': return occurrence === 1;
      case '2주차': return occurrence === 2;
      case '3주차': return occurrence === 3;
      case '4주차': return occurrence === 4;
      case '5주차': return occurrence === 5;
    }

    return false;
  };

  // Exclude holiday check
  const excludeHolidays = !!(setting.excludeHolidays || setting.exclude_holidays);

  if (excludeHolidays) {
    if (isNonWorkingDay(date)) {
      return false;
    }

    // Today is a working day.
    // Check if any scheduled date in this specific month matches today after adjustment (staying in same month)
    const currentYear = date.getFullYear();
    const currentMonthNum = date.getMonth();
    const daysInMonth = new Date(currentYear, currentMonthNum + 1, 0).getDate();

    const scheduledDates: Date[] = [];
    for (let dNum = 1; dNum <= daysInMonth; dNum++) {
      const testDate = new Date(currentYear, currentMonthNum, dNum);
      if (checkScheduleForDate(testDate)) {
        scheduledDates.push(testDate);
      }
    }

    for (const S of scheduledDates) {
      let runDate = S;

      if (isNonWorkingDay(S)) {
        // A. 1주차 + 공휴일 특수 처리: 2주차 같은 요일로 등록
        if (weekSelect === '1주차' && getCustomWeekOccurrence(S) === 1) {
          const plus7 = addDays(S, 7);
          if (plus7.getMonth() === S.getMonth()) {
            runDate = plus7;
          }
        }

        // B. 만약 여전히 휴무일이라면, 동일한 월 내에서 전일/익일 로직 수행 (월 이탈 방지)
        if (isNonWorkingDay(runDate)) {
          if (prevDay) {
            let temp = addDays(S, -1);
            let found = false;
            while (temp.getMonth() === S.getMonth()) {
              if (!isNonWorkingDay(temp)) {
                runDate = temp;
                found = true;
                break;
              }
              temp = addDays(temp, -1);
            }
            if (!found) {
              let tempForward = addDays(S, 1);
              while (tempForward.getMonth() === S.getMonth()) {
                if (!isNonWorkingDay(tempForward)) {
                  runDate = tempForward;
                  break;
                }
                tempForward = addDays(tempForward, 1);
              }
            }
          } else if (nextDay) {
            let temp = addDays(S, 1);
            let found = false;
            while (temp.getMonth() === S.getMonth()) {
              if (!isNonWorkingDay(temp)) {
                runDate = temp;
                found = true;
                break;
              }
              temp = addDays(temp, 1);
            }
            if (!found) {
              let tempBackward = addDays(S, -1);
              while (tempBackward.getMonth() === S.getMonth()) {
                if (!isNonWorkingDay(tempBackward)) {
                  runDate = tempBackward;
                  break;
                }
                tempBackward = addDays(tempBackward, -1);
              }
            }
          }
        }
      }

      if (!isNonWorkingDay(runDate) && runDate.getDate() === date.getDate()) {
        return true;
      }
    }

    return false;
  } else {
    return checkScheduleForDate(date);
  }
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
    // Fetch monthly settings as well
    const monthlySettings = await fetchAutoRegSettings(category + '_monthly');
    // Fetch yearly settings
    const yearlySettings = await fetchAutoRegSettings(category + '_yearly');
    const tasks: TaskItem[] = [];
    
    // Process weekly settings (standard logic)
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

    // Process monthly settings
    monthlySettings.forEach((setting: any) => {
      if (isMonthlySettingMatched(setting, date)) {
        let itemText = setting.item || setting.item_name || '';
        if (itemText.includes('__MONTHLY_JSON__')) {
          itemText = itemText.split('__MONTHLY_JSON__')[0];
        }
        tasks.push({
          id: `db-auto-${category}-monthly-${setting.id}-${dateStr}`,
          content: itemText,
          frequency: '월간',
          status: '완료'
        });
      }
    });

    // Process yearly settings
    yearlySettings.forEach((setting: any) => {
      if (isYearlySettingMatched(setting, date)) {
        let itemText = setting.item || setting.item_name || '';
        if (itemText.includes('__YEARLY_JSON__')) {
          itemText = itemText.split('__YEARLY_JSON__')[0];
        }
        tasks.push({
          id: `db-auto-${category}-yearly-${setting.id}-${dateStr}`,
          content: itemText,
          frequency: '년간',
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
