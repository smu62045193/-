
import React, { useState, useEffect, useMemo } from 'react';
import { WeeklyReportData } from '../types';
import { fetchWeeklyReportList, deleteWeeklyReport } from '../services/dataService';
import { format, parseISO, addDays } from 'date-fns';
import { FileText, Search, RefreshCw, Printer, Calendar, User, ChevronLeft, ChevronRight, Trash2, Edit3 } from 'lucide-react';

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
      const f = report.fields[field.id as keyof typeof report.fields] || { thisWeek: '', results: '', nextWeek: '' };
      
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
            ${isFirst ? `<td rowspan="${rowCount}" style="font-weight:normal; background:#f9fafb; text-align:center; vertical-align:middle; width:40px;">${field.label}</td>` : ''}
            <td style="text-align:left; padding:2px 6px; vertical-align:middle; ${borderStyle}">${thisWeekLines[i] || ''}</td>
            <td style="text-align:center; padding:2px 6px; vertical-align:middle; width:90px; ${borderStyle}">${resultLines[i] || ''}</td>
            <td style="text-align:left; padding:2px 6px; vertical-align:middle; ${borderStyle}">${nextWeekLines[i] || ''}</td>
          </tr>
        `;
      }
      return categoryRows;
    }).join('');

    const validPhotos = (report.photos || []).filter(p => p.dataUrl);
    const photoChunks = [];
    for (let i = 0; i < validPhotos.length; i += 12) {
      photoChunks.push(validPhotos.slice(i, i + 12));
    }

    let photosPagesHtml = '';
    if (photoChunks.length === 0) {
      photosPagesHtml = `
        <div class="print-page page-break">
          <div class="section-header">2. 작업사진</div>
          <div style="width:100%; min-height: 200px;">
            <div style="text-align:center; padding:50px; color:#999; font-weight:bold;">등록된 작업 사진이 없습니다.</div>
          </div>
        </div>
      `;
    } else {
      photosPagesHtml = photoChunks.map((chunk, index) => {
        const chunkHtml = chunk.map(photo => `
          <div style="width:32%; border:1px solid #000; padding:6px; box-sizing:border-box; display:inline-block; vertical-align:top; margin-bottom:15px; margin-right:1%;">
            <div style="width:100%; aspect-ratio:4/3; overflow:hidden; border:1px solid #000; margin-bottom:5px; display:flex; align-items:center; justify-content:center; background:#f9f9f9;">
              <img src="${photo.dataUrl}" style="width:100%; height:100%; object-fit:cover;" />
            </div>
            <div style="font-weight:normal; font-size:8.5pt; border-bottom:1.5px solid #000; padding-bottom:2px; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${photo.title || '작업 사진'}</div>
          </div>
        `).join('');
        
        return `
          <div class="print-page page-break">
            <div class="section-header">2. 작업사진 ${photoChunks.length > 1 ? `(${index + 1}/${photoChunks.length})` : ''}</div>
            <div style="width:100%; min-height: 200px;">
              ${chunkHtml}
            </div>
          </div>
        `;
      }).join('');
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>주간업무보고 - ${report.startDate}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
            @page { size: A4 portrait; margin: 0; }
            body { font-family: 'Noto Sans KR', sans-serif; font-size: 9pt; line-height: 1.2; color: black; margin: 0; padding: 0; background: #000000; -webkit-print-color-adjust: exact; }
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
            th { background: #f3f4f6; font-weight: normal; text-align: center; }
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

          ${photosPagesHtml}
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

  const handleDeleteReport = async (startDate: string) => {
    if (!confirm('정말로 이 보고서를 삭제하시겠습니까?')) return;
    
    try {
      const success = await deleteWeeklyReport(startDate);
      if (success) {
        alert('삭제되었습니다.');
        loadData();
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다.');
    }
  };

  return (
    <div className="space-y-2 animate-fade-in pb-10">
      <div className="w-full max-w-7xl mx-auto bg-white">
        <div className="flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
          <div className="flex items-stretch shrink-0">
            <div className="relative w-full sm:w-[250px] flex items-center bg-white border-none rounded-none">
              <input 
                type="text" 
                placeholder="작성자 또는 날짜(YYYY-MM) 검색" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-none text-[14px] font-bold bg-white text-black outline-none transition-all"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black" size={18} />
            </div>
          </div>

          <div className="flex items-center shrink-0 px-2">
            <div className="border-l-[1px] h-6 border-black"></div>
          </div>

          <div className="flex items-center shrink-0">
            <button 
              onClick={loadData}
              disabled={loading}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
              title="새로고침"
            >
              <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          </div>
        </div>
      </div>

        <div className="max-w-7xl mx-auto bg-white border border-black overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[850px] border-collapse text-center">
            <thead>
              <tr className="bg-white border-b border-black h-[40px]">
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-20 border-r border-black px-2"><div className="flex items-center justify-center h-full">No</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-56 border-r border-black px-2"><div className="flex items-center justify-center h-full">대상 주간 (월~일)</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-36 border-r border-black px-2"><div className="flex items-center justify-center h-full">최종 보고일자</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-36 border-r border-black px-2"><div className="flex items-center justify-center h-full">작성자</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-40 px-2"><div className="flex items-center justify-center h-full">관리</div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {loading && reports.length === 0 ? (
                <tr className="h-[40px]"><td colSpan={5} className="text-center border-b border-black text-[13px] font-normal px-2"><div className="flex items-center justify-center h-full py-24"><RefreshCw size={32} className="animate-spin text-blue-500 mx-auto mb-3" /><p className="text-gray-400 font-medium">데이터를 불러오는 중...</p></div></td></tr>
              ) : filteredReports.length === 0 ? (
                <tr className="h-[40px]"><td colSpan={5} className="text-center text-gray-400 italic border-b border-black text-[13px] font-normal px-2"><div className="flex items-center justify-center h-full py-24">저장된 보고서 이력이 없습니다.</div></td></tr>
              ) : (
                paginatedReports.map((report, idx) => {
                  const globalIdx = totalItems - ((currentPage - 1) * ITEMS_PER_PAGE + idx);
                  const start = parseISO(report.data.startDate);
                  const end = addDays(start, 6);
                  const weekRange = `${format(start, 'yyyy.MM.dd')} ~ ${format(end, 'MM.dd')}`;
                  
                  return (
                    <tr key={report.key} className="hover:bg-blue-50/40 transition-colors group border-b border-black last:border-b-0 h-[40px]">
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2"><div className="flex items-center justify-center h-full">{globalIdx}</div></td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2">
                        <div className="flex items-center justify-center h-full">{weekRange}</div>
                      </td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2">
                        <div className="flex items-center justify-center h-full">{report.data.reportingDate}</div>
                      </td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2">
                        <div className="flex items-center justify-center h-full">{report.data.author}</div>
                      </td>
                      <td className="text-center text-black text-[13px] font-normal print:hidden px-2">
                        <div className="flex items-center justify-center h-full gap-1 py-1">
                          <button 
                            onClick={() => handleViewDetail(report.data)}
                            className="p-2 bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white rounded-lg transition-all"
                            title="상세보기"
                          >
                            <Search size={16} />
                          </button>
                          <button 
                            onClick={() => onSelectReport(report.data.startDate)}
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all"
                            title="편집"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteReport(report.data.startDate)}
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 UI - 미니멀 텍스트 스타일로 정밀 수정 */}
      {!loading && totalPages > 1 && (
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-2 bg-transparent border-none text-black disabled:text-gray-300 disabled:cursor-not-allowed transition-all active:scale-90 shadow-none cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`w-9 h-9 bg-transparent border-none transition-all active:scale-90 flex items-center justify-center ${
                  currentPage === pageNum
                    ? 'text-black font-bold scale-110 cursor-default'
                    : 'text-black font-normal hover:text-blue-500 cursor-pointer'
                }`}
              >
                <span className="text-[13px]">{pageNum}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-2 bg-transparent border-none text-black disabled:text-gray-300 disabled:cursor-not-allowed transition-all active:scale-90 shadow-none cursor-pointer"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default WeeklyReportList;
