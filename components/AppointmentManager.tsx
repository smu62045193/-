
import React, { useState, useEffect } from 'react';
import { AppointmentItem } from '../types';
import { fetchAppointmentList, saveAppointmentList } from '../services/dataService';
import { Save, UserCheck, Printer, Edit2, AlertTriangle, X, RefreshCw, UserPlus, CheckCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface AppointmentManagerProps {
  isPopupMode?: boolean;
}

const CATEGORIES = ['전기', '기계', '소방', '승강기'];
const generateId = () => Math.random().toString(36).substr(2, 9);

const AppointmentManager: React.FC<AppointmentManagerProps> = ({ isPopupMode = false }) => {
  const [items, setItems] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const initialNewItem: AppointmentItem = { 
    id: '', 
    category: CATEGORIES[0], 
    title: '', 
    name: '', 
    agency: '', 
    phone: '', 
    fax: '', 
    appointmentDate: format(new Date(), 'yyyy-MM-dd'), 
    trainingDate: '', 
    license: '', 
    note: '' 
  };
  const [newItem, setNewItem] = useState<AppointmentItem>(initialNewItem);

  useEffect(() => { 
    loadData();

    // 팝업 모드인 경우 URL에서 편집할 ID 추출
    if (isPopupMode) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id && id !== 'new') setEditId(id);
    }

    // 메인 목록 창인 경우, 팝업창에서 보낸 '저장 완료' 메시지 감지
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'APPOINTMENT_SAVED') {
        loadData();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPopupMode]);

  // 편집 모드일 때 데이터 세팅
  useEffect(() => {
    if (editId && items.length > 0) {
      const item = items.find(i => String(i.id) === String(editId));
      if (item) setNewItem({ ...item });
    }
  }, [editId, items]);

  const loadData = async () => { 
    setLoading(true); 
    const data = await fetchAppointmentList(); 
    setItems(data || []); 
    setLoading(false); 
  };

  /**
   * 실제 브라우저 독립 팝업창 열기
   */
  const openIndependentWindow = (id: string = 'new') => {
    const width = 750;
    const height = 850;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    // 배포 환경에서도 작동하도록 현재 URL의 origin과 pathname을 사용
    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'appointment');
    url.searchParams.set('id', id);

    window.open(
      url.toString(),
      `AppointmentWin_${id}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,location=no`
    );
  };

  const handleSave = async () => {
    if (!newItem.name || !newItem.title) { 
      alert('선임명칭과 성명은 필수 항목입니다.'); 
      return; 
    }
    setSaveStatus('loading');
    try {
      const latestData = await fetchAppointmentList();
      let newList = [...(latestData || [])];
      
      if (editId) { 
        const idx = newList.findIndex(i => String(i.id) === String(editId)); 
        if (idx >= 0) newList[idx] = { ...newItem }; 
      } else { 
        newList = [{ ...newItem, id: generateId() }, ...newList]; 
      }
      
      if (await saveAppointmentList(newList)) { 
        setSaveStatus('success');
        
        // 부모 창(목록 창)이 있다면 새로고침 신호 전송
        if (window.opener) {
          window.opener.postMessage({ type: 'APPOINTMENT_SAVED' }, '*');
        }
        
        alert('저장이 완료되었습니다.');
        setTimeout(() => {
          setSaveStatus('idle');
          if (isPopupMode) window.close(); // 팝업창인 경우 자신을 닫음
        }, 500);
      }
    } catch (e) { 
      alert('오류 발생'); 
      setSaveStatus('idle');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const newList = items.filter(i => String(i.id) !== deleteTargetId);
    if (await saveAppointmentList(newList)) { 
      setItems(newList); 
      setDeleteTargetId(null); 
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    const orderMap: Record<string, number> = { '전기': 1, '소방': 2, '기계': 3, '승강기': 4 };
    return (orderMap[a.category] || 99) - (orderMap[b.category] || 99) || a.name.localeCompare(b.name);
  });

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) return;
    const rows = sortedItems.map((it, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${it.category}</td>
        <td>${it.title || ''}</td>
        <td style="font-weight:bold;">${it.name || ''}</td>
        <td>${it.agency || ''}</td>
        <td>${it.phone || ''}</td>
        <td>${it.appointmentDate || ''}</td>
        <td>${it.license || ''}</td>
      </tr>`).join('');

    printWindow.document.write(`
      <html><head><title>안전관리자 선임 현황</title><style>
        body { font-family: sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid black; padding: 8px; text-align: center; font-size: 10pt; }
        th { background: #f3f4f6; }
      </style></head><body>
        <h1 style="text-align:center;">안전관리자 선임 현황</h1>
        <table><thead><tr><th>No</th><th>구분</th><th>선임명칭</th><th>성명</th><th>기관</th><th>연락처</th><th>선임일자</th><th>자격사항</th></tr></thead><tbody>${rows}</tbody></table>
      </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  // ==========================================
  // [팝업 모드] UI - 실제 독립창 내에서 보여질 내용
  // ==========================================
  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${editId ? 'bg-orange-500' : 'bg-blue-600'}`}>
                <UserCheck size={20} />
              </div>
              <span className="font-black text-lg">{editId ? '선임 정보 수정' : '신규 선임 등록'}</span>
            </div>
            <button onClick={() => window.close()} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="p-8 space-y-6 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">분야</label>
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {CATEGORIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewItem({...newItem, category: c})}
                      className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${newItem.category === c ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">선임 명칭 *</label>
                <input 
                  type="text" 
                  value={newItem.title} 
                  onChange={e => setNewItem({...newItem, title: e.target.value})}
                  placeholder="예: 소방안전관리자"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">성명 *</label>
                <input 
                  type="text" 
                  value={newItem.name} 
                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                  placeholder="성명"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">관리 기관</label>
                <input 
                  type="text" 
                  value={newItem.agency} 
                  onChange={e => setNewItem({...newItem, agency: e.target.value})}
                  placeholder="예: 한국소방안전원"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">연락처</label>
                <input 
                  type="text" 
                  value={newItem.phone} 
                  onChange={e => setNewItem({...newItem, phone: e.target.value})}
                  placeholder="010-0000-0000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">선임 일자</label>
                <input 
                  type="date" 
                  value={newItem.appointmentDate} 
                  onChange={e => setNewItem({...newItem, appointmentDate: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">보유 자격 및 면허</label>
              <input 
                type="text" 
                value={newItem.license} 
                onChange={e => setNewItem({...newItem, license: e.target.value})}
                placeholder="보유 자격증 정보"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">비고 및 특이사항</label>
              <textarea 
                value={newItem.note} 
                onChange={e => setNewItem({...newItem, note: e.target.value})}
                placeholder="기타 참고사항"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
              />
            </div>
          </div>

          <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-4">
            <button 
              onClick={() => window.close()}
              className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all hover:bg-slate-100 active:scale-95"
            >
              취소 후 창 닫기
            </button>
            <button 
              onClick={handleSave}
              disabled={saveStatus === 'loading'}
              className="flex-[2] py-3.5 bg-blue-600 text-white rounded-2xl font-black text-base shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {saveStatus === 'loading' ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              서버에 데이터 저장
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // [일반 모드] UI - 메인 화면의 목록
  // ==========================================
  return (
    <div className="p-6 max-w-full mx-auto space-y-6 animate-fade-in relative min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <UserCheck className="mr-2 text-blue-600" size={24} />
          안전관리자 선임 현황
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => openIndependentWindow()}
            className="flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95 text-sm"
          >
            <UserPlus size={18} className="mr-2" />
            신규 선임 등록 (독립 창)
          </button>
          <button onClick={handlePrint} className="bg-gray-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-gray-800 flex items-center justify-center transition-all active:scale-95">
            <Printer size={18} className="mr-2" />
            전체 인쇄
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full border-collapse min-w-[1000px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 w-16">No</th>
              <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 w-24">구분</th>
              <th className="px-4 py-4 text-left text-sm font-bold text-gray-500 w-48">선임명칭</th>
              <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 w-28">성명</th>
              <th className="px-4 py-4 text-left text-sm font-bold text-gray-500 w-44">기관/단체</th>
              <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 w-36">연락처</th>
              <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 w-32">선임일자</th>
              <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 w-28 print:hidden">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedItems.length === 0 ? (
              <tr><td colSpan={8} className="py-20 text-center text-gray-400 italic">등록된 정보가 없습니다.</td></tr>
            ) : sortedItems.map((it, idx) => (
              <tr key={it.id} className="text-center hover:bg-gray-50/50 transition-colors group">
                <td className="p-4 text-xs text-gray-400 font-mono">{idx + 1}</td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    it.category === '전기' ? 'bg-blue-100 text-blue-700' :
                    it.category === '소방' ? 'bg-red-100 text-red-700' :
                    it.category === '기계' ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {it.category}
                  </span>
                </td>
                <td className="p-4 text-sm font-bold text-gray-700 text-left">{it.title}</td>
                <td className="p-4 text-sm font-black text-gray-900">{it.name}</td>
                <td className="p-4 text-sm text-gray-600 text-left">{it.agency}</td>
                <td className="p-4 text-sm text-gray-600">{it.phone}</td>
                <td className="p-4 text-sm text-gray-500 font-mono">{it.appointmentDate}</td>
                <td className="p-4 print:hidden">
                  <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openIndependentWindow(it.id)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="편집">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => setDeleteTargetId(it.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all" title="삭제"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-red-100 p-8 text-center animate-scale-up">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-600" size={36} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">데이터 영구 삭제</h3>
            <p className="text-slate-500 mb-8 leading-relaxed font-medium">선택하신 선임 정보를 마스터 DB에서<br/><span className="text-red-600 font-bold">삭제하시겠습니까?</span></p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTargetId(null)} className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95">취소</button>
              <button onClick={confirmDelete} className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-all shadow-lg active:scale-95">삭제 실행</button>
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

export default AppointmentManager;
