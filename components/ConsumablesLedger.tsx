import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ConsumableItem } from '../types';
import { fetchConsumables, saveConsumables } from '../services/dataService';
import { Trash2, Search, X, History, Save, PackagePlus, RefreshCw, Edit2, RotateCcw, CheckCircle2, PlusCircle, LayoutGrid, List, Cloud, CheckCircle, ChevronLeft, ChevronRight, PackageSearch, Lock, Plus, Printer } from 'lucide-react';
import { format } from 'date-fns';

interface ConsumablesLedgerProps {
  onBack?: () => void;
  viewMode?: 'ledger' | 'usage';
  isPopupMode?: boolean;
}

const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const CATEGORIES = [
  '전기', '기계', '소방', '공용'
];

const ITEMS_PER_PAGE = 10;

const ConsumablesLedger: React.FC<ConsumablesLedgerProps> = ({ onBack, viewMode = 'ledger', isPopupMode = false }) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ConsumableItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [saveSuccess, setSaveStatus] = useState(false);
  
  const [popupViewMode, setPopupViewMode] = useState<'ledger' | 'usage'>('ledger');
  const [currentPage, setCurrentPage] = useState(1);
  const [baseStock, setBaseStock] = useState<number>(0);
  
  // 데이터 초기화 여부를 추적하여 입력 중 초기화 방지
  const hasInitializedRef = useRef(false);

  const [newItem, setNewItem] = useState<ConsumableItem>({
    id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    category: CATEGORIES[0],
    itemName: '',
    modelName: '',
    details: '', 
    inQty: '',
    outQty: '',
    stockQty: '',
    unit: 'EA',
    note: '',    
    minStock: '5',
    isManual: false
  });

  useEffect(() => {
    loadData();

    if (isPopupMode) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      const copyName = params.get('itemName');
      const vm = params.get('viewMode') as 'ledger' | 'usage';
      
      if (vm) setPopupViewMode(vm);

      if (id && id !== 'new') {
        setEditId(id);
      } else if (copyName) {
        setNewItem(prev => ({
          ...prev,
          itemName: copyName,
          modelName: params.get('modelName') || '',
          category: params.get('category') || CATEGORIES[0],
          unit: params.get('unit') || 'EA',
          minStock: params.get('minStock') || '5',
          note: params.get('note') || '',
          date: params.get('date') || prev.date,
          isManual: params.get('isManual') === 'true',
          details: '' 
        }));
        // 여기서 바로 true를 설정하면 재고 계산 useEffect가 실행되지 않으므로 제거
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

  // 수정 모드 또는 신규 입력 시 재고 데이터 동기화
  useEffect(() => {
    if (items.length > 0 && !hasInitializedRef.current) {
      if (editId) {
        const item = items.find(i => String(i.id) === String(editId));
        if (item) {
          const currentIn = parseFloat(String(item.inQty || '0').replace(/,/g, '')) || 0;
          const currentOut = parseFloat(String(item.outQty || '0').replace(/,/g, '')) || 0;
          
          const summary = summaryItems.find(s => 
            s.category === item.category && 
            s.itemName.trim() === item.itemName.trim() && 
            (s.modelName || '').trim() === (item.modelName || '').trim()
          );
          
          const totalStock = parseFloat(summary?.stockQty || '0');
          setBaseStock(totalStock - currentIn + currentOut);
          setNewItem({ ...item });
          hasInitializedRef.current = true;
        }
      } else if (isPopupMode && newItem.itemName) {
        const summary = summaryItems.find(s => 
          s.category === newItem.category && 
          s.itemName.trim() === newItem.itemName.trim() && 
          (s.modelName || '').trim() === (newItem.modelName || '').trim()
        );
        const totalStock = parseFloat(summary?.stockQty || '0');
        setBaseStock(totalStock);
        setNewItem(prev => ({ ...prev, stockQty: totalStock.toString() }));
        hasInitializedRef.current = true;
      }
    }
  }, [editId, items.length, isPopupMode, newItem.itemName]); // newItem.itemName 의존성 추가

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

  const handleConsumablesPrint = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;

    // Use the filtered list based on the current view and search term
    let printedItems = [...processedList];

    // Ledger specific filters and sorting
    if (viewMode === 'ledger') {
      // Filter only manual items for ledger print
      printedItems = printedItems.filter(item => item.isManual);

      const getCategoryRank = (cat?: string) => {
        if (cat === '전기') return 1;
        if (cat === '기계') return 2;
        if (cat === '공용') return 3;
        return 99;
      };

      printedItems.sort((a, b) => {
        const rankA = getCategoryRank(a.category);
        const rankB = getCategoryRank(b.category);
        if (rankA !== rankB) return rankA - rankB;
        return a.itemName.localeCompare(b.itemName) || (a.modelName || '').localeCompare(b.modelName || '');
      });
    }

    const title = viewMode === 'ledger' ? '소모품관리대장목록표' : '소모품 사용내역 목록표';

    const html = `
      <html>
        <head>
          <title>${title} 인쇄</title>
          <style>
            @page { 
              size: A4 portrait; 
              margin: 15mm 10mm; 
            }
            body { 
              font-family: "Malgun Gothic", sans-serif; 
              background-color: black; 
              color: black; 
              padding: 0;
              margin: 0;
              -webkit-print-color-adjust: exact;
            }
            .no-print {
              display: flex;
              justify-content: center;
              padding: 20px;
            }
            .print-btn {
              padding: 10px 24px;
              background-color: #1e3a8a;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
              font-size: 12pt;
            }
            @media print {
              .no-print { display: none !important; }
              body { background-color: white !important; }
              .print-page { 
                box-shadow: none !important; 
                margin: 0 !important; 
                padding: 0 !important;
                width: 100% !important;
                min-height: auto !important;
              }
            }
            .print-page {
              width: 210mm;
              min-height: 297mm;
              padding: 15mm 10mm;
              margin: 20px auto;
              background-color: white;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
              box-sizing: border-box;
            }
            h1 { 
              text-align: center; 
              font-size: 24pt; 
              margin-bottom: 20px; 
              font-weight: 900;
              border-bottom: 2px solid black;
              padding-bottom: 10px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px; 
            }
            th, td { 
              border: 1px solid black; 
              padding: 6px 4px; 
              text-align: center; 
              font-size: 11px; 
              height: 30px;
            }
            th { 
              background-color: white; 
              color: black;
              font-weight: normal;
            }
            .text-left { text-align: left; padding-left: 8px; }
            .text-right { text-align: right; padding-right: 8px; }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="print-btn" onclick="window.print()">인쇄하기</button>
          </div>
          <div class="print-page">
            <table>
              <thead>
                <tr>
                  <th colspan="${viewMode === 'ledger' ? '5' : '9'}" style="border: none; padding: 0 0 20px 0; background-color: white;">
                    <h1 style="margin: 0; border-bottom: 2px solid black; padding-bottom: 10px; font-size: 24pt; font-weight: 900; text-align: center;">${title}</h1>
                  </th>
                </tr>
                <tr>
                  ${viewMode === 'ledger' ? `
                    <th style="width: 50px;">No</th>
                    <th style="width: 60px;">구분</th>
                    <th style="width: 180px;">품명</th>
                    <th style="width: 150px;">모델명</th>
                    <th style="width: auto;">비고</th>
                  ` : `
                    <th style="width: 40px;">No</th>
                    <th style="width: 85px;">날짜</th>
                    <th style="width: 50px;">구분</th>
                    <th style="width: 120px;">품명</th>
                    <th style="width: 110px;">모델명</th>
                    <th style="width: 40px;">입고</th>
                    <th style="width: 40px;">사용</th>
                    <th style="width: 45px;">재고</th>
                    <th style="width: auto;">상세내역</th>
                  `}
                </tr>
              </thead>
              <tbody>
                ${printedItems.length > 0 ? printedItems.map((item, index) => {
                  const globalIdx = printedItems.length - index;
                  return viewMode === 'ledger' ? `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${item.category || ''}</td>
                      <td>${item.itemName || ''}</td>
                      <td>${item.modelName || '-'}</td>
                      <td>${item.note || ''}</td>
                    </tr>
                  ` : `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${item.date || ''}</td>
                      <td>${item.category || ''}</td>
                      <td>${item.itemName || ''}</td>
                      <td class="text-left">${item.modelName || ''}</td>
                      <td>${item.inQty !== '0' && item.inQty ? item.inQty : ''}</td>
                      <td>${item.outQty !== '0' && item.outQty ? item.outQty : ''}</td>
                      <td>${item.stockQty || ''}</td>
                      <td>${item.details || ''}</td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="${viewMode === 'ledger' ? '6' : '9'}" style="height: 100px;">조회된 내역이 없습니다.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const openIndependentWindow = (id: string = 'new', initialData?: ConsumableItem) => {
    const width = 850;
    const height = 800; 
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'consumable');
    url.searchParams.set('id', id);
    url.searchParams.set('viewMode', viewMode); 
    
    if (initialData && id === 'new') {
      url.searchParams.set('itemName', initialData.itemName);
      url.searchParams.set('modelName', initialData.modelName || '');
      url.searchParams.set('category', initialData.category);
      url.searchParams.set('unit', initialData.unit || 'EA');
      url.searchParams.set('minStock', initialData.minStock || '5');
      url.searchParams.set('note', initialData.note || '');
      url.searchParams.set('date', format(new Date(), 'yyyy-MM-dd'));
      url.searchParams.set('isManual', initialData.isManual ? 'true' : 'false');
      url.searchParams.set('details', '');
    }

    window.open(
      url.toString(),
      `ConsumableWin_${id === 'new' ? 'new_' + Date.now() : id}`,
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
    let unit = 'EA'; let note = ''; let minStock = '5';
    matches.forEach(m => {
      totalIn += parseFloat(String(m.inQty || '0').replace(/,/g, '')) || 0;
      totalOut += parseFloat(String(m.outQty || '0').replace(/,/g, '')) || 0;
    });
    const latestMatch = [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    if (latestMatch) {
      unit = latestMatch.unit || 'EA';
      note = latestMatch.note || '';
      minStock = latestMatch.minStock || '5';
    }
    const currentCalculatedStock = totalIn - totalOut;
    setBaseStock(currentCalculatedStock);
    const currentIn = parseFloat(String(newItem.inQty || '0').replace(/,/g, '')) || 0;
    const currentOut = parseFloat(String(newItem.outQty || '0').replace(/,/g, '')) || 0;
    setNewItem(prev => ({
      ...prev,
      unit: latestMatch ? unit : prev.unit,
      note: latestMatch ? note : prev.note,
      minStock: latestMatch ? minStock : prev.minStock,
      stockQty: (currentCalculatedStock + currentIn - currentOut).toString(),
      details: '' 
    }));
  };

  const handleRegister = async () => {
    if (!newItem.itemName.trim()) {
      alert('품명은 필수 입력 항목입니다.');
      return;
    }
    setLoading(true);
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
        setSaveStatus(true);
        alert('성공적으로 저장되었습니다.');
        if (isPopupMode) {
          window.close();
        } else {
          setItems(newList);
          setTimeout(() => setSaveStatus(false), 2000);
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

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('해당 기록을 장부에서 영구히 삭제하시겠습니까?\n삭제 시 재고가 다시 계산됩니다.')) return;
    
    setLoading(true);
    const idStr = String(id);
    const originalItems = [...items];
    const updatedItems = originalItems.filter(i => String(i.id) !== idStr);
    
    try {
      const success = await saveConsumables(updatedItems);
      if (success) {
        setItems(updatedItems);
        alert('삭제가 완료되었습니다.');
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

  const processedList = useMemo(() => {
    if (viewMode === 'usage' && !searchTerm.trim()) {
      return [];
    }

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

  const totalPages = Math.max(1, Math.ceil(processedList.length / ITEMS_PER_PAGE));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedList.slice(start, start + ITEMS_PER_PAGE);
  }, [processedList, currentPage]);

  const visiblePageNumbers = useMemo(() => {
    const halfWindow = 2;
    let startPage = Math.max(1, currentPage - halfWindow);
    const endPage = Math.min(totalPages, startPage + 4);
    if (endPage === totalPages) startPage = Math.max(1, endPage - 4);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) if (i > 0) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  const thClass = "bg-white border-b border-r border-black text-center text-[13px] font-normal text-black p-0 h-[40px]";
  const tdClass = "border-b border-r border-black text-center text-[13px] font-normal text-black p-0 h-[40px]";
  const inputClass = "bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal text-center w-full h-full px-2";
  const cellDivClass = "flex items-center justify-center h-full px-2 text-[13px] font-normal";
  const cellDivLeftClass = "flex items-center justify-start h-full px-2 text-[13px] font-normal";

  if (isPopupMode) {
    const currentActiveMode = isPopupMode ? popupViewMode : viewMode;
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col animate-fade-in">
          <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${editId ? 'bg-orange-600' : 'bg-blue-600'}`}>
                {editId ? <Edit2 size={20} className="text-white" /> : <PackagePlus size={20} className="text-white" />}
              </div>
              <span className="font-black text-lg">{editId ? '소모품 정보 수정' : currentActiveMode === 'ledger' ? '소모품 등록/수정' : '소모품 사용/입고 등록'}</span>
            </div>
            <button onClick={() => window.close()} className="p-1 hover:bg-white/20 rounded-full transition-colors text-white">
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
                <input type="text" value={newItem.itemName} onChange={handleItemNameChange} placeholder="품명 입력" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500" />
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

            <div className="space-y-4">
              {currentActiveMode === 'ledger' && (
                <div>
                  <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">비고 (자재 규격 등)</label>
                  <input type="text" value={newItem.note} onChange={e => setNewItem({...newItem, note: e.target.value})} placeholder="자재 특징, 정규 규격 등 입력" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              {currentActiveMode === 'usage' && (
                <div>
                  <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">상세내역 (사용 장소/사유)</label>
                  <textarea value={newItem.details} onChange={e => setNewItem({...newItem, details: e.target.value})} placeholder="사용 장소, 작업 내용 등 구체적인 사유 입력" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none h-12" />
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="isManualCheck" 
                  checked={newItem.isManual || false} 
                  onChange={e => setNewItem({...newItem, isManual: e.target.checked})} 
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isManualCheck" className="text-sm font-bold text-gray-700 cursor-pointer">수기작업</label>
              </div>
            </div>
          </div>

          <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-4">
            <button onClick={() => window.close()} className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all hover:bg-slate-100 active:scale-95">취소 후 닫기</button>
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
    <div className="space-y-2">
      {/* 툴바 */}
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
        <div className="flex items-stretch shrink-0">
          <div className="relative w-full sm:w-[250px] flex items-center bg-white border-none rounded-none">
            <input 
              type="text" 
              placeholder="품명, 모델명, 상세내역 검색" 
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
              className="shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent disabled:opacity-50 text-gray-500 hover:text-black transition-colors whitespace-nowrap relative"
            >
              <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
            <button 
              onClick={() => {
                let initialData;
                if (viewMode === 'usage') {
                  if (processedList.length > 0) {
                    initialData = processedList[0];
                  } else if (searchTerm.trim()) {
                    initialData = { itemName: searchTerm.trim() } as any;
                  }
                }
                openIndependentWindow('new', initialData);
              }}
              className="shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent text-gray-500 hover:text-black transition-colors whitespace-nowrap relative"
            >
              <Plus size={18} className="mr-1.5" /> {viewMode === 'ledger' ? '등록' : '사용'}
            </button>
            <button 
              onClick={handleConsumablesPrint}
              className="shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent text-gray-500 hover:text-black transition-colors whitespace-nowrap relative"
            >
              <Printer size={18} className="mr-1.5" /> 인쇄
            </button>
          </div>
        </div>
      </div>

      {/* 리스트 */}
      <div className="bg-white border-t border-l border-black max-w-7xl mx-auto overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[1000px] border-collapse text-center">
            <thead>
              {viewMode === 'ledger' ? (
                <tr className="h-[40px]">
                  <th className={`${thClass} w-[56px]`}><div className={cellDivClass}>No</div></th>
                  <th className={`${thClass} w-[56px]`}><div className={cellDivClass}>구분</div></th>
                  <th className={`${thClass} w-[180px]`}><div className={cellDivClass}>품명</div></th>
                  <th className={`${thClass} w-[140px]`}><div className={cellDivClass}>모델명</div></th>
                  <th className={`${thClass} w-[76px]`}><div className={cellDivClass}>현재재고</div></th>
                  <th className={`${thClass} w-[76px]`}><div className={cellDivClass}>적정재고</div></th>
                  <th className={`${thClass} w-[76px]`}><div className={cellDivClass}>단위</div></th>
                  <th className={`${thClass} w-[180px]`}><div className={cellDivClass}>비고</div></th>
                  <th className={`${thClass} w-[56px]`}><div className={cellDivClass}>수기</div></th>
                  <th className={`${thClass} w-[104px] print:hidden`}><div className={cellDivClass}>관리</div></th>
                </tr>
              ) : (
                <tr className="h-[40px]">
                  <th className={`${thClass} w-[56px]`}><div className={cellDivClass}>No</div></th>
                  <th className={`${thClass} w-[120px]`}><div className={cellDivClass}>날짜</div></th>
                  <th className={`${thClass} w-[56px]`}><div className={cellDivClass}>구분</div></th>
                  <th className={`${thClass} w-[180px]`}><div className={cellDivClass}>품명</div></th>
                  <th className={`${thClass} w-[140px]`}><div className={cellDivClass}>모델명</div></th>
                  <th className={`${thClass} w-[36px]`}><div className={cellDivClass}>입고</div></th>
                  <th className={`${thClass} w-[36px]`}><div className={cellDivClass}>사용</div></th>
                  <th className={`${thClass} w-[36px]`}><div className={cellDivClass}>재고</div></th>
                  <th className={`${thClass} w-[180px]`}><div className={cellDivClass}>상세내역</div></th>
                  <th className={`${thClass} w-[56px]`}><div className={cellDivClass}>수기</div></th>
                  <th className={`${thClass} w-[104px] print:hidden`}><div className={cellDivClass}>관리</div></th>
                </tr>
              )}
            </thead>
            <tbody>
              {processedList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="h-[100px] text-center text-[13px] text-black italic font-normal border-b border-r border-black">
                    {viewMode === 'usage' && !searchTerm.trim() ? '상단 검색창에 품명을 입력하면 내역이 표시됩니다.' : '내역이 없습니다.'}
                  </td>
                </tr>
              ) : viewMode === 'ledger' ? (
                paginatedList.map((item, idx) => {
                  const globalIdx = processedList.length - ((currentPage - 1) * ITEMS_PER_PAGE + idx);
                  const currentStock = parseFloat(item.stockQty);
                  const minStock = parseFloat(item.minStock || '5');
                  const isLowStock = currentStock <= minStock;
                  return (
                    <tr key={`summary-${item.id}`} className="hover:bg-blue-50/30 transition-colors text-center h-[40px]">
                      <td className={tdClass}><div className={cellDivClass}>{globalIdx}</div></td>
                      <td className={`${tdClass} text-blue-600`}><div className={cellDivClass}>{item.category}</div></td>
                      <td className={tdClass}><div className={cellDivClass}>{item.itemName}</div></td>
                      <td className={tdClass}><div className={cellDivClass}>{item.modelName || '-'}</div></td>
                      <td className={tdClass}>
                        <div className={cellDivClass}>
                          <span className={`inline-block px-2 py-0.5 font-normal rounded text-[11px] ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {item.stockQty}
                          </span>
                        </div>
                      </td>
                      <td className={tdClass}><div className={cellDivClass}>{item.minStock || '5'}</div></td>
                      <td className={tdClass}><div className={cellDivClass}>{item.unit}</div></td>
                      <td className={`${tdClass} text-left`}><div className={`${cellDivLeftClass} italic text-gray-500`}>{item.note}</div></td>
                      <td className={tdClass}><div className={cellDivClass}>{item.isManual ? 'O' : ''}</div></td>
                      <td className={`${tdClass} print:hidden`}>
                        <div className="flex items-center justify-center gap-1 h-full px-2">
                          <button onClick={() => openIndependentWindow(item.id)} className="p-1 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded transition-all" title="수정"><Edit2 size={14} /></button>
                          <button onClick={() => handleDeleteItem(item.id)} className="p-1 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded transition-all" title="삭제"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                paginatedList.map((item, idx) => {
                  const globalIdx = processedList.length - ((currentPage - 1) * ITEMS_PER_PAGE + idx);
                  return (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors text-center h-[40px]">
                      <td className={tdClass}><div className={cellDivClass}>{globalIdx}</div></td>
                      <td className={tdClass}><div className={cellDivClass}>{item.date}</div></td>
                      <td className={`${tdClass} text-blue-600`}><div className={cellDivClass}>{item.category}</div></td>
                      <td className={tdClass}><div className={cellDivClass}>{item.itemName}</div></td>
                      <td className={tdClass}><div className={cellDivClass}>{item.modelName}</div></td>
                      <td className={`${tdClass} text-blue-600`}><div className={cellDivClass}>{item.inQty !== '0' && item.inQty !== '' ? item.inQty : ''}</div></td>
                      <td className={`${tdClass} text-red-600`}><div className={cellDivClass}>{item.outQty !== '0' && item.outQty !== '' ? item.outQty : ''}</div></td>
                      <td className={`${tdClass} text-emerald-700`}><div className={cellDivClass}>{item.stockQty}</div></td>
                      <td className={`${tdClass} text-left`}><div className={cellDivLeftClass + " italic text-gray-500"}>{item.details}</div></td>
                      <td className={tdClass}><div className={cellDivClass}>{item.isManual ? 'O' : ''}</div></td>
                      <td className={`${tdClass} print:hidden`}>
                        <div className="flex items-center justify-center gap-1 h-full px-2">
                          <button onClick={() => openIndependentWindow(item.id)} className="p-1 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded transition-all" title="수정"><Edit2 size={14} /></button>
                          <button onClick={() => handleDeleteItem(item.id)} className="p-1 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded transition-all" title="삭제"><Trash2 size={14} /></button>
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

      {/* 페이지네이션 - 미니멀 텍스트 스타일 */}
      <div className="flex items-center justify-center gap-2 py-4 print:hidden">
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="p-2 bg-transparent border-none text-black disabled:text-gray-300 disabled:cursor-not-allowed transition-all active:scale-90 shadow-none cursor-pointer"
        >
          <ChevronLeft size={18} />
        </button>
        
        <div className="flex items-center gap-2">
          {totalPages <= 1 ? (
            <button className="w-9 h-9 bg-transparent border-none text-black font-bold scale-110 cursor-default flex items-center justify-center">
              <span className="text-[13px]">1</span>
            </button>
          ) : (
            visiblePageNumbers.map(pageNum => (
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
            ))
          )}
        </div>

        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages || totalPages <= 1}
          className="p-2 bg-transparent border-none text-black disabled:text-gray-300 disabled:cursor-not-allowed transition-all active:scale-90 shadow-none cursor-pointer"
        >
          <ChevronRight size={18} />
        </button>
      </div>

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