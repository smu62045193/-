import React, { useState, useEffect } from 'react';
import { parseISO, addDays, format, differenceInDays } from 'date-fns';
import { X, CheckSquare, Square, Sparkles, Check } from 'lucide-react';
import { fetchDateRangeData, fetchLinkedKeywords } from '../services/dataService';
import { TaskItem, WorkLogData, LogCategory } from '../types';
import {
  getAutomatedElectricalTasks,
  getAutomatedMechanicalTasks,
  getAutomatedFireTasks,
  getAutomatedElevatorTasks,
  getAutomatedParkingTasks,
  getAutomatedSecurityTasks,
  getAutomatedCleaningTasks
} from '../services/automationService';

const FIELDS = [
  { id: 'electrical', label: '전기' },
  { id: 'mechanical', label: '기계' },
  { id: 'fire', label: '소방' },
  { id: 'elevator', label: '승강기' },
  { id: 'parking', label: '주차' },
  { id: 'security', label: '경비' },
  { id: 'cleaning', label: '미화' },
  { id: 'handover', label: '특이사항' },
];

interface SelectableItem {
  id: string;
  content: string;
  fieldKey: string;
  weekType: 'this' | 'next';
  selected: boolean;
  dayName: string;
}

const formatRanges = (dateStrs: string[]) => {
  if (dateStrs.length === 0) return '';
  const sorted = Array.from(new Set(dateStrs)).sort((a, b) => a.localeCompare(b));
  const ranges: string[] = [];
  
  let start = parseISO(sorted[0]);
  let end = start;
  
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && differenceInDays(parseISO(sorted[i]), end) === 1) {
      end = parseISO(sorted[i]);
    } else {
      if (start.getTime() === end.getTime()) {
        ranges.push(`${start.getDate()}`);
      } else {
        ranges.push(`${start.getDate()}~${end.getDate()}`);
      }
      if (i < sorted.length) {
        start = parseISO(sorted[i]);
        end = start;
      }
    }
  }
  return ranges.join(',');
};

interface WeeklyWorkImportPopupProps {
  startDateStr: string;
}

