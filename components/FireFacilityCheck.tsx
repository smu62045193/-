
import React, { useState, useEffect } from 'react';
import { FireFacilityLogData, FireFacilityCheckItem } from '../types';
import { fetchFireFacilityLog, saveFireFacilityLog, getInitialFireFacilityLog } from '../services/dataService';
import { format } from 'date-fns';
import LogSheetLayout from './LogSheetLayout';

interface FireFacilityCheckProps {
  currentDate?: Date;
  isEmbedded?: boolean;
}

const FireFacilityCheck: React.FC<FireFacilityCheckProps> = ({ currentDate = new Date(), isEmbedded = false }) => {
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

  const thClass = "border border-black bg-white font-normal text-center text-[13px] text-black h-[32px]";
  const tdClass = "border border-black p-0 h-[32px] relative bg-white text-center text-black";
  const labelClass = "border border-black p-0 font-normal text-center bg-white text-black align-middle w-28 text-[13px] h-[32px]";
  const resultCellClass = (res: string) => `w-full h-full flex items-center justify-center cursor-pointer select-none font-normal text-[13px] transition-colors px-2 ${res === '양호' ? 'text-blue-600' : res === '불량' ? 'text-red-600' : 'text-slate-300'}`;

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
      <div id="fire-facility-log-print-area" className={`bg-white ${isEmbedded ? 'w-full' : 'max-w-7xl mx-auto'}`}>
        <div className="bg-white overflow-hidden">
          <table className="w-full border-collapse border border-black">
            <thead>
              <tr className="bg-white border-b border-black h-[32px]">
                <th className={`${thClass} w-28`}><div className="flex items-center justify-center h-full px-2">구 분</div></th>
                <th className={thClass}><div className="flex items-center justify-center h-full px-2">점 검 내 용</div></th>
                <th className={`${thClass} w-24`}><div className="flex items-center justify-center h-full px-2">결 과</div></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <React.Fragment key={category}>
                  {(groupedItems[category] || []).map((item, idx) => (
                    <tr key={item.id} className="h-[32px] bg-white border-b border-black">
                      {idx === 0 && (
                        <td 
                          rowSpan={groupedItems[category].length} 
                          className={labelClass}
                        >
                          <div className="flex items-center justify-center h-full px-2">{category}</div>
                        </td>
                      )}
                      <td className="border border-black p-0 h-[32px] text-center text-[13px] font-normal text-black">
                        <div className="flex items-center justify-center h-full px-2">• {item.content}</div>
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
              <tr className="h-20 border-b border-black last:border-0">
                <td className={`${labelClass} font-normal text-[13px] h-20`}>
                  <div className="flex items-center justify-center h-full px-2">특 이 사 항</div>
                </td>
                <td colSpan={2} className="p-0 h-20 border border-black">
                  <textarea 
                    value={data.remarks || ''} 
                    onChange={(e) => handleRemarksChange(e.target.value)}
                    placeholder="특이사항 입력"
                    className="w-full h-full p-2 resize-none outline-none text-black text-[13px] leading-relaxed font-normal bg-transparent !text-center scrollbar-hide border-none shadow-none appearance-none"
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
