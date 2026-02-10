
import React, { useState, useEffect, useMemo } from 'react';
import { Contractor } from '../types';
import { fetchConstructionContractors, saveConstructionContractors, deleteConstructionContractor, generateUUID } from '../services/dataService';
import { Save, Search, Printer, Edit2, RotateCcw, RefreshCw, X, Cloud, CheckCircle, UserPlus, ChevronLeft, ChevronRight, LayoutList, Star, Trash2, Briefcase, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface ConstructionContractorManagerProps {
  isPopupMode?: boolean;
}

const ITEMS_PER_PAGE = 10;

const ConstructionContractorManager: React.FC<ConstructionContractorManagerProps> = ({ isPopupMode = false }) => {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // 업종(type) 필드를 날짜 저장용으로 재사용합니다. 팩스(fax)는 사용하지 않으므로 제외합니다.
  const initialNewItem: Contractor = {
    id: '', 
    name: '', 
    type: format(new Date(), 'yyyy-MM-dd'), 
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

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'CONSTRUCTION_CONTRACTOR_SAVED') {
        loadData();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPopupMode]);

  useEffect(() => {
    if (editId && contractors.length > 0) {
      const item = contractors.find(i => String(i.id) === String(editId));
      if (item) setNewItem({ ...item });
    }
  }, [editId, contractors]);

  // 검색 시 페이지 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchConstructionContractors();
      setContractors(data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openIndependentWindow = (id: string = 'new') => {
    const width = 800;
    const height = 750; // 팩스 삭제로 높이 약간 조절
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'construction_contractor');
    url.searchParams.set('id', id);

    window.open(
      url.toString(),
      `ConstContractorWin_${id}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,location=no`
    );
  };

  const handleRegister = async () => {
    if (!newItem.name) { alert('업체명은 필수입니다.'); return; }
    setLoading(true);
    try {
      const latestData = await fetchConstructionContractors();
      let newList = [...(latestData || [])];
      const itemToSave = { ...newItem, id: editId || generateUUID() };
      
      if (editId) {
        const index = newList.findIndex(i => String(i.id) === String(editId));
        if (index >= 0) newList[index] = itemToSave;
      } else {
        newList = [itemToSave, ...newList];
      }

      if (await saveConstructionContractors(newList)) {
        if (window.opener) {
          window.opener.postMessage({ type: 'CONSTRUCTION_CONTRACTOR_SAVED' }, '*');
        }
        alert('저장이 완료되었습니다.');
        if (isPopupMode) {
          window.close();
        } else {
          setEditId(null);
          setNewItem(initialNewItem);
          loadData();
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      const targetId = String(id);
      const success = await deleteConstructionContractor(targetId);
      if (success) {
        setContractors(prev => prev.filter(c => String(c.id) !== targetId));
        alert('삭제가 완료되었습니다.');
      } else {
        alert('삭제에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (e) { 
      console.error(e); 
      alert('오류가 발생했습니다.');
    } finally { setLoading(false); }
  };

  const filteredList = useMemo(() => {
    return contractors
      .filter(c => (c.name+(c.type||'')+(c.contactPerson||'')).toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.type.localeCompare(a.type)); 
  }, [contractors, searchTerm]);

  const totalItems = filteredList.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const paginatedList = useMemo(() => filteredList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [filteredList, currentPage]);

  const visiblePageNumbers = useMemo(() => {
    const halfWindow = 2;
    let startPage = Math.max(1, currentPage - halfWindow);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage === totalPages) startPage = Math.max(1, endPage - 4);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) if (i > 0) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  const thClass = "border border-gray-300 p-2 bg-gray-50 font-bold text-center text-sm text-gray-700 h-10 whitespace-nowrap";
  const tdClass = "border border-gray-300 px-3 py-2 text-sm text-gray-700 h-10 align-middle bg-white text-center";

  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col animate-fade-in">
          <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${editId ? 'bg-orange-50' : 'bg-blue-600'}`}>
                <Briefcase size={20} />
              </div>
              <span className="font-black text-lg">{editId ? '공사업체 정보 수정' : '신규 공사업체 등록'}</span>
            </div>
            <button onClick={() => window.close()} className="p-1 hover:bg-white/20 rounded-full transition-colors text-white">
              <X size={24} />
            </button>
          </div>

          <div className="p-8 space-y-6 flex-1 overflow-y-auto scrollbar-hide">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">업체명 *</label>
                <input type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500" placeholder="업체명" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">날짜</label>
                <input type="date" value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">담당자</label>
                <input type="text" value={newItem.contactPerson} onChange={e => setNewItem({...newItem, contactPerson: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="담당자 성명" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">대표번호</label>
                <input type="text" value={newItem.phoneMain} onChange={e => setNewItem({...newItem, phoneMain: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="02-..." />
              </div>
            </div>

            <div className="grid grid-cols-1">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">휴대폰</label>
                <input type="text" value={newItem.phoneMobile} onChange={e => setNewItem({...newItem, phoneMobile: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="010-..." />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">비고</label>
              <textarea value={newItem.note} onChange={e => setNewItem({...newItem, note: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none h-48" placeholder="공사 내역 및 특이사항 입력" />
            </div>
          </div>

          <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-4">
            <button onClick={() => window.close()} className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all hover:bg-slate-100 active:scale-95">닫기</button>
            <button onClick={handleRegister} disabled={loading} className={`flex-[2] py-3.5 ${editId ? 'bg-orange-50 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-2xl font-black text-base shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2`}>
              {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              서버에 데이터 저장
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-200 print:hidden">
        <div className="relative flex-1 md:w-80 w-full">
          <input 
            type="text" 
            placeholder="업체명, 날짜, 담당자 검색" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
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
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg text-sm font-black active:scale-95"
          >
            <UserPlus size={18} /> 신규 공사업체 등록
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-300 overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead>
              <tr>
                <th className={thClass} style={{ width: '60px' }}>No</th>
                <th className={thClass} style={{ width: '120px' }}>날짜</th>
                <th className={thClass} style={{ width: '180px' }}>업체명</th>
                <th className={thClass} style={{ width: '100px' }}>담당자</th>
                <th className={thClass} style={{ width: '130px' }}>대표번호</th>
                <th className={thClass} style={{ width: '130px' }}>휴대폰</th>
                <th className={thClass}>비고</th>
                <th className={thClass} style={{ width: '100px' }}>관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedList.length === 0 ? (
                <tr><td colSpan={8} className="py-20 text-center text-gray-400 italic">등록된 업체가 없습니다.</td></tr>
              ) : (
                paginatedList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className={tdClass}>{totalItems - ((currentPage-1)*ITEMS_PER_PAGE + index)}</td>
                    <td className={`${tdClass} font-bold text-blue-600`}>{item.type}</td>
                    <td className={`${tdClass} font-bold`}>{item.name}</td>
                    <td className={tdClass}>{item.contactPerson}</td>
                    <td className={tdClass}>{item.phoneMain}</td>
                    <td className={tdClass}>{item.phoneMobile}</td>
                    <td className={`${tdClass} text-left px-4 font-medium text-gray-600`}>{item.note}</td>
                    <td className={tdClass}>
                      <div className="flex justify-center gap-1">
                        <button onClick={() => openIndependentWindow(item.id)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="수정"><Edit2 size={16}/></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="삭제"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 UI - 번호형으로 개선 */}
        {!loading && totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
              {visiblePageNumbers.map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
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
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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

export default ConstructionContractorManager;
