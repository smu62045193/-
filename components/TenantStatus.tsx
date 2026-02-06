
import React, { useState, useEffect, useMemo } from 'react';
import { Tenant } from '../types';
import { fetchTenants, saveTenants } from '../services/dataService';
import { Save, Plus, Trash2, Search, Printer, RefreshCw, Cloud, X, CheckCircle2, AlertTriangle, Edit2, Check } from 'lucide-react';
import { format } from 'date-fns';

const generateId = () => Math.random().toString(36).substr(2, 9);

// 층별 정렬 순서 계산 함수
const getFloorWeight = (floor: string) => {
  const f = floor.trim().toUpperCase();
  if (!f) return 9999;
  
  // 지하층 처리 (B1, B2... 또는 지하1층...)
  if (f.startsWith('B') || f.includes('지하')) {
    const num = parseInt(f.replace(/[^0-9]/g, '')) || 0;
    return 1000 + num; // B1 = 1001, B2 = 1002...
  }
  
  // 옥상 처리
  if (f === 'RF' || f === '옥상' || f.includes('옥탑')) return 999;
  
  // 지상층 처리 (1F, 2F... 또는 1층, 2층...)
  const num = parseInt(f.replace(/[^0-9]/g, '')) || 0;
  return num; // 1층 = 1, 2층 = 2...
};

const TenantStatus: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 수정 중인 행 ID 관리
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchTenants();
    setTenants(data || []);
    setLoading(false);
    setEditingId(null);
  };

  const handleExecuteSave = async () => {
    setSaveStatus('loading');
    try {
      // 저장 전 최종 정렬
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

  const handleAdd = () => {
    const newId = generateId();
    const newItem: Tenant = {
      id: newId,
      floor: '',
      name: '',
      area: '',
      refPower: '2380',
      contact: '',
      note: '일반'
    };
    setTenants([newItem, ...tenants]);
    setEditingId(newId); // 추가 즉시 수정 모드
  };

  const handleDeleteRequest = async (id: string) => {
    const idStr = String(id);
    const originalTenants = [...tenants];
    const newTenants = originalTenants.filter(t => String(t.id) !== idStr);
    
    setTenants(newTenants);
    if (editingId === idStr) setEditingId(null);
    
    try {
      const success = await saveTenants(newTenants);
      if (success) {
        alert('삭제가 완료되었습니다.');
      } else {
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

  const handleToggleEdit = (id: string) => {
    if (editingId === id) {
      setEditingId(null);
      // 수정 완료 시 리스트 재정렬
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
            @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; } }
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

  const inputClass = (isEditing: boolean) => `w-full h-full text-center outline-none bg-transparent text-black text-[13px] p-1 font-medium ${isEditing ? 'bg-orange-50 focus:ring-1 focus:ring-blue-400' : 'cursor-default'}`;
  const headerClass = "border border-gray-300 bg-gray-50 text-center font-bold text-[13px] p-2 text-gray-700";
  const cellClass = (isEditing: boolean) => `border border-gray-300 p-0 h-11 align-middle relative transition-colors ${isEditing ? 'bg-orange-50/50' : 'bg-white group-hover:bg-gray-50/30'}`;

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
            <Search className="absolute left-3.5 top-2.5 text-gray-400 w-4 h-4" />
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
              <th className={`${headerClass} w-28 print:hidden`}>관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-20 text-gray-400 italic font-medium">등록된 입주사 정보가 없습니다.</td>
              </tr>
            ) : (
              filteredList.map((item, idx) => {
                const isEditing = editingId === item.id;
                return (
                  <tr key={item.id} className={`group ${isEditing ? 'bg-orange-50' : ''}`}>
                    <td className="border border-gray-300 bg-gray-50/30 text-[11px] text-gray-400 font-mono">{idx + 1}</td>
                    <td className={cellClass(isEditing)}>
                      <input 
                        type="text" 
                        readOnly={!isEditing}
                        className={`${inputClass(isEditing)} font-black text-blue-800`} 
                        value={item.name} 
                        onChange={(e) => updateItem(item.id, 'name', e.target.value)} 
                      />
                    </td>
                    <td className={cellClass(isEditing)}>
                      <input 
                        type="text" 
                        readOnly={!isEditing}
                        className={inputClass(isEditing)} 
                        value={item.floor} 
                        onChange={(e) => updateItem(item.id, 'floor', e.target.value)} 
                      />
                    </td>
                    <td className={cellClass(isEditing)}>
                      <input 
                        type="text" 
                        readOnly={!isEditing}
                        className={inputClass(isEditing)} 
                        value={item.area} 
                        onChange={(e) => updateItem(item.id, 'area', e.target.value)} 
                      />
                    </td>
                    <td className={cellClass(isEditing)}>
                      <input 
                        type="text" 
                        readOnly={!isEditing}
                        className={`${inputClass(isEditing)} font-bold text-emerald-600`} 
                        value={item.refPower} 
                        onChange={(e) => updateItem(item.id, 'refPower', e.target.value)} 
                      />
                    </td>
                    <td className={cellClass(isEditing)}>
                      <input 
                        type="text" 
                        readOnly={!isEditing}
                        className={`${inputClass(isEditing)} !text-left px-3 text-gray-500`} 
                        value={item.note} 
                        onChange={(e) => updateItem(item.id, 'note', e.target.value)} 
                      />
                    </td>
                    <td className="border border-gray-300 p-0 print:hidden text-center bg-white relative">
                      <div className="flex items-center justify-center gap-1 p-1">
                        <button 
                          onClick={() => handleToggleEdit(item.id)}
                          className={`p-2 rounded-lg transition-all ${isEditing ? 'bg-blue-600 text-white shadow-md' : 'text-blue-500 hover:bg-blue-50'}`}
                          title={isEditing ? "수정 완료" : "수정하기"}
                        >
                          {isEditing ? <Check size={16} /> : <Edit2 size={16} />}
                        </button>
                        <button 
                          onClick={() => handleDeleteRequest(item.id)} 
                          className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 transition-all rounded-lg"
                          title="삭제하기"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
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

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 flex justify-center lg:static lg:bg-transparent lg:border-none lg:p-0 mt-12 z-40 print:hidden">
        <button 
          onClick={handleExecuteSave} 
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
