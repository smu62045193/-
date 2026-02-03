
import React, { useState } from 'react';
import GeneratorCheck from './GeneratorCheck';
import MeterCheckManager from './MeterCheckManager'; 
import BatteryCheckLog from './BatteryCheckLog';
import LoadCurrentLog from './LoadCurrentLog';
import SafetyCheckLog from './SafetyCheckLog';
import ElecInspectionHistory from './ElecInspectionHistory';
import { LayoutList, Hammer } from 'lucide-react';
import { parseISO } from 'date-fns';

interface ElecCheckManagerProps {
  currentDate: Date;
  onDateChange?: (date: Date) => void;
}

const TABS = [
  { id: 'meter', label: '계량기검침' },
  { id: 'generator', label: '비상발전기' },
  { id: 'battery', label: '밧데리' },
  { id: 'load', label: '부하전류' },
  { id: 'safety_general', label: '전기설비점검' },
  { id: 'safety_ev', label: '전기자동차' },
];

const ElecCheckManager: React.FC<ElecCheckManagerProps> = ({ currentDate, onDateChange }) => {
  const [activeTab, setActiveTab] = useState('meter');

  const handleSelectFromHistory = (tabId: string, dateStr: string) => {
    if (onDateChange) {
      const fullDateStr = dateStr.length === 7 ? `${dateStr}-01` : dateStr;
      onDateChange(parseISO(fullDateStr));
    }
    setActiveTab(tabId);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="animate-fade-in space-y-8">
        <div className="mb-2">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">전기 점검 및 관리</h2>
          <p className="text-slate-500 mt-2 text-base font-medium">전기 설비 계통의 정기 점검 및 측정 일지를 통합 관리합니다.</p>
        </div>

        {/* Tab Navigation - 디자인 표준화 */}
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

        {/* Content Area */}
        <div className="min-h-[500px]">
          {activeTab === 'generator' && <GeneratorCheck currentDate={currentDate} />}
          {activeTab === 'meter' && <MeterCheckManager currentDate={currentDate} />} 
          {activeTab === 'battery' && <BatteryCheckLog currentDate={currentDate} />}
          {activeTab === 'load' && <LoadCurrentLog currentDate={currentDate} />}
          {activeTab === 'safety_general' && <SafetyCheckLog currentDate={currentDate} viewType="general" />}
          {activeTab === 'safety_ev' && <SafetyCheckLog currentDate={currentDate} viewType="ev" />}
          
          {!TABS.some(t => t.id === activeTab) && (
            <div className="flex flex-col items-center justify-center p-24 text-center bg-white rounded-3xl border border-slate-200 shadow-sm animate-fade-in">
              <div className="p-8 bg-slate-50 rounded-full mb-8">
                <Hammer size={64} className="text-slate-300" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-4">{TABS.find(t => t.id === activeTab)?.label}</h3>
              <div className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl text-sm font-black tracking-widest uppercase">
                Under Development
              </div>
              <p className="text-slate-400 mt-6 text-base max-w-sm">해당 모듈은 현재 고도화 작업 중입니다. 빠른 시일 내에 제공해 드리겠습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ElecCheckManager;
