
import React, { useState, useEffect } from 'react';
import { ConsumableItem } from '../types';
import { fetchConsumables, saveConsumables } from '../services/dataService';
import { Save, RefreshCw, PackagePlus } from 'lucide-react';

const generateId = () => Math.random().toString(36).substr(2, 9);

const CATEGORIES = [
  '전기', '기계', '소방', '공용'
];

const ConsumablesRegister: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [existingItems, setExistingItems] = useState<ConsumableItem[]>([]);
  
  // State to track the base stock of the selected item + model combination
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
    note: ''
  });

  useEffect(() => {
    const loadExistingData = async () => {
      const data = await fetchConsumables();
      setExistingItems(data || []);
    };
    loadExistingData();
  }, []);

  const availableItemNames = Array.from(new Set(
    existingItems
      .filter(item => item.category === newItem.category)
      .map(item => item.itemName)
      .filter(name => name && name.trim() !== '')
  )).sort();

  // 품명과 모델명이 모두 고려된 베이스 재고 동기화 함수
  const syncBaseStock = (category: string, name: string, model: string) => {
    const matches = existingItems.filter(
      item => item.category === category && 
      item.itemName.trim() === name.trim() && 
      (item.modelName || '').trim() === (model || '').trim()
    );

    matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latestMatch = matches[0];

    let foundBase = 0;
    let updates: Partial<ConsumableItem> = {};

    if (latestMatch) {
      foundBase = parseFloat(latestMatch.stockQty?.replace(/,/g, '') || '0');
      if (isNaN(foundBase)) foundBase = 0;
      
      updates = {
        modelName: latestMatch.modelName,
        unit: latestMatch.unit || 'EA',
        details: latestMatch.details,
        note: latestMatch.note,
        stockQty: foundBase.toString()
      };
    } else {
      // 새로운 조합일 경우 (모델명이 달라진 경우 포함)
      foundBase = 0;
      updates = {
        stockQty: '0'
      };
    }

    setBaseStock(foundBase);

    const currentIn = parseFloat(newItem.inQty?.replace(/,/g, '') || '0');
    const currentOut = parseFloat(newItem.outQty?.replace(/,/g, '') || '0');
    if (currentIn > 0 || currentOut > 0) {
        updates.stockQty = (foundBase + currentIn - currentOut).toString();
    }

    setNewItem(prev => ({ ...prev, ...updates, itemName: name, modelName: model }));
  };

  const handleRegister = async () => {
    if (!newItem.itemName) {
      alert('품명은 필수 입력 항목입니다.');
      return;
    }

    setLoading(true);
    try {
      const currentList = await fetchConsumables();
      const itemToAdd = { 
        ...newItem, 
        id: generateId(),
        itemName: newItem.itemName.trim(),
        modelName: (newItem.modelName || '').trim()
      };
      const newList = [itemToAdd, ...currentList];
      
      const success = await saveConsumables(newList);
      if (success) {
        alert('소모품이 등록되었습니다.');
        setExistingItems(newList);
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
          note: ''
        });
        setBaseStock(0);
      } else {
        alert('등록 실패');
      }
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleItemNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    syncBaseStock(newItem.category, value, newItem.modelName);
  };

  const handleModelNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    syncBaseStock(newItem.category, newItem.itemName, value);
  };

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'inQty' | 'outQty') => {
    const val = e.target.value;
    const nextIn = field === 'inQty' ? parseFloat(val.replace(/,/g, '') || '0') : parseFloat(newItem.inQty?.replace(/,/g, '') || '0');
    const nextOut = field === 'outQty' ? parseFloat(val.replace(/,/g, '') || '0') : parseFloat(newItem.outQty?.replace(/,/g, '') || '0');
    const nextStock = baseStock + (isNaN(nextIn) ? 0 : nextIn) - (isNaN(nextOut) ? 0 : nextOut);

    setNewItem({
      ...newItem,
      [field]: val,
      stockQty: nextStock.toString()
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center space-x-3 mb-8 pb-4 border-b border-gray-200">
        <div className="p-3 bg-blue-50 rounded-full text-blue-600">
          <PackagePlus size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-800">신규 소모품 등록 (모델별 재고 관리)</h3>
          <p className="text-gray-500 text-sm">품명이 같더라도 모델명이 다르면 별도 품목으로 관리됩니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
        <div className="col-span-1">
          <label className="block text-sm font-bold text-gray-700 mb-2">등록일자</label>
          <input type="date" value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none text-sm bg-white text-black" />
        </div>
        <div className="col-span-1">
          <label className="block text-sm font-bold text-gray-700 mb-2">구분</label>
          <select value={newItem.category} onChange={e => { const cat = e.target.value; setNewItem({...newItem, category: cat}); syncBaseStock(cat, newItem.itemName, newItem.modelName); }} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none text-sm bg-white text-black">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="col-span-1">
          <label className="block text-sm font-bold text-gray-700 mb-2">품명 <span className="text-red-500">*</span></label>
          <input type="text" list="register-item-suggestions" value={newItem.itemName} onChange={handleItemNameChange} placeholder="품명 입력 또는 선택" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none text-sm bg-white text-black" />
          <datalist id="register-item-suggestions">
            {availableItemNames.map((name, index) => (
              <option key={`${name}-${index}`} value={name} />
            ))}
          </datalist>
        </div>
        <div className="col-span-1">
          <label className="block text-sm font-bold text-gray-700 mb-2">모델명</label>
          <input type="text" value={newItem.modelName} onChange={handleModelNameChange} placeholder="예: 10W, 15W 등" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none text-sm bg-white text-black font-bold" />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-bold text-gray-700 mb-2">사용내역 / 규격</label>
          <input type="text" value={newItem.details} onChange={e => setNewItem({...newItem, details: e.target.value})} placeholder="상세 규격 또는 사용 내역" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none text-sm bg-white text-black" />
        </div>

        <div className="grid grid-cols-4 gap-4 col-span-2">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">입고수량</label>
            <input type="text" value={newItem.inQty} onChange={(e) => handleQtyChange(e, 'inQty')} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none text-center bg-white text-black text-sm" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">사용수량</label>
            <input type="text" value={newItem.outQty} onChange={(e) => handleQtyChange(e, 'outQty')} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none text-center bg-white text-black text-sm" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 text-blue-600">재고 (자동)</label>
            <input type="text" value={newItem.stockQty} readOnly className="w-full border border-blue-200 bg-blue-50 rounded-lg px-3 py-2.5 outline-none text-center font-bold text-blue-700 cursor-not-allowed text-sm" title={`이전재고(${baseStock}) + 입고 - 사용`} />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">단위</label>
            <input type="text" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} placeholder="EA" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none text-center bg-white text-black text-sm" />
          </div>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-bold text-gray-700 mb-2">비고</label>
          <input type="text" value={newItem.note} onChange={e => setNewItem({...newItem, note: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none text-sm bg-white text-black" />
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end">
        <button 
          onClick={handleRegister}
          disabled={loading}
          className={`flex items-center space-x-2 bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 shadow-md transition-colors font-bold text-lg ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
          <span>{loading ? '저장 중...' : '등록하기'}</span>
        </button>
      </div>
    </div>
  );
};

export default ConsumablesRegister;
