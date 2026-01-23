
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

  const handleSave = async () => {
    if (!data) return;
    const success = await saveSepticLog(data);
    if (success) alert('저장되었습니다.');
    else alert('저장 실패');
  };

  const updateItemResult = (id: string, result: '양호' | '불량' | '') => {
    if (!data) return;
    const newItems = data.items.map(item => 
      item.id === id ? { ...item, result } : item
    );
    setData({ ...data, items: newItems });
  };

  const toggleResult = (item: SepticCheckItem) => {
    const next: '양호' | '불량' = item.result === '양호' ? '불량' : '양호';
    updateItemResult(item.id, next);
  };

  const thClass = "border border-black bg-gray-100 p-2 font-bold text-center align-middle text-[14px] h-10";
  const tdClass = "border border-black p-2 align-middle text-[14px] h-10 text-black";
  const resultClass = "border border-black p-1 text-center font-bold text-base w-28 cursor-pointer select-none transition-colors h-10";

  return (
    <LogSheetLayout
      title="정화조 일일 점검"
      date={dateKey}
      loading={loading}
      onRefresh={loadData}
      onSave={handleSave}
      hidePrint={true}
      hideRefresh={true}
    >
      <div id="septic-log-print-area" className="bg-white max-w-4xl mx-auto shadow-sm p-4">
        <div className="text-center mb-6 py-2">
            <h1 className="text-2xl font-bold tracking-widest text-black border-b-2 border-black inline-block px-8 pb-2">정 화 조 일 일 점 검 표</h1>
        </div>
        <table className="w-full border-collapse border-2 border-black">
          <thead>
            <tr>
              <th className={thClass}>일 일 점 검 내 용</th>
              <th className={`${thClass} w-28`}>점검결과</th>
            </tr>
          </thead>
          <tbody>
            {data?.items?.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                <td className={`${tdClass} pl-6 font-medium`}>• {item.content}</td>
                <td 
                  className={`${resultClass} ${item.result === '양호' ? 'text-blue-600 bg-blue-50/10' : item.result === '불량' ? 'text-red-600 bg-red-50' : 'text-gray-300'}`}
                  onClick={() => toggleResult(item)}
                >
                  {item.result || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 p-5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 flex items-start gap-4 print:hidden shadow-sm">
          <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
            <span className="font-bold text-xs uppercase tracking-tighter">Guide</span>
          </div>
          <div className="leading-relaxed">
            <p className="font-bold text-base mb-1">정화조 점검 안내</p>
            <p>• 결과 칸을 클릭하여 <span className="font-bold underline text-blue-700">양호</span>와 <span className="font-bold underline text-red-600">불량</span> 상태를 전환할 수 있습니다.</p>
            <p>• 모든 항목의 기본값은 사용자 요청에 따라 <strong>'양호'</strong>로 자동 설정되어 있습니다.</p>
            <p>• 이미지와 동일한 10가지 상세 점검 항목이 반영되었습니다.</p>
          </div>
        </div>
      </div>
    </LogSheetLayout>
  );
};

export default SepticLog;
