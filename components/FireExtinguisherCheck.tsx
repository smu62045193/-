
import React, { useState, useEffect, useMemo } from 'react';
import { FireExtinguisherItem } from '../types';
import { fetchFireExtinguisherList, saveFireExtinguisherList } from '../services/dataService';
import { Save, Plus, Trash2, Printer, Filter, Edit2, RotateCcw, Flame, Check, AlertCircle, X, AlertTriangle, Cloud, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const generateId = () => Math.random().toString(36).substr(2, 9);

const EXTINGUISHER_TYPES = [
  "ABC분말(3.3kg)",
  "하론3K(1211)",
  "CO2(4.6K)"
];

const getFloorScore = (f: string) => {
  const s = (f || '').toUpperCase().trim();
  if (!s || s === '미지정') return -9999;
  if (s === '옥상' || s === 'RF' || s.includes('옥탑')) return 1000;
  if (s === '지하3~5층') return -3.5;
  
  // '창고'를 지하 6층(-6)보다 낮은 점수로 설정하여 뒤로 배치
  if (s === '창고') return -10;

  if (s.startsWith('B') || s.startsWith('지하')) {
    const numStr = s.replace(/[^0-9]/g, '');
    const num = parseInt(numStr);
    return -1 * (isNaN(num) ? 0 : num);
  }
  const numStr = s.replace(/[^0-9]/g, '');
  const num = parseInt(numStr);
  return isNaN(num) ? 0 : num;
};

// 날짜를 YY/MM 형식으로 변환하는 헬퍼 함수
const formatToYYMM = (dateStr: string) => {
  if (!dateStr) return '';
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts[0].length === 4) {
      return `${parts[0].substring(2)}/${parts[1]}`;
    }
  }
  return dateStr;
};

