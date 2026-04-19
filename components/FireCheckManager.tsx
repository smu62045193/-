import React, { useState } from 'react';
import FireExtinguisherCheck from './FireExtinguisherCheck';
import FireHistoryList from './FireHistoryList';
import { LayoutList, Flame } from 'lucide-react';

const TABS = [
  { id: 'history', label: '소방점검이력' },
  { id: 'extinguisher', label: '소화기 관리' },
];

const FireCheckManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('history');

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center">
          <Flame className="mr-3 text-red-600" size={32} />
          소방 점검 및 안전
        </h2>
        <p className="text-slate-500 mt-2 text-base font-medium">소방 시설 및 소화기 배치 현황을 정기적으로 점검하고 기록합니다.</p>
      </div>

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

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
        {activeTab === 'history' && <FireHistoryList />}
        {activeTab === 'extinguisher' && <FireExtinguisherCheck />}
      </div>
    </div>
  );
};

export default FireCheckManager;