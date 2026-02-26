
import React, { useState } from 'react';
import ConstructionLog from './ConstructionLog';
import ConstructionHistory from './ConstructionHistory';
import ConstructionContractorManager from './ConstructionContractorManager';
import { HardHat, LayoutList } from 'lucide-react';

const TABS = [
  { id: 'history', label: '공사/작업리스트' },
  { id: 'external', label: '외부업체' },
  { id: 'internal', label: '시설직' },
  { id: 'contractors', label: '공사업체현황' },
];

const ConstructionManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'history' | 'external' | 'internal' | 'contractors'>('history');

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in pb-32">
      <div className="mb-4 print:hidden">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center">
            <HardHat className="mr-3 text-blue-600" size={32} />
            공사 및 작업 관리
          </h2>
          <p className="text-gray-500 text-base font-medium">외부 업체 공사 현황 및 시설팀 자체 작업 내역, 공사업체 정보를 통합 관리합니다.</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex overflow-x-auto whitespace-nowrap gap-2 mb-2 scrollbar-hide items-center print:hidden">
        <div className="mr-3 text-slate-400 p-2 bg-white rounded-xl shadow-sm border border-slate-100">
          <LayoutList size={22} />
        </div>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
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
