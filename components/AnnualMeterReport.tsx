import React, { useState, useEffect, useMemo } from 'react';
import { apiFetchRange } from '../services/dataService';
import { MeterReadingData, MeterReadingItem } from '../types';
import { format, parseISO } from 'date-fns';
import { Search, Printer, RefreshCw, FileText, ChevronDown, User, Calendar } from 'lucide-react';

const AnnualMeterReport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [allYearData, setAllYearData] = useState<MeterReadingData[]>([]);
  const [selectedTenantKey, setSelectedTenantKey] = useState<string>('');

  useEffect(() => { loadYearData(); }, [selectedYear]);

  const loadYearData = async () => {
    setLoading(true);
    try {
      const results = await apiFetchRange("METER_", `${selectedYear}-01-01`, `${selectedYear}-12-31`);
      const dataList = results.map((r: any) => r.data as MeterReadingData);
      setAllYearData(dataList);
      if (dataList.length > 0 && dataList[0].items.length > 0 && !selectedTenantKey) {
        const item = dataList[0].items[0]; setSelectedTenantKey(`${item.tenant}|${item.floor}`);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const tenantList = useMemo(() => {
    const tenantsMap = new Map<string, {name: string, floor: string}>();
    allYearData.forEach(monthData => monthData.items.forEach(item => { if (item.tenant) tenantsMap.set(`${item.tenant}|${item.floor || ''}`, { name: item.tenant, floor: item.floor || '' }); }));
    return Array.from(tenantsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allYearData]);

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
          totalUsage: nU + sU, 
          unitPrice: up, 
          totalAmount: nAmount + sAmount, 
          nPrev: normal?.prevReading || '-', 
          nCurr: normal?.currentReading || '-', 
          nUsage: nU,
          nAmount: nAmount,
          sPrev: special?.prevReading || '-', 
          sCurr: special?.currentReading || '-',
          sUsage: sU,
          sAmount: sAmount
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
        <td style="background:#fff7ed;">${m.data?m.data.nCurr:'-'}</td>
        <td style="font-weight:bold;">${m.data?m.data.nUsage.toLocaleString():'-'}</td>
        <td style="font-weight:bold; text-align:right; padding-right:10px;">${m.data?m.data.nAmount.toLocaleString():'-'}</td>
        <td>${m.data?m.data.sPrev:'-'}</td>
        <td style="background:#fff7ed;">${m.data?m.data.sCurr:'-'}</td>
        <td style="font-weight:bold;">${m.data?m.data.sUsage.toLocaleString():'-'}</td>
        <td style="font-weight:bold; text-align:right; padding-right:10px;">${m.data?m.data.sAmount.toLocaleString():'-'}</td>
      </tr>
    `).join('');
    
    const totals = monthlyStats.reduce((acc, curr) => { 
      if(curr.data) { 
        acc.nUsage += curr.data.nUsage; 
        acc.nAmount += curr.data.nAmount; 
        acc.sUsage += curr.data.sUsage; 
        acc.sAmount += curr.data.sAmount; 
        acc.total += curr.data.totalAmount; 
      } return acc; 
    }, { nUsage: 0, nAmount: 0, sUsage: 0, sAmount: 0, total: 0 });

    printWindow.document.write(`
      <html><head><title>연간검침보고서</title><style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
        @page { size: A4 portrait; margin: 0; }
        body { font-family: 'Noto Sans KR', sans-serif; background: #f1f5f9; padding: 0; margin: 0; -webkit-print-color-adjust: exact; }
        .no-print { display: flex; justify-content: center; padding: 20px; }
        @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; } }
        .print-page { width: 210mm; min-height: 297mm; padding: 25mm 12mm 10mm 12mm; margin: 20px auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); box-sizing: border-box; }
        h1 { text-align: center; font-size: 26pt; font-weight: 900; text-decoration: underline; text-underline-offset: 8px; margin-bottom: 35px; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; border: 1.5px solid black; table-layout: fixed; }
        th, td { border: 1px solid black; padding: 6px; text-align: center; font-size: 9pt; height: 35px; }
        th { background: #f3f4f6; font-weight: bold; }
        .total-row { background: #fffbeb; font-weight: bold; font-size: 10pt; }
      </style></head><body>
        <div class="no-print"><button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button></div>
        <div class="print-page"><h1>${selectedYear}년도 연간 전기검침 보고서</h1><div style="font-weight:bold; font-size:12pt; margin-bottom:15px;">업체명 : ${selName} (${selFloor})</div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width:40px;">월별</th>
              <th colspan="4">일반 지침</th>
              <th colspan="4">특수 지침</th>
            </tr>
            <tr>
              <th>전월</th><th>당월</th><th>사용량</th><th>청구금액</th>
              <th>전월</th><th>당월</th><th>사용량</th><th>청구금액</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="total-row">
              <td>합계</td>
              <td colspan="2">일반 합계</td>
              <td style="color:blue;">${totals.nUsage.toLocaleString()}</td>
              <td style="text-align:right; padding-right:10px;">${totals.nAmount.toLocaleString()}</td>
              <td colspan="2">특수 합계</td>
              <td style="color:blue;">${totals.sUsage.toLocaleString()}</td>
              <td style="text-align:right; padding-right:10px;">${totals.sAmount.toLocaleString()}</td>
            </tr>
            <tr class="total-row" style="background:#fef3c7; height:45px;">
              <td colspan="7" style="font-size:11pt; letter-spacing:1px;">연 간 청 구 총 액 (일반 + 특수)</td>
              <td colspan="2" style="text-align:right; padding-right:15px; font-size:14pt; color:red;">${totals.total.toLocaleString()} 원</td>
            </tr>
          </tbody>
        </table></div>
      </body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="px-4 py-2 border rounded-xl font-bold bg-gray-50">
            {Array.from({length: 11}, (_, i) => (new Date().getFullYear() - 5) + i).map(y => (
              <option key={y} value={y}>{y}년도</option>
            ))}
          </select>
          <select value={selectedTenantKey} onChange={e => setSelectedTenantKey(e.target.value)} className="flex-1 md:w-80 px-4 py-2 border rounded-xl font-bold bg-gray-50"><option value="">입주사 선택</option>{tenantList.map(t=><option key={`${t.name}|${t.floor}`} value={`${t.name}|${t.floor}`}>{t.name} ({t.floor})</option>)}</select>
        </div>
        <div className="flex gap-2 w-full md:w-auto"><button onClick={loadYearData} className="p-2.5 bg-gray-100 rounded-xl"><RefreshCw size={20} className={loading?'animate-spin':''} /></button><button onClick={handlePrint} disabled={!selectedTenantKey||loading} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gray-800 text-white px-6 py-2.5 rounded-xl font-bold disabled:bg-gray-300"><Printer size={18} />미리보기</button></div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden"><div className="p-4 bg-gray-50 border-b font-bold text-gray-800">연간 검침 데이터 현황</div>
        <div className="overflow-x-auto"><table className="w-full text-center border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th rowSpan={2} className="py-3 px-2 border-r">월</th>
              <th colSpan={2} className="py-2 border-r">일반 지침</th>
              <th colSpan={2} className="py-2 border-r">특수 지침</th>
              <th rowSpan={2} className="text-blue-600">사용량(kWh)</th>
            </tr>
            <tr className="bg-gray-50 border-b text-[11px] text-gray-500">
              <th className="py-1 border-r">전월</th>
              <th className="py-1 border-r">당월</th>
              <th className="py-1 border-r">전월</th>
              <th className="py-1 border-r">당월</th>
            </tr>
          </thead>
          <tbody className="divide-y">{monthlyStats.map(m => (<tr key={m.month} className="h-10 hover:bg-gray-50"><td className="font-bold border-r">{m.month}월</td><td className="border-r">{m.data?.nPrev||'-'}</td><td className="bg-blue-50/30 border-r">{m.data?.nCurr||'-'}</td><td className="border-r">{m.data?.sPrev||'-'}</td><td className="bg-blue-50/30 border-r">{m.data?.sCurr||'-'}</td><td className="font-bold text-blue-600">{m.data?m.data.totalUsage.toLocaleString():'-'}</td></tr>))}</tbody>
        </table></div>
      </div>
    </div>
  );
};

export default AnnualMeterReport;