
import React, { useState, useEffect } from 'react';
import { SubstationLogData } from '../types';
import { fetchSubstationLog, saveSubstationLog, getInitialSubstationLog } from '../services/dataService';
import { format } from 'date-fns';
import { Save, Zap } from 'lucide-react';

interface ElectricityUsageProps {
  currentDate: Date;
}

const ElectricityUsage: React.FC<ElectricityUsageProps> = ({ currentDate }) => {
  const [loading, setLoading] = useState(false);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  
  // Initialize with default data immediately to prevent "Loading..." screen
  const [data, setData] = useState<SubstationLogData>(getInitialSubstationLog(dateKey));

  useEffect(() => {
    // Reset to defaults for new date immediately while fetching
    setData(getInitialSubstationLog(dateKey));
    loadData();
  }, [dateKey]);

  const loadData = async () => {
    setLoading(true);
    const fetched = await fetchSubstationLog(dateKey);
    setData(fetched);
    setLoading(false);
  };

  const handleSave = async () => {
    const success = await saveSubstationLog(data);
    if (success) alert('저장되었습니다.');
    else alert('저장 실패');
  };

  const updateStats = (field: keyof typeof data.dailyStats, value: string) => {
    setData({
      ...data,
      dailyStats: {
        ...data.dailyStats,
        [field]: value
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputs = Array.from(document.querySelectorAll('input:not([disabled]):not([type="hidden"]):not([readonly])'));
      const index = inputs.indexOf(e.currentTarget);
      if (index > -1 && index < inputs.length - 1) {
        (inputs[index + 1] as HTMLElement).focus();
      }
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex justify-between items-center pb-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <Zap className="mr-2 text-yellow-500" />
          전기 사용량 현황
        </h2>
        <div className="flex gap-2">
          <button onClick={handleSave} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold shadow-sm">
            <Save size={18} className="mr-2" />
            저장
          </button>
        </div>
      </div>

      <div className="p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700 font-medium">
          ※ 이 데이터는 <strong>수변전반 일지 - 4. 일사용량</strong> 데이터와 연동됩니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Main Usage */}
        <div className="space-y-4">
          <div className="flex flex-col">
            <label className="text-sm font-bold text-gray-600 mb-1">유효전력량 (일사용량)</label>
            <div className="relative">
              <input 
                type="text" 
                value={data.dailyStats.activePower} 
                onChange={e => updateStats('activePower', e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-white border-b-2 border-gray-300 px-2 py-3 text-xl font-bold text-gray-900 focus:border-blue-500 outline-none"
                placeholder="0"
              />
              <span className="absolute right-4 top-3.5 text-gray-500 font-bold">kWh</span>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-bold text-gray-600 mb-1">무효전력량</label>
            <div className="relative">
              <input 
                type="text" 
                value={data.dailyStats.reactivePower} 
                onChange={e => updateStats('reactivePower', e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-white border-b-2 border-gray-300 px-2 py-3 text-lg text-gray-900 focus:border-blue-500 outline-none"
                placeholder="0"
              />
              <span className="absolute right-4 top-3.5 text-gray-500 font-bold">kVarh</span>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-bold text-gray-600 mb-1">최대전력 (Peak)</label>
            <div className="relative">
              <input 
                type="text" 
                value={data.dailyStats.maxPower} 
                onChange={e => updateStats('maxPower', e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-white border-b-2 border-gray-300 px-2 py-3 text-lg text-gray-900 focus:border-blue-500 outline-none"
                placeholder="0"
              />
              <span className="absolute right-4 top-3.5 text-gray-500 font-bold">kW</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          <div className="flex flex-col">
            <label className="text-sm font-bold text-gray-600 mb-1">금월 누계</label>
            <div className="relative">
              <input 
                type="text" 
                value={data.dailyStats.monthTotal} 
                onChange={e => updateStats('monthTotal', e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-white border-b-2 border-gray-300 px-2 py-3 text-lg text-gray-900 focus:border-blue-500 outline-none"
                placeholder="0"
              />
              <span className="absolute right-4 top-3.5 text-gray-500 font-bold">kWh</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-500 mb-1">역율</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={data.dailyStats.powerFactor} 
                  onChange={e => updateStats('powerFactor', e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-white border-b border-gray-300 px-2 py-2 text-center text-gray-900 focus:border-blue-500 outline-none"
                />
                <span className="absolute right-2 top-2 text-gray-400 text-xs">%</span>
              </div>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-500 mb-1">부하율</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={data.dailyStats.loadFactor} 
                  onChange={e => updateStats('loadFactor', e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-white border-b border-gray-300 px-2 py-2 text-center text-gray-900 focus:border-blue-500 outline-none"
                />
                <span className="absolute right-2 top-2 text-gray-400 text-xs">%</span>
              </div>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-500 mb-1">수용율</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={data.dailyStats.demandFactor} 
                  onChange={e => updateStats('demandFactor', e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-white border-b border-gray-300 px-2 py-2 text-center text-gray-900 focus:border-blue-500 outline-none"
                />
                <span className="absolute right-2 top-2 text-gray-400 text-xs">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElectricityUsage;
