
import React, { useState } from 'react';
import ConsumablesLedger from './ConsumablesLedger';
import ConsumableRequestManager from './ConsumableRequestManager';
import { LayoutList, Package } from 'lucide-react';

const TABS = [
  { id: 'ledger', label: '소모품관리대장' },
  { id: 'usage', label: '소모품사용내역' },
  { id: 'request', label: '소모품자재신청서' },
];

const ConsumablesManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('ledger');

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="mb-2">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center">
          <Package className="mr-2 text-blue-600" size={32} />
          소모품 관리
        </h2>
        <p className="text-slate-500 mt-2 text-base font-medium">소모품 재고 현황 및 구매 신청을 통합 관리합니다.</p>
      </div>

      {/* Tab Navigation - 협력업체 스타일과 동일하게 수정 */}
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

      {/* Content Area - 협력업체 스타일의 큰 박스 레이아웃 */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
        {(activeTab === 'ledger' || activeTab === 'usage') && (
          <ConsumablesLedger viewMode={activeTab as 'ledger' | 'usage'} />
        )}
        {activeTab === 'request' && <ConsumableRequestManager />}
      </div>
    </div>
  );
};

export default ConsumablesManager;
