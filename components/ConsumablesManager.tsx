import React, { useState } from 'react';
import ConsumablesLedger from './ConsumablesLedger';
import ConsumableRequestManager from './ConsumableRequestManager';
import { LayoutList } from 'lucide-react';

const TABS = [
  { id: 'ledger', label: '소모품관리대장' },
  { id: 'usage', label: '소모품사용내역' },
  { id: 'request', label: '소모품자재신청서' },
];

const ConsumablesManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('ledger');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">소모품 관리</h2>
        <p className="text-gray-500 mt-1 text-base">소모품 재고 현황 및 구매 신청을 관리합니다.</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex overflow-x-auto whitespace-nowrap gap-2 pb-2 mb-4 scrollbar-hide border-b border-gray-200 items-center">
        <div className="mr-2 text-gray-500">
           <LayoutList size={20} />
        </div>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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
        {(activeTab === 'ledger' || activeTab === 'usage') && (
          <ConsumablesLedger viewMode={activeTab as 'ledger' | 'usage'} />
        )}
        {activeTab === 'request' && <ConsumableRequestManager />}
      </div>
    </div>
  );
};

export default ConsumablesManager;