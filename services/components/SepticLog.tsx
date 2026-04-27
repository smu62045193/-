
import React, { useState, useEffect } from 'react';
import { SepticLogData, SepticCheckItem } from '../types';
import { fetchSepticLog, saveSepticLog, getInitialSepticLog } from '../services/dataService';
import { format } from 'date-fns';
import LogSheetLayout from './LogSheetLayout';

interface SepticLogProps {
  currentDate: Date;
  data?: SepticLogData;
  onDataChange?: (data: SepticLogData) => void;
  isEmbedded?: boolean;
}

const SepticLog: React.FC<SepticLogProps> = ({ currentDate, data: externalData, onDataChange, isEmbedded = false }) => {
  const [loading, setLoading] = useState(false);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const [internalData, setInternalData] = useState<SepticLogData>(getInitialSepticLog(dateKey));

  const data = externalData || internalData;
  const setData = onDataChange || setInternalData;

  useEffect(() => {
    if (!externalData) {
      loadData();
    }
  }, [dateKey, externalData]);

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

  const thClass = "border border-black bg-white font-normal text-center text-[13px] text-black h-[32px]";
  const tdClass = "border border-black p-0 h-[32px] relative bg-white text-center text-black";
  const resultClass = (res: string) => `w-full h-full flex items-center justify-center cursor-pointer select-none font-normal text-[13px] transition-colors px-2 ${res === '양호' ? 'text-blue-600' : 'text-red-600'}`;

  return (
    <LogSheetLayout
      title={<div className="flex items-center gap-2"><h2 className="text-2xl font-black text-slate-800">정화조일일점검</h2></div>}
      date={dateKey}
      loading={loading}
      hidePrint={true}
      hideRefresh={isEmbedded}
      hideSave={isEmbedded}
      hideHeader={isEmbedded}
      isEmbedded={isEmbedded}
    >
      <div id="septic-log-print-area" className={`bg-white ${isEmbedded ? 'w-full' : 'max-w-7xl mx-auto'}`}>
        <table className="w-full border-collapse border border-black">
          <thead>
            <tr className="bg-white border-b border-black h-[32px]">
              <th className={thClass}><div className="flex items-center justify-center h-full px-2">점 검 내 용</div></th>
              <th className={`${thClass} w-28`}><div className="flex items-center justify-center h-full px-2">결 과</div></th>
            </tr>
          </thead>
          <tbody>
            {data?.items?.map((item) => (
              <tr key={item.id} className="h-[32px] bg-white border-b border-black">
                <td className={tdClass}>
                  <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">• {item.content}</div>
                </td>
                <td 
                  className={tdClass}
                  onClick={() => toggleResult(item)}
                >
                  <div className={resultClass(item.result as string)}>
                    {item.result || '양호'}
                  </div>
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
