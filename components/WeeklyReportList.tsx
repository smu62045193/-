
import React, { useState, useEffect, useMemo } from 'react';
import { WeeklyReportData } from '../types';
import { fetchWeeklyReportList } from '../services/dataService';
import { format, parseISO, addDays } from 'date-fns';
import { FileText, Search, RefreshCw, Printer, Calendar, User, ChevronLeft, ChevronRight } from 'lucide-react';

interface WeeklyReportListProps {
  onSelectReport: (startDate: string) => void;
}

const ITEMS_PER_PAGE = 10;

const WeeklyReportList: React.FC<WeeklyReportListProps> = ({ onSelectReport }) => {
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<{key: string, data: WeeklyReportData}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadData();
  }, []);

  // 검색어가 변경될 때 페이지를 1로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadData = async () => {
    setLoading(true);
    setCurrentPage(1);
    try {
      const data = await fetchWeeklyReportList();
      const sorted = (data || []).sort((a, b) => b.key.localeCompare(a.key));
      setReports(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (report: WeeklyReportData) => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    const reportingDateStr = format(parseISO(report.reportingDate), 'yyyy년 MM월 dd일');

    const fields = [
      { id: 'electrical', label: '전기' },
      { id: 'mechanical', label: '기계' },
      { id: 'fire', label: '소방' },
      { id: 'elevator', label: '승강기' },
      { id: 'parking', label: '주차' },
      { id: 'security', label: '경비' },
      { id: 'cleaning', label: '미화' },
      { id: 'handover', label: '특이<br/>사항' },
    ];

    const fieldsTableHtml = fields.map(field => {
      const f = report.fields[field.id as keyof typeof report.fields];
      
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
            ${isFirst ? `<td rowspan="${rowCount}" style="font-weight:bold; background:#f9fafb; text-align:center; vertical-align:middle; width:40px;">${field.label}</td>` : ''}
            <td style="text-align:left; padding:2px 6px; vertical-align:middle; ${borderStyle}">${thisWeekLines[i] || ''}</td>
            <td style="text-align:center; padding:2px 6px; vertical-align:middle; width:90px; ${borderStyle}">${resultLines[i] || ''}</td>
            <td style="text-align:left; padding:2px 6px; vertical-align:middle; ${borderStyle}">${nextWeekLines[i] || ''}</td>
          </tr>
        `;
      }
      return categoryRows;
    }).join('');

    const photosHtml = (report.photos || []).filter(p => p.dataUrl).map(photo => `
      <div style="width:32%; border:1px solid #000; padding:6px; box-sizing:border-box; display:inline-block; vertical-align:top; margin-bottom:15px; margin-right:1%;">
        <div style="width:100%; aspect-ratio:4/3; overflow:hidden; border:1px solid #000; margin-bottom:5px; display:flex; align-items:center; justify-content:center; background:#f9f9f9;">
          <img src="${photo.dataUrl}" style="width:100%; height:100%; object-fit:cover;" />
        </div>
        <div style="font-weight:bold; font-size:8.5pt; border-bottom:1.5px solid #000; padding-bottom:2px; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${photo.title || '작업 사진'}</div>
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
            .print-page { width: 100%; max-width: 210mm; margin: 20px auto; padding: 25mm 12mm 10mm 12mm; box-sizing: border-box; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); min-height: 297mm; }
            .doc-title { margin: 0 auto 15px auto; text-align: center; font-size: 30pt; font-weight: 900; letter-spacing: 12px; text-decoration: underline; text-underline-offset: 8px; }
            .info-line { display: flex; justify-content: space-between; font-weight: bold; font-size: 11pt; margin-bottom: 15px; border-bottom: 1.5 solid black; padding-bottom: 5px; }
            .section-header { font-size: 13pt; font-weight: bold; margin-top: 10px; margin-bottom: 15px; border-left: 8px solid black; padding-left: 15px; text-align: left; }
            table { width: 100%; border-collapse: collapse; border: 1.5px solid black; margin-bottom: 15px; table-layout: fixed; }
            th, td { border: 1px solid black; padding: 6px; font-size: 9pt; vertical-align: top; word-break: break-all; }
            th { background: #f3f4f6; font-weight: bold; text-align: center; }
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
            
            <div class="section-header">1. 금주업무 / 업무계획</div>
            <table>
              <thead>
                <tr><th style="width:40px;">분야</th><th>금주 업무 실적</th><th style="width:90px;">점검결과</th><th>다음주 업무 계획</th></tr>
              </thead>
              <tbody>${fieldsTableHtml}</tbody>
            </table>
          </div>

          <!-- 2페이지: 작업 사진 -->
          <div class="print-page page-break">
            <div class="section-header">2. 작업사진</div>
            <div style="width:100%; min-height: 200px;">
              ${photosHtml || '<div style="text-align:center; padding:50px; color:#999; font-weight:bold;">등록된 작업 사진이 없습니다.</div>'}
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredReports = useMemo(() => {
    return reports.filter(r => 
      (r.data.author || '').includes(searchTerm) || 
      (r.data.startDate || '').includes(searchTerm) ||
      (r.data.reportingDate || '').includes(searchTerm)
    );
  }, [reports, searchTerm]);

  // 페이지네이션 계산
  const totalItems = filteredReports.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredReports.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredReports, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">주간업무보고 저장 이력</h2>
            <p className="text-xs text-gray-400 mt-0.5">서버에 저장된 모든 주간보고서 목록입니다.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <input 
              type="text" 
              placeholder="작성자 또는 날짜(YYYY-MM) 검색" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-gray-50 text-black outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
            />
            <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
          </div>
          <button 
            onClick={loadData}
            className="p-2.5 hover:bg-gray-100 rounded-xl transition-all text-gray-500 border border-gray-200 bg-white shadow-sm active:scale-95"
            title="새로고침"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[850px] border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-20">No</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase tracking-wider w-56">대상 주간 (월~일)</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-36">최종 보고일자</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-36">작성자</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-40">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && reports.length === 0 ? (
                <tr><td colSpan={5} className="py-24 text-center"><RefreshCw size={32} className="animate-spin text-blue-500 mx-auto mb-3" /><p className="text-gray-400 font-medium">데이터를 불러오는 중...</p></td></tr>
              ) : filteredReports.length === 0 ? (
                <tr><td colSpan={5} className="py-24 text-center text-gray-400 italic">저장된 보고서 이력이 없습니다.</td></tr>
              ) : (
                paginatedReports.map((report, idx) => {
                  const globalIdx = totalItems - ((currentPage - 1) * ITEMS_PER_PAGE + idx);
                  const start = parseISO(report.data.startDate);
                  const end = addDays(start, 6);
                  const weekRange = `${format(start, 'yyyy.MM.dd')} ~ ${format(end, 'MM.dd')}`;
                  
                  return (
                    <tr key={report.key} className="hover:bg-blue-50/40 transition-colors group">
                      <td className="px-6 py-5 text-center text-gray-400 font-mono text-xs">{globalIdx}</td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                            <Calendar size={20} />
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block">{weekRange}</span>
                            <span className="text-[10px] text-gray-400">Monday Start Basis</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="px-3 py-1 bg-gray-50 text-gray-600 rounded-md border border-gray-100 text-sm font-medium">
                          {report.data.reportingDate}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <User size={14} className="text-gray-400" />
                          <span className="text-gray-800 font-bold text-sm">
                            {report.data.author}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center flex gap-2 justify-center">
                        <button 
                          onClick={() => handleViewDetail(report.data)}
                          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-md shadow-blue-100"
                        >
                          상세보기
                          <Printer size={12} />
                        </button>
                        <button 
                          onClick={() => onSelectReport(report.data.startDate)}
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

        {/* 페이지네이션 UI */}
        {!loading && totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-center gap-2">
            <button
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`p-2 rounded-lg border transition-all ${
                currentPage === 1 
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed border-gray-200' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-300 shadow-sm active:scale-90'
              }`}
            >
              <ChevronLeft size={18} />
            </button>
            
            <div className="flex items-center gap-1 px-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-9 h-9 rounded-lg font-bold text-sm transition-all ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <button
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`p-2 rounded-lg border transition-all ${
                currentPage === totalPages 
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed border-gray-200' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-300 shadow-sm active:scale-90'
              }`}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyReportList;
