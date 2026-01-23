import React, { useState } from 'react';
import FireExtinguisherCheck from './FireExtinguisherCheck';
import FireHistoryList from './FireHistoryList';
import { LayoutList } from 'lucide-react';

const TABS = [
  { id: 'history', label: '소방점검이력' },
  { id: 'extinguisher', label: '소화기 관리' },
];

const FireCheckManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('history');

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">소방 점검 및 안전</h2>
        <p className="text-slate-500 mt-2 text-base font-medium">소방 시설 및 소화기 배치 현황을 정기적으로 점검하고 기록합니다.</p>
      </div>

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

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
        {activeTab === 'history' && <FireHistoryList />}
        {activeTab === 'extinguisher' && <FireExtinguisherCheck />}
      </div>
    </div>
  );
};

export default FireCheckManager;