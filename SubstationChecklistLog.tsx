
import React, { useState, useEffect } from 'react';
import { SubstationChecklistData, SubstationCheckItem } from '../types';
import { fetchSubstationChecklist, saveSubstationChecklist, getInitialSubstationChecklist } from '../services/dataService';
import { format } from 'date-fns';
import LogSheetLayout from './LogSheetLayout';

interface SubstationChecklistLogProps {
  currentDate: Date;
  isEmbedded?: boolean;
}

const SubstationChecklistLog: React.FC<SubstationChecklistLogProps> = ({ currentDate, isEmbedded = false }) => {
  const [loading, setLoading] = useState(false);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const [data, setData] = useState<SubstationChecklistData>(getInitialSubstationChecklist(dateKey));

  useEffect(() => {
    loadData();
  }, [dateKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetched = await fetchSubstationChecklist(dateKey);
      setData(fetched || getInitialSubstationChecklist(dateKey));
    } catch (e) {
      console.error(e);
      setData(getInitialSubstationChecklist(dateKey));
    } finally {
      setLoading(false);
    }
  };

  const toggleResult = (id: string) => {
    if (!data || !data.items) return;
    const newItems = data.items.map(item => {
      if (item.id === id) {
        const nextResult: '양호' | '불량' = item.result === '양호' ? '불량' : '양호';
        return { ...item, result: nextResult };
      }
      return item;
    });
    setData({ ...data, items: newItems });
  };

  const safeItems = data?.items || [];
  
  // Left Column: Transformer (7 items) + VCB A B (3 items)
  const leftColItems = [
    ...safeItems.filter(i => i.category === '변압기'),
    ...safeItems.filter(i => i.category === 'VCB A B')
  ];
  
  // Right Column: ATS (9 items)
  const rightColItems = safeItems.filter(i => i.category === 'ATS');

  const thClass = "border border-slate-300 p-2 bg-slate-100 font-bold text-center text-[13px] text-slate-700 h-11 uppercase tracking-tight";
  const tdClass = "border border-slate-300 p-2 text-left bg-white text-slate-900 h-11 text-[13px] font-medium pl-4";
  const labelClass = "border border-slate-300 p-2 font-bold text-center bg-white text-slate-700 align-middle w-20 text-[13px]";
  const resultClass = (res: string) => `border border-slate-300 p-1 text-center font-black text-[13px] w-28 cursor-pointer select-none transition-colors h-11 ${res === '양호' ? 'text-blue-600' : 'text-red-600 bg-red-50'}`;

  const renderRow = (item: SubstationCheckItem, idx: number, arr: SubstationCheckItem[]) => {
    const isFirstInCategory = idx === 0 || arr[idx - 1].category !== item.category;
    const categoryCount = arr.filter(i => i.category === item.category).length;

    return (
      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
        {isFirstInCategory && (
          <td rowSpan={categoryCount} className={labelClass}>
            {item.category}
          </td>
        )}
        <td className={tdClass}>• {item.label}</td>
        <td 
          className={resultClass(item.result as string)}
          onClick={() => toggleResult(item.id)}
        >
          {item.result || '양호'}
        </td>
      </tr>
    );
  };

  return (
    <LogSheetLayout
      title={<div className="flex items-center gap-2"><h2 className="text-2xl font-black text-slate-800">수변전반 점검표</h2></div>}
      loading={loading}
      hidePrint={true}
      hideRefresh={isEmbedded}
      hideSave={isEmbedded}
      isEmbedded={isEmbedded}
    >
      <div id="substation-checklist-print-area" className="bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-0 border-t border-l border-slate-300 overflow-hidden shadow-sm">
          {/* Left Side Section */}
          <div className="border-r border-slate-300">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thClass} style={{ width: '80px' }}>구 분</th>
                  <th className={thClass}>점 검 내 용</th>
                  <th className={thClass} style={{ width: '110px' }}>점검결과</th>
                </tr>
              </thead>
              <tbody>
                {leftColItems.map((item, idx) => renderRow(item, idx, leftColItems))}
              </tbody>
            </table>
          </div>

          {/* Right Side Section */}
          <div className="border-r border-slate-300">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thClass} style={{ width: '80px' }}>구 분</th>
                  <th className={thClass}>점 검 내 용</th>
                  <th className={thClass} style={{ width: '110px' }}>점검결과</th>
                </tr>
              </thead>
              <tbody>
                {rightColItems.map((item, idx) => renderRow(item, idx, rightColItems))}
                {/* 우측 하단 높이 밸런스를 위한 빈 행 (필요시) */}
                <tr className="h-11">
                  <td className="border border-slate-300 bg-white"></td>
                  <td className="border border-slate-300 bg-white"></td>
                  <td className="border border-slate-300 bg-white"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {!isEmbedded && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-start gap-3 shadow-sm print:hidden">
          <div className="leading-relaxed">
            <p className="font-bold mb-1">수변전반 점검 안내</p>
            <p>• 결과 칸을 클릭하면 <span className="font-bold underline text-blue-700">양호</span>와 <span className="font-bold underline text-red-600">불량</span>이 토글됩니다.</p>
            <p>• 이미지와 동일한 <b>변압기(7), VCB A B(3), ATS(9)</b> 항목으로 구성되었습니다.</p>
          </div>
        </div>
      )}
    </LogSheetLayout>
  );
};

export default SubstationChecklistLog;
