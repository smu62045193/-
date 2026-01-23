import React, { useState, useEffect } from 'react';
import { Tenant } from '../types';
import { fetchTenants, saveTenants } from '../services/dataService';
import { Save, Plus, Trash2, Search, Printer, RefreshCw, Cloud, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const generateId = () => Math.random().toString(36).substr(2, 9);

const TenantStatus: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchTenants();
    setTenants(data || []);
    setLoading(false);
  };

  const handleSaveClick = () => {
    setShowSaveConfirm(true);
  };

  const handleExecuteSave = async () => {
    setShowSaveConfirm(false);
    setSaveStatus('loading');
    try {
      const success = await saveTenants(tenants);
      if (success) {
        setSaveStatus('success');
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

  const handleAdd = () => {
    const newItem: Tenant = {
      id: generateId(),
      floor: '',
      name: '',
      area: '',
      refPower: '2380',
      contact: '',
      note: '일반'
    };
    setTenants([...tenants, newItem]);
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;

    const idStr = String(deleteTargetId);
    const originalTenants = [...tenants];
    const newTenants = originalTenants.filter(t => String(t.id) !== idStr);
    
    setTenants(newTenants);
    setDeleteTargetId(null);
    
    try {
      const success = await saveTenants(newTenants);
      if (!success) {
        setTenants(originalTenants);
        alert('삭제 실패 (서버 저장 오류)');
      }
    } catch (e) {
      console.error(e);
      setTenants(originalTenants);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const updateItem = (id: string, field: keyof Tenant, value: string) => {
    setTenants(tenants.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const filteredList = tenants.filter(t => 
    (t.name || '').includes(searchTerm) || 
    (t.floor || '').includes(searchTerm)
  );

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    const tableRows = filteredList.map((item, idx) => `
      <tr>
        <td style="width:40px;">${idx + 1}</td>
        <td style="text-align:center; font-weight:bold;">${item.name}</td>
        <td style="width:60px;">${item.floor}</td>
        <td style="width:80px;">${item.area}</td>
        <td style="width:100px; font-weight:bold; color:#059669;">${item.refPower}</td>
        <td style="text-align:left; padding-left:10px;">${item.note}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <html>
        <head>
          <title>입주사 현황 미리보기</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
            @page { size: A4 portrait; margin: 0; }
            body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; background: #f1f5f9; color: black; line-height: 1.2; -webkit-print-color-adjust: exact; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { .no-print { display: none !important; } body { background: white !important; } }
            .print-page { width: 210mm; min-height: 297mm; padding: 25mm 12mm 10mm 12mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
            @media print { .print-page { box-shadow: none !important; margin: 0 !important; } }
            table { width: 100%; border-collapse: collapse; border: 1.5px solid black; }
            th, td { border: 1px solid black; padding: 8px 4px; text-align: center; font-size: 10pt; }
            th { background: #f3f4f6; font-weight: bold; }
            .title-area { text-align: center; margin-bottom: 20px; }
            .doc-title { font-size: 28pt; font-weight: 900; text-decoration: underline; text-underline-offset: 8px; margin: 0; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
          <div class="print-page">
            <div class="title-area">
              <h1 class="doc-title">입주사 현황</h1>
            </div>
            <div style="text-align:right; font-weight:bold; margin-bottom:12px; font-size:11pt;">작성일 : ${format(new Date(), 'yyyy년 MM월 dd일')}</div>
            <table>
              <thead>
                <tr><th>No</th><th>입주사명</th><th style="width:60px;">층 별</th><th style="width:80px;">전용면적</th><th style="width:100px;">기준전력(월)</th><th>비 고</th></tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const inputClass = "w-full h-full text-center outline-none bg-transparent text-black text-[13px] p-1 font-medium";
  const headerClass = "border border-gray-300 bg-gray-50 text-center font-bold text-[13px] p-2 text-gray-700";
  const cellClass = "border border-gray-300 p-0 h-11 align-middle relative group hover:bg-gray-50/50 transition-colors";

  return (
    <div className="p-4 sm:p-6 max-w-full mx-auto space-y-6 animate-fade-in relative pb-32">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200 print:hidden">
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input 
              type="text" 
              placeholder="검색 (입주사, 층)" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white text-black shadow-inner"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          </div>
          <button onClick={loadData} className="p-2.5 hover:bg-gray-100 rounded-xl text-gray-500 border border-gray-200 bg-white shadow-sm transition-all active:scale-95">
            <RefreshCw size={18} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          <button onClick={handlePrint} className="flex items-center space-x-2 bg-slate-700 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 transition-all shadow-md text-sm font-bold active:scale-95">
            <Printer size={18} />
            <span>미리보기</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-300 overflow-hidden min-w-[850px]">
        <div className="p-5 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
            <h3 className="text-lg font-black text-gray-800 tracking-tight">입주사 현황 마스터 DB</h3>
            <span className="text-xs text-gray-400 font-bold tracking-widest uppercase">작성일 : {format(new Date(), 'yyyy.MM.dd')}</span>
        </div>
        <table className="w-full border-collapse text-center">
          <thead>
            <tr>
              <th className={`${headerClass} w-14`}>No</th>
              <th className={headerClass}>입주사명</th>
              <th className={`${headerClass} w-24`}>층 별</th>
              <th className={`${headerClass} w-32`}>전용면적</th>
              <th className={`${headerClass} w-32`}>기준전력(월)</th>
              <th className={headerClass}>비 고</th>
              <th className={`${headerClass} w-16 print:hidden`}>관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-20 text-gray-400 italic font-medium">등록된 입주사 정보가 없습니다.</td>
              </tr>
            ) : (
              filteredList.map((item, idx) => (
                <tr key={item.id} className="group">
                  <td className="border border-gray-300 bg-gray-50/30 text-[11px] text-gray-400 font-mono">{idx + 1}</td>
                  <td className={cellClass}>
                    <input type="text" className={`${inputClass} font-black text-blue-800`} value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)} />
                  </td>
                  <td className={cellClass}>
                    <input type="text" className={inputClass} value={item.floor} onChange={(e) => updateItem(item.id, 'floor', e.target.value)} />
                  </td>
                  <td className={cellClass}>
                    <input type="text" className={inputClass} value={item.area} onChange={(e) => updateItem(item.id, 'area', e.target.value)} />
                  </td>
                  <td className={cellClass}>
                    <input type="text" className={`${inputClass} font-bold text-emerald-600`} value={item.refPower} onChange={(e) => updateItem(item.id, 'refPower', e.target.value)} />
                  </td>
                  <td className={cellClass}>
                    <input type="text" className={`${inputClass} !text-left px-3 text-gray-500`} value={item.note} onChange={(e) => updateItem(item.id, 'note', e.target.value)} />
                  </td>
                  <td className="border border-gray-300 p-0 print:hidden text-center bg-white relative">
                    <button 
                      onClick={() => handleDeleteRequest(item.id)} 
                      className="text-gray-400 hover:text-red-500 transition-all p-2"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="p-4 bg-gray-50/50 border-t print:hidden">
          <button 
            onClick={handleAdd}
            className="w-full py-3.5 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-600 hover:bg-white transition-all flex items-center justify-center font-black group shadow-inner"
          >
            <Plus size={20} className="mr-2 group-hover:scale-125 transition-transform" />
            새 입주사 정보 추가 (행 추가)
          </button>
        </div>
      </div>

      {/* 업무일지와 동일한 하단 고정 저장 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 flex justify-center lg:static lg:bg-transparent lg:border-none lg:p-0 mt-12 z-40 print:hidden">
        <button 
          onClick={handleSaveClick} 
          disabled={saveStatus === 'loading'} 
          className={`px-10 py-4 rounded-2xl shadow-xl transition-all duration-300 font-bold text-xl flex items-center justify-center space-x-3 w-full max-w-2xl active:scale-95 ${
            saveStatus === 'loading' ? 'bg-blue-400 text-white cursor-wait' : 
            saveStatus === 'success' ? 'bg-green-600 text-white' : 
            saveStatus === 'error' ? 'bg-red-600 text-white' : 
            'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {saveStatus === 'loading' ? (
            <><RefreshCw size={24} className="animate-spin" /><span>데이터 동기화 중...</span></>
          ) : saveStatus === 'success' ? (
            <><CheckCircle2 size={24} /><span>저장 완료</span></>
          ) : (
            <><Save size={24} /><span>입주사 현황 전체 저장</span></>
          )}
        </button>
      </div>

      {/* 업무일지와 동일한 통합 저장 확인 모달 */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-blue-100">
                <Cloud className="text-blue-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">입주사 정보 통합 저장</h3>
              <p className="text-gray-500 mb-8 leading-relaxed font-medium">
                작성하신 <span className="text-blue-600 font-bold">모든 입주사 명단과 정보</span>를<br/>
                서버에 안전하게 기록하시겠습니까?
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowSaveConfirm(false)} 
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors flex items-center justify-center active:scale-95"
                >
                  <X size={18} className="mr-2" />
                  취소
                </button>
                <button 
                  onClick={handleExecuteSave} 
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center active:scale-95"
                >
                  <CheckCircle2 size={18} className="mr-2" />
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 데이터 삭제 확인 모달 */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-red-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-100">
                <AlertTriangle className="text-red-600" size={36} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">데이터 삭제 확인</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                선택하신 입주사 정보를 마스터 DB에서<br/>
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

export default TenantStatus;