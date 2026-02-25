import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { HOLIDAYS } from '../constants';
import { format, addDays, subDays, getDay } from 'date-fns';

interface HeaderProps {
  currentDate: Date;
  onChangeDate: (date: Date) => void;
}

const Header: React.FC<HeaderProps> = ({ currentDate, onChangeDate }) => {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [holidayName, setHolidayName] = useState<string | null>(null);

  const handlePrevDay = () => onChangeDate(subDays(currentDate, 1));
  const handleNextDay = () => onChangeDate(addDays(currentDate, 1));

  const getDayName = (date: Date) => {
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    return days[getDay(date)];
  };
  
  const formattedDate = format(currentDate, 'yyyy년 MM월 dd일');
  const dayName = getDayName(currentDate);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const monthDay = format(currentDate, 'MM-dd'); // 오타 수정: MM-md -> MM-dd

  // Fixed Solar Holidays (Every year)
  const FIXED_SOLAR_HOLIDAYS: Record<string, string> = {
    '01-01': '신정',
    '03-01': '삼일절',
    '05-01': '근로자의 날',
    '05-05': '어린이날',
    '06-06': '현충일',
    '08-15': '광복절',
    '10-03': '개천절',
    '10-09': '한글날',
    '12-25': '성탄절'
  };

  useEffect(() => {
    const fetchHoliday = async () => {
      // 1. 고정 양력 휴일 확인
      const recurringHolidayName = FIXED_SOLAR_HOLIDAYS[monthDay];
      if (recurringHolidayName) {
        setHolidayName(recurringHolidayName);
        return;
      }

      // 2. 정부 공공데이터 API 호출 (한국천문연구원 특일정보)
      try {
        // 사용자가 제공한 일반인증키 적용 (환경 변수가 있으면 우선 사용)
        const apiKey = import.meta.env.VITE_GOV_HOLIDAY_API_KEY || 'ee091b24333b8a98fef62d62d6208aff0713004c9702eeee542de1c4b3618138';
        if (apiKey) {
          const year = format(currentDate, 'yyyy');
          const month = format(currentDate, 'MM');
          // 공공데이터포털 API 엔드포인트
          const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?solYear=${year}&solMonth=${month}&ServiceKey=${apiKey}&_type=json`;
          
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          const text = await res.text();
          if (text.includes('Forbidden') || text.trim().startsWith('<')) {
            throw new Error('Invalid response from API');
          }
          const data = JSON.parse(text);
          const items = data?.response?.body?.items?.item;
          
          if (items) {
            const itemList = Array.isArray(items) ? items : [items];
            const targetDateStr = format(currentDate, 'yyyyMMdd');
            const found = itemList.find((item: any) => String(item.locdate) === targetDateStr && item.isHoliday === 'Y');
            
            if (found) {
              setHolidayName(found.dateName);
              return;
            }
          }
        }
      } catch (e) {
        console.error('공공데이터 API 호출 실패, 기본 데이터로 대체합니다.', e);
      }

      // 3. API 키가 없거나 호출에 실패한 경우, 기존 하드코딩된 HOLIDAYS 배열에서 확인 (Fallback)
      const specificHoliday = HOLIDAYS.find(h => h.date === dateKey);
      setHolidayName(specificHoliday?.name || null);
    };

    fetchHoliday();
  }, [currentDate, monthDay, dateKey]);

  const isHoliday = !!holidayName;
  const isWeekend = getDay(currentDate) === 0; 
  const isSaturday = getDay(currentDate) === 6;

  let dateColorClass = "text-black";
  if (isHoliday || isWeekend) dateColorClass = "text-red-600 font-bold";
  else if (isSaturday) dateColorClass = "text-blue-600 font-bold";

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const [y, m, d] = e.target.value.split('-').map(Number);
      onChangeDate(new Date(y, m - 1, d));
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 p-3 sticky top-0 z-20 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-center">
        <div className="flex items-center space-x-4 text-xl sm:text-2xl shrink-0">
          <button onClick={handlePrevDay} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" />
          </button>
          <div className="relative group flex items-center cursor-pointer space-x-2">
            <span className={`select-none ${dateColorClass} group-hover:text-blue-500 transition-colors whitespace-nowrap`}>
              {formattedDate} {dayName} {holidayName ? `(${holidayName})` : ''}
            </span>
            <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 group-hover:text-blue-500 transition-colors" />
            <input 
              ref={dateInputRef} 
              type="date" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              value={format(currentDate, 'yyyy-MM-dd')} 
              onChange={handleDateChange} 
            />
          </div>
          <button onClick={handleNextDay} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;