
import React, { useState, useEffect, useMemo } from 'react';
import { apiFetchRange, fetchTenants } from '../services/dataService';
import { MeterReadingData, MeterReadingItem, Tenant } from '../types';
import { format, parseISO } from 'date-fns';
import { Search, Printer, RefreshCw, FileText, ChevronDown, User, Calendar, Building2, ChevronLeft, ChevronRight } from 'lucide-react';

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

interface AnnualMeterReportProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  tabs?: { id: string; label: string }[];
  currentMonth?: string;
  setCurrentMonth?: (month: string) => void;
}

const AnnualMeterReport: React.FC<AnnualMeterReportProps> = ({ 
  activeTab, 
  setActiveTab, 
  tabs,
  currentMonth
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [allYearData, setAllYearData] = useState<MeterReadingData[]>([]);
  const [masterTenants, setMasterTenants] = useState<Tenant[]>([]);
  const [selectedTenantKey, setSelectedTenantKey] = useState<string>('');

  useEffect(() => { loadYearData(); }, [selectedYear]);

  const loadYearData = async () => {
    setLoading(true);
    try {
      const [results, tenants] = await Promise.all([
        apiFetchRange("METER_", `${selectedYear}-01`, `${selectedYear}-12-31`),
        fetchTenants()
      ]);
      const dataList = results.map((r: any) => r.data as MeterReadingData);
      setAllYearData(dataList);
      setMasterTenants(tenants || []);
      
      if (!selectedTenantKey) {
        if (dataList.length > 0 && dataList[0].items.length > 0) {
          const item = dataList[0].items[0]; setSelectedTenantKey(`${item.tenant}|${item.floor}`);
        } else if (tenants && tenants.length > 0) {
          setSelectedTenantKey(`${tenants[0].name}|${tenants[0].floor}`);
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const tenantList = useMemo(() => {
    const tenantsMap = new Map<string, {name: string, floor: string}>();
    // 1. 마스터 DB 입주사 먼저 추가
    masterTenants.forEach(t => {
      if (t.name) tenantsMap.set(`${t.name}|${t.floor || ''}`, { name: t.name, floor: t.floor || '' });
    });
    // 2. 검침 기록에 있는 입주사 추가 (과거에 있었으나 지금은 나간 입주사 포함)
    allYearData.forEach(monthData => monthData.items.forEach(item => { 
      if (item.tenant) tenantsMap.set(`${item.tenant}|${item.floor || ''}`, { name: item.tenant, floor: item.floor || '' }); 
    }));
    return Array.from(tenantsMap.values()).sort((a, b) => {
      const weightA = getFloorWeight(a.floor);
      const weightB = getFloorWeight(b.floor);
      if (weightA !== weightB) return weightA - weightB;
      return a.name.localeCompare(b.name);
    });
  }, [allYearData, masterTenants]);

  const monthlyStats = useMemo(() => {
    if (!selectedTenantKey) return [];
    const [selName, selFloor] = selectedTenantKey.split('|');
    return Array.from({ length: 12 }, (_, i) => {
      const monthStr = (i + 1).toString().padStart(2, '0');
      const monthData = allYearData.find(d => d.month === `${selectedYear}-${monthStr}`);
      if (!monthData) return { month: i + 1, data: null };
      const tenantItems = monthData.items.filter(it => it.tenant === selName && it.floor === selFloor);
      const normal = tenantItems.find(it => it.note === '일반'); const special = tenantItems.find(it => it.note === '특수');
      if (!normal && !special) return { month: i + 1, data: null };
      const calcUsage = (c:string, p:string, m:string) => {
        const cv = parseFloat(String(c||'0').replace(/,/g,'')); const pv = parseFloat(String(p||'0').replace(/,/g,'')); const mv = parseFloat(String(m||'1').replace(/,/g,''));
        return Math.round((cv < pv ? (100000 + cv) - pv : cv - pv) * mv);
      };
      const nU = normal ? calcUsage(normal.currentReading, normal.prevReading, normal.multiplier) : 0;
      const sU = special ? calcUsage(special.currentReading, special.prevReading, special.multiplier) : 0;
      const up = parseFloat(monthData.unitPrice || '200'); const ref = normal ? parseFloat(normal.refPower || '2380') : 0;
      const nAmount = Math.round(Math.max(0, (nU - ref) * up));
      const sAmount = Math.round(sU * up);
      return { 
        month: i + 1, 
        data: { 
          totalUsage: nU + sU, unitPrice: up, totalAmount: nAmount + sAmount, 
          nPrev: normal?.prevReading || '-', nCurr: normal?.currentReading || '-', nUsage: nU, nAmount: nAmount,
          sPrev: special?.prevReading || '-', sCurr: special?.currentReading || '-', sUsage: sU, sAmount: sAmount
        } 
      };
    });
  }, [selectedTenantKey, allYearData, selectedYear]);

  const handlePrint = () => {
    if (!selectedTenantKey) return;
    const [selName, selFloor] = selectedTenantKey.split('|');
    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) return;
    const rows = monthlyStats.map(m => `
      <tr style="height:38px;">
        <td>${m.month}월</td>
        <td>${m.data?m.data.nPrev:'-'}</td>
        <td>${m.data?m.data.nCurr:'-'}</td>
        <td>${m.data?m.data.nUsage.toLocaleString():'-'}</td>
        <td style="text-align:right; padding-right:10px;">${m.data?m.data.nAmount.toLocaleString():'-'}</td>
        <td>${m.data?m.data.sPrev:'-'}</td>
        <td>${m.data?m.data.sCurr:'-'}</td>
        <td>${m.data?m.data.sUsage.toLocaleString():'-'}</td>
        <td style="text-align:right; padding-right:10px;">${m.data?m.data.sAmount.toLocaleString():'-'}</td>
      </tr>`).join('');
    const totals = monthlyStats.reduce((acc, curr) => { 
      if(curr.data) { acc.nUsage += curr.data.nUsage; acc.nAmount += curr.data.nAmount; acc.sUsage += curr.data.sUsage; acc.sAmount += curr.data.sAmount; acc.total += curr.data.totalAmount; } return acc; 
    }, { nUsage: 0, nAmount: 0, sUsage: 0, sAmount: 0, total: 0 });

    printWindow.document.write(`
      <html><head><title>연간검침보고서</title><style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
        @page { size: A4 portrait; margin: 0; }
        body { font-family: 'Noto Sans KR', sans-serif; background: black !important; padding: 0; margin: 0; -webkit-print-color-adjust: exact; color: black; line-height: 1.4; }
        .no-print { display: flex; justify-content: center; padding: 20px; }
        @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; } }
        .print-page { width: 210mm; min-height: 297mm; padding: 25mm 12mm 10mm 12mm; margin: 20px auto; background: white !important; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
        h1 { text-align: center; font-size: 26pt; font-weight: 900; text-decoration: underline; text-underline-offset: 8px; margin-bottom: 35px; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; border: 1.5px solid black; table-layout: fixed; background: white; }
        th, td { border: 1px solid black; padding: 6px; text-align: center; font-size: 9pt; height: 35px; background: white; font-weight: normal; color: black; }
        th { font-weight: bold; }
        .total-row { background: white; font-weight: normal; font-size: 10pt; }
        .no-print button { padding: 12px 30px; background: #1e3a8a; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13pt; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: all 0.2s; }
        .no-print button:hover { background: #172554; transform: translateY(-1px); }
      </style></head><body>
        <div class="no-print"><button onclick="window.print()">인쇄하기</button></div>
        <div class="print-page"><h1>${selectedYear}년도 연간 전기검침 보고서</h1><div style="font-weight:bold; font-size:12pt; margin-bottom:15px;">업체명 : ${selName} (${selFloor})</div>
        <table><thead><tr><th rowspan="2" style="width:40px;">월별</th><th colspan="4">일반 지침</th><th colspan="4">특수 지침</th></tr><tr><th>전월</th><th>당월</th><th>사용량</th><th>청구금액</th><th>전월</th><th>당월</th><th>사용량</th><th>청구금액</th></tr></thead>
          <tbody>${rows}<tr class="total-row"><td>합계</td><td colspan="2">일반 합계</td><td style="color:black;">${totals.nUsage.toLocaleString()}</td><td style="text-align:right; padding-right:10px;">${totals.nAmount.toLocaleString()}</td><td colspan="2">특수 합계</td><td style="color:black;">${totals.sUsage.toLocaleString()}</td><td style="text-align:right; padding-right:10px;">${totals.sAmount.toLocaleString()}</td></tr>
            <tr class="total-row" style="background:white; height:45px;"><td colspan="7" style="font-size:11pt; letter-spacing:1px;">연 간 청 구 총 액 (일반 + 특수)</td><td colspan="2" style="text-align:right; padding-right:15px; font-size:14pt; color:black;">${totals.total.toLocaleString()} 원</td></tr>
          </tbody></table></div></body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="space-y-2 animate-fade-in pb-10">
      {/* Row 1: Year Nav, Sub-tabs and Action Buttons */}
      <div className="bg-white w-full max-w-7xl mx-auto flex items-stretch justify-start scrollbar-hide overflow-x-auto border-b border-black">
        {/* 1. 날짜 선택 영역 (년 네비게이션) */}
        <div className="flex items-center shrink-0">
          <button 
            onClick={() => setSelectedYear(prev => prev - 1)} 
            className="px-2 py-3 text-gray-500 hover:text-black transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="px-2 py-3 text-[14px] font-bold text-black min-w-[100px] text-center">
            {selectedYear}년
          </div>
          <button 
            onClick={() => setSelectedYear(prev => prev + 1)} 
            className="px-2 py-3 text-gray-500 hover:text-black transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 구분선 (검정색 1px) */}
        <div className="flex items-center shrink-0 px-2">
          <div className="w-[1px] h-6 bg-black"></div>
        </div>

        <div className="flex shrink-0">
          {tabs && setActiveTab && tabs.map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer bg-white ${activeTab === tab.id ? 'text-orange-600' : 'text-gray-500 hover:text-black'}`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
              )}
            </div>
          ))}
        </div>
        
        <div className="flex items-center shrink-0 px-2">
          <div className="w-[1px] h-6 bg-black"></div>
        </div>

        <div className="flex items-center print:hidden shrink-0">
          <button 
            onClick={loadYearData} 
            className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <button 
            onClick={handlePrint} 
            disabled={!selectedTenantKey||loading} 
            className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
          >
            <Printer size={18} className="mr-1.5" />
            인쇄
          </button>
        </div>

        {/* 구분선 (검정색 1px) */}
        <div className="flex items-center shrink-0 px-2">
          <div className="w-[1px] h-6 bg-black"></div>
        </div>

        {/* 입주사 선택 */}
        <div className="flex items-center shrink-0">
          <select 
            value={selectedTenantKey} 
            onChange={e => setSelectedTenantKey(e.target.value)} 
            className="px-4 py-2 font-black text-blue-700 bg-white outline-none text-[14px] min-w-[200px]"
          >
            <option value="">입주사 선택</option>
            {tenantList.map(t=><option key={`${t.name}|${t.floor}`} value={`${t.name}|${t.floor}`}>{t.name} ( {t.floor} )</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border-t border-l border-black w-full max-w-7xl mx-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-white h-[40px]">
                <th rowSpan={2} className="border-b border-r border-black text-center text-[13px] font-normal text-black w-16 p-0">
                  <div className="flex items-center justify-center h-full px-2">월</div>
                </th>
                <th colSpan={3} className="border-b border-r border-black text-center text-[13px] font-normal text-black p-0">
                  <div className="flex items-center justify-center h-full px-2">일반 지침</div>
                </th>
                <th colSpan={3} className="border-b border-r border-black text-center text-[13px] font-normal text-black p-0">
                  <div className="flex items-center justify-center h-full px-2">특수 지침</div>
                </th>
                <th rowSpan={2} className="border-b border-r border-black text-center text-[13px] font-normal text-black p-0">
                  <div className="flex items-center justify-center h-full px-2">합계 사용량(kWh)</div>
                </th>
              </tr>
              <tr className="bg-white h-[40px]">
                <th className="border-b border-r border-black text-center text-[13px] font-normal text-black p-0">
                  <div className="flex items-center justify-center h-full px-2">전월지침</div>
                </th>
                <th className="border-b border-r border-black text-center text-[13px] font-normal text-black p-0">
                  <div className="flex items-center justify-center h-full px-2">당월지침</div>
                </th>
                <th className="border-b border-r border-black text-center text-[13px] font-normal text-black p-0">
                  <div className="flex items-center justify-center h-full px-2">사용량</div>
                </th>
                <th className="border-b border-r border-black text-center text-[13px] font-normal text-black p-0">
                  <div className="flex items-center justify-center h-full px-2">전월지침</div>
                </th>
                <th className="border-b border-r border-black text-center text-[13px] font-normal text-black p-0">
                  <div className="flex items-center justify-center h-full px-2">당월지침</div>
                </th>
                <th className="border-b border-r border-black text-center text-[13px] font-normal text-black p-0">
                  <div className="flex items-center justify-center h-full px-2">사용량</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {monthlyStats.map(m => (
                <tr key={m.month} className="bg-white hover:bg-blue-50/30 transition-colors text-center h-[40px]">
                  <td className="border-b border-r border-black text-[13px] font-normal text-black p-0">
                    <div className="flex items-center justify-center h-full px-2">{m.month}월</div>
                  </td>
                  <td className="border-b border-r border-black text-[13px] font-normal text-black p-0">
                    <div className="flex items-center justify-center h-full px-2">{m.data?.nPrev||'-'}</div>
                  </td>
                  <td className="border-b border-r border-black text-[13px] font-normal text-black p-0">
                    <div className="flex items-center justify-center h-full px-2">{m.data?.nCurr||'-'}</div>
                  </td>
                  <td className="border-b border-r border-black text-[13px] font-normal text-black p-0">
                    <div className="flex items-center justify-center h-full px-2">{m.data ? m.data.nUsage.toLocaleString() : '-'}</div>
                  </td>
                  <td className="border-b border-r border-black text-[13px] font-normal text-black p-0">
                    <div className="flex items-center justify-center h-full px-2">{m.data?.sPrev||'-'}</div>
                  </td>
                  <td className="border-b border-r border-black text-[13px] font-normal text-black p-0">
                    <div className="flex items-center justify-center h-full px-2">{m.data?.sCurr||'-'}</div>
                  </td>
                  <td className="border-b border-r border-black text-[13px] font-normal text-black p-0">
                    <div className="flex items-center justify-center h-full px-2">{m.data ? m.data.sUsage.toLocaleString() : '-'}</div>
                  </td>
                  <td className="border-b border-r border-black text-[13px] font-normal text-black p-0">
                    <div className="flex items-center justify-center h-full px-2">{m.data ? m.data.totalUsage.toLocaleString() : '-'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnnualMeterReport;