const FireExtinguisherCheck: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<FireExtinguisherItem[]>([]);
  const [activeFloor, setActiveFloor] = useState<string>('전체');
  const [editId, setEditId] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'register' | 'saveAll' | null>(null);
  
  // 삭제 확인 모달을 위한 상태
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  
  const initialFormState: FireExtinguisherItem = {
    id: '',
    manageNo: '',
    type: 'ABC분말(3.3kg)',
    floor: '',
    company: '',
    serialNo: '',
    phone: '',
    certNo: '',
    date: '',
    remarks: ''
  };
  const [formItem, setFormItem] = useState<FireExtinguisherItem>(initialFormState);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetched = await fetchFireExtinguisherList();
      setItems(fetched || []);
    } catch (e) {
      console.error("데이터 로드 실패", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: FireExtinguisherItem) => {
    setFormItem({ ...item });
    setEditId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setFormItem(initialFormState);
  };

  const handleRegister = async () => {
    if (!formItem.manageNo?.trim()) {
      alert('관리번호는 필수입니다.');
      return;
    }
    
    setLoading(true);
    const originalList = [...items];
    try {
      let newItems = [...items];
      
      if (editId) {
        newItems = newItems.map(item => String(item.id) === String(editId) ? { ...formItem } : item);
      } else {
        const itemToAdd = { ...formItem, id: generateId() };
        newItems = [itemToAdd, ...newItems];
      }
      
      setItems(newItems);

      const success = await saveFireExtinguisherList(newItems);
      if (success) {
        setFormItem({ ...initialFormState, floor: formItem.floor });
        setEditId(null);
        alert(editId ? '소화기 정보가 수정되었습니다.' : '신규 소화기가 등록되었습니다.');
      } else {
        setItems(originalList);
        alert('저장 실패 (서버 오류)');
      }
    } catch (e) {
      console.error("등록 중 오류", e);
      setItems(originalList);
      alert('오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setShowSaveConfirm(false);
      setConfirmMode(null);
    }
  };

  const handleSaveAll = async () => {
    setLoading(true);
    const success = await saveFireExtinguisherList(items);
    if (success) alert('모든 변경사항이 저장되었습니다.');
    else alert('저장 실패');
    setLoading(false);
    setShowSaveConfirm(false);
    setConfirmMode(null);
  };

  const handleOpenConfirm = (mode: 'register' | 'saveAll') => {
    if (mode === 'register' && !formItem.manageNo?.trim()) {
      alert('관리번호는 필수입니다.');
      return;
    }
    setConfirmMode(mode);
    setShowSaveConfirm(true);
  };

  const handleExecuteConfirm = () => {
    if (confirmMode === 'register') handleRegister();
    else if (confirmMode === 'saveAll') handleSaveAll();
  };

  const groupedData = useMemo(() => {
    const groups: Record<string, FireExtinguisherItem[]> = {};
    const safeItems = Array.isArray(items) ? items : [];
    
    safeItems.forEach(item => {
        if (!item) return;
        let key = item.floor && item.floor.trim() !== '' ? item.floor : '미지정';
        const cleanKey = key.replace(/\s+/g, '');
        if (cleanKey.includes('옥탑')) key = '옥상';
        if (['지하3층', '지하4층', '지하5층', 'B3', 'B4', 'B5'].includes(cleanKey)) key = '지하3~5층';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    
    const sortedKeys = Object.keys(groups).sort((a, b) => getFloorScore(b) - getFloorScore(a));
    return sortedKeys.map(key => ({
        floor: key,
        items: groups[key].sort((a, b) => (a.manageNo || '').localeCompare(b.manageNo || '', undefined, { numeric: true }))
    }));
  }, [items]);

  const availableFloors = useMemo(() => ['전체', ...groupedData.map(g => g.floor)], [groupedData]);
  const displayData = activeFloor === '전체' ? groupedData : groupedData.filter(g => g.floor === activeFloor);

  const handlePrint = () => {
    // 1. Flatten rows (Headers + Items)
    const flatRows: any[] = [];
    let globalIdx = 1;
    displayData.forEach(group => {
      flatRows.push({ isHeader: true, floor: group.floor });
      group.items.forEach(item => {
        flatRows.push({ isHeader: false, globalIndex: globalIdx++, ...item });
      });
    });

    if (flatRows.length === 0) return;

    // 2. Chunk rows (P1: 28, P2+: 31)
    const chunks: any[][] = [];
    let start = 0;
    while (start < flatRows.length) {
      const size = chunks.length === 0 ? 28 : 31;
      chunks.push(flatRows.slice(start, start + size));
      start += size;
    }

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;

    // 용지 폭에 맞게 열 너비 정밀 최적화 (합계 630px로 더 축소하여 안전성 확보)
    const tableHeader = `
      <thead>
        <tr>
          <th style="width: 30px;">No</th>
          <th style="width: 80px;">관리번호</th>
          <th style="width: 100px;">종 류</th>
          <th style="width: 70px;">층 별</th>
          <th style="width: 70px;">정비업체</th>
          <th style="width: 70px;">제조번호</th>
          <th style="width: 90px;">전화번호</th>
          <th style="width: 70px;">검정번호</th>
          <th style="width: 50px;">일 자</th>
        </tr>
      </thead>
    `;

    let pagesContent = '';
    chunks.forEach((chunk, index) => {
      const isFirstPage = index === 0;
      const rowsHtml = chunk.map(row => {
        if (row.isHeader) {
          return `<tr><td colspan="9" style="background-color: #f3f4f6 !important; font-weight: bold; text-align: left; padding: 8px 10px; border-top: 1.5px solid black; font-size: 10pt;">[ ${row.floor} ]</td></tr>`;
        } else {
          const displayDate = formatToYYMM(row.date || '');
          return `
            <tr>
              <td>${row.globalIndex}</td>
              <td>${row.manageNo || ''}</td>
              <td>${row.type || ''}</td>
              <td>${row.floor || ''}</td>
              <td>${row.company || ''}</td>
              <td>${row.serialNo || ''}</td>
              <td>${row.phone || ''}</td>
              <td>${row.certNo || ''}</td>
              <td>${displayDate}</td>
            </tr>
          `;
        }
      }).join('');

      pagesContent += `
        <div class="print-page ${index < chunks.length - 1 ? 'page-break' : ''}">
          ${isFirstPage ? `
          <div class="header-flex">
            <div class="title-area">
              <div class="doc-title">소화기 관리대장</div>
            </div>
          </div>
          ` : ''}

          <table class="main-print-table">
            ${tableHeader}
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    });

    printWindow.document.write(`
      <html>
      <head>
        <title>소화기 관리대장 미리보기</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
          @page { size: A4 portrait; margin: 0; }
          body { 
            font-family: 'Noto Sans KR', sans-serif; 
            background: #f1f5f9; 
            margin: 0; 
            padding: 0; 
            color: black; 
            line-height: 1.2; 
            -webkit-print-color-adjust: exact; 
          }
          .no-print { display: flex; justify-content: center; padding: 20px; }
          @media print { 
            .no-print { display: none !important; } 
            body { background: white !important; } 
            .page-break { page-break-after: always; } 
          }
          
          .print-page { 
            width: 210mm; 
            min-height: 297mm; 
            margin: 20px auto; 
            padding: 25mm 12mm 10mm 12mm; 
            background: white; 
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); 
            box-sizing: border-box; 
          }
          @media print { 
            .print-page { 
              box-shadow: none !important; 
              margin: 0 !important; 
              width: 100% !important; 
            } 
          }

          .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; min-height: 100px; }
          .title-area { flex: 1; text-align: center; }
          .doc-title { font-size: 28pt; font-weight: 900; text-decoration: underline; text-underline-offset: 8px; }
          
          table.main-print-table { width: 100%; border-collapse: collapse; border: 1.5px solid black; table-layout: fixed; }
          th, td { border: 1px solid black; padding: 4px 2px; text-align: center; font-size: 8.5pt; height: 28px; }
          th { background-color: #f3f4f6 !important; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button>
        </div>
        ${pagesContent}
      </body>
      </html>`);
    printWindow.document.close();
  };

  // 실제 삭제 로직 (모달에서 호출)
  const confirmDelete = async () => {
    if (!deleteTargetId) return;

    const idStr = String(deleteTargetId);
    const originalList = [...items];
    const newItems = originalList.filter(i => String(i.id) !== idStr);
    
    setItems(newItems);
    if (String(editId) === idStr) handleCancelEdit();
    setDeleteTargetId(null); // 모달 닫기

    try {
      const success = await saveFireExtinguisherList(newItems);
      if (!success) {
        setItems(originalList);
        alert('삭제 실패 (서버 저장 오류)');
      }
    } catch (e) {
      console.error(e);
      setItems(originalList);
      alert('오류가 발생했습니다.');
    }
  };

  const handleDeleteClick = (id: any) => {
    setDeleteTargetId(String(id));
  };

  const updateItemInTable = (id: string, field: keyof FireExtinguisherItem, value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const inputs = document.querySelectorAll('.form-input');
      const index = Array.from(inputs).indexOf(e.target as any);
      if (index > -1 && index < inputs.length - 1) {
        (inputs[index + 1] as HTMLElement).focus();
      } else if (index === inputs.length - 1) {
        handleOpenConfirm('register');
      }
    }
  };

  const inputClass = "w-full border border-gray-300 rounded px-2 py-2 !text-[12px] bg-white text-black focus:ring-2 focus:ring-blue-500 outline-none h-[38px] font-normal";
  const tableInputClass = "w-full h-full text-center outline-none bg-transparent text-black p-1 focus:bg-blue-50 !text-[12px] font-normal flex items-center justify-center min-h-[32px]";

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-4 animate-fade-in">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4 print:hidden">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center"><Flame className="mr-2 text-red-600" />소화기 관리대장</h2>
        <div className="flex gap-2">
          <button onClick={() => handleOpenConfirm('saveAll')} disabled={loading} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold shadow-sm transition-colors text-sm disabled:opacity-50"><Save size={18} className="mr-2" />서버저장</button>
          <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 font-bold shadow-sm transition-colors text-sm"><Printer size={18} className="mr-2" />미리보기</button>
        </div>
      </div>

      <div className={`p-6 rounded-xl border shadow-sm print:hidden transition-all duration-300 ${editId ? 'bg-orange-50 border-orange-200' : 'bg-blue-50/50 border-blue-200'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-700 flex items-center">
            {editId ? <Edit2 size={18} className="mr-2 text-orange-600" /> : <Plus size={18} className="mr-2 text-blue-600" />}
            {editId ? '소화기 정보 수정' : '신규 소화기 등록'}
          </h3>
          {editId && (
            <button onClick={handleCancelEdit} className="text-xs flex items-center text-gray-500 hover:text-gray-700 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm font-bold">
              <RotateCcw size={12} className="mr-1" />수정 취소
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-3 items-end">
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">관리번호 *</label><input type="text" className={`${inputClass} form-input`} value={formItem.manageNo} onChange={e => setFormItem({...formItem, manageNo: e.target.value})} onKeyDown={handleKeyDown} placeholder="예: 001" /></div>
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">종류</label><select className={`${inputClass} form-input`} value={formItem.type} onChange={e => setFormItem({...formItem, type: e.target.value})} onKeyDown={handleKeyDown}>{EXTINGUISHER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">층별</label><input type="text" className={`${inputClass} form-input`} value={formItem.floor} onChange={e => setFormItem({...formItem, floor: e.target.value})} onKeyDown={handleKeyDown} placeholder="예: 1F" /></div>
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">정비업체</label><input type="text" className={`${inputClass} form-input`} value={formItem.company} onChange={e => setFormItem({...formItem, company: e.target.value})} onKeyDown={handleKeyDown} /></div>
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">제조번호</label><input type="text" className={`${inputClass} form-input`} value={formItem.serialNo} onChange={e => setFormItem({...formItem, serialNo: e.target.value})} onKeyDown={handleKeyDown} /></div>
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">전화번호</label><input type="text" className={`${inputClass} form-input`} value={formItem.phone} onChange={e => setFormItem({...formItem, phone: e.target.value})} onKeyDown={handleKeyDown} placeholder="010-..." /></div>
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">검정번호</label><input type="text" className={`${inputClass} form-input`} value={formItem.certNo} onChange={e => setFormItem({...formItem, certNo: e.target.value})} onKeyDown={handleKeyDown} /></div>
          <div className="col-span-1"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">일자</label><input type="month" className={`${inputClass} form-input`} value={formItem.date} onChange={e => setFormItem({...formItem, date: e.target.value})} onKeyDown={handleKeyDown} /></div>
          <div className="col-span-1">
            <button 
              onClick={() => handleOpenConfirm('register')} 
              disabled={loading} 
              className={`w-full text-white rounded-lg font-bold h-[38px] transition-colors shadow-md text-sm flex items-center justify-center gap-1 ${editId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {loading ? '...' : (editId ? <><Check size={14} />수정</> : <><Plus size={14} />등록</>)}
            </button>
          </div>
          <div className="col-span-full"><label className="block !text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tighter">비고</label><input type="text" className={`${inputClass} form-input`} value={formItem.remarks} onChange={e => setFormItem({...formItem, remarks: e.target.value})} onKeyDown={handleKeyDown} placeholder="특이사항 입력" /></div>
        </div>
      </div>

      <div className="print:hidden flex items-center gap-4 bg-white p-3 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-500 min-w-max"><Filter size={16} />층별 필터:</div>
        <div className="flex overflow-x-auto whitespace-nowrap gap-2 scrollbar-hide pb-1">
          {availableFloors.map(f => (
            <button key={f} onClick={() => setActiveFloor(f)} className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${activeFloor === f ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-white'}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full border-collapse text-center min-w-[1000px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-12">No</th>
              <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-32">관리번호</th>
              <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-44">종 류</th>
              <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-32">층 별</th>
              <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-24">정비업체</th>
              <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-24">제조번호</th>
              <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-32">전화번호</th>
              <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-24">검정번호</th>
              <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-24">일 자</th>
              <th className="border-r border-gray-200 p-2 !text-[12px] font-normal text-gray-500 w-24">비 고</th>
              <th className="p-2 !text-[12px] font-normal text-gray-500 w-24 print:hidden">관리</th>
            </tr>
          </thead>
          <tbody>
            {displayData.length === 0 ? (
               <tr><td colSpan={11} className="py-20 text-gray-400 italic flex items-center justify-center gap-2"><AlertCircle size={18} /> 소화기가 없습니다.</td></tr>
            ) : displayData.map(group => (
              <React.Fragment key={group.floor}>
                <tr className="bg-gray-100 font-normal"><td colSpan={11} className="text-left pl-4 py-2 border-b border-gray-300 text-blue-900 !text-[12px]">[ {group.floor} ]</td></tr>
                {group.items.map((item, idx) => (
                  <tr key={item.id} className={`hover:bg-gray-50 border-b border-gray-100 last:border-0 group ${String(editId) === String(item.id) ? 'bg-orange-50' : ''}`}>
                    <td className="p-2 !text-[12px] text-gray-400 font-normal">{idx + 1}</td>
                    <td className="p-0 border-r border-gray-100"><input type="text" className={`${tableInputClass} font-normal`} value={item.manageNo || ''} onChange={e => updateItemInTable(item.id, 'manageNo', e.target.value)} /></td>
                    <td className="p-0 border-r border-gray-100"><div className={tableInputClass}>{item.type || ''}</div></td>
                    <td className="p-0 border-r border-gray-100"><input type="text" className={tableInputClass} value={item.floor || ''} onChange={e => updateItemInTable(item.id, 'floor', e.target.value)} /></td>
                    <td className="p-0 border-r border-gray-100"><input type="text" className={tableInputClass} value={item.company || ''} onChange={e => updateItemInTable(item.id, 'company', e.target.value)} /></td>
                    <td className="p-0 border-r border-gray-100"><input type="text" className={tableInputClass} value={item.serialNo || ''} onChange={e => updateItemInTable(item.id, 'serialNo', e.target.value)} /></td>
                    <td className="p-0 border-r border-gray-100"><input type="text" className={tableInputClass} value={item.phone || ''} onChange={e => updateItemInTable(item.id, 'phone', e.target.value)} /></td>
                    <td className="p-0 border-r border-gray-100"><input type="text" className={tableInputClass} value={item.certNo || ''} onChange={e => updateItemInTable(item.id, 'certNo', e.target.value)} /></td>
                    <td className="p-0 border-r border-gray-100"><input type="text" className={tableInputClass} value={formatToYYMM(item.date || '')} onChange={e => updateItemInTable(item.id, 'date', e.target.value)} /></td>
                    <td className="p-0 border-r border-gray-100"><input type="text" className={`${tableInputClass} text-left px-2 font-normal`} value={item.remarks || ''} onChange={e => updateItemInTable(item.id, 'remarks', e.target.value)} /></td>
                    <td className="p-2 text-center print:hidden">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(item)} className="text-gray-400 hover:text-blue-600 transition-colors" title="수정">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteClick(item.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="삭제">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
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
                {confirmMode === 'register' ? '작성하신 소화기 정보를' : '현재 목록의 모든 변경사항을'}<br/>
                서버에 안전하게 기록하시겠습니까?
              </p>
              
              <div className="flex gap-3">
                <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center"><X size={20} className="mr-2" />취소</button>
                <button onClick={handleExecuteConfirm} className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95"><CheckCircle size={20} className="mr-2" />확인</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 커스텀 삭제 확인 모달 */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-gray-100">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-100">
                <AlertTriangle className="text-red-500" size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">소화기 삭제 확인</h3>
              <p className="text-gray-500 mb-8 leading-relaxed">
                선택하신 소화기 관리 정보를 정말로 삭제하시겠습니까?<br/>
                <span className="text-red-500 font-bold text-sm">삭제된 데이터는 복구할 수 없습니다.</span>
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteTargetId(null)}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors flex items-center justify-center"
                >
                  <X size={18} className="mr-2" />
                  취소하기
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-200 flex items-center justify-center"
                >
                  <Trash2 size={18} className="mr-2" />
                  삭제 진행
                </button>
              </div>
            </div>
            <div className="bg-gray-50 p-3 border-t border-gray-100 flex justify-center">
              <p className="!text-[12px] text-gray-400 font-medium">새마을운동중앙회대치동사옥 시설관리 시스템</p>
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

export default FireExtinguisherCheck;
