import React, { useState, useEffect, useMemo } from 'react';
import { ConsumableItem } from '../types';
import { fetchConsumables, saveConsumables } from '../services/dataService';
import { Trash2, ArrowLeft, Search, X, History, Save, PackagePlus, RefreshCw, Edit2, RotateCcw, AlertTriangle, CheckCircle2, PlusCircle, LayoutGrid, List, Cloud, CheckCircle } from 'lucide-react';

interface ConsumablesLedgerProps {
  onBack?: () => void;
}

interface HistoryItem extends ConsumableItem {
  calculatedStock: number;
}

const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

const CATEGORIES = [
  '전기', '기계', '소방', '공용'
];

const ConsumablesLedger: React.FC<ConsumablesLedgerProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ConsumableItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  
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
  }, []);

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

    let totalIn = 0;
    let totalOut = 0;
    let unit = 'EA';
    let details = '';
    let minStock = '5';

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

  const handleNewTransaction = (item: ConsumableItem) => {
    setEditId(null);
    const summary = summaryItems.find(s => 
      s.category === item.category && 
      s.itemName.trim() === item.itemName.trim() && 
      (s.modelName || '').trim() === (item.modelName || '').trim()
    );
    const stockVal = parseFloat(summary?.stockQty || '0');
    const minStockVal = summary?.minStock || '5';
    setBaseStock(stockVal);

    setNewItem({
      ...item,
      id: '',
      date: new Date().toISOString().split('T')[0],
      inQty: '',
      outQty: '',
      stockQty: stockVal.toString(),
      minStock: minStockVal,
      note: ''
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoadToForm = (item: ConsumableItem) => {
    setNewItem({ ...item });
    setEditId(item.id);
    
    const currentIn = parseFloat(String(item.inQty || '0').replace(/,/g, '')) || 0;
    const currentOut = parseFloat(String(item.outQty || '0').replace(/,/g, '')) || 0;
    
    const summary = summaryItems.find(s => 
      s.category === item.category && 
      s.itemName.trim() === item.itemName.trim() && 
      (s.modelName || '').trim() === (item.modelName || '').trim()
    );
    
    const totalStock = parseFloat(summary?.stockQty || '0');
    setBaseStock(totalStock - currentIn + currentOut);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setBaseStock(0);
    setNewItem({
      id: '',
      date: new Date().toISOString().split('T')[0],
      category: newItem.category,
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
        setItems(newList);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        handleCancelEdit();
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (e) {
      console.error(e);
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

      return {
        ...prev,
        [field]: rawVal,
        stockQty: nextStock.toString()
      };
    });
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const idStr = String(deleteTargetId);
    const originalItems = [...items];
    const updatedItems = originalItems.filter(i => String(i.id) !== idStr);
    setItems(updatedItems);
    if (String(editId) === idStr) handleCancelEdit();
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

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      (item.itemName || '').includes(searchTerm) || 
      (item.details || '').includes(searchTerm) || 
      (item.modelName || '').includes(searchTerm)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [items, searchTerm]);

  const filteredSummary = summaryItems.filter(item => 
    (item.itemName || '').includes(searchTerm) || 
    (item.modelName || '').includes(searchTerm)
  );

  const availableItemNames = Array.from(new Set(
    items.filter(item => item.category === newItem.category).map(item => item.itemName.trim())
  )).sort();

  return (
    <div className="p-6 max-w-full mx-auto space-y-6 animate-fade-in relative">
      <div className={`p-6 rounded-xl border shadow-md transition-all duration-300 ${editId ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-100' : 'bg-blue-50/50 border-blue-200'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg text-white shadow-sm ${editId ? 'bg-orange-500 animate-pulse' : 'bg-blue-600'}`}>
              {editId ? <Edit2 size={18} /> : <PackagePlus size={18} />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                {editId ? <><span className="text-orange-600 underline">[{newItem.itemName} / {newItem.modelName || '모델없음'}]</span> 오타/정보 수정</> : (newItem.itemName ? <><span className="text-blue-600 underline">[{newItem.itemName}]</span> 기록 추가</> : '소모품 등록/수정')}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {editId ? '* 기존 기록 자체를 변경합니다.' : '* 적정재고는 자재 신청서 자동 연동 기준입니다.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(editId || newItem.itemName) && (
              <button 
                onClick={handleCancelEdit}
                className="flex items-center space-x-1 text-sm text-gray-600 hover:text-black font-bold bg-white px-4 py-2 rounded-lg border border-gray-300 shadow-sm transition-all"
              >
                <RotateCcw size={16} />
                <span>입력 취소</span>
              </button>
            )}
            <button 
              onClick={() => setShowSaveConfirm(true)} 
              disabled={loading}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg shadow-md transition-all font-bold text-sm ${saveSuccess ? 'bg-green-600' : (editId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700')} text-white ${loading ? 'opacity-50' : 'active:scale-95'}`}
            >
              {loading ? <RefreshCw className="animate-spin" size={18} /> : (saveSuccess ? <CheckCircle size={18} /> : <Save size={18} />)}
              <span>{saveSuccess ? '저장완료' : '서버저장'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div><label className="block text-xs font-bold text-gray-500 mb-1">등록일자</label><input type="date" value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black focus:ring-2 focus:ring-blue-500 h-[38px]" /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">구분</label><select value={newItem.category} onChange={e => { const cat = e.target.value; setNewItem({...newItem, category: cat}); if(!editId) updateBaseStock(cat, newItem.itemName, newItem.modelName); }} className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black focus:ring-2 focus:ring-blue-500 h-[38px]">{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">품명</label><input type="text" list="ledger-item-suggestions" value={newItem.itemName} onChange={handleItemNameChange} placeholder="품명 입력/선택" className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black focus:ring-2 focus:ring-blue-500 h-[38px] font-bold" /><datalist id="ledger-item-suggestions">{availableItemNames.map((name, index) => <option key={index} value={name} />)}</datalist></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">모델명</label><input type="text" value={newItem.modelName} onChange={handleModelNameChange} placeholder="모델명(구분용)" className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black focus:ring-2 focus:ring-blue-500 h-[38px]" /></div>
          <div><label className="block text-xs font-bold text-blue-600 mb-1">입고</label><input type="text" value={newItem.inQty} onChange={e => handleQtyChange(e, 'inQty')} placeholder="0" className="w-full border border-blue-300 rounded px-2 py-2 text-sm bg-white text-black focus:ring-2 focus:ring-blue-500 h-[38px] text-center font-bold" /></div>
          <div><label className="block text-xs font-bold text-red-600 mb-1">사용</label><input type="text" value={newItem.outQty} onChange={e => handleQtyChange(e, 'outQty')} placeholder="0" className="w-full border border-red-300 rounded px-2 py-2 text-sm bg-white text-black focus:ring-2 focus:ring-blue-500 h-[38px] text-center font-bold" /></div>
          
          <div><label className="block text-xs font-bold text-emerald-600 mb-1">최종재고(자동)</label><input type="text" value={newItem.stockQty} readOnly className={`w-full border rounded px-2 py-2 text-sm font-bold outline-none h-[38px] text-center cursor-not-allowed ${editId ? 'border-orange-300 bg-orange-100 text-orange-800' : 'border-emerald-200 bg-emerald-100/50 text-emerald-700'}`} /></div>
          <div><label className="block text-xs font-bold text-orange-600 mb-1">적정재고</label><input type="text" value={newItem.minStock} onChange={e => handleQtyChange(e, 'minStock')} placeholder="5" className="w-full border border-orange-300 rounded px-2 py-2 text-sm bg-white text-black focus:ring-2 focus:ring-orange-500 h-[38px] text-center font-bold" /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">단위</label><input type="text" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} placeholder="EA" className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black focus:ring-2 focus:ring-blue-500 h-[38px] text-center" /></div>
          
          <div className="md:col-span-1 lg:col-span-1"><label className="block text-xs font-bold text-gray-500 mb-1">상세내역</label><input type="text" value={newItem.details} onChange={e => setNewItem({...newItem, details: e.target.value})} placeholder="규격 또는 사용처" className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white text-black focus:ring-2 focus:ring-blue-500 h-[38px]" /></div>
          <div className="md:col-span-2 lg:col-span-2"><label className="block text-xs font-bold text-gray-500 mb-1">비고</label><input type="text" value={newItem.note} onChange={e => setNewItem({...newItem, note: e.target.value})} placeholder="특이사항 입력" className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white text-black focus:ring-2 focus:ring-blue-500 h-[38px]" /></div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center space-x-3 w-full md:w-auto">
          {onBack && <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft size={16} className="text-gray-600" /></button>}
          <h2 className="text-xl font-bold text-gray-800">소모품 관리 대장</h2>
          <span className="text-sm text-gray-400 font-normal">총 {summaryItems.length}개 품목(모델구분) / {items.length}건 기록</span>
        </div>
        <div className="relative flex-1 md:w-80 w-full">
          <input type="text" placeholder="품명, 모델명, 내역 검색" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white text-black shadow-sm" />
          <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <LayoutGrid size={18} className="text-blue-600" />
          <h3 className="font-bold text-gray-700">1. 현재 재고 현황 (전체 이력 실시간 합계)</h3>
          <span className="text-[10px] text-gray-400 font-medium">* 품명과 모델명이 일치하는 모든 데이터의 (입고합계 - 사용합계) 결과입니다.</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full min-w-[1000px] border-collapse">
              <thead className="bg-blue-50 border-b border-blue-100">
                <tr>
                  <th className="px-3 py-3 text-center text-xs font-bold text-blue-600 uppercase w-12">No</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-blue-600 uppercase w-28">구분</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-blue-600 uppercase">품명 (클릭시 상세변동이력)</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-blue-600 uppercase w-48">모델명</th>
                  <th className="px-2 py-3 text-center text-xs font-bold text-emerald-600 uppercase w-28">현재재고</th>
                  <th className="px-2 py-3 text-center text-xs font-bold text-orange-600 uppercase w-20">적정재고</th>
                  <th className="px-2 py-3 text-center text-xs font-bold text-blue-600 uppercase w-16">단위</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-blue-600 uppercase w-48">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSummary.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400 italic">검색 결과가 없습니다.</td></tr>
                ) : (
                  filteredSummary.map((item, idx) => {
                    const currentStock = parseFloat(item.stockQty);
                    const minStock = parseFloat(item.minStock || '5');
                    const isLowStock = currentStock <= minStock;
                    
                    return (
                      <tr key={`summary-${item.id}`} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-3 py-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                        <td className="px-3 py-2 text-xs text-gray-600 font-bold">{item.category}</td>
                        <td className="px-3 py-2"><button onClick={() => openHistory(item.itemName, item.modelName, item.category)} className="text-blue-600 hover:text-blue-800 hover:underline text-left font-black text-sm">{item.itemName}</button></td>
                        <td className="px-3 py-2 text-xs text-gray-600 font-bold">{item.modelName || '-'}</td>
                        <td className="px-2 py-2 text-center">
                          <span className={`inline-block px-3 py-1 font-black rounded-lg text-sm ${isLowStock ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-emerald-100 text-emerald-700'}`}>
                            {item.stockQty}
                            {isLowStock && <span className="ml-1 text-[10px]">[부족]</span>}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center text-gray-500 font-bold text-xs">{item.minStock || '5'}</td>
                        <td className="px-2 py-2 text-xs text-center text-gray-500 font-bold">{item.unit}</td>
                        <td className="px-3 py-2 text-center">
                          <button 
                            onClick={() => handleNewTransaction(item)} 
                            className="flex items-center gap-1 mx-auto bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-sm transition-all font-bold text-[11px]"
                          >
                            <PlusCircle size={13} />
                            <span>입고/사용 기록추가</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4">
        <div className="flex items-center gap-2 px-1">
          <List size={18} className="text-gray-500" />
          <h3 className="font-bold text-gray-700">2. 전체 변동 내역 (전체 장부 기록)</h3>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide max-h-[600px]">
            <table className="w-full min-w-[1000px] border-collapse sticky-header">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase w-12">No</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase w-24">날짜</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase w-20">구분</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase w-40">품명</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase w-32">모델명</th>
                  <th className="px-2 py-3 text-center text-xs font-bold text-blue-600 uppercase w-16">입고</th>
                  <th className="px-2 py-3 text-center text-xs font-bold text-red-600 uppercase w-16">사용</th>
                  <th className="px-2 py-3 text-center text-xs font-bold text-emerald-600 uppercase w-20">입력재고</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase">상세내역</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 uppercase w-24 print:hidden">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-20 text-gray-400 italic">등록된 내역이 없습니다.</td></tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors group ${String(editId) === String(item.id) ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''}`}>
                      <td className="px-3 py-2 text-center text-gray-400 font-mono text-[10px]">{filteredItems.length - idx}</td>
                      <td className="px-3 py-2 text-[11px] text-gray-700 whitespace-nowrap">{item.date}</td>
                      <td className="px-3 py-2 text-[11px] text-gray-600">{item.category}</td>
                      <td className="px-3 py-2 text-[11px] font-bold text-gray-800">{item.itemName}</td>
                      <td className="px-3 py-2 text-[11px] text-gray-500 font-bold">{item.modelName}</td>
                      <td className="px-2 py-2 text-center text-[11px] text-blue-600 font-bold">{item.inQty !== '0' && item.inQty !== '' ? item.inQty : ''}</td>
                      <td className="px-2 py-2 text-center text-[11px] text-red-600 font-bold">{item.outQty !== '0' && item.outQty !== '' ? item.outQty : ''}</td>
                      <td className="px-2 py-2 text-center text-[11px] text-emerald-700 font-bold bg-emerald-50/30">{item.stockQty}</td>
                      <td className="px-3 py-2 text-[11px] text-gray-500 italic max-w-[200px] truncate">{item.details}</td>
                      <td className="px-3 py-2 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleLoadToForm(item)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="수정"><Edit2 size={16} /></button>
                          <button onClick={() => setDeleteTargetId(item.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="삭제"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
                  <p>기록 입력 순서에 상관없이 전체 흐름을 정확하게 파악할 수 있습니다.</p>
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

      {deleteTargetId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-100">
                <AlertTriangle className="text-red-500" size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">기록 삭제 확인</h3>
              <p className="text-gray-500 mb-8 leading-relaxed">
                해당 기록을 장부에서 영구히 삭제하시겠습니까?<br/>
                <span className="text-red-500 font-bold text-sm">삭제 시 재고가 다시 계산됩니다.</span>
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTargetId(null)} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors">취소</button>
                <button onClick={confirmDelete} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg">삭제 진행</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSaveConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-slate-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-100">
                <Cloud className="text-blue-600" size={36} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">서버저장 확인</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                작성하신 소모품 입출고 내역을<br/>
                서버에 안전하게 기록하시겠습니까?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center"><X size={20} className="mr-2" />취소</button>
                <button onClick={handleRegister} className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95"><CheckCircle size={20} className="mr-2" />확인</button>
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
        .sticky-header thead th { position: sticky; top: 0; background: #f9fafb; z-index: 10; border-bottom: 2px solid #e5e7eb; }
      `}</style>
    </div>
  );
};

export default ConsumablesLedger;