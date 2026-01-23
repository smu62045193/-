import { TaskItem, ElevatorLogData, FireInspectionLogData, DutyStatus, StaffMember } from '../types';
import { HOLIDAYS } from '../constants';
import { parseISO, getDay, format, addDays, getMonth, differenceInDays } from 'date-fns';

/**
 * 공휴일 여부 체크 (일요일 포함)
 */
export const isHolidayOrSunday = (date: Date): boolean => {
  const dateStr = format(date, 'yyyy-MM-dd');
  const day = getDay(date);
  return day === 0 || HOLIDAYS.some(h => h.date === dateStr);
};

/**
 * 토요일, 일요일, 공휴일 포함 여부 체크
 */
export const isNonWorkingDay = (date: Date): boolean => {
  const day = getDay(date);
  return day === 0 || day === 6 || isHolidayOrSunday(date);
};

/**
 * ELECTRICAL TASKS
 */
export const getAutomatedElectricalTasks = (dateStr: string): TaskItem[] => {
  const date = parseISO(dateStr);
  const day = getDay(date);
  const holiday = isHolidayOrSunday(date);
  const isWeekday = day >= 1 && day <= 5;
  const tasks: TaskItem[] = [];
  const generateId = (prefix: string) => `auto-elec-${prefix}-${dateStr}`;

  tasks.push({ id: generateId('substation'), content: '수변전반 검침 및 점검', frequency: '일일', status: '완료' });

  if (!holiday) {
    if (isWeekday) tasks.push({ id: generateId('eps'), content: '전층 EPS실 점검 및 청소', frequency: '일일', status: '완료' });
    if (day === 1) tasks.push({ id: generateId('lighting'), content: '전층 전등 조명상태 제어 및 점검', frequency: '주간', status: '완료' });
    if (day === 3) tasks.push({ id: generateId('mcc'), content: 'MCC반 및 펌프 외관 점검', frequency: '주간', status: '완료' });
  }
  return tasks;
};

/**
 * MECHANICAL TASKS
 */
export const getAutomatedMechanicalTasks = (dateStr: string): TaskItem[] => {
  const date = parseISO(dateStr);
  const day = getDay(date);
  const holiday = isHolidayOrSunday(date);
  const isWeekday = day >= 1 && day <= 5;
  const tomorrow = addDays(date, 1);
  const isTomorrowHoliday = isHolidayOrSunday(tomorrow);
  const tasks: TaskItem[] = [];
  const generateId = (prefix: string) => `auto-mech-${prefix}-${dateStr}`;

  tasks.push({ id: generateId('daily-clean'), content: '기계실 일상 점검 및 정리정돈', frequency: '일일', status: '완료' });
  tasks.push({ id: generateId('patrol'), content: '각층 기계 설비 순찰 점검', frequency: '일일', status: '완료' });

  if (!holiday) {
    if (isWeekday) {
      tasks.push({ id: generateId('hvac-monitor'), content: '냉,난방기 가동 및 감시', frequency: '일일', status: '완료' });
      tasks.push({ id: generateId('tank-check'), content: '물탱크,집수정,정화조 일상점검', frequency: '일일', status: '완료' });
    }
    if (day === 1 || day === 3 || day === 5) tasks.push({ id: generateId('sludge-removal'), content: 'B6F집수정 슬러지 제거,소독작업', frequency: '주간', status: '완료' });
  }

  if (day === 1) tasks.push({ id: generateId('graph-paper'), content: 'B2F정압실 그래프용지 교체 및 점검', frequency: '주간', status: '완료' });
  const isTargetDayForSeptic = (day === 5 && !holiday) || (day === 4 && isTomorrowHoliday);
  if (isTargetDayForSeptic) tasks.push({ id: generateId('septic-chemical'), content: 'B6F정화조약품투입,청소 및 점검', frequency: '주간', status: '완료' });

  return tasks;
};

/**
 * FIRE TASKS
 */
export const getAutomatedFireTasks = (dateStr: string, logData?: FireInspectionLogData): TaskItem[] => {
  const date = parseISO(dateStr);
  const day = getDay(date);
  const holiday = isHolidayOrSunday(date);
  const isWeekday = day >= 1 && day <= 5;
  const tasks: TaskItem[] = [];
  const generateId = (prefix: string) => `auto-fire-${prefix}-${dateStr}`;

  tasks.push({ id: generateId('panel-monitor'), content: '종합수신반 감시 및 점검', frequency: '일일', status: '완료' });

  if (!holiday) {
    if (isWeekday) tasks.push({ id: generateId('patrol'), content: '전층 방화 순찰 점검', frequency: '일일', status: '완료' });
    if (day === 1) tasks.push({ id: generateId('door-check'), content: '전층전실,방화문 개방 및 적치물 상태점검', frequency: '주간', status: '완료' });
    if (day === 2) tasks.push({ id: generateId('damper-check'), content: '전실댐퍼 스위치,공기 배출구 상태점검', frequency: '주간', status: '완료' });
    if (day === 3) tasks.push({ id: generateId('indicator-check'), content: '유도등 및 계단 감지기 외관 상태 점검', frequency: '주간', status: '완료' });
    if (day === 4) tasks.push({ id: generateId('hydrant-check'), content: '전층 소화전 및 발신기 상태 점검', frequency: '주간', status: '완료' });
    if (day === 5) tasks.push({ id: generateId('sprinkler-check'), content: '지하주차장 스프링클러 헤드 상태 점검', frequency: '주간', status: '완료' });
  }

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
  const date = parseISO(dateStr);
  const day = getDay(date);
  const month = getMonth(date) + 1;
  const holiday = isHolidayOrSunday(date);
  const isWeekday = day >= 1 && day <= 5;
  const tasks: TaskItem[] = [];
  const generateId = (prefix: string) => `auto-elv-${prefix}-${dateStr}`;

  tasks.push({ id: generateId('op-status'), content: '승강기 운행상태 제어 및 점검', frequency: '일일', status: '완료' });

  if (!holiday) {
    if (isWeekday) tasks.push({ id: generateId('btn-check'), content: '카내부 버튼 및 버튼 동작 상태 점검', frequency: '일일', status: '완료' });
    if (day === 2 && month >= 3 && month <= 10) tasks.push({ id: generateId('ac-temp-check'), content: '승강기 기계실 에어컨 온도설정 점검', frequency: '주간', status: '완료' });
    if (day === 4) tasks.push({ id: generateId('machine-room-clean'), content: '승강기 기계실 청소,정리작업', frequency: '주간', status: '완료' });
  }

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
  const tasks: TaskItem[] = [];
  const generateId = (prefix: string) => `auto-park-${prefix}-${dateStr}`;
  tasks.push({ id: generateId('designated'), content: '지정 주차 구역 차량 현황 점검', frequency: '일일', status: '완료' });
  tasks.push({ id: generateId('facility'), content: '주차 관제 설비 및 차단기 점검', frequency: '일일', status: '완료' });
  return tasks;
};

/**
 * SECURITY TASKS
 */
export const getAutomatedSecurityTasks = (dateStr: string): TaskItem[] => {
  const tasks: TaskItem[] = [];
  const generateId = (prefix: string) => `auto-sec-${prefix}-${dateStr}`;
  tasks.push({ id: generateId('visitor-control'), content: '외부 출입자 통제 및 관리', frequency: '일일', status: '완료' });
  tasks.push({ id: generateId('security-patrol'), content: '임대층 및 공용부 보안 순찰 점검', frequency: '일일', status: '완료' });
  return tasks;
};

/**
 * CLEANING TASKS
 */
export const getAutomatedCleaningTasks = (dateStr: string): TaskItem[] => {
  const date = parseISO(dateStr);
  const day = getDay(date);
  const holiday = isHolidayOrSunday(date);
  const isWeekday = day >= 1 && day <= 5;
  const tasks: TaskItem[] = [];
  const generateId = (prefix: string) => `auto-clean-${prefix}-${dateStr}`;

  if (!holiday && isWeekday) {
    tasks.push({ id: generateId('common-area-clean'), content: '임대층 및 공용 부분 청소', frequency: '일일', status: '완료' });
    tasks.push({ id: generateId('outdoor-clean'), content: '외곽 화단 및 공개 공지 청소', frequency: '일일', status: '완료' });
    tasks.push({ id: generateId('recycle-collect'), content: '재활용 분리수거 및 배출', frequency: '일일', status: '완료' });
  }
  return tasks;
};