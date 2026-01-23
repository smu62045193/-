
import React, { useState, useEffect } from 'react';
import { apiFetchRange } from '../services/dataService';
import { RefreshCw, Search, History, Printer, Droplets } from 'lucide-react';
import { format, parseISO, getDay } from 'date-fns';

interface MechInspectionHistoryProps {
  onSelect: (tabId: string, date: string) => void;
}

interface HistoryListItem {
  id: string;
  date: string;
  category: string;
  tabId: string;
  rawKey: string;
  data: any;
}

const MechInspectionHistory: React.FC<MechInspectionHistoryProps> = ({ onSelect }) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const CATEGORY_MAP: Record<string, { label: string, tabId: string, icon: React.ReactNode }> = {
    'WATER_TANK_': { label: '저수조 위생점검', tabId: 'water', icon: <Droplets size={16} className="text-blue-500" /> },
  };

  useEffect(() => {
    loadAllHistory();
  }, []);

  const loadAllHistory = async () => {
    setLoading(true);
    try {
      const prefixes = Object.keys(CATEGORY_MAP);
      const allResults: HistoryListItem[] = [];

      const responses = await Promise.all(
        prefixes.map(prefix => apiFetchRange(prefix, "2024-01-01", "2034-12-31"))
      );

      responses.forEach((rows, idx) => {
        const prefix = prefixes[idx];
        const categoryInfo = CATEGORY_MAP[prefix];
        
        rows.forEach((row: any) => {
          const datePart = row.key.replace(prefix, '');
          allResults.push({
            id: row.key,
            date: datePart,
            category: categoryInfo.label,
            tabId: categoryInfo.tabId,
            rawKey: row.key,
            data: row.data
          });
        });
      });

      allResults.sort((a, b) => b.date.localeCompare(a.date));
      setHistory(allResults);
    } catch (e) {
      console.error("기계 이력 로드 실패", e);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (item: HistoryListItem) => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow || !item.data) return;

    const data = item.data;
    const dateObj = parseISO(item.date);
    const dayName = ['일', '월', '화', '수', '목', '금', '토'][getDay(dateObj)];
    const [y, m, d] = item.date.split('-');

    const tableRows = data.items.map((it: any) => {
      return it.criteria.map((crit: string, cIdx: number) => `
        <tr style="height:35px;">
          ${cIdx === 0 ? `<td rowspan="${it.criteria.length}" style="font-weight:bold; border:1px solid black; text-align:center; background-color:#f9fafb; width:120px;">${it.category}</td>` : ''}
          <td style="border:1px solid black; text-align:left; padding-left:12px; font-size:10px;">${crit}</td>
          <td style="border:1px solid black; text-align:center; font-weight:900; font-size:16pt; width:80px; color:${it.results[cIdx] === 'O' ? '#1d4ed8' : '#dc2626'};">${it.results[cIdx] || ''}</td>
        </tr>
      `).join('');
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>저수조 위생점검 기록부 - ${item.date}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
            @page { size: A4 portrait; margin: 0; }
            body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; color: black; line-height: 1.4; background: #f1f5f9; -webkit-print-color-adjust: exact; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; } }
            
            .print-page { width: 210mm; min-height: 297mm; padding: 25mm 15mm 15mm 15mm; margin: 20px auto; box-sizing: border-box; background: #fff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
            .doc-title { text-align: center; font-size: 25pt; font-weight: 900; text-decoration: underline; text-underline-offset: 8px; margin-bottom: 35px; letter-spacing: 2px; }
            table { width: 100%; border-collapse: collapse; border: 1.5px solid black; table-layout: fixed; margin-bottom: 20px; }
            th, td { border: 1px solid black; padding: 8px; font-size: 10px; word-break: break-all; }
            th { background: #f3f4f6; font-weight: bold; text-align: center; }
            .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; min-height: 100px; }
            .approval-table { width: 90mm !important; border: 1.5px solid black !important; margin-left: auto; border-collapse: collapse; }
            .approval-table th { height: 22px !important; font-size: 8.5pt !important; background-color: #f3f4f6 !important; font-weight: bold; }
            .approval-table td { height: 65px !important; border: 1px solid black !important; background: #fff; }
            .approval-table .side-header { width: 26px !important; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
          <div class="print-page">
            <div class="header-flex">
              <div style="flex: 1; text-align: center;"><div class="doc-title">저수조 위생점검 기준표</div></div>
              <table class="approval-table">
                <tr><th rowspan="2" class="side-header">결<br/>재</th><th>담 당</th><th>주 임</th><th>대 리</th><th>과 장</th><th>소 장</th></tr>
                <tr><td></td><td></td><td></td><td></td><td></td></tr>
              </table>
            </div>
            <table>
              <tr><th style="width: 130px;">건축물의 명칭</th><td colspan="3" style="font-weight:bold;">${data.buildingName}</td></tr>
              <tr><th>설치장소</th><td colspan="3">${data.location}</td></tr>
              <tr><th>건축물 용도</th><td style="width:30%">${data.usage}</td><th style="width:130px;">점검일시</th><td>${y}년 ${m}월 ${d}일 (${dayName})</td></tr>
            </table>
            <table>
              <thead><tr style="height:40px;"><th style="width:120px;">조사사항</th><th>점검기준</th><th style="width:80px;">적부(O·X)</th></tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
            <div style="margin-top: 40px; text-align: right; font-weight: bold; font-size: 12pt; padding-right: 10px;">
              점검자 : <span style="font-size:14pt; border-bottom:1px solid black; padding: 0 20px;">${data.inspector || ''}</span>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredHistory = history.filter(item => 
    item.category.includes(searchTerm) || item.date.includes(searchTerm)
  );

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <History size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">기계 점검 통합 이력</h2>
            <p className="text-xs text-gray-400 mt-0.5">저수조 위생점검 등 기계 점검 기록 목록입니다.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <input 
              type="text" 
              placeholder="항목명 또는 날짜 검색" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-gray-50 text-black outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
            />
            <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
          </div>
          <button 
            onClick={loadAllHistory}
            className="p-2.5 hover:bg-gray-100 rounded-xl transition-all text-gray-500 border border-gray-200 bg-white shadow-sm active:scale-95"
            title="새로고침"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-20">No</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-40">점검일자</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase tracking-wider">점검 항목명 (구분)</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-64">상세보기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-24 text-center">
                    <RefreshCw size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">데이터를 집계하는 중...</p>
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-24 text-center text-gray-400 italic">저장된 점검 기록이 없습니다.</td>
                </tr>
              ) : (
                filteredHistory.map((item, idx) => {
                  const prefix = Object.keys(CATEGORY_MAP).find(p => item.rawKey.startsWith(p));
                  const icon = prefix ? CATEGORY_MAP[prefix].icon : <Droplets size={16} />;
                  
                  return (
                    <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group">
                      <td className="px-6 py-4 text-center text-gray-400 font-mono text-xs">{filteredHistory.length - idx}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1 bg-gray-50 text-gray-700 rounded-md border border-gray-100 text-sm font-bold">
                          {item.date}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white border border-gray-100 rounded-lg shadow-sm">
                            {icon}
                          </div>
                          <span className="font-bold text-gray-900">{item.category}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center flex gap-2 justify-center">
                        <button 
                          onClick={() => handleViewDetail(item)}
                          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-md shadow-blue-100"
                        >
                          상세보기
                          <Printer size={12} />
                        </button>
                        <button 
                          onClick={() => onSelect(item.tabId, item.date)}
                          className="flex items-center gap-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all active:scale-95"
                        >
                          편집
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MechInspectionHistory;
