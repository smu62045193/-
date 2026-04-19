
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
  const [activeSection, setActiveSection] = useState('전기');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

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
      // 기존 문서가 있을 경우: 저장된 데이터만 로드 (빈 행 추가 로직 제거)
      setActiveRequest({
        ...existing,
        drafter: existing.drafter || autoDrafter
      });
    } else {
      // 신규 문서 생성 시: 빈 상태로 시작 (수정 버튼 클릭 시 행 생성)
      setActiveRequest({
        id: generateId(),
        date: format(date, 'yyyy-MM-dd'),
        arrivalDate: '',
        department: '시설관리팀',
        drafter: autoDrafter,
        items: [],
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
      // 수정 모드로 진입할 때만 각 섹션별로 최소 5행을 보장함
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

    // 저장 시에는 품명이 있는 실제 데이터만 걸러서 저장
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
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
    setLoading(false);
  };

  const handleDeleteItem = (id: string) => {
    if (!activeRequest) return;
    const ni = activeRequest.items.filter(i => i.id !== id);
    setActiveRequest({ ...activeRequest, items: ni });
  };

  const handleAddRow = (category: string) => {
    if (!activeRequest) return;
    const newItem: ConsumableRequestItem = {
      id: generateId(),
      category,
      itemName: '',
      spec: '',
      unit: '',
      qty: '',
      price: '',
      amount: 0,
      stock: '',
      remarks: '',
      receivedDate: ''
    };
    setActiveRequest({
      ...activeRequest,
      items: [...activeRequest.items, newItem]
    });
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
            <thead><tr style="background:#ffffff; height:30px;">
              <th style="width: 30px;">No</th>
              <th style="width: 140px;">품 명</th>
              <th style="width: 140px;">모델명</th>
              <th style="width: 45px;">재고</th>
              <th style="width: 45px;">수량</th>
              <th style="width: 55px;">입고일</th>
              <th>비 고</th>
            </tr></thead>
            <tbody>${its.map((item, idx) => `
              <tr style="height:28px;">
                <td>${idx+1}</td>
                <td>${item.itemName || ''}</td>
                <td>${item.spec || ''}</td>
                <td>${item.stock || ''}</td>
                <td>${item.qty || ''}</td>
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
        th, td { border: 1px solid black; padding: 6px; font-size: 8.5pt; vertical-align: top; text-align: center; word-break: break-all; font-weight: normal; color: black; }
        th { background: #ffffff; font-weight: normal; text-align: center; }
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

  const thClass = "bg-white border border-black text-center !text-[13px] !font-normal text-black p-0 h-[40px]";
  const tdClass = "border border-black text-center !text-[13px] !font-normal text-black p-0 h-[40px]";
  
  const inputClass = "bg-transparent border-none outline-none shadow-none appearance-none !text-[13px] !font-normal text-center w-full h-full px-2";
  const editableInputClass = "bg-transparent border-none outline-none shadow-none appearance-none !text-[13px] !font-normal text-center w-full h-full px-2 text-blue-700";
  const cellDivClass = "flex items-center justify-center h-full px-2 !text-[13px] !font-normal";

  return (
    <div className="space-y-2">
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
        <div className="flex items-center shrink-0">
          {/* 월 네비게이션 */}
          <div className="flex items-center shrink-0">
            <button 
              onClick={handlePrevMonth} 
              className="px-2 py-3 transition-colors text-gray-500 hover:text-black"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-[100px] text-center text-[14px] font-bold text-black">
              {format(viewDate, 'yyyy')}년 {format(viewDate, 'MM')}월
            </div>
            <button 
              onClick={handleNextMonth} 
              className="px-2 py-3 transition-colors text-gray-500 hover:text-black"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center shrink-0 px-2">
            <div className="w-[1px] h-6 bg-black"></div>
          </div>

          {/* 카테고리 탭 */}
          <div className="flex items-center shrink-0">
            {SECTIONS.map(sec => (
              <div
                key={sec.key}
                onClick={() => setActiveSection(sec.key)}
                className={`px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer ${
                  activeSection === sec.key 
                    ? 'text-orange-600' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {sec.label}
                {activeSection === sec.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center shrink-0 px-2">
            <div className="w-[1px] h-6 bg-black"></div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center shrink-0">
            <button 
              onClick={loadData} 
              disabled={loading} 
              className="shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent disabled:opacity-50 text-gray-500 hover:text-black transition-colors whitespace-nowrap relative"
            >
              <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} /> 새로고침
            </button>
            
            <button 
              onClick={handleLoadMaterials} 
              disabled={loading} 
              className="shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent disabled:opacity-50 text-gray-500 hover:text-black transition-all whitespace-nowrap relative"
            >
              <PackageSearch size={18} className="mr-1.5" /> 연동
            </button>

            <button 
              onClick={toggleEditMode} 
              className={`shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent whitespace-nowrap transition-colors ${
                isEditMode 
                  ? 'text-orange-600' 
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              {isEditMode ? <Lock size={18} className="mr-1.5" /> : <Edit2 size={18} className="mr-1.5" />} {isEditMode ? '수정완료' : '수정'}
            </button>

            <button 
              onClick={handleSaveForm} 
              disabled={loading} 
              className={`shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent whitespace-nowrap transition-colors relative disabled:opacity-50 ${
                isSaved 
                  ? 'text-orange-600' 
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              <Save size={18} className="mr-1.5" /> 저장
            </button>

            <button 
              onClick={handlePrint} 
              disabled={loading}
              className="shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent text-gray-500 hover:text-black transition-colors whitespace-nowrap relative disabled:opacity-50"
            >
              <Printer size={18} className="mr-1.5" /> 인쇄
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto flex items-stretch overflow-x-auto scrollbar-hide bg-white print:hidden border-b border-black">
        <div className="flex items-center shrink-0 gap-2">
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0 py-2 px-4">
            <span className="text-[14px] font-bold text-gray-500 uppercase">신청일자 :</span>
            <input 
              type="date" 
              value={activeRequest?.date || ''} 
              onChange={e => setActiveRequest(p => p ? { ...p, date: e.target.value } : null)} 
              className={`border-b-2 ${isEditMode ? 'border-blue-500 bg-blue-50/30' : 'border-transparent bg-transparent'} w-32 outline-none text-sm font-bold text-black py-0.5 px-2 transition-all rounded-none`} 
              readOnly={!isEditMode}
            />
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0 py-2 px-4">
            <span className="text-[14px] font-bold text-gray-500 uppercase">입고일자 :</span>
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
                  const oldVal = p.arrivalDate;
                  let oldFormatted = '';
                  if (oldVal) {
                    try { 
                      oldFormatted = format(parseISO(oldVal), 'MM/dd'); 
                    } catch(e){
                      console.error("Failed to parse old arrivalDate", e);
                    }
                  }
                  return { 
                    ...p, 
                    arrivalDate: val,
                    items: p.items.map(it => {
                      if (it.itemName.trim() !== '') {
                        if (!it.receivedDate || it.receivedDate.trim() === '' || it.receivedDate === oldFormatted) {
                          return { ...it, receivedDate: formattedReceived };
                        }
                      }
                      return it;
                    })
                  };
                });
              }} 
              className={`border-b-2 ${isEditMode ? 'border-blue-500 bg-blue-50/30' : 'border-transparent bg-transparent'} w-32 outline-none text-sm font-bold text-black py-0.5 px-2 transition-all rounded-none`} 
              readOnly={!isEditMode}
            />
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0 py-2 px-4">
            <span className="text-[14px] font-bold text-gray-500 uppercase">신청부서 :</span>
            <input 
              type="text" 
              value={activeRequest?.department || ''} 
              onChange={e => setActiveRequest(p => p ? { ...p, department: e.target.value } : null)} 
              className={`border-b-2 ${isEditMode ? 'border-blue-500 bg-blue-50/30' : 'border-transparent bg-transparent'} w-24 outline-none text-sm font-bold text-black py-0.5 text-center transition-all rounded-none`} 
              readOnly={!isEditMode}
            />
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0 py-2 px-4">
            <span className="text-[14px] font-bold text-gray-500 uppercase">작성자 :</span>
            <div className="relative flex-1 w-full">
              <input 
                type="text" 
                value={activeRequest?.drafter || ''} 
                onChange={e => setActiveRequest(p => p ? { ...p, drafter: e.target.value } : null)} 
                className={`border-b-2 ${isEditMode ? 'border-blue-500 bg-blue-50/30' : 'border-transparent bg-transparent'} w-24 outline-none text-sm font-bold text-black py-0.5 text-center transition-all rounded-none`}
                readOnly={!isEditMode}
                placeholder="성명"
              />
              <Sparkles className="absolute right-1 top-1 text-blue-300 pointer-events-none" size={16} />
            </div>
          </div>
        </div>
      </div>


      <div className="space-y-2">
        {SECTIONS.filter(sec => sec.key === activeSection).map(sec => {
          const sectionItems = activeRequest?.items.filter(i => i.category === sec.key) || [];
          
          // 조회 모드일 때는 이름이 있는 것만 표시, 수정 모드일 때는 패딩된 행 전체 표시
          const displayItems = isEditMode 
            ? sectionItems 
            : sectionItems.filter(it => it.itemName && it.itemName.trim() !== '');

          // 조회 모드인데 표시할 항목이 없으면 섹션 자체를 숨김
          if (!isEditMode && displayItems.length === 0) return null;

          return (
            <div key={sec.key} className="animate-fade-in-down space-y-2">
              <div className="bg-white max-w-7xl mx-auto overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-center border border-black">
                  <thead>
                    <tr className="h-[40px]">
                      <th className={`${thClass} w-12`}><div className={cellDivClass}>No</div></th>
                      <th className={`${thClass} w-[220px]`}><div className={cellDivClass}>품 명</div></th>
                      <th className={`${thClass} w-[220px]`}><div className={cellDivClass}>모델명</div></th>
                      <th className={`${thClass} w-20`}><div className={cellDivClass}>재고</div></th>
                      <th className={`${thClass} w-20`}><div className={cellDivClass}>수량</div></th>
                      <th className={`${thClass} w-24`}><div className={cellDivClass}>입고일</div></th>
                      <th className={thClass}><div className={cellDivClass}>비 고</div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayItems.map((it, idx) => (
                      <tr key={it.id} className="hover:bg-blue-50/30 transition-colors text-center group h-[40px]">
                        <td className={`${tdClass} text-gray-400 relative`}>
                          <div className={cellDivClass}>
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
                          </div>
                        </td>
                        <td className={tdClass}>
                          <div className="flex items-center justify-center h-full">
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
                          </div>
                        </td>
                        <td className={tdClass}>
                          <div className="flex items-center justify-center h-full">
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
                          </div>
                        </td>
                        <td className={tdClass}>
                          <div className="flex items-center justify-center h-full">
                            <input 
                              type="text" 
                              value={it.stock} 
                              onChange={e => {
                                const ni = activeRequest.items.map(i => i.id === it.id ? { ...i, stock: e.target.value } : i);
                                setActiveRequest({ ...activeRequest, items: ni });
                              }} 
                              className={inputClass}
                              readOnly={!isEditMode}
                            />
                          </div>
                        </td>
                        <td className={tdClass}>
                          <div className="flex items-center justify-center h-full">
                            <input 
                              type="text" 
                              value={it.qty} 
                              onChange={e => {
                                const ni = activeRequest.items.map(i => i.id === it.id ? { ...i, qty: e.target.value } : i);
                                setActiveRequest({ ...activeRequest, items: ni });
                              }} 
                              className={isEditMode ? editableInputClass : `${inputClass} font-normal`}
                              readOnly={!isEditMode}
                              placeholder="수량"
                            />
                          </div>
                        </td>
                        <td className={tdClass}>
                          <div className="flex items-center justify-center h-full">
                            <input 
                              type="text" 
                              value={it.receivedDate} 
                              onChange={e => {
                                const ni = activeRequest.items.map(i => i.id === it.id ? { ...i, receivedDate: e.target.value } : i);
                                setActiveRequest({ ...activeRequest, items: ni });
                              }} 
                              className={isEditMode ? editableInputClass : `${inputClass} font-normal`}
                              readOnly={!isEditMode}
                              placeholder="00/00"
                            />
                          </div>
                        </td>
                        <td className={tdClass}>
                          <div className="flex items-center justify-center h-full">
                            <input 
                              type="text" 
                              value={it.remarks} 
                              onChange={e => {
                                const ni = activeRequest.items.map(i => i.id === it.id ? { ...i, remarks: e.target.value } : i);
                                setActiveRequest({ ...activeRequest, items: ni });
                              }} 
                              className={isEditMode ? editableInputClass : `${inputClass} font-normal`}
                              readOnly={!isEditMode}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {isEditMode && (
                      <tr>
                        <td colSpan={7} className="p-2 bg-gray-50/50 border-b border-r border-black">
                          <button
                            onClick={() => handleAddRow(sec.key)}
                            className="flex items-center justify-center w-full gap-2 py-2 text-sm font-bold text-blue-600 bg-white border border-blue-200 border-dashed rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all"
                          >
                            <Plus size={16} />
                            {sec.label} 항목 추가
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
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
