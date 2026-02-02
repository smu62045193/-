
import React, { useState, useEffect } from 'react';
import { BoilerLogData, BoilerLogItem } from '../types';
import { fetchBoilerLog, saveBoilerLog, getInitialBoilerLog } from '../services/dataService';
import { format } from 'date-fns';
import LogSheetLayout from './LogSheetLayout';

interface BoilerLogProps {
  currentDate: Date;
  isEmbedded?: boolean;
}

const BoilerLog: React.FC<BoilerLogProps> = ({ currentDate, isEmbedded = false }) => {
  const [loading, setLoading] = useState(false);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const [data, setData] = useState<BoilerLogData>(getInitialBoilerLog(dateKey));

  useEffect(() => {
    loadData();
  }, [dateKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetched = await fetchBoilerLog(dateKey);
      setData(fetched || getInitialBoilerLog(dateKey));
    } catch (e) {
      console.error(e);
      setData(getInitialBoilerLog(dateKey));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data) return;
    const success = await saveBoilerLog(data);
    if (success) alert('저장되었습니다.');
    else alert('저장 실패');
  };

  const updateLogItem = (id: string, field: keyof BoilerLogItem, value: string) => {
    if (!data) return;
    const newLogs = data.logs.map(log => 
      log.id === id ? { ...log, [field]: value } : log
    );
    setData({ ...data, logs: newLogs });
  };

  const updateSimpleField = (field: keyof BoilerLogData, value: string) => {
    if (!data) return;
    // @ts-ignore
    setData({ ...data, [field]: value });
  };

  const updateNestedField = (parent: 'gas' | 'salt' | 'cleaner', field: string, value: string) => {
    if (!data) return;
    // @ts-ignore
    setData({ ...data, [parent]: { ...data[parent], [field]: value } });
  };

  const calculateDuration = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(start) || !timeRegex.test(end)) return 0;

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;

    if (endMinutes < startMinutes) endMinutes += 24 * 60;

    const diffMinutes = endMinutes - startMinutes;
    return diffMinutes / 60;
  };

  const handleRowRunTimeChange = (id: string, type: 'start' | 'end', value: string) => {
    if (!data) return;
    
    const newLogs = data.logs.map(log => {
        if (log.id === id) {
            const current = log.runTime || '';
            const parts = current.split('~');
            let start = parts[0] || '';
            let end = parts[1] || '';
            
            if (type === 'start') start = value;
            else end = value;
            
            return { ...log, runTime: `${start}~${end}` };
        }
        return log;
    });

    let totalHours = 0;
    newLogs.forEach(log => {
        const parts = (log.runTime || '').split('~');
        totalHours += calculateDuration(parts[0], parts[1]);
    });

    const formattedTotal = Number.isInteger(totalHours) ? totalHours.toString() : totalHours.toFixed(1);

    setData({ 
        ...data, 
        logs: newLogs,
        totalRunTime: totalHours > 0 ? formattedTotal : data.totalRunTime
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputs = Array.from(document.querySelectorAll('input:not([disabled]):not([type="hidden"]):not([readonly])'));
      const index = inputs.indexOf(e.currentTarget as HTMLInputElement);
      if (index > -1 && index < inputs.length - 1) (inputs[index + 1] as HTMLElement).focus();
    }
  };

  const inputClass = "w-full h-full text-center outline-none bg-white text-black p-1 focus:bg-blue-50 text-sm font-bold";
  const thClass = "border border-black bg-gray-50 p-2 font-bold text-center align-middle text-sm text-gray-700";
  const tdClass = "border border-black p-0 h-10 relative";

  return (
    <LogSheetLayout
      title="보일러 가동 현황"
      date={dateKey}
      loading={loading}
      onSave={handleSave}
      isEmbedded={isEmbedded}
      hideSave={false}
    >
      <div className="border border-black">
        <h4 className="p-2 font-bold text-blue-700 bg-blue-50/30 border-b border-black">보일러 가동 현황</h4>
        <table className="w-full border-collapse text-center text-sm">
          <thead>
            <tr>
              <th rowSpan={2} className={`${thClass} w-40`}>운전시간(H)</th>
              <th colSpan={2} className={thClass}>가스압력(kg/cm²)</th>
              <th rowSpan={2} className={thClass}>증기압<br/>(kg/cm²)</th>
              <th rowSpan={2} className={thClass}>배기온도<br/>(℃)</th>
              <th rowSpan={2} className={thClass}>급수온도<br/>(℃)</th>
              <th rowSpan={2} className={thClass}>급탕온도<br/>(℃)</th>
              <th rowSpan={2} className={thClass}>수위(%)</th>
            </tr>
            <tr>
              <th className={thClass}>1차</th>
              <th className={thClass}>2차</th>
            </tr>
          </thead>
          <tbody>
            {data.logs.map((log) => (
              <tr key={log.id}>
                <td className={tdClass}>
                   <div className="flex items-center justify-center h-full px-1">
                      <input type="text" className="w-full h-full text-center outline-none bg-white text-black text-sm" value={log.runTime} onChange={(e) => updateLogItem(log.id, 'runTime', e.target.value)} onKeyDown={handleKeyDown} placeholder="~" />
                   </div>
                </td>
                <td className={tdClass}><input type="text" className={inputClass} value={log.gasPressure1} onChange={(e) => updateLogItem(log.id, 'gasPressure1', e.target.value)} onKeyDown={handleKeyDown} /></td>
                <td className={tdClass}><input type="text" className={inputClass} value={log.gasPressure2} onChange={(e) => updateLogItem(log.id, 'gasPressure2', e.target.value)} onKeyDown={handleKeyDown} /></td>
                <td className={tdClass}><input type="text" className={inputClass} value={log.steamPressure} onChange={(e) => updateLogItem(log.id, 'steamPressure', e.target.value)} onKeyDown={handleKeyDown} /></td>
                <td className={tdClass}><input type="text" className={inputClass} value={log.exhaustTemp} onChange={(e) => updateLogItem(log.id, 'exhaustTemp', e.target.value)} onKeyDown={handleKeyDown} /></td>
                <td className={tdClass}><input type="text" className={inputClass} value={log.supplyTemp} onChange={(e) => updateLogItem(log.id, 'supplyTemp', e.target.value)} onKeyDown={handleKeyDown} /></td>
                <td className={tdClass}><input type="text" className={inputClass} value={log.hotWaterTemp} onChange={(e) => updateLogItem(log.id, 'hotWaterTemp', e.target.value)} onKeyDown={handleKeyDown} /></td>
                <td className={tdClass}><input type="text" className={inputClass} value={log.waterLevel} onChange={(e) => updateLogItem(log.id, 'waterLevel', e.target.value)} onKeyDown={handleKeyDown} /></td>
              </tr>
            ))}
            <tr>
              <td className={`${thClass} bg-gray-50 font-bold`}>총 가 동 시 간</td>
              <td colSpan={7} className={tdClass}>
                <div className="flex items-center justify-center h-full">
                  <input type="text" className="h-full w-24 text-right outline-none bg-white text-black p-1 font-extrabold" value={data.totalRunTime} onChange={(e) => updateSimpleField('totalRunTime', e.target.value)} onKeyDown={handleKeyDown} />
                  <span className="ml-1 text-sm font-bold">H</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="border border-black">
          <table className="w-full border-collapse text-center text-sm">
            <tbody>
              <tr><th rowSpan={2} className={`${thClass} w-24`}>보일러<br/>가스사용</th><th className={thClass}>전일</th><th className={thClass}>금일</th><th className={thClass}>사용</th></tr>
              <tr>
                <td className={tdClass}><input type="text" className={inputClass} value={data.gas.prev} onChange={(e) => updateNestedField('gas', 'prev', e.target.value)} /></td>
                <td className={tdClass}><input type="text" className={inputClass} value={data.gas.curr} onChange={(e) => updateNestedField('gas', 'curr', e.target.value)} /></td>
                <td className={tdClass}><input type="text" className={`${inputClass} font-bold text-blue-700`} value={data.gas.usage} onChange={(e) => updateNestedField('gas', 'usage', e.target.value)} /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="border border-black">
          <table className="w-full border-collapse text-center text-sm">
            <tbody>
              <tr><th rowSpan={2} className={`${thClass} w-24`}>소금/약품<br/>(kg)</th><th className={thClass}>구분</th><th className={thClass}>입고</th><th className={thClass}>투입</th><th className={thClass}>재고</th></tr>
              <tr>
                <td className={thClass}>소금</td>
                <td className={tdClass}><input type="text" className={inputClass} value={data.salt.inQty} onChange={(e) => updateNestedField('salt', 'inQty', e.target.value)} /></td>
                <td className={tdClass}><input type="text" className={inputClass} value={data.salt.usedQty} onChange={(e) => updateNestedField('salt', 'usedQty', e.target.value)} /></td>
                <td className={tdClass}><input type="text" className={`${inputClass} font-bold text-blue-700`} value={data.salt.stock} onChange={(e) => updateNestedField('salt', 'stock', e.target.value)} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </LogSheetLayout>
  );
};

export default BoilerLog;
