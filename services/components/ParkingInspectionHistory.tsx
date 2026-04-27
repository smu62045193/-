
import React, { useState, useEffect, useMemo } from 'react';
import { fetchParkingChangeList } from '../services/dataService';
import { ParkingChangeItem } from '../types';
import { RefreshCw, Search, History, Printer, Car, ChevronLeft, ChevronRight } from 'lucide-react';

interface ParkingInspectionHistoryProps {
  onSelect: () => void;
}

const ITEMS_PER_PAGE = 10;

const ParkingInspectionHistory: React.FC<ParkingInspectionHistoryProps> = ({ onSelect }) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ParkingChangeItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, history.length]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchParkingChangeList();
      const sortedData = (data || []).sort((a, b) => b.date.localeCompare(a.date));
      setHistory(sortedData);
    } catch (e) {
      console.error("주차 이력 로드 실패", e);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (item: ParkingChangeItem) => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>차량 변경 확인서 - ${item.company}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
            @page { size: A4 portrait; margin: 0; }
            body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; color: #333; line-height: 1.6; background: #000; -webkit-print-color-adjust: exact; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; } }
            
            .print-page { 
              width: 210mm; 
              min-height: 297mm; 
              padding: 25mm 20mm 15mm 20mm; 
              margin: 20px auto; 
              box-sizing: border-box; 
              background: #fff;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            
            .header { border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 40px; text-align: center; }
            .title { font-size: 28pt; font-weight: 900; margin: 0; color: #1e3a8a; letter-spacing: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; border: 1.5px solid #000; }
            th, td { border: 1px solid #000; padding: 18px; text-align: center; font-size: 12pt; }
            th { background: #f8fafc; font-weight: bold; width: 30%; }
            .highlight { font-weight: 900; font-size: 15pt; color: #1e3a8a; }
            .footer-sign { margin-top: 80px; text-align: center; }
            .org-name { font-weight: 900; font-size: 20pt; margin-top: 40px; }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button>
          </div>
          <div class="print-page">
            <div class="header">
              <h1 class="title">지정주차 차량 변경 확인서</h1>
            </div>
            <div style="text-align:right; font-weight:bold; font-size: 11pt; margin-bottom: 10px;">신청 일자: ${item.date}</div>
            <table>
              <tr><th>업 체 명</th><td class="highlight">${item.company}</td></tr>
              <tr><th>주 차 위 치</th><td style="font-weight:bold;">${item.location}</td></tr>
              <tr><th>변 경 구 분</th><td><span style="padding:4px 15px; background:#dbeafe; color:#1e40af; border-radius:6px; font-weight:bold; font-size:11pt;">${item.type}</span></td></tr>
              <tr><th>기존 차량번호</th><td style="color:#666;">${item.prevPlate || '없음(신규)'}</td></tr>
              <tr><th>변경 차량번호</th><td class="highlight" style="color: #d32f2f;">${item.newPlate}</td></tr>
              <tr style="height: 120px;"><th>비고 및 특이사항</th><td style="text-align:left; vertical-align:top;">${item.note || '특이사항 없음'}</td></tr>
            </table>
            <div class="footer-sign">
              <p style="font-weight:bold; font-size:13pt;">위와 같이 지정주차 차량 정보가 변경되었음을 확인합니다.</p>
              <div class="org-name">새마을운동중앙회 대치동사옥 시설팀</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredHistory = useMemo(() => {
    return history.filter(item => 
      (item.company || '').includes(searchTerm) || 
      (item.location || '').includes(searchTerm) || 
      (item.newPlate || '').includes(searchTerm) ||
      (item.date || '').includes(searchTerm)
    );
  }, [history, searchTerm]);

  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredHistory.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredHistory, currentPage]);

  const visiblePageNumbers = useMemo(() => {
    const halfWindow = 2;
    let startPage = Math.max(1, currentPage - halfWindow);
    const endPage = Math.min(totalPages, startPage + 4);
    if (endPage === totalPages) startPage = Math.max(1, endPage - 4);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) if (i > 0) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-2 animate-fade-in">
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
        <div className="flex items-stretch shrink-0">
          <div className="relative w-full sm:w-[250px] flex items-center bg-white border-none rounded-none">
            <input 
              type="text" 
              placeholder="업체명, 위치, 차량번호 검색" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-none text-[14px] font-bold bg-white text-black outline-none transition-all" 
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black" size={18} />
          </div>

          <div className="flex items-center shrink-0 px-2">
            <div className="w-[1px] h-6 bg-black"></div>
          </div>

          <div className="flex items-center shrink-0">
            <button 
              onClick={loadHistory}
              disabled={loading}
              className="shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent disabled:opacity-50 text-gray-500 hover:text-black transition-colors whitespace-nowrap relative"
            >
              <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-black max-w-7xl mx-auto">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[1000px] border-collapse text-center bg-white">
            <thead>
              <tr className="bg-white h-[40px] border-b border-black">
                <th className="border-r border-black text-center text-[13px] font-normal text-black w-20 p-0"><div className="flex items-center justify-center h-full px-2">No</div></th>
                <th className="border-r border-black text-center text-[13px] font-normal text-black w-32 p-0"><div className="flex items-center justify-center h-full px-2">변경일자</div></th>
                <th className="border-r border-black text-center text-[13px] font-normal text-black w-48 p-0"><div className="flex items-center justify-center h-full px-2">업체</div></th>
                <th className="border-r border-black text-center text-[13px] font-normal text-black w-24 p-0"><div className="flex items-center justify-center h-full px-2">위치</div></th>
                <th className="border-r border-black text-center text-[13px] font-normal text-black w-36 p-0"><div className="flex items-center justify-center h-full px-2">변경전차량번호</div></th>
                <th className="border-r border-black text-center text-[13px] font-normal text-black w-36 p-0"><div className="flex items-center justify-center h-full px-2">변경후차량번호</div></th>
                <th className="text-center text-[13px] font-normal text-black w-32 p-0"><div className="flex items-center justify-center h-full px-2">상세내역</div></th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading && history.length === 0 ? (
                <tr className="h-[40px] border-b border-black last:border-b-0">
                  <td colSpan={7} className="p-0">
                    <div className="flex flex-col items-center justify-center py-24 text-[13px] font-normal text-gray-400">
                      <RefreshCw size={32} className="animate-spin text-blue-500 mb-3" />
                      기록을 불러오는 중...
                    </div>
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr className="h-[40px] border-b border-black last:border-b-0">
                  <td colSpan={7} className="p-0">
                    <div className="flex items-center justify-center h-[100px] text-[13px] font-normal text-gray-400 italic">저장된 변경 기록이 없습니다.</div>
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((item, idx) => {
                  return (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors text-center h-[40px] border-b border-black last:border-b-0">
                      <td className="border-r border-black text-center text-[13px] font-normal text-black p-0"><div className="flex items-center justify-center h-full px-2">{filteredHistory.length - ((currentPage - 1) * ITEMS_PER_PAGE + idx)}</div></td>
                      <td className="border-r border-black text-center text-[13px] font-normal text-black p-0"><div className="flex items-center justify-center h-full px-2">{item.date}</div></td>
                      <td className="border-r border-black text-center text-[13px] font-normal text-black p-0"><div className="flex items-center justify-center h-full px-2">{item.company}</div></td>
                      <td className="border-r border-black text-center text-[13px] font-normal text-black p-0"><div className="flex items-center justify-center h-full px-2">{item.location}</div></td>
                      <td className="border-r border-black text-center text-[13px] font-normal text-black p-0"><div className="flex items-center justify-center h-full px-2">{item.prevPlate || '-'}</div></td>
                      <td className="border-r border-black text-center text-[13px] font-normal text-blue-600 p-0"><div className="flex items-center justify-center h-full px-2">{item.newPlate}</div></td>
                      <td className="text-center text-[13px] font-normal p-0">
                        <div className="flex items-center justify-center h-full px-2">
                          <button 
                            onClick={() => handleViewDetail(item)}
                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded transition-all active:scale-95"
                            title="미리보기"
                          >
                            <Printer size={14} />
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
      {filteredHistory.length > 0 && (
        <div className="py-4 flex items-center justify-center gap-2 print:hidden">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="p-2 bg-transparent border-none text-black disabled:text-gray-300 disabled:cursor-not-allowed transition-all active:scale-90 shadow-none cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="flex items-center gap-2">
            {visiblePageNumbers.map(pageNum => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
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
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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

export default ParkingInspectionHistory;
