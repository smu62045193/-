
import React, { useState, useEffect } from 'react';
import { WaterTankLogData, WaterTankCheckItem } from '../types';
import { fetchWaterTankLog, saveWaterTankLog, getInitialWaterTankLog } from '../services/dataService';
import { format, getDay, parseISO, subMonths, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Save, RefreshCw, CheckCircle, X, Cloud, Edit2, Lock, Printer } from 'lucide-react';
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
      
      // 2. 이전 달 데이터 조회 (점검자 정보 복사용)
      const prevMonthDate = subMonths(viewDate, 1);
      const prevMonthKey = format(prevMonthDate, 'yyyy-MM');
      const prevFetched = await fetchWaterTankLog(prevMonthKey);
      
      if (fetched) {
        const migratedItems = fetched.items.map(item => {
          if (!item.results || !Array.isArray(item.results)) {
            // @ts-expect-error: handling legacy data format
            const oldRes = item.result || 'O';
            return { ...item, results: item.criteria.map(() => oldRes) };
          }
          return item;
        });
        
        let currentInspector = fetched.inspector;
        // 현재 점검자가 비어있고 전월 데이터에 점검자가 있다면 무조건 불러오기
        if (!currentInspector && prevFetched && prevFetched.inspector) {
          currentInspector = prevFetched.inspector;
        }
        
        setData({ ...fetched, items: migratedItems, inspector: currentInspector || '' });
      } else {
        // 3. 데이터가 없을 경우 초기화
        const initial = getInitialWaterTankLog(format(viewDate, 'yyyy-MM-dd'));
        
        // 전월 데이터에 점검자가 있다면 무조건 불러오기
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
          ${cIdx === 0 ? `<td rowspan="${it.criteria.length}" style="font-weight:normal; border:1px solid black; text-align:center; background-color:#fff; width:120px; font-size:9pt;">${it.category}</td>` : ''}
          <td style="border:1px solid black; text-align:left; padding-left:8px; font-size:8.5pt;">${crit}</td>
          <td style="border:1px solid black; text-align:center; font-weight:normal; font-size:13pt; width:80px; color:${it.results[cIdx] === 'O' ? 'blue' : 'red'};">${it.results[cIdx] || ''}</td>
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
            .approval-table th { height: 22px !important; font-size: 8pt !important; background-color: #fff !important; font-weight: normal; border: 1px solid black !important; }
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
              <tr><th style="width: 20%; background:#fff; font-weight:normal; font-size:9pt;">건축물의 명칭</th><td colspan="3" style="text-align:left; padding-left:10px; font-size:9pt;">${data.buildingName}</td></tr>
              <tr><th style="background:#fff; font-weight:normal; font-size:9pt;">설치장소</th><td colspan="3" style="text-align:left; padding-left:10px; font-size:9pt;">${data.location}</td></tr>
              <tr><th style="width: 20%; background:#fff; font-weight:normal; font-size:9pt;">건축물 용도</th><td style="width: 30%; font-size:9pt;">${data.usage}</td><th style="width: 20%; background:#fff; font-weight:normal; font-size:9pt;">점검일시</th><td style="font-size:9pt;">${year}년 ${month}월 ${day}일 (${dayName})</td></tr>
            </table>
            <table>
              <thead><tr><th style="width: 15%; background:#fff; font-weight:normal; font-size:9pt;">조사사항</th><th style="background:#fff; font-weight:normal; font-size:9pt;">점검기준</th><th style="width: 12%; background:#fff; font-weight:normal; font-size:9pt;">적부(O·X)</th></tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
            <div style="margin-top: 30px; text-align: right; font-weight: normal; font-size: 11pt; padding-right: 10px;">
              점검자 : <span style="font-size:12pt; border-bottom:1px solid black; padding: 0 15px;">${data.inspector || ''}</span>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const navTitle = (
    <div className="flex items-center shrink-0">
      <button 
        onClick={handlePrevMonth} 
        disabled={isEditMode} 
        className="px-2 py-3 text-gray-500 hover:text-black transition-colors disabled:opacity-20"
      >
        <ChevronLeft size={20} />
      </button>
      <div className="px-2 py-3 text-[14px] font-bold text-black min-w-[100px] text-center">
        {format(viewDate, 'yyyy')}년 {format(viewDate, 'MM')}월
      </div>
      <button 
        onClick={handleNextMonth} 
        disabled={isEditMode} 
        className="px-2 py-3 text-gray-500 hover:text-black transition-colors disabled:opacity-20"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );

  const actionButtons = (
    <div className="flex items-center">
      <button 
        onClick={loadData} 
        disabled={loading} 
        className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
        title="새로고침"
      >
        <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
        새로고침
      </button>

      <button 
        onClick={() => {
          if (isEditMode) {
            alert('저장이 완료되었습니다.');
          }
          setIsEditMode(!isEditMode);
        }} 
        className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-all relative whitespace-nowrap disabled:opacity-50 ${
          isEditMode ? 'text-orange-600' : 'text-gray-500 hover:text-black'
        }`}
      >
        {isEditMode ? <Lock size={18} className="mr-1.5" /> : <Edit2 size={18} className="mr-1.5" />}
        {isEditMode ? '수정완료' : '수정'}
        {isEditMode && <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />}
      </button>

      <button 
        onClick={handleSave} 
        disabled={loading || saveStatus === 'loading'} 
        className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50 ${
          saveStatus === 'success' ? 'text-orange-600' : 'text-gray-500 hover:text-black'
        }`}
      >
        {saveStatus === 'loading' ? (
          <RefreshCw size={18} className="mr-1.5 animate-spin" />
        ) : saveStatus === 'success' ? (
          <CheckCircle size={18} className="mr-1.5" />
        ) : (
          <Save size={18} className="mr-1.5" />
        )}
        {saveStatus === 'success' ? '저장완료' : '저장'}
      </button>

      <button 
        onClick={handlePrint} 
        className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
      >
        <Printer size={18} className="mr-1.5" />
        인쇄
      </button>
    </div>
  );

  return (
    <div className="space-y-2 animate-fade-in">
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
        <div className="flex items-center shrink-0">
          {navTitle}
          <div className="flex items-center shrink-0 px-2">
            <div className="w-[1px] h-6 bg-black"></div>
          </div>
          {actionButtons}
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto flex items-stretch overflow-x-auto scrollbar-hide bg-white print:hidden border-b border-black mb-4">
        <div className="flex items-center shrink-0 gap-2">
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0 py-2 px-4">
            <span className="text-[14px] font-bold text-gray-500 uppercase">건축물의 명칭 :</span>
            <span className="text-sm font-bold text-black py-0.5 border-b-2 border-transparent">{data.buildingName}</span>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0 py-2 px-4">
            <span className="text-[14px] font-bold text-gray-500 uppercase">설치장소 :</span>
            <span className="text-sm font-bold text-black py-0.5 border-b-2 border-transparent">{data.location}</span>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0 py-2 px-4">
            <span className="text-[14px] font-bold text-gray-500 uppercase">건축물 용도 :</span>
            <span className="text-sm font-bold text-black py-0.5 border-b-2 border-transparent">{data.usage}</span>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0 py-2 px-4">
            <span className="text-[14px] font-bold text-gray-500 uppercase">점검자 :</span>
            {isEditMode ? (
              <input 
                type="text" 
                value={data.inspector} 
                onChange={e => updateField('inspector', e.target.value)} 
                className="border-b-2 border-blue-500 bg-blue-50/30 outline-none text-sm font-bold text-black py-0.5 text-center transition-all rounded-none w-24"
                placeholder="(인)"
              />
            ) : (
              <span className="text-sm font-bold text-black py-0.5 border-b-2 border-transparent w-24 text-center inline-block">{data.inspector || '(인)'}</span>
            )}
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0 py-2 px-4">
            <span className="text-[14px] font-bold text-gray-500 uppercase">점검일시 :</span>
            {isEditMode ? (
              <input 
                type="date" 
                value={data.date} 
                onChange={e => updateField('date', e.target.value)} 
                className="border-b-2 border-blue-500 bg-blue-50/30 outline-none text-sm font-bold text-black py-0.5 px-2 transition-all rounded-none h-[28px]"
              />
            ) : (
              <span className="text-sm font-bold text-black py-0.5 px-2 border-b-2 border-transparent flex items-center h-[28px]">
                {format(parseISO(data.date), 'yyyy년 MM월 dd일')} ({['일', '월', '화', '수', '목', '금', '토'][getDay(parseISO(data.date))]})
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white overflow-x-auto w-full max-w-7xl mx-auto mb-4">
        <table className="w-full text-center border-collapse border border-black">
          <thead className="bg-white border-b border-black">
            <tr className="h-[40px]">
              <th className="border border-black text-[13px] font-normal text-gray-500 uppercase tracking-wider">
                <div className="flex items-center justify-center h-full px-2">조사사항</div>
              </th>
              <th className="border border-black text-[13px] font-normal text-gray-500 uppercase tracking-wider">
                <div className="flex items-center justify-center h-full px-2">점검기준</div>
              </th>
              <th className="border border-black text-[13px] font-normal text-gray-500 uppercase tracking-wider w-[12%]">
                <div className="flex items-center justify-center h-full px-2">적부(O·X)</div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {data.items.map((item, itemIdx) => (
              <React.Fragment key={item.id}>
                {item.criteria.map((crit, idx) => {
                  return (
                    <tr key={`${item.id}-${idx}`} className="h-[40px] hover:bg-blue-50/30 transition-colors border-b border-black text-center">
                      {idx === 0 && (
                        <td 
                          rowSpan={item.criteria.length} 
                          className="border border-black bg-white align-middle"
                        >
                          <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal text-gray-800">
                            {item.category}
                          </div>
                        </td>
                      )}
                      <td className="border border-black text-left">
                        <div className="flex items-center h-full px-2 text-[13px] font-normal text-gray-600">
                          • {crit}
                        </div>
                      </td>
                      <td 
                        className={`border border-black select-none transition-colors ${isEditMode ? 'cursor-pointer hover:bg-orange-50' : 'cursor-default'}`} 
                        onClick={() => toggleResult(item.id, idx)}
                      >
                        <div className={`flex items-center justify-center h-full px-2 text-[13px] font-normal ${item.results[idx] === 'O' ? 'text-blue-600' : 'text-red-600'}`}>
                          {item.results[idx] || '-'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
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
    </div>
  );
};

export default WaterTankLog;
