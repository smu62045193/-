import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { HOLIDAYS } from '../constants';
import { format, addDays, subDays, getDay } from 'date-fns';

interface HeaderProps {
  currentDate: Date;
  onChangeDate: (date: Date) => void;
}

const Header: React.FC<HeaderProps> = ({ currentDate, onChangeDate }) => {
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handlePrevDay = () => onChangeDate(subDays(currentDate, 1));
  const handleNextDay = () => onChangeDate(addDays(currentDate, 1));

  const getDayName = (date: Date) => {
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    return days[getDay(date)];
  };
  
  const formattedDate = format(currentDate, 'yyyy년 MM월 dd일');
  const dayName = getDayName(currentDate);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const monthDay = format(currentDate, 'MM-md');

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

  const recurringHolidayName = FIXED_SOLAR_HOLIDAYS[monthDay];
  const specificHoliday = HOLIDAYS.find(h => h.date === dateKey);
  const holidayName = recurringHolidayName || specificHoliday?.name;

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