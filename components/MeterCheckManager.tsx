
import React, { useState } from 'react';
import MeterReadingLog from './MeterReadingLog';
import AnnualMeterReport from './AnnualMeterReport';
import MeterReadingPhotos from './MeterReadingPhotos';
import TenantStatus from './TenantStatus';
import { LayoutList } from 'lucide-react';

interface MeterCheckManagerProps {
  currentDate: Date;
}

const TABS = [
  { id: 'tenants', label: '입주사 현황' },
  { id: 'monthly', label: '월별 검침 기록' },
  { id: 'photos', label: '검침 사진첩' },
  { id: 'annual', label: '입주사별 연간보고서' },
];

const MeterCheckManager: React.FC<MeterCheckManagerProps> = ({ currentDate }) => {
  const [activeTab, setActiveTab] = useState<string>('tenants');

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        {/* 메인 박스 시작 */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px]">
          
          {/* Tab Navigation - 박스 내부 상단 */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex overflow-x-auto whitespace-nowrap gap-2 scrollbar-hide items-center">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black transition-all duration-300 border ${
                  activeTab === tab.id 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100 scale-105' 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area - 탭 하단 콘텐츠 */}
          <div className="p-0">
            {activeTab === 'tenants' && <TenantStatus />}
            {activeTab === 'monthly' && <MeterReadingLog currentDate={currentDate} />}
            {activeTab === 'annual' && <AnnualMeterReport />}
            {activeTab === 'photos' && <MeterReadingPhotos currentDate={currentDate} />}
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default MeterCheckManager;
