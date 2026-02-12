
import React, { useState, useEffect, useMemo } from 'react';
import { ElevatorInspectionItem, DailyData, LogCategory } from '../types';
import { fetchElevatorInspectionList, saveElevatorInspectionList, apiFetchRange, fetchLinkedKeywords, saveLinkedKeywords } from '../services/dataService';
import { RefreshCw, Search, Link, Plus, Trash2, X, Save, AlertCircle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface ElevatorInspectionListProps {
  isKeywordPopupMode?: boolean;
}

const ITEMS_PER_PAGE = 15;

const ElevatorInspectionList: React.FC<ElevatorInspectionListProps> = ({ isKeywordPopupMode = false }) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ElevatorInspectionItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!isKeywordPopupMode) {
      loadData();
    }
    loadKeywords();

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'ELEVATOR_KEYWORDS_SAVED') {
        loadKeywords();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isKeywordPopupMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, items.length]);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchElevatorInspectionList();
    setItems(data || []);
    setLoading(false);
  };

  const loadKeywords = async () => {
    const data = await fetchLinkedKeywords('elevator');
    setKeywords(data || []);
  };

  const normalize = (text: string) => (text || '').replace(/[\s()\-]/g, '').toUpperCase();

  const openIndependentWindow = () => {
    const width = 500;
    const height = 770; // 요청에 따라 770px로 설정
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'elevator_contractor');

    window.open(
      url.toString(),
      `ElevatorKeywordWin`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,location=no`
    );
  };

  const handleRefresh = async () => {
    if (keywords.length === 0) {
      alert('먼저 [자동연동업체등록]에서 연동할 업체를 등록해주세요.');
      return;
    }

    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const logs = await apiFetchRange("DAILY_", `${year}-01-01`, `${year}-12-31`);
      const normalizedKeywords = keywords.map(normalize);
      
      let newEntries: ElevatorInspectionItem[] = [];
      logs.forEach((entry: any) => {
        const dateKey = entry.key.replace("DAILY_", "");
        const elevatorLog = entry.data?.workLog?.elevator as LogCategory;
        if (!elevatorLog || !elevatorLog.today) return;

        elevatorLog.today.forEach(task => {
          if (!task.content) return;
          const normalizedContent = normalize(task.content);
          
          const keywordIdx = normalizedKeywords.findIndex(nk => nk !== '' && normalizedContent.includes(nk));
          
          if (keywordIdx !== -1) {
            const matchedKeyword = keywords[keywordIdx];
            let cleanContent = task.content;
            const escapedK = matchedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const cleaningPatterns = [
              new RegExp(`\\s?\\(${escapedK}\\)`, 'gi'),
              new RegExp(`\\(${escapedK}\\)`, 'gi'),
              new RegExp(`\\s?${escapedK}`, 'gi')
            ];
            cleaningPatterns.forEach(pattern => {
              cleanContent = cleanContent.replace(pattern, '');
            });
            cleanContent = cleanContent.trim();

            const exists = items.some(item => item.date === dateKey && normalize(item.content) === normalize(cleanContent));
            
            if (!exists) {
              newEntries.push({
                id: `auto_${dateKey}_${Math.random().toString(36).substr(2, 5)}`,
                date: dateKey,
                company: matchedKeyword,
                content: cleanContent,
                note: ''
              });
            }
          }
        });
      });

      if (newEntries.length > 0) {
        const updatedList = [...newEntries, ...items].sort((a, b) => b.date.localeCompare(a.date));
        const success = await saveElevatorInspectionList(updatedList);
        if (success) {
          setItems(updatedList);
          alert(`${newEntries.length}건의 새로운 데이터가 연동되어 서버에 저장되었습니다.`);
        } else {
          alert('연동 데이터 저장 중 오류가 발생했습니다.');
        }
      } else {
        alert('연동할 새로운 데이터가 없습니다.');
      }
    } catch (e) {
      console.error(e);
      alert('연동 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKeywords = async () => {
    setSaveStatus('saving');
    const success = await saveLinkedKeywords('elevator', keywords);
    if (success) {
      setSaveStatus('saved');
      if (window.opener) {
        window.opener.postMessage({ type: 'ELEVATOR_KEYWORDS_SAVED' }, '*');
      }
      alert('업체 목록이 저장되었습니다.');
      if (isKeywordPopupMode) {
        window.close();
      }
    } else {
      setSaveStatus('idle');
      alert('업체 목록 저장에 실패했습니다.');
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (k: string) => {
    setKeywords(keywords.filter(item => item !== k));
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      (item.company || '').includes(searchTerm) || 
      (item.content || '').includes(searchTerm) ||
      (item.date || '').includes(searchTerm)
    );
  }, [items, searchTerm]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
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

  const thClass = "border border-gray-300 p-2 bg-gray-50 font-bold text-center align-middle text-sm text-gray-700 h-11 whitespace-nowrap uppercase tracking-wider";
  const tdClass = "border border-gray-300 px-3 py-4 text-sm text-gray-700 h-10 align-middle bg-white text-center";

  if (isKeywordPopupMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-fade-in flex flex-col h-[770px]">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Link size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">자동 연동 업체 관리</h3>
                <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest">Elevator Contractor Setup</p>
              </div>
            </div>
            <button onClick={() => window.close()} className="p-1 hover:bg-white/20 rounded-full transition-colors text-white">
              <X size={24} />
            </button>
          </div>
          
          <div className="p-6 space-y-6 flex-1 overflow-y-auto scrollbar-hide">
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <p className="text-xs text-blue-800 leading-relaxed font-bold">
                업무일지에 입력되는 업체명을 등록하세요.<br/>
                <span className="text-blue-600 underline">공백, 괄호 등은 자동으로 무시하고 연동됩니다.</span>
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">New Contractor Name</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                  placeholder="예: 현대엘리베이터, 오티스"
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold shadow-inner"
                />
                <button 
                  onClick={addKeyword}
                  className="px-6 py-3 bg-slate-800 text-white rounded-xl font-black hover:bg-black transition-all active:scale-95 shadow-md"
                >
                  추가
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Registered List</label>
              <div className="min-h-[200px] border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                {keywords.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                    <AlertCircle size={32} className="mb-2 opacity-20" />
                    <p className="text-xs font-bold italic">등록된 업체가 없습니다.</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {keywords.map(k => (
                      <span key={k} className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black shadow-sm group hover:border-red-200 transition-all">
                        {k}
                        <button onClick={() => removeKeyword(k)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
            <button onClick={() => window.close()} className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-100 active:scale-95">닫기</button>
            <button 
              onClick={handleSaveKeywords} 
              disabled={saveStatus !== 'idle'}
              className={`flex-[2] py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 ${
                saveStatus === 'saving' ? 'bg-blue-400 text-white cursor-wait' : 
                saveStatus === 'saved' ? 'bg-emerald-600 text-white shadow-emerald-100' : 
                'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
              }`}
            >
              {saveStatus === 'saving' ? (
                <><RefreshCw size={18} className="animate-spin" /> 저장 중...</>
              ) : saveStatus === 'saved' ? (
                <><CheckCircle size={18} /> 저장 완료</>
              ) : (
                <><Save size={18} /> 설정 저장 후 닫기</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-200 gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-[320px]">
            <input 
              type="text" 
              placeholder="업체, 내용, 날짜 검색" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm bg-white text-black shadow-sm outline-none font-bold" 
            />
            <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
          </div>
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
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center justify-center px-4 py-2.5 bg-white text-indigo-600 border border-indigo-200 rounded-xl font-bold shadow-sm hover:bg-indigo-50 transition-all text-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            데이터 연동하기
          </button>
          <button 
            onClick={openIndependentWindow}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-md text-sm transition-all active:scale-95"
          >
            <Link size={18} />
            자동연동업체등록
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-300 overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={`${thClass} w-16`}>No</th>
                <th className={`${thClass} w-32`}>날짜</th>
                <th className={`${thClass} w-48 text-left pl-6`}>업체</th>
                <th className={`${thClass} text-left pl-6`}>점검/작업내용</th>
                <th className={`${thClass} w-32`}>비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && items.length === 0 ? (
                <tr><td colSpan={5} className="py-24 text-center border border-gray-200"><RefreshCw size={32} className="animate-spin text-blue-500 mx-auto mb-3" /><p className="text-gray-400 font-medium">데이터를 불러오는 중...</p></td></tr>
              ) : paginatedItems.length === 0 ? (
                <tr><td colSpan={5} className="py-24 text-center text-gray-400 italic text-sm border border-gray-200">데이터가 없습니다. [데이터 연동하기]를 눌러 가져오세요.</td></tr>
              ) : (
                paginatedItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className={`${tdClass} text-gray-400 font-mono text-xs`}>{filteredItems.length - ((currentPage - 1) * ITEMS_PER_PAGE + index)}</td>
                    <td className={`${tdClass} font-bold text-gray-700 whitespace-nowrap`}>{item.date}</td>
                    <td className={`${tdClass} font-black text-blue-800 text-left pl-6`}>{item.company}</td>
                    <td className={`${tdClass} text-left pl-6 text-gray-700 font-medium`}>{item.content}</td>
                    <td className={tdClass}>
                      <span className="text-[11px] font-bold text-gray-400">
                        {item.note || '-'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 - 리스트 박스 외부(하단)에 위치 */}
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
    </div>
  );
};

export default ElevatorInspectionList;
