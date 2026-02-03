import React, { useState, useEffect } from 'react';
import { fetchParkingChangeList } from '../services/dataService';
import { ParkingChangeItem } from '../types';
import { RefreshCw, Search, History, Printer, Car } from 'lucide-react';

interface ParkingInspectionHistoryProps {
  onSelect: () => void;
}

const ParkingInspectionHistory: React.FC<ParkingInspectionHistoryProps> = ({ onSelect }) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ParkingChangeItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchParkingChangeList();
      const sortedData = (data || []).sort((a, b) => b.date.localeCompare(a.date));
      setHistory(sortedData);
    } catch (e) {
      console.error("주차 이력 로드 실패", e);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (item: ParkingChangeItem) => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>차량 변경 확인서 - ${item.company}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
            @page { size: A4 portrait; margin: 0; }
            body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; color: #333; line-height: 1.6; background: #f1f5f9; -webkit-print-color-adjust: exact; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; } }
            
            .print-page { 
              width: 210mm; 
              min-height: 297mm; 
              padding: 25mm 20mm 15mm 20mm; 
              margin: 20px auto; 
              box-sizing: border-box; 
              background: #fff;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            
            .header { border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 40px; text-align: center; }
            .title { font-size: 28pt; font-weight: 900; margin: 0; color: #1e3a8a; letter-spacing: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; border: 1.5px solid #000; }
            th, td { border: 1px solid #000; padding: 18px; text-align: center; font-size: 12pt; }
            th { background: #f8fafc; font-weight: bold; width: 30%; }
            .highlight { font-weight: 900; font-size: 15pt; color: #1e3a8a; }
            .footer-sign { margin-top: 80px; text-align: center; }
            .org-name { font-weight: 900; font-size: 20pt; margin-top: 40px; }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button>
          </div>
          <div class="print-page">
            <div class="header">
              <h1 class="title">지정주차 차량 변경 확인서</h1>
            </div>
            <div style="text-align:right; font-weight:bold; font-size: 11pt; margin-bottom: 10px;">신청 일자: ${item.date}</div>
            <table>
              <tr><th>업 체 명</th><td class="highlight">${item.company}</td></tr>
              <tr><th>주 차 위 치</th><td style="font-weight:bold;">${item.location}</td></tr>
              <tr><th>변 경 구 분</th><td><span style="padding:4px 15px; background:#dbeafe; color:#1e40af; border-radius:6px; font-weight:bold; font-size:11pt;">${item.type}</span></td></tr>
              <tr><th>기존 차량번호</th><td style="color:#666;">${item.prevPlate || '없음(신규)'}</td></tr>
              <tr><th>변경 차량번호</th><td class="highlight" style="color: #d32f2f;">${item.newPlate}</td></tr>
              <tr style="height: 120px;"><th>비고 및 특이사항</th><td style="text-align:left; vertical-align:top;">${item.note || '특이사항 없음'}</td></tr>
            </table>
            <div class="footer-sign">
              <p style="font-weight:bold; font-size:13pt;">위와 같이 지정주차 차량 정보가 변경되었음을 확인합니다.</p>
              <div class="org-name">새마을운동중앙회 대치동사옥 시설팀</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredHistory = history.filter(item => 
    item.company.includes(searchTerm) || 
    item.location.includes(searchTerm) || 
    item.newPlate.includes(searchTerm) ||
    item.date.includes(searchTerm)
  );

  return (
    <div className="p-6 space-y-4 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <History size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">주차점검이력 (변경내용)</h2>
            <p className="text-xs text-gray-400 mt-0.5">지정주차 차량의 추가 및 변경 기록 목록입니다.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <input 
              type="text" 
              placeholder="업체명, 위치, 차량번호 검색" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-gray-50 text-black outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
            />
            <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
          </div>
          <button 
            onClick={loadHistory}
            className="p-2.5 hover:bg-gray-100 rounded-xl transition-all text-gray-500 border border-gray-200 bg-white shadow-sm active:scale-95"
            title="새로고침"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-16">No</th>
                <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-32">변경일자</th>
                <th className="px-4 py-4 text-left text-sm font-bold text-gray-500 uppercase tracking-wider w-48">업체</th>
                <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-24">위치</th>
                <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-36">변경전차량번호</th>
                <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-36">변경후차량번호</th>
                <th className="px-4 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-32">상세보기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-24 text-center">
                    <RefreshCw size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">기록을 불러오는 중...</p>
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-24 text-center text-gray-400 italic">저장된 변경 기록이 없습니다.</td>
                </tr>
              ) : (
                filteredHistory.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="px-4 py-4 text-center text-gray-400 font-mono text-xs">{filteredHistory.length - idx}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="px-2.5 py-1 bg-gray-50 text-gray-700 rounded-md border border-gray-100 text-xs font-bold">
                        {item.date}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white border border-gray-100 rounded-lg shadow-sm">
                          <Car size={14} className="text-blue-500" />
                        </div>
                        <span className="font-bold text-gray-900">{item.company}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="font-bold text-gray-600">{item.location}</span>
                    </td>
                    <td className="px-4 py-4 text-center text-gray-500 text-sm">
                      {item.prevPlate || '-'}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="font-black text-blue-600">
                        {item.newPlate}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center flex gap-2 justify-center">
                      <button 
                        onClick={() => handleViewDetail(item)}
                        className="flex items-center gap-1 bg-blue-600 text-white px-4 py-1.5 rounded-xl text-[11px] font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-md shadow-blue-100"
                      >
                        상세보기
                        <Printer size={12} />
                      </button>
                      <button 
                        onClick={onSelect}
                        className="flex items-center gap-1 bg-gray-100 text-gray-700 px-4 py-1.5 rounded-xl text-[11px] font-bold hover:bg-gray-200 transition-all active:scale-95"
                      >
                        이동
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ParkingInspectionHistory;