
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
  { key: '전기', label: '전기' },
  { key: '소방', label: '소방' },
  { key: '기계', label: '기계' },
  { key: '공용', label: '공용' }
];

const ConsumableRequestManager: React.FC<ConsumableRequestManagerProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<ConsumableRequest[]>([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [activeRequest, setActiveRequest] = useState<ConsumableRequest | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const determineDrafter = (staffList: StaffMember[]): string => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const activeFacilityStaff = staffList.filter(s => 
      s.category === '시설' && 
      (!s.resignDate || s.resignDate === '' || s.resignDate > todayStr)
    );

    const deputy = activeFacilityStaff.find(s => (s.jobTitle || '').includes('대리'));
    if ( deputy ) return deputy.name;

    const chief = activeFacilityStaff.find(s => (s.jobTitle || '').includes('주임'));
    if ( chief ) return chief.name;

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
      // 기존 문서가 있을 경우: 각 섹션별로 최소 5행을 유지하도록 가공
      const baseItems = [...existing.items];
      const processedItems: ConsumableRequestItem[] = [];

      SECTIONS.forEach(sec => {
        const sectionItems = baseItems.filter(it => it.category === sec.key);
        processedItems.push(...sectionItems);
        
        // 해당 섹션의 아이템이 5개 미만이면 빈 행 추가
        const deficit = 5 - sectionItems.length;
        if (deficit > 0) {
          for (let i = 0; i < deficit; i++) {
            processedItems.push({ 
              id: generateId(), 
              category: sec.key, 
              itemName: '', 
              spec: '', 
              stock: '', 
              qty: '', 
              receivedDate: '', 
              remarks: '', 
              amount: 0 
            });
          }
        }
      });

      setActiveRequest({
        ...existing,
        items: processedItems,
        drafter: existing.drafter || autoDrafter
      });
    } else {
      // 신규 문서 생성 시: 각 섹션별로 5행씩 생성
      const items: ConsumableRequestItem[] = [];
      SECTIONS.forEach(sec => {
        for (let i = 0; i < 5; i++) {
          items.push({ 
            id: generateId(), 
            category: sec.key, 
            itemName: '', 
            spec: '', 
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
        arrivalDate: '',
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
        .filter(item => {
          const minStockStr = String(item.minStock || '').trim();
          const threshold = (minStockStr !== '') ? parseFloat(minStockStr) : 5;
          return item.currentStock < threshold;
        });

      const newItems: ConsumableRequestItem[] = [];
      SECTIONS.forEach(sec => {
        const matchingLedger = lowStockItems.filter(l => l.category === sec.key);
        matchingLedger.forEach(l => {
          const itemUnit = l.unit || 'EA';
          newItems.push({
            id: generateId(),
            category: sec.key,
            itemName: l.itemName,
            spec: l.modelName || '',
            stock: `${l.currentStock} ${itemUnit}`,
            qty: ` ${itemUnit}`,
            receivedDate: '',
            remarks: '',
            amount: 0
          });
        });
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

  const toggleEditMode = () => {
    if (!isEditMode && activeRequest) {
      // 수정 모드로 진입할 때 섹션별로 최소 5행이 있는지 확인하고 부족하면 채워넣음
      const currentItems = [...activeRequest.items];
      const paddedItems: ConsumableRequestItem[] = [];

      SECTIONS.forEach(sec => {
        const sectionItems = currentItems.filter(it => it.category === sec.key);
        paddedItems.push(...sectionItems);
        
        const deficit = 5 - sectionItems.length;
        if (deficit > 0) {
          for (let i = 0; i < deficit; i++) {
            paddedItems.push({ 
              id: generateId(), 
              category: sec.key, 
              itemName: '', 
              spec: '', 
              stock: '', 
              qty: '', 
              receivedDate: '', 
              remarks: '', 
              amount: 0 
            });
          }
        }
      });
      setActiveRequest({ ...activeRequest, items: paddedItems });
    }
    setIsEditMode(!isEditMode);
  };

  const handleSaveForm = async () => {
    if (!activeRequest) return;
    setLoading(true);

    const compressedItems = activeRequest.items.filter(it => it.itemName.trim() !== '');
    const finalRequest = { ...activeRequest, items: compressedItems };

    let newList = [...requests];
    const idx = newList.findIndex(r => r.id === activeRequest.id);
    if (idx >= 0) newList[idx] = finalRequest;
    else newList = [finalRequest, ...newList];
    
    if (await saveConsumableRequests(newList)) {
      alert('성공적으로 저장되었습니다.');
      setRequests(newList);
      setActiveRequest(finalRequest);
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
      const its = activeRequest.items.filter(i => i.category === sec.key && i.itemName.trim() !== '');
      return its.length > 0 ? `
        <div style="break-inside: avoid; margin-bottom: 2px;">
          <h3 style="font-size: 13pt; font-weight: bold; margin-bottom: 6px; border-left: 7px solid black; padding-left: 10px; margin-top: 15px;">${sec.label}</h3>
          <table>
            <thead><tr style="background:#f3f4f6; height:30px;">
              <th style="width: 30px;">No</th>
              <th style="width: 120px;">품 명</th>
              <th style="width: 120px;">모델명</th>
              <th style="width: 45px;">재고</th>
              <th style="width: 45px;">수량</th>
              <th style="width: 65px;">입고일</th>
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
      ` : '';
    }).join('');

    printWindow.document.write(`
      <html><head><title>${title}</title><style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
        @page { size: A4 portrait; margin: 0; }
        body { font-family: "Noto Sans KR", sans-serif; background: black; padding: 0; margin: 0; -webkit-print-color-adjust: exact; }
        .no-print { display: flex; justify-content: center; padding: 20px; }
        @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; } }
        .print-page { width: 210mm; min-height: 297mm; padding: 25mm 12mm 10mm 12mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
        h1 { text-align: center; border-bottom: 2.5px solid black; padding-bottom: 10px; margin-bottom: 30px; font-size: 24pt; font-weight: 900; margin-top: 0; }
        .meta-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold; font-size: 9.5pt; padding: 0 5px; }
        table { width: 100%; border-collapse: collapse; font-size: 8.5pt; border: 1.5px solid black; table-layout: fixed; margin-bottom: 15px; }
        th, td { border: 1px solid black; padding: 6px; font-size: 8.5pt; vertical-align: top; text-align: center; word-break: break-all; }
        th { background: #f3f4f6; font-weight: bold; text-align: center; }
      </style></head><body>
        <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
        <div class="print-page"><h1>${title}</h1><div class="meta-info"><div>신청일자 : ${activeRequest.date}</div><div>입고일자 : ${activeRequest.arrivalDate || ''}</div><div>신청부서 : ${activeRequest.department}</div><div>작 성 자 : ${activeRequest.drafter}</div></div>${sectionsHtml}</div>
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

  const thClass = "border border-gray-300 p-2 bg-gray-50 font-bold text-center align-middle text-sm text-gray-700 h-10 whitespace-nowrap";
  const tdClass = "border border-gray-300 px-3 py-2 text-sm text-gray-700 h-10 align-middle bg-white text-center";
  
  const inputClass = "w-full h-full text-center outline-none bg-transparent text-black text-sm font-medium p-1 focus:bg-blue-50/50";
  const editableInputClass = "w-full h-full text-center outline-none bg-orange-50/30 text-blue-700 text-sm font-bold p-1 focus:bg-orange-100/50 focus:ring-1 focus:ring-orange-200";

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-200 print:hidden gap-4">
        <div className="flex items-center space-x-2">
          <button 
            onClick={handlePrevMonth} 
            className="p-1.5 transition-all text-gray-400 hover:text-blue-600 active:scale-90"
          >
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-xl font-black text-gray-800 tracking-tight min-w-[140px] text-center">
            {format(viewDate, 'yyyy년 MM월')}
          </h2>
          <button 
            onClick={handleNextMonth} 
            className="p-1.5 transition-all text-gray-400 hover:text-blue-600 active:scale-90"
          >
            <ChevronRight size={24} />
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2 justify-center">
          <button onClick={loadData} disabled={loading} className="flex items-center px-4 py-2 bg-white text-emerald-600 border border-emerald-200 rounded-xl font-bold shadow-sm hover:bg-emerald-50 transition-all active:scale-95 text-sm">
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> 새로고침
          </button>
          
          <button onClick={handleLoadMaterials} disabled={loading} className="flex items-center px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl font-bold shadow-sm hover:bg-blue-100 transition-all active:scale-95 text-sm">
            <PackageSearch size={18} className="mr-2" /> 자재불러오기
          </button>

          <button onClick={toggleEditMode} className={`flex items-center px-4 py-2 rounded-xl font-bold border shadow-sm transition-all text-sm ${isEditMode ? 'bg-orange-500 text-white border-orange-600' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`}>
            {isEditMode ? <Lock size={18} className="mr-2" /> : <Edit2 size={18} className="mr-2" />} {isEditMode ? '수정완료' : '수정'}
          </button>

          <button onClick={handleSaveForm} disabled={loading} className="flex items-center px-5 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95 text-sm">
            <Save size={18} className="mr-2" /> 서버저장
          </button>

          <button onClick={handlePrint} className="flex items-center justify-center px-6 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-bold shadow-md text-sm transition-all active:scale-95">
            <Printer size={18} className="mr-2" /> 미리보기
          </button>
        </div>
      </div>

      <div className="bg-gray-50/30 p-6 rounded-2xl border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col">
            <label className="text-[11px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">신청일자</label>
            <input 
              type="date" 
              value={activeRequest?.date || ''} 
              onChange={e => setActiveRequest(p => p ? { ...p, date: e.target.value } : null)} 
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" 
              readOnly={!isEditMode}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[11px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">입고일자</label>
            <input 
              type="date" 
              value={activeRequest?.arrivalDate || ''} 
              onChange={e => {
                const val = e.target.value;
                let formattedReceived = '';
                if (val) {
                  try {
                    const d = parseISO(val);
                    formattedReceived = format(d, 'MM/dd');
                  } catch (err) {
                    console.error("Date parse error", err);
                  }
                }
                setActiveRequest(p => {
                  if (!p) return null;
                  return { 
                    ...p, 
                    arrivalDate: val,
                    items: p.items.map(it => ({ ...it, receivedDate: formattedReceived }))
                  };
                });
              }} 
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" 
              readOnly={!isEditMode}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[11px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">신청부서</label>
            <input 
              type="text" 
              value={activeRequest?.department || ''} 
              onChange={e => setActiveRequest(p => p ? { ...p, department: e.target.value } : null)} 
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" 
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

      <div className="space-y-10">
        {SECTIONS.map(sec => (
          <div key={sec.key} className="animate-fade-in-down">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-6 bg-gray-800 rounded-full"></div>
              <h3 className="text-lg font-black text-gray-800">{sec.label}</h3>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-300 overflow-hidden overflow-x-auto shadow-sm">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr>
                    <th className={`${thClass} w-16`}>No</th>
                    <th className={`${thClass} w-[150px]`}>품 명</th>
                    <th className={`${thClass} w-[150px]`}>모델명</th>
                    <th className={`${thClass} w-24`}>재고</th>
                    <th className={`${thClass} w-24`}>수량</th>
                    <th className={`${thClass} w-32`}>입고일</th>
                    <th className={thClass}>비 고</th>
                  </tr>
                </thead>
                <tbody className="">
                  {activeRequest?.items.filter(i => i.category === sec.key).map((it, idx) => (
                    <tr key={it.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="border border-gray-300 text-center font-mono text-xs text-gray-400 bg-gray-50/30 relative h-10">
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
                      <td className="border border-gray-300 p-0 h-10">
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
                      <td className="border border-gray-300 p-0 h-10">
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
                      <td className="border border-gray-300 p-0 h-10 bg-gray-50/30">
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
                      <td className="border border-gray-300 p-0 h-10">
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
                      <td className="border border-gray-300 p-0 h-10">
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
                      <td className="border border-gray-300 p-0 h-10">
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

      <style>{`
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
