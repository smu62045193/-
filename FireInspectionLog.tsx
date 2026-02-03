
import React, { useState, useEffect } from 'react';
import { FireInspectionLogData, FireInspectionItem } from '../types';
import { fetchFireInspectionLog, saveFireInspectionLog, getInitialFireInspectionLog } from '../services/dataService';
import { format } from 'date-fns';
import LogSheetLayout from './LogSheetLayout';

interface FireInspectionLogProps {
  currentDate?: Date;
}

const FireInspectionLog: React.FC<FireInspectionLogProps> = ({ currentDate = new Date() }) => {
  const [loading, setLoading] = useState(false);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const [data, setData] = useState<FireInspectionLogData>(getInitialFireInspectionLog(dateKey));

  useEffect(() => {
    loadData();
  }, [dateKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetched = await fetchFireInspectionLog(dateKey);
      setData(fetched || getInitialFireInspectionLog(dateKey));
    } catch (e) {
      console.error(e);
      setData(getInitialFireInspectionLog(dateKey));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data) return;
    const success = await saveFireInspectionLog(data);
    if (success) alert('저장되었습니다.');
    else alert('저장 실패');
  };

  const updateItem = (id: string, field: keyof FireInspectionItem, value: string) => {
    if (!data) return;
    const newItems = data.items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    setData({ ...data, items: newItems });
  };

  const updateInspector = (val: string) => {
    if (!data) return;
    setData({ ...data, inspector: val });
  };

  // Group items by category
  const groupedItems: Record<string, FireInspectionItem[]> = {};
  data?.items?.forEach(item => {
    if (!groupedItems[item.category]) groupedItems[item.category] = [];
    groupedItems[item.category].push(item);
  });

  const thClass = "border border-black bg-white p-2 font-bold text-center align-middle text-sm";
  const tdClass = "border border-black p-2 align-middle text-sm";

  return (
    <LogSheetLayout
      title="소방 점검 일지"
      date={dateKey}
      loading={loading}
      onRefresh={loadData}
      onSave={handleSave}
    >
      <div className="border border-black">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${thClass} w-32`}>구분</th>
              <th className={thClass}>점 검 내 용</th>
              <th className={`${thClass} w-24`}>결 과</th>
              <th className={`${thClass} w-48`}>비 고</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(groupedItems).map(category => (
              <React.Fragment key={category}>
                {groupedItems[category].map((item, idx) => (
                  <tr key={item.id}>
                    {idx === 0 && (
                      <td 
                        rowSpan={groupedItems[category].length} 
                        className="border border-black p-2 font-bold text-center align-middle bg-gray-50"
                      >
                        {category}
                      </td>
                    )}
                    <td className={`${tdClass} pl-4`}>{item.content}</td>
                    <td className={`${tdClass} text-center`}>
                      <div className="flex justify-center gap-2 print:hidden">
                        <button 
                          onClick={() => updateItem(item.id, 'result', item.result === '양호' ? '' : '양호')}
                          className={`px-3 py-1 rounded border border-gray-300 font-bold text-sm transition-colors ${item.result === '양호' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                        >
                          양호
                        </button>
                        <button 
                          onClick={() => updateItem(item.id, 'result', item.result === '불량' ? '' : '불량')}
                          className={`px-3 py-1 rounded border border-gray-300 font-bold text-sm transition-colors ${item.result === '불량' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                        >
                          불량
                        </button>
                      </div>
                      <span className={`hidden print:inline font-bold text-lg ${item.result === '불량' ? 'text-red-600' : ''}`}>
                        {item.result}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <input 
                        type="text" 
                        value={item.remarks} 
                        onChange={(e) => updateItem(item.id, 'remarks', e.target.value)}
                        className="w-full h-full p-1 outline-none bg-transparent"
                      />
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end items-center gap-4 border border-black p-4 bg-white print:border-none">
        <span className="font-bold text-lg">점검자 :</span>
        <input 
          type="text" 
          value={data.inspector} 
          onChange={(e) => updateInspector(e.target.value)}
          className="border-b-2 border-black w-48 text-center text-lg outline-none bg-white text-black font-medium"
          placeholder="(서명)"
        />
      </div>
    </LogSheetLayout>
  );
};

export default FireInspectionLog;
