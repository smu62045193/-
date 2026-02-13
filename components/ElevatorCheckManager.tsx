
import React, { useState } from 'react';
import ElevatorInspectionList from './ElevatorInspectionList';
import { LayoutList, ArrowUpDown } from 'lucide-react';

interface ElevatorCheckManagerProps {
  currentDate?: Date;
}

const TABS = [
  { id: 'check', label: '승강기점검이력' },
];

const ElevatorCheckManager: React.FC<ElevatorCheckManagerProps> = () => {
  const [activeTab, setActiveTab] = useState('check');

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="mb-2">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center">
          <ArrowUpDown className="mr-3 text-blue-600" size={32} />
          승강기 점검
        </h2>
        <p className="text-slate-500 mt-2 text-base font-medium">승강기 정기 점검 및 수리 이력을 관리합니다.</p>
      </div>

      {/* Tab Navigation - 협력업체 스타일과 동일하게 디자인 */}
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

      {/* Content Area - 큰 박스 레이아웃 */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
        {activeTab === 'check' && <ElevatorInspectionList />}
      </div>
    </div>
  );
};

export default ElevatorCheckManager;
