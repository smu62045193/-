import React, { useState, useEffect, useMemo } from 'react';
import { Contractor } from '../types';
import { fetchContractors, saveContractors } from '../services/dataService';
import { Save, Plus, Trash2, Search, Briefcase, Printer, Edit2, RotateCcw, RefreshCw, AlertTriangle, X, Cloud, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const generateId = () => Math.random().toString(36).substr(2, 9);

const TYPE_ORDER: Record<string, number> = {
  '전기': 1,
  '기계': 2,
  '소방': 3,
  '승강기': 4,
  '주차': 5,
  'CCTV': 6,
  '기타': 7
};

const ContractorManager: React.FC = () => {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const initialNewItem: Contractor = {
    id: '',
    name: '',
    type: '전기',
    contactPerson: '',
    phoneMain: '',
    phoneMobile: '',
    fax: '',
    note: ''
  };

  const [newItem, setNewItem] = useState<Contractor>(initialNewItem);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchContractors();
      setContractors(data || []);
    } catch (e) {
      console.error("Failed to load contractors", e);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadToForm = (item: Contractor) => {
    setNewItem({ ...item });
    setEditId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setNewItem(initialNewItem);
  };

  const handleRegister = async () => {
    if (!newItem.name) {
      alert('업체명은 필수입니다.');
      return;
    }

    setLoading(true);
    setShowSaveConfirm(false);
    const originalList = [...contractors];
    try {
      let newList = [...contractors];
      
      if (editId) {
        const index = newList.findIndex(i => String(i.id) === String(editId));
        if (index >= 0) {
          newList[index] = { ...newItem };
        }
      } else {
        const itemToAdd = { ...newItem, id: generateId() };
        newList = [itemToAdd, ...newList];
      }
      
      setContractors(newList);

      const success = await saveContractors(newList);
      if (success) {
        handleCancelEdit();
        alert(editId ? '업체 정보가 수정되었습니다.' : '협력업체가 등록되었습니다.');
      } else {
        setContractors(originalList);
        alert('저장 실패');
      }
    } catch (e) {
      console.error(e);
      setContractors(originalList);
      alert('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;

    const idStr = String(deleteTargetId);
    const originalList = [...contractors];
    const newItems = originalList.filter(c => String(c.id) !== idStr);
    
    setContractors(newItems);
    if (String(editId) === idStr) handleCancelEdit();
    setDeleteTargetId(null); 

    try {
      const success = await saveContractors(newItems);
      if (!success) {
        setContractors(originalList);
        alert('삭제 실패 (서버 저장 오류)');
      }
    } catch (e) {
      console.error(e);
      setContractors(originalList);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: any) => {
    e.stopPropagation();
    setDeleteTargetId(String(id));
  };

  const filteredList = useMemo(() => {
    return contractors
      .filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.type.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        const orderA = TYPE_ORDER[a.type] || 99;
        const orderB = TYPE_ORDER[b.type] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
  }, [contractors, searchTerm]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    const tableRows = filteredList.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.type}</td>
        <td>${item.name}</td>
        <td>${item.contactPerson}</td>
        <td>${item.phoneMain || ''}</td>
        <td>${item.phoneMobile || ''}</td>
        <td>${item.fax || ''}</td>
        <td>${item.note || ''}</td>
      </tr>`).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>협력업체 현황 미리보기</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
          @page { size: A4 portrait; margin: 0; }
          body { font-family: 'Noto Sans KR', sans-serif; background: #f1f5f9; padding: 0; margin: 0; -webkit-print-color-adjust: exact; }
          .no-print { display: flex; justify-content: center; padding: 20px; }
          @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; } }
          .print-page { 
            width: 210mm; 
            min-height: 297mm; 
            margin: 20px auto; 
            padding: 15mm 12mm 15mm 12mm; 
            background: white; 
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); 
            box-sizing: border-box; 
          }
          h1 { text-align: center; border-bottom: 2.5px solid black; padding-bottom: 10px; margin-bottom: 30px; font-size: 24pt; font-weight: 900; }
          table { width: 100%; border-collapse: collapse; font-size: 8.5pt; border: 1.5px solid black; table-layout: fixed; }
          th, td { border: 1px solid black; padding: 0; text-align: center; word-break: break-all; font-weight: normal; height: 28px; line-height: 28px; }
          th { background-color: #f3f4f6; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button>
        </div>
        <div class="print-page">
          <h1>협력업체 현황</h1>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">No</th>
                <th style="width: 40px;">업종</th>
                <th style="width: 110px;">업체명</th>
                <th style="width: 50px;">담당자</th>
                <th style="width: 90px;">대표번호</th>
                <th style="width: 90px;">핸드폰</th>
                <th style="width: 90px;">팩스</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </body>
      </html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const thClass = "border border-gray-300 p-2 bg-gray-50 font-bold text-center align-middle text-sm text-gray-700 h-10 whitespace-nowrap";
  const tdClass = "border border-gray-300 px-3 py-2 text-sm text-gray-700 h-10 align-middle bg-white text-center";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in print:p-0 print:max-w-none print:w-full relative">
      <div className="mb-2 print:hidden flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <Briefcase className="mr-2 text-blue-600" size={24} />
          협력업체 관리
        </h2>
        {loading && <RefreshCw size={18} className="animate-spin text-blue-500" />}
      </div>
      
      {/* Registration Form */}
      <div className={`p-6 rounded-xl border shadow-sm transition-all duration-300 print:hidden ${editId ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-6 rounded-full ${editId ? 'bg-orange-500' : 'bg-blue-600'}`}></div>
            <h3 className="text-lg font-bold text-gray-800">{editId ? '업체 정보 수정' : '신규 업체 등록'}</h3>
          </div>
          {editId && (
            <button onClick={handleCancelEdit} className="flex items-center space-x-1 text-sm text-orange-600 hover:text-orange-800 font-bold bg-white px-3 py-1 rounded-full border border-orange-200 shadow-sm">
              <RotateCcw size={14} />
              <span>수정 취소</span>
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">업체명 *</label>
            <input type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="업체명" className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black h-[38px] font-bold" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">업종</label>
            <input type="text" value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value})} placeholder="예: 전기, 소방" className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black h-[38px]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">담당자</label>
            <input type="text" value={newItem.contactPerson} onChange={e => setNewItem({...newItem, contactPerson: e.target.value})} placeholder="담당자 성명" className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black h-[38px]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">대표번호</label>
            <input type="text" value={newItem.phoneMain} onChange={e => setNewItem({...newItem, phoneMain: e.target.value})} placeholder="02-..." className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black h-[38px]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">휴대폰</label>
            <input type="text" value={newItem.phoneMobile} onChange={e => setNewItem({...newItem, phoneMobile: e.target.value})} placeholder="010-..." className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black h-[38px]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">팩스</label>
            <input type="text" value={newItem.fax} onChange={e => setNewItem({...newItem, fax: e.target.value})} placeholder="02-..." className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black h-[38px]" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1">비고</label>
            <input type="text" value={newItem.note} onChange={e => setNewItem({...newItem, note: e.target.value})} placeholder="특이사항" className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black h-[38px]" />
          </div>
          <div className="md:col-span-3 lg:col-span-4 flex justify-end mt-2">
            <button 
              onClick={() => setShowSaveConfirm(true)} 
              disabled={loading}
              className={`flex items-center justify-center space-x-2 text-white px-8 py-2 rounded-lg shadow-md text-sm font-bold h-[42px] transition-colors ${editId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} disabled:bg-gray-400`}
            >
              {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              <span>{editId ? '수정 완료' : '업체 등록'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search and Print Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200 print:hidden">
        <div className="relative flex-1 md:w-80 w-full">
          <input type="text" placeholder="업체명, 업종, 담당자 검색" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white text-black shadow-sm" />
          <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
        </div>
        <button onClick={handlePrint} className="flex items-center px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 font-bold shadow-md text-sm transition-all active:scale-95">
          <Printer size={18} className="mr-2" />
          미리보기
        </button>
      </div>

      {/* Contractors Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse">
          <thead>
            <tr>
              <th className={thClass} style={{ width: '50px' }}>No</th>
              <th className={thClass} style={{ width: '100px' }}>업종</th>
              <th className={thClass} style={{ width: '180px' }}>업체명</th>
              <th className={thClass} style={{ width: '100px' }}>담당자</th>
              <th className={thClass} style={{ width: '130px' }}>대표번호</th>
              <th className={thClass} style={{ width: '130px' }}>휴대폰</th>
              <th className={thClass} style={{ width: '130px' }}>팩스</th>
              <th className={thClass}>비고</th>
              <th className={`${thClass} w-24 print:hidden`}>관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredList.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-20 text-gray-400 italic">등록된 협력업체가 없습니다.</td></tr>
            ) : (
              filteredList.map((item, index) => (
                <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors ${String(editId) === String(item.id) ? 'bg-orange-50' : ''}`}>
                  <td className={`${tdClass} text-center text-gray-400 font-mono text-xs`}>{index + 1}</td>
                  <td className={`${tdClass} font-bold text-blue-600`}>{item.type}</td>
                  <td className={`${tdClass} font-bold text-gray-800`}>{item.name}</td>
                  <td className={tdClass}>{item.contactPerson}</td>
                  <td className={tdClass}>{item.phoneMain}</td>
                  <td className={tdClass}>{item.phoneMobile}</td>
                  <td className={tdClass}>{item.fax}</td>
                  <td className={tdClass}>{item.note}</td>
                  <td className={`${tdClass} text-center print:hidden`}>
                    <div className="flex items-center justify-center space-x-1">
                      <button onClick={() => handleLoadToForm(item)} className="text-blue-500 hover:text-blue-700 p-1.5 rounded hover:bg-blue-50" title="수정"><Edit2 size={16} /></button>
                      <button onClick={(e) => handleDeleteClick(e, item.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50" title="삭제"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Save Confirmation Modal */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-slate-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-100">
                <Cloud className="text-blue-600" size={36} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">서버저장 확인</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                {editId ? '수정된 업체 정보를' : '작성하신 업체 정보를'}<br/>
                서버에 안전하게 기록하시겠습니까?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center"><X size={20} className="mr-2" />취소</button>
                <button onClick={handleRegister} className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95"><CheckCircle size={20} className="mr-2" />확인</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-red-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-100">
                <AlertTriangle className="text-red-600" size={36} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">업체 정보 삭제 확인</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                선택하신 업체 정보를 마스터 DB에서<br/>
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
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ContractorManager;