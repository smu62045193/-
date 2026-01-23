import React, { useState, useEffect } from 'react';
import { ParkingChangeItem } from '../types';
import { 
  fetchParkingChangeList, 
  saveParkingChangeList, 
  fetchParkingStatusList, 
  saveParkingStatusList 
} from '../services/dataService';
import { Save, Trash2, Edit, RotateCcw, Calendar, Cloud, X, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const generateId = () => Math.random().toString(36).substr(2, 9);

const ParkingChangeLog: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ParkingChangeItem[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  
  const [newItem, setNewItem] = useState<ParkingChangeItem>({
    id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: '변경',
    company: '',
    location: '',
    prevPlate: '',
    newPlate: '',
    note: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchParkingChangeList();
    setItems(data || []);
    setLoading(false);
  };

  const handleEdit = (item: ParkingChangeItem) => {
    setNewItem({ ...item });
    setEditId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setNewItem({
      id: '',
      date: newItem.date,
      type: '변경',
      company: '',
      location: '',
      prevPlate: '',
      newPlate: '',
      note: ''
    });
    setEditId(null);
  };

  const handleUpdateItem = async () => {
    if (!editId) return;
    if (!newItem.newPlate) {
      alert('변경후 차량번호는 필수입니다.');
      return;
    }

    setLoading(true);
    setShowSaveConfirm(false);
    const originalItems = [...items];
    const updatedItems = originalItems.map(item => 
      String(item.id) === String(editId) ? { ...newItem, id: editId } : item
    );
    
    setItems(updatedItems);

    const successChange = await saveParkingChangeList(updatedItems);
    if (successChange) {
       try {
        const currentStatusList = await fetchParkingStatusList();
        let updatedStatusList = [...(currentStatusList || [])];
        const normalize = (val: string) => (val || '').toString().replace(/\s+/g, '').toUpperCase();
        const targetLocation = normalize(newItem.location);
        const targetPrevPlate = normalize(newItem.prevPlate);
        
        let existingIndex = -1;
        if (targetLocation) existingIndex = updatedStatusList.findIndex(s => normalize(s.location) === targetLocation);
        if (existingIndex === -1 && targetPrevPlate) existingIndex = updatedStatusList.findIndex(s => normalize(s.plateNum) === targetPrevPlate);

        if (existingIndex >= 0) {
          updatedStatusList[existingIndex] = {
            ...updatedStatusList[existingIndex],
            date: newItem.date,
            type: newItem.type,
            company: newItem.company,
            plateNum: newItem.newPlate,
            prevPlate: newItem.prevPlate,
            location: newItem.location || updatedStatusList[existingIndex].location,
            note: newItem.note ? newItem.note : updatedStatusList[existingIndex].note
          };
        } else {
           updatedStatusList.push({
            id: generateId(),
            date: newItem.date,
            type: newItem.type,
            location: newItem.location,
            company: newItem.company,
            plateNum: newItem.newPlate,
            prevPlate: newItem.prevPlate,
            note: newItem.note
          });
        }
        updatedStatusList.sort((a, b) => (a.location || '').toString().localeCompare((b.location || '').toString(), undefined, { numeric: true }));
        await saveParkingStatusList(updatedStatusList);
        handleCancelEdit();
        alert('수정 내용이 저장되었습니다.');
       } catch (error) {
         console.error(error);
       }
    } else {
      setItems(originalItems);
      alert('수정에 실패했습니다.');
    }
    setLoading(false);
  };

  const handleAddItem = async () => {
    if (!newItem.newPlate) {
      alert('변경후 차량번호는 필수입니다.');
      return;
    }

    setLoading(true);
    setShowSaveConfirm(false);
    const originalItems = [...items];
    const itemToAdd = { ...newItem, id: generateId() };
    const newItems = [itemToAdd, ...originalItems];
    
    setItems(newItems);
    
    const successChange = await saveParkingChangeList(newItems);
    if (successChange) {
      try {
        const currentStatusList = await fetchParkingStatusList();
        let updatedStatusList = [...(currentStatusList || [])];
        const normalize = (val: string) => (val || '').toString().replace(/\s+/g, '').toUpperCase();
        const targetLocation = normalize(newItem.location);
        const targetPrevPlate = normalize(newItem.prevPlate);
        
        let existingIndex = -1;
        if (targetLocation) existingIndex = updatedStatusList.findIndex(s => normalize(s.location) === targetLocation);
        if (existingIndex === -1 && targetPrevPlate) existingIndex = updatedStatusList.findIndex(s => normalize(s.plateNum) === targetPrevPlate);

        if (existingIndex >= 0) {
          updatedStatusList[existingIndex] = {
            ...updatedStatusList[existingIndex],
            date: newItem.date,
            type: newItem.type,
            company: newItem.company,
            plateNum: newItem.newPlate,
            prevPlate: newItem.prevPlate,
            location: newItem.location || updatedStatusList[existingIndex].location,
            note: newItem.note ? newItem.note : updatedStatusList[existingIndex].note
          };
        } else {
          updatedStatusList.push({
            id: generateId(),
            date: newItem.date,
            type: newItem.type, 
            location: newItem.location,
            company: newItem.company,
            plateNum: newItem.newPlate,
            prevPlate: newItem.prevPlate,
            note: newItem.note
          });
        }
        updatedStatusList.sort((a, b) => (a.location || '').toString().localeCompare((b.location || '').toString(), undefined, { numeric: true }));
        await saveParkingStatusList(updatedStatusList);
        setNewItem({ id: '', date: newItem.date, type: '변경', company: '', location: '', prevPlate: '', newPlate: '', note: '' });
        alert('변경 내역이 저장되었습니다.');
      } catch (error) { console.error(error); }
    } else {
      setItems(originalItems);
      alert('저장에 실패했습니다.');
    }
    setLoading(false);
  };

  const handleDelete = async (id: any) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    const idStr = String(id);
    const originalItems = [...items];
    const newItems = originalItems.filter(i => String(i.id) !== idStr);
    
    setItems(newItems);
    if (String(editId) === idStr) handleCancelEdit();

    try {
      const success = await saveParkingChangeList(newItems);
      if (!success) {
        setItems(originalItems);
        alert('삭제 실패 (서버 저장 오류)');
      }
    } catch (e) {
      console.error(e);
      setItems(originalItems);
      alert('오류가 발생했습니다.');
    }
  };

  const filteredItems = items.filter(item => item.date === newItem.date);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in relative">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">지정주차 차량 변경 일지</h2>
      </div>
      <div className={`bg-white p-5 rounded-lg shadow-sm border mb-6 transition-colors ${editId ? 'border-orange-300 ring-1 ring-orange-200' : 'border-gray-200'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-700 flex items-center">
            <span className={`w-2 h-2 rounded-full mr-2 ${editId ? 'bg-orange-500' : 'bg-blue-600'}`}></span>
            {editId ? '변경 내역 수정' : '신규 등록 (자동 현황 반영)'}
          </h3>
          {editId && <button onClick={handleCancelEdit} className="text-xs flex items-center text-gray-500 hover:text-gray-700 bg-gray-100 px-2 py-1 rounded"><RotateCcw size={12} className="mr-1" />수정 취소</button>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
          <div><label className="block text-xs font-bold text-gray-500 mb-1">날짜</label><input type="date" value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black outline-none text-center" /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">구분</label><select value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value as any})} className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black outline-none"><option value="변경">변경</option><option value="추가">추가</option></select></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">업체</label><input type="text" placeholder="업체" value={newItem.company} onChange={e => setNewItem({...newItem, company: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black outline-none" /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">위치</label><input type="text" placeholder="예: B3-12" value={newItem.location} onChange={e => setNewItem({...newItem, location: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black outline-none" /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">변경전 차량번호</label><input type="text" placeholder="00가 0000" value={newItem.prevPlate} onChange={e => setNewItem({...newItem, prevPlate: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black outline-none" /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">변경후 차량번호</label><input type="text" placeholder="00나 0000" value={newItem.newPlate} onChange={e => setNewItem({...newItem, newPlate: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black outline-none font-bold" /></div>
          <div>{editId ? <div className="flex gap-1"><button onClick={() => setShowSaveConfirm(true)} disabled={loading} className="flex-1 bg-orange-500 text-white p-2 rounded shadow hover:bg-orange-600 transition-colors h-[38px] font-bold text-sm">수정</button><button onClick={handleCancelEdit} className="bg-gray-200 text-gray-600 p-2 rounded shadow hover:bg-gray-300 transition-colors h-[38px] font-bold text-sm">취소</button></div> : <button onClick={() => setShowSaveConfirm(true)} disabled={loading} className="bg-blue-600 text-white p-2 rounded shadow hover:bg-blue-700 transition-colors h-[38px] w-full flex items-center justify-center font-bold text-sm"><Save size={18} className="mr-1.5" /> 서버저장</button>}</div>
        </div>
        <div className="mt-2"><label className="block text-xs font-bold text-gray-500 mb-1">비고</label><input type="text" placeholder="특이사항 입력" value={newItem.note} onChange={e => setNewItem({...newItem, note: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black outline-none" /></div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center"><h4 className="font-bold text-gray-700 flex items-center"><Calendar size={18} className="mr-2 text-blue-600" />{newItem.date} 내역 ({filteredItems.length}건)</h4></div>
        <table className="w-full min-w-[1000px]">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-center text-sm font-bold text-gray-500 w-28">날짜</th>
              <th className="px-3 py-2 text-center text-sm font-bold text-gray-500 w-16">구분</th>
              <th className="px-3 py-2 text-left text-sm font-bold text-gray-500 w-32">업체</th>
              <th className="px-3 py-2 text-center text-sm font-bold text-gray-500 w-20">위치</th>
              <th className="px-3 py-2 text-center text-sm font-bold text-gray-500 w-32">변경전 차량번호</th>
              <th className="px-3 py-2 text-center text-sm font-bold text-gray-500 text-blue-600 w-32">변경후 차량번호</th>
              <th className="px-3 py-2 text-left text-sm font-bold text-gray-500">비고</th>
              <th className="px-3 py-2 text-center text-sm font-bold text-gray-500 w-16">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredItems.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-sm text-gray-400 italic">내역이 없습니다.</td></tr> : filteredItems.map((item) => (
               <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${String(editId) === String(item.id) ? 'bg-orange-50' : ''}`}>
                 <td className="px-3 py-2 text-center text-sm text-gray-700">{item.date}</td>
                 <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded text-xs font-bold ${item.type === '추가' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{item.type}</span></td>
                 <td className="px-3 py-2 text-sm text-gray-800 font-medium">{item.company}</td>
                 <td className="px-3 py-2 text-center text-sm text-gray-600">{item.location}</td>
                 <td className="px-3 py-2 text-center text-sm text-gray-500">{item.prevPlate || '-'}</td>
                 <td className="px-3 py-2 text-center text-sm text-blue-600 font-bold">{item.newPlate}</td>
                 <td className="px-3 py-2 text-left text-sm text-gray-500">{item.note}</td>
                 <td className="px-3 py-2 text-center"><div className="flex items-center justify-center gap-2"><button onClick={() => handleEdit(item)} className="text-gray-400 hover:text-blue-500 transition-colors"><Edit size={16} /></button><button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button></div></td>
               </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showSaveConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-slate-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-100">
                <Cloud className="text-blue-600" size={36} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">서버저장 확인</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                작성하신 주차 차량 변경 내역을<br/>
                서버에 안전하게 기록하시겠습니까?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center"><X size={20} className="mr-2" />취소</button>
                <button onClick={editId ? handleUpdateItem : handleAddItem} className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95"><CheckCircle size={20} className="mr-2" />확인</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scale-up {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-up {
          animation: scale-up 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ParkingChangeLog;