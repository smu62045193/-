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

  const handleSave = async () => {
    if (!data) return;
    const success = await saveSubstationChecklist(data);
    if (success) alert('저장되었습니다.');
    else alert('저장 실패');
  };

  const updateItemResult = (id: string, result: '양호' | '불량' | '') => {
    if (!data || !data.items) return;
    const newItems = data.items.map(item => 
      item.id === id ? { ...item, result } : item
    );
    setData({ ...data, items: newItems });
  };

  const toggleResult = (item: SubstationCheckItem) => {
    const next: '양호' | '불량' = item.result === '양호' ? '불량' : '양호';
    updateItemResult(item.id, next);
  };

  const safeItems = data?.items || [];
  const trItems = safeItems.filter(i => i.category === '변압기');
  const vcbItems = safeItems.filter(i => i.category === 'VCB AB');
  const atsItems = safeItems.filter(i => i.category === 'ATS');

  const thClass = "border border-gray-300 p-2 bg-gray-50 font-bold text-center text-sm text-gray-700 h-10";
  const tdClass = "border border-gray-300 p-2 text-left bg-white text-black h-10 text-sm font-medium";
  const labelClass = "border border-gray-300 p-2 font-bold text-center bg-gray-50 text-gray-700 align-middle w-24 text-sm";
  const resultClass = "border border-gray-300 p-1 text-center font-black text-sm w-24 cursor-pointer select-none transition-colors h-10";

  const renderResultCell = (item: SubstationCheckItem) => (
    <td 
      className={`${resultClass} ${item?.result === '양호' ? 'text-blue-600 bg-blue-50/20' : item?.result === '불량' ? 'text-red-600 bg-red-50' : 'text-gray-300'}`}
      onClick={() => toggleResult(item)}
    >
      {item?.result || '-'}
    </td>
  );

  return (
    <LogSheetLayout
      title="수변전반 점검표"
      loading={loading}
      hidePrint={true}
      hideRefresh={isEmbedded}
      hideSave={isEmbedded}
      isEmbedded={isEmbedded}
    >
      <div id="substation-checklist-print-area" className="bg-white">
        {/* 전체 외곽 테두리를 위해 border-l, border-r, border-b 추가, 상단은 border-t 1px로 통일 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-gray-300 overflow-hidden shadow-sm">
          {/* Left Side Table (변압기 + VCB AB) */}
          <div className="border-b lg:border-b-0 lg:border-r border-gray-300">
            <table className="w-full border-collapse border-hidden">
              <thead>
                <tr>
                  <th className={thClass} style={{ width: '80px' }}>구 분</th>
                  <th className={thClass}>점 검 내 용</th>
                  <th className={thClass} style={{ width: '90px' }}>점검결과</th>
                </tr>
              </thead>
              <tbody>
                {trItems.map((item, idx) => (
                  <tr key={item?.id || idx}>
                    {idx === 0 && (
                      <td rowSpan={trItems.length} className={labelClass}>변압기</td>
                    )}
                    <td className={tdClass}>• {item?.label}</td>
                    {renderResultCell(item)}
                  </tr>
                ))}
                {vcbItems.map((item, idx) => (
                  <tr key={item?.id || idx}>
                    {idx === 0 && (
                      <td rowSpan={vcbItems.length} className={labelClass}>VCB<br/>A B</td>
                    )}
                    <td className={tdClass}>• {item?.label}</td>
                    {renderResultCell(item)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right Side Table (ATS) */}
          <div className="bg-white">
            <table className="w-full border-collapse border-hidden">
              <thead>
                <tr>
                  <th className={thClass} style={{ width: '80px' }}>구 분</th>
                  <th className={thClass}>점 검 내 용</th>
                  <th className={thClass} style={{ width: '90px' }}>점검결과</th>
                </tr>
              </thead>
              <tbody>
                {atsItems.map((item, idx) => (
                  <tr key={item?.id || idx}>
                    {idx === 0 && (
                      <td rowSpan={atsItems.length} className={labelClass}>ATS</td>
                    )}
                    <td className={tdClass}>• {item?.label}</td>
                    {renderResultCell(item)}
                  </tr>
                ))}
                {atsItems.length === 0 && (
                   <tr className="h-10">
                    <td className="border border-gray-300 bg-white"></td>
                    <td className="border border-gray-300 bg-white"></td>
                    <td className="border border-gray-300 bg-white"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {!isEmbedded && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-start gap-3 shadow-sm print:hidden">
          <div className="leading-relaxed">
            <p className="font-bold mb-1">점검 안내</p>
            <p>• 결과 칸을 클릭하면 <span className="font-bold underline text-blue-700">양호</span>와 <span className="font-bold underline text-red-600">불량</span>이 서로 교차 변경됩니다.</p>
            <p>• 이 화면에서의 직접 저장은 제한되며, <strong>[업무일지]</strong> 메뉴에서 통합 저장할 수 있습니다.</p>
          </div>
        </div>
      )}
    </LogSheetLayout>
  );
};

export default SubstationChecklistLog;