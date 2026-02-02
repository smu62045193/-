
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
          // 이미지 요청: 양호 ↔ 불량 토글
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

  const thClass = "border border-slate-300 p-2 bg-slate-100 font-bold text-center text-sm text-slate-700 h-11";
  const tdClass = "border border-slate-300 p-0 h-11 relative bg-white";
  const labelClass = "border border-slate-300 p-2 font-bold text-center bg-white text-slate-700 align-middle w-32 text-[14px]";
  const resultCellClass = (res: ElevatorResult) => `w-full h-full flex items-center justify-center cursor-pointer select-none font-black text-[15px] transition-colors ${res === '양호' ? 'text-blue-600' : res === '불량' ? 'text-red-600 bg-red-50' : 'text-slate-300'}`;

  return (
    <LogSheetLayout
      title={<div className="flex items-center gap-2"><h2 className="text-2xl font-black text-slate-800">승강기 일일 점검 일지</h2></div>}
      loading={loading}
      saveStatus={saveStatus}
      onRefresh={loadData}
      onSave={handleSave}
      hidePrint={true}
      hideRefresh={true}
      hideSave={true}
      isEmbedded={true}
    >
      <div id="elevator-log-print-area" className="bg-white max-w-5xl mx-auto shadow-sm p-1">
        <div className="bg-white border border-slate-300 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className={`${thClass} w-32`}>구 &nbsp; 분</th>
                {elevatorLabels.map((label) => (
                  <th key={label} className={`${thClass} w-20`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="h-11 hover:bg-slate-50/50 transition-colors">
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
              <tr className="h-28">
                <td className={`${labelClass} font-black text-sm`}>
                  특 이 사 항
                </td>
                <td colSpan={5} className="border border-slate-300 p-0 h-28">
                  <textarea 
                    value={data.remarks || ''} 
                    onChange={(e) => updateRemarks(e.target.value)}
                    placeholder="특이사항 입력"
                    className="w-full h-full p-4 resize-none outline-none text-slate-700 text-[14px] leading-relaxed font-medium bg-transparent !text-left scrollbar-hide"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-3 print:hidden shadow-sm">
          <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600 font-black text-[10px] uppercase tracking-tighter">
            GUIDE
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
