
import React, { useState, useEffect, useMemo } from 'react';
import { Contractor } from '../types';
import { fetchConstructionContractors, saveConstructionContractors, deleteConstructionContractor, generateUUID } from '../services/dataService';
import { Save, Search, Printer, Edit2, RotateCcw, RefreshCw, X, Cloud, CheckCircle, UserPlus, Plus, ChevronLeft, ChevronRight, LayoutList, Star, Trash2, Briefcase, Calendar } from 'lucide-react';
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
    const endPage = Math.min(totalPages, startPage + 4);
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
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">업체명 *</label>
                <input type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500" placeholder="업체명" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">시작일 *</label>
                <input 
                  type="date" 
                  value={newItem.type.includes(' ~ ') ? newItem.type.split(' ~ ')[0] : newItem.type} 
                  onChange={e => {
                    const parts = newItem.type.split(' ~ ');
                    const end = parts[1] || e.target.value;
                    setNewItem({...newItem, type: `${e.target.value} ~ ${end}`});
                  }} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">종료일 *</label>
                <input 
                  type="date" 
                  value={newItem.type.includes(' ~ ') ? newItem.type.split(' ~ ')[1] : newItem.type} 
                  onChange={e => {
                    const parts = newItem.type.split(' ~ ');
                    const start = parts[0] || e.target.value;
                    setNewItem({...newItem, type: `${start} ~ ${e.target.value}`});
                  }} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                />
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
              <textarea value={newItem.note} onChange={e => setNewItem({...newItem, note: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none h-16" placeholder="공사 내역 및 특이사항 입력" />
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
    <div className="space-y-2 animate-fade-in pb-10">
      <div className="w-full max-w-7xl mx-auto bg-white">
        <div className="flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
          <div className="flex items-stretch shrink-0">
            <div className="relative w-full sm:w-[250px] flex items-center bg-white border-none rounded-none">
              <input 
                type="text" 
                placeholder="업체명, 날짜, 담당자 검색" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
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
              onClick={loadData} 
              disabled={loading}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
              title="새로고침"
            >
              <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
            
            <button 
              onClick={() => openIndependentWindow()} 
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
            >
              <Plus size={18} className="mr-1.5" />
              등록
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto bg-white border border-black overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[1000px] border-collapse text-center">
            <thead>
              <tr className="bg-white border-b border-black h-[40px]">
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-[60px] border-r border-black px-2"><div className="flex items-center justify-center h-full">No</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-[120px] border-r border-black px-2"><div className="flex items-center justify-center h-full">날짜</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-[180px] border-r border-black px-2"><div className="flex items-center justify-center h-full">업체명</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-[100px] border-r border-black px-2"><div className="flex items-center justify-center h-full">담당자</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-[130px] border-r border-black px-2"><div className="flex items-center justify-center h-full">대표번호</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-[130px] border-r border-black px-2"><div className="flex items-center justify-center h-full">휴대폰</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider border-r border-black px-2"><div className="flex items-center justify-center h-full">비고</div></th>
                <th className="text-[13px] font-normal text-black uppercase tracking-wider w-[100px] px-2"><div className="flex items-center justify-center h-full">관리</div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {paginatedList.length === 0 ? (
                <tr className="h-[40px]">
                  <td colSpan={8} className="text-center text-gray-400 italic border-b border-black text-[13px] font-normal px-2">
                    <div className="flex items-center justify-center h-full py-24">
                      등록된 업체가 없습니다.
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map((item, index) => {
                  return (
                    <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group border-b border-black last:border-b-0 h-[40px]">
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2"><div className="flex items-center justify-center h-full px-2 font-mono text-xs">{totalItems - ((currentPage-1)*ITEMS_PER_PAGE + index)}</div></td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">{item.type}</div></td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">{item.name}</div></td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">{item.contactPerson}</div></td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">{item.phoneMain}</div></td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">{item.phoneMobile}</div></td>
                      <td className="text-center text-black text-[13px] font-normal border-r border-black px-2"><div className="flex items-center justify-center h-full px-2">{item.note}</div></td>
                      <td className="text-center text-black text-[13px] font-normal px-2">
                        <div className="flex items-center justify-center h-full px-2 gap-1 py-1">
                          <button onClick={() => openIndependentWindow(item.id)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all" title="수정"><Edit2 size={16}/></button>
                          <button onClick={() => handleDelete(item.id)} className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all" title="삭제"><Trash2 size={16}/></button>
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

export default ConstructionContractorManager;
