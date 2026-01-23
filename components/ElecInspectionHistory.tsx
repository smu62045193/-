
import React, { useState, useEffect } from 'react';
import { apiFetchRange } from '../services/dataService';
import { RefreshCw, Search, History, Printer, Zap, Battery, Gauge, Truck, ShieldAlert, Settings2 } from 'lucide-react';
import { format, parseISO, getDay } from 'date-fns';

interface ElecInspectionHistoryProps {
  onSelect: (tabId: string, date: string) => void;
}

interface HistoryListItem {
  id: string;
  date: string;
  category: string;
  tabId: string;
  rawKey: string;
  data: any;
}

const ElecInspectionHistory: React.FC<ElecInspectionHistoryProps> = ({ onSelect }) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const CATEGORY_MAP: Record<string, { label: string, tabId: string, icon: React.ReactNode }> = {
    'METER_': { label: '계량기 검침', tabId: 'meter', icon: <Gauge size={16} className="text-orange-500" /> },
    'GEN_CHECK_': { label: '비상발전기 점검', tabId: 'generator', icon: <Settings2 size={16} className="text-blue-500" /> },
    'BATTERY_': { label: '밧데리 점검', tabId: 'battery', icon: <Battery size={16} className="text-emerald-500" /> },
    'LOAD_': { label: '부하전류 측정', tabId: 'load', icon: <Zap size={16} className="text-yellow-500" /> },
    'SAFETY_general_': { label: '전기설비 점검', tabId: 'safety_general', icon: <ShieldAlert size={16} className="text-red-500" /> },
    'SAFETY_ev_': { label: '전기자동차 점검', tabId: 'safety_ev', icon: <Truck size={16} className="text-cyan-500" /> },
  };

  useEffect(() => {
    loadAllHistory();
  }, []);

  const loadAllHistory = async () => {
    setLoading(true);
    try {
      const prefixes = Object.keys(CATEGORY_MAP);
      const allResults: HistoryListItem[] = [];

      const responses = await Promise.all(
        prefixes.map(prefix => apiFetchRange(prefix, "2024-01-01", "2034-12-31"))
      );

      responses.forEach((rows, idx) => {
        const prefix = prefixes[idx];
        const categoryInfo = CATEGORY_MAP[prefix];
        
        rows.forEach((row: any) => {
          const datePart = row.key.replace(prefix, '');
          allResults.push({
            id: row.key,
            date: datePart,
            category: categoryInfo.label,
            tabId: categoryInfo.tabId,
            rawKey: row.key,
            data: row.data
          });
        });
      });

      allResults.sort((a, b) => b.date.localeCompare(a.date));
      setHistory(allResults);
    } catch (e) {
      console.error("이력 로드 실패", e);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (item: HistoryListItem) => {
    const printWindow = window.open('', '_blank', 'width=1100,height=950');
    if (!printWindow || !item.data) return;

    let contentHtml = '';
    let styles = '';
    const d = item.data;
    const [y, m, dayPart] = item.date.split('-');
    
    // Fix: Define title variable at a scope where it is accessible by all branches and the final document write call.
    let title = `${item.category} - ${item.date}`;
    
    const commonStyles = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
        @page { size: A4 portrait; margin: 0; }
        body { font-family: 'Noto Sans KR', sans-serif; padding: 0; margin: 0; background: #f1f5f9; color: black; line-height: 1.1; -webkit-print-color-adjust: exact; }
        .no-print { display: flex; justify-content: center; padding: 20px; }
        @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; } }
        .print-page { width: 210mm; min-height: 297mm; padding: 25mm 12mm 10mm 12mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
        table { width: 100%; border-collapse: collapse; border: 1.5px solid black; table-layout: fixed; }
        th, td { border: 1px solid black !important; padding: 0; text-align: center; font-size: 11px; height: 35px !important; background: white; }
        .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; min-height: 100px; }
        .doc-title { font-size: 26pt; font-weight: 900; }
        .approval-table { width: 85mm !important; border: 1.5px solid black !important; margin-left: auto; }
        .approval-table th { height: 24px !important; font-size: 9pt !important; background: #f3f4f6 !important; font-weight: bold; }
        .approval-table td { height: 70px !important; border: 1px solid black !important; background: white !important; }
        .approval-table .side-header { width: 26px !important; }
        .label { background: #f9fafb !important; font-weight: bold; width: 120px; }
        .section-title { font-size: 14px; font-weight: bold; margin-bottom: 8px; margin-top: 15px; border-left: 5px solid black; padding-left: 10px; text-align: left; }
      </style>
    `;

    if (item.tabId === 'generator') {
      const monthNum = parseInt(m);
      const checkDateStr = d.test?.checkDate || item.date;
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = dayNames[getDay(parseISO(checkDateStr.length === 7 ? `${checkDateStr}-01` : checkDateStr))];

      // Fix: Assign specific title for generator
      title = `${monthNum}월 비상발전기 운전일지`;

      contentHtml = `
        <div class="header-flex"><div class="title-area"><div class="doc-title">${monthNum}월 비상발전기 운전일지</div></div>
          <table class="approval-table"><tr><th rowspan="2" class="side-header">결<br/>재</th><th>담 당</th><th>주 임</th><th>대 리</th><th>과 장</th><th>소 장</th></tr><tr><td></td><td></td><td></td><td></td><td></td></tr></table>
        </div>
        <div class="section-title">1. 비상 발전기 제원</div>
        <table>
          <tr><td class="label">제 조 사</td><td>${d.specs.manufacturer}</td><td class="label">출 력</td><td>${d.specs.output}</td></tr>
          <tr><td class="label">제작년도</td><td>${d.specs.year}</td><td class="label">정격전압</td><td>${d.specs.voltage}</td></tr>
          <tr><td class="label">제조번호</td><td>${d.specs.serialNo}</td><td class="label">정격전류</td><td>${d.specs.current}</td></tr>
          <tr><td class="label">형 식</td><td>${d.specs.type}</td><td class="label">회전속도</td><td>${d.specs.rpm}</td></tr>
          <tr><td class="label">위 치</td><td>${d.specs.location}</td><td class="label">여자방식</td><td>${d.specs.method}</td></tr>
        </table>
        <div style="display: flex; gap: 15px; margin-top: 15px;">
          <div style="flex: 2.2;">
            <div class="section-title">2. 무부하시 운전 및 점검</div>
            <table>
              <tr><td class="label">점검일자</td><td colspan="5" style="font-weight:bold; color:blue;">${checkDateStr} (${dayName})</td></tr>
              <tr><td class="label">운전사유</td><td colspan="5">${d.test.reason}</td></tr>
              <tr><td class="label">운전시간</td><td colspan="2">${d.test.startTime}</td><td>~</td><td colspan="2">${d.test.endTime}</td></tr>
              <tr><td class="label">사용시간</td><td colspan="2">${d.test.usedTime}</td><td class="label">월간가동</td><td colspan="2">${d.test.monthlyRunTime}</td></tr>
              <tr><td class="label">월 가동회수</td><td colspan="2">${d.test.monthlyRunCount}</td><td class="label">총가동시간</td><td colspan="2">${d.test.totalRunTime}</td></tr>
              <tr><td class="label">연료사용(ℓ)</td><td colspan="2">${d.test.fuelUsed}</td><td class="label">연료누계(ℓ)</td><td colspan="2">${d.test.fuelTotal}</td></tr>
              <tr><td class="label" rowspan="3">전 압(V)</td><td class="label">R-S/R-N</td><td>${d.test.voltsRS}</td><td class="label" rowspan="3">전 류(A)</td><td class="label">R</td><td>${d.test.ampR}</td></tr>
              <tr><td class="label">S-T/S-N</td><td>${d.test.voltsST}</td><td class="label">S</td><td>${d.test.ampS}</td></tr>
              <tr><td class="label">T-R/T-N</td><td>${d.test.voltsTR}</td><td class="label">T</td><td>${d.test.ampT}</td></tr>
              <tr><td class="label">오일온도(℃)</td><td colspan="2">${d.test.oilTemp}</td><td class="label">오일압력</td><td colspan="2">${d.test.oilPressure}</td></tr>
              <tr><td class="label">회전속도</td><td colspan="2">${d.test.rpmValue}</td><td class="label">배터리비중</td><td colspan="2">${d.test.batteryGravityValue}</td></tr>
            </table>
          </div>
          <div style="flex: 1;">
            <div class="section-title">3. 점검사항</div>
            <table>
              <thead><tr style="background:#f3f4f6;"><th>구분</th><th style="width:60px;">결과</th></tr></thead>
              <tbody>
                ${Object.entries(d.status).map(([k, v]) => `<tr><td style="font-size:10px;">${k}</td><td style="font-weight:bold; color:${v === '양호' ? 'blue' : 'red'};">${v}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="section-title">4. 특이사항</div>
        <div style="border:1.5px solid black; padding:15px; min-height:100px; font-size:11px;">${d.note || '이상 없음'}</div>
      `;
    } else if (item.tabId === 'meter') {
      // Fix: Update higher-scoped title instead of redeclaring local const.
      title = `${y}년 ${parseInt(m)}월 층별 계량기 검침내역`;
      const totalArea = d.items.reduce((sum: number, it: any) => sum + (parseFloat(String(it.area).replace(/,/g,'')) || 0), 0);
      const totalUsage = d.items.reduce((sum: number, it: any) => {
        const cv = parseFloat(String(it.currentReading).replace(/,/g,'')) || 0;
        const pv = parseFloat(String(it.prevReading).replace(/,/g,'')) || 0;
        const diff = cv < pv ? (100000 + cv) - pv : cv - pv;
        return sum + Math.round(diff * (parseFloat(it.multiplier) || 1));
      }, 0);
      const totalBill = parseInt(d.totalBillInput || '0');

      contentHtml = `
        <div style="text-align:center; margin-bottom:25px;"><h1 style="font-size:24pt; font-weight:900; text-decoration:underline; text-underline-offset:8px;">${title}</h1></div>
        <table style="margin-bottom:20px;">
          <tr style="background:#f3f4f6; font-weight:bold;"><th style="width:125px;">입주사명</th><th style="width:35px;">층</th><th style="width:45px;">면적</th><th style="width:55px;">기준전력</th><th style="width:65px;">전기요금</th><th style="width:70px;">당월지침</th><th style="width:70px;">전월지침</th><th style="width:55px;">사용량</th><th style="width:55px;">초과전력</th><th style="width:30px;">비고</th></tr>
          ${d.items.map((it: any) => {
            const cv = parseFloat(String(it.currentReading).replace(/,/g,'')) || 0;
            const pv = parseFloat(String(it.prevReading).replace(/,/g,'')) || 0;
            const usage = Math.round((cv < pv ? (100000 + cv) - pv : cv - pv) * (parseFloat(it.multiplier) || 1));
            const ref = parseFloat(it.refPower) || 0;
            const excess = it.note === '특수' ? usage : usage - ref;
            return `<tr><td style="text-align:left; padding-left:5px; font-weight:bold;">${it.tenant}</td><td>${it.floor}</td><td>${it.area}</td><td>${it.refPower}</td><td style="text-align:right; padding-right:5px; color:blue;">${(excess * parseInt(d.unitPrice || '228')).toLocaleString()}</td><td style="font-weight:bold; color:orange;">${it.currentReading}</td><td>${it.prevReading}</td><td style="font-weight:bold;">${usage.toLocaleString()}</td><td style="color:${excess > 0 ? 'red' : 'green'}; font-weight:bold;">${excess > 0 ? excess.toLocaleString() : ''}</td><td>${it.note}</td></tr>`;
          }).join('')}
          <tr style="background:#f9fafb; font-weight:bold;">
            <td colspan="2">합 계</td><td>${totalArea.toLocaleString()}</td><td></td><td style="text-align:right; padding-right:5px; color:blue;">${totalBill.toLocaleString()}</td><td colspan="2"></td><td style="color:orange;">${totalUsage.toLocaleString()}</td><td colspan="2"></td>
          </tr>
        </table>
      `;
    } else if (item.tabId === 'battery') {
      // Fix: Update title for battery branch
      title = `${parseInt(m)}월 정류기반/비상발전기 밧데리 점검`;
      contentHtml = `
        <div class="header-flex">
          <div class="title-area"><div class="doc-title">${parseInt(m)}월 정류기반/비상발전기<br/>밧데리 점검</div></div>
          <table class="approval-table"><tr><th rowspan="2" class="side-header">결<br/>재</th><th>담 당</th><th>주 임</th><th>대 리</th><th>과 장</th><th>소 장</th></tr><tr><td></td><td></td><td></td><td></td><td></td></tr></table>
        </div>
        <div style="text-align:right; font-weight:bold; margin-bottom:10px;">점검일자 : ${d.checkDate || item.date}</div>
        ${['rectifier', 'battery', 'generator'].map(section => {
          const label = section === 'rectifier' ? '1. 정류기반' : section === 'battery' ? '2. 정류기반 밧데리 개별전류' : '3. 비상용 발전기';
          const filtered = d.items.filter((it:any) => it.section === section);
          return `
            <div class="section-title">${label}</div>
            <table>
              <tr style="background:#f3f4f6;"><th>구분</th><th style="width:130px;">제조업체</th><th style="width:95px;">제조년월일</th><th>규격/차단기</th><th style="width:60px;">전압</th><th style="width:60px;">비고</th></tr>
              ${filtered.map((it:any) => `<tr><td style="font-weight:bold;">${it.label}</td><td>${it.manufacturer}</td><td>${it.manufDate}</td><td style="text-align:left; padding-left:10px;">${it.spec}</td><td style="font-weight:bold; color:blue;">${it.voltage}</td><td>${it.remarks}</td></tr>`).join('')}
            </table>
          `;
        }).join('')}
      `;
    } else if (item.tabId === 'load') {
      // Fix: Update title for load branch
      title = `${parseInt(m)}월 부하 전류 점검 기록부`;
      contentHtml = `
        <div class="header-flex">
          <div class="title-area"><div class="doc-title" style="text-decoration:underline;">${parseInt(m)}월 부하 전류 점검 기록부</div></div>
          <table class="approval-table" style="width:70mm;"><tr><th rowspan="2" class="side-header">결<br/>재</th><th>대 리</th><th>과 장</th><th>소 장</th></tr><tr><td></td><td></td><td></td></tr></table>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-weight:bold;"><div>전체 층 점검 내역</div><div>점검일자 : ${d.period || item.date}</div></div>
        <table>
          <tr style="background:#f3f4f6;"><th rowspan="2" style="width:45px;">층</th><th rowspan="2">점검대상</th><th rowspan="2" style="width:45px;">순서</th><th colspan="3" style="background:#eff6ff;">좌측</th><th colspan="3" style="background:#fff7ed;">우측</th></tr>
          <tr style="background:#f3f4f6;"><th>용량</th><th>측정</th><th>비고</th><th>용량</th><th>측정</th><th>비고</th></tr>
          ${d.items.map((it:any) => `<tr><td style="font-weight:bold; color:blue;">${it.floor}</td><td style="text-align:left; padding-left:8px;">${it.targetL}</td><td>${it.orderL}</td><td>${it.capacityL}</td><td style="font-weight:bold; color:blue;">${it.valueL}</td><td>${it.noteL}</td><td>${it.capacityR}</td><td style="font-weight:bold; color:blue;">${it.valueR}</td><td>${it.noteR}</td></tr>`).join('')}
        </table>
      `;
    } else if (item.tabId.startsWith('safety')) {
      const isEv = item.tabId === 'safety_ev';
      // Fix: Update title for safety branch
      title = isEv ? '전기자동차 충전시설 점검 기록표' : '전기설비점검결과기록표';
      contentHtml = `
        <div class="header-flex">
          <div class="title-area"><div class="doc-title" style="text-decoration:underline;">${isEv ? '전기자동차 충전시설 점검 기록표' : '전기설비점검결과기록표'}</div></div>
          <table class="approval-table" style="width:50mm;"><tr><th rowspan="2" class="side-header">결<br/>재</th><th style="height:22px;">과 장</th><th style="height:22px;">소 장</th></tr><tr><td style="height:65px;"></td><td style="height:65px;"></td></tr></table>
        </div>
        <div style="font-weight:bold; margin-bottom:10px;">설비명(상호) : 새마을운동 중앙회 대치동 사옥</div>
        <div class="section-title">1. 기본사항</div>
        <table style="margin-bottom:15px;">
          <tr><td class="label">점검일자</td><td style="font-weight:bold; color:blue;">${item.date}</td><td class="label">점검자</td><td>${d.approver}</td></tr>
        </table>
        <div class="section-title">2. 종합의견</div>
        <div style="border:1.5px solid black; padding:15px; min-height:120px; font-size:12px; white-space:pre-wrap;">${d.opinion || '이상 없음'}</div>
      `;
    }

    printWindow.document.write(`<html><head><title>${title}</title>${commonStyles}</head><body><div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div><div class="print-page">${contentHtml}</div></body></html>`);
    printWindow.document.close();
  };

  const filteredHistory = history.filter(item => 
    item.category.includes(searchTerm) || item.date.includes(searchTerm)
  );

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <History size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">전기 점검 통합 이력</h2>
            <p className="text-xs text-gray-400 mt-0.5">계량기, 발전기, 밧데리 등 모든 전기 점검 기록입니다.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <input 
              type="text" 
              placeholder="항목명 또는 날짜(YYYY-MM) 검색" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-gray-50 text-black outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
            />
            <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
          </div>
          <button 
            onClick={loadAllHistory}
            className="p-2.5 hover:bg-gray-100 rounded-xl transition-all text-gray-500 border border-gray-200 bg-white shadow-sm active:scale-95"
            title="새로고침"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[750px] border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-20">No</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-40">점검일자</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase tracking-wider">점검 항목명 (구분)</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-56">상세보기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-24 text-center">
                    <RefreshCw size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">데이터를 집계하는 중...</p>
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-24 text-center text-gray-400 italic">저장된 점검 기록이 없습니다.</td>
                </tr>
              ) : (
                filteredHistory.map((item, idx) => {
                  const prefix = Object.keys(CATEGORY_MAP).find(p => item.rawKey.startsWith(p));
                  const icon = prefix ? CATEGORY_MAP[prefix].icon : <Zap size={16} />;
                  
                  return (
                    <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group">
                      <td className="px-6 py-4 text-center text-gray-400 font-mono text-xs">{filteredHistory.length - idx}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1 bg-gray-50 text-gray-700 rounded-md border border-gray-100 text-sm font-bold">
                          {item.date}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white border border-gray-100 rounded-lg shadow-sm">
                            {icon}
                          </div>
                          <span className="font-bold text-gray-900">{item.category}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center flex gap-2 justify-center">
                        <button 
                          onClick={() => handleViewDetail(item)}
                          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-md shadow-blue-100"
                        >
                          상세보기
                          <Printer size={12} />
                        </button>
                        <button 
                          onClick={() => onSelect(item.tabId, item.date)}
                          className="flex items-center gap-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all active:scale-95"
                        >
                          편집
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ElecInspectionHistory;
