import React, { useState, useEffect, useRef } from 'react';
import { ElevatorLogData, ElevatorLogItem, ElevatorResult } from '../types';
import { fetchElevatorLog, saveElevatorLog, getInitialElevatorLog, saveToCache, getFromStorage } from '../services/dataService';
import { format } from 'date-fns';
import LogSheetLayout from './LogSheetLayout';

interface ElevatorLogProps {
  currentDate: Date;
}

const ElevatorLog: React.FC<ElevatorLogProps> = ({ currentDate }) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const [data, setData] = useState<ElevatorLogData>(getInitialElevatorLog(dateKey));
  
  const isInitialLoad = useRef(true);

  useEffect(() => {
    isInitialLoad.current = true;
    loadData();
  }, [dateKey]);

  useEffect(() => {
    if (!loading && !isInitialLoad.current && data) {
      saveToCache(`ELEVATOR_LOG_${dateKey}`, data, true);
    }
  }, [data, dateKey, loading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetched = await fetchElevatorLog(dateKey);
      const draft = getFromStorage(`ELEVATOR_LOG_${dateKey}`, true);
      
      const finalData = draft || fetched || getInitialElevatorLog(dateKey);
      setData(finalData);
      
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 100);
    } catch (e) {
      console.error(e);
      setData(getInitialElevatorLog(dateKey));
      isInitialLoad.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data || saveStatus === 'loading') return;
    setSaveStatus('loading');
    try {
      const success = await saveElevatorLog(data);
      if (success) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장에 실패했습니다.');
      }
    } catch (e) { 
      setSaveStatus('error'); 
    }
  };

  const updateResult = (itemId: string, elevatorKey: keyof ElevatorLogItem['results']) => {
    setData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          const current = item.results[elevatorKey];
          const next: ElevatorResult = current === '양호' ? '불량' : '양호';
          return { ...item, results: { ...item.results, [elevatorKey]: next } };
        }
        return item;
      })
    }));
  };

  const updateRemarks = (val: string) => {
    setData(prev => ({ ...prev, remarks: val }));
  };

  const elevators = ['ev1', 'ev2', 'ev3', 'ev4', 'ev5'] as const;
  const elevatorLabels = ['1호기', '2호기', '3호기', '4호기', '5호기'];

  const thClass = "border border-gray-300 p-1.5 bg-gray-100 font-bold text-center text-sm text-gray-700 h-10";
  const tdClass = "border border-gray-300 p-0 h-9 relative bg-white";
  const labelClass = "border border-gray-300 p-1.5 font-bold text-center bg-white text-gray-700 align-middle w-40 text-[13px] tracking-tighter";
  const resultCellClass = (res: ElevatorResult) => `w-full h-full flex items-center justify-center cursor-pointer select-none font-bold text-sm transition-colors ${res === '양호' ? 'text-blue-600 bg-blue-50/10' : res === '불량' ? 'text-red-600 bg-red-50' : 'text-gray-300'}`;

  return (
    <LogSheetLayout
      title="승강기 일일 점검 일지"
      loading={loading}
      saveStatus={saveStatus}
      onRefresh={loadData}
      onSave={handleSave}
      hidePrint={true}
      hideRefresh={true}
      hideSave={true}
      isEmbedded={true}
    >
      <div id="elevator-log-print-area" className="bg-white max-w-5xl mx-auto shadow-sm p-4">
        <div className="bg-white border border-gray-300 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className={`${thClass} w-40`}>구 &nbsp; &nbsp; 분</th>
                {elevatorLabels.map((label) => (
                  <th key={label} className={`${thClass} w-20`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="h-9 hover:bg-gray-50/30 transition-colors">
                  <td className={labelClass}>
                    {item.content}
                  </td>
                  {elevators.map((evKey) => {
                    const res = item.results[evKey];
                    return (
                      <td 
                        key={evKey} 
                        className={tdClass}
                        onClick={() => updateResult(item.id, evKey)}
                      >
                        <div className={resultCellClass(res)}>
                          {res || '양호'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="h-24">
                <td className={`${labelClass} font-black text-sm`}>
                  특 &nbsp; 이 &nbsp; 사 &nbsp; 항
                </td>
                <td colSpan={5} className="border border-gray-300 p-0 h-24">
                  <textarea 
                    value={data.remarks || ''} 
                    onChange={(e) => updateRemarks(e.target.value)}
                    placeholder="특이사항 입력"
                    className="w-full h-full p-3 resize-none outline-none text-gray-700 text-[13px] leading-relaxed font-medium bg-transparent !text-left"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-3 print:hidden shadow-sm">
          <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600">
            <span className="font-bold text-[10px] uppercase tracking-tighter">Guide</span>
          </div>
          <div className="leading-relaxed">
            <p className="font-bold text-sm mb-0.5">승강기 점검 안내</p>
            <p>• 결과 칸을 클릭하여 <span className="font-bold underline text-blue-700">양호</span>와 <span className="font-bold underline text-red-600">불량</span> 상태를 전환할 수 있습니다.</p>
          </div>
        </div>
      </div>
    </LogSheetLayout>
  );
};

export default ElevatorLog;