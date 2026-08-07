import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ConsumableItem } from '../types';
import { fetchConsumables, saveConsumables } from '../services/dataService';
import { Trash2, Search, X, History, Save, PackagePlus, RefreshCw, Edit2, RotateCcw, CheckCircle2, PlusCircle, LayoutGrid, List, Cloud, CheckCircle, ChevronLeft, ChevronRight, PackageSearch, Lock, Plus, Printer, Check } from 'lucide-react';
import { format } from 'date-fns';

interface ConsumablesLedgerProps {
  onBack?: () => void;
  viewMode?: 'ledger' | 'usage';
  isPopupMode?: boolean;
}

const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const CATEGORIES = [
  '전기', '기계', '소방', '주차', '미화', '공용'
];

const ITEMS_PER_PAGE = 10;

const ConsumablesLedger: React.FC<ConsumablesLedgerProps> = ({ onBack, viewMode = 'ledger', isPopupMode = false }) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ConsumableItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
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
    isManual: false,
    isDiscontinued: false
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
          isDiscontinued: params.get('isDiscontinued') === 'true',
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
        const idx = CATEGORIES.indexOf(cat || '');
        return idx !== -1 ? idx : 999;
      };

      printedItems.sort((a, b) => {
        const rankA = getCategoryRank(a.category);
        const rankB = getCategoryRank(b.category);
        if (rankA !== rankB) return rankA - rankB;
        if (a.isManual !== b.isManual) return a.isManual ? -1 : 1;
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
              width: 99%; 
              margin-left: auto;
              margin-right: auto;
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
                    <th style="width: 80px;">코드</th>
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
                  
                  // 분류별 코드 계산 (전기-01, 기계-01 등)
                  let categoryCode = '';
                  if (viewMode === 'ledger') {
                    const itemsInCategory = printedItems.filter(s => s.category === item.category);
                    const indexInCategory = itemsInCategory.indexOf(item);
                    categoryCode = `${item.category}-${String(indexInCategory + 1).padStart(2, '0')}`;
                  }
                  
                  return viewMode === 'ledger' ? `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${categoryCode}</td>
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

  const openIndependentWindow = (id: string = 'new', initialData?: ConsumableItem, targetViewMode?: 'ledger' | 'usage') => {
    const width = 880;
    const height = 850; 
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'consumable');
    url.searchParams.set('id', id);
    url.searchParams.set('viewMode', targetViewMode || viewMode); 
    
    if (initialData && id === 'new') {
      url.searchParams.set('itemName', initialData.itemName);
      url.searchParams.set('modelName', initialData.modelName || '');
      url.searchParams.set('category', initialData.category);
      url.searchParams.set('unit', initialData.unit || 'EA');
      url.searchParams.set('minStock', initialData.minStock || '5');
      url.searchParams.set('note', initialData.note || '');
      url.searchParams.set('date', format(new Date(), 'yyyy-MM-dd'));
      url.searchParams.set('isManual', initialData.isManual ? 'true' : 'false');
      url.searchParams.set('isDiscontinued', initialData.isDiscontinued ? 'true' : 'false');
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
    })).sort((a, b) => {
      const idxA = CATEGORIES.indexOf(a.category);
      const idxB = CATEGORIES.indexOf(b.category);
      if (idxA !== idxB) return idxA - idxB;
      if (a.isManual !== b.isManual) return a.isManual ? -1 : 1;
      return a.itemName.localeCompare(b.itemName) || (a.modelName || '').localeCompare(b.modelName || '');
    });
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

  const handleAddToList = () => {
    if (!newItem.itemName.trim()) {
      alert('품명은 필수 입력 항목입니다.');
      return;
    }

    const inVal = parseFloat(String(newItem.inQty || '0').replace(/,/g, '')) || 0;
    const outVal = parseFloat(String(newItem.outQty || '0').replace(/,/g, '')) || 0;

    if (inVal === 0 && outVal === 0 && !newItem.details?.trim() && !newItem.note?.trim()) {
      alert('입고량, 사용량 또는 상세내역을 입력해주세요.');
      return;
    }

    const newItemToAdd: ConsumableItem = {
      ...newItem,
      id: editId || generateId(),
      inQty: newItem.inQty || '0',
      outQty: newItem.outQty || '0',
      itemName: newItem.itemName.trim(),
      modelName: (newItem.modelName || '').trim(),
      minStock: newItem.minStock || '5',
      isManual: !!newItem.isManual,
      isDiscontinued: !!newItem.isDiscontinued,
      details: newItem.details || '',
      note: newItem.note || ''
    };

    let updatedList = [...items];
    if (editId) {
      const idx = updatedList.findIndex(i => String(i.id) === String(editId));
      if (idx >= 0) {
        updatedList[idx] = newItemToAdd;
      } else {
        updatedList = [newItemToAdd, ...updatedList];
      }
    } else {
      updatedList = [newItemToAdd, ...updatedList];
    }

    // 동일 품목 입출고에 따른 재고 자동 계산
    const targetCategory = newItemToAdd.category;
    const targetItemName = newItemToAdd.itemName;
    const targetModelName = newItemToAdd.modelName;

    const groupItems = updatedList
      .filter(
        i =>
          i.category === targetCategory &&
          (i.itemName || '').trim() === targetItemName &&
          (i.modelName || '').trim() === targetModelName
      )
      .sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return updatedList.indexOf(b) - updatedList.indexOf(a);
      });

    let runningStock = 0;
    const updatedStockMap = new Map<string, string>();
    groupItems.forEach(item => {
      const itemIn = parseFloat(String(item.inQty || '0').replace(/,/g, '')) || 0;
      const itemOut = parseFloat(String(item.outQty || '0').replace(/,/g, '')) || 0;
      runningStock = runningStock + itemIn - itemOut;
      updatedStockMap.set(String(item.id), runningStock.toString());
    });

    const finalUpdatedList = updatedList.map(item => {
      if (updatedStockMap.has(String(item.id))) {
        return {
          ...item,
          stockQty: updatedStockMap.get(String(item.id)) || item.stockQty
        };
      }
      return item;
    });

    setItems(finalUpdatedList);

    setBaseStock(runningStock);
    setEditId(null);
    setNewItem(prev => ({
      ...prev,
      inQty: '',
      outQty: '',
      details: '',
      stockQty: runningStock.toString()
    }));

    alert('이전 사용/입고 내역 리스트에 등록되었습니다.\n(※ 최종 저장하려면 하단의 [서버에 데이터 저장] 버튼을 누르세요)');
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      let listToSave = [...items];

      // 현재 입력 폼에 등록되지 않은 입고/사용/상세내역 데이터가 남아있다면 자동으로 포함
      const currentIn = parseFloat(String(newItem.inQty || '0').replace(/,/g, '')) || 0;
      const currentOut = parseFloat(String(newItem.outQty || '0').replace(/,/g, '')) || 0;

      if (newItem.itemName.trim() && (currentIn > 0 || currentOut > 0 || (newItem.details && newItem.details.trim()))) {
        const itemToSave: ConsumableItem = {
          ...newItem,
          id: editId || generateId(),
          inQty: newItem.inQty || '0',
          outQty: newItem.outQty || '0',
          itemName: newItem.itemName.trim(),
          modelName: (newItem.modelName || '').trim(),
          minStock: newItem.minStock || '5',
          isManual: !!newItem.isManual,
          isDiscontinued: !!newItem.isDiscontinued
        };

        if (editId) {
          const targetIndex = listToSave.findIndex(i => String(i.id) === String(editId));
          if (targetIndex >= 0) {
            listToSave[targetIndex] = itemToSave;
          } else {
            listToSave = [itemToSave, ...listToSave];
          }
        } else {
          listToSave = [itemToSave, ...listToSave];
        }
      }

      if (listToSave.length === 0) {
        alert('저장할 내역이 없습니다.');
        setLoading(false);
        return;
      }

      const success = await saveConsumables(listToSave);
      if (success) {
        if (window.opener) {
          window.opener.postMessage({ type: 'CONSUMABLE_SAVED' }, '*');
        }
        setSaveStatus(true);
        alert('성공적으로 서버에 저장되었습니다.');
        if (isPopupMode) {
          window.close();
        } else {
          setItems(listToSave);
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
    if (viewMode === 'usage' && !searchTerm.trim() && selectedCategory === '전체') {
      return [];
    }

    let list = [];
    if (viewMode === 'ledger') {
      list = summaryItems.filter(item => 
        (item.itemName || '').includes(searchTerm) || 
        (item.modelName || '').includes(searchTerm)
      );
    } else {
      list = items.filter(item => 
        (item.itemName || '').includes(searchTerm) || 
        (item.details || '').includes(searchTerm) || 
        (item.modelName || '').includes(searchTerm)
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    if (selectedCategory !== '전체') {
      list = list.filter(item => item.category === selectedCategory);
    }

    return list;
  }, [items, summaryItems, searchTerm, selectedCategory, viewMode]);

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

  const itemHistoryList = useMemo(() => {
    if (!newItem.itemName || !newItem.itemName.trim()) return [];
    return items.filter(
      i => i.category === newItem.category &&
      (i.itemName || '').trim() === newItem.itemName.trim() &&
      (i.modelName || '').trim() === (newItem.modelName || '').trim()
    ).sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return items.indexOf(a) - items.indexOf(b);
    });
  }, [items, newItem.category, newItem.itemName, newItem.modelName]);

  const [historyPage, setHistoryPage] = useState(1);
  const historyItemsPerPage = 10;

  useEffect(() => {
    setHistoryPage(1);
  }, [newItem.itemName, newItem.modelName, newItem.category]);

  const totalHistoryPages = Math.ceil(itemHistoryList.length / historyItemsPerPage) || 1;
  const paginatedHistoryList = useMemo(() => {
    const start = (historyPage - 1) * historyItemsPerPage;
    return itemHistoryList.slice(start, start + historyItemsPerPage);
  }, [itemHistoryList, historyPage]);

  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditData, setInlineEditData] = useState<{ inQty: string; outQty: string; details: string } | null>(null);

  const handleStartInlineEdit = (hist: ConsumableItem) => {
    setInlineEditId(hist.id);
    setInlineEditData({
      inQty: hist.inQty && hist.inQty !== '0' ? hist.inQty : '',
      outQty: hist.outQty && hist.outQty !== '0' ? hist.outQty : '',
      details: hist.details || hist.note || ''
    });
  };

  const handleSaveInlineEdit = async (hist: ConsumableItem) => {
    if (!inlineEditData) return;
    setLoading(true);

    const inVal = inlineEditData.inQty.replace(/[^0-9.]/g, '');
    const outVal = inlineEditData.outQty.replace(/[^0-9.]/g, '');

    const newList = items.map(item => {
      if (String(item.id) === String(hist.id)) {
        return {
          ...item,
          inQty: inVal,
          outQty: outVal,
          details: inlineEditData.details,
          note: inlineEditData.details
        };
      }
      return item;
    });

    const targetCategory = hist.category;
    const targetItemName = (hist.itemName || '').trim();
    const targetModelName = (hist.modelName || '').trim();

    const groupItems = newList
      .filter(
        i =>
          i.category === targetCategory &&
          (i.itemName || '').trim() === targetItemName &&
          (i.modelName || '').trim() === targetModelName
      )
      .sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return newList.indexOf(b) - newList.indexOf(a);
      });

    let runningStock = 0;
    const updatedStockMap = new Map<string, string>();
    groupItems.forEach(item => {
      const itemIn = parseFloat(String(item.inQty || '0').replace(/,/g, '')) || 0;
      const itemOut = parseFloat(String(item.outQty || '0').replace(/,/g, '')) || 0;
      runningStock = runningStock + itemIn - itemOut;
      updatedStockMap.set(String(item.id), runningStock.toString());
    });

    const finalUpdatedList = newList.map(item => {
      if (updatedStockMap.has(String(item.id))) {
        return {
          ...item,
          stockQty: updatedStockMap.get(String(item.id)) || item.stockQty
        };
      }
      return item;
    });

    const success = await saveConsumables(finalUpdatedList);
    if (success) {
      setItems(finalUpdatedList);
      if (window.opener) {
        window.opener.postMessage({ type: 'CONSUMABLE_SAVED' }, '*');
      }
      setInlineEditId(null);
      setInlineEditData(null);
    } else {
      alert('수정 저장에 실패했습니다.');
    }
    setLoading(false);
  };

  const handleEditHistoryItem = (hist: ConsumableItem) => {
    setEditId(hist.id);
    const currentIn = parseFloat(String(hist.inQty || '0').replace(/,/g, '')) || 0;
    const currentOut = parseFloat(String(hist.outQty || '0').replace(/,/g, '')) || 0;

    const summary = summaryItems.find(s => 
      s.category === hist.category && 
      s.itemName.trim() === hist.itemName.trim() && 
      (s.modelName || '').trim() === (hist.modelName || '').trim()
    );

    const totalStock = parseFloat(summary?.stockQty || '0');
    setBaseStock(totalStock - currentIn + currentOut);
    setNewItem({ ...hist });
    hasInitializedRef.current = true;
  };

  const handleHistoryPrint = () => {
    if (!newItem.itemName) {
      alert('품명을 먼저 입력해주세요.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=950,height=900');
    if (!printWindow) {
      alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
      return;
    }

    const historyHtml = itemHistoryList.map((hist, index) => `
      <tr style="height: 32px; text-align: center;">
        <td style="border: 1px solid #cbd5e1; padding: 4px;">${itemHistoryList.length - index}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4px; font-weight: bold;">${hist.date}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4px; font-weight: bold; color: #2563eb;">${hist.inQty && hist.inQty !== '0' ? hist.inQty : '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4px; font-weight: bold; color: #e11d48;">${hist.outQty && hist.outQty !== '0' ? hist.outQty : '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4px; font-weight: bold; color: #047857;">${hist.stockQty || '0'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4px 8px; text-align: left;">${hist.details || hist.note || '-'}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>소모품 사용 및 입고 내역서 미리보기 - ${newItem.itemName}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
            background-color: #000000;
            color: #1e293b;
            margin: 0;
            padding: 20px 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            -webkit-print-color-adjust: exact;
          }
          .no-print-bar {
            width: 210mm;
            background-color: #1e293b;
            color: #ffffff;
            padding: 12px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          }
          .no-print-bar .title {
            font-size: 15px;
            font-weight: bold;
            color: #f8fafc;
          }
          .no-print-bar .btn-group {
            display: flex;
            gap: 8px;
          }
          .btn-print {
            padding: 8px 18px;
            background-color: #2563eb;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
          }
          .btn-print:hover { background-color: #1d4ed8; }
          .btn-close {
            padding: 8px 14px;
            background-color: #475569;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
          }
          .btn-close:hover { background-color: #334155; }
          .a4-paper {
            width: 210mm;
            min-height: 297mm;
            background-color: #ffffff;
            padding: 20mm 15mm;
            box-shadow: 0 10px 30px rgba(0,0,0,0.7);
            border-radius: 2px;
          }
          .doc-title {
            text-align: center;
            font-size: 22px;
            font-weight: 900;
            margin-bottom: 24px;
            text-decoration: underline;
            letter-spacing: 1px;
            color: #0f172a;
          }
          .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .info-table th {
            background-color: #f1f5f9;
            border: 1px solid #94a3b8;
            padding: 8px 10px;
            font-size: 13px;
            width: 15%;
            text-align: center;
            color: #334155;
          }
          .info-table td {
            border: 1px solid #94a3b8;
            padding: 8px 10px;
            font-size: 13px;
            font-weight: bold;
            width: 35%;
            color: #0f172a;
          }
          .list-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          .list-table th {
            background-color: #e2e8f0;
            border: 1px solid #94a3b8;
            padding: 8px 4px;
            font-weight: bold;
            text-align: center;
            color: #1e293b;
          }
          .header-flex {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 8px;
          }
          .print-date {
            font-size: 11px;
            color: #64748b;
          }
          @media print {
            body {
              background-color: #ffffff !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .no-print-bar {
              display: none !important;
            }
            .a4-paper {
              width: 100% !important;
              min-height: auto !important;
              padding: 0 !important;
              box-shadow: none !important;
              border-radius: 0 !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div class="title">📄 소모품 사용 및 입고 내역서 미리보기</div>
          <div class="btn-group">
            <button class="btn-print" onclick="window.print()">🖨️ 바로 인쇄하기</button>
            <button class="btn-close" onclick="window.close()">창닫기</button>
          </div>
        </div>

        <div class="a4-paper">
          <div class="doc-title">소모품 사용 및 입고 내역서</div>
          
          <table class="info-table">
            <tr>
              <th>구 분</th>
              <td>${newItem.category || '-'}</td>
              <th>품 명</th>
              <td>${newItem.itemName}</td>
            </tr>
            <tr>
              <th>규격/모델명</th>
              <td>${newItem.modelName || '-'}</td>
              <th>단 위</th>
              <td>${newItem.unit || 'EA'}</td>
            </tr>
            <tr>
              <th>현재 재고</th>
              <td style="color: #047857;">${newItem.stockQty || '0'}</td>
              <th>총 내역 건수</th>
              <td>${itemHistoryList.length}건</td>
            </tr>
          </table>

          <div class="header-flex">
            <span style="font-weight: bold; font-size: 14px; color: #0f172a;">■ 입고 및 사용 세부 이력 목록</span>
            <span class="print-date">출력일자: ${format(new Date(), 'yyyy-MM-dd HH:mm')}</span>
          </div>

          <table class="list-table">
            <thead>
              <tr>
                <th style="width: 40px;">No</th>
                <th style="width: 90px;">일자</th>
                <th style="width: 60px;">입고량</th>
                <th style="width: 60px;">사용량</th>
                <th style="width: 60px;">재고</th>
                <th>상세내역 (사용 장소 및 사유)</th>
              </tr>
            </thead>
            <tbody>
              ${itemHistoryList.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding: 20px; border:1px solid #94a3b8;">등록된 내역이 없습니다.</td></tr>' : historyHtml}
            </tbody>
          </table>
        </div>

        <script>
          window.focus();
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

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
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="isManualCheck" 
                      checked={newItem.isManual || false} 
                      onChange={e => setNewItem({...newItem, isManual: e.target.checked})} 
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="isManualCheck" className="text-sm font-bold text-gray-700 cursor-pointer">수기작업</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="isDiscontinuedCheck" 
                      checked={newItem.isDiscontinued || false} 
                      onChange={e => setNewItem({...newItem, isDiscontinued: e.target.checked})} 
                      className="w-4 h-4 text-rose-600 bg-gray-100 border-gray-300 rounded focus:ring-rose-500"
                    />
                    <label htmlFor="isDiscontinuedCheck" className="text-sm font-bold text-rose-700 cursor-pointer">사용안함 (자재신청 미연동)</label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddToList}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm shadow-md transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
                  title="이전 사용/입고 내역 목록에 등록 (서버 저장은 하단의 [서버에 데이터 저장] 버튼 클릭)"
                >
                  <PlusCircle size={18} />
                  리스트등록 (이전사용/입고내역에 등록)
                </button>
              </div>
            </div>

            {newItem.itemName.trim() && (
              <div className="mt-6 pt-6 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <History size={16} className="text-blue-600" />
                    [{newItem.itemName}{newItem.modelName ? ` (${newItem.modelName})` : ''}] 이전 사용 / 입고 내역 ({itemHistoryList.length}건)
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleHistoryPrint}
                      className="px-3 py-1 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors flex items-center gap-1.5 shadow-2xs"
                      title="사용 및 입고 내역 인쇄"
                    >
                      <Printer size={13} />
                      사용내역 인쇄
                    </button>
                    <span className="text-[11px] font-bold text-slate-400">최근순 정렬</span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold h-9">
                        <th className="py-2 px-2 border-r border-slate-200 w-12">No</th>
                        <th className="py-2 px-2 border-r border-slate-200 w-24">일자</th>
                        <th className="py-2 px-2 border-r border-slate-200 w-16 text-blue-600">입고</th>
                        <th className="py-2 px-2 border-r border-slate-200 w-16 text-rose-600">사용</th>
                        <th className="py-2 px-2 border-r border-slate-200 w-16 text-emerald-700">재고</th>
                        <th className="py-2 px-3 border-r border-slate-200 text-left">상세내역 (사용 장소/사유)</th>
                        <th className="py-2 px-2 w-28 text-center">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemHistoryList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400 font-medium">
                            등록된 이전 사용 및 입고 내역이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        paginatedHistoryList.map((hist, index) => {
                          const itemIndex = itemHistoryList.length - ((historyPage - 1) * historyItemsPerPage + index);
                          const isEditingInline = inlineEditId === hist.id;
                          return (
                            <tr key={hist.id} className={`border-b border-slate-100 transition-colors h-10 ${isEditingInline ? 'bg-amber-50/90 font-medium' : 'hover:bg-blue-50/40'}`}>
                              <td className="py-1.5 px-2 border-r border-slate-100 text-slate-400">{itemIndex}</td>
                              <td className="py-1.5 px-2 border-r border-slate-100 font-bold text-slate-700">{hist.date}</td>
                              
                              {/* 입고 수량 */}
                              <td className="py-1.5 px-2 border-r border-slate-100 font-black text-blue-600">
                                {isEditingInline ? (
                                  <input
                                    type="text"
                                    value={inlineEditData?.inQty || ''}
                                    onChange={e => setInlineEditData(prev => prev ? { ...prev, inQty: e.target.value } : null)}
                                    placeholder="0"
                                    className="w-14 px-1 py-0.5 border border-blue-400 rounded text-center text-xs font-black text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                  />
                                ) : (
                                  hist.inQty && hist.inQty !== '0' ? hist.inQty : '-'
                                )}
                              </td>

                              {/* 사용 수량 */}
                              <td className="py-1.5 px-2 border-r border-slate-100 font-black text-rose-600">
                                {isEditingInline ? (
                                  <input
                                    type="text"
                                    value={inlineEditData?.outQty || ''}
                                    onChange={e => setInlineEditData(prev => prev ? { ...prev, outQty: e.target.value } : null)}
                                    placeholder="0"
                                    className="w-14 px-1 py-0.5 border border-rose-400 rounded text-center text-xs font-black text-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                                  />
                                ) : (
                                  hist.outQty && hist.outQty !== '0' ? hist.outQty : '-'
                                )}
                              </td>

                              {/* 재고 수량 */}
                              <td className="py-1.5 px-2 border-r border-slate-100 font-bold text-emerald-700">
                                {hist.stockQty}
                              </td>

                              {/* 상세내역 */}
                              <td className="py-1.5 px-3 border-r border-slate-100 text-left text-slate-600 italic">
                                {isEditingInline ? (
                                  <input
                                    type="text"
                                    value={inlineEditData?.details || ''}
                                    onChange={e => setInlineEditData(prev => prev ? { ...prev, details: e.target.value } : null)}
                                    placeholder="상세내역 (사용 장소/사유)"
                                    className="w-full px-2 py-0.5 border border-slate-300 rounded text-left text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                  />
                                ) : (
                                  <span className="truncate max-w-[180px] block">{hist.details || hist.note || '-'}</span>
                                )}
                              </td>

                              {/* 관리 컬럼: 아이콘 전용 버튼 */}
                              <td className="py-1.5 px-2 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {isEditingInline ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveInlineEdit(hist)}
                                        className="p-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded transition-all shadow-xs"
                                        title="수정 완료"
                                      >
                                        <Check size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => { setInlineEditId(null); setInlineEditData(null); }}
                                        className="p-1.5 bg-slate-200 text-slate-600 hover:bg-slate-300 rounded transition-all"
                                        title="취소"
                                      >
                                        <X size={13} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleStartInlineEdit(hist)}
                                        className="p-1.5 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white rounded transition-all shadow-xs"
                                        title="수정"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteItem(hist.id)}
                                        className="p-1.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-600 hover:text-white rounded transition-all shadow-xs"
                                        title="삭제"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 10개 항목당 페이지네이션 */}
                {totalHistoryPages > 1 && (
                  <div className="flex items-center justify-between pt-2 px-1">
                    <span className="text-[11px] font-medium text-slate-500">
                      총 {itemHistoryList.length}개 중 {((historyPage - 1) * historyItemsPerPage) + 1}-{Math.min(historyPage * historyItemsPerPage, itemHistoryList.length)} 표시
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                        disabled={historyPage === 1}
                        className="px-2 py-1 rounded border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center gap-0.5"
                      >
                        <ChevronLeft size={13} />
                        이전
                      </button>
                      <span className="px-2.5 text-xs font-black text-slate-700">
                        {historyPage} / {totalHistoryPages} 페이지
                      </span>
                      <button
                        type="button"
                        onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                        disabled={historyPage === totalHistoryPages}
                        className="px-2 py-1 rounded border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center gap-0.5"
                      >
                        다음
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
          <div className="relative w-full sm:w-[220px] flex items-center bg-white border-none rounded-none">
            <input 
              type="text" 
              placeholder="검색어 입력" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-10 pr-4 py-3 border-none text-[14px] font-bold bg-white text-black outline-none transition-all" 
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black" size={18} />
          </div>

          <div className="flex items-center shrink-0 px-2">
            <div className="w-[1px] h-6 bg-black"></div>
          </div>

          <div className="flex items-stretch shrink-0 bg-white">
            {['전체', ...CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setCurrentPage(1);
                }}
                className={`relative px-4 py-3 text-[14px] font-bold transition-all whitespace-nowrap ${
                  selectedCategory === cat 
                    ? 'text-orange-600' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {cat}
                {selectedCategory === cat && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600"></div>
                )}
              </button>
            ))}
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
                  <th className={`${thClass} w-[80px]`}><div className={cellDivClass}>코드</div></th>
                  <th className={`${thClass} w-[56px]`}><div className={cellDivClass}>구분</div></th>
                  <th className={`${thClass} w-[180px]`}><div className={cellDivClass}>품명</div></th>
                  <th className={`${thClass} w-[140px]`}><div className={cellDivClass}>모델명</div></th>
                  <th className={`${thClass} w-[76px]`}><div className={cellDivClass}>현재재고</div></th>
                  <th className={`${thClass} w-[76px]`}><div className={cellDivClass}>적정재고</div></th>
                  <th className={`${thClass} w-[76px]`}><div className={cellDivClass}>단위</div></th>
                  <th className={`${thClass} w-[180px]`}><div className={cellDivClass}>비고</div></th>
                  <th className={`${thClass} w-[56px]`}><div className={cellDivClass}>수기</div></th>
                  <th className={`${thClass} w-[140px] print:hidden`}><div className={cellDivClass}>관리</div></th>
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
                  
                  // 분류별 코드 계산 (전기-01, 기계-01 등)
                  const itemsInCategory = summaryItems.filter(s => s.category === item.category);
                  const indexInCategory = itemsInCategory.findIndex(s => s.id === item.id);
                  const categoryCode = `${item.category}-${String(indexInCategory + 1).padStart(2, '0')}`;
                  
                  const currentStock = parseFloat(item.stockQty);
                  const minStock = parseFloat(item.minStock || '5');
                  const isLowStock = currentStock <= minStock;
                  return (
                    <tr key={`summary-${item.id}`} className="hover:bg-blue-50/30 transition-colors text-center h-[40px]">
                      <td className={tdClass}><div className={cellDivClass}>{globalIdx}</div></td>
                      <td className={tdClass}><div className={cellDivClass}>{categoryCode}</div></td>
                      <td className={`${tdClass} text-blue-600`}><div className={cellDivClass}>{item.category}</div></td>
                      <td className={tdClass}>
                        <div className={cellDivClass}>
                          <span>{item.itemName}</span>
                          {item.isDiscontinued && (
                            <span className="ml-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1 py-0.5 rounded">미연동</span>
                          )}
                        </div>
                      </td>
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
                        <div className="flex items-center justify-center gap-1.5 h-full px-1">
                          <button 
                            onClick={() => openIndependentWindow('new', item, 'usage')} 
                            className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-600 hover:text-white rounded text-[11px] font-bold transition-all flex items-center gap-0.5 shadow-2xs" 
                            title="사용 및 입고 등록"
                          >
                            <Plus size={12} />
                            사용
                          </button>
                          <button 
                            onClick={() => openIndependentWindow(item.id, undefined, 'ledger')} 
                            className="p-1 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded transition-all" 
                            title="품목 정보 수정"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteItem(item.id)} 
                            className="p-1 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded transition-all" 
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
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
                      <td className={tdClass}>
                        <div className={cellDivClass}>
                          <span>{item.itemName}</span>
                          {item.isDiscontinued && (
                            <span className="ml-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1 py-0.5 rounded">미연동</span>
                          )}
                        </div>
                      </td>
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