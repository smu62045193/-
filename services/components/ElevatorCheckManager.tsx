
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
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-gray-200">
        <div className="flex shrink-0">
          {TABS.map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer ${activeTab === tab.id ? 'text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content Area - 큰 박스 레이아웃 */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
        {activeTab === 'check' && <ElevatorInspectionList />}
      </div>
    </div>
  );
};

export default ElevatorCheckManager;
