import React, { useState } from 'react';
import FireExtinguisherCheck from './FireExtinguisherCheck';
import IntegratedInspectionList from './IntegratedInspectionList';

interface FireElevatorManagerProps {
  currentDate: Date;
}

const TABS = [
  { id: 'integrated_history', label: '점검이력' },
  { id: 'extinguisher', label: '소화기관리' },
];

const FireElevatorManager: React.FC<FireElevatorManagerProps> = ({ currentDate }) => {
  const [activeTab, setActiveTab] = useState('integrated_history');

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

      <div className="min-h-[500px]">
        {activeTab === 'integrated_history' && <IntegratedInspectionList />}
        {activeTab === 'extinguisher' && <FireExtinguisherCheck />}
      </div>
    </div>
  );
};

export default FireElevatorManager;
