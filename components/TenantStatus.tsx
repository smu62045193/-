
import React, { useState, useEffect, useMemo } from 'react';
import { Tenant } from '../types';
import { fetchTenants, saveTenants } from '../services/dataService';
import { Save, Plus, Trash2, Search, Printer, RefreshCw, Cloud, X, CheckCircle2, AlertTriangle, Edit2, Check, Building2, UserPlus } from 'lucide-react';
import { format } from 'date-fns';

interface TenantStatusProps {
  isPopupMode?: boolean;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

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

const TenantStatus: React.FC<TenantStatusProps> = ({ isPopupMode = false }) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // 팝업 모드용 입력 폼 상태
  const [formItem, setFormItem] = useState<Tenant>({
    id: '', floor: '', name: '', area: '', refPower: '2380', contact: '', note: '일반'
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
      
      const targetId = editingId || generateId();
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
        alert('저장 실패');
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
    return tenants
      .filter(t => 
        (t.name || '').includes(searchTerm) || 
        (t.floor || '').includes(searchTerm)
      )
      .sort((a, b) => getFloorWeight(a.floor) - getFloorWeight(b.floor));
  }, [tenants, searchTerm]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    const tableRows = filteredList.map((item, idx) => `
      <tr>
        <td style="width: 40px;">${idx + 1}</td>
        <td style="width: 200px; font-weight: bold; text-align: center;">${item.name}</td>
        <td style="width: 80px;">${item.floor}</td>
        <td style="width: 90px;">${item.area}</td>
        <td style="width: 90px; font-weight: bold; color: #059669;">${item.refPower}</td>
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
            .print-page { width: 210mm; min-height: 297mm; padding: 25mm 15mm 15mm 15mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
            h1 { text-align: center; border-bottom: 3px solid black; padding-bottom: 10px; margin-bottom: 30px; font-size: 26pt; font-weight: 900; margin-top: 0; letter-spacing: -1px; }
            table { width: 100%; border-collapse: collapse; font-size: 10pt; border: 1.5px solid black; table-layout: fixed; }
            th, td { border: 1px solid black; padding: 4px 2px; text-align: center; word-break: break-all; height: 26px; }
            th { background-color: #f3f4f6; font-weight: bold; font-size: 11pt; }
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

  const inputClass = (isEditing: boolean) => `w-full h-full text-center outline-none bg-transparent text-black text-[13px] p-1 font-medium ${isEditing ? 'bg-orange-50 focus:ring-1 focus:ring-blue-400' : 'cursor-default'}`;
  const headerClass = "border border-gray-300 bg-gray-50 text-center font-bold text-[13px] p-2 text-gray-700";
  const cellClass = (isEditing: boolean) => `border border-gray-300 p-0 h-11 align-middle relative transition-colors ${isEditing ? 'bg-orange-50/50' : 'bg-white group-hover:bg-gray-50/30'}`;

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
    <div className="p-4 sm:p-6 max-w-full mx-auto space-y-6 animate-fade-in relative pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200 print:hidden">
        <div className="relative w-[320px]">
          <input 
            type="text" 
            placeholder="검색 (입주사, 층)" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white text-black shadow-inner font-bold"
          />
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
        </div>
        <div className="flex items-center space-x-2 justify-end flex-1">
          <button onClick={loadData} className="flex items-center gap-2 px-4 py-2.5 bg-white text-emerald-600 border border-emerald-200 rounded-xl font-bold shadow-sm hover:bg-emerald-50 transition-all active:scale-95 text-sm">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>새로고침</span>
          </button>
          <button onClick={() => openIndependentWindow()} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-md text-sm font-black active:scale-95">
            <UserPlus size={18} />
            <span>입주사등록</span>
          </button>
          <button onClick={handleExecuteSave} disabled={saveStatus === 'loading'} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black shadow-md transition-all text-sm active:scale-95 ${saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {saveStatus === 'loading' ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            <span>서버저장</span>
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 bg-orange-600 text-white px-5 py-2.5 rounded-xl hover:bg-orange-700 transition-all shadow-md text-sm font-bold active:scale-95">
            <Printer size={18} />
            <span>미리보기</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-300 overflow-hidden min-w-[850px]">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr>
              <th className={`${headerClass} w-14`}>No</th>
              <th className={headerClass}>입주사명</th>
              <th className={`${headerClass} w-24`}>층 별</th>
              <th className={`${headerClass} w-32`}>전용면적</th>
              <th className={`${headerClass} w-32`}>기준전력(월)</th>
              <th className={headerClass}>비 고</th>
              <th className={`${headerClass} w-28 print:hidden`}>관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredList.length === 0 ? (
              <tr><td colSpan={7} className="py-24 text-center text-gray-400 italic font-medium">등록된 입주사 정보가 없습니다.</td></tr>
            ) : (
              filteredList.map((item, idx) => {
                const isEditing = editingId === item.id;
                return (
                  <tr key={item.id} className={`group ${isEditing ? 'bg-orange-50' : ''}`}>
                    <td className="border border-gray-300 bg-gray-50/30 text-[11px] text-gray-400 font-mono">{idx + 1}</td>
                    <td className={cellClass(isEditing)}><input type="text" readOnly={!isEditing} className={`${inputClass(isEditing)} font-black text-blue-800`} value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)} /></td>
                    <td className={cellClass(isEditing)}><input type="text" readOnly={!isEditing} className={inputClass(isEditing)} value={item.floor} onChange={(e) => updateItem(item.id, 'floor', e.target.value)} /></td>
                    <td className={cellClass(isEditing)}><input type="text" readOnly={!isEditing} className={inputClass(isEditing)} value={item.area} onChange={(e) => updateItem(item.id, 'area', e.target.value)} /></td>
                    <td className={cellClass(isEditing)}><input type="text" readOnly={!isEditing} className={`${inputClass(isEditing)} font-bold text-emerald-600`} value={item.refPower} onChange={(e) => updateItem(item.id, 'refPower', e.target.value)} /></td>
                    <td className={cellClass(isEditing)}><input type="text" readOnly={!isEditing} className={`${inputClass(isEditing)} !text-left px-3 text-gray-500`} value={item.note} onChange={(e) => updateItem(item.id, 'note', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0 print:hidden text-center bg-white relative">
                      <div className="flex items-center justify-center gap-1 p-1">
                        <button onClick={() => handleToggleEdit(item.id)} className={`p-2 rounded-lg transition-all ${isEditing ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-100'}`}>{isEditing ? <Check size={16} /> : <Edit2 size={16} />}</button>
                        <button onClick={() => handleDeleteRequest(item.id)} className="p-2 bg-red-50 text-red-400 hover:bg-red-600 hover:text-white border border-red-100 transition-all rounded-lg"><Trash2 size={16} /></button>
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
