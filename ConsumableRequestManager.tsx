
import React, { useState, useEffect, useMemo } from 'react';
import { ConsumableRequest, ConsumableRequestItem, ConsumableItem, StaffMember } from '../types';
import { fetchConsumableRequests, saveConsumableRequests, fetchConsumables, fetchStaffList } from '../services/dataService';
import { Plus, Save, Printer, Trash2, Edit2, ChevronLeft, ChevronRight, RefreshCw, Sparkles, Cloud, X, CheckCircle, PackageSearch, Lock, Unlock } from 'lucide-react';
import { format, subMonths, addMonths, parseISO } from 'date-fns';

interface ConsumableRequestManagerProps {
  onBack?: () => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);
const SECTIONS = [
  { key: '전기', label: '1. 전기' },
  { key: '소방', label: '2. 소방' },
  { key: '기계', label: '3. 기계' },
  { key: '공용', label: '4. 공용' }
];

const ConsumableRequestManager: React.FC<ConsumableRequestManagerProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<ConsumableRequest[]>([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [activeRequest, setActiveRequest] = useState<ConsumableRequest | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const determineDrafter = (staffList: StaffMember[]): string => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const activeFacilityStaff = staffList.filter(s => 
      s.category === '시설' && 
      (!s.resignDate || s.resignDate === '' || s.resignDate > todayStr)
    );

    // 대리 우선 순위
    const deputy = activeFacilityStaff.find(s => (s.jobTitle || '').includes('대리'));
    if (deputy) return deputy.name;

    // 주임 순위
    const chief = activeFacilityStaff.find(s => (s.jobTitle || '').includes('주임'));
    if (chief) return chief.name;

    return '';
  };

  const loadData = async () => {
    setLoading(true);
    setIsEditMode(false);
    const [reqData, staffData] = await Promise.all([
      fetchConsumableRequests(),
      fetchStaffList()
    ]);
    
    const allRequests = reqData || [];
    setRequests(allRequests);
    
    const autoDrafter = determineDrafter(staffData || []);
    syncRequestToDate(viewDate, allRequests, autoDrafter);
    setLoading(false);
  };

  const syncRequestToDate = (date: Date, allRequests: ConsumableRequest[], autoDrafter: string) => {
    const monthKey = format(date, 'yyyy-MM');
    const existing = allRequests.find(r => r.date.startsWith(monthKey));
    
    if (existing) {
      // 기존 데이터가 있으면 해당 데이터를 유지 (날짜 우선순위 적용됨)
      setActiveRequest({
        ...existing,
        drafter: existing.drafter || autoDrafter
      });
    } else {
      // 신규 데이터 생성
      const items: ConsumableRequestItem[] = [];
      SECTIONS.forEach(sec => {
        for (let i = 0; i < 5; i++) {
          items.push({ 
            id: generateId(), 
            category: sec.key, 
            itemName: '', 
            spec: '', // 모델명 대용
            stock: '', 
            qty: '', 
            receivedDate: '', 
            remarks: '', 
            amount: 0 
          });
        }
      });
      setActiveRequest({
        id: generateId(),
        date: format(date, 'yyyy-MM-dd'),
        department: '시설관리팀',
        drafter: autoDrafter,
        items,
        totalAmount: 0,
        status: '작성중'
      });
    }
  };

  const handleLoadMaterials = async () => {
    if (!activeRequest) return;
    setLoading(true);
    try {
      const ledgerItems = await fetchConsumables();
      
      // 재고 요약 계산 (적정재고 미달 품목 추출)
      const groups: Record<string, { lastItem: ConsumableItem, totalIn: number, totalOut: number }> = {};
      ledgerItems.forEach(item => {
        const key = `${item.category}_${item.itemName}_${item.modelName || ''}`;
        const inQ = parseFloat(String(item.inQty || '0').replace(/,/g, '')) || 0;
        const outQ = parseFloat(String(item.outQty || '0').replace(/,/g, '')) || 0;
        if (!groups[key]) {
          groups[key] = { lastItem: item, totalIn: inQ, totalOut: outQ };
        } else {
          groups[key].totalIn += inQ;
          groups[key].totalOut += outQ;
          if (new Date(item.date) >= new Date(groups[key].lastItem.date)) {
            groups[key].lastItem = item;
          }
        }
      });

      const lowStockItems = Object.values(groups)
        .map(g => ({ ...g.lastItem, currentStock: g.totalIn - g.totalOut }))
        .filter(item => item.currentStock < (parseFloat(item.minStock || '5') || 5));

      const newItems: ConsumableRequestItem[] = [];
      SECTIONS.forEach(sec => {
        const matchingLedger = lowStockItems.filter(l => l.category === sec.key);
        matchingLedger.forEach(l => {
          newItems.push({
            id: generateId(),
            category: sec.key,
            itemName: l.itemName,
            spec: l.modelName || '',
            stock: l.currentStock.toString(),
            qty: '',
            receivedDate: '',
            remarks: '',
            amount: 0
          });
        });
        // 최소 5행 유지
        const currentCount = newItems.filter(ni => ni.category === sec.key).length;
        if (currentCount < 5) {
          for (let i = 0; i < (5 - currentCount); i++) {
            newItems.push({ id: generateId(), category: sec.key, itemName: '', spec: '', stock: '', qty: '', receivedDate: '', remarks: '', amount: 0 });
          }
        }
      });

      setActiveRequest({ ...activeRequest, items: newItems });
      setIsEditMode(true);
      alert(`${lowStockItems.length}개의 부족 자재를 불러왔습니다.`);
    } catch (e) {
      alert('자재 불러오기 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveForm = async () => {
    if (!activeRequest) return;
    setShowSaveConfirm(false);
    setLoading(true);

    // 품명이 비어 있는 행을 필터링하여 리스트를 위로 정렬(압축)함
    const compressedItems = activeRequest.items.filter(it => it.itemName.trim() !== '');
    
    // 만약 품명이 하나도 없으면 저장하지 않거나 경고를 띄울 수 있음 (여기서는 빈 배열로 저장 허용)
    const finalRequest = { ...activeRequest, items: compressedItems };

    let newList = [...requests];
    const idx = newList.findIndex(r => r.id === activeRequest.id);
    if (idx >= 0) newList[idx] = finalRequest;
    else newList = [finalRequest, ...newList];
    
    if (await saveConsumableRequests(newList)) {
      alert('서버에 저장되었습니다.');
      setRequests(newList);
      setActiveRequest(finalRequest); // 로컬 상태도 압축된 데이터로 업데이트
      setIsEditMode(false);
    }
    setLoading(false);
  };

  const handleDeleteItem = (id: string) => {
    if (!activeRequest) return;
    const ni = activeRequest.items.filter(i => i.id !== id);
    setActiveRequest({ ...activeRequest, items: ni });
  };

  const handlePrint = () => {
    if (!activeRequest) return;
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;
    const title = `${format(viewDate, 'yyyy년 MM월')} 소모품자재 구입 신청서`;

    const sectionsHtml = SECTIONS.map(sec => {
      const its = activeRequest.items.filter(i => i.category === sec.key);
      return `
        <div style="break-inside: avoid; margin-bottom: 2px;">
          <h3 style="font-size: 13pt; font-weight: bold; margin-bottom: 6px; border-left: 7px solid black; padding-left: 10px; margin-top: 15px;">${sec.label}</h3>
          <table style="width: 100%; border-collapse: collapse; border: 1.5px solid black; table-layout: fixed;">
            <thead><tr style="background:#f2f2f2; height:30px;">
              <th style="width: 40px;">No</th>
              <th style="width: 120px;">품 명</th>
              <th style="width: 120px;">모델명</th>
              <th style="width: 60px;">재고</th>
              <th style="width: 60px;">수량</th>
              <th style="width: 80px;">입고일</th>
              <th>비 고</th>
            </tr></thead>
            <tbody>${its.map((item, idx) => `
              <tr style="height:28px;">
                <td>${idx+1}</td>
                <td>${item.itemName || ''}</td>
                <td>${item.spec || ''}</td>
                <td>${item.stock || ''}</td>
                <td style="font-weight:bold; color:blue;">${item.qty || ''}</td>
                <td>${item.receivedDate || ''}</td>
                <td>${item.remarks || ''}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html><head><title>${title}</title><style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
        @page { size: A4 portrait; margin: 0; }
        body { font-family: "Noto Sans KR", sans-serif; background: #f1f5f9; padding: 0; margin: 0; -webkit-print-color-adjust: exact; }
        .no-print { display: flex; justify-content: center; padding: 20px; }
        @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; } }
        .print-page { width: 210mm; min-height: 297mm; padding: 25mm 12mm 10mm 12mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
        .header-title { text-align: center; font-size: 26pt; font-weight: 900; text-decoration: underline; text-underline-offset: 8px; margin-bottom: 35px; }
        .meta-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold; font-size: 11pt; padding: 0 5px; }
        table { border-collapse: collapse; border: 1.5px solid black; }
        th, td { border: 1px solid black; text-align: center; height: 26px; font-size: 9pt; }
      </style></head><body>
        <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
        <div class="print-page"><div class="header-title">${title}</div><div class="meta-info"><div>신청일자 : ${activeRequest.date}</div><div>신청부서 : ${activeRequest.department}</div><div>작 성 자 : ${activeRequest.drafter}</div></div>${sectionsHtml}</div>
      </body></html>`);
    printWindow.document.close();
  };

  const handlePrevMonth = () => {
    const prev = subMonths(viewDate, 1);
    setViewDate(prev);
    syncRequestToDate(prev, requests, activeRequest?.drafter || '');
  };

  const handleNextMonth = () => {
    const next = addMonths(viewDate, 1);
    setViewDate(next);
    syncRequestToDate(next, requests, activeRequest?.drafter || '');
  };

  // 주차관리 스타일 클래스 정의
  const thClass = "border border-gray-300 p-2 bg-gray-50/80 font-bold text-center text-[12px] text-gray-700 h-10 align-middle uppercase tracking-tighter";
  const tdClass = "border border-gray-300 p-0 h-10 align-middle relative bg-white transition-colors hover:bg-gray-50/50";
  const inputClass = "w-full h-full text-center outline-none bg-transparent text-black text-[12px] font-medium p-1 focus:bg-blue-50/50";
  const editableInputClass = "w-full h-full text-center outline-none bg-orange-50/30 text-blue-700 text-[12px] font-bold p-1 focus:bg-orange-100/50 focus:ring-1 focus:ring-orange-200";

  return (
    <div className="p-4 sm:p-6 max-w-full mx-auto space-y-6 bg-white min-h-screen text-black relative pb-32 animate-fade-in">
      {/* 툴바 상단 영역 */}
      <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-200 pb-4 print:hidden gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-all"><ChevronLeft size={24} /></button>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">{format(viewDate, 'yyyy년 MM월')}</h2>
          <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-all"><ChevronRight size={24} /></button>
        </div>
        
        <div className="flex flex-wrap gap-2 justify-center">
          <button onClick={loadData} disabled={loading} className="flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold border border-gray-200 shadow-sm hover:bg-gray-200 transition-all text-[13px]">
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> 새로고침
          </button>
          
          <button onClick={handleLoadMaterials} disabled={loading} className="flex items-center px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold border border-emerald-200 shadow-sm hover:bg-emerald-100 transition-all text-[13px]">
            <PackageSearch size={18} className="mr-2" /> 자재불러오기
          </button>

          <button onClick={() => setIsEditMode(!isEditMode)} className={`flex items-center px-4 py-2 rounded-xl font-bold border shadow-sm transition-all text-[13px] ${isEditMode ? 'bg-orange-500 text-white border-orange-600 shadow-orange-100' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`}>
            {isEditMode ? <Lock size={18} className="mr-2" /> : <Edit2 size={18} className="mr-2" />} {isEditMode ? '수정완료' : '수정'}
          </button>

          <button onClick={() => setShowSaveConfirm(true)} disabled={loading} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all text-[13px] active:scale-95">
            <Save size={18} className="mr-2" /> 서버저장
          </button>

          <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-slate-700 text-white rounded-xl font-bold shadow-md hover:bg-slate-800 transition-all text-[13px] active:scale-95">
            <Printer size={18} className="mr-2" /> 미리보기
          </button>
        </div>
      </div>

      {/* 헤더 정보 영역 */}
      <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-200 shadow-inner">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col">
            <label className="text-[11px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">신청일자</label>
            <input 
              type="date" 
              value={activeRequest?.date || ''} 
              onChange={e => setActiveRequest(p => p ? { ...p, date: e.target.value } : null)} 
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 transition-all" 
              readOnly={!isEditMode}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[11px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">신청부서</label>
            <input 
              type="text" 
              value={activeRequest?.department || ''} 
              onChange={e => setActiveRequest(p => p ? { ...p, department: e.target.value } : null)} 
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 transition-all" 
              readOnly={!isEditMode}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[11px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">작성자</label>
            <div className="relative">
              <input 
                type="text" 
                value={activeRequest?.drafter || ''} 
                onChange={e => setActiveRequest(p => p ? { ...p, drafter: e.target.value } : null)} 
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                readOnly={!isEditMode}
                placeholder="성명"
              />
              <Sparkles className="absolute right-4 top-3 text-blue-300 pointer-events-none" size={16} />
            </div>
          </div>
        </div>
      </div>

      {/* 테이블 섹션 영역 */}
      <div className="space-y-10">
        {SECTIONS.map(sec => (
          <div key={sec.key} className="animate-fade-in-down">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-6 bg-gray-800 rounded-full"></div>
              <h3 className="text-lg font-black text-gray-800">{sec.label}</h3>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className={`${thClass} w-12`}>No</th>
                    <th className={`${thClass} w-[120px]`}>품 명</th>
                    <th className={`${thClass} w-[120px]`}>모델명</th>
                    <th className={`${thClass} w-24`}>재고</th>
                    <th className={`${thClass} w-24`}>수량</th>
                    <th className={`${thClass} w-32`}>입고일</th>
                    <th className={thClass}>비 고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {activeRequest?.items.filter(i => i.category === sec.key).map((it, idx) => (
                    <tr key={it.id} className="hover:bg-gray-50/50 transition-colors divide-x divide-gray-100 group">
                      <td className="border border-gray-200 text-center font-mono text-[11px] text-gray-400 bg-gray-50/30 relative">
                        <span className={isEditMode ? "group-hover:opacity-0" : ""}>{idx + 1}</span>
                        {isEditMode && (
                          <button 
                            onClick={() => handleDeleteItem(it.id)}
                            className="absolute inset-0 flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="항목 삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                      <td className={tdClass}>
                        <input 
                          type="text" 
                          value={it.itemName} 
                          onChange={e => {
                            const ni = activeRequest.items.map(i => i.id === it.id ? { ...i, itemName: e.target.value } : i);
                            setActiveRequest({ ...activeRequest, items: ni });
                          }} 
                          className={isEditMode ? editableInputClass : inputClass}
                          readOnly={!isEditMode}
                        />
                      </td>
                      <td className={tdClass}>
                        <input 
                          type="text" 
                          value={it.spec || ''} 
                          onChange={e => {
                            const ni = activeRequest.items.map(i => i.id === it.id ? { ...i, spec: e.target.value } : i);
                            setActiveRequest({ ...activeRequest, items: ni });
                          }} 
                          className={isEditMode ? editableInputClass : inputClass}
                          readOnly={!isEditMode}
                          placeholder="모델명"
                        />
                      </td>
                      <td className={`${tdClass} bg-gray-50/30`}>
                        <input 
                          type="text" 
                          value={it.stock} 
                          onChange={e => {
                            const ni = activeRequest.items.map(i => i.id === it.id ? { ...i, stock: e.target.value } : i);
                            setActiveRequest({ ...activeRequest, items: ni });
                          }} 
                          className={`${inputClass} font-bold text-gray-500`}
                          readOnly={!isEditMode}
                        />
                      </td>
                      <td className={tdClass}>
                        <input 
                          type="text" 
                          value={it.qty} 
                          onChange={e => {
                            const ni = activeRequest.items.map(i => i.id === it.id ? { ...i, qty: e.target.value } : i);
                            setActiveRequest({ ...activeRequest, items: ni });
                          }} 
                          className={editableInputClass}
                          readOnly={!isEditMode}
                          placeholder="수량"
                        />
                      </td>
                      <td className={tdClass}>
                        <input 
                          type="text" 
                          value={it.receivedDate} 
                          onChange={e => {
                            const ni = activeRequest.items.map(i => i.id === it.id ? { ...i, receivedDate: e.target.value } : i);
                            setActiveRequest({ ...activeRequest, items: ni });
                          }} 
                          className={editableInputClass}
                          readOnly={!isEditMode}
                          placeholder="00/00"
                        />
                      </td>
                      <td className={tdClass}>
                        <input 
                          type="text" 
                          value={it.remarks} 
                          onChange={e => {
                            const ni = activeRequest.items.map(i => i.id === it.id ? { ...i, remarks: e.target.value } : i);
                            setActiveRequest({ ...activeRequest, items: ni });
                          }} 
                          className={isEditMode ? editableInputClass : inputClass}
                          readOnly={!isEditMode}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
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
                작성하신 자재 구입 신청서 내용을<br/>
                서버에 안전하게 기록하시겠습니까?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center"><X size={20} className="mr-2" />취소</button>
                <button onClick={handleSaveForm} className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95"><CheckCircle size={20} className="mr-2" />확인</button>
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
        .animate-fade-in-down {
          animation: fadeInDown 0.4s ease-out forwards;
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ConsumableRequestManager;
