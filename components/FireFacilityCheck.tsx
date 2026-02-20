
import React, { useState, useEffect } from 'react';
import { FireFacilityLogData, FireFacilityCheckItem } from '../types';
import { fetchFireFacilityLog, saveFireFacilityLog, getInitialFireFacilityLog } from '../services/dataService';
import { format } from 'date-fns';
import LogSheetLayout from './LogSheetLayout';

interface FireFacilityCheckProps {
  currentDate?: Date;
}

const FireFacilityCheck: React.FC<FireFacilityCheckProps> = ({ currentDate = new Date() }) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const [data, setData] = useState<FireFacilityLogData>(getInitialFireFacilityLog(dateKey));
  
  useEffect(() => { 
    loadData(); 
  }, [dateKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetched = await fetchFireFacilityLog(dateKey);
      const finalData = fetched || getInitialFireFacilityLog(dateKey);
      setData(finalData);
    } catch (e) { 
      setData(getInitialFireFacilityLog(dateKey)); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSave = async () => {
    if (!data || saveStatus === 'loading') return;
    setSaveStatus('loading');
    try {
      const success = await saveFireFacilityLog(data);
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

  const updateItemResult = (id: string, result: '양호' | '불량' | '') => {
    if (!data) return;
    const newItems = data.items.map(item => item.id === id ? { ...item, result } : item);
    setData({ ...data, items: newItems });
  };

  const toggleResult = (item: FireFacilityCheckItem) => {
    const next: '양호' | '불량' = item.result === '양호' ? '불량' : '양호';
    updateItemResult(item.id, next);
  };

  const handleRemarksChange = (val: string) => {
    setData(prev => ({ ...prev, remarks: val }));
  };

  const categories = ['소방시설', '피난방화시설', '화재예방조치', '화기취급감독', '기타'];
  
  const groupedItems: Record<string, FireFacilityCheckItem[]> = {};
  
  if (data && data.items) {
    data.items.forEach(item => {
      if (!groupedItems[item.category]) {
        groupedItems[item.category] = [];
      }
      groupedItems[item.category].push(item);
    });
  }

  const thClass = "border border-slate-300 p-2 bg-slate-100 font-bold text-center text-sm text-slate-700 h-9";
  const tdClass = "border border-slate-300 p-0 h-9 relative bg-white";
  const labelClass = "border border-slate-300 p-1 font-bold text-center bg-white text-slate-700 align-middle w-28 text-[13px]";
  const resultCellClass = (res: string) => `w-full h-full flex items-center justify-center cursor-pointer select-none font-black text-[13px] transition-colors ${res === '양호' ? 'text-blue-600' : res === '불량' ? 'text-red-600 bg-red-50' : 'text-slate-300'}`;

  return (
    <LogSheetLayout
      title="소방 시설 점검 일지"
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
      <div id="fire-facility-log-print-area" className="bg-white max-w-5xl mx-auto shadow-sm p-1">
        <div className="mb-2 px-1">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">소방 시설 점검 일지</h3>
        </div>
        <div className="bg-white border border-slate-300 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className={`${thClass} w-28`}>구 분</th>
                <th className={thClass}>점 검 내 용</th>
                <th className={`${thClass} w-24`}>결 과</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <React.Fragment key={category}>
                  {(groupedItems[category] || []).map((item, idx) => (
                    <tr key={item.id} className="h-9 hover:bg-slate-50/50 transition-colors">
                      {idx === 0 && (
                        <td 
                          rowSpan={groupedItems[category].length} 
                          className={labelClass}
                        >
                          {category}
                        </td>
                      )}
                      <td className="border border-slate-300 p-1 text-left text-[13px] font-medium text-slate-700 pl-4">
                        • {item.content}
                      </td>
                      <td 
                        className={tdClass}
                        onClick={() => toggleResult(item)}
                      >
                        <div className={resultCellClass(item.result)}>
                          {item.result || '양호'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              <tr className="h-20">
                <td className={`${labelClass} font-black text-xs`}>
                  특 이 사 항
                </td>
                <td colSpan={2} className="border border-slate-300 p-0 h-20">
                  <textarea 
                    value={data.remarks || ''} 
                    onChange={(e) => handleRemarksChange(e.target.value)}
                    placeholder="특이사항 입력"
                    className="w-full h-full p-2 resize-none outline-none text-slate-700 text-[13px] leading-relaxed font-medium bg-transparent !text-left scrollbar-hide"
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

export default FireFacilityCheck;
