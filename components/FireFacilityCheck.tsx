import React, { useState, useEffect, useRef } from 'react';
import { FireFacilityLogData, FireFacilityCheckItem } from '../types';
import { fetchFireFacilityLog, saveFireFacilityLog, getInitialFireFacilityLog, saveToCache, getFromStorage } from '../services/dataService';
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
  
  // 초기 로딩 여부를 추적하여 빈 데이터가 캐시를 덮어쓰는 것을 방지
  const isInitialLoad = useRef(true);

  useEffect(() => { 
    isInitialLoad.current = true;
    loadData(); 
  }, [dateKey]);

  useEffect(() => {
    // 로딩 중이 아니고, 초기 로딩이 완료된 시점부터만 캐시에 저장
    if (!loading && !isInitialLoad.current && data) {
      saveToCache(`FIRE_FACILITY_LOG_${dateKey}`, data, true);
    }
  }, [data, dateKey, loading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetched = await fetchFireFacilityLog(dateKey);
      const draft = getFromStorage(`FIRE_FACILITY_LOG_${dateKey}`, true);
      
      // 드래프트가 있으면 우선하고, 없으면 서버 데이터, 둘 다 없으면 초기값 사용
      const finalData = draft || fetched || getInitialFireFacilityLog(dateKey);
      setData(finalData);
      
      // 데이터 세팅 후 약간의 지연을 두어 isInitialLoad를 해제 (상태 업데이트 반영 시간 확보)
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 100);
    } catch (e) { 
      setData(getInitialFireFacilityLog(dateKey)); 
      isInitialLoad.current = false;
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

  // 이미지와 동일한 카테고리 구성
  const categories = ['소 방 시 설', '피 난 방 화 시 설', '화 재 예 방 조 치', '화 기 취 급 감 독', '기 타'];
  
  const groupedItems: Record<string, FireFacilityCheckItem[]> = {};
  
  if (data && data.items) {
    data.items.forEach(item => {
      if (!groupedItems[item.category]) {
        groupedItems[item.category] = [];
      }
      groupedItems[item.category].push(item);
    });
  }

  const thClass = "border border-gray-300 p-1.5 bg-gray-100 font-bold text-center text-sm text-gray-700 h-10";
  const tdClass = "border border-gray-300 p-0 h-9 relative bg-white";
  const labelClass = "border border-gray-300 p-1.5 font-bold text-center bg-white text-gray-700 align-middle w-40 text-[13px] tracking-tighter";
  const resultCellClass = (res: string) => `w-full h-full flex items-center justify-center cursor-pointer select-none font-bold text-sm transition-colors ${res === '양호' ? 'text-blue-600 bg-blue-50/10' : res === '불량' ? 'text-red-600 bg-red-50' : 'text-gray-300'}`;

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
    >
      <div id="fire-facility-log-print-area" className="bg-white max-w-5xl mx-auto shadow-sm p-4">
        <div className="bg-white border border-gray-300 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className={`${thClass} w-32`}>구 분</th>
                <th className={thClass}>점 검 내 용</th>
                <th className={`${thClass} w-24`}>결 과</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <React.Fragment key={category}>
                  {(groupedItems[category] || []).map((item, idx) => (
                    <tr key={item.id} className="h-9 hover:bg-gray-50/30 transition-colors">
                      {idx === 0 && (
                        <td 
                          rowSpan={groupedItems[category].length} 
                          className={labelClass}
                        >
                          {category}
                        </td>
                      )}
                      <td className="border border-gray-300 p-2 text-left text-[13px] font-medium text-gray-600 pl-4">
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
              <tr className="h-24">
                <td className={`${labelClass} font-black text-sm`}>
                  특 &nbsp; 이 &nbsp; 사 &nbsp; 항
                </td>
                <td colSpan={2} className="border border-gray-300 p-0 h-24">
                  <textarea 
                    value={data.remarks || ''} 
                    onChange={(e) => handleRemarksChange(e.target.value)}
                    placeholder="특이사항 입력"
                    className="w-full h-full p-3 resize-none outline-none text-gray-700 text-[13px] leading-relaxed font-medium bg-transparent !text-left"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-3 print:hidden shadow-sm">
          <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600">
            <span className="font-bold text-[10px] uppercase tracking-tighter">Guide</span>
          </div>
          <div className="leading-relaxed">
            <p className="font-bold text-sm mb-0.5">소방 시설 점검 안내</p>
            <p>• 결과 칸을 클릭하여 <span className="font-bold underline text-blue-700">양호</span>와 <span className="font-bold underline text-red-600">불량</span> 상태를 전환할 수 있습니다.</p>
          </div>
        </div>
      </div>
    </LogSheetLayout>
  );
};

export default FireFacilityCheck;