
import React, { useState, useEffect } from 'react';
import { AppointmentItem } from '../types';
import { fetchAppointmentList, saveAppointmentList } from '../services/dataService';
import { Save, UserCheck, Printer, Edit2, AlertTriangle, X, RefreshCw, UserPlus, CheckCircle, Trash2, LayoutList } from 'lucide-react';
import { format } from 'date-fns';

interface AppointmentManagerProps {
  isPopupMode?: boolean;
  isEmbedded?: boolean;
}

const TABS = [
  { id: 'status', label: '선임현황' },
];

const CATEGORIES = ['전기', '기계', '소방', '승강기'];
const generateId = () => Math.random().toString(36).substr(2, 9);

const AppointmentManager: React.FC<AppointmentManagerProps> = ({ isPopupMode = false, isEmbedded = false }) => {
  const [activeTab, setActiveTab] = useState('status');
  const [items, setItems] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editId, setEditId] = useState<string | null>(() => {
    if (isPopupMode) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      return id && id !== 'new' ? id : null;
    }
    return null;
  });
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

  const loadData = async () => { 
    setLoading(true); 
    const data = await fetchAppointmentList(); 
    setItems(data || []); 
    if (editId && data) {
      const item = data.find(i => String(i.id) === String(editId));
      if (item) setNewItem({ ...item });
    }
    setLoading(false); 
  };

  const openIndependentWindow = (id: string = 'new') => {
    const width = 750;
    const height = 850;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

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
      
      let targetId = editId;
      if (editId) { 
        const idx = newList.findIndex(i => String(i.id) === String(editId)); 
        if (idx >= 0) newList[idx] = { ...newItem }; 
      } else { 
        const newId = generateId();
        targetId = newId;
        newList = [{ ...newItem, id: newId }, ...newList]; 
      }
      
      if (await saveAppointmentList(newList)) { 
        setSaveStatus('success');
        if (window.opener) {
          window.opener.postMessage({ type: 'APPOINTMENT_SAVED' }, '*');
        }
        if (!editId && targetId) {
          setEditId(targetId);
          setNewItem(prev => ({ ...prev, id: targetId }));
        }
        alert('저장이 완료되었습니다.');
        setTimeout(() => {
          setSaveStatus('idle');
        }, 500);
      }
    } catch (e) { 
      alert('오류 발생'); 
      setSaveStatus('idle');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('해당 선임 정보를 삭제하시겠습니까?')) return;
    const newList = items.filter(i => String(i.id) !== String(id));
    if (await saveAppointmentList(newList)) { 
      setItems(newList); 
      alert('삭제가 완료되었습니다.');
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    const orderMap: Record<string, number> = { '전기': 1, '소방': 2, '기계': 3, '승강기': 4 };
    return (orderMap[a.category] || 99) - (orderMap[b.category] || 99) || a.name.localeCompare(b.name);
  });

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    const rows = sortedItems.map((it) => `
      <tr>
        <td style="width: 50px; text-align: center;">${it.category}</td>
        <td style="text-align: center; font-weight: normal;">${it.title || ''}</td>
        <td style="width: 80px; text-align: center; font-weight: normal;">${it.name || ''}</td>
        <td style="text-align: center;">${it.agency || ''}</td>
        <td style="width: 120px; text-align: center;">${it.phone || ''}</td>
        <td style="width: 100px; text-align: center;">${it.appointmentDate || ''}</td>
      </tr>`).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>안전관리자 선임 현황 인쇄</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
            @page { size: A4 portrait; margin: 0; }
            body { font-family: 'Noto Sans KR', sans-serif; background: black; padding: 0; margin: 0; -webkit-print-color-adjust: exact; }
            .no-print { display: flex; justify-content: center; padding: 20px; background: black; border-bottom: 1px solid #333; }
            @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; } }
            .print-page { 
              width: 210mm; 
              min-height: 297mm; 
              margin: 20px auto; 
              padding: 20mm 12mm 15mm 12mm; 
              background: white; 
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); 
              box-sizing: border-box; 
            }
            h1 { text-align: center; font-size: 28pt; font-weight: 900; text-decoration: underline; text-underline-offset: 8px; margin-bottom: 40px; margin-top: 0; }
            .meta-info { display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: normal; font-size: 11pt; }
            table { width: 100%; border-collapse: collapse; border: 1.5px solid black; table-layout: fixed; }
            th, td { border: 1px solid black; padding: 10px 4px; font-size: 9.5pt; font-weight: normal; height: 36px; word-break: break-all; }
            th { background-color: white; font-weight: normal; }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" style="padding: 12px 30px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13pt;">인쇄하기</button>
          </div>
          <div class="print-page">
            <h1>안전관리자 선임 현황</h1>
            <div class="meta-info">
              <div>사업장 : 새마을운동중앙회 대치동사옥</div>
              <div>조회일 : ${format(new Date(), 'yyyy년 MM월 dd일')}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 50px;">구분</th>
                  <th style="width: 32%;">선임명칭</th>
                  <th style="width: 80px;">성명</th>
                  <th style="width: 28%;">기관/단체</th>
                  <th style="width: 120px;">연락처</th>
                  <th style="width: 100px;">선임일자</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => { 
    let isMounted = true;
    const fetchData = async () => {
      const data = await fetchAppointmentList();
      if (isMounted) {
        setItems(data || []);
        if (editId && data) {
          const item = data.find(i => String(i.id) === String(editId));
          if (item) setNewItem({ ...item });
        }
        setLoading(false);
      }
    };
    fetchData();

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'APPOINTMENT_SAVED') {
        loadData();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    };

    const handleRefresh = () => loadData();
    const handleAdd = () => openIndependentWindow();
    const handlePrintEvent = () => handlePrint();

    window.addEventListener('message', handleMessage);
    window.addEventListener('REFRESH_APPOINTMENTS', handleRefresh);
    window.addEventListener('ADD_APPOINTMENT', handleAdd);
    window.addEventListener('PRINT_APPOINTMENTS', handlePrintEvent);

    return () => {
      isMounted = false;
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('REFRESH_APPOINTMENTS', handleRefresh);
      window.removeEventListener('ADD_APPOINTMENT', handleAdd);
      window.removeEventListener('PRINT_APPOINTMENTS', handlePrintEvent);
    };
  }, [isPopupMode, editId, loadData]);

  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${editId ? 'bg-orange-600' : 'bg-blue-600'}`}>
                <UserCheck size={20} className="text-white" />
              </div>
              <span className="font-black text-lg">{editId ? '선임 정보 수정' : '신규등록'}</span>
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
                  placeholder="예: 전기안전관리자"
                  className="w-full bg-transparent border-none outline-none shadow-none appearance-none px-2 py-1 text-[13px] font-normal"
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
                  className="w-full bg-transparent border-none outline-none shadow-none appearance-none px-2 py-1 text-[13px] font-normal text-blue-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">관리 기관</label>
                <input 
                  type="text" 
                  value={newItem.agency} 
                  onChange={e => setNewItem({...newItem, agency: e.target.value})}
                  placeholder="예: 한국소방안전원"
                  className="w-full bg-transparent border-none outline-none shadow-none appearance-none px-2 py-1 text-[13px] font-normal"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">연락처</label>
                <input 
                  type="text" 
                  value={newItem.phone} 
                  onChange={e => setNewItem({...newItem, phone: e.target.value})}
                  placeholder="010-0000-0000"
                  className="w-full bg-transparent border-none outline-none shadow-none appearance-none px-2 py-1 text-[13px] font-normal"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">선임 일자</label>
                <input 
                  type="date" 
                  value={newItem.appointmentDate} 
                  onChange={e => setNewItem({...newItem, appointmentDate: e.target.value})}
                  className="w-full bg-transparent border-none outline-none shadow-none appearance-none px-2 py-1 text-[13px] font-normal"
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
                className="w-full bg-transparent border-none outline-none shadow-none appearance-none px-2 py-1 text-[13px] font-normal"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">비고 및 특이사항</label>
              <textarea 
                value={newItem.note} 
                onChange={e => setNewItem({...newItem, note: e.target.value})}
                placeholder="기타 참고사항"
                className="w-full bg-transparent border-none outline-none shadow-none appearance-none px-2 py-1 text-[13px] font-normal resize-none h-24"
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
              className={`flex-[2] py-3.5 ${editId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-2xl font-black text-base shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2`}
            >
              {saveStatus === 'loading' ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              서버에 데이터 저장
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isEmbedded ? "animate-fade-in" : "max-w-7xl mx-auto p-4 sm:p-8 space-y-2 animate-fade-in relative min-h-screen"}>
      {/* 메인 컨테이너 (협력업체 스타일의 큰 박스) */}
      <div className={isEmbedded ? "" : "bg-white border border-black overflow-hidden min-h-[500px]"}>
        <div className={isEmbedded ? "space-y-2" : "p-6 space-y-2"}>
          {!isEmbedded && (
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 border border-black print:hidden">
              <div className="flex-1"></div>
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <button 
                  onClick={loadData}
                  disabled={loading}
                  className="flex items-center justify-center px-4 py-2.5 bg-transparent text-gray-500 hover:text-black transition-colors disabled:opacity-50 text-sm font-bold"
                >
                  <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                  새로고침
                </button>
                <button 
                  onClick={() => openIndependentWindow()}
                  className={`flex items-center justify-center px-4 py-2.5 bg-transparent transition-colors text-sm font-bold ${saveSuccess ? 'text-orange-600' : 'text-gray-500 hover:text-black'}`}
                >
                  <Plus size={18} className="mr-2" />
                  등록
                </button>
                <button 
                  onClick={handlePrint} 
                  disabled={loading}
                  className="flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 bg-transparent text-gray-500 hover:text-black transition-colors disabled:opacity-50 text-sm font-bold"
                >
                  <Printer size={18} className="mr-2" />
                  인쇄
                </button>
              </div>
            </div>
          )}

          {/* 작은박스 2: 리스트 테이블 영역 */}
          <div className="bg-white overflow-x-auto max-w-7xl mx-auto">
            <table className="w-full border-collapse min-w-[1000px] border border-black text-center bg-white">
              <thead>
                <tr className="h-[40px] border-b border-black">
                  <th className="border-r border-black bg-white text-center text-[13px] font-normal text-black p-0 w-24"><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">구분</div></th>
                  <th className="border-r border-black bg-white text-center text-[13px] font-normal text-black p-0 w-56"><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">선임명칭</div></th>
                  <th className="border-r border-black bg-white text-center text-[13px] font-normal text-black p-0 w-24"><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">성명</div></th>
                  <th className="border-r border-black bg-white text-center text-[13px] font-normal text-black p-0 w-40"><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">기관/단체</div></th>
                  <th className="border-r border-black bg-white text-center text-[13px] font-normal text-black p-0 w-32"><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">연락처</div></th>
                  <th className="border-r border-black bg-white text-center text-[13px] font-normal text-black p-0 w-28"><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">선임일자</div></th>
                  <th className="border-r border-black bg-white text-center text-[13px] font-normal text-black p-0"><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">자격사항</div></th>
                  <th className="border-black bg-white text-center text-[13px] font-normal text-black p-0 w-28 print:hidden"><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">관리</div></th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.length === 0 ? (
                  <tr className="border-b border-black"><td colSpan={8} className="h-[200px] text-center text-gray-400 italic text-[13px] font-normal border-r border-black">등록된 정보가 없습니다.</td></tr>
                ) : sortedItems.map((it, idx) => (
                  <tr key={it.id} className="text-center hover:bg-blue-50/30 transition-colors group h-[40px] border-b border-black">
                    <td className="border-r border-black text-[13px] font-normal p-0">
                      <div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          it.category === '전기' ? 'bg-blue-100 text-blue-700' :
                          it.category === '소방' ? 'bg-red-100 text-red-700' :
                          it.category === '기계' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {it.category}
                        </span>
                      </div>
                    </td>
                    <td className="border-r border-black text-[13px] font-normal text-gray-700 p-0"><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">{it.title}</div></td>
                    <td className="border-r border-black text-[13px] font-normal text-gray-900 p-0"><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">{it.name}</div></td>
                    <td className="border-r border-black text-[13px] font-normal text-gray-600 p-0"><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">{it.agency}</div></td>
                    <td className="border-r border-black text-[13px] font-normal text-gray-600 p-0"><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">{it.phone}</div></td>
                    <td className="border-r border-black text-[13px] font-normal text-gray-500 p-0"><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">{it.appointmentDate}</div></td>
                    <td className="border-r border-black text-[13px] font-normal text-gray-600 p-0"><div className="flex items-center justify-center h-full px-2 text-[13px] font-normal">{it.license}</div></td>
                    <td className="border-black print:hidden p-0">
                      <div className="flex justify-center gap-1 h-full items-center px-2 text-[13px] font-normal">
                        <button onClick={() => openIndependentWindow(it.id)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded transition-all" title="편집">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteItem(it.id)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded transition-all" title="삭제">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scale-up { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-up { animation: scale-up 0.2s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default AppointmentManager;