const WeeklyWorkImportPopup: React.FC<WeeklyWorkImportPopupProps> = ({ startDateStr }) => {
  const [loading, setLoading] = useState(true);
  const [selectableItems, setSelectableItems] = useState<SelectableItem[]>([]);
  const [activeTab, setActiveTab] = useState<'this' | 'next'>('this');

  useEffect(() => {
    const loadData = async () => {
      try {
        const thisWeekStart = parseISO(startDateStr);
        const nextWeekStart = addDays(thisWeekStart, 7);
        
        const [thisWeekLogs, nextWeekLogs, fireKeywords, elevatorKeywords] = await Promise.all([
          fetchDateRangeData(startDateStr, 7),
          fetchDateRangeData(format(nextWeekStart, 'yyyy-MM-dd'), 7),
          fetchLinkedKeywords('fire'),
          fetchLinkedKeywords('elevator')
        ]);

        const allKeywords = [...(fireKeywords || []), ...(elevatorKeywords || [])].filter(Boolean);

        const getBaseContent = (content: string) => {
          let base = content.trim();
          
          const hyphenIndex = base.indexOf('-');
          if (hyphenIndex !== -1) {
            const suffix = base.substring(hyphenIndex + 1).trim();
            const isKeyword = allKeywords.some(k => suffix.includes(k));
            if (!isKeyword) {
              base = base.substring(0, hyphenIndex).trim();
            }
          }
          
          base = base.replace(/\(([^)]+)\)/g, (match, inner) => {
            const isKeyword = allKeywords.some(k => inner.includes(k));
            return isKeyword ? match : '';
          }).trim();
          
          return base;
        };

        const automationMap: Record<string, (d: string) => TaskItem[]> = {
          electrical: getAutomatedElectricalTasks,
          mechanical: getAutomatedMechanicalTasks,
          fire: getAutomatedFireTasks,
          elevator: getAutomatedElevatorTasks,
          parking: getAutomatedParkingTasks,
          security: getAutomatedSecurityTasks,
          cleaning: getAutomatedCleaningTasks,
          handover: () => []
        };

        const groupedItems: Record<string, { content: string, fieldKey: string, weekType: 'this' | 'next', dates: string[] }> = {};

        const processWeek = (logs: any[], weekType: 'this' | 'next', weekStartDate: Date) => {
          for (let i = 0; i < 7; i++) {
            const date = addDays(weekStartDate, i);
            const dateKey = format(date, 'yyyy-MM-dd');
            const dayData = logs.find(l => l.key === dateKey || l.key === `DAILY_${dateKey}`);
            
            FIELDS.forEach(field => {
              let todayTasks: TaskItem[] = [];
              let tomorrowTasks: TaskItem[] = [];

              let autoTasks: TaskItem[] = [];
              if (automationMap[field.id]) {
                autoTasks = automationMap[field.id](dateKey);
              }

              if (dayData?.data?.workLog) {
                let workLog = dayData.data.workLog;
                if (typeof workLog === 'string') {
                  try {
                    workLog = JSON.parse(workLog);
                  } catch (e) {
                    workLog = {};
                  }
                }
                if (!workLog || typeof workLog !== 'object') {
                  workLog = {};
                }
                
                const getTasks = (catId: string) => {
                  const cat = (workLog[catId as keyof WorkLogData] || { today: [], tomorrow: [] }) as LogCategory;
                  return {
                    today: Array.isArray(cat.today) ? [...cat.today] : [],
                    tomorrow: Array.isArray(cat.tomorrow) ? [...cat.tomorrow] : []
                  };
                };

                if (field.id === 'electrical') {
                  const elec = getTasks('electrical');
                  const sub = getTasks('substation');
                  todayTasks = [...elec.today, ...sub.today];
                  tomorrowTasks = [...elec.tomorrow, ...sub.tomorrow];
                } else if (field.id === 'mechanical') {
                  const mech = getTasks('mechanical');
                  const hvac = getTasks('hvac');
                  const boiler = getTasks('boiler');
                  todayTasks = [...mech.today, ...hvac.today, ...boiler.today];
                  tomorrowTasks = [...mech.tomorrow, ...hvac.tomorrow, ...boiler.tomorrow];
                } else if (field.id === 'handover') {
                  const handover = getTasks('handover');
                  todayTasks = [...handover.today];
                  tomorrowTasks = [...handover.tomorrow];
                } else {
                  const cat = getTasks(field.id);
                  todayTasks = cat.today;
                  tomorrowTasks = cat.tomorrow;
                }

                const existingContents = new Set(todayTasks.map(t => t.content.trim()));
                autoTasks.forEach(at => {
                  if (!existingContents.has(at.content.trim())) {
                    todayTasks.push(at);
                  }
                });
              } else {
                todayTasks = autoTasks;
              }

              if (weekType === 'this') {
                todayTasks.forEach(task => {
                  if (task?.content?.trim()) {
                    const baseContent = getBaseContent(task.content);
                    const key = `this_${field.id}_${baseContent}`;
                    if (!groupedItems[key]) {
                      groupedItems[key] = { content: baseContent, fieldKey: field.id, weekType: 'this', dates: [] };
                    }
                    if (!groupedItems[key].dates.includes(dateKey)) groupedItems[key].dates.push(dateKey);
                  }
                });
              } else {
                todayTasks.forEach(task => {
                  if (task?.content?.trim()) {
                    const baseContent = getBaseContent(task.content);
                    const key = `next_${field.id}_${baseContent}`;
                    if (!groupedItems[key]) {
                      groupedItems[key] = { content: baseContent, fieldKey: field.id, weekType: 'next', dates: [] };
                    }
                    if (!groupedItems[key].dates.includes(dateKey)) groupedItems[key].dates.push(dateKey);
                  }
                });
              }
            });
          }
        };

        processWeek(thisWeekLogs, 'this', thisWeekStart);
        processWeek(nextWeekLogs, 'next', nextWeekStart);

        const items: SelectableItem[] = Object.values(groupedItems).map(g => ({
          id: `group_${g.weekType}_${g.fieldKey}_${g.content}`,
          content: g.content,
          fieldKey: g.fieldKey,
          weekType: g.weekType,
          selected: true,
          dayName: formatRanges(g.dates)
        }));

        setSelectableItems(items);
      } catch (e) { 
        alert('데이터 로드 오류'); 
      } finally { 
        setLoading(false); 
      }
    };

    if (startDateStr) {
      loadData();
    }
  }, [startDateStr]);

  const toggleSelectItem = (id: string) => {
    setSelectableItems(prev => prev.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
  };

  const selectAll = (weekType: 'this' | 'next', select: boolean) => {
    setSelectableItems(prev => prev.map(it => it.weekType === weekType ? { ...it, selected: select } : it));
  };

  const handleApplySelection = () => {
    try {
      const timestamp = Date.now();
      const payloadData = {
        type: 'IMPORT_WEEKLY_WORK',
        timestamp,
        payload: selectableItems
      };

      // 1. Use localStorage for robust cross-window communication
      localStorage.setItem('weekly_import_data', JSON.stringify(payloadData));
      
      // 2. BroadcastChannel as fallback
      const channel = new BroadcastChannel('weekly_import_channel');
      channel.postMessage(payloadData);
      channel.close();

      // 3. Direct postMessage to opener (most reliable for popups)
      if (window.opener) {
        window.opener.postMessage(payloadData, '*');
      }
      
      alert('주간업무보고에 반영되었습니다. 창을 닫으셔도 됩니다.');
    } catch (error) {
      console.error('Data transfer error:', error);
      alert('데이터 전송 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">데이터를 불러오는 중입니다...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-xl">
          <Sparkles size={24} className="text-blue-500" />
          업무일지 항목 가져오기
        </h3>
        <button onClick={() => window.close()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="flex bg-white border-b border-gray-200 shrink-0">
        <button
          onClick={() => setActiveTab('this')}
          className={`flex-1 py-4 text-center font-bold text-lg transition-colors ${activeTab === 'this' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          금주작업사항
        </button>
        <button
          onClick={() => setActiveTab('next')}
          className={`flex-1 py-4 text-center font-bold text-lg transition-colors ${activeTab === 'next' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          차주예정사항
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex justify-between items-center">
          <h4 className="font-bold text-lg text-gray-700">
            {activeTab === 'this' ? '금주작업사항' : '차주예정사항'} 선택
          </h4>
          <div className="flex gap-2">
            <button onClick={() => selectAll(activeTab, true)} className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50">전체 선택</button>
            <button onClick={() => selectAll(activeTab, false)} className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50">전체 해제</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELDS.map(f => { 
            const its = selectableItems.filter(i => i.weekType === activeTab && i.fieldKey === f.id); 
            return (
              <div key={f.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <strong className="text-slate-700 text-lg">{f.label}</strong>
                <div className="mt-3 space-y-2">
                  {its.length > 0 ? its.map(it => (
                    <div key={it.id} onClick={() => toggleSelectItem(it.id)} className="flex gap-2 cursor-pointer text-sm group hover:text-blue-600 transition-colors items-start">
                      {it.selected ? <CheckSquare size={18} className="text-blue-600 shrink-0 mt-0.5" /> : <Square size={18} className="text-gray-300 shrink-0 group-hover:text-blue-400 mt-0.5" />} 
                      <span className={it.selected ? 'font-bold' : 'text-gray-600'}>{it.content} {it.dayName ? `(${it.dayName}일)` : ''}</span>
                    </div>
                  )) : (
                    <div className="text-sm text-gray-400">조회된 내역이 없습니다.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white px-6 py-4 border-t border-gray-200 flex justify-end gap-3 shrink-0">
        <button onClick={() => window.close()} className="px-6 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">취소</button>
        <button onClick={handleApplySelection} className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center">
          <Check size={18} className="mr-2" />
          선택 항목 적용
        </button>
      </div>
    </div>
  );
};

export default WeeklyWorkImportPopup;
