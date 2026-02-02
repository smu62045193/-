
import React, { useState, useEffect } from 'react';
import { ElevatorInspectionItem, DailyData, LogCategory } from '../types';
import { fetchElevatorInspectionList, saveElevatorInspectionList, apiFetchRange, fetchLinkedKeywords, saveLinkedKeywords } from '../services/dataService';
import { RefreshCw, Search, Link, Plus, Trash2, X, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const ElevatorInspectionList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ElevatorInspectionItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isKeywordModalOpen, setIsKeywordModalOpen] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    loadData();
    loadKeywords();
  }, []);

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
            
            // 텍스트 청소 로직: 등록된 업체명을 괄호 포함하여 제거
            let cleanContent = task.content;
            
            // 정규표현식 특수문자 이스케이프
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
                note: '' // 비고란 비움
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
      // 2초 후 상태 복원 및 모달 닫기
      setTimeout(() => {
        setSaveStatus('idle');
        setIsKeywordModalOpen(false);
      }, 2000);
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

  const filteredItems = items.filter(item => 
    (item.company || '').includes(searchTerm) || 
    (item.content || '').includes(searchTerm) ||
    (item.date || '').includes(searchTerm)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4 animate-fade-in">
      {/* Toolbar - 한 행으로 구성 */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200 gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <input 
              type="text" 
              placeholder="업체, 내용, 날짜 검색" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
            />
            <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button 
            onClick={handleRefresh}
            disabled={loading}
            className="flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 bg-white text-emerald-600 border border-emerald-200 rounded-xl font-bold shadow-sm hover:bg-emerald-50 transition-all text-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <button 
            onClick={() => setIsKeywordModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all text-sm active:scale-95"
          >
            <Link size={18} className="mr-2" />
            자동연동업체등록
          </button>
        </div>
      </div>

      {/* List Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-16">No</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-32">날짜</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-500 uppercase tracking-wider w-48">업체</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-500 uppercase tracking-wider">내용</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-500 uppercase tracking-wider w-32">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && items.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-20 text-center text-gray-400 italic text-sm">로딩 중...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-20 text-center text-gray-400 italic text-sm">데이터가 없습니다. [새로고침]을 눌러 연동하세요.</td></tr>
              ) : (
                filteredItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-4 py-3 text-center text-gray-400 font-mono text-xs">{filteredItems.length - index}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700 font-bold whitespace-nowrap">{item.date}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-black">{item.company}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.content}</td>
                    <td className="px-4 py-3 text-center">
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

      {/* Keyword Modal */}
      {isKeywordModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Link className="text-blue-600" size={20} />
                <h3 className="text-lg font-black text-slate-800">자동 연동 업체 관리</h3>
              </div>
              <button onClick={() => setIsKeywordModalOpen(false)} className="p-1 hover:bg-gray-200 rounded-full text-gray-400 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                업무일지에 입력되는 업체명을 등록하세요.<br/>
                <span className="text-blue-600 font-bold">공백, 괄호 등은 자동으로 무시하고 연동됩니다.</span>
              </p>
              
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                  placeholder="예: OTIS, 현대엘리베이터"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button 
                  onClick={addKeyword}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
                >
                  추가
                </button>
              </div>

              <div className="max-h-[200px] overflow-y-auto border border-gray-100 rounded-xl p-2 bg-slate-50/50">
                {keywords.length === 0 ? (
                  <p className="text-center py-8 text-xs text-gray-400 italic">등록된 업체가 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {keywords.map(k => (
                      <span key={k} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-lg text-xs font-bold shadow-sm">
                        {k}
                        <button onClick={() => removeKeyword(k)} className="hover:text-red-500"><Trash2 size={12} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-50 flex gap-3">
              <button onClick={() => setIsKeywordModalOpen(false)} className="flex-1 px-4 py-3 bg-white border border-gray-300 text-slate-600 rounded-2xl font-bold hover:bg-gray-100 transition-all">취소</button>
              <button 
                onClick={handleSaveKeywords} 
                disabled={saveStatus !== 'idle'}
                className={`flex-1 px-4 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                  saveStatus === 'saving' ? 'bg-blue-400 text-white cursor-wait' : 
                  saveStatus === 'saved' ? 'bg-emerald-600 text-white shadow-emerald-100' : 
                  'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
                }`}
              >
                {saveStatus === 'saving' ? (
                  <><RefreshCw size={18} className="animate-spin" /> 서버저장중...</>
                ) : saveStatus === 'saved' ? (
                  <><CheckCircle size={18} /> 서버저장완료</>
                ) : (
                  <><Save size={18} /> 서버저장</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ElevatorInspectionList;
