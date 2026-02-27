
import React, { useState, useEffect } from 'react';
import { ElevatorLogData, ElevatorLogItem, ElevatorResult } from '../types';
import { fetchElevatorLog, saveElevatorLog, getInitialElevatorLog } from '../services/dataService';
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
  
  useEffect(() => {
    loadData();
  }, [dateKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetched = await fetchElevatorLog(dateKey);
      const finalData = fetched || getInitialElevatorLog(dateKey);
      setData(finalData);
    } catch (e) {
      console.error(e);
      setData(getInitialElevatorLog(dateKey));
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

  const thClass = "border border-slate-300 p-2 bg-slate-100 font-bold text-center text-[13px] text-slate-700 h-9";
  const tdClass = "border border-slate-300 p-0 h-9 relative bg-white";
  const labelClass = "border border-slate-300 p-1 font-bold text-center bg-white text-slate-700 align-middle w-28 text-[13px]";
  const resultCellClass = (res: ElevatorResult) => `w-full h-full flex items-center justify-center cursor-pointer select-none font-black text-[13px] transition-colors ${res === '양호' ? 'text-blue-600' : res === '불량' ? 'text-red-600 bg-red-50' : 'text-slate-300'}`;

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
      hideHeader={true}
    >
      <div id="elevator-log-print-area" className="bg-white max-w-5xl mx-auto shadow-sm p-1">
        <div className="mb-2 px-1">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">승강기 일일 점검 일지</h3>
        </div>
        <div className="bg-white border border-slate-300 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className={`${thClass} w-28`}>구 &nbsp; 분</th>
                {elevatorLabels.map((label) => (
                  <th key={label} className={`${thClass} w-16`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="h-9 hover:bg-slate-50/50 transition-colors">
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
              <tr className="h-20">
                <td className={`${labelClass} font-black text-[13px]`}>
                  특 이 사 항
                </td>
                <td colSpan={5} className="border border-slate-300 p-0 h-20">
                  <textarea 
                    value={data.remarks || ''} 
                    onChange={(e) => updateRemarks(e.target.value)}
                    placeholder="특이사항 입력"
                    className="w-full h-full p-2 resize-none outline-none text-slate-700 text-[13px] leading-relaxed font-medium bg-transparent !text-left scrollbar-hide"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </LogSheetLayout>
  );
};

export default ElevatorLog;
