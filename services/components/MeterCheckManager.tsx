
import React, { useState } from 'react';
import { format, subMonths, addMonths, parseISO } from 'date-fns';
import MeterReadingLog from './MeterReadingLog';
import AnnualMeterReport from './AnnualMeterReport';
import MeterReadingPhotos from './MeterReadingPhotos';
import TenantStatus from './TenantStatus';

interface MeterCheckManagerProps {
  currentDate: Date;
}

const TABS = [
  { id: 'tenants', label: '입주사' },
  { id: 'monthly', label: '월별검침' },
  { id: 'photos', label: '사진첩' },
  { id: 'annual', label: '연간보고서' },
];

const MeterCheckManager: React.FC<MeterCheckManagerProps> = ({ currentDate }) => {
  const [activeTab, setActiveTab] = useState<string>('tenants');
  const [currentMonth, setCurrentMonth] = useState(format(currentDate, 'yyyy-MM'));

  const handlePrevMonth = () => setCurrentMonth(prev => format(subMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'));
  const handleNextMonth = () => setCurrentMonth(prev => format(addMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'));

  return (
    <div className="space-y-2">
      <div className="animate-fade-in space-y-2">
        {/* Content Area */}
        <div className="w-full">
          {activeTab === 'tenants' && (
            <TenantStatus 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              tabs={TABS} 
              currentMonth={currentMonth}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />
          )}
          {activeTab === 'monthly' && (
            <MeterReadingLog 
              currentDate={currentDate} 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              tabs={TABS} 
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />
          )}
          {activeTab === 'annual' && (
            <AnnualMeterReport 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              tabs={TABS} 
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
            />
          )}
          {activeTab === 'photos' && (
            <MeterReadingPhotos 
              currentDate={currentDate} 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              tabs={TABS} 
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MeterCheckManager;
