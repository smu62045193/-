
import React, { useState, useEffect } from 'react';
import { WaterTankLogData, WaterTankCheckItem } from '../types';
import { fetchWaterTankLog, saveWaterTankLog, getInitialWaterTankLog } from '../services/dataService';
import { format, getDay, parseISO, subMonths, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Save, Printer, RefreshCw, CheckCircle, X, Cloud, Edit2, Lock } from 'lucide-react';
import LogSheetLayout from './LogSheetLayout';

interface WaterTankLogDataProps {
  currentDate: Date;
}

const WaterTankLog: React.FC<WaterTankLogDataProps> = ({ currentDate }) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(currentDate);
  const monthKey = format(viewDate, 'yyyy-MM');
  const [data, setData] = useState<WaterTankLogData>(getInitialWaterTankLog(format(viewDate, 'yyyy-MM-dd')));

  useEffect(() => {
    // 사이드바 날짜가 변경될 때, 수정 모드가 아니라면 viewDate 업데이트
    if (!isEditMode) {
      setViewDate(currentDate);
    }
  }, [currentDate]);

  useEffect(() => {
    // viewDate(상단 화살표 또는 사이드바 날짜)가 바뀔 때 데이터 다시 로드
    loadData();
  }, [monthKey]);

  const loadData = async () => {
    setLoading(true);
    setIsEditMode(false);
    try {
      // 1. 해당 월의 데이터 조회 (월 단위 키 사용)
      const fetched = await fetchWaterTankLog(monthKey);
      
      if (fetched) {
        const migratedItems = fetched.items.map(item => {
          if (!item.results || !Array.isArray(item.results)) {
            // @ts-ignore
            const oldRes = item.result || 'O';
            return { ...item, results: item.criteria.map(() => oldRes) };
          }
          return item;
        });
        setData({ ...fetched, items: migratedItems });
      } else {
        // 2. 데이터가 없을 경우 초기화
        const initial = getInitialWaterTankLog(format(viewDate, 'yyyy-MM-dd'));
        
        // 3. 점검자 정보 자동 복사 로직 (이전 달 데이터 확인)
        const prevMonthDate = subMonths(viewDate, 1);
        const prevMonthKey = format(prevMonthDate, 'yyyy-MM');
        const prevFetched = await fetchWaterTankLog(prevMonthKey);
        
        if (prevFetched && prevFetched.inspector) {
          initial.inspector = prevFetched.inspector;
        }
        
        setData(initial);
      }
    } catch (e) {
      console.error(e);
      setData(getInitialWaterTankLog(format(viewDate, 'yyyy-MM-dd')));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data) return;
    setSaveStatus('loading');
    try {
      const success = await saveWaterTankLog(data);
      if (success) {
        setSaveStatus('success');
        setIsEditMode(false);
        alert('저장이 완료되었습니다.');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장 실패');
      }
    } catch (e) {
      setSaveStatus('error');
      alert('오류가 발생했습니다.');
    }
  };

  const handlePrevMonth = () => {
    if (isEditMode) return;
    setViewDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    if (isEditMode) return;
    setViewDate(prev => addMonths(prev, 1));
  };

  const toggleResult = (id: string, index: number) => {
    if (!isEditMode) return;
    const item = data.items.find(i => i.id === id);
    if (!item) return;
    const next: 'O' | 'X' = item.results[index] === 'O' ? 'X' : 'O';
    const newItems = data.items.map(it => {
      if (it.id === id) {
        const newRes = [...it.results];
        newRes[index] = next;
        return { ...it, results: newRes };
      }
      return it;
    });
    setData({ ...data, items: newItems });
  };

  const updateField = (field: keyof WaterTankLogData, value: string) => {
    if (!data || !isEditMode) return;
    setData({ ...data, [field]: value });
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900,scrollbars=yes');
    if (!printWindow) return;

    const dayName = ['일', '월', '화', '수', '목', '금', '토'][getDay(parseISO(data.date))];
    const [year, month, day] = data.date.split('-');

    const tableRows = data.items.map((it) => {
      return it.criteria.map((crit, cIdx) => `
        <tr style="height:38px;">
          ${cIdx === 0 ? `<td rowspan="${it.criteria.length}" style="font-weight:bold; border:1px solid black; text-align:center; background-color:#f9fafb; width:120px; font-size:9pt;">${it.category}</td>` : ''}
          <td style="border:1px solid black; text-align:left; padding-left:8px; font-size:8.5pt;">${crit}</td>
          <td style="border:1px solid black; text-align:center; font-weight:900; font-size:13pt; width:80px; color:${it.results[cIdx] === 'O' ? 'blue' : 'red'};">${it.results[cIdx] || ''}</td>
        </tr>
      `).join('');
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>저수조 위생점검 기준표 - ${data.date}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
            @page { size: A4 portrait; margin: 0; }
            body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; background: black !important; color: black; line-height: 1.1; -webkit-print-color-adjust: exact; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; } }
            .print-page { width: 210mm; min-height: 297mm; padding: 20mm 12mm 10mm 12mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
            table { width: 100%; border-collapse: collapse; border: 1.5px solid black; table-layout: fixed; }
            th, td { border: 1px solid black; padding: 2px; text-align: center; font-size: 9pt; height: 38px; }
            .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; min-height: 80px; }
            .title-area { flex: 1; text-align: center; }
            .doc-title { font-size: 24pt; font-weight: 900; line-height: 1.1; }
            .approval-table { width: 85mm !important; border: 1.5 solid black !important; margin-left: auto; }
            .approval-table th { height: 22px !important; font-size: 8pt !important; background-color: #f3f4f6 !important; font-weight: bold; border: 1px solid black !important; }
            .approval-table td { height: 60px !important; border: 1px solid black !important; background: #fff; }
            .approval-table .side-header { width: 24px !important; border: 1px solid black !important; font-size: 8pt; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
          <div class="print-page">
            <div class="header-flex">
              <div class="title-area"><div class="doc-title">저수조 위생점검 기준표</div></div>
              <table class="approval-table">
                <tr><th rowspan="2" class="side-header">결<br/>재</th><th>담 당</th><th>주 임</th><th>대 리</th><th>과 장</th><th>소 장</th></tr>
                <tr><td></td><td></td><td></td><td></td><td></td></tr>
              </table>
            </div>
            <table style="margin-bottom: 10px;">
              <tr><th style="width: 20%; background:#f9fafb; font-size:9pt;">건축물의 명칭</th><td colspan="3" style="text-align:left; padding-left:10px; font-size:9pt;">${data.buildingName}</td></tr>
              <tr><th style="background:#f9fafb; font-size:9pt;">설치장소</th><td colspan="3" style="text-align:left; padding-left:10px; font-size:9pt;">${data.location}</td></tr>
              <tr><th style="width: 20%; background:#f9fafb; font-size:9pt;">건축물 용도</th><td style="width: 30%; font-size:9pt;">${data.usage}</td><th style="width: 20%; background:#f9fafb; font-size:9pt;">점검일시</th><td style="font-size:9pt;">${year}년 ${month}월 ${day}일 (${dayName})</td></tr>
            </table>
            <table>
              <thead><tr><th style="width: 15%; background:#f9fafb; font-size:9pt;">조사사항</th><th style="background:#f9fafb; font-size:9pt;">점검기준</th><th style="width: 12%; background:#f9fafb; font-size:9pt;">적부(O·X)</th></tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
            <div style="margin-top: 30px; text-align: right; font-weight: bold; font-size: 11pt; padding-right: 10px;">
              점검자 : <span style="font-size:12pt; border-bottom:1px solid black; padding: 0 15px;">${data.inspector || ''}</span>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const navTitle = (
    <div className="flex items-center space-x-4">
      <button onClick={handlePrevMonth} disabled={isEditMode} className={`p-1 hover:bg-gray-100 rounded-full transition-colors print:hidden ${isEditMode ? 'opacity-20' : ''}`}>
        <ChevronLeft size={24} className="text-gray-600" />
      </button>
      <span className="text-2xl font-bold text-gray-800">
        {format(viewDate, 'yyyy년 MM월')}
      </span>
      <button onClick={handleNextMonth} disabled={isEditMode} className={`p-1 hover:bg-gray-100 rounded-full transition-colors print:hidden ${isEditMode ? 'opacity-20' : ''}`}>
        <ChevronRight size={24} className="text-gray-600" />
      </button>
    </div>
  );

  const actionButtons = (
    <div className="flex gap-2">
      <button 
        onClick={loadData} 
        disabled={loading} 
        className="flex items-center justify-center px-4 py-2.5 bg-white text-emerald-600 border border-emerald-200 rounded-xl font-bold shadow-sm hover:bg-emerald-50 transition-all active:scale-95 text-sm"
      >
        <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
        새로고침
      </button>

      <button 
        onClick={() => {
          if (isEditMode) {
            alert('저장이 완료되었습니다.');
          }
          setIsEditMode(!isEditMode);
        }} 
        className={`flex items-center px-4 py-3 rounded-2xl font-bold shadow-sm transition-all text-sm ${isEditMode ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-gray-100 text-slate-600 border border-slate-200 hover:bg-gray-200'}`}
      >
        {isEditMode ? <Lock size={18} className="mr-2" /> : <Edit2 size={18} className="mr-2" />}
        {isEditMode ? '수정완료' : '수정'}
      </button>

      <button 
        onClick={handleSave} 
        disabled={loading || saveStatus === 'loading'} 
        className={`flex items-center px-6 py-2 rounded-lg font-bold shadow-md transition-all text-sm ${
          saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
        } disabled:bg-blue-400 active:scale-95`}
      >
        {saveStatus === 'loading' ? <RefreshCw size={18} className="mr-2 animate-spin" /> : saveStatus === 'success' ? <CheckCircle size={18} className="mr-2" /> : <Save size={18} className="mr-2" />}
        {saveStatus === 'success' ? '저장완료' : '서버저장'}
      </button>

      <button 
        onClick={handlePrint} 
        className="flex-1 md:flex-none flex items-center justify-center px-6 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-bold shadow-md text-sm transition-all active:scale-95"
      >
        <Printer size={18} className="mr-2" />
        미리보기
      </button>
    </div>
  );

  return (
    <LogSheetLayout 
      title={navTitle} 
      loading={loading} 
      hideHeader={true}
      isEmbedded={false}
      hideSave={true}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-2 print:hidden">
          {navTitle}
          {actionButtons}
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 print:hidden">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 mb-1">건축물의 명칭</label>
              <input 
                type="text" 
                value={data.buildingName} 
                className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                readOnly
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 mb-1">설치장소</label>
              <input 
                type="text" 
                value={data.location} 
                className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                readOnly
              />
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 mb-1">건축물 용도</label>
              <input 
                type="text" 
                value={data.usage} 
                className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                readOnly
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 mb-1">점검일시</label>
              {isEditMode ? (
                <input 
                  type="date" 
                  value={data.date} 
                  onChange={e => updateField('date', e.target.value)} 
                  className="w-full border border-orange-200 bg-orange-50 rounded-lg px-3 py-2 text-sm font-bold text-blue-700 h-[38px] text-center"
                />
              ) : (
                <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm font-bold text-blue-600 flex items-center justify-center h-[38px]">
                  {format(parseISO(data.date), 'yyyy년 MM월 dd일')} ({['일', '월', '화', '수', '목', '금', '토'][getDay(parseISO(data.date))]})
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700 w-[15%] border-r border-gray-300">조사사항</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300">점검기준</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700 w-[12%]">적부(O·X)</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <React.Fragment key={item.id}>
                  {item.criteria.map((crit, idx) => (
                    <tr key={`${item.id}-${idx}`} className="border-b border-gray-200 last:border-0 hover:bg-gray-50/50 transition-colors">
                      {idx === 0 && <td rowSpan={item.criteria.length} className="px-4 py-3 border-r border-gray-300 font-bold bg-gray-50/50 text-center text-[13px] align-middle">{item.category}</td>}
                      <td className="px-4 py-3 text-left border-r border-gray-300 text-[13px] text-gray-600 pl-6">• {crit}</td>
                      <td 
                        className={`px-4 py-3 text-center font-black text-xl select-none transition-colors ${isEditMode ? 'cursor-pointer hover:bg-orange-50' : 'cursor-default'} ${item.results[idx] === 'O' ? 'text-blue-600' : 'text-red-600'}`} 
                        onClick={() => toggleResult(item.id, idx)}
                      >
                        {item.results[idx] || '-'}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end items-center gap-4 mt-8 px-2">
          <span className="font-bold text-slate-700">점검자 :</span>
          <input 
            type="text" 
            value={data.inspector} 
            onChange={e => updateField('inspector', e.target.value)} 
            className={`border-b-2 w-48 text-center font-bold text-lg outline-none transition-all ${isEditMode ? 'border-orange-500 bg-orange-50 text-blue-700' : 'border-slate-200 bg-transparent cursor-not-allowed'}`}
            placeholder="(인)"
            readOnly={!isEditMode}
          />
        </div>
      </div>

      <style>{`
        @keyframes scale-up {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-up {
          animation: scale-up 0.2s ease-out forwards;
        }
      `}</style>
    </LogSheetLayout>
  );
};

export default WaterTankLog;
