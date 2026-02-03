
import React, { useState, useEffect } from 'react';
import { startOfWeek, addDays, format, subDays, parseISO, isWithinInterval } from 'date-fns';
import { HOLIDAYS } from '../constants';
import { fetchWeeklyReport, saveWeeklyReport, fetchDateRangeData, fetchExternalWorkList, fetchInternalWorkList } from '../services/dataService';
import { WeeklyReportData, WeeklyWorkPhoto, TaskItem, ConstructionWorkItem, WorkPhoto, LogCategory, WorkLogData } from '../types';
import { Printer, Save, Upload, X, RefreshCw, Plus, CheckSquare, Square, CheckCircle2, Calendar, Image as ImageIcon, Sparkles, LayoutList, ClipboardEdit, Cloud, CheckCircle } from 'lucide-react';
import WeeklyReportList from './WeeklyReportList';
import { 
  getAutomatedElectricalTasks, 
  getAutomatedMechanicalTasks, 
  getAutomatedFireTasks, 
  getAutomatedElevatorTasks, 
  getAutomatedParkingTasks,
  getAutomatedSecurityTasks,
  getAutomatedCleaningTasks
} from '../services/automationService';

interface WeeklyWorkProps {
  currentDate: Date;
  onDateChange?: (date: Date) => void;
}

interface SelectableItem {
  id: string;
  content: string;
  fieldKey: string;
  weekType: 'this' | 'next';
  selected: boolean;
  dayName: string; // 표시용 날짜 범위 (예: "12~18")
}

interface SelectablePhoto {
  id: string;
  dataUrl: string;
  fileName: string;
  date: string;
  category: string;
  content: string;
  selected: boolean;
}

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

const createDefaultPhotos = (): WeeklyWorkPhoto[] => [
  { id: Math.random().toString(), dataUrl: '', title: '', description: '' },
  { id: Math.random().toString(), dataUrl: '', title: '', description: '' },
  { id: Math.random().toString(), dataUrl: '', title: '', description: '' }
];

const formatRanges = (nums: number[]) => {
  if (nums.length === 0) return '';
  const sorted = Array.from(new Set(nums)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = start;
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      if (start === end) ranges.push(`${start}`);
      else ranges.push(`${start}~${end}`);
      if (i < sorted.length) {
        start = sorted[i];
        end = start;
      }
    }
  }
  return ranges.join(', ');
};

const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 800;
        if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
        else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) { ctx.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL('image/jpeg', 0.6)); } 
        else { reject(new Error("Canvas context not available")); }
      };
      img.onerror = reject; img.src = e.target?.result as string;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
};

const WeeklyWork: React.FC<WeeklyWorkProps> = ({ currentDate, onDateChange }) => {
  const [activeTab, setActiveTab] = useState<'form' | 'list'>('list');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectableItems, setSelectableItems] = useState<SelectableItem[]>([]);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectablePhotos, setSelectablePhotos] = useState<SelectablePhoto[]>([]);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
  const startDateStr = format(startOfCurrentWeek, 'yyyy-MM-dd');

  const calculateReportingDate = () => {
    let d = addDays(startOfCurrentWeek, 4);
    while (HOLIDAYS.some(h => h.date === format(d, 'yyyy-MM-dd'))) { d = subDays(d, 1); }
    return format(d, 'yyyy-MM-dd');
  };

  const [report, setReport] = useState<WeeklyReportData>({
    startDate: startDateStr,
    reportingDate: calculateReportingDate(),
    author: '김용만',
    fields: {
      electrical: { thisWeek: '', results: '', nextWeek: '' },
      mechanical: { thisWeek: '', results: '', nextWeek: '' },
      fire: { thisWeek: '', results: '', nextWeek: '' },
      elevator: { thisWeek: '', results: '', nextWeek: '' },
      parking: { thisWeek: '', results: '', nextWeek: '' },
      security: { thisWeek: '', results: '', nextWeek: '' },
      cleaning: { thisWeek: '', results: '', nextWeek: '' },
      handover: { thisWeek: '', results: '', nextWeek: '' },
    },
    photos: createDefaultPhotos()
  });

  useEffect(() => {
    const adjustHeight = () => {
      document.querySelectorAll('.auto-expand-textarea').forEach((ta) => {
        const element = ta as HTMLTextAreaElement;
        element.style.height = 'auto';
        const newHeight = Math.min(element.scrollHeight, 200);
        element.style.height = `${newHeight}px`;
      });
    };
    const timer = setTimeout(adjustHeight, 100);
    return () => clearTimeout(timer);
  }, [report, activeTab]);

  useEffect(() => {
    const newStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const newStartStr = format(newStart, 'yyyy-MM-dd');
    loadReport(newStartStr);
  }, [startDateStr]);

  const loadReport = async (dateKey: string) => {
    setLoading(true);
    const saved = await fetchWeeklyReport(dateKey);
    if (saved) {
      if (!saved.photos || !Array.isArray(saved.photos)) saved.photos = createDefaultPhotos();
      setReport(saved);
    }
    setLoading(false);
  };

  const handleOpenImportModal = async () => {
    setLoading(true);
    try {
      const thisWeekStart = parseISO(report.startDate);
      const nextWeekStart = addDays(thisWeekStart, 7);
      
      const [thisWeekLogs, nextWeekLogs] = await Promise.all([
        fetchDateRangeData(report.startDate, 7),
        fetchDateRangeData(format(nextWeekStart, 'yyyy-MM-dd'), 7)
      ]);

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

      const groupedItems: Record<string, { content: string, fieldKey: string, weekType: 'this' | 'next', days: number[] }> = {};

      const processWeek = (logs: any[], weekType: 'this' | 'next', weekStartDate: Date) => {
        for (let i = 0; i < 7; i++) {
          const date = addDays(weekStartDate, i);
          const dateKey = format(date, 'yyyy-MM-dd');
          const dayNum = date.getDate();
          const dayData = logs.find(l => l.key === `DAILY_${dateKey}`);
          
          FIELDS.forEach(field => {
            let todayTasks: TaskItem[] = [];
            let tomorrowTasks: TaskItem[] = [];

            if (dayData?.data?.workLog) {
              const logCat = (dayData.data.workLog[field.id as keyof WorkLogData] || { today: [], tomorrow: [] }) as LogCategory;
              todayTasks = (logCat.today || []) as TaskItem[];
              tomorrowTasks = (logCat.tomorrow || []) as TaskItem[];
            } else if (automationMap[field.id]) {
              todayTasks = automationMap[field.id](dateKey);
            }

            // 이번 주 데이터 처리 시:
            if (weekType === 'this') {
              // 1. 금일 작업 -> 금주 실적 후보
              todayTasks.forEach(task => {
                if (task?.content?.trim()) {
                  const baseContent = task.content.split('-')[0].trim();
                  const key = `this_${field.id}_${baseContent}`;
                  if (!groupedItems[key]) {
                    groupedItems[key] = { content: baseContent, fieldKey: field.id, weekType: 'this', days: [] };
                  }
                  if (!groupedItems[key].days.includes(dayNum)) groupedItems[key].days.push(dayNum);
                }
              });
              
              // 2. 익일 예정사항 -> 차주 계획 후보
              tomorrowTasks.forEach(task => {
                if (task?.content?.trim()) {
                  const baseContent = task.content.split('-')[0].trim();
                  const key = `next_${field.id}_${baseContent}`;
                  if (!groupedItems[key]) {
                    groupedItems[key] = { content: baseContent, fieldKey: field.id, weekType: 'next', days: [] };
                  }
                }
              });
            } else {
              // 다음 주 데이터 처리 시:
              // 1. 금일 작업 -> 차주 계획 후보
              todayTasks.forEach(task => {
                if (task?.content?.trim()) {
                  const baseContent = task.content.split('-')[0].trim();
                  const key = `next_${field.id}_${baseContent}`;
                  if (!groupedItems[key]) {
                    groupedItems[key] = { content: baseContent, fieldKey: field.id, weekType: 'next', days: [] };
                  }
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
        dayName: formatRanges(g.days)
      }));

      setSelectableItems(items);
      setIsModalOpen(true);
    } catch (e) { 
      alert('데이터 로드 오류'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleOpenPhotoImportModal = async () => {
    setLoading(true);
    try {
      const [ext, int] = await Promise.all([fetchExternalWorkList(), fetchInternalWorkList()]);
      const weekStart = parseISO(report.startDate); const weekEnd = addDays(weekStart, 6);
      const photos: SelectablePhoto[] = [];
      const process = (list: ConstructionWorkItem[]) => {
        list.forEach(item => {
          const itemDate = parseISO(item.date);
          if (isWithinInterval(itemDate, { start: weekStart, end: weekEnd })) {
            item.photos.forEach(photo => photos.push({ id: photo.id, dataUrl: photo.dataUrl, fileName: photo.fileName, date: item.date, category: item.category, content: item.content, selected: false }));
          }
        });
      };
      process(ext || []); process(int || []);
      setSelectablePhotos(photos); setIsPhotoModalOpen(true);
    } catch (e) { alert('사진 로드 오류'); } finally { setLoading(false); }
  };

  const toggleSelectPhoto = (id: string) => {
    setSelectablePhotos(prev => prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p));
  };

  const handleApplyPhotoSelection = () => {
    const selected = selectablePhotos
      .filter(p => p.selected)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (selected.length === 0) { setIsPhotoModalOpen(false); return; }
    
    const newPhotos = [...(report.photos || [])];
    selected.forEach(p => {
      const emptyIdx = newPhotos.findIndex(item => !item.dataUrl);
      const photoData = { 
        id: Math.random().toString(), 
        dataUrl: p.dataUrl, 
        title: p.content || `${p.category} 작업`, 
        description: '' 
      };
      if (emptyIdx !== -1) newPhotos[emptyIdx] = photoData; 
      else newPhotos.push(photoData);
    });
    setReport(prev => ({ ...prev, photos: newPhotos })); 
    setIsPhotoModalOpen(false);
  };

  const toggleSelectItem = (id: string) => {
    setSelectableItems(prev => prev.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
  };

  const handleApplySelection = () => {
    const newFields = { ...report.fields };
    
    FIELDS.forEach(field => {
      const selThis = selectableItems.filter(i => i.fieldKey === field.id && i.weekType === 'this' && i.selected);
      const selNext = selectableItems.filter(i => i.fieldKey === field.id && i.weekType === 'next' && i.selected);
      
      const formatGroup = (items: SelectableItem[], isThis: boolean) => {
        return items.map(it => {
          const dateSuffix = (isThis && it.dayName) ? `(${it.dayName})` : '';
          return `- ${it.content}${dateSuffix}`;
        }).join('\n');
      };

      const resultsList: string[] = selThis.map(it => {
        const text = it.content;
        let res = '완료 / 이상없음';
        if (text.includes('입고')) res = '입고완료';
        else if (text.includes('신청')) res = '신청완료';
        else if (text.includes('재활용')) res = '배출완료';
        else if (text.includes('통제')) res = '상시통제중';
        else if (text.includes('순찰')) res = '상시점검중';
        return res;
      });

      newFields[field.id as keyof typeof newFields] = { 
        thisWeek: formatGroup(selThis, true) || '', 
        results: resultsList.join('\n') || (selThis.length > 0 ? '완료 / 이상없음' : ''), 
        nextWeek: formatGroup(selNext, false) || '' 
      };
    });

    setReport(prev => ({ ...prev, fields: newFields })); 
    setIsModalOpen(false);
  };

  const handleSave = async () => {
    setShowSaveConfirm(false);
    setSaveStatus('loading');
    try {
      const success = await saveWeeklyReport(report);
      if (success) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장에 실패했습니다.');
      }
    } catch (e) {
      setSaveStatus('error');
      alert('오류가 발생했습니다.');
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    const reportingDateStr = format(parseISO(report.reportingDate), 'yyyy년 MM월 dd일');

    const fieldsHtml = FIELDS.map(field => {
      const f = report.fields[field.id as keyof typeof report.fields];
      const displayLabel = field.id === 'handover' ? '특이<br/>사항' : field.label;
      
      const thisWeekLines = (f.thisWeek || '').split('\n').filter(l => l.trim() !== '');
      const resultLines = (f.results || '').split('\n').map(l => l.trim());
      const nextWeekLines = (f.nextWeek || '').split('\n').filter(l => l.trim() !== '');
      
      const rowCount = Math.max(thisWeekLines.length, nextWeekLines.length, 1);
      
      let categoryRows = '';
      for (let i = 0; i < rowCount; i++) {
        const isFirst = i === 0;
        const isLast = i === rowCount - 1;
        const borderStyle = (isLast ? '' : 'border-bottom:none !important;') + (isFirst ? '' : 'border-top:none !important;');
        
        categoryRows += `
          <tr>
            ${isFirst ? `<td rowspan="${rowCount}" style="font-weight:bold; background:#f9fafb; text-align:center; vertical-align:middle; width:40px;">${displayLabel}</td>` : ''}
            <td style="text-align:left; padding:2px 6px; vertical-align:middle; ${borderStyle}">${thisWeekLines[i] || ''}</td>
            <td style="text-align:center; padding:2px 6px; vertical-align:middle; width:90px; ${borderStyle}">${resultLines[i] || ''}</td>
            <td style="text-align:left; padding:2px 6px; vertical-align:middle; ${borderStyle}">${nextWeekLines[i] || ''}</td>
          </tr>
        `;
      }
      return categoryRows;
    }).join('');

    const photosHtml = (report.photos || []).filter(p => p.dataUrl).map(photo => `
      <div class="photo-card">
        <div class="photo-img-wrap"><img src="${photo.dataUrl}" /></div>
        <div class="photo-title">${photo.title || '작업 사진'}</div>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>주간업무보고 - ${report.startDate}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
            @page { size: A4 portrait; margin: 0; }
            body { font-family: 'Noto Sans KR', sans-serif; font-size: 9pt; line-height: 1.2; color: black; margin: 0; padding: 0; background: #f1f5f9; -webkit-print-color-adjust: exact; }
            .no-print { margin: 20px; display: flex; gap: 10px; justify-content: center; }
            @media print { 
              .no-print { display: none !important; } 
              body { background: white !important; } 
              .print-page { box-shadow: none !important; margin: 0 !important; }
              .page-break { page-break-before: always; }
            }
            .print-page { width: 210mm; min-height: 297mm; padding: 25mm 12mm 10mm 12mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
            .doc-title { margin: 0 auto 15px auto; text-align: center; font-size: 30pt; font-weight: 900; letter-spacing: 12px; text-decoration: underline; text-underline-offset: 8px; }
            .info-line { display: flex; justify-content: space-between; font-weight: bold; font-size: 11pt; margin-bottom: 15px; border-bottom: 1.5px solid black; padding-bottom: 5px; }
            .section-header { font-size: 13pt; font-weight: bold; margin-top: 10px; margin-bottom: 15px; border-left: 8px solid black; padding-left: 15px; text-align: left; }
            table { width: 100%; border-collapse: collapse; border: 1.5px solid black; table-layout: fixed; margin-bottom: 15px; }
            th, td { border: 1px solid black; padding: 6px; font-size: 9pt; vertical-align: top; text-align: center; word-break: break-all; }
            th { background: #f3f4f6; font-weight: bold; }
            .text-left { text-align: left; }
            .photo-grid { display: flex; flex-wrap: wrap; gap: 1%; margin-top: 15px; }
            .photo-card { width: 32%; border: 1px solid #000; padding: 5px; box-sizing: border-box; margin-bottom: 10px; background: white; }
            .photo-img-wrap { width: 100%; aspect-ratio: 4/3; overflow: hidden; border: 1px solid #000; display: flex; align-items: center; justify-content: center; background: #f9f9f9; }
            .photo-img-wrap img { width: 100%; height: 100%; object-fit: cover; }
            .photo-title { font-weight: bold; font-size: 8.5pt; text-align: center; padding-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button>
          </div>
          
          <!-- 1페이지: 업무 실적 및 계획 -->
          <div class="print-page">
            <h1 class="doc-title" style="margin-top: 0;">주간업무보고</h1>
            <div class="info-line">
              <span>사업장명 : 새마을운동중앙회 대치동 사옥</span>
              <span>작성일자 : ${reportingDateStr}</span>
              <span>작성자 : ${report.author}</span>
            </div>
            
            <div class="section-header">1.금주업무/업무계획</div>
            <table>
              <thead>
                <tr><th style="width:40px;">분야</th><th>금주 업무 실적</th><th style="width:90px;">점검결과</th><th>다음주 업무 계획</th></tr>
              </thead>
              <tbody>${fieldsHtml}</tbody>
            </table>
          </div>

          <!-- 2페이지: 작업 사진 -->
          <div class="print-page page-break">
            <div class="section-header">2.작업사진</div>
            <div class="photo-grid">
              ${photosHtml || '<div style="width:100%; text-align:center; padding:50px; color:#999; font-weight:bold;">등록된 작업 사진이 없습니다.</div>'}
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const groupedPhotosByDate = selectablePhotos.reduce((acc, photo) => {
    const date = photo.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(photo);
    return acc;
  }, {} as Record<string, SelectablePhoto[]>);

  const sortedDates = Object.keys(groupedPhotosByDate).sort((a, b) => a.localeCompare(b));

  return (
    <div className="p-2 sm:p-4 max-w-[1000px] mx-auto bg-white min-h-screen text-black relative">
      <div className="mb-6 print:hidden"><h2 className="text-2xl font-bold text-gray-800">주간 업무</h2><p className="text-gray-500 mt-1">주간 업무 실적 및 차주 계획을 관리합니다.</p></div>
      <div className="flex gap-2 pb-2 mb-6 border-b print:hidden"><button onClick={() => setActiveTab('list')} className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${activeTab === 'list' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><LayoutList size={16} className="inline mr-2" />보고서이력</button><button onClick={() => setActiveTab('form')} className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${activeTab === 'form' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><ClipboardEdit size={16} className="inline mr-2" />작성/수정</button></div>
      {activeTab === 'list' ? <WeeklyReportList onSelectReport={(s) => { if(onDateChange) onDateChange(parseISO(s)); setActiveTab('form'); }} /> : (
        <>
        <div className="border-b-2 border-black mb-6 pb-3 flex items-center justify-between">
          <div className="flex-1"></div>
          <h1 className="text-3xl font-bold tracking-widest text-center flex-shrink-0">주간업무보고</h1>
          <div className="flex-1 flex justify-end gap-2 print:hidden">
            <button onClick={handleOpenImportModal} disabled={loading} className="bg-emerald-600 text-white px-3 py-1.5 rounded font-bold text-xs hover:bg-emerald-700 transition-colors shadow-sm flex items-center">
              <RefreshCw size={18} className={`mr-1 ${loading?'animate-spin':''}`} />가져오기
            </button>
            <button onClick={() => setShowSaveConfirm(true)} disabled={saveStatus === 'loading'} className={`px-3 py-1.5 rounded font-bold text-xs transition-colors shadow-sm flex items-center text-white ${saveStatus === 'success' ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {saveStatus === 'loading' ? <RefreshCw size={18} className="animate-spin mr-1" /> : <Save size={18} className="mr-1" />}
              {saveStatus === 'success' ? '저장완료' : '서버저장'}
            </button>
            <button onClick={handlePrint} className="bg-gray-700 text-white px-3 py-1.5 rounded font-bold text-xs hover:bg-emerald-800 transition-colors shadow-sm flex items-center">
              <Printer size={18} className="mr-1" />미리보기
            </button>
          </div>
        </div>
        
        <div className="mb-6 border border-gray-300 rounded-xl px-6 py-4 bg-white shadow-sm flex items-center justify-between gap-4 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-3 whitespace-nowrap">
            <span className="text-[12px] font-black text-gray-400 uppercase tracking-tight">사업장명</span>
            <span className="font-bold text-gray-800">새마을운동중앙회 대치동사옥</span>
          </div>
          <div className="flex items-center gap-3 whitespace-nowrap">
            <span className="text-[12px] font-black text-gray-400 uppercase tracking-tight">작성자</span>
            <input 
              type="text" 
              value={report.author} 
              onChange={e => setReport({...report, author: e.target.value})} 
              className="border-b-2 border-gray-100 w-28 outline-none font-bold text-gray-800 py-1 text-center focus:border-blue-500 transition-all bg-transparent" 
            />
          </div>
          <div className="flex items-center gap-3 whitespace-nowrap">
            <span className="text-[12px] font-black text-gray-400 uppercase tracking-tight">작성일자</span>
            <span className="font-bold text-gray-800">{format(parseISO(report.reportingDate), 'yyyy년 MM월 dd일')}</span>
          </div>
        </div>
        
        <div className="border border-gray-300 rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="flex bg-gray-50 font-bold text-sm text-gray-500 uppercase tracking-wider divide-x divide-gray-300 border-b border-gray-300">
            <div className="w-[80px] py-4 text-center">분야</div>
            <div className="flex-1 py-4 text-center">금주 업무 실적</div>
            <div className="w-[120px] py-4 text-center">점검결과</div>
            <div className="flex-1 py-4 text-center">다음주 업무 계획</div>
          </div>
          <div className="divide-y divide-gray-300">
            {FIELDS.map(f => (
              <div key={f.id} className="flex divide-x divide-gray-300 group hover:bg-gray-50/30 transition-colors">
                <div className="w-[80px] flex items-center justify-center font-bold bg-gray-50 text-[13px] text-gray-700">{f.label}</div>
                <div className="flex-1 min-h-[50px]">
                  <textarea 
                    value={report.fields[f.id as keyof typeof report.fields].thisWeek} 
                    onChange={e => setReport({...report, fields: {...report.fields, [f.id]: {...report.fields[f.id as keyof typeof report.fields], thisWeek: e.target.value}}})} 
                    className="auto-expand-textarea w-full h-full p-3 text-[13px] focus:bg-blue-50/50 outline-none resize-none bg-transparent max-h-[200px] overflow-y-auto scrollbar-hide !text-left"
                    placeholder="내용 입력..."
                  />
                </div>
                <div className="w-[120px] min-h-[50px]">
                  <textarea 
                    value={report.fields[f.id as keyof typeof report.fields].results} 
                    onChange={e => setReport({...report, fields: {...report.fields, [f.id]: {...report.fields[f.id as keyof typeof report.fields], results: e.target.value}}})} 
                    className="auto-expand-textarea w-full h-full p-3 text-[13px] text-center focus:bg-blue-50/50 outline-none resize-none bg-transparent max-h-[200px] overflow-y-auto scrollbar-hide"
                    placeholder="결과..."
                  />
                </div>
                <div className="flex-1 min-h-[50px]">
                  <textarea 
                    value={report.fields[f.id as keyof typeof report.fields].nextWeek} 
                    onChange={e => setReport({...report, fields: {...report.fields, [f.id]: {...report.fields[f.id as keyof typeof report.fields], nextWeek: e.target.value}}})} 
                    className="auto-expand-textarea w-full h-full p-3 text-[13px] focus:bg-blue-50/50 outline-none resize-none bg-transparent max-h-[200px] overflow-y-auto scrollbar-hide !text-left"
                    placeholder="계획 입력..."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 border border-gray-300 rounded-xl p-4 bg-white shadow-sm">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-100"><h3 className="font-bold text-gray-800 flex items-center"><ImageIcon size={18} className="mr-2 text-blue-500" />작업 사진</h3><button onClick={handleOpenPhotoImportModal} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold border border-blue-100 hover:bg-blue-100 transition-all print:hidden">사진 불러오기</button></div>
          <div className="grid grid-cols-3 gap-4">{(report.photos || []).map((p, i) => (<div key={p.id} className="border border-gray-200 p-1.5 rounded-xl relative group bg-gray-50"><div className="aspect-[4/3] bg-white rounded-lg flex items-center justify-center overflow-hidden border border-gray-100 shadow-inner">{p.dataUrl ? <img src={p.dataUrl} className="w-full h-full object-cover" /> : <div className="text-center p-4"><label className="cursor-pointer text-blue-600 text-xs font-bold bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5"><Upload size={14}/> 사진 업로드<input type="file" accept="image/*" className="hidden" onChange={async e => { const f=e.target.files?.[0]; if(f){const u=await resizeImage(f); const n=[...(report.photos || [])]; n[i]={...n[i],dataUrl:u}; setReport({...report,photos:n});} }} /></label></div>}</div><input type="text" value={p.title} onChange={e => {const n=[...(report.photos || [])]; n[i]={...n[i],title:e.target.value}; setReport({...report,photos:n});}} placeholder="사진 제목 (예: 1층 전등 교체)" className="w-full mt-2 border-b border-gray-200 outline-none px-1 text-[11px] font-normal text-center bg-transparent focus:border-blue-400" /></div>))}</div>
        </div></>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Sparkles size={18} className="text-blue-500" />업무일지 항목 선택</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
              {['this', 'next'].map(wt => (
                <div key={wt}>
                  <h4 className="font-black text-gray-800 border-b-2 border-blue-500 inline-block px-2 pb-1 mb-4">{wt === 'this' ? '금주 실적 후보' : '차주 계획 후보'}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {FIELDS.map(f => { 
                      const its = selectableItems.filter(i => i.weekType === wt && i.fieldKey === f.id); 
                      if(its.length===0) return null; 
                      return (
                        <div key={f.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                          <strong className="text-slate-700">{f.label}</strong>
                          <div className="mt-3 space-y-1.5">
                            {its.map(it => (
                              <div key={it.id} onClick={() => toggleSelectItem(it.id)} className="flex gap-2 cursor-pointer text-[13px] group hover:text-blue-600 transition-colors">
                                {it.selected ? <CheckSquare size={16} className="text-blue-600 shrink-0" /> : <Square size={16} className="text-gray-300 shrink-0 group-hover:text-blue-400" />} 
                                <span className={it.selected ? 'font-bold' : 'text-gray-600'}>{it.content} {it.dayName ? `(${it.dayName}일)` : ''}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-white border border-gray-300 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-100 transition-all">취소</button>
              <button onClick={handleApplySelection} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all">보고서에 반영하기</button>
            </div>
          </div>
        </div>
      )}
      {isPhotoModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><ImageIcon size={18} className="text-emerald-500" />공사/작업 사진 연동</h3>
              <button onClick={() => setIsPhotoModalOpen(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/50">
              {selectablePhotos.length === 0 ? (
                <div className="py-20 text-center text-gray-400 italic font-medium">이번 주에 등록된 공사/작업 사진이 없습니다.</div>
              ) : (
                sortedDates.map(date => (
                  <div key={date} className="space-y-4">
                    <div className="flex items-center gap-2 sticky top-0 bg-gray-50/90 backdrop-blur-sm z-10 py-2">
                      <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black shadow-sm">
                        {format(parseISO(date), 'MM월 dd일')}
                      </span>
                      <div className="flex-1 h-px bg-gray-200"></div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {groupedPhotosByDate[date].map(p => (
                        <div key={p.id} onClick={() => toggleSelectPhoto(p.id)} className={`group relative border-2 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 shadow-sm ${p.selected ? 'border-blue-600 ring-4 ring-blue-100 translate-y-[-4px]' : 'border-white hover:border-blue-300 bg-white'}`}>
                          <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                            <img src={p.dataUrl} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" alt="" />
                          </div>
                          <div className="p-2 text-[11px] bg-white border-t border-gray-100 flex flex-col gap-0.5">
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="text-blue-600 font-black tracking-tighter">{p.category}</span>
                            </div>
                            <div className="text-gray-700 font-normal leading-tight line-clamp-2 min-h-[2.4em]" title={p.content}>
                              {p.content}
                            </div>
                          </div>
                          {p.selected && (
                            <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1 shadow-lg animate-in zoom-in-50 duration-300">
                              <CheckCircle2 size={18} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setIsPhotoModalOpen(false)} className="px-5 py-2.5 bg-white border border-gray-300 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-100 transition-all">취소</button>
              <button onClick={handleApplyPhotoSelection} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">선택한 사진 추가 ({selectablePhotos.filter(p=>p.selected).length}장)</button>
            </div>
          </div>
        </div>
      )}

      {showSaveConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-100">
                <Cloud className="text-blue-600" size={36} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">서버저장 확인</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                작성하신 주간업무보고 내용을<br/>
                서버에 안전하게 기록하시겠습니까?
              </p>
              
              <div className="flex gap-3">
                <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center"><X size={20} className="mr-2" />취소</button>
                <button onClick={handleSave} className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95"><CheckCircle size={20} className="mr-2" />확인</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scale-up {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-up {
          animation: scale-up 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default WeeklyWork;
