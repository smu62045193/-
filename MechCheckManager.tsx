
import React, { useState } from 'react';
import WaterTankLog from './WaterTankLog';
import MechInspectionHistory from './MechInspectionHistory';
import { LayoutList, Hammer } from 'lucide-react';
import { parseISO } from 'date-fns';

interface MechCheckManagerProps {
  currentDate: Date;
  onDateChange?: (date: Date) => void;
}

const TABS = [
  { id: 'water', label: '저수조위생점검' },
];

const MechCheckManager: React.FC<MechCheckManagerProps> = ({ currentDate, onDateChange }) => {
  const [activeTab, setActiveTab] = useState('water');

  const handleSelectFromHistory = (tabId: string, dateStr: string) => {
    if (onDateChange) {
      onDateChange(parseISO(dateStr));
    }
    setActiveTab(tabId);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="mb-2">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">기계 점검 및 관리</h2>
        <p className="text-slate-500 mt-2 text-base font-medium">저수조 위생 등 기계 설비의 주요 시설물 점검을 수행합니다.</p>
      </div>

      {/* Tab Navigation - 디자인 표준화 */}
      <div className="flex overflow-x-auto whitespace-nowrap gap-2 pb-4 mb-4 scrollbar-hide border-b border-slate-200 items-center">
        <div className="mr-3 text-slate-400 p-2 bg-white rounded-xl shadow-sm border border-slate-100">
           <LayoutList size={22} />
        </div>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 rounded-2xl text-sm font-black transition-all duration-300 border ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100 scale-105' 
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="min-h-[500px]">
        {activeTab === 'water' && <WaterTankLog currentDate={currentDate} />}
        
        {!TABS.some(t => t.id === activeTab) && (
          <div className="flex flex-col items-center justify-center p-24 text-center bg-white rounded-3xl border border-slate-200 shadow-sm animate-fade-in">
            <div className="p-8 bg-slate-50 rounded-full mb-8">
              <Hammer size={64} className="text-slate-300" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-4">기능 준비중</h3>
            <div className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl text-sm font-black tracking-widest uppercase">
              Under Development
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MechCheckManager;
