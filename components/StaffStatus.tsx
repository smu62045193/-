import React, { useState, useRef } from 'react';
import { StaffMember } from '../types';
import { saveStaffList } from '../services/dataService';
import { Save, Plus, Trash2, Search, ArrowLeft, Printer, Edit2, RotateCcw, UserPlus, Check, RefreshCw, Camera, User, Cloud, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface StaffStatusProps {
  staffList: StaffMember[];
  setStaffList: React.Dispatch<React.SetStateAction<StaffMember[]>>;
  onBack?: () => void;
}

const generateId = () => `staff_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

const StaffStatus: React.FC<StaffStatusProps> = ({ staffList, setStaffList, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialFormState: StaffMember = { id: '', category: '시설', jobTitle: '', birthDate: '', joinDate: '', resignDate: '', name: '', phone: '', area: '', note: '', photo: '' };
  const [formItem, setFormItem] = useState<StaffMember>(initialFormState);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas'); const MAX_WIDTH = 300; const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d'); ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          setFormItem(prev => ({ ...prev, photo: canvas.toDataURL('image/jpeg', 0.85) }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = async () => {
    if (!formItem.name.trim()) { alert('성명은 필수입니다.'); return; }
    setLoading(true);
    setShowSaveConfirm(false);
    try {
      let newList = [...staffList];
      if (editId) { const idx = newList.findIndex(m => String(m.id) === String(editId)); if (idx >= 0) newList[idx] = { ...formItem }; }
      else { newList = [{ ...formItem, id: generateId() }, ...newList]; }
      if (await saveStaffList(newList)) { setStaffList(newList); setEditId(null); setFormItem(initialFormState); alert('저장되었습니다.'); }
    } catch (e) { alert('오류 발생'); } finally { setLoading(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const newList = staffList.filter(m => String(m.id) !== String(deleteTargetId));
    if (await saveStaffList(newList)) {
      setStaffList(newList);
      setDeleteTargetId(null);
      if (String(editId) === String(deleteTargetId)) {
        setEditId(null);
        setFormItem(initialFormState);
      }
    } else {
      alert('삭제 실패');
    }
  };

  const getRank = (m: StaffMember) => {
    const catOrder: Record<string, number> = { '현장대리인': 100, '시설': 200, '경비': 300, '미화': 400 };
    const base = catOrder[m.category] || 900;
    const title = m.jobTitle || '';
    let sub = 99;
    
    if (m.category === '현장대리인') {
      if (title.includes('소장')) sub = 1;
      else if (title.includes('과장')) sub = 2;
    } else if (m.category === '시설') {
      if (title.includes('대리')) sub = 1;
      else if (title.includes('주임')) sub = 2;
      else if (title.includes('기사')) sub = 3;
    } else if (m.category === '경비') {
      if (title.includes('반장')) sub = 1;
      else if (title.includes('대원')) sub = 2;
    } else if (m.category === '미화') {
      if (title.includes('반장')) sub = 1;
      else sub = 2;
    }
    return base + sub;
  };

  const filteredAndSortedList = staffList
    .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.area.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const rankA = getRank(a);
      const rankB = getRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) return;

    // 퇴사일이 있는 직원을 제외
    const activeStaffForPrint = filteredAndSortedList.filter(m => !m.resignDate || m.resignDate.trim() === '');

    const tableRows = activeStaffForPrint.map((m, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${m.category}</td>
        <td>${m.jobTitle || ''}</td>
        <td>${m.name}</td>
        <td>${m.birthDate || ''}</td>
        <td>${m.phone}</td>
        <td>${m.joinDate || ''}</td>
        <td>${m.area || ''}</td>
      </tr>`).join('');

    printWindow.document.write(`
      <html><head><title>직원 현황</title><style>
        @page { size: A4 portrait; margin: 0; }
        body { font-family: sans-serif; background: #f1f5f9; padding: 0; margin: 0; -webkit-print-color-adjust: exact; }
        .no-print { display: flex; justify-content: center; padding: 20px; }
        @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; } }
        .print-page { width: 210mm; min-height: 297mm; padding: 15mm 10mm 15mm 10mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
        h1 { text-align: center; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 20px; font-size: 24pt; font-weight: 900; }
        table { width: 100%; border-collapse: collapse; font-size: 8.5pt; table-layout: fixed; }
        th, td { border: 1px solid black; padding: 0 3px; text-align: center; word-break: break-all; height: 35px; line-height: 35px; }
        th { background: #f3f4f6; font-weight: bold; }
      </style></head><body>
        <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">인쇄하기</button></div>
        <div class="print-page">
          <h1>직원 현황 리스트</h1>
          <table>
            <thead>
              <tr>
                <th style="width:30px;">No</th>
                <th style="width:70px;">구분</th>
                <th style="width:60px;">직책</th>
                <th style="width:60px;">성명</th>
                <th style="width:85px;">생년월일</th>
                <th style="width:110px;">전화번호</th>
                <th style="width:85px;">입사일</th>
                <th>담당구역</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="animate-fade-in relative">
      <div className={`p-6 rounded-xl border shadow-sm print:hidden transition-all duration-300 ${editId ? 'bg-orange-50 border-orange-200' : 'bg-blue-50/50 border-blue-200'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3"><div className={`p-2 rounded-lg text-white ${editId ? 'bg-orange-500' : 'bg-blue-600'}`}>{editId ? <Edit2 size={18} /> : <UserPlus size={18} />}</div><h3 className="text-lg font-bold text-gray-800">{editId ? '직원 정보 수정' : '신규 직원 등록'}</h3></div>
          <div className="flex gap-2">{editId && <button onClick={() => {setEditId(null); setFormItem(initialFormState);}} className="text-sm text-gray-500 bg-white px-4 py-2 rounded-lg border">취소</button>}<button onClick={() => setShowSaveConfirm(true)} disabled={loading} className={`px-6 py-2.5 rounded-lg text-white font-bold h-10 flex items-center justify-center gap-2 ${editId ? 'bg-orange-500' : 'bg-blue-600'}`}>{loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />} 서버저장</button></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex justify-center"><div onClick={() => fileInputRef.current?.click()} className="w-32 h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer bg-white overflow-hidden">{formItem.photo ? <img src={formItem.photo} className="w-full h-full object-cover" /> : <Camera className="text-gray-300" />}<input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} /></div></div>
          <div className="md:col-span-3 grid grid-cols-3 gap-4">
            <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 mb-1">성명</label><input type="text" value={formItem.name} onChange={e => setFormItem({...formItem, name: e.target.value})} className="border rounded px-3 py-2 text-sm" /></div>
            <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 mb-1">구분</label><select value={formItem.category} onChange={e => setFormItem({...formItem, category: e.target.value as any})} className="border rounded px-3 py-2 text-sm"><option value="시설">시설</option><option value="경비">경비</option><option value="미화">미화</option><option value="현장대리인">현장대리인</option></select></div>
            <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 mb-1">직책</label><input type="text" value={formItem.jobTitle} onChange={e => setFormItem({...formItem, jobTitle: e.target.value})} className="border rounded px-3 py-2 text-sm" /></div>
            <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 mb-1">생년월일</label><input type="date" value={formItem.birthDate} onChange={e => setFormItem({...formItem, birthDate: e.target.value})} className="border rounded px-3 py-2 text-sm" /></div>
            <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 mb-1">입사일</label><input type="date" value={formItem.joinDate} onChange={e => setFormItem({...formItem, joinDate: e.target.value})} className="border rounded px-3 py-2 text-sm" /></div>
            <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 mb-1">퇴사일</label><input type="date" value={formItem.resignDate} onChange={e => setFormItem({...formItem, resignDate: e.target.value})} className="border rounded px-3 py-2 text-sm" /></div>
            <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 mb-1">전화번호</label><input type="text" value={formItem.phone} onChange={e => setFormItem({...formItem, phone: e.target.value})} className="border rounded px-3 py-2 text-sm" /></div>
            <div className="flex flex-col"><label className="text-xs font-bold text-gray-500 mb-1">담당구역</label><input type="text" value={formItem.area} onChange={e => setFormItem({...formItem, area: e.target.value})} className="border rounded px-3 py-2 text-sm" /></div>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center mt-8 px-2 print:hidden"><div className="flex items-center gap-2"><h2 className="text-xl font-bold text-gray-800">직원 리스트</h2><span className="text-sm text-gray-400">총 {staffList.length}명</span></div><div className="flex gap-2"><input type="text" placeholder="성명 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-64" /><button onClick={handlePrint} className="bg-gray-700 text-white px-4 py-2 rounded-lg font-bold shadow text-sm flex items-center justify-center"><Printer size={18} className="mr-2" />미리보기</button></div></div>
      <div className="mt-4 bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3 text-sm">구분</th>
              <th className="p-3 text-sm">직책</th>
              <th className="p-3 text-sm">성명</th>
              <th className="p-3 text-sm">생년월일</th>
              <th className="p-3 text-sm">전화번호</th>
              <th className="p-3 text-sm">입사일</th>
              <th className="p-3 text-sm">퇴사일</th>
              <th className="p-3 text-sm text-left">담당구역</th>
              <th className="p-3 text-sm print:hidden">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredAndSortedList.map(m => (
              <tr key={m.id} className="hover:bg-gray-50 text-center">
                <td className="p-3 text-sm font-bold text-blue-600">{m.category}</td>
                <td className="p-3 text-sm">{m.jobTitle}</td>
                <td className="p-3 text-sm font-bold">{m.name}</td>
                <td className="p-3 text-sm text-gray-500">{m.birthDate || '-'}</td>
                <td className="p-3 text-sm text-gray-500">{m.phone}</td>
                <td className="p-3 text-sm text-gray-500">{m.joinDate || '-'}</td>
                <td className="p-3 text-sm text-red-500 font-medium">{m.resignDate || '-'}</td>
                <td className="p-3 text-sm text-left">{m.area}</td>
                <td className="p-3 text-sm print:hidden flex justify-center gap-2">
                  <button onClick={() => {setEditId(m.id); setFormItem(m); window.scrollTo({top:0, behavior:'smooth'});}} className="text-blue-500 hover:text-blue-700 p-1.5 rounded hover:bg-blue-50" title="수정"><Edit2 size={16} /></button>
                  <button onClick={() => setDeleteTargetId(m.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50" title="삭제"><Trash2 size={16} /></button>
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
              <h3 className="text-2xl font-black text-slate-900 mb-2">서버저장 확인</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                {editId ? '수정된 직원 정보를' : '작성하신 직원 정보를'}<br/>
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

      {deleteTargetId && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-red-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-100">
                <AlertTriangle className="text-red-600" size={36} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">직원 정보 삭제 확인</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                선택하신 직원 정보를 마스터 DB에서<br/>
                <span className="text-red-600 font-bold">영구히 삭제</span>하시겠습니까?
              </p>
              
              <div className="flex gap-3">
                <button onClick={() => setDeleteTargetId(null)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center">
                  <X size={20} className="mr-2" />
                  취소
                </button>
                <button onClick={confirmDelete} className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-200 flex items-center justify-center active:scale-95">
                  <Trash2 size={20} className="mr-2" />
                  삭제 실행
                </button>
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

export default StaffStatus;