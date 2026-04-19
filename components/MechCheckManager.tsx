
import React, { useState } from 'react';
import WaterTankLog from './WaterTankLog';
import MechInspectionHistory from './MechInspectionHistory';
import AirFilterCheck from './AirFilterCheck';
import FancoilCheck from './FancoilCheck';
import SepticTankCheck from './SepticTankCheck';
import EnergyCheck from './EnergyCheck';
import { Hammer } from 'lucide-react';
import { parseISO } from 'date-fns';

interface MechCheckManagerProps {
  currentDate: Date;
  onDateChange?: (date: Date) => void;
}

const TABS = [
  { id: 'water', label: '저수조' },
  { id: 'filter', label: '공조기' },
  { id: 'fancoil', label: '팬코일' },
  { id: 'septic', label: '정화조' },
  { id: 'energy', label: '에너지' },
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
    <div className="p-4 max-w-7xl mx-auto space-y-2 pb-32 animate-fade-in">
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
        <div className="flex shrink-0">
          {TABS.map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer ${
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
        {activeTab === 'water' && <WaterTankLog currentDate={currentDate} />}
        {activeTab === 'filter' && <AirFilterCheck />}
        {activeTab === 'fancoil' && <FancoilCheck />}
        {activeTab === 'septic' && <SepticTankCheck />}
        {activeTab === 'energy' && <EnergyCheck />}
        
        {activeTab !== 'water' && activeTab !== 'filter' && activeTab !== 'fancoil' && activeTab !== 'septic' && activeTab !== 'energy' && (
          <div className="flex flex-col items-center justify-center p-24 text-center bg-white rounded-3xl border border-slate-200 shadow-sm animate-fade-in">
            <div className="p-8 bg-slate-50 rounded-full mb-8">
              <Hammer size={64} className="text-slate-300" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-4">준비중입니다.</h3>
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
