
import React, { useState, useRef, useEffect } from 'react';
import { StaffMember } from '../types';
import { fetchStaffList, saveStaffList, uploadFile } from '../services/dataService';
import { Save, Plus, Trash2, Search, ArrowLeft, Printer, Edit2, RotateCcw, UserPlus, Check, RefreshCw, Camera, User, Cloud, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface StaffStatusProps {
  staffList: StaffMember[];
  setStaffList: React.Dispatch<React.SetStateAction<StaffMember[]>>;
  onBack?: () => void;
  isPopupMode?: boolean;
}

const generateId = () => `staff_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

const StaffStatus: React.FC<StaffStatusProps> = ({ staffList, setStaffList, onBack, isPopupMode = false }) => {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialFormState: StaffMember = { id: '', category: '시설', jobTitle: '', birthDate: '', joinDate: '', resignDate: '', name: '', phone: '', area: '', note: '', photo: '' };
  const [formItem, setFormItem] = useState<StaffMember>(initialFormState);

  // 팝업 모드일 경우 데이터 로드 및 통신 로직 추가
  useEffect(() => {
    if (isPopupMode) {
      loadDataForPopup();
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id && id !== 'new') setEditId(id);
    }
  }, [isPopupMode]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'STAFF_SAVED') {
        loadDataForPopup(); 
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadDataForPopup = async () => {
    setLoading(true);
    const data = await fetchStaffList();
    if (isPopupMode) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id && id !== 'new') {
        const item = data.find(m => String(m.id) === String(id));
        if (item) setFormItem(item);
      }
    } else {
      setStaffList(data || []);
    }
    setLoading(false);
  };

  const openIndependentWindow = (id: string = 'new') => {
    const width = 750;
    const height = 650;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'staff');
    url.searchParams.set('id', id);

    window.open(
      url.toString(),
      `StaffWin_${id}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,location=no`
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas'); 
          const MAX_WIDTH = 400; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH; 
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d'); 
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          setFormItem(prev => ({ ...prev, photo: canvas.toDataURL('image/jpeg', 0.8) }));
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
      const targetId = editId || generateId();
      let finalPhotoUrl = formItem.photo || '';
      
      // 1. 사진 업로드 처리 (Base64 데이터인 경우에만)
      if (finalPhotoUrl && finalPhotoUrl.startsWith('data:image')) {
        const fileName = `staff_${targetId}.jpg`;
        const uploadedUrl = await uploadFile('facility', 'staff', fileName, finalPhotoUrl);
        if (uploadedUrl) finalPhotoUrl = uploadedUrl;
      }

      // 2. 전체 목록 기반 데이터 업데이트
      const latestStaff = await fetchStaffList();
      
      const memberToSave = { 
        ...formItem, 
        id: targetId, 
        photo: finalPhotoUrl
      };

      let newList = [...latestStaff];
      if (editId) { 
        const idx = newList.findIndex(m => String(m.id) === String(editId)); 
        if (idx >= 0) newList[idx] = memberToSave; 
      } else { 
        newList = [memberToSave, ...newList]; 
      }

      // 3. 서버 저장 실행 (dataService에서 날짜 null 처리를 수행함)
      const success = await saveStaffList(newList);
      if (success) { 
        if (window.opener) {
          window.opener.postMessage({ type: 'STAFF_SAVED' }, '*');
        }
        alert('성공적으로 저장되었습니다.'); 
        if (isPopupMode) {
          window.close();
        } else {
          setEditId(null);
          setFormItem(initialFormState);
          loadDataForPopup();
        }
      } else {
        alert('서버 저장에 실패했습니다. 날짜 형식을 확인해주세요.');
      }
    } catch (e) { 
      console.error(e);
      alert('오류가 발생했습니다.'); 
    } finally { 
      setLoading(false); 
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const newList = staffList.filter(m => String(m.id) !== String(deleteTargetId));
    if (await saveStaffList(newList)) {
      setStaffList(newList);
      setDeleteTargetId(null);
      alert('삭제되었습니다.');
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
        <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
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

  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col animate-fade-in">
          <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${editId ? 'bg-orange-50' : 'bg-blue-600'}`}>
                {editId ? <Edit2 size={20} /> : <UserPlus size={20} />}
              </div>
              <span className="font-black text-lg">{editId ? '직원 정보 수정' : '신규 직원 등록'}</span>
            </div>
            <button onClick={() => window.close()} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="p-8 space-y-6 flex-1 overflow-y-auto">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex flex-col items-center">
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">직원 사진</label>
                <div onClick={() => fileInputRef.current?.click()} className="w-32 h-40 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer bg-slate-50 overflow-hidden group hover:border-blue-400 transition-all shadow-inner">
                  {formItem.photo ? (
                    <img src={formItem.photo} className="w-full h-full object-cover" alt="Staff" />
                  ) : (
                    <div className="flex flex-col items-center text-slate-300 group-hover:text-blue-400">
                      <Camera size={32} />
                      <span className="text-[10px] mt-2 font-bold uppercase">Upload</span>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-4">
                <div className="col-span-1">
                  <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">성명 *</label>
                  <input type="text" value={formItem.name} onChange={e => setFormItem({...formItem, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500" placeholder="성명" />
                </div>
                <div className="col-span-1">
                  <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">구분</label>
                  <select value={formItem.category} onChange={e => setFormItem({...formItem, category: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="시설">시설</option><option value="경비">경비</option><option value="미화">미화</option><option value="현장대리인">현장대리인</option>
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">직책</label>
                  <input type="text" value={formItem.jobTitle} onChange={e => setFormItem({...formItem, jobTitle: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="직책" />
                </div>
                <div className="col-span-1">
                  <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">생년월일</label>
                  <input type="date" value={formItem.birthDate || ''} onChange={e => setFormItem({...formItem, birthDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-1">
                  <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">입사일</label>
                  <input type="date" value={formItem.joinDate || ''} onChange={e => setFormItem({...formItem, joinDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-1">
                  <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">퇴사일</label>
                  <input type="date" value={formItem.resignDate || ''} onChange={e => setFormItem({...formItem, resignDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">전화번호</label>
                <input type="text" value={formItem.phone} onChange={e => setFormItem({...formItem, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="010-0000-0000" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">담당구역</label>
                <input type="text" value={formItem.area} onChange={e => setFormItem({...formItem, area: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="담당 업무/구역" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">비고</label>
              <textarea value={formItem.note} onChange={e => setFormItem({...formItem, note: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20" placeholder="기타 특이사항" />
            </div>
          </div>

          <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-4">
            <button onClick={() => window.close()} className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all hover:bg-slate-100 active:scale-95">취소</button>
            <button onClick={() => setShowSaveConfirm(true)} disabled={loading} className={`flex-[2] py-3.5 ${editId ? 'bg-orange-50 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-2xl font-black text-base shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2`}>
              {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              서버에 데이터 저장
            </button>
          </div>
        </div>

        {showSaveConfirm && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-8 text-center animate-scale-up">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-100"><Cloud className="text-blue-600" size={36} /></div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">서버저장 확인</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">직원 정보를 서버에 기록하시겠습니까?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all">취소</button>
                <button onClick={handleRegister} className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all">확인</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in relative">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:hidden mb-6">
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input type="text" placeholder="성명 또는 담당구역 검색" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" />
            <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
          </div>
          <button onClick={() => loadDataForPopup()} className="p-2.5 hover:bg-gray-100 rounded-xl text-gray-500 border border-gray-200 bg-white shadow-sm transition-all active:scale-95"><RefreshCw size={20} className={loading ? 'animate-spin text-blue-600' : ''} /></button>
        </div>
        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          <button onClick={() => openIndependentWindow()} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg text-sm font-black active:scale-95">
            <UserPlus size={18} /> 신규 직원 등록
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 bg-slate-700 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-md text-sm font-black active:scale-95">
            <Printer size={18} /> 미리보기
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider w-16">No</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider w-24">구분</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider w-24">직책</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider w-24">성명</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider w-32">생년월일</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider w-32">전화번호</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider w-28">입사일</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider w-28">퇴사일</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider text-left">담당구역</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider w-24 print:hidden">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAndSortedList.length === 0 ? (
                <tr><td colSpan={10} className="py-20 text-center text-gray-400 italic">등록된 직원이 없습니다.</td></tr>
              ) : (
                filteredAndSortedList.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-blue-50/40 transition-colors group text-center">
                    <td className="px-4 py-4 text-xs text-gray-400 font-mono">{idx + 1}</td>
                    <td className="px-4 py-4 font-black text-blue-600 text-sm">{m.category}</td>
                    <td className="px-4 py-4 text-sm font-medium text-slate-600">{m.jobTitle}</td>
                    <td className="px-4 py-4 text-sm font-black text-slate-900">{m.name}</td>
                    <td className="px-4 py-4 text-sm text-slate-500 font-mono">{m.birthDate || '-'}</td>
                    <td className="px-4 py-4 text-sm text-slate-500 font-mono">{m.phone}</td>
                    <td className="px-4 py-4 text-sm text-slate-500 font-mono">{m.joinDate || '-'}</td>
                    <td className="px-4 py-4 text-sm text-rose-500 font-bold">{m.resignDate || '-'}</td>
                    <td className="px-4 py-4 text-sm text-left text-slate-600">{m.area}</td>
                    <td className="px-4 py-4 print:hidden">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => openIndependentWindow(m.id)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="수정"><Edit2 size={16} /></button>
                        <button onClick={() => setDeleteTargetId(m.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all" title="삭제"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTargetId && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-red-100 p-8 text-center animate-scale-up">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-100"><AlertTriangle className="text-red-600" size={36} /></div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">직원 정보 삭제 확인</h3>
            <p className="text-slate-500 mb-8 leading-relaxed font-medium">선택하신 직원 정보를 마스터 DB에서<br/><span className="text-red-600 font-bold">영구히 삭제</span>하시겠습니까?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTargetId(null)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold">취소</button>
              <button onClick={confirmDelete} className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold">삭제 실행</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scale-up { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-up { animation: scale-up 0.2s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default StaffStatus;
