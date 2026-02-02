
import React, { useState, useEffect } from 'react';
import { GasLogData, GasCheckItem } from '../types';
import { fetchGasLog, saveGasLog, getInitialGasLog, saveToCache, getFromStorage } from '../services/dataService';
import { format } from 'date-fns';
import LogSheetLayout from './LogSheetLayout';

interface GasLogProps {
  currentDate: Date;
}

const GasLog: React.FC<GasLogProps> = ({ currentDate }) => {
  const [loading, setLoading] = useState(false);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const [data, setData] = useState<GasLogData>(getInitialGasLog(dateKey));

  useEffect(() => {
    loadData();
  }, [dateKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetched = await fetchGasLog(dateKey);
      const draft = getFromStorage(`GAS_LOG_DRAFT_${dateKey}`, true);
      setData(draft || fetched || getInitialGasLog(dateKey));
    } catch (e) {
      console.error(e);
      setData(getInitialGasLog(dateKey));
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
    saveToCache(`GAS_LOG_DRAFT_${dateKey}`, newData, true);
  };

  const toggleResult = (item: GasCheckItem) => {
    const next: '양호' | '불량' = item.result === '양호' ? '불량' : '양호';
    updateItemResult(item.id, next);
  };

  const categories = ['정압실', '배관 계통', '연소 장치', '경보 장치'];
  const groupedItems: Record<string, GasCheckItem[]> = {};
  data?.items?.forEach(item => {
    if (!groupedItems[item.category]) groupedItems[item.category] = [];
    groupedItems[item.category].push(item);
  });

  const thClass = "border border-gray-300 bg-slate-100 p-2 font-bold text-center align-middle text-[13px] h-11 text-slate-700 uppercase tracking-tight";
  const tdClass = "border border-gray-300 p-2 align-middle text-[13px] h-11 text-slate-800 font-medium";
  const labelClass = "border border-gray-300 p-2 font-bold text-center align-middle w-24 text-[13px] bg-white text-slate-700";
  const resultClass = (res: string) => `border border-gray-300 p-1 text-center font-black text-[14px] w-28 cursor-pointer select-none transition-colors h-11 ${res === '양호' ? 'text-blue-600' : 'text-red-600 bg-red-50'}`;

  return (
    <LogSheetLayout
      title={<div className="flex items-center gap-2"><h2 className="text-2xl font-black text-slate-800">가스일일점검</h2></div>}
      date={dateKey}
      loading={loading}
      hidePrint={true}
      hideRefresh={true}
      hideSave={true}
      isEmbedded={true}
    >
      <div id="gas-log-print-area" className="bg-white max-w-4xl mx-auto shadow-sm">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-slate-100">
              <th className={`${thClass} w-24`}>구 분</th>
              <th className={thClass}>점 검 내 용</th>
              <th className={`${thClass} w-28`}>결 과</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(category => (
              <React.Fragment key={category}>
                {groupedItems[category]?.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    {idx === 0 && (
                      <td 
                        rowSpan={groupedItems[category].length} 
                        className={labelClass}
                      >
                        {category}
                      </td>
                    )}
                    <td className={`${tdClass} pl-6`}>• {item.content}</td>
                    <td 
                      className={resultClass(item.result as string)}
                      onClick={() => toggleResult(item)}
                    >
                      {item.result || '양호'}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </LogSheetLayout>
  );
};

export default GasLog;
