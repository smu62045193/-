
import React, { useState, useEffect, useMemo } from 'react';
import { Contractor } from '../types';
import { fetchContractors, saveContractors, deleteContractor, generateUUID } from '../services/dataService';
import { Save, Plus, Trash2, Search, Briefcase, Printer, Edit2, RotateCcw, RefreshCw, AlertTriangle, X, Cloud, CheckCircle, UserPlus, ChevronLeft, ChevronRight, LayoutList, Star, Lock } from 'lucide-react';
import { format } from 'date-fns';

interface ContractorManagerProps {
  isPopupMode?: boolean;
}

const ITEMS_PER_PAGE = 10;

const TABS = [
  { id: 'status', label: '협력업체현황' },
];

const TYPE_ORDER: Record<string, number> = {
  '전기': 1,
  '기계': 2,
  '소방': 3,
  '승강기': 4,
  '주차': 5,
  'CCTV': 6,
  '기타': 7
};

const CATEGORIES = ['전기', '기계', '소방', '승강기', '주차', 'CCTV', '영선', '기타'];

const ContractorManager: React.FC<ContractorManagerProps> = ({ isPopupMode = false }) => {
  const [activeTab, setActiveTab] = useState('status');
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const initialNewItem: Contractor = {
    id: '',
    name: '',
    type: '전기',
    contactPerson: '',
    phoneMain: '',
    phoneMobile: '',
    fax: '',
    note: '',
    isImportant: false
  };

  const [newItem, setNewItem] = useState<Contractor>(initialNewItem);

  useEffect(() => {
    loadData();

    if (isPopupMode) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id && id !== 'new') setEditId(id);
    }

    // 팝업 창으로부터 저장 완료 메시지를 받았을 때 데이터 새로고침
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'CONTRACTOR_SAVED') {
        loadData();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPopupMode]);

  useEffect(() => {
    if (isPopupMode && editId && contractors.length > 0) {
      const item = contractors.find(c => String(c.id) === String(editId));
      if (item) setNewItem({ ...item });
    }
  }, [editId, contractors, isPopupMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, contractors.length]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchContractors();
      setContractors(data || []);
    } catch (e) {
      console.error("Failed to load contractors", e);
    } finally {
      setLoading(false);
    }
  };

  const openIndependentWindow = (id: string = 'new') => {
    const width = 750;
    const height = 700;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'contractor');
    url.searchParams.set('id', id);

    window.open(
      url.toString(),
      `ContractorWin_${id}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,location=no`
    );
  };

  const handleRegister = async () => {
    if (!newItem.name) {
      alert('업체명은 필수입니다.');
      return;
    }

    setLoading(true);
    try {
      const latestData = await fetchContractors();
      let newList = [...(latestData || [])];
      
      const itemToSave = { 
        ...newItem, 
        id: editId || generateUUID() 
      };

      if (editId) {
        const index = newList.findIndex(i => String(i.id) === String(editId));
        if (index >= 0) newList[index] = itemToSave;
      } else {
        newList = [itemToSave, ...newList];
      }
      
      const success = await saveContractors(newList);
      if (success) {
        if (window.opener) {
          window.opener.postMessage({ type: 'CONTRACTOR_SAVED' }, '*');
        }
        alert('성공적으로 저장되었습니다.');
        if (isPopupMode) {
          window.close();
        } else {
          setEditId(null);
          setNewItem(initialNewItem);
          loadData();
        }
      } else {
        alert('저장 실패');
      }
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDirect = async (id: string) => {
    if (!confirm('해당 업체를 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      const success = await deleteContractor(id);
      if (success) {
        setContractors(prev => prev.filter(c => String(c.id) !== String(id)));
        alert('삭제가 완료되었습니다.');
      } else {
        alert('삭제 실패');
      }
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const filteredList = useMemo(() => {
    return contractors
      .filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.type.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        const orderA = TYPE_ORDER[a.type] || 99;
        const orderB = TYPE_ORDER[b.type] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
  }, [contractors, searchTerm]);

  const totalPages = Math.ceil(filteredList.length / ITEMS_PER_PAGE);
  const paginatedList = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredList, currentPage]);

  const visiblePageNumbers = useMemo(() => {
    const halfWindow = 2;
    let startPage = Math.max(1, currentPage - halfWindow);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage === totalPages) startPage = Math.max(1, endPage - 4);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  const handlePrint = () => {
    const importantContractors = filteredList.filter(c => c.isImportant);
    if (importantContractors.length === 0) {
      alert('인쇄할 중요업체가 없습니다. 먼저 업체를 중요업체로 등록해주세요.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    const tableRows = importantContractors.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.type}</td>
        <td>${item.name}</td>
        <td>${item.contactPerson}</td>
        <td>${item.phoneMain || ''}</td>
        <td>${item.phoneMobile || ''}</td>
        <td>${item.fax || ''}</td>
        <td>${item.note || ''}</td>
      </tr>`).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>중요 협력업체 현황 미리보기</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
          @page { size: A4 portrait; margin: 0; }
          body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; background: black !important; -webkit-print-color-adjust: exact; }
          .no-print { display: flex; justify-content: center; padding: 20px; }
          @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; } }
          .print-page { width: 210mm; min-height: 297mm; margin: 20px auto; padding: 15mm 12mm 15mm 12mm; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
          h1 { text-align: center; border-bottom: 2.5px solid black; padding-bottom: 10px; margin-bottom: 30px; font-size: 24pt; font-weight: 900; }
          table { width: 100%; border-collapse: collapse; font-size: 8.5pt; border: 1.5px solid black; table-layout: fixed; }
          th, td { border: 1px solid black; padding: 0; text-align: center; word-break: break-all; font-weight: normal; height: 28px; line-height: 28px; }
          th { background-color: #f3f4f6; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
        <div class="print-page"><h1>중요 협력업체 현황</h1><table><thead><tr><th style="width: 30px;">No</th><th style="width: 40px;">업종</th><th style="width: 100px;">업체명</th><th style="width: 50px;">담당자</th><th style="width: 95px;">대표번호</th><th style="width: 95px;">핸드폰</th><th style="width: 95px;">팩스</th><th>비고</th></tr></thead><tbody>${tableRows}</tbody></table></div>
      </body>
      </html>`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const thClass = "border border-gray-300 p-2 bg-gray-50 font-bold text-center align-middle text-sm text-gray-700 h-10 whitespace-nowrap";
  const tdClass = "border border-gray-300 px-3 py-2 text-sm text-gray-700 h-10 align-middle bg-white text-center";

  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col animate-fade-in">
          <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${editId ? 'bg-orange-600' : 'bg-blue-600'}`}>
                {editId ? <Edit2 size={20} className="text-white" /> : <UserPlus size={20} className="text-white" />}
              </div>
              <span className="font-black text-lg">{editId ? '협력업체 정보 수정' : '신규 협력업체 등록'}</span>
            </div>
            <button onClick={() => window.close()} className="p-1 hover:bg-white/20 rounded-full transition-colors text-white">
              <X size={24} />
            </button>
          </div>

          <div className="p-8 space-y-6 flex-1 overflow-y-auto scrollbar-hide">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">업종</label>
                <select value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">업체명 *</label>
                <input type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500" placeholder="업체명 입력" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">담당자</label>
                <input type="text" value={newItem.contactPerson} onChange={e => setNewItem({...newItem, contactPerson: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="성명" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">중요도 설정</label>
                <button 
                  onClick={() => setNewItem({...newItem, isImportant: !newItem.isImportant})}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border font-black text-sm transition-all ${newItem.isImportant ? 'bg-amber-100 text-amber-600 border-amber-300 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                >
                  <Star size={18} fill={newItem.isImportant ? 'currentColor' : 'none'} />
                  {newItem.isImportant ? '중요 협력업체' : '일반 협력업체'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">대표번호</label>
                <input type="text" value={newItem.phoneMain} onChange={e => setNewItem({...newItem, phoneMain: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="02-..." />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">휴대폰</label>
                <input type="text" value={newItem.phoneMobile} onChange={e => setNewItem({...newItem, phoneMobile: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="010-..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">팩스</label>
                <input type="text" value={newItem.fax} onChange={e => setNewItem({...newItem, fax: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="02-..." />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">비고</label>
                <input type="text" value={newItem.note} onChange={e => setNewItem({...newItem, note: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="특이사항" />
              </div>
            </div>
          </div>

          <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-4">
            <button onClick={() => window.close()} className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all hover:bg-slate-100 active:scale-95">닫기</button>
            <button onClick={handleRegister} disabled={loading} className={`flex-[2] py-3.5 ${editId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-2xl font-black text-base shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2`}>
              {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              서버에 데이터 저장
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in print:p-0">
      <div className="mb-2 print:hidden">
        <h2 className="text-3xl font-black text-slate-800 flex items-center tracking-tight">
          <Briefcase className="mr-2 text-blue-600" size={32} />
          협력업체 관리
        </h2>
        <p className="text-slate-500 mt-2 text-base font-medium">협력업체 정보 및 연락처를 통합 관리합니다.</p>
      </div>

      <div className="flex overflow-x-auto whitespace-nowrap gap-2 pb-4 mb-4 scrollbar-hide border-b border-slate-200 items-center print:hidden">
        <div className="mr-3 text-slate-400 p-2 bg-white rounded-xl shadow-sm border border-slate-100">
           <LayoutList size={22} />
        </div>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 rounded-2xl text-sm font-black transition-all duration-300 border ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100 scale-105' 
                : 'bg-white text-slate-50 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
        <div className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-200 print:hidden">
            <div className="relative w-[320px]">
              <input 
                type="text" 
                placeholder="업체명, 업종, 담당자 검색" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm bg-white text-black shadow-sm outline-none font-bold" 
              />
              <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button 
                onClick={loadData} 
                disabled={loading}
                className="flex items-center justify-center px-4 py-2.5 bg-white text-emerald-600 border border-emerald-200 rounded-xl font-bold shadow-sm hover:bg-emerald-50 transition-all active:scale-95 text-sm"
              >
                <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                새로고침
              </button>
              <button 
                onClick={() => openIndependentWindow()} 
                className="flex-1 md:flex-none flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-md text-sm transition-all active:scale-95"
              >
                <UserPlus size={18} className="mr-2" />
                신규 협력 등록
              </button>
              <button 
                onClick={handlePrint} 
                className="flex-1 md:flex-none flex items-center justify-center px-6 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-bold shadow-md text-sm transition-all active:scale-95"
              >
                <Printer size={18} className="mr-2" />
                미리보기
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-300 overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse">
              <thead>
                <tr>
                  <th className={thClass} style={{ width: '50px' }}>No</th>
                  <th className={thClass} style={{ width: '70px' }}>업종</th>
                  <th className={thClass} style={{ width: '150px' }}>업체명</th>
                  <th className={thClass} style={{ width: '80px' }}>담당자</th>
                  <th className={thClass} style={{ width: '120px' }}>대표번호</th>
                  <th className={thClass} style={{ width: '120px' }}>휴대폰</th>
                  <th className={thClass} style={{ width: '120px' }}>팩스</th>
                  <th className={thClass}>비고</th>
                  <th className={`${thClass} w-24 print:hidden`}>관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedList.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-20 text-gray-400 italic">등록된 협력업체가 없습니다.</td></tr>
                ) : (
                  paginatedList.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className={`${tdClass} text-center text-gray-400 font-mono text-xs`}>
                        {filteredList.length - ((currentPage - 1) * ITEMS_PER_PAGE + index)}
                      </td>
                      <td className={`${tdClass} font-bold text-blue-600`}>{item.type}</td>
                      <td className={`${tdClass} font-bold text-gray-800`}>
                        <div className="flex items-center justify-center gap-1">
                          {item.isImportant && <Star size={14} className="text-amber-500" fill="currentColor" />}
                          {item.name}
                        </div>
                      </td>
                      <td className={tdClass}>{item.contactPerson}</td>
                      <td className={tdClass}>{item.phoneMain}</td>
                      <td className={tdClass}>{item.phoneMobile}</td>
                      <td className={tdClass}>{item.fax}</td>
                      <td className={`${tdClass} text-left pl-4 text-gray-500`}>{item.note}</td>
                      <td className={`${tdClass} text-center print:hidden`}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openIndependentWindow(item.id)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all" title="수정"><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteDirect(item.id)} className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all" title="삭제"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 UI */}
          {totalPages > 1 && (
            <div className="py-4 flex items-center justify-center gap-2 print:hidden">
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
                    className={`w-9 h-9 rounded-xl font-black text-xs transition-all ${currentPage === pageNum ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 scale-110' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'}`}
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
      </div>
    </div>
  );
};

export default ContractorManager;
