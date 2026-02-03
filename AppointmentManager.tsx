import React, { useState, useEffect } from 'react';
import { AppointmentItem } from '../types';
import { fetchAppointmentList, saveAppointmentList } from '../services/dataService';
import { Save, Plus, Trash2, UserCheck, Printer, RotateCcw, Edit2, AlertTriangle, X, RefreshCw, Cloud, CheckCircle } from 'lucide-react';

const CATEGORIES = ['전기', '기계', '소방', '승강기'];
const generateId = () => Math.random().toString(36).substr(2, 9);

const AppointmentManager: React.FC = () => {
  const [items, setItems] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  const initialNewItem: AppointmentItem = { id: '', category: CATEGORIES[0], title: '', name: '', agency: '', phone: '', fax: '', appointmentDate: '', trainingDate: '', license: '', note: '' };
  const [newItem, setNewItem] = useState<AppointmentItem>(initialNewItem);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => { setLoading(true); const data = await fetchAppointmentList(); setItems(data || []); setLoading(false); };

  const handleRegister = async () => {
    if (!newItem.name || !newItem.title) { 
      alert('선임명칭과 성명은 필수 항목입니다.'); 
      setShowSaveConfirm(false);
      return; 
    }
    setLoading(true);
    setShowSaveConfirm(false);
    try {
      let newList = [...items];
      if (editId) { const idx = newList.findIndex(i => String(i.id) === String(editId)); if (idx >= 0) newList[idx] = { ...newItem }; }
      else { newList = [{ ...newItem, id: generateId() }, ...newList]; }
      if (await saveAppointmentList(newList)) { setItems(newList); setEditId(null); setNewItem(initialNewItem); alert('저장되었습니다.'); }
    } catch (e) { alert('오류 발생'); } finally { setLoading(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const newList = items.filter(i => String(i.id) !== deleteTargetId);
    if (await saveAppointmentList(newList)) { setItems(newList); setDeleteTargetId(null); }
  };

  const getSortedItems = (itemList: AppointmentItem[]) => {
    const orderMap: Record<string, number> = { '전기': 1, '소방': 2, '기계': 3, '승강기': 4 };
    const fireTitleOrder: Record<string, number> = { '소방안전관리자': 1, '소방안전관리보조자': 2 };

    return [...itemList].sort((a, b) => {
      const orderA = orderMap[a.category] || 99;
      const orderB = orderMap[b.category] || 99;
      if (orderA !== orderB) return orderA - orderB;
      
      if (a.category === '소방' && b.category === '소방') {
        const fireA = fireTitleOrder[a.title] || 99;
        const fireB = fireTitleOrder[b.title] || 99;
        if (fireA !== fireB) return fireA - fireB;
      }
      
      return a.name.localeCompare(b.name);
    });
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) return;
    const sorted = getSortedItems(items);
    const rows = sorted.map((it, i) => `<tr><td>${i+1}</td><td>${it.category}</td><td>${it.title || ''}</td><td class="bold">${it.name || ''}</td><td>${it.agency || ''}</td><td>${it.phone || ''}</td><td>${it.appointmentDate || ''}</td><td>${it.trainingDate || ''}</td><td>${it.license || ''}</td></tr>`).join('');
    printWindow.document.write(`
      <html><head><title>선임 현황</title><style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
        @page { size: A4 landscape; margin: 0; }
        body { font-family: 'Noto Sans KR', sans-serif; background: #f1f5f9; padding: 0; margin: 0; -webkit-print-color-adjust: exact; }
        .no-print { display: flex; justify-content: center; padding: 20px; }
        @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; } }
        .print-page { width: 297mm; min-height: 210mm; padding: 15mm 12mm 15mm 12mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
        h1 { text-align: center; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 25px; font-size: 24pt; font-weight: 900; }
        table { width: 100%; border-collapse: collapse; font-size: 9.5pt; border: 1.5px solid black; }
        th, td { border: 1px solid black; padding: 8px 4px; text-align: center; }
        th { background: #f3f4f6; font-weight: bold; }
        .bold { font-weight: bold; }
      </style></head><body>
        <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
        <div class="print-page"><h1>안전관리자 선임 현황</h1><table><thead><tr><th style="width:40px;">No</th><th style="width:60px;">구분</th><th style="width:160px;">선임명칭</th><th style="width:70px;">성명</th><th style="width:110px;">기관</th><th style="width:100px;">연락처</th><th style="width:90px;">선임일자</th><th style="width:90px;">교육일자</th><th>자격사항</th></tr></thead><tbody>${rows}</tbody></table></div>
      </body></html>`);
    printWindow.document.close();
  };

  const sortedItems = getSortedItems(items);

  return (
    <div className="p-6 max-w-full mx-auto space-y-6 animate-fade-in relative">
      <div className="mb-4"><h2 className="text-2xl font-bold text-gray-800 flex items-center"><UserCheck className="mr-2 text-blue-600" size={24} />선임 현황 관리</h2></div>
      <div className={`p-6 rounded-xl border shadow-sm transition-all ${editId ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div><label className="text-xs font-bold text-gray-500 block mb-1">구분</label><select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="text-xs font-bold text-gray-500 block mb-1">선임명칭</label><input type="text" value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" placeholder="관리책임자 등" /></div>
            <div><label className="text-xs font-bold text-gray-500 block mb-1">성명</label><input type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="border rounded-lg px-3 py-2 text-sm font-bold w-full bg-white" /></div>
            <div><label className="text-xs font-bold text-gray-500 block mb-1">기관</label><input type="text" value={newItem.agency} onChange={e => setNewItem({...newItem, agency: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" /></div>
            <div><label className="text-xs font-bold text-gray-500 block mb-1">연락처</label><input type="text" value={newItem.phone} onChange={e => setNewItem({...newItem, phone: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div><label className="text-xs font-bold text-gray-500 block mb-1">선임일자</label><input type="date" value={newItem.appointmentDate} onChange={e => setNewItem({...newItem, appointmentDate: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" /></div>
            <div><label className="text-xs font-bold text-gray-500 block mb-1">교육일자</label><input type="date" value={newItem.trainingDate} onChange={e => setNewItem({...newItem, trainingDate: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" /></div>
            <div className="md:col-span-2"><label className="text-xs font-bold text-gray-500 block mb-1">자격사항</label><input type="text" value={newItem.license} onChange={e => setNewItem({...newItem, license: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" placeholder="자격증 및 면허 정보" /></div>
            <button onClick={() => setShowSaveConfirm(true)} className={`w-full text-white font-bold py-2 rounded-lg transition-all ${editId ? 'bg-orange-50 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {editId ? '수정 완료' : '신규 등록'}
            </button>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center mt-10"><h3 className="text-lg font-bold text-gray-700">현역 선임 현황</h3><button onClick={handlePrint} className="bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm h-10 flex items-center justify-center"><Printer size={16} className="mr-2" />미리보기</button></div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full border-collapse min-w-[1000px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">구분</th>
              <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">선임명칭</th>
              <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">성명</th>
              <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">기관</th>
              <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">연락처</th>
              <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">선임일자</th>
              <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">교육일자</th>
              <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">자격사항</th>
              <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider print:hidden">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedItems.map(it => (
              <tr key={it.id} className="text-center hover:bg-gray-50 transition-colors">
                <td className="p-3 text-sm font-bold text-blue-600">{it.category}</td>
                <td className="p-3 text-sm text-center font-medium text-gray-700">{it.title}</td>
                <td className="p-3 text-sm font-bold text-gray-900">{it.name}</td>
                <td className="p-3 text-sm text-gray-600">{it.agency}</td>
                <td className="p-3 text-sm text-gray-600">{it.phone}</td>
                <td className="p-3 text-sm text-gray-500 font-mono">{it.appointmentDate}</td>
                <td className="p-3 text-sm text-gray-500 font-mono">{it.trainingDate}</td>
                <td className="p-3 text-sm text-center text-gray-600 text-xs">{it.license || '-'}</td>
                <td className="p-3 text-sm flex justify-center gap-2 print:hidden items-center h-full">
                  <button onClick={() => {setEditId(it.id); setNewItem(it); window.scrollTo({top:0, behavior:'smooth'});}} className="text-blue-500 hover:text-blue-700 p-1.5 rounded-lg hover:bg-blue-50 transition-all" title="수정"><Edit2 size={16} /></button>
                  <button onClick={() => setDeleteTargetId(it.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-all" title="삭제"><Trash2 size={16} /></button>
                </td>
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
              <h3 className="text-2xl font-black text-slate-900 mb-2">선임 정보 저장 확인</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                작성하신 선임 정보를 서버에 안전하게 기록하시겠습니까?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center"><X size={20} className="mr-2" />취소</button>
                <button onClick={handleRegister} className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95"><CheckCircle size={20} className="mr-2" />확인</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTargetId && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-fade-in"><div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm text-center border border-gray-100"><h3 className="text-lg font-bold mb-4 text-gray-800">데이터를 삭제하시겠습니까?</h3><div className="flex gap-2"><button onClick={() => setDeleteTargetId(null)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all">취소</button><button onClick={confirmDelete} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-100">삭제</button></div></div></div>}

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

export default AppointmentManager;