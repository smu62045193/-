
import React, { useState, useEffect, useMemo } from 'react';
import { ParkingStatusItem, ParkingChangeItem } from '../types';
import { fetchParkingStatusList, saveParkingStatusList, deleteParkingStatusItem, generateUUID, fetchParkingChangeList, saveParkingChangeList } from '../services/dataService';
import { Trash2, Printer, Plus, Edit2, RotateCcw, AlertTriangle, X, Cloud, CheckCircle, RefreshCw, ChevronLeft, ChevronRight, Search, Car, Save } from 'lucide-react';
import { format } from 'date-fns';

interface ParkingStatusListProps {
  isPopupMode?: boolean;
}

const ITEMS_PER_PAGE = 10;

const ParkingStatusList: React.FC<ParkingStatusListProps> = ({ isPopupMode = false }) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ParkingStatusItem[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  
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

    if (isPopupMode) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id && id !== 'new') {
        setEditId(id);
      }
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'PARKING_SAVED') {
        loadData();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPopupMode]);

  useEffect(() => {
    if (isPopupMode && editId && items.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode'); // 'edit' 또는 'change'
      const matched = items.find(i => String(i.id) === String(editId));
      
      if (matched) {
        if (mode === 'change') {
          setNewItem({
            ...matched,
            prevPlate: matched.plateNum,
            plateNum: '',
            type: '변경',
            date: format(new Date(), 'yyyy-MM-dd')
          });
        } else {
          setNewItem(matched);
        }
      }
    }
  }, [editId, items, isPopupMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [items.length, searchTerm]);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchParkingStatusList();
    setItems(data || []);
    setLoading(false);
  };

  const openIndependentWindow = (id: string = 'new', mode: 'edit' | 'change' = 'edit') => {
    const width = 600;
    const height = 900; // 요청에 따라 900px로 설정
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'parking_status');
    url.searchParams.set('id', id);
    url.searchParams.set('mode', mode);

    window.open(
      url.toString(),
      `ParkingWin_${id}_${mode}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,location=no`
    );
  };

  const handleRegister = async () => {
    if (!newItem.location?.trim()) {
      window.alert('주차 위치(예: B2-1)를 입력해주세요.');
      return;
    }
    if (!newItem.plateNum?.trim()) {
      window.alert('현재 차량번호(변경후)는 필수입니다.');
      return;
    }

    setLoading(true);
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const mode = searchParams.get('mode');

      const currentList = await fetchParkingStatusList();
      let updatedList = [...(currentList || [])];
      
      const targetId = editId || generateUUID();
      const itemToSave = { ...newItem, id: targetId };

      const normalize = (val: string) => (val || '').toString().replace(/\s+/g, '').toUpperCase();

      if (editId) {
        // [수정 모드] 현황 정보 업데이트
        const index = updatedList.findIndex(s => String(s.id) === String(editId));
        if (index >= 0) updatedList[index] = itemToSave;

        // [이력 연동] 단순 수정일 경우, 이력 중 가장 최근의 동일 위치 항목만 업데이트
        if (mode === 'edit') {
          const currentHistory = await fetchParkingChangeList();
          const targetLoc = normalize(newItem.location);
          
          // 해당 위치의 가장 최근 이력 1건만 찾음 (과거 내역 보존을 위해)
          const latestHistoryIdx = currentHistory.findIndex(h => normalize(h.location) === targetLoc);
          
          if (latestHistoryIdx !== -1) {
            const updatedHistory = [...currentHistory];
            updatedHistory[latestHistoryIdx] = {
              ...updatedHistory[latestHistoryIdx],
              company: newItem.company,
              newPlate: newItem.plateNum,
              note: newItem.note || updatedHistory[latestHistoryIdx].note
            };
            await saveParkingChangeList(updatedHistory);
          }
        }
      } else {
        // [신규 등록]
        const targetLocation = normalize(newItem.location);
        const existingIndex = updatedList.findIndex(s => normalize(s.location) === targetLocation);

        if (existingIndex >= 0) {
          if (window.confirm(`해당 위치(${newItem.location})에 이미 차량이 등록되어 있습니다. 정보를 덮어쓰시겠습니까?`)) {
            updatedList[existingIndex] = { ...itemToSave, id: updatedList[existingIndex].id };
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

      const successStatus = await saveParkingStatusList(updatedList);

      // [이력 추가] '변경' 모드이거나 아예 '신규' 등록일 때만 새로운 이력 행 생성
      if (successStatus && (mode === 'change' || !editId)) {
        const currentHistory = await fetchParkingChangeList();
        const newHistoryItem: ParkingChangeItem = {
          id: generateUUID(),
          date: newItem.date,
          type: !editId ? '추가' : '변경',
          company: newItem.company,
          location: newItem.location,
          prevPlate: newItem.prevPlate || '',
          newPlate: newItem.plateNum,
          note: newItem.note || ''
        };
        // 최신이 위로 오도록 추가
        await saveParkingChangeList([newHistoryItem, ...(currentHistory || [])]);
      }

      if (successStatus) {
        if (window.opener) {
          window.opener.postMessage({ type: 'PARKING_SAVED' }, '*');
        }
        window.alert('저장이 완료되었습니다.');
        if (isPopupMode) {
          window.close();
        } else {
          loadData();
        }
      } else {
        window.alert('저장 실패');
      }
    } catch (e) {
      console.error(e);
      window.alert('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const idStr = String(id);
    const itemToDelete = items.find(i => String(i.id) === idStr);
    if (!itemToDelete) return;

    if (!window.confirm(`정말 삭제하시겠습니까?\n'${itemToDelete.location}' 위치의 모든 변경 이력도 함께 삭제됩니다.`)) return;
    
    setLoading(true);
    try {
      // 1. 현황 데이터 삭제
      const success = await deleteParkingStatusItem(idStr);
      if (success) {
        // 2. [삭제 연동 로직] 변경 이력에서도 해당 위치(location)와 관련된 모든 기록을 삭제 (추가/변경 기록 전체)
        const currentHistory = await fetchParkingChangeList();
        if (currentHistory && currentHistory.length > 0) {
          const normalize = (val: string) => (val || '').toString().replace(/\s+/g, '').toUpperCase();
          const targetLoc = normalize(itemToDelete.location);
          
          // 해당 위치(예: B2-1)인 모든 이력 항목 제거
          const filteredHistory = currentHistory.filter(h => normalize(h.location) !== targetLoc);
          
          // 필터링된 리스트를 서버에 덮어씌움으로써 관련 이력 완전 삭제
          await saveParkingChangeList(filteredHistory);
        }

        setItems(prev => prev.filter(i => String(i.id) !== idStr));
        window.alert('삭제가 완료되었습니다.');
      } else {
        window.alert('삭제 실패');
      }
    } catch (e) {
      console.error(e);
      window.alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    const tableRows = filteredItems.map((item, index) => `
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
          body { font-family: 'Noto Sans KR', sans-serif; background: black !important; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .no-print { display: flex; justify-content: center; padding: 20px; }
          @media print { .no-print { display: none !important; } .print-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; } }
          .print-page { width: 210mm; min-height: 297mm; padding: 25mm 12mm 10mm 12mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
          h1 { text-align: center; border-bottom: 3px solid black; padding-bottom: 10px; margin-bottom: 30px; font-size: 24pt; font-weight: 900; }
          table { width: 100%; border-collapse: collapse; font-size: 9.5pt; border: 1.5px solid black; table-layout: fixed; }
          th, td { border: 1px solid black; padding: 8px 4px; text-align: center; word-break: break-all; }
          th { background-color: #f3f4f6; font-weight: bold; }
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

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      (item.company || '').includes(searchTerm) || 
      (item.location || '').includes(searchTerm) || 
      (item.plateNum || '').includes(searchTerm)
    );
  }, [items, searchTerm]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const visiblePageNumbers = useMemo(() => {
    const halfWindow = 2;
    let startPage = Math.max(1, currentPage - halfWindow);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage === totalPages) startPage = Math.max(1, endPage - 4);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) if (i > 0) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const inputs = document.querySelectorAll('.form-input');
      const index = Array.from(inputs).indexOf(e.target as any);
      if (index > -1 && index < inputs.length - 1) (inputs[index + 1] as HTMLElement).focus();
      else if (index === inputs.length - 1) handleRegister();
    }
  };

  const formInputClass = "w-full border border-gray-300 rounded-xl px-4 py-2.5 !text-[14px] bg-white text-black focus:ring-2 focus:ring-blue-500 outline-none h-[45px] font-bold shadow-inner";

  if (isPopupMode) {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 animate-fade-in">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${mode === 'change' ? 'bg-emerald-600' : editId ? 'bg-orange-600' : 'bg-blue-600'}`}>
                {mode === 'change' ? <RotateCcw size={24} /> : editId ? <Edit2 size={24} /> : <Plus size={24} />}
              </div>
              <span className="font-black text-xl tracking-tight">
                {mode === 'change' ? '차량 정보 변경' : editId ? '차량 정보 수정' : '신규 차량 등록'}
              </span>
            </div>
            <button onClick={() => window.close()} className="p-1 hover:bg-white/20 rounded-full transition-colors text-white">
              <X size={28} />
            </button>
          </div>

          <div className="p-8 space-y-6 flex-1 overflow-visible">
            {/* 신규 등록 또는 차량 변경 모드일 때 안내 박스 표시 */}
            {(mode === 'change' || !editId) && (
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm text-emerald-600">
                  {mode === 'change' ? <RotateCcw size={20} /> : <Plus size={20} />}
                </div>
                <div>
                  <p className="text-xs font-black text-emerald-800">
                    {mode === 'change' ? '차량 변경 모드' : '신규 차량 등록 모드'}
                  </p>
                  <p className="text-[11px] text-emerald-600 font-medium">저장 시 변경 이력이 자동으로 기록됩니다.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">날짜</label>
                <input type="date" className={`${formInputClass} form-input`} value={newItem.date} onChange={(e) => setNewItem({...newItem, date: e.target.value})} onKeyDown={handleKeyDown} />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">구분</label>
                <select className={`${formInputClass} form-input`} value={newItem.type || '변경'} onChange={(e) => setNewItem({...newItem, type: e.target.value})}>
                  <option value="변경">변경</option>
                  <option value="추가">추가</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">주차 위치 *</label>
                <input type="text" className={`${formInputClass} form-input text-blue-700`} value={newItem.location} onChange={(e) => setNewItem({...newItem, location: e.target.value})} onKeyDown={handleKeyDown} placeholder="예: B2-1" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">업체명</label>
                <input type="text" className={`${formInputClass} form-input`} value={newItem.company} onChange={(e) => setNewItem({...newItem, company: e.target.value})} onKeyDown={handleKeyDown} placeholder="업체명 입력" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">변경전 차량번호</label>
                <input type="text" className={`${formInputClass} form-input bg-slate-50 text-slate-500`} value={newItem.prevPlate || ''} onChange={(e) => setNewItem({...newItem, prevPlate: e.target.value})} onKeyDown={handleKeyDown} placeholder="이전 차량 정보" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">현재 차량번호 *</label>
                <input type="text" className={`${formInputClass} form-input text-blue-700 ring-2 ring-blue-100`} value={newItem.plateNum} onChange={(e) => setNewItem({...newItem, plateNum: e.target.value})} onKeyDown={handleKeyDown} placeholder="변경후 차량번호 입력" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">비고</label>
              <textarea className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-32 font-medium shadow-inner" value={newItem.note || ''} onChange={(e) => setNewItem({...newItem, note: e.target.value})} placeholder="특이사항 입력" />
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
            <button onClick={() => window.close()} className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all hover:bg-slate-100 active:scale-95">닫기</button>
            <button 
              onClick={handleRegister} 
              disabled={loading}
              className={`flex-[2] py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 ${
                loading ? 'bg-slate-400 cursor-wait' : mode === 'change' ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100' : editId ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? <RefreshCw size={24} className="animate-spin" /> : <Save size={24} />}
              서버에 데이터 저장
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-200 print:hidden">
        <div className="relative w-full md:w-[320px]">
          <input 
            type="text" 
            placeholder="업체명, 위치, 차량번호 검색" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm font-bold" 
          />
          <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button 
            onClick={loadData} 
            disabled={loading}
            className="flex items-center justify-center px-4 py-2 bg-white text-emerald-600 border border-emerald-200 rounded-xl font-bold shadow-sm hover:bg-emerald-50 transition-all active:scale-95 text-sm"
          >
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <button 
            onClick={() => openIndependentWindow()}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg text-sm font-black active:scale-95"
          >
            <Plus size={18} /> 신규 차량 등록
          </button>
          <button 
            onClick={handlePrint} 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-amber-600 text-white px-5 py-2.5 rounded-xl hover:bg-amber-700 font-bold shadow-md text-sm transition-all active:scale-95"
          >
            <Printer size={18} /> 미리보기
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[1000px] border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-50 divide-x divide-gray-300">
                <th className="border border-gray-300 p-3 font-bold text-center text-[12px] text-gray-700 w-12">No</th>
                <th className="border border-gray-300 p-3 font-bold text-center text-[12px] text-gray-700 w-32">등록일자</th>
                <th className="border border-gray-300 p-3 font-bold text-center text-[12px] text-gray-700 w-16">구분</th>
                <th className="border border-gray-300 p-3 font-bold text-center text-[12px] text-gray-700 w-44">업체명</th>
                <th className="border border-gray-300 p-3 font-bold text-center text-[12px] text-gray-700 w-24">주차위치</th>
                <th className="border border-gray-300 p-3 font-bold text-center text-[12px] text-gray-700 w-36">이전차량번호</th>
                <th className="border border-gray-300 p-3 font-bold text-center text-[12px] text-gray-700 w-36">현재차량번호</th>
                <th className="border border-gray-300 p-3 font-bold text-center text-[12px] text-gray-700">비고</th>
                <th className="border border-gray-300 p-3 font-bold text-center text-[12px] text-gray-700 w-28 print:hidden">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {paginatedItems.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-20 text-gray-400 italic">검색 결과가 없습니다.</td></tr>
              ) : (
                paginatedItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors divide-x divide-gray-300 text-center">
                    <td className="p-3 text-gray-400 font-mono text-xs">{filteredItems.length - ((currentPage - 1) * ITEMS_PER_PAGE + index)}</td>
                    <td className="p-3 text-xs text-gray-700">{item.date || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.type === '추가' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {item.type || '-'}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-gray-900 text-sm">{item.company}</td>
                    <td className="p-3 font-black text-gray-700 text-sm">{item.location}</td>
                    <td className="p-3 text-gray-500 text-sm">{item.prevPlate || '-'}</td>
                    <td className="p-3 font-black text-blue-600 text-sm">{item.plateNum}</td>
                    <td className="p-3 text-left pl-4 text-gray-600 text-xs truncate max-w-[200px]">{item.note || '-'}</td>
                    <td className="p-3 print:hidden">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => openIndependentWindow(item.id, 'edit')} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all" title="수정"><Edit2 size={16} /></button>
                        <button onClick={() => openIndependentWindow(item.id, 'change')} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-all" title="변경"><RotateCcw size={16} /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all" title="삭제"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="px-6 py-4 flex items-center justify-center gap-2">
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
                    : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
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

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-up { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .animate-scale-up { animation: scale-up 0.2s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default ParkingStatusList;
