import React, { useState } from 'react';
import MeterReadingLog from './MeterReadingLog';
import AnnualMeterReport from './AnnualMeterReport';
import MeterReadingPhotos from './MeterReadingPhotos';
import TenantStatus from './TenantStatus';
import { LayoutList, CalendarRange, Camera, Building2 } from 'lucide-react';

interface MeterCheckManagerProps {
  currentDate: Date;
}

const MeterCheckManager: React.FC<MeterCheckManagerProps> = ({ currentDate }) => {
  const [activeTab, setActiveTab] = useState<'tenants' | 'monthly' | 'annual' | 'photos'>('tenants');

  return (
    <div className="space-y-4">
      <div className="animate-fade-in space-y-4">
        {/* Tab Navigation */}
        <div className="flex overflow-x-auto whitespace-nowrap gap-2 pb-2 mb-2 scrollbar-hide border-b border-gray-200 items-center">
          <button
            onClick={() => setActiveTab('tenants')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 border ${
              activeTab === 'tenants' 
                ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Building2 size={18} />
            입주사 현황
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 border ${
              activeTab === 'monthly' 
                ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <LayoutList size={18} />
            월별 검침 기록
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 border ${
              activeTab === 'photos' 
                ? 'bg-amber-600 text-white border-amber-600 shadow-md' 
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Camera size={18} />
            검침 사진첩
          </button>
          <button
            onClick={() => setActiveTab('annual')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 border ${
              activeTab === 'annual' 
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <CalendarRange size={18} />
            입주사별 연간보고서
          </button>
        </div>

        {/* Content Area */}
        <div>
          {activeTab === 'tenants' && <TenantStatus />}
          {activeTab === 'monthly' && <MeterReadingLog currentDate={currentDate} />}
          {activeTab === 'annual' && <AnnualMeterReport />}
          {activeTab === 'photos' && <MeterReadingPhotos currentDate={currentDate} />}
        </div>
      </div>
    </div>
  );
};

export default MeterCheckManager;