
import React, { useState, useEffect, useMemo } from 'react';
import { Tenant } from '../types';
import { fetchTenants, saveTenants, generateUUID } from '../services/dataService';
import { Save, Plus, Trash2, Search, Printer, RefreshCw, Cloud, X, CheckCircle2, AlertTriangle, Edit2, Check, Building2, UserPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface TenantStatusProps {
  isPopupMode?: boolean;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  tabs?: { id: string; label: string }[];
  currentMonth?: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
}

const getFloorWeight = (floor: string) => {
  const f = floor.trim().toUpperCase();
  if (!f) return 9999;
  if (f.startsWith('B') || f.includes('지하')) {
    const num = parseInt(f.replace(/[^0-9]/g, '')) || 0;
    return 1000 + num;
  }
  if (f === 'RF' || f === '옥상' || f.includes('옥탑')) return 999;
  const num = parseInt(f.replace(/[^0-9]/g, '')) || 0;
  return num;
};

const TenantStatus: React.FC<TenantStatusProps> = ({ 
  isPopupMode = false, 
  activeTab, 
  setActiveTab, 
  tabs,
  currentMonth,
  onPrevMonth,
  onNextMonth
}) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 팝업 모드용 입력 폼 상태
  const [formItem, setFormItem] = useState<Tenant>({
    id: '', floor: '', name: '', area: '', refPower: '2380', contact: '', note: ''
  });

  useEffect(() => {
    loadData();

    if (isPopupMode) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id && id !== 'new') setEditingId(id);
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'TENANT_SAVED') {
        loadData();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPopupMode]);

  useEffect(() => {
    if (isPopupMode && editingId && tenants.length > 0) {
      const matched = tenants.find(t => String(t.id) === String(editingId));
      if (matched) setFormItem(matched);
    }
  }, [editingId, tenants, isPopupMode]);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchTenants();
    setTenants(data || []);
    setLoading(false);
    if (!isPopupMode) setEditingId(null);
  };

  const openIndependentWindow = (id: string = 'new') => {
    const width = 600;
    const height = 700;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'tenant');
    url.searchParams.set('id', id);

    window.open(
      url.toString(),
      `TenantWin_${id}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,location=no`
    );
  };

  const handleExecuteSave = async () => {
    setSaveStatus('loading');
    try {
      const sortedTenants = [...tenants].sort((a, b) => getFloorWeight(a.floor) - getFloorWeight(b.floor));
      const success = await saveTenants(sortedTenants);
      if (success) {
        setTenants(sortedTenants);
        setSaveStatus('success');
        alert('저장이 완료되었습니다.');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장에 실패했습니다.');
      }
    } catch (e) {
      setSaveStatus('error');
      alert('오류가 발생했습니다.');
    }
  };

  const handleRegisterPopup = async () => {
    if (!formItem.name.trim()) { alert('입주사명은 필수입니다.'); return; }
    setLoading(true);
    try {
      const latestTenants = await fetchTenants();
      let newList = [...(latestTenants || [])];
      
      const targetId = editingId || generateUUID();
      const itemToSave = { ...formItem, id: targetId };

      if (editingId) {
        newList = newList.map(t => String(t.id) === String(editingId) ? itemToSave : t);
      } else {
        newList = [itemToSave, ...newList];
      }

      const success = await saveTenants(newList);
      if (success) {
        if (window.opener) {
          window.opener.postMessage({ type: 'TENANT_SAVED' }, '*');
        }
        alert('성공적으로 저장되었습니다.');
        window.close();
      } else {
        alert('저장 실패. 입력값을 확인해주세요.');
      }
    } catch (e) {
      alert('오류 발생');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    const idStr = String(id);
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    setLoading(true);
    const originalTenants = [...tenants];
    const newTenants = originalTenants.filter(t => String(t.id) !== idStr);
    
    try {
      const success = await saveTenants(newTenants);
      if (success) {
        setTenants(newTenants);
        alert('삭제가 완료되었습니다.');
      } else {
        alert('삭제 실패');
      }
    } catch (e) {
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (id: string, field: keyof Tenant, value: string) => {
    setTenants(tenants.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleToggleEdit = (id: string) => {
    if (editingId === id) {
      setEditingId(null);
      setTenants(prev => [...prev].sort((a, b) => getFloorWeight(a.floor) - getFloorWeight(b.floor)));
    } else {
      setEditingId(id);
    }
  };

  const filteredList = useMemo(() => {
    return [...tenants].sort((a, b) => getFloorWeight(a.floor) - getFloorWeight(b.floor));
  }, [tenants]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    const tableRows = filteredList.map((item, idx) => `
      <tr>
        <td style="width: 40px;">${idx + 1}</td>
        <td style="width: 200px; font-weight: normal; text-align: center;">${item.name}</td>
        <td style="width: 80px;">${item.floor}</td>
        <td style="width: 90px;">${item.area}</td>
        <td style="width: 90px; font-weight: normal; color: black;">${item.refPower}</td>
        <td style="width: 120px; text-align: left; padding-left: 10px; color: #666;">${item.note || ''}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>입주사 현황</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
            @page { size: A4 portrait; margin: 0; }
            body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; background: black !important; -webkit-print-color-adjust: exact; color: black; line-height: 1.4; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; } }
            .print-page { width: 210mm; min-height: 297mm; padding: 25mm 15mm 15mm 15mm; margin: 20px auto; background: white !important; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
            h1 { text-align: center; border-bottom: 3px solid black; padding-bottom: 10px; margin-bottom: 30px; font-size: 26pt; font-weight: 900; margin-top: 0; letter-spacing: -1px; }
            table { width: 100%; border-collapse: collapse; font-size: 10pt; border: 1.5px solid black; table-layout: fixed; }
            th, td { border: 1px solid black; padding: 4px 2px; text-align: center; word-break: break-all; height: 26px; }
            th { background-color: white; font-weight: normal; font-size: 11pt; }
            .meta-info { display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: bold; font-size: 11pt; padding: 0 5px; }
            .no-print button { padding: 12px 30px; background: #1e3a8a; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13pt; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: all 0.2s; }
            .no-print button:hover { background: #172554; transform: translateY(-1px); }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()">인쇄하기</button>
          </div>
          <div class="print-page">
            <h1>입주사 현황 명단</h1>
            <div class="meta-info">
              <div>사업장명 : 새마을운동중앙회 대치동사옥</div>
              <div>조회일자 : ${format(new Date(), 'yyyy년 MM월 dd일')}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 40px;">No</th>
                  <th style="width: 200px;">입주사명</th>
                  <th style="width: 80px;">층 별</th>
                  <th style="width: 90px;">전용면적</th>
                  <th style="width: 90px;">기준전력(월)</th>
                  <th style="width: 120px;">비 고</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const inputClass = (isEditing: boolean) => `w-full h-full text-center bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal text-black ${isEditing ? 'bg-orange-50' : 'cursor-default'}`;
  const headerClass = "bg-white border-b border-r border-black text-center text-[13px] font-normal text-black p-0 h-[40px]";
  const cellClass = (isEditing: boolean) => `border-b border-r border-black p-0 text-[13px] font-normal text-center h-[40px] ${isEditing ? 'bg-orange-50/50' : ''}`;

  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 animate-fade-in">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${editingId ? 'bg-orange-600' : 'bg-blue-600'}`}>
                <Building2 size={24} />
              </div>
              <span className="font-black text-xl tracking-tight">{editingId ? '입주사 정보 수정' : '신규 입주사 등록'}</span>
            </div>
            <button onClick={() => window.close()} className="p-1 hover:bg-white/20 rounded-full transition-colors text-white"><X size={28} /></button>
          </div>
          <div className="p-8 space-y-5">
            <div><label className="block text-[11px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">입주사명 *</label><input type="text" value={formItem.name} onChange={e => setFormItem({...formItem, name: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-3 font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="상호명 입력" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-[11px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">층 별</label><input type="text" value={formItem.floor} onChange={e => setFormItem({...formItem, floor: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="예: B2F, 10F" /></div>
              <div><label className="block text-[11px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">전용면적</label><input type="text" value={formItem.area} onChange={e => setFormItem({...formItem, area: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="000.00" /></div>
            </div>
            <div><label className="block text-[11px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">기준전력(월)</label><input type="text" value={formItem.refPower} onChange={e => setFormItem({...formItem, refPower: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-3 font-black text-emerald-600 outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="2380" /></div>
            <div><label className="block text-[11px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">비고</label><textarea value={formItem.note} onChange={e => setFormItem({...formItem, note: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-blue-500 shadow-inner resize-none h-24" placeholder="특이사항" /></div>
            <div className="pt-4 flex gap-3">
              <button onClick={() => window.close()} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all">닫기</button>
              <button onClick={handleRegisterPopup} disabled={loading} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                {loading ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />} 서버에 저장
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto space-y-2 animate-fade-in relative pb-10">
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
        {/* 1. 날짜 선택 영역 (월 네비게이션) */}
        {currentMonth && onPrevMonth && onNextMonth && (
          <div className="flex items-center shrink-0">
            <button 
              onClick={onPrevMonth} 
              className="px-2 py-3 text-gray-500 hover:text-black transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-2 py-3 text-[14px] font-bold text-black min-w-[100px] text-center">
              {currentMonth.split('-')[0]}년 {currentMonth.split('-')[1]}월
            </div>
            <button 
              onClick={onNextMonth} 
              className="px-2 py-3 text-gray-500 hover:text-black transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* 구분선 (검정색 1px) */}
        <div className="flex items-center shrink-0 px-2">
          <div className="w-[1px] h-6 bg-black"></div>
        </div>

        {/* 2. 서브탭 메뉴 */}
        <div className="flex shrink-0">
          {tabs && setActiveTab && tabs.map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer bg-white ${activeTab === tab.id ? 'text-orange-600' : 'text-gray-500 hover:text-black'}`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center shrink-0 px-2">
          <div className="w-[1px] h-6 bg-black"></div>
        </div>

        <div className="flex items-center print:hidden shrink-0">
          <button 
            onClick={loadData} 
            disabled={loading}
            className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>

          <button 
            onClick={() => openIndependentWindow()} 
            className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
          >
            <Plus size={18} className="mr-1.5" />
            등록
          </button>

          <button 
            onClick={handleExecuteSave} 
            disabled={saveStatus === 'loading'} 
            className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50 ${saveStatus === 'success' ? 'text-orange-600' : 'text-gray-500 hover:text-black'}`}
          >
            {saveStatus === 'loading' ? <RefreshCw size={18} className="mr-1.5 animate-spin" /> : saveStatus === 'success' ? <CheckCircle2 size={18} className="mr-1.5" /> : <Save size={18} className="mr-1.5" />}
            {saveStatus === 'success' ? '저장완료' : '저장'}
          </button>

          <button 
            onClick={handlePrint} 
            className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
          >
            <Printer size={18} className="mr-1.5" />
            인쇄
          </button>
        </div>
      </div>

      <div className="max-w-7xl w-full mx-auto bg-white border-t border-l border-black overflow-hidden min-w-[1000px]">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr className="bg-white h-[40px]">
              <th className={`${headerClass} w-14`}><div className="flex items-center justify-center h-full px-2">No</div></th>
              <th className={`${headerClass}`}><div className="flex items-center justify-center h-full px-2">입주사명</div></th>
              <th className={`${headerClass} w-24`}><div className="flex items-center justify-center h-full px-2">층 별</div></th>
              <th className={`${headerClass} w-32`}><div className="flex items-center justify-center h-full px-2">전용면적</div></th>
              <th className={`${headerClass} w-32`}><div className="flex items-center justify-center h-full px-2">기준전력(월)</div></th>
              <th className={`${headerClass}`}><div className="flex items-center justify-center h-full px-2">비 고</div></th>
              <th className={`${headerClass} w-28 print:hidden`}><div className="flex items-center justify-center h-full px-2">관리</div></th>
            </tr>
          </thead>
          <tbody>
            {filteredList.length === 0 ? (
              <tr><td colSpan={7} className="h-[40px] text-center text-black italic font-normal text-[13px] border-b border-r border-black">등록된 입주사 정보가 없습니다.</td></tr>
            ) : (
              filteredList.map((item, idx) => {
                const isEditing = editingId === item.id;
                const actualIdx = idx + 1;
                return (
                  <tr key={item.id} className={`group hover:bg-blue-50/30 transition-colors text-center h-[40px] ${isEditing ? 'bg-orange-50' : ''}`}>
                    <td className="border-b border-r border-black p-0 text-[13px] font-normal text-center text-black h-[40px]"><div className="flex items-center justify-center h-full px-2">{actualIdx}</div></td>
                    <td className={`${cellClass(isEditing)}`}><div className="flex items-center justify-center h-full px-2"><input type="text" readOnly={!isEditing} className={`${inputClass(isEditing)}`} value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)} /></div></td>
                    <td className={`${cellClass(isEditing)}`}><div className="flex items-center justify-center h-full px-2"><input type="text" readOnly={!isEditing} className={inputClass(isEditing)} value={item.floor} onChange={(e) => updateItem(item.id, 'floor', e.target.value)} /></div></td>
                    <td className={`${cellClass(isEditing)}`}><div className="flex items-center justify-center h-full px-2"><input type="text" readOnly={!isEditing} className={inputClass(isEditing)} value={item.area} onChange={(e) => updateItem(item.id, 'area', e.target.value)} /></div></td>
                    <td className={`${cellClass(isEditing)}`}><div className="flex items-center justify-center h-full px-2"><input type="text" readOnly={!isEditing} className={`${inputClass(isEditing)}`} value={item.refPower} onChange={(e) => updateItem(item.id, 'refPower', e.target.value)} /></div></td>
                    <td className={`${cellClass(isEditing)}`}><div className="flex items-center justify-center h-full px-2"><input type="text" readOnly={!isEditing} className={`${inputClass(isEditing)} !text-left`} value={item.note} onChange={(e) => updateItem(item.id, 'note', e.target.value)} /></div></td>
                    <td className="border-b border-r border-black p-0 text-[13px] font-normal text-center print:hidden relative h-[40px]">
                      <div className="flex items-center justify-center gap-1 h-full px-2">
                        <button onClick={() => handleToggleEdit(item.id)} className={`p-1.5 rounded-lg transition-all ${isEditing ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'}`}>{isEditing ? <Check size={16} /> : <Edit2 size={16} />}</button>
                        <button onClick={() => handleDeleteRequest(item.id)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <style>{` @keyframes scale-up { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } } .animate-scale-up { animation: scale-up 0.2s ease-out forwards; } `}</style>
    </div>
  );
};

export default TenantStatus;
