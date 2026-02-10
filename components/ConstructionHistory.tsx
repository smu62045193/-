
import React, { useState, useEffect, useMemo } from 'react';
import { fetchExternalWorkList, fetchInternalWorkList } from '../services/dataService';
import { ConstructionWorkItem, WorkPhoto } from '../types';
import { RefreshCw, Search, History, ChevronRight, HardHat, ExternalLink, Image as ImageIcon, Printer, ChevronLeft } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

const ConstructionHistory: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<(ConstructionWorkItem & { type: string })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadAllHistory();
  }, []);

  // 검색어가 변경될 때 페이지를 1로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadAllHistory = async () => {
    setLoading(true);
    setCurrentPage(1);
    try {
      const [external, internal] = await Promise.all([
        fetchExternalWorkList(),
        fetchInternalWorkList()
      ]);

      const combined = [
        ...(external || []).map(item => ({ ...item, type: '외부공사' })),
        ...(internal || []).map(item => ({ ...item, type: '시설작업' }))
      ];

      // 최신순 정렬
      combined.sort((a, b) => b.date.localeCompare(a.date));
      setHistory(combined);
    } catch (e) {
      console.error("공사 이력 로드 실패", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = (item: ConstructionWorkItem) => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    const photos = item.photos || [];
    // 1페이지용 사진 (최대 4장)
    const firstPagePhotos = photos.slice(0, 4);
    // 2페이지 이후용 사진
    const extraPhotos = photos.slice(4);

    const renderPhotoGrid = (photoList: WorkPhoto[]) => `
      <div class="photo-grid-container">
        ${photoList.map(photo => `
          <div class="photo-card-item">
            <div class="photo-img-container">
              <img src="${photo.dataUrl}" />
            </div>
            <div class="photo-caption">${photo.fileName || '작업 사진'}</div>
          </div>
        `).join('')}
      </div>
    `;

    // 2페이지부터의 HTML 생성 - 페이지당 6장으로 수정
    const extraPagesHtml: string[] = [];
    const photosPerPage = 6;
    for (let i = 0; i < extraPhotos.length; i += photosPerPage) {
      const chunk = extraPhotos.slice(i, i + photosPerPage);
      extraPagesHtml.push(`
        <div class="print-page page-break">
          <div class="photo-title">작업 증빙 사진 (계속)</div>
          ${renderPhotoGrid(chunk)}
        </div>
      `);
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>공사/작업 상세내역 - ${item.date}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
            @page { size: A4 portrait; margin: 0; }
            body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; background: #f1f5f9; color: #333; line-height: 1.2; -webkit-print-color-adjust: exact; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { 
              .no-print { display: none !important; } 
              body { background: white !important; } 
              .print-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
              .page-break { page-break-before: always; }
            }
            
            .print-page { 
              width: 210mm; 
              min-height: 297mm; 
              padding: 25mm 15mm 10mm 15mm; /* 상단 25mm, 하단 10mm 설정 */
              margin: 15px auto; 
              box-sizing: border-box; 
              background: white; 
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); 
            }
            
            .header { border-bottom: 2.5px solid #1e40af; padding-bottom: 5px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 18pt; font-weight: 900; margin: 0; color: #111; }
            
            .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; background: #f8fafc; padding: 8px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e2e8f0; }
            .meta-item { font-size: 9.5pt; font-weight: 500; }
            .meta-label { font-weight: bold; color: #64748b; margin-right: 6px; }
            
            .photo-title { font-size: 12pt; font-weight: bold; margin-bottom: 6px; border-left: 5px solid #1e40af; padding-left: 10px; text-align: left; }
            
            .content-box { font-size: 10pt; white-space: pre-wrap; background: white; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; margin-bottom: 12px; min-height: 40px; text-align: left; }
            
            .photo-grid-container { 
              display: grid !important;
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 10px !important;
              width: 100% !important;
            }
            .photo-card-item { 
              border: 1.2px solid #000 !important; 
              border-radius: 4px; 
              overflow: hidden; 
              background: white; 
              page-break-inside: avoid;
            }
            .photo-img-container { 
              width: 100%; 
              aspect-ratio: 4/3; 
              overflow: hidden; 
              background: #f9f9f9;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .photo-img-container img { 
              width: 100%; 
              height: 100%; 
              object-fit: cover; 
              display: block; 
            }
            .photo-caption { 
              padding: 5px; 
              font-weight: bold; 
              color: #000; 
              font-size: 8pt; 
              background: #fff; 
              border-top: 1.2px solid #000; 
              text-align: center;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button>
          </div>
          
          <!-- Page 1: Metadata, Content, and First 4 Photos -->
          <div class="print-page">
            <div class="header">
              <h1 class="title">공사/작업 상세 보고서</h1>
              <div style="font-weight: bold; color: #1e40af; font-size: 10pt;">새마을운동중앙회 대치동사옥</div>
            </div>
            
            <div class="meta-grid">
              <div class="meta-item"><span class="meta-label">점검일자:</span>${item.date}</div>
              <div class="meta-item"><span class="meta-label">작업구분:</span>${item.category}</div>
              <div class="meta-item"><span class="meta-label">업체명:</span>${item.company || '시설팀 자체작업'}</div>
              <div class="meta-item"><span class="meta-label">사진수:</span>${(item.photos || []).length}장</div>
            </div>

            <div class="photo-title">작업 내용</div>
            <div class="content-box">${item.content}</div>

            ${firstPagePhotos.length > 0 ? `
              <div class="photo-title">작업 증빙 사진</div>
              ${renderPhotoGrid(firstPagePhotos)}
            ` : `
              <div class="photo-title">작업 증빙 사진</div>
              <div style="padding: 20px; text-align: center; color: #999; font-style: italic; border: 1px solid #eee; border-radius: 6px;">첨부된 작업 사진이 없습니다.</div>
            `}
          </div>

          <!-- Following Pages: Extra Photos -->
          ${extraPagesHtml.join('')}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredHistory = useMemo(() => {
    return history.filter(item => 
      (item.content || '').includes(searchTerm) || 
      (item.company || '').includes(searchTerm) || 
      (item.date || '').includes(searchTerm) ||
      (item.category || '').includes(searchTerm)
    );
  }, [history, searchTerm]);

  // 페이지네이션 계산
  const totalItems = filteredHistory.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const paginatedHistory = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredHistory, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <History size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">공사 및 작업 통합 이력</h2>
          </div>
          <div className="relative flex-1 md:w-72 lg:w-80">
            <input 
              type="text" 
              placeholder="내용, 업체, 날짜 검색" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-gray-50 text-black outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
            />
            <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button 
            onClick={loadAllHistory}
            disabled={loading}
            className="flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 bg-white text-emerald-600 border border-emerald-200 rounded-xl font-bold shadow-sm hover:bg-emerald-50 transition-all text-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[950px] border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-16">No</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-32">날짜</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-24">구분</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase tracking-wider w-44">업체 (외부업체)</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase tracking-wider">내용</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-32">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <RefreshCw size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">데이터를 불러오는 중...</p>
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center text-gray-400 italic">저장된 기록이 없습니다.</td>
                </tr>
              ) : (
                paginatedHistory.map((item, idx) => {
                  const globalIdx = totalItems - ((currentPage - 1) * ITEMS_PER_PAGE + idx);
                  
                  return (
                    <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group">
                      <td className="px-4 py-4 text-center text-gray-400 font-mono text-xs">{globalIdx}</td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-2.5 py-1 bg-gray-50 text-gray-700 rounded-md border border-gray-100 text-xs font-bold">
                          {item.date}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.type === '외부공사' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-white border border-gray-100 rounded-lg shadow-sm">
                            <HardHat size={14} className={item.type === '외부공사' ? 'text-orange-500' : 'text-green-500'} />
                          </div>
                          <span className="font-bold text-gray-900 text-sm">
                            {item.type === '시설작업' 
                              ? (item.company || '시설팀 (자체)') 
                              : (item.company || '(업체명 미입력)')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 truncate max-w-[300px]" title={item.content}>
                            {item.content}
                          </span>
                          {item.photos && item.photos.length > 0 && (
                            <div className="flex items-center gap-0.5 text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              <ImageIcon size={10} />
                              {item.photos.length}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button 
                          onClick={() => handleOpenDetail(item)}
                          className="flex items-center gap-1 mx-auto bg-blue-600 text-white px-4 py-1.5 rounded-xl text-[11px] font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-md shadow-blue-100"
                        >
                          상세보기
                          <Printer size={12} />
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

export default ConstructionHistory;
