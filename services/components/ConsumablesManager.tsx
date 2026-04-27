
import React, { useState } from 'react';
import ConsumablesLedger from './ConsumablesLedger';
import ConsumableRequestManager from './ConsumableRequestManager';

const TABS = [
  { id: 'ledger', label: '관리대장' },
  { id: 'usage', label: '사용내역' },
  { id: 'request', label: '자재신청' },
];

const ConsumablesManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('ledger');

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-2 pb-32 animate-fade-in print:p-0">
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

      {activeTab === 'ledger' || activeTab === 'usage' ? (
        <ConsumablesLedger viewMode={activeTab as 'ledger' | 'usage'} />
      ) : (
        <ConsumableRequestManager />
      )}
    </div>
  );
};

export default ConsumablesManager;
