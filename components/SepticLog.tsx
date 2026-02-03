
import React, { useState, useEffect } from 'react';
import { SepticLogData, SepticCheckItem } from '../types';
import { fetchSepticLog, saveSepticLog, getInitialSepticLog } from '../services/dataService';
import { format } from 'date-fns';
import LogSheetLayout from './LogSheetLayout';

interface SepticLogProps {
  currentDate: Date;
}

const SepticLog: React.FC<SepticLogProps> = ({ currentDate }) => {
  const [loading, setLoading] = useState(false);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const [data, setData] = useState<SepticLogData>(getInitialSepticLog(dateKey));

  useEffect(() => {
    loadData();
  }, [dateKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetched = await fetchSepticLog(dateKey);
      setData(fetched || getInitialSepticLog(dateKey));
    } catch (e) {
      console.error(e);
      setData(getInitialSepticLog(dateKey));
    } finally {
      setLoading(false);
    }
  };

  const updateItemResult = (id: string, result: '양호' | '불량' | '') => {
    if (!data) return;
    const newItems = data.items.map(item => 
      item.id === id ? { ...item, result } : item
    );
    const newData = { ...data, items: newItems };
    setData(newData);
  };

  const toggleResult = (item: SepticCheckItem) => {
    const next: '양호' | '불량' = item.result === '양호' ? '불량' : '양호';
    updateItemResult(item.id, next);
  };

  const thClass = "border border-gray-300 bg-slate-100 p-2 font-bold text-center align-middle text-[13px] h-11 text-slate-700 uppercase tracking-tight";
  const tdClass = "border border-gray-300 p-2 align-middle text-[13px] h-11 text-slate-800 font-medium";
  const resultClass = (res: string) => `border border-gray-300 p-1 text-center font-black text-[14px] w-28 cursor-pointer select-none transition-colors h-11 ${res === '양호' ? 'text-blue-600' : 'text-red-600 bg-red-50'}`;

  return (
    <LogSheetLayout
      title={<div className="flex items-center gap-2"><h2 className="text-2xl font-black text-slate-800">정화조일일점검</h2></div>}
      date={dateKey}
      loading={loading}
      hidePrint={true}
      hideRefresh={true}
      hideSave={true}
      isEmbedded={true}
    >
      <div id="septic-log-print-area" className="bg-white max-w-4xl mx-auto shadow-sm">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-slate-100">
              <th className={thClass}>점 검 내 용</th>
              <th className={`${thClass} w-28`}>결 과</th>
            </tr>
          </thead>
          <tbody>
            {data?.items?.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className={`${tdClass} pl-6`}>• {item.content}</td>
                <td 
                  className={resultClass(item.result as string)}
                  onClick={() => toggleResult(item)}
                >
                  {item.result || '양호'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LogSheetLayout>
  );
};

export default SepticLog;
