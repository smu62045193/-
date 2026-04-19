
import React, { useState } from 'react';
import ConstructionLog from './ConstructionLog';
import ConstructionHistory from './ConstructionHistory';
import ConstructionContractorManager from './ConstructionContractorManager';
import { HardHat, LayoutList } from 'lucide-react';

const TABS = [
  { id: 'history', label: '전체이력' },
  { id: 'external', label: '외부업체' },
  { id: 'internal', label: '시설직' },
  { id: 'contractors', label: '공사업체' },
];

const ConstructionManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'history' | 'external' | 'internal' | 'contractors'>('history');

  return (
    <div className="p-4 max-w-7xl mx-auto animate-fade-in space-y-2 pb-32">
      {/* Tab Navigation */}
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
        <div className="flex shrink-0">
          {TABS.map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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
      <div className="min-h-[400px]">
        {activeTab === 'history' && <ConstructionHistory />}
        {(activeTab === 'external' || activeTab === 'internal') && (
          <ConstructionLog mode={activeTab} />
        )}
        {activeTab === 'contractors' && <ConstructionContractorManager />}
      </div>
    </div>
  );
};

export default ConstructionManager;
