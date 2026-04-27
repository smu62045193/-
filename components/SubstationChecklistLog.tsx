
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

  useEffect(() => {
    const handleGlobalSave = () => {
      if (data) saveSubstationChecklist(data);
    };
    window.addEventListener('checklist-save', handleGlobalSave);
    return () => window.removeEventListener('checklist-save', handleGlobalSave);
  }, [data]);

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
    const newData = { ...data, items: newItems };
    setData(newData);
    saveSubstationChecklist(newData);
  };

  const safeItems = data?.items || [];
  
  // Left Column: Transformer (7 items) + VCB A B (3 items)
  const leftColItems = [
    ...safeItems.filter(i => i.category === '변압기'),
    ...safeItems.filter(i => i.category === 'VCB A B')
  ];
  
  // Right Column: ATS (9 items)
  const rightColItems = safeItems.filter(i => i.category === 'ATS');

  const thClass = "border border-black bg-white font-normal text-center text-[13px] text-black h-[32px]";
  const tdClass = "border border-black p-0 h-[32px] relative bg-white text-center text-black";
  const labelClass = "border border-black p-0 font-normal text-center bg-white text-black align-middle w-20 text-[13px] h-[32px]";
  const resultClass = (res: string) => `w-full h-full flex items-center justify-center cursor-pointer select-none font-normal text-[13px] transition-colors px-2 ${res === '양호' ? 'text-blue-600' : 'text-red-600'}`;

  const renderRow = (item: SubstationCheckItem, idx: number, arr: SubstationCheckItem[]) => {
    const isFirstInCategory = idx === 0 || arr[idx - 1].category !== item.category;
    const categoryCount = arr.filter(i => i.category === item.category).length;

    return (
      <tr key={item.id} className="bg-white border-b border-black h-[32px]">
        {isFirstInCategory && (
          <td rowSpan={categoryCount} className={labelClass}>
            <div className="flex items-center justify-center h-full px-2">{item.category}</div>
          </td>
        )}
        <td className={tdClass}>
          <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">• {item.label}</div>
        </td>
        <td 
          className={tdClass}
          onClick={() => toggleResult(item.id)}
        >
          <div className={resultClass(item.result as string)}>
            {item.result || '양호'}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <LogSheetLayout
      loading={loading}
      hidePrint={true}
      hideRefresh={true}
      hideSave={true}
      isEmbedded={isEmbedded}
      hideHeader={true}
    >
      <div id="substation-checklist-print-area" className={`bg-white ${isEmbedded ? 'w-full' : 'max-w-7xl mx-auto'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-0 overflow-hidden">
          {/* Left Side Section */}
          <div className="">
            <table className="w-full border-collapse border border-black">
              <thead>
                <tr className="border-b border-black h-[32px]">
                  <th className={thClass} style={{ width: '80px' }}><div className="flex items-center justify-center h-full px-2">구 분</div></th>
                  <th className={thClass}><div className="flex items-center justify-center h-full px-2">점 검 내 용</div></th>
                  <th className={thClass} style={{ width: '110px' }}><div className="flex items-center justify-center h-full px-2">점검결과</div></th>
                </tr>
              </thead>
              <tbody>
                {leftColItems.map((item, idx) => renderRow(item, idx, leftColItems))}
              </tbody>
            </table>
          </div>

          {/* Right Side Section */}
          <div className="">
            <table className="w-full border-collapse border border-black border-l-0">
              <thead>
                <tr className="border-b border-black h-[32px]">
                  <th className={thClass} style={{ width: '80px' }}><div className="flex items-center justify-center h-full px-2">구 분</div></th>
                  <th className={thClass}><div className="flex items-center justify-center h-full px-2">점 검 내 용</div></th>
                  <th className={thClass} style={{ width: '110px' }}><div className="flex items-center justify-center h-full px-2">점검결과</div></th>
                </tr>
              </thead>
              <tbody>
                {rightColItems.map((item, idx) => renderRow(item, idx, rightColItems))}
                <tr className="h-[32px] border-b border-black last:border-0">
                  <td className="border border-black bg-white"></td>
                  <td className="border border-black bg-white"></td>
                  <td className="border border-black bg-white"></td>
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
