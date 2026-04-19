import React, { useState, useEffect, useMemo } from 'react';
import { FireHistoryItem, ElevatorInspectionItem, LogCategory } from '../types';
import { 
  fetchFireHistoryList, saveFireHistoryList, 
  fetchElevatorInspectionList, saveElevatorInspectionList,
  apiFetchRange, fetchLinkedKeywords, saveLinkedKeywords,
  generateUUID
} from '../services/dataService';
import { RefreshCw, Search, Link, X, Save, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Flame, ArrowUpDown, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface IntegratedInspectionListProps {
  isPopupMode?: boolean;
}

interface IntegratedItem {
  id: string;
  date: string;
  type: '소방' | '승강기';
  company: string;
  content: string;
  note: string;
  originalType: 'fire' | 'elevator';
}

const ITEMS_PER_PAGE = 10;

const IntegratedInspectionList: React.FC<IntegratedInspectionListProps> = ({ isPopupMode = false }) => {
  // Main State
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<IntegratedItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Keyword Management State (for Popup)
  const [popupTab, setPopupTab] = useState<'fire' | 'elevator'>('fire');
  const [fireKeywords, setFireKeywords] = useState<string[]>([]);
  const [elevatorKeywords, setElevatorKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (isPopupMode) {
      loadKeywords();
      const handleMessage = (e: MessageEvent) => {
        if (e.data?.type === 'KEYWORDS_UPDATED') {
          loadKeywords();
        }
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    } else {
      loadData();
      // Load keywords in background for auto-sync feature
      loadKeywords();
    }
  }, [isPopupMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, items.length]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fireData, elevatorData] = await Promise.all([
        fetchFireHistoryList(),
        fetchElevatorInspectionList()
      ]);

      const integrated: IntegratedItem[] = [
        ...(fireData || []).map(item => ({
          ...item,
          type: '소방' as const,
          originalType: 'fire' as const
        })),
        ...(elevatorData || []).map(item => ({
          ...item,
          type: '승강기' as const,
          originalType: 'elevator' as const
        }))
      ];

      // Sort by date descending
      integrated.sort((a, b) => b.date.localeCompare(a.date));
      setItems(integrated);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  };

  const loadKeywords = async () => {
    const [fKeywords, eKeywords] = await Promise.all([
      fetchLinkedKeywords('fire'),
      fetchLinkedKeywords('elevator')
    ]);
    setFireKeywords(fKeywords || []);
    setElevatorKeywords(eKeywords || []);
  };

  const normalize = (text: string) => (text || '').replace(/[\s()-]/g, '').toUpperCase();

  const openIndependentWindow = () => {
    const width = 500;
    const height = 700;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'integrated_contractor');

    window.open(
      url.toString(),
      `IntegratedKeywordWin`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,location=no`
    );
  };

  const handleRefresh = async () => {
    if (fireKeywords.length === 0 && elevatorKeywords.length === 0) {
      alert('먼저 [업체등록]에서 연동할 업체를 등록해주세요.');
      return;
    }

    setLoading(true);
    try {
      // 현재 날짜 기준 과거 6개월부터 오늘까지 데이터를 가져오도록 개선 (미래 예정사항 제외)
      const now = new Date();
      const startDate = format(new Date(now.getFullYear(), now.getMonth() - 6, 1), 'yyyy-MM-dd');
      const endDate = format(now, 'yyyy-MM-dd');
      
      const logs = await apiFetchRange("DAILY_", startDate, endDate);
      
      const normalizedFireKeywords = fireKeywords.map(normalize);
      const normalizedElevatorKeywords = elevatorKeywords.map(normalize);
      
      const newFireEntries: FireHistoryItem[] = [];
      const newElevatorEntries: ElevatorInspectionItem[] = [];

      // Helper to process logs
      const processLog = (
        tasks: any[], 
        keywords: string[], 
        normalizedKeywords: string[], 
        existingItems: IntegratedItem[], 
        type: 'fire' | 'elevator',
        newEntries: any[]
      ) => {
        if (!tasks) return;
        tasks.forEach(task => {
          if (!task.content) return;
          const normalizedContent = normalize(task.content);
          
          const keywordIdx = normalizedKeywords.findIndex(nk => nk !== '' && normalizedContent.includes(nk));
          
          if (keywordIdx !== -1) {
            const matchedKeyword = keywords[keywordIdx];
            let cleanContent = task.content;
            const escapedK = matchedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const cleaningPatterns = [
              new RegExp(`\\s?\\(\\s?${escapedK}\\s?\\)`, 'gi'), // 괄호 안 공백 허용
              new RegExp(`\\(\\s?${escapedK}\\s?\\)`, 'gi'),
              new RegExp(`\\s?${escapedK}`, 'gi')
            ];
            cleaningPatterns.forEach(pattern => {
              cleanContent = cleanContent.replace(pattern, '');
            });
            
            // If content becomes empty or just "승강기정기점검", keep original if needed or use cleaned
            // For "승강기정기점검(OTIS)" -> "승강기정기점검"
            cleanContent = cleanContent.trim();

            // Check existence in current items (날짜, 업체명, 내용이 모두 일치할 때만 중복으로 판단)
            const exists = existingItems.some(item => 
              item.originalType === type && 
              item.date === dateKey && 
              item.company === matchedKeyword &&
              normalize(item.content) === normalize(cleanContent)
            );
            
            if (!exists) {
              // Check duplicates within new entries to avoid double adding in same batch
              const duplicateInBatch = newEntries.some(entry => 
                entry.date === dateKey && 
                entry.company === matchedKeyword &&
                normalize(entry.content) === normalize(cleanContent)
              );

              if (!duplicateInBatch) {
                newEntries.push({
                  id: generateUUID(),
                  date: dateKey,
                  company: matchedKeyword,
                  content: cleanContent,
                  note: ''
                });
              }
            }
          }
        });
      };

      let dateKey = '';
      logs.forEach((entry: any) => {
        dateKey = entry.key.replace("DAILY_", "");
        // 소방, 승강기 카테고리만 훑도록 제한
        const categories = ['fire', 'elevator'];

        categories.forEach(cat => {
          const log = (entry.data?.workLog as any)?.[cat];
          if (log && log.today && Array.isArray(log.today)) {
            processLog(log.today, fireKeywords, normalizedFireKeywords, items, 'fire', newFireEntries);
            processLog(log.today, elevatorKeywords, normalizedElevatorKeywords, items, 'elevator', newElevatorEntries);
          }
        });

        // Check Scheduled (structure is different, direct array)
        const scheduledLog = entry.data?.workLog?.scheduled as any[];
        if (scheduledLog && Array.isArray(scheduledLog)) {
          processLog(scheduledLog, fireKeywords, normalizedFireKeywords, items, 'fire', newFireEntries);
          processLog(scheduledLog, elevatorKeywords, normalizedElevatorKeywords, items, 'elevator', newElevatorEntries);
        }
      });

      let message = '';
      let updated = false;

      if (newFireEntries.length > 0) {
        const currentFireItems = items.filter(i => i.originalType === 'fire').map(i => ({
          id: i.id, date: i.date, company: i.company, content: i.content, note: i.note
        }));
        const updatedFireList = [...newFireEntries, ...currentFireItems].sort((a, b) => b.date.localeCompare(a.date));
        await saveFireHistoryList(updatedFireList);
        message += `소방 데이터 ${newFireEntries.length}건 `;
        updated = true;
      }

      if (newElevatorEntries.length > 0) {
        const currentElevatorItems = items.filter(i => i.originalType === 'elevator').map(i => ({
          id: i.id, date: i.date, company: i.company, content: i.content, note: i.note
        }));
        const updatedElevatorList = [...newElevatorEntries, ...currentElevatorItems].sort((a, b) => b.date.localeCompare(a.date));
        await saveElevatorInspectionList(updatedElevatorList);
        message += `승강기 데이터 ${newElevatorEntries.length}건 `;
        updated = true;
      }

      if (updated) {
        await loadData(); // Reload all data
        alert(`${message}이 연동되어 저장되었습니다.`);
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

  // Popup Logic
  const handleSaveKeywords = async () => {
    setSaveStatus('saving');
    try {
      const successFire = await saveLinkedKeywords('fire', fireKeywords);
      const successElevator = await saveLinkedKeywords('elevator', elevatorKeywords);
      
      if (successFire && successElevator) {
        setSaveStatus('saved');
        if (window.opener) {
          window.opener.postMessage({ type: 'KEYWORDS_UPDATED' }, '*');
        }
        alert('업체 목록이 저장되었습니다.');
        // window.close(); // Keep open or close? Request says "keep existing settings", usually means keep open until user closes or explicit save & close
      } else {
        setSaveStatus('idle');
        alert('일부 데이터 저장에 실패했습니다.');
      }
    } catch (e) {
      setSaveStatus('idle');
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const addKeyword = () => {
    const currentKeywords = popupTab === 'fire' ? fireKeywords : elevatorKeywords;
    const setKeywords = popupTab === 'fire' ? setFireKeywords : setElevatorKeywords;
    
    if (newKeyword.trim() && !currentKeywords.includes(newKeyword.trim())) {
      setKeywords([...currentKeywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (k: string) => {
    if (popupTab === 'fire') {
      setFireKeywords(fireKeywords.filter(item => item !== k));
    } else {
      setElevatorKeywords(elevatorKeywords.filter(item => item !== k));
    }
  };

  // Filtering and Pagination
  const filteredItems = useMemo(() => {
    return items.filter(item => 
      (item.company || '').includes(searchTerm) || 
      (item.content || '').includes(searchTerm) ||
      (item.date || '').includes(searchTerm) ||
      (item.type || '').includes(searchTerm)
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
    const endPage = Math.min(totalPages, startPage + 4);
    if (endPage === totalPages) startPage = Math.max(1, endPage - 4);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) if (i > 0) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  // Render Popup
  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-fade-in flex flex-col h-[650px]">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Link size={18} />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight">자동 연동 업체 관리</h3>
                <p className="text-[9px] text-blue-300 font-bold uppercase tracking-widest">Contractor Setup</p>
              </div>
            </div>
            <button onClick={() => window.close()} className="p-1 hover:bg-white/20 rounded-full transition-colors text-white">
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              className={`flex-1 py-3 text-sm font-bold transition-colors ${popupTab === 'fire' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
              onClick={() => setPopupTab('fire')}
            >
              <div className="flex items-center justify-center gap-2">
                <Flame size={16} /> 소방 업체
              </div>
            </button>
            <button
              className={`flex-1 py-3 text-sm font-bold transition-colors ${popupTab === 'elevator' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
              onClick={() => setPopupTab('elevator')}
            >
              <div className="flex items-center justify-center gap-2">
                <ArrowUpDown size={16} /> 승강기 업체
              </div>
            </button>
          </div>
          
          <div className="p-4 space-y-4 flex-1 flex flex-col overflow-hidden">
            <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 shrink-0">
              <p className="text-[11px] text-blue-800 leading-snug font-bold">
                업무일지에 입력되는 업체명을 등록하세요.<br/>
                <span className="text-blue-600 underline">공백, 괄호 등은 자동으로 무시하고 연동됩니다.</span>
              </p>
            </div>
            
            <div className="space-y-1.5 shrink-0">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Contractor Name</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                  placeholder={popupTab === 'fire' ? "예: 무한개발" : "예: 현대엘리베이터"}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold shadow-inner"
                />
                <button 
                  onClick={addKeyword}
                  className="px-5 py-2.5 bg-slate-800 text-white rounded-xl font-black hover:bg-black transition-all active:scale-95 shadow-md text-sm"
                >
                  추가
                </button>
              </div>
            </div>

            <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Registered List ({popupTab === 'fire' ? '소방' : '승강기'})</label>
              <div className="flex-1 border-2 border-dashed border-slate-200 rounded-2xl p-3 bg-slate-50/50 overflow-y-auto scrollbar-hide">
                {(popupTab === 'fire' ? fireKeywords : elevatorKeywords).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300">
                    <AlertCircle size={24} className="mb-2 opacity-20" />
                    <p className="text-[11px] font-bold italic">등록된 업체가 없습니다.</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(popupTab === 'fire' ? fireKeywords : elevatorKeywords).map(k => (
                      <span key={k} className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[11px] font-black shadow-sm group hover:border-red-200 transition-all">
                        {k}
                        <button onClick={() => removeKeyword(k)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
            <button onClick={() => window.close()} className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-100 active:scale-95">닫기</button>
            <button 
              onClick={handleSaveKeywords} 
              disabled={saveStatus !== 'idle'}
              className={`flex-[2] py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 ${
                saveStatus === 'saving' ? 'bg-blue-400 text-white cursor-wait' : 
                saveStatus === 'saved' ? 'bg-emerald-600 text-white shadow-emerald-100' : 
                'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
              }`}
            >
              {saveStatus === 'saving' ? (
                <><RefreshCw size={16} className="animate-spin" /> 저장 중...</>
              ) : saveStatus === 'saved' ? (
                <><CheckCircle size={16} /> 저장 완료</>
              ) : (
                <><Save size={16} /> 설정 저장 후 닫기</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Main List
  const thClass = "border border-gray-200 px-4 py-3 bg-gray-50 font-normal text-center align-middle text-sm text-gray-700 whitespace-nowrap";
  const tdClass = "border border-gray-200 px-4 py-3 text-sm text-gray-700 align-middle bg-white text-center font-normal";

  return (
    <div className="space-y-2">
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
        <div className="flex items-stretch shrink-0">
          <div className="relative w-full sm:w-[250px] flex items-center bg-white border-none rounded-none">
            <input 
              type="text" 
              placeholder="업체, 내용, 날짜 검색" 
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
              onClick={loadData}
              disabled={loading}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
            >
              <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
            <button 
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-all relative whitespace-nowrap disabled:opacity-50"
            >
              <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              연동
            </button>
            <button 
              onClick={openIndependentWindow}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
            >
              <Plus size={18} className="mr-1.5" />
              등록
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto bg-white">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[1000px] border-collapse text-center bg-white border border-black">
            <thead className="bg-white">
              <tr className="h-[40px] border-b border-black">
                <th className="border-r border-black px-2 text-[13px] font-normal text-gray-700 w-16">
                  <div className="flex items-center justify-center h-full text-[13px] font-normal">No</div>
                </th>
                <th className="border-r border-black px-2 text-[13px] font-normal text-gray-700 w-32">
                  <div className="flex items-center justify-center h-full text-[13px] font-normal">일자</div>
                </th>
                <th className="border-r border-black px-2 text-[13px] font-normal text-gray-700 w-24">
                  <div className="flex items-center justify-center h-full text-[13px] font-normal">구분</div>
                </th>
                <th className="border-r border-black px-2 text-[13px] font-normal text-gray-700 w-48">
                  <div className="flex items-center justify-center h-full text-[13px] font-normal">업체</div>
                </th>
                <th className="border-r border-black px-2 text-[13px] font-normal text-gray-700">
                  <div className="flex items-center justify-center h-full text-[13px] font-normal">점검내용</div>
                </th>
                <th className="px-2 text-[13px] font-normal text-gray-700 w-32">
                  <div className="flex items-center justify-center h-full text-[13px] font-normal">비고</div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading && items.length === 0 ? (
                <tr className="h-[40px] border-b border-black">
                  <td colSpan={6} className="text-center">
                    <div className="flex items-center justify-center h-full gap-2 text-[13px] font-normal text-gray-400">
                      <RefreshCw size={16} className="animate-spin text-blue-500" />
                      데이터를 불러오는 중...
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr className="h-[40px] border-b border-black">
                  <td colSpan={6} className="text-center">
                    <div className="flex items-center justify-center h-full text-[13px] font-normal text-gray-400 italic">
                      데이터가 없습니다. [연동]을 눌러 가져오세요.
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, index) => {
                  return (
                    <tr key={item.id} className="h-[40px] border-b border-black hover:bg-gray-50 transition-colors text-center">
                      <td className="border-r border-black px-2 text-[13px] font-normal text-gray-400">
                        <div className="flex items-center justify-center h-full text-[13px] font-normal">
                          {filteredItems.length - ((currentPage - 1) * ITEMS_PER_PAGE + index)}
                        </div>
                      </td>
                      <td className="border-r border-black px-2 text-[13px] font-normal text-gray-700">
                        <div className="flex items-center justify-center h-full text-[13px] font-normal whitespace-nowrap">
                          {item.date}
                        </div>
                      </td>
                      <td className={`border-r border-black px-2 text-[13px] font-normal ${item.type === '소방' ? 'text-red-600' : 'text-blue-600'}`}>
                        <div className="flex items-center justify-center h-full text-[13px] font-normal">
                          {item.type}
                        </div>
                      </td>
                      <td className="border-r border-black px-2 text-[13px] font-normal text-gray-900">
                        <div className="flex items-center justify-center h-full text-[13px] font-normal">
                          {item.company}
                        </div>
                      </td>
                      <td className="border-r border-black px-2 text-[13px] font-normal text-gray-700">
                        <div className="flex items-center justify-center h-full text-[13px] font-normal">
                          {item.content}
                        </div>
                      </td>
                      <td className="px-2 text-[13px] font-normal text-gray-600">
                        <div className="flex items-center justify-center h-full text-[13px] font-normal">
                          {item.note || '-'}
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
      {filteredItems.length > 0 && (
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

export default IntegratedInspectionList;
