
import React, { useState, useEffect } from 'react';
import { GasLogData, GasCheckItem } from '../types';
import { fetchGasLog, saveGasLog, getInitialGasLog } from '../services/dataService';
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
      setData(fetched || getInitialGasLog(dateKey));
    } catch (e) {
      console.error(e);
      setData(getInitialGasLog(dateKey));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data) return;
    const success = await saveGasLog(data);
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

  const toggleResult = (item: GasCheckItem) => {
    const next: '양호' | '불량' = item.result === '양호' ? '불량' : '양호';
    updateItemResult(item.id, next);
  };

  // 이미지 요청 순서대로 카테고리 구성
  const categories = ['정압실', '배관 계통', '연소 장치', '경보 장치'];
  const groupedItems: Record<string, GasCheckItem[]> = {};
  data?.items?.forEach(item => {
    if (!groupedItems[item.category]) groupedItems[item.category] = [];
    groupedItems[item.category].push(item);
  });

  const thClass = "border border-black bg-gray-100 p-2 font-bold text-center align-middle text-[14px] h-12";
  const tdClass = "border border-black p-2 align-middle text-[14px] h-11 text-black";
  const labelClass = "border border-black p-2 font-bold text-center align-middle w-24 text-[14px] bg-white";
  const resultClass = "border border-black p-1 text-center font-bold text-base w-32 cursor-pointer select-none transition-colors h-11";

  return (
    <LogSheetLayout
      title="가스일일점검표"
      date={dateKey}
      loading={loading}
      onRefresh={loadData}
      onSave={handleSave}
      hidePrint={true}
      hideRefresh={true}
    >
      <div id="gas-log-print-area" className="bg-white max-w-4xl mx-auto shadow-sm p-4">
        <div className="text-center mb-6 py-2">
            <h1 className="text-2xl font-bold tracking-widest text-black border-b-2 border-black inline-block px-8 pb-2">가 스 일 일 점 검 표</h1>
        </div>
        <table className="w-full border-collapse border-2 border-black">
          <thead>
            <tr className="bg-gray-100">
              <th className={`${thClass} w-24`}>구분</th>
              <th className={thClass}>일 일 점 검 내 용</th>
              <th className={`${thClass} w-32`}>점검결과</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(category => (
              <React.Fragment key={category}>
                {groupedItems[category]?.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    {idx === 0 && (
                      <td 
                        rowSpan={groupedItems[category].length} 
                        className={labelClass}
                      >
                        {category.split(' ').map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </td>
                    )}
                    <td className={`${tdClass} pl-6 font-medium`}>• {item.content}</td>
                    <td 
                      className={`${resultClass} ${item.result === '양호' ? 'text-blue-600 bg-blue-50/10' : item.result === '불량' ? 'text-red-600 bg-red-50' : 'text-gray-300'}`}
                      onClick={() => toggleResult(item)}
                    >
                      {item.result || '-'}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        
        <div className="mt-8 p-5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 flex items-start gap-4 print:hidden shadow-sm">
          <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
            <span className="font-bold text-xs uppercase tracking-tighter">Guide</span>
          </div>
          <div className="leading-relaxed">
            <p className="font-bold text-base mb-1">가스 점검 안내</p>
            <p>• 결과 칸을 클릭하여 <span className="font-bold underline text-blue-700">양호</span>와 <span className="font-bold underline text-red-600">불량</span> 상태를 전환할 수 있습니다.</p>
            <p>• 모든 항목의 기본값은 사용자 요청에 따라 <strong>'양호'</strong>로 자동 설정되어 있습니다.</p>
            <p>• 이미지와 동일한 항목 구성(정압실, 배관 계통, 연소 장치, 경보 장치)이 완료되었습니다.</p>
          </div>
        </div>
      </div>
    </LogSheetLayout>
  );
};

export default GasLog;
