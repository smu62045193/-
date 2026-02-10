import React, { useState, useEffect, useMemo } from 'react';
import { ConsumableItem } from '../types';
import { fetchConsumables, saveConsumables } from '../services/dataService';
import { Trash2, ArrowLeft, Search, X, History, Save, PackagePlus, RefreshCw, Edit2, RotateCcw, AlertTriangle, CheckCircle2, PlusCircle, LayoutGrid, List, Cloud, CheckCircle, ChevronLeft, ChevronRight, PackageSearch } from 'lucide-react';

interface ConsumablesLedgerProps {
  onBack?: () => void;
  viewMode?: 'ledger' | 'usage';
  isPopupMode?: boolean;
}

interface HistoryItem extends ConsumableItem {
  calculatedStock: number;
}

const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

const CATEGORIES = [
  '전기', '기계', '소방', '공용'
];

const ITEMS_PER_PAGE = 10;

const ConsumablesLedger: React.FC<ConsumablesLedgerProps> = ({ onBack, viewMode = 'ledger', isPopupMode = false }) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ConsumableItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [baseStock, setBaseStock] = useState<number>(0);

  const [newItem, setNewItem] = useState<ConsumableItem>({
    id: '',
    date: new Date().toISOString().split('T')[0],
    category: CATEGORIES[0],
    itemName: '',
    modelName: '',
    details: '',
    inQty: '',
    outQty: '',
    stockQty: '',
    unit: 'EA',
    note: '',
    minStock: '5' 
  });

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyTargetItem, setHistoryTargetItem] = useState<{name: string, model: string, category: string}>({name: '', model: '', category: ''});
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);

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
      if (e.data?.type === 'CONSUMABLE_SAVED') {
        loadData();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPopupMode]);

  useEffect(() => {
    if (editId && items.length > 0) {
      const item = items.find(i => String(i.id) === String(editId));
      if (item) {
        setNewItem({ ...item });
        // 수정 시 베이스 재고 계산
        const currentIn = parseFloat(String(item.inQty || '0').replace(/,/g, '')) || 0;
        const currentOut = parseFloat(String(item.outQty || '0').replace(/,/g, '')) || 0;
        const summary = summaryItems.find(s => 
          s.category === item.category && 
          s.itemName.trim() === item.itemName.trim() && 
          (s.modelName || '').trim() === (item.modelName || '').trim()
        );
        const totalStock = parseFloat(summary?.stockQty || '0');
        setBaseStock(totalStock - currentIn + currentOut);
      }
    }
  }, [editId, items]);

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, searchTerm]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchConsumables();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const openIndependentWindow = (id: string = 'new', initialData?: ConsumableItem) => {
    const width = 850;
    const height = 600;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'consumable');
    url.searchParams.set('id', id);
    
    // 기록추가 버튼을 통해 들어온 경우 초기 품명/모델명 전달을 위해 (옵션)
    if (initialData) {
      // 팝업에서는 items를 직접 쓰므로 별도 파라미터 보다는 id로 처리
    }

    window.open(
      url.toString(),
      `ConsumableWin_${id}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,location=no`
    );
  };

  const summaryItems = useMemo(() => {
    const groups: Record<string, { totalIn: number, totalOut: number, lastItem: ConsumableItem }> = {};
    items.forEach(item => {
      const key = `${item.category}_${item.itemName.trim()}_${(item.modelName || '').trim()}`;
      const inQ = parseFloat(String(item.inQty || '0').replace(/,/g, '')) || 0;
      const outQ = parseFloat(String(item.outQty || '0').replace(/,/g, '')) || 0;
      if (!groups[key]) {
        groups[key] = { totalIn: inQ, totalOut: outQ, lastItem: item };
      } else {
        groups[key].totalIn += inQ;
        groups[key].totalOut += outQ;
        if (new Date(item.date) >= new Date(groups[key].lastItem.date)) {
          groups[key].lastItem = item;
        }
      }
    });
    return Object.values(groups).map(group => ({
      ...group.lastItem,
      stockQty: (group.totalIn - group.totalOut).toString()
    })).sort((a, b) => 
      a.category.localeCompare(b.category) || 
      a.itemName.localeCompare(b.itemName) ||
      (a.modelName || '').localeCompare(b.modelName || '')
    );
  }, [items]);

  const updateBaseStock = (category: string, name: string, model: string) => {
    if (editId) return; 
    const matches = items.filter(
      item => item.category === category && 
      item.itemName.trim() === name.trim() && 
      (item.modelName || '').trim() === (model || '').trim()
    );
    let totalIn = 0; let totalOut = 0;
    let unit = 'EA'; let details = ''; let minStock = '5';
    matches.forEach(m => {
      totalIn += parseFloat(String(m.inQty || '0').replace(/,/g, '')) || 0;
      totalOut += parseFloat(String(m.outQty || '0').replace(/,/g, '')) || 0;
    });
    const latestMatch = [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    if (latestMatch) {
      unit = latestMatch.unit || 'EA';
      details = latestMatch.details || '';
      minStock = latestMatch.minStock || '5';
    }
    const currentCalculatedStock = totalIn - totalOut;
    setBaseStock(currentCalculatedStock);
    const currentIn = parseFloat(String(newItem.inQty || '0').replace(/,/g, '')) || 0;
    const currentOut = parseFloat(String(newItem.outQty || '0').replace(/,/g, '')) || 0;
    setNewItem(prev => ({
      ...prev,
      unit: latestMatch ? unit : prev.unit,
      details: latestMatch ? details : prev.details,
      minStock: latestMatch ? minStock : prev.minStock,
      stockQty: (currentCalculatedStock + currentIn - currentOut).toString()
    }));
  };

  const handleRegister = async () => {
    if (!newItem.itemName.trim()) {
      alert('품명은 필수 입력 항목입니다.');
      return;
    }
    setLoading(true);
    setShowSaveConfirm(false);
    try {
      const latestItems = await fetchConsumables();
      let newList = Array.isArray(latestItems) ? [...latestItems] : [];
      const itemToSave = { 
        ...newItem, 
        id: editId || generateId(),
        inQty: newItem.inQty || '0',
        outQty: newItem.outQty || '0',
        itemName: newItem.itemName.trim(),
        modelName: (newItem.modelName || '').trim(),
        minStock: newItem.minStock || '5'
      };
      if (editId) {
        const index = newList.findIndex(i => String(i.id) === String(editId));
        if (index >= 0) newList[index] = itemToSave;
        else newList = [itemToSave, ...newList];
      } else {
        newList = [itemToSave, ...newList];
      }
      const success = await saveConsumables(newList);
      if (success) {
        if (window.opener) {
          window.opener.postMessage({ type: 'CONSUMABLE_SAVED' }, '*');
        }
        setSaveSuccess(true);
        alert('저장이 완료되었습니다.');
        if (isPopupMode) {
          window.close();
        } else {
          setItems(newList);
          setTimeout(() => setSaveSuccess(false), 2000);
        }
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (e) {
      alert('처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleItemNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewItem(prev => ({ ...prev, itemName: value }));
    if (!editId) updateBaseStock(newItem.category, value, newItem.modelName);
  };

  const handleModelNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewItem(prev => ({ ...prev, modelName: value }));
    if (!editId) updateBaseStock(newItem.category, newItem.itemName, value);
  };

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'inQty' | 'outQty' | 'minStock') => {
    const rawVal = e.target.value.replace(/[^0-9.]/g, '');
    const numVal = parseFloat(rawVal || '0');
    if (field === 'minStock') {
      setNewItem(prev => ({ ...prev, minStock: rawVal }));
      return;
    }
    setNewItem(prev => {
      const nextIn = field === 'inQty' ? numVal : parseFloat(String(prev.inQty || '0').replace(/,/g, '')) || 0;
      const nextOut = field === 'outQty' ? numVal : parseFloat(String(prev.outQty || '0').replace(/,/g, '')) || 0;
      const safeIn = isNaN(nextIn) ? 0 : nextIn;
      const safeOut = isNaN(nextOut) ? 0 : nextOut;
      const nextStock = baseStock + safeIn - safeOut;
      return { ...prev, [field]: rawVal, stockQty: nextStock.toString() };
    });
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const idStr = String(deleteTargetId);
    const originalItems = [...items];
    const updatedItems = originalItems.filter(i => String(i.id) !== idStr);
    setItems(updatedItems);
    setDeleteTargetId(null);
    try {
      const success = await saveConsumables(updatedItems);
      if (!success) {
        setItems(originalItems);
        alert('삭제 실패');
      }
    } catch (e) {
      setItems(originalItems);
    }
  };

  const openHistory = (itemName: string, modelName: string, category: string) => {
    const trimmedName = itemName.trim();
    const trimmedModel = (modelName || '').trim();
    const history = items
      .filter(i => i.itemName.trim() === trimmedName && (i.modelName || '').trim() === trimmedModel && i.category === category)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let runningStock = 0;
    const historyWithCalculated = history.map(item => {
      const inQty = parseFloat(String(item.inQty || '0').replace(/,/g, '')) || 0;
      const outQty = parseFloat(String(item.outQty || '0').replace(/,/g, '')) || 0;
      runningStock += inQty - outQty;
      return { ...item, calculatedStock: runningStock };
    });
    setHistoryList([...historyWithCalculated].reverse());
    setHistoryTargetItem({ name: trimmedName, model: trimmedModel, category });
    setIsHistoryOpen(true);
  };

  const processedList = useMemo(() => {
    if (viewMode === 'ledger') {
      return summaryItems.filter(item => 
        (item.itemName || '').includes(searchTerm) || 
        (item.modelName || '').includes(searchTerm)
      );
    } else {
      return items.filter(item => 
        (item.itemName || '').includes(searchTerm) || 
        (item.details || '').includes(searchTerm) || 
        (item.modelName || '').includes(searchTerm)
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  }, [items, summaryItems, searchTerm, viewMode]);

  const totalPages = Math.ceil(processedList.length / ITEMS_PER_PAGE);
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedList.slice(start, start + ITEMS_PER_PAGE);
  }, [processedList, currentPage]);

  const visiblePageNumbers = useMemo(() => {
    const halfWindow = 2;
    let startPage = Math.max(1, currentPage - halfWindow);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage === totalPages) startPage = Math.max(1, endPage - 4);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) if (i > 0) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  const availableItemNames = Array.from(new Set(
    items.filter(item => item.category === newItem.category).map(item => item.itemName.trim())
  )).sort();

  const thClass = "border border-gray-300 p-2 bg-gray-50 text-center font-bold text-[12px] text-gray-700 h-10 align-middle uppercase";

  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col animate-fade-in">
          <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${editId ? 'bg-orange-500' : 'bg-blue-600'}`}>
                {editId ? <Edit2 size={20} /> : <PackagePlus size={20} />}
              </div>
              <span className="font-black text-lg">{editId ? '소모품 정보 수정' : '신규 소모품 등록'}</span>
            </div>
            <button onClick={() => window.close()} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="p-8 space-y-6 flex-1 overflow-y-auto scrollbar-hide">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">등록일자</label>
                <input type="date" value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">구분</label>
                <select value={newItem.category} onChange={e => { const cat = e.target.value; setNewItem({...newItem, category: cat}); if(!editId) updateBaseStock(cat, newItem.itemName, newItem.modelName); }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">단위</label>
                <input type="text" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} placeholder="EA" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500 text-center" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">품명 *</label>
                <input type="text" list="ledger-item-suggestions-popup" value={newItem.itemName} onChange={handleItemNameChange} placeholder="품명 입력/선택" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500" />
                <datalist id="ledger-item-suggestions-popup">{availableItemNames.map((name, index) => <option key={index} value={name} />)}</datalist>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">모델명</label>
                <input type="text" value={newItem.modelName} onChange={handleModelNameChange} placeholder="모델명(구분용)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">입고</label>
                <input type="text" value={newItem.inQty} onChange={e => handleQtyChange(e, 'inQty')} placeholder="0" className="w-full bg-slate-50 border border-blue-200 rounded-xl px-4 py-3 font-black text-blue-600 text-center outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">사용</label>
                <input type="text" value={newItem.outQty} onChange={e => handleQtyChange(e, 'outQty')} placeholder="0" className="w-full bg-slate-50 border border-red-200 rounded-xl px-4 py-3 font-black text-red-600 text-center outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">적정재고</label>
                <input type="text" value={newItem.minStock} onChange={e => handleQtyChange(e, 'minStock')} placeholder="5" className="w-full bg-slate-50 border border-orange-200 rounded-xl px-4 py-3 font-black text-orange-600 text-center outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>

            <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-blue-400 uppercase tracking-widest block mb-1">Calculated Inventory</span>
                <span className="text-2xl font-black text-blue-700">최종 재고: {newItem.stockQty || '0'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-blue-400 italic">* 이전 재고({baseStock}) 기준 자동 계산</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">상세내역 / 비고</label>
              <textarea value={newItem.details} onChange={e => setNewItem({...newItem, details: e.target.value})} placeholder="규격, 사용처 또는 특이사항 입력" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24" />
            </div>
          </div>

          <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-4">
            <button onClick={() => window.close()} className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all hover:bg-slate-100 active:scale-95">취소 후 닫기</button>
            <button onClick={() => setShowSaveConfirm(true)} disabled={loading} className={`flex-[2] py-3.5 ${editId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-2xl font-black text-base shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2`}>
              {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              서버에 데이터 저장
            </button>
          </div>
        </div>

        {showSaveConfirm && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:hidden">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-slate-100">
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-100"><Cloud className="text-blue-600" size={36} /></div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">서버저장 확인</h3>
                <p className="text-slate-500 mb-8 leading-relaxed font-medium">입력하신 소모품 데이터를<br/>서버에 안전하게 기록하시겠습니까?</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center"><X size={20} className="mr-2" />취소</button>
                  <button onClick={handleRegister} className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95"><CheckCircle size={20} className="mr-2" />확인</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto space-y-6 animate-fade-in relative">
      {/* 툴바 (작은박스 1) */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-200 shadow-sm print:hidden">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <input 
              type="text" 
              placeholder="품명, 모델명, 내역 검색" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner" 
            />
            <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button 
            onClick={loadData}
            disabled={loading}
            className="flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 bg-white text-emerald-600 border border-emerald-200 rounded-xl font-bold shadow-sm hover:bg-emerald-50 transition-all active:scale-95 text-sm"
          >
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <button 
            onClick={() => openIndependentWindow()}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg text-sm font-black active:scale-95"
          >
            <PlusCircle size={18} /> 신규 소모품 등록
          </button>
        </div>
      </div>

      {/* 리스트 (작은박스 2) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <h2 className="text-xl font-black text-gray-800">
              {viewMode === 'ledger' ? '소모품 현재 재고 현황' : '소모품 전체 변동 내역'}
            </h2>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
              {viewMode === 'ledger' ? `총 ${summaryItems.length}개 품목` : `총 ${items.length}건 기록`}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-gray-300 overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse">
              <thead className="bg-blue-50 border-b border-blue-100">
                {viewMode === 'ledger' ? (
                  <tr>
                    <th className={`${thClass} w-12`}>No</th>
                    <th className={`${thClass} w-28`}>구분</th>
                    <th className={`${thClass} text-left pl-4`}>품명 (클릭시 상세변동이력)</th>
                    <th className={`${thClass} w-48`}>모델명</th>
                    <th className={`${thClass} w-28 text-emerald-600`}>현재재고</th>
                    <th className={`${thClass} w-20 text-orange-600`}>적정재고</th>
                    <th className={`${thClass} w-16`}>단위</th>
                    <th className={`${thClass} w-36`}>관리</th>
                  </tr>
                ) : (
                  <tr>
                    <th className={`${thClass} w-12`}>No</th>
                    <th className={`${thClass} w-28`}>날짜</th>
                    <th className={`${thClass} w-24`}>구분</th>
                    <th className={`${thClass} text-left pl-4`}>품명</th>
                    <th className={`${thClass} w-32`}>모델명</th>
                    <th className={`${thClass} w-16 text-blue-600`}>입고</th>
                    <th className={`${thClass} w-16 text-red-600`}>사용</th>
                    <th className={`${thClass} w-20 text-emerald-600`}>입력재고</th>
                    <th className={`${thClass} text-left pl-4`}>상세내역</th>
                    <th className={`${thClass} w-24 print:hidden`}>관리</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedList.length === 0 ? (
                  <tr><td colSpan={10} className="py-20 text-center text-gray-400 italic">내역이 없습니다.</td></tr>
                ) : viewMode === 'ledger' ? (
                  paginatedList.map((item, idx) => {
                    const globalIdx = processedList.length - ((currentPage - 1) * ITEMS_PER_PAGE + idx);
                    const currentStock = parseFloat(item.stockQty);
                    const minStock = parseFloat(item.minStock || '5');
                    const isLowStock = currentStock <= minStock;
                    return (
                      <tr key={`summary-${item.id}`} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-3 py-4 text-center text-gray-400 font-mono text-xs">{globalIdx}</td>
                        <td className="px-3 py-4 text-xs text-gray-600 font-bold text-center">{item.category}</td>
                        <td className="px-3 py-4 text-left pl-4"><button onClick={() => openHistory(item.itemName, item.modelName, item.category)} className="text-blue-600 hover:text-blue-800 hover:underline text-left font-black text-sm">{item.itemName}</button></td>
                        <td className="px-3 py-4 text-xs text-gray-600 font-bold text-center">{item.modelName || '-'}</td>
                        <td className="px-2 py-4 text-center">
                          <span className={`inline-block px-3 py-1 font-black rounded-lg text-sm ${isLowStock ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-emerald-100 text-emerald-700'}`}>
                            {item.stockQty}
                            {isLowStock && <span className="ml-1 text-[10px]">[부족]</span>}
                          </span>
                        </td>
                        <td className="px-2 py-4 text-center text-gray-500 font-bold text-xs">{item.minStock || '5'}</td>
                        <td className="px-2 py-4 text-xs text-center text-gray-500 font-bold">{item.unit}</td>
                        <td className="px-3 py-4 text-center">
                          <button onClick={() => openIndependentWindow('new', item)} className="flex items-center gap-1 mx-auto bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-sm transition-all font-bold text-[11px] active:scale-95"><PlusCircle size={13} /><span>기록추가</span></button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  paginatedList.map((item, idx) => {
                    const globalIdx = processedList.length - ((currentPage - 1) * ITEMS_PER_PAGE + idx);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-3 py-4 text-center text-gray-400 font-mono text-[10px]">{globalIdx}</td>
                        <td className="px-3 py-4 text-[11px] text-gray-700 whitespace-nowrap text-center">{item.date}</td>
                        <td className="px-3 py-4 text-[11px] text-gray-600 text-center">{item.category}</td>
                        <td className="px-3 py-4 text-left pl-4 text-[11px] font-bold text-gray-800">{item.itemName}</td>
                        <td className="px-3 py-4 text-[11px] text-gray-500 font-bold text-center">{item.modelName}</td>
                        <td className="px-2 py-4 text-center text-[11px] text-blue-600 font-bold">{item.inQty !== '0' && item.inQty !== '' ? item.inQty : ''}</td>
                        <td className="px-2 py-4 text-center text-[11px] text-red-600 font-bold">{item.outQty !== '0' && item.outQty !== '' ? item.outQty : ''}</td>
                        <td className="px-2 py-4 text-center text-[11px] text-emerald-700 font-bold bg-emerald-50/30">{item.stockQty}</td>
                        <td className="px-3 py-4 text-left pl-4 text-[11px] text-gray-500 italic max-w-[200px] truncate">{item.details}</td>
                        <td className="px-3 py-4 text-center print:hidden">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openIndependentWindow(item.id)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="수정"><Edit2 size={16} /></button>
                            <button onClick={() => setDeleteTargetId(item.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="삭제"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-center gap-2 mt-4 rounded-xl">
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
      </div>

      {/* 역사 모달 (기존 유지) */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in border border-gray-100">
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
              <div className="flex items-center gap-3">
                <History className="text-blue-600" size={24} />
                <div>
                  <h3 className="text-xl font-bold text-gray-800">[{historyTargetItem.category}] {historyTargetItem.name} 상세 변동 이력</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{historyTargetItem.model ? `모델명: ${historyTargetItem.model}` : '모델명 없음'}</p>
                </div>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="text-gray-400 hover:text-black hover:bg-gray-200 p-2 rounded-full transition-all"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100 mb-6 flex items-start gap-3">
                <AlertTriangle className="text-blue-500 mt-0.5" size={18} />
                <div className="text-xs text-blue-800 leading-relaxed">
                  <p className="font-bold">알림: 누적 재고 계산 방식 안내</p>
                  <p>이 화면의 '계산된 누적재고'는 해당 품목의 모든 기록을 <strong>날짜순으로 정렬하여 처음부터 차례대로 합산</strong>한 결과입니다.</p>
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 border-b text-center text-xs font-bold text-gray-500 w-12">No</th>
                      <th className="px-4 py-3 border-b text-center text-xs font-bold text-gray-500 w-28">날짜</th>
                      <th className="px-4 py-3 border-b text-left text-xs font-bold text-gray-500">사용내역 / 세부사항</th>
                      <th className="px-4 py-3 border-b text-center text-xs font-bold text-blue-600 w-20">입고</th>
                      <th className="px-4 py-3 border-b text-center text-xs font-bold text-red-600 w-20">사용</th>
                      <th className="px-4 py-3 border-b text-center text-xs font-bold text-emerald-600 w-28">계산된 누적재고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyList.map((item, idx) => (
                      <tr key={`history-${item.id}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-center text-gray-400 font-mono text-xs">{historyList.length - idx}</td>
                        <td className="px-4 py-3 text-center font-medium text-gray-700">{item.date}</td>
                        <td className="px-4 py-3 text-left font-medium text-gray-800">{item.details || item.note || '-'}</td>
                        <td className="px-4 py-3 text-center font-bold text-blue-600">{item.inQty !== '0' && item.inQty !== '' ? item.inQty : '-'}</td>
                        <td className="px-4 py-3 text-center font-bold text-red-600">{item.outQty !== '0' && item.outQty !== '' ? item.outQty : '-'}</td>
                        <td className="px-4 py-3 text-center"><span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 font-black rounded-lg">{item.calculatedStock}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t flex justify-end">
              <button onClick={() => setIsHistoryOpen(false)} className="px-6 py-2 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-800 transition-all shadow-md">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-100"><AlertTriangle className="text-red-500" size={32} /></div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">기록 삭제 확인</h3>
              <p className="text-gray-500 mb-8 leading-relaxed">해당 기록을 장부에서 영구히 삭제하시겠습니까?<br/><span className="text-red-500 font-bold text-sm">삭제 시 재고가 다시 계산됩니다.</span></p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTargetId(null)} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors">취소</button>
                <button onClick={confirmDelete} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg">삭제 진행</button>
              </div>
            </div>
          </div>
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

export default ConsumablesLedger;