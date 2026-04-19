
import React, { useState } from 'react';
import GeneratorCheck from './GeneratorCheck';
import MeterCheckManager from './MeterCheckManager'; 
import BatteryCheckLog from './BatteryCheckLog';
import LoadCurrentLog from './LoadCurrentLog';
import SafetyCheckLog from './SafetyCheckLog';
import ElecInspectionHistory from './ElecInspectionHistory';
import { LayoutList, Hammer, Zap } from 'lucide-react';
import { parseISO } from 'date-fns';

interface ElecCheckManagerProps {
  currentDate: Date;
  onDateChange?: (date: Date) => void;
}

const TABS = [
  { id: 'meter', label: '계량기' },
  { id: 'generator', label: '발전기' },
  { id: 'battery', label: '밧데리' },
  { id: 'load', label: '부하전류' },
  { id: 'safety_general', label: '전기설비' },
  { id: 'safety_ev', label: '전기자동차' },
];

const ElecCheckManager: React.FC<ElecCheckManagerProps> = ({ currentDate, onDateChange }) => {
  const [activeTab, setActiveTab] = useState('meter');

  const handleSelectFromHistory = (tabId: string, dateStr: string) => {
    if (onDateChange) {
      const fullDateStr = dateStr.length === 7 ? `${dateStr}-01` : dateStr;
      onDateChange(parseISO(fullDateStr));
    }
    setActiveTab(tabId);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-2 pb-32">
      <div className="animate-fade-in space-y-2">
        {/* Tab Navigation - 밑줄형 탭 */}
        <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
          <div className="flex shrink-0">
            {TABS.map(tab => (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer bg-white ${
                  activeTab === tab.id 
                    ? 'text-orange-600' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="min-h-[500px]">
          {activeTab === 'generator' && <GeneratorCheck currentDate={currentDate} />}
          {activeTab === 'meter' && <MeterCheckManager currentDate={currentDate} />} 
          {activeTab === 'battery' && <BatteryCheckLog currentDate={currentDate} />}
          {activeTab === 'load' && <LoadCurrentLog currentDate={currentDate} />}
          {activeTab === 'safety_general' && <SafetyCheckLog currentDate={currentDate} viewType="general" />}
          {activeTab === 'safety_ev' && <SafetyCheckLog currentDate={currentDate} viewType="ev" />}
          
          {!TABS.some(t => t.id === activeTab) && (
            <div className="flex flex-col items-center justify-center p-24 text-center bg-white rounded-3xl border border-slate-200 shadow-sm animate-fade-in">
              <div className="p-8 bg-slate-50 rounded-full mb-8">
                <Hammer size={64} className="text-slate-300" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-4">{TABS.find(t => t.id === activeTab)?.label}</h3>
              <div className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl text-sm font-black tracking-widest uppercase">
                Under Development
              </div>
              <p className="text-slate-400 mt-6 text-base max-w-sm">해당 모듈은 현재 고도화 작업 중입니다. 빠른 시일 내에 제공해 드리겠습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ElecCheckManager;
