import React, { useState, useEffect, useMemo } from 'react';
import { ParkingStatusItem } from '../types';
import { fetchParkingStatusList, saveParkingStatusList, deleteParkingStatusItem, generateUUID } from '../services/dataService';
import { Trash2, Printer, Plus, Edit2, RotateCcw, AlertTriangle, X, Cloud, CheckCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const ITEMS_PER_PAGE = 10;

const ParkingStatusList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ParkingStatusItem[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [newItem, setNewItem] = useState<ParkingStatusItem>({
    id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: '변경',
    company: '',
    location: '',
    plateNum: '',
    prevPlate: '',
    note: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  // 데이터 길이가 변경되면 페이지를 1로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchParkingStatusList();
    setItems(data || []);
    setLoading(false);
  };

  const handleLoadToForm = (item: ParkingStatusItem) => {
    setNewItem({ 
      ...item, 
      prevPlate: item.plateNum 
    });
    setEditId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setNewItem({
      id: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      type: '변경',
      company: '',
      location: '',
      plateNum: '',
      prevPlate: '',
      note: ''
    });
  };

  const handleRegister = async () => {
    if (!newItem.location?.trim()) {
      alert('주차 위치(예: B2-1)를 입력해주세요.');
      return;
    }
    if (!newItem.plateNum?.trim()) {
      alert('변경후 차량번호는 필수입니다.');
      return;
    }

    setLoading(true);
    const originalList = [...items];
    try {
      const currentList = await fetchParkingStatusList();
      let updatedList = [...(currentList || [])];
      
      if (editId) {
        const index = updatedList.findIndex(s => String(s.id) === String(editId));
        if (index >= 0) {
          updatedList[index] = { ...newItem };
        }
      } else {
        const normalize = (val: string) => (val || '').toString().replace(/\s+/g, '').toUpperCase();
        const targetLocation = normalize(newItem.location);
        
        let existingIndex = -1;
        if (targetLocation) {
          existingIndex = updatedList.findIndex(s => normalize(s.location) === targetLocation);
        }

        const itemToSave = { 
          ...newItem, 
          id: existingIndex >= 0 ? updatedList[existingIndex].id : generateUUID() 
        };

        if (existingIndex >= 0) {
          if (window.confirm(`해당 위치(${newItem.location})에 이미 차량이 등록되어 있습니다. 정보를 덮어쓰시겠습니까?`)) {
            updatedList[existingIndex] = itemToSave;
          } else {
            setLoading(false);
            return;
          }
        } else {
          updatedList.push(itemToSave);
        }
      }

      updatedList.sort((a, b) => {
        const locA = (a.location || '').toString();
        const locB = (b.location || '').toString();
        return locA.localeCompare(locB, undefined, { numeric: true });
      });

      setItems(updatedList);

      const success = await saveParkingStatusList(updatedList);
      if (success) {
        handleCancelEdit();
        alert('저장이 완료되었습니다.');
      } else {
        setItems(originalList);
        alert('저장 실패');
      }
    } catch (e) {
      console.error(e);
      setItems(originalList);
      alert('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const idStr = String(id);
    const originalList = [...items];
    
    setLoading(true);
    try {
      const success = await deleteParkingStatusItem(idStr);
      
      if (success) {
        const newItems = originalList.filter(i => String(i.id) !== idStr);
        setItems(newItems);
        if (String(editId) === idStr) handleCancelEdit();
        alert('삭제가 완료되었습니다.');
      } else {
        alert('서버 저장 실패로 삭제가 취소되었습니다.');
      }
    } catch (e) {
      console.error(e);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    const tableRows = items.map((item, index) => `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td class="text-center">${item.date || ''}</td>
        <td class="text-center">${item.type || ''}</td>
        <td class="text-center font-bold">${item.company}</td>
        <td class="text-center font-bold">${item.location}</td>
        <td class="text-center">${item.prevPlate || ''}</td>
        <td class="text-center font-bold" style="color:blue;">${item.plateNum}</td>
        <td class="text-center">${item.note}</td>
      </tr>`).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>지정주차 차량 현황 미리보기</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
          @page { size: A4 portrait; margin: 0; }
          body { font-family: 'Noto Sans KR', sans-serif; background: #f1f5f9; padding: 0; margin: 0; background: white !important; -webkit-print-color-adjust: exact; }
          .no-print { display: flex; justify-content: center; padding: 20px; }
          @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; } }
          .print-page { 
            width: 210mm; 
            min-height: 297mm; 
            margin: 20px auto; 
            padding: 25mm 12mm 10mm 12mm; 
            background: white; 
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); 
            box-sizing: border-box; 
          }
          h1 { text-align: center; border-bottom: 3px solid black; padding-bottom: 10px; margin-bottom: 30px; font-size: 24pt; font-weight: 900; }
          table { width: 100%; border-collapse: collapse; font-size: 9.5pt; border: 1.5px solid black; table-layout: fixed; }
          th, td { border: 1px solid black; padding: 8px 4px; text-align: center; word-break: break-all; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .text-left { text-align: left; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button>
        </div>
        <div class="print-page">
          <h1>지정주차 차량 현황</h1>
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">No</th>
                <th style="width: 90px;">날짜</th>
                <th style="width: 50px;">구분</th>
                <th style="width: 130px;">업체</th>
                <th style="width: 70px;">위치</th>
                <th style="width: 100px;">변경전차량</th>
                <th style="width: 100px;">변경후차량</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          <div style="margin-top: 30px; text-align: right; font-weight: bold; font-size: 11pt;">작성일: ${format(new Date(), 'yyyy년 MM월 dd일')}</div>
        </div>
      </body>
      </html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // 페이지네이션 처리
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return items.slice(start, start + ITEMS_PER_PAGE);
  }, [items, currentPage]);

  const visiblePageNumbers = useMemo(() => {
    const halfWindow = 2;
    let startPage = Math.max(1, currentPage - halfWindow);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage === totalPages) startPage = Math.max(1, endPage - 4);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) if (i > 0) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  const thClass = "border border-gray-300 p-2 bg-gray-50 font-bold text-center text-[12px] text-gray-700 h-10 align-middle";
  const tdClass = "border border-gray-300 p-0 h-10 align-middle relative bg-white";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in relative">
      <div className={`p-6 rounded-xl border shadow-sm transition-all duration-300 ${editId ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><div className={`w-2 h-6 rounded-full ${editId ? 'bg-orange-500' : 'bg-blue-600'}`}></div><h3 className="text-lg font-bold text-gray-800">{editId ? '차량 정보 수정' : '신규 차량 등록'}</h3></div>
          {editId && <button onClick={handleCancelEdit} className="flex items-center space-x-1 text-sm text-orange-600 hover:text-orange-800 font-bold bg-white px-3 py-1 rounded-full border border-orange-200 shadow-sm"><RotateCcw size={14} /><span>수정 취소</span></button>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
          <div><label className="block text-xs font-bold text-gray-500 mb-1">날짜</label><input type="date" value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black h-[38px]" /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">구분</label><select value={newItem.type || '변경'} onChange={e => setNewItem({...newItem, type: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black h-[38px]"><option value="변경">변경</option><option value="추가">추가</option></select></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">업체</label><input type="text" value={newItem.company} onChange={e => setNewItem({...newItem, company: e.target.value})} placeholder="업체명" className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black h-[38px]" /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">위치 *</label><input type="text" value={newItem.location} onChange={e => setNewItem({...newItem, location: e.target.value})} placeholder="예: B2-1" className="w-full border border-blue-300 rounded px-2 py-2 text-sm bg-white text-black h-[38px] font-bold" /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">변경전차량번호</label><input type="text" value={newItem.prevPlate || ''} onChange={e => setNewItem({...newItem, prevPlate: e.target.value})} placeholder="변경 시 입력" className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black h-[38px]" /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">변경후차량번호 *</label><input type="text" value={newItem.plateNum} onChange={e => setNewItem({...newItem, plateNum: e.target.value})} placeholder="현재 차량번호" className="w-full border border-blue-300 rounded px-2 py-2 text-sm bg-white text-black h-[38px] font-bold" /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">비고</label><input type="text" value={newItem.note || ''} onChange={e => setNewItem({...newItem, note: e.target.value})} placeholder="비고" className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black h-[38px]" /></div>
          <button onClick={handleRegister} disabled={loading} className={`flex items-center justify-center space-x-2 text-white px-4 py-2 rounded-lg shadow-sm text-sm font-bold h-[38px] transition-colors ${editId ? 'bg-orange-50 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} disabled:bg-gray-400`}>{editId ? <Edit2 size={18} /> : <Plus size={18} />}<span>서버저장</span></button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-gray-800">지정주차 차량 현황</h2>
          <span className="text-sm text-gray-400 font-normal">총 {items.length}대</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={loadData} 
            disabled={loading}
            className="flex items-center px-4 py-2 bg-white text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 font-bold shadow-sm transition-all text-sm active:scale-95"
          >
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 font-bold shadow-md text-sm">
            <Printer size={18} className="mr-2" />
            미리보기
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead>
              <tr>
                <th className={`${thClass} w-10`}>No</th>
                <th className={`${thClass} w-28`}>날짜</th>
                <th className={`${thClass} w-16`}>구분</th>
                <th className={`${thClass} w-40`}>업체</th>
                <th className={`${thClass} w-20`}>위치</th>
                <th className={`${thClass} w-36`}>변경전차량번호</th>
                <th className={`${thClass} w-36`}>변경후차량번호</th>
                <th className={`${thClass} w-48`}>비고</th>
                <th className={`${thClass} w-24 print:hidden`}>관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {paginatedItems.length === 0 ? (<tr><td colSpan={9} className="text-center py-10 text-gray-400 italic">등록된 차량이 없습니다.</td></tr>) : (
                 paginatedItems.map((item, index) => (
                   <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors divide-x divide-gray-100 ${String(editId) === String(item.id) ? 'bg-orange-50' : ''}`}>
                     <td className={`${tdClass} text-center text-gray-400 font-mono text-xs`}>{items.length - ((currentPage - 1) * ITEMS_PER_PAGE + index)}</td>
                     <td className={tdClass}><div className="flex items-center justify-center w-full h-full text-xs text-gray-700">{item.date || '-'}</div></td>
                     <td className={tdClass}><div className="flex items-center justify-center w-full h-full"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.type === '추가' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{item.type || '-'}</span></div></td>
                     <td className={tdClass}><div className="flex items-center justify-center w-full h-full font-bold text-gray-800 text-sm px-2 text-center">{item.company}</div></td>
                     <td className={tdClass}><div className="flex items-center justify-center w-full h-full font-bold text-gray-700 text-sm">{item.location}</div></td>
                     <td className={tdClass}><div className="flex items-center justify-center w-full h-full text-gray-500 text-sm">{item.prevPlate || '-'}</div></td>
                     <td className={tdClass}><div className="flex items-center justify-center w-full h-full font-bold text-blue-600 text-sm">{item.plateNum}</div></td>
                     <td className={tdClass}><div className="flex items-center justify-start w-full h-full text-gray-600 text-xs px-3 truncate max-w-[12rem]">{item.note || '-'}</div></td>
                     <td className={`${tdClass} text-center print:hidden`}>
                       <div className="flex items-center justify-center space-x-1">
                          <button onClick={() => handleLoadToForm(item)} className="text-blue-500 hover:text-blue-700 p-1.5 rounded hover:bg-blue-50" title="수정"><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50" title="삭제"><Trash2 size={16} /></button>
                       </div>
                     </td>
                   </tr>)))}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 UI */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-all active:scale-90"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-1.5 px-4">
              {visiblePageNumbers.map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-9 h-9 rounded-xl font-black text-xs transition-all ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 scale-110'
                      : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200 hover:border-blue-200 hover:text-blue-200'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-all active:scale-90"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
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

export default ParkingStatusList;