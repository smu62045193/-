import React, { useState } from 'react';
import ConstructionLog from './ConstructionLog';
import ConstructionHistory from './ConstructionHistory';
import { LayoutList } from 'lucide-react';

const TABS = [
  { id: 'history', label: '공사/작업리스트' },
  { id: 'external', label: '외부업체' },
  { id: 'internal', label: '시설직' },
];

const ConstructionManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'history' | 'external' | 'internal'>('history');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">공사 및 작업 관리</h2>
        <p className="text-gray-500 mt-1 text-base">외부 업체 공사 현황 및 시설팀 자체 작업 내역을 사진과 함께 기록합니다.</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex overflow-x-auto whitespace-nowrap gap-2 pb-2 mb-4 scrollbar-hide border-b border-gray-200 items-center">
        <div className="mr-2 text-gray-500">
           <LayoutList size={20} />
        </div>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-full text-base font-medium transition-all duration-200 border ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">
        {activeTab === 'history' && <ConstructionHistory />}
        {(activeTab === 'external' || activeTab === 'internal') && (
          <div className="p-6">
            <ConstructionLog mode={activeTab} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ConstructionManager;