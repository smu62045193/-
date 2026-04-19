
import React, { useState, useEffect } from 'react';
import { ElevatorLogData, ElevatorLogItem, ElevatorResult } from '../types';
import { fetchElevatorLog, saveElevatorLog, getInitialElevatorLog } from '../services/dataService';
import { format } from 'date-fns';
import LogSheetLayout from './LogSheetLayout';

interface ElevatorLogProps {
  currentDate: Date;
  isEmbedded?: boolean;
}

const ElevatorLog: React.FC<ElevatorLogProps> = ({ currentDate, isEmbedded = false }) => {
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

  const thClass = "border border-black bg-white font-normal text-center text-[13px] text-black h-[32px]";
  const tdClass = "border border-black p-0 h-[32px] relative bg-white text-center text-black";
  const labelClass = "border border-black p-0 font-normal text-center bg-white text-black align-middle w-28 text-[13px] h-[32px]";
  const resultCellClass = (res: ElevatorResult) => `w-full h-full flex items-center justify-center cursor-pointer select-none font-normal text-[13px] transition-colors px-2 ${res === '양호' ? 'text-blue-600' : res === '불량' ? 'text-red-600' : 'text-slate-300'}`;

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
      <div id="elevator-log-print-area" className={`bg-white ${isEmbedded ? 'w-full' : 'max-w-7xl mx-auto'}`}>
        <div className="bg-white overflow-hidden">
          <table className="w-full border-collapse border border-black">
            <thead>
              <tr className="bg-white border-b border-black h-[32px]">
                <th className={`${thClass} w-28`}><div className="flex items-center justify-center h-full px-2">구 &nbsp; 분</div></th>
                {elevatorLabels.map((label) => (
                  <th key={label} className={`${thClass} w-16`}><div className="flex items-center justify-center h-full px-2">{label}</div></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="h-[32px] bg-white border-b border-black">
                  <td className={labelClass}>
                    <div className="flex items-center justify-center h-full px-2">{item.content}</div>
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
              <tr className="h-20 border-b border-black last:border-0">
                <td className={`${labelClass} font-normal text-[13px] h-20`}>
                  <div className="flex items-center justify-center h-full px-2">특 이 사 항</div>
                </td>
                <td colSpan={5} className="p-0 h-20 border border-black">
                  <textarea 
                    value={data.remarks || ''} 
                    onChange={(e) => updateRemarks(e.target.value)}
                    placeholder="특이사항 입력"
                    className="w-full h-full p-2 resize-none outline-none text-black text-[13px] leading-relaxed font-normal bg-transparent !text-center scrollbar-hide border-none shadow-none appearance-none"
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
