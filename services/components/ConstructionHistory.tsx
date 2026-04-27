
import React, { useState, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { fetchExternalWorkList, fetchInternalWorkList, deleteConstructionWorkItem } from '../services/dataService';
import { ConstructionWorkItem, WorkPhoto } from '../types';
import { RefreshCw, Search, History, Image as ImageIcon, Printer, ChevronLeft, ChevronRight, HardHat, Edit2, Trash2, Download } from 'lucide-react';

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

      // 최신순 정렬 (날짜가 같으면 ID 역순으로 정렬하여 최근 추가 항목이 위로 오게 함)
      combined.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return String(b.id).localeCompare(String(a.id));
      });
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
    const firstPagePhotos = photos.slice(0, 4);
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
            body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; color: #333; line-height: 1.2; background: #000000; -webkit-print-color-adjust: exact; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { 
              .no-print { display: none !important; } 
              body { background: white !important; } 
              .print-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
              .page-break { page-break-before: always; }
            }
            .print-page { width: 210mm; min-height: 297mm; padding: 25mm 15mm 10mm 15mm; margin: 15px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
            .header { border-bottom: 2.5px solid #1e40af; padding-bottom: 5px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 18pt; font-weight: 900; margin: 0; color: #111; }
            .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; background: #f8fafc; padding: 8px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e2e8f0; }
            .meta-item { font-size: 9.5pt; font-weight: 500; }
            .meta-label { font-weight: bold; color: #64748b; margin-right: 6px; }
            .photo-title { font-size: 12pt; font-weight: bold; margin-bottom: 6px; border-left: 5px solid #1e40af; padding-left: 10px; text-align: left; }
            .content-box { font-size: 10pt; white-space: pre-wrap; background: white; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; margin-bottom: 12px; min-height: 40px; text-align: left; }
            .photo-grid-container { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; width: 100% !important; }
            .photo-card-item { border: 1.2px solid #000 !important; border-radius: 4px; overflow: hidden; background: white; page-break-inside: avoid; }
            .photo-img-container { width: 100%; aspect-ratio: 4/3; overflow: hidden; background: #f9f9f9; display: flex; align-items: center; justify-content: center; }
            .photo-img-container img { width: 100%; height: 100%; object-fit: cover; display: block; }
            .photo-caption { padding: 5px; font-weight: bold; color: #000; font-size: 8pt; background: #fff; border-top: 1.2px solid #000; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
          <div class="print-page">
            <div class="header"><h1 class="title">공사/작업 상세 보고서</h1><div style="font-weight: bold; color: #1e40af; font-size: 10pt;">새마을운동중앙회 대치동사옥</div></div>
            <div class="meta-grid">
              <div class="meta-item"><span class="meta-label">점검일자:</span>${item.date}</div>
              <div class="meta-item"><span class="meta-label">작업구분:</span>${item.category}</div>
              <div class="meta-item"><span class="meta-label">업체명:</span>${item.company || '시설팀 자체작업'}</div>
              <div class="meta-item"><span class="meta-label">사진수:</span>${(item.photos || []).length}장</div>
            </div>
            <div class="photo-title">작업 내용</div>
            <div class="content-box">${item.content}</div>
            ${firstPagePhotos.length > 0 ? `<div class="photo-title">작업 증빙 사진</div>${renderPhotoGrid(firstPagePhotos)}` : `<div class="photo-title">작업 증빙 사진</div><div style="padding: 20px; text-align: center; color: #999; font-style: italic; border: 1px solid #eee; border-radius: 6px;">첨부된 작업 사진이 없습니다.</div>`}
          </div>
          ${extraPagesHtml.join('')}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleEdit = (item: ConstructionWorkItem) => {
    const width = 1000;
    const height = 800;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    const mode = item.type === '시설작업' ? 'internal' : 'external';
    window.open(`/?popup=construction_log&mode=${mode}&id=${item.id}`, 'ConstructionEditWin', `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
  };

  const handleDelete = async (item: ConstructionWorkItem) => {
    if (window.confirm('해당 내역을 삭제하시겠습니까?')) {
      await deleteConstructionWorkItem(item.id);
      loadAllHistory();
    }
  };

  const handleDownloadAllImages = async (item: ConstructionWorkItem) => {
    if (!item.photos || item.photos.length === 0) {
      alert('다운로드할 이미지가 없습니다.');
      return;
    }

    try {
      const zip = new JSZip();
      const folderName = `${item.date}_${item.company || '작업'}_이미지`;
      
      const downloadPromises = item.photos.map(async (photo, index) => {
        if (!photo.dataUrl) return;
        try {
          let blob: Blob;
          if (photo.dataUrl.startsWith('data:')) {
            // Base64 처리
            const response = await fetch(photo.dataUrl);
            blob = await response.blob();
          } else {
            // URL 처리
            const response = await fetch(photo.dataUrl);
            blob = await response.blob();
          }

          // 확장자 추출 (없으면 jpg)
          let extension = 'jpg';
          const urlToParse = photo.dataUrl;
          if (urlToParse.includes('.')) {
            const parts = urlToParse.split('.');
            const lastPart = parts[parts.length - 1].split('?')[0].toLowerCase();
            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(lastPart)) {
              extension = lastPart;
            }
          } else if (photo.dataUrl.startsWith('data:image/')) {
            extension = photo.dataUrl.split(';')[0].split('/')[1];
          }
          
          zip.file(`${folderName}/image_${index + 1}.${extension}`, blob);
        } catch (error) {
          console.error(`이미지 다운로드 실패: ${photo.dataUrl}`, error);
        }
      });

      await Promise.all(downloadPromises);
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${folderName}.zip`);
    } catch (error) {
      console.error("압축 파일 생성 실패", error);
      alert("이미지 압축 중 오류가 발생했습니다.");
    }
  };

  const filteredHistory = useMemo(() => {
    return history.filter(item => 
      (item.content || '').includes(searchTerm) || 
      (item.company || '').includes(searchTerm) || 
      (item.date || '').includes(searchTerm) ||
      (item.category || '').includes(searchTerm)
    );
  }, [history, searchTerm]);

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
    <div className="space-y-2 animate-fade-in pb-10">
      <div className="w-full max-w-7xl mx-auto bg-white">
        <div className="flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
          <div className="flex items-stretch shrink-0">
            <div className="relative w-full sm:w-[250px] flex items-center bg-white border-none rounded-none">
              <input 
                type="text" 
                placeholder="내용, 업체, 날짜 검색" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-none text-[14px] font-bold bg-white text-black outline-none transition-all"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black" size={18} />
            </div>
          </div>

          <div className="flex items-center shrink-0 px-2">
            <div className="w-[1px] h-6 bg-black"></div>
          </div>

          <div className="flex items-center shrink-0">
            <button 
              onClick={loadAllHistory}
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
          <table className="w-full min-w-[950px] border-collapse text-center">
            <thead>
              <tr className="bg-white border-b border-black h-[40px]">
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-20 border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">No</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-32 border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">일자</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-24 border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">구분</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-56 border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">업체 (외부업체)</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">작업내용</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-40 px-2"><div className="flex items-center justify-center h-full px-2">관리</div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {loading && history.length === 0 ? (
                <tr className="h-[40px]"><td colSpan={6} className="text-center border-b border-black text-[13px] font-normal px-2"><div className="flex items-center justify-center h-full py-24"><RefreshCw size={32} className="animate-spin text-blue-500 mx-auto mb-3" /><p className="text-gray-400 font-medium">데이터를 불러오는 중...</p></div></td></tr>
              ) : filteredHistory.length === 0 ? (
                <tr className="h-[40px]"><td colSpan={6} className="text-center text-gray-400 italic border-b border-black text-[13px] font-normal px-2"><div className="flex items-center justify-center h-full py-24">저장된 기록이 없습니다.</div></td></tr>
              ) : (
                paginatedHistory.map((item, idx) => {
                  const globalIdx = totalItems - ((currentPage - 1) * ITEMS_PER_PAGE + idx);
                  return (
                    <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group border-b border-black last:border-b-0 h-[40px]">
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2"><div className="flex items-center justify-center h-full px-2 font-mono text-xs">{globalIdx}</div></td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">{item.date}</div></td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2">
                        <div className="flex items-center justify-center h-full px-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.type === '외부공사' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{item.category}</span>
                        </div>
                      </td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">{item.type === '시설작업' ? (item.company || '시설팀 (자체)') : (item.company || '(업체명 미입력)')}</div></td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2 whitespace-pre-wrap"><div className="flex items-center justify-center h-full px-2">{item.content}</div></td>
                      <td className="text-center text-black text-[13px] font-normal px-2">
                        <div className="flex items-center justify-center h-full px-2 gap-1 py-1">
                          <button onClick={() => handleDownloadAllImages(item)} className="p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-all" title="이미지 전체 다운로드"><Download size={16} /></button>
                          <button onClick={() => handleOpenDetail(item)} className="p-2 bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white rounded-lg transition-all" title="상세보기"><Printer size={16} /></button>
                          <button onClick={() => handleEdit(item)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all" title="편집"><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(item)} className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all" title="삭제"><Trash2 size={16} /></button>
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
            {visiblePageNumbers.map(pageNum => (
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

export default ConstructionHistory;
