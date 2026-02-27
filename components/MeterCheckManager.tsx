
import React, { useState } from 'react';
import MeterReadingLog from './MeterReadingLog';
import AnnualMeterReport from './AnnualMeterReport';
import MeterReadingPhotos from './MeterReadingPhotos';
import TenantStatus from './TenantStatus';
import { LayoutList, ClipboardCheck } from 'lucide-react';

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
    <div className="space-y-2">
      <div className="animate-fade-in">
        {/* Sub-tab Navigation - WorkLog style */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-2">
          <div className="bg-gray-50/50 border-b border-gray-100 flex items-center">
            <div className="flex items-center gap-2 py-3 pl-5 w-[140px] shrink-0">
              <ClipboardCheck className="text-blue-500" size={20} />
              <h4 className="font-bold text-gray-800 whitespace-nowrap">계량기 검침</h4>
              <span className="text-gray-300 ml-auto mr-2">|</span>
            </div>
            <div className="flex overflow-x-auto scrollbar-hide">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 font-bold text-sm transition-colors whitespace-nowrap ${
                    activeTab === tab.id 
                      ? 'text-blue-600 border-b-4 border-blue-600' 
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Area - 큰 테이블 박스 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] p-0">
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
