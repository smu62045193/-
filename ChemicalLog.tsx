
import React, { useState, useEffect } from 'react';
import { ChemicalLogData, ChemicalLogItem } from '../types';
import { fetchChemicalLog, saveChemicalLog, getInitialChemicalLog } from '../services/dataService';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import LogSheetLayout from './LogSheetLayout';

interface ChemicalLogProps {
  currentDate: Date;
}

const ChemicalLog: React.FC<ChemicalLogProps> = ({ currentDate }) => {
  const [loading, setLoading] = useState(false);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const [data, setData] = useState<ChemicalLogData>(getInitialChemicalLog(dateKey));

  useEffect(() => {
    loadData();
  }, [dateKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetched = await fetchChemicalLog(dateKey);
      setData(fetched || getInitialChemicalLog(dateKey));
    } catch (e) {
      console.error(e);
      setData(getInitialChemicalLog(dateKey));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data) return;
    const success = await saveChemicalLog(data);
    if (success) alert('저장되었습니다.');
    else alert('저장 실패');
  };

  const updateItem = (id: string, field: keyof ChemicalLogItem, value: string) => {
    if (!data) return;
    const newItems = data.items.map(item => {
      if (item.id === id) {
        if (field === 'prevStock' || field === 'received' || field === 'used') {
           const updatedItem = { ...item, [field]: value };
           const prev = parseFloat(updatedItem.prevStock || '0');
           const received = parseFloat(updatedItem.received || '0');
           const used = parseFloat(updatedItem.used || '0');
           const current = prev + received - used;
           updatedItem.currentStock = isNaN(current) ? '' : current.toString();
           return updatedItem;
        }
        return { ...item, [field]: value };
      }
      return item;
    });
    setData({ ...data, items: newItems });
  };

  const addItem = () => {
    if (!data) return;
    const newItem: ChemicalLogItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      unit: '',
      prevStock: '',
      received: '',
      used: '',
      currentStock: '',
      remark: ''
    };
    setData({ ...data, items: [...(data.items || []), newItem] });
  };

  const deleteItem = async (id: string) => {
    if (!data) return;
    if (confirm('삭제하시겠습니까?')) {
      const newItems = data.items.filter(i => i.id !== id);
      const newData = { ...data, items: newItems };
      const success = await saveChemicalLog(newData);
      
      if (success) {
        setData(newData);
        alert('삭제되었습니다.');
      } else {
        alert('삭제 실패 (서버 저장 오류)');
      }
    }
  };

  const thClass = "border border-black bg-gray-100 p-2 font-bold text-center align-middle text-sm";
  const tdClass = "border border-black p-0 h-10";
  const inputClass = "w-full h-full text-center outline-none bg-white text-black p-1 focus:bg-blue-50";

  return (
    <LogSheetLayout
      title="기계실 약품 수불 대장"
      date={dateKey}
      loading={loading}
      onRefresh={loadData}
      onSave={handleSave}
    >
      <div className="border border-black">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr>
              <th className={`${thClass} w-10`}>No</th>
              <th className={thClass}>약 품 명</th>
              <th className={`${thClass} w-16`}>단 위</th>
              <th className={thClass}>전일재고</th>
              <th className={thClass}>입 고</th>
              <th className={thClass}>사 용</th>
              <th className={thClass}>현재재고</th>
              <th className={`${thClass} w-32`}>비 고</th>
              <th className={`${thClass} w-10 print:hidden`}>관리</th>
            </tr>
          </thead>
          <tbody>
            {data?.items?.map((item, idx) => (
              <tr key={item.id}>
                <td className={tdClass}>{idx + 1}</td>
                <td className={tdClass}>
                  <input type="text" className={inputClass} value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)} />
                </td>
                <td className={tdClass}>
                  <input type="text" className={inputClass} value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)} />
                </td>
                <td className={tdClass}>
                  <input type="text" className={inputClass} value={item.prevStock} onChange={(e) => updateItem(item.id, 'prevStock', e.target.value)} />
                </td>
                <td className={tdClass}>
                  <input type="text" className={inputClass} value={item.received} onChange={(e) => updateItem(item.id, 'received', e.target.value)} />
                </td>
                <td className={tdClass}>
                  <input type="text" className={inputClass} value={item.used} onChange={(e) => updateItem(item.id, 'used', e.target.value)} />
                </td>
                <td className={tdClass}>
                  <input type="text" className={`${inputClass} font-bold`} value={item.currentStock} onChange={(e) => updateItem(item.id, 'currentStock', e.target.value)} />
                </td>
                <td className={tdClass}>
                  <input type="text" className={inputClass} value={item.remark} onChange={(e) => updateItem(item.id, 'remark', e.target.value)} />
                </td>
                <td className="border border-black p-0 print:hidden">
                  <button onClick={() => deleteItem(item.id)} className="w-full h-full flex items-center justify-center text-gray-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 print:hidden">
        <button onClick={addItem} className="w-full py-2 border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-blue-500 hover:text-blue-500 flex items-center justify-center font-bold">
          <Plus size={20} className="mr-2" /> 항목 추가
        </button>
      </div>
    </LogSheetLayout>
  );
};

export default ChemicalLog;
