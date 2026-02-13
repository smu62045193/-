
import { format, startOfMonth, subDays, parseISO } from 'date-fns';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetchRange, fetchDailyData, fetchSubstationLog, getInitialSubstationLog, saveDailyData, saveSubstationLog, getInitialDailyData } from '../services/dataService';
import { AcbReadings, PowerUsageReadings, SubstationLogData, VcbReadings, DailyData } from '../types';
import LogSheetLayout from './LogSheetLayout';
import { Save, RefreshCw, CheckCircle2, Cloud, X } from 'lucide-react';

interface SubstationLogProps {
  currentDate: Date;
  isEmbedded?: boolean;
  onUsageChange?: (val: string) => void;
}

const SubstationLog: React.FC<SubstationLogProps> = ({ currentDate, isEmbedded = false, onUsageChange }) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  
  const [data, setData] = useState<SubstationLogData>(getInitialSubstationLog(dateKey));
  
  const historySumRef = useRef<number>(0);
  const isInitialLoad = useRef(true);
  const lastLoadedDate = useRef<string>('');
  const lastSyncedUsageRef = useRef<string>('');

  const safeParseFloat = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const cleaned = val.toString().replace(/,/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  /**
   * 전력량 데이터 객체의 키를 표준(영문 CamelCase)으로 정규화하는 헬퍼 함수
   * DB 원본 데이터와 앱 내 데이터를 통합 관리 (모든 케이스 대응)
   */
  const normalizePowerReadings = (raw: any): PowerUsageReadings => {
    const result: PowerUsageReadings = { activeMid: '', activeMax: '', activeLight: '', reactiveMid: '', reactiveMax: '' };
    if (!raw || typeof raw !== 'object') return result;
    
    // DB의 snake_case와 앱의 camelCase, 한글 키 모두 대응
    result.activeMid = String(raw.activeMid || raw.active_mid || raw["중간"] || raw["active_mid"] || '').trim();
    result.activeMax = String(raw.activeMax || raw.active_max || raw["최대"] || raw["active_max"] || '').trim();
    result.activeLight = String(raw.activeLight || raw.active_light || raw["경부하"] || raw["active_light"] || '').trim();
    result.reactiveMid = String(raw.reactiveMid || raw.reactive_mid || raw["무효중간"] || raw["reactive_mid"] || '').trim();
    result.reactiveMax = String(raw.reactiveMax || raw.reactive_max || raw["무효최대"] || raw["reactive_max"] || '').trim();

    return result;
  };

  const calculateDailyAnalysis = useCallback((currentData: SubstationLogData, hSum: number) => {
    if (!currentData) return getInitialSubstationLog(dateKey);
    
    const newData = JSON.parse(JSON.stringify(currentData)) as SubstationLogData; 
    const { powerUsage, dailyStats } = newData;

    if (!powerUsage || !dailyStats) return newData;

    const fields: (keyof PowerUsageReadings)[] = ['activeMid', 'activeMax', 'activeLight', 'reactiveMid', 'reactiveMax'];
    let totalActiveUsage = 0;
    let totalReactiveUsage = 0;

    fields.forEach(f => {
      const p = safeParseFloat(powerUsage.prev[f]);
      const c = safeParseFloat(powerUsage.curr[f]);
      
      if (c > 0) {
        let diff = 0;
        if (c < p) {
          const rolloverBase = p < 100000 ? 100000 : 1000000;
          diff = (rolloverBase + c) - p;
        } else {
          diff = c - p;
        }
        
        const usage = Math.round(diff * 1200);
        powerUsage.usage[f] = usage.toString();
        
        if (f.startsWith('active')) totalActiveUsage += usage;
        else if (f.startsWith('reactive')) totalReactiveUsage += usage;
      } else {
        powerUsage.usage[f] = '';
      }
    });

    dailyStats.activePower = totalActiveUsage > 0 ? totalActiveUsage.toString() : '';
    dailyStats.reactivePower = totalReactiveUsage > 0 ? totalReactiveUsage.toString() : '';
    // 금월누계 = 이전 일자들 합계(hSum) + 오늘 실시간 사용량
    dailyStats.monthTotal = Math.round(hSum + totalActiveUsage).toString();

    const vcbMain = newData.vcb?.time9?.main || newData.vcb?.time21?.main;
    if (vcbMain && (vcbMain.pf || vcbMain.a)) {
      const kVA_Const = 1.7321 * 22.9; 
      const pfNum = safeParseFloat(vcbMain.pf);
      const currentA = safeParseFloat(vcbMain.a);
      const maxPowerNum = kVA_Const * currentA * (pfNum / 100);
      dailyStats.maxPower = maxPowerNum > 0 ? Math.round(maxPowerNum).toString() : '0';

      if (totalActiveUsage > 0) {
        const totalApparent = Math.sqrt(Math.pow(totalActiveUsage, 2) + Math.pow(totalReactiveUsage, 2));
        const pfCalc = (totalActiveUsage / totalApparent) * 100;
        dailyStats.powerFactor = isNaN(pfCalc) ? '0' : pfCalc.toFixed(1);
      }
      if (maxPowerNum > 0 && totalActiveUsage > 0) {
        const loadFactorCalc = ((totalActiveUsage / 24) / maxPowerNum) * 100;
        dailyStats.loadFactor = isNaN(loadFactorCalc) ? '0' : loadFactorCalc.toFixed(1);
      }
      // 수용율 계산 로직 수정: (최대전력 / 계약전력 1600kW) * 100
      if (maxPowerNum > 0) {
        const demandFactorCalc = (maxPowerNum / 1600) * 100;
        dailyStats.demandFactor = isNaN(demandFactorCalc) ? '0' : demandFactorCalc.toFixed(1);
      }
    }

    return newData;
  }, [dateKey]);

  useEffect(() => {
    const currentUsage = data.dailyStats?.activePower;
    if (onUsageChange && currentUsage && currentUsage !== '0' && currentUsage !== lastSyncedUsageRef.current) {
      lastSyncedUsageRef.current = currentUsage;
      onUsageChange(currentUsage);
    }
  }, [data.dailyStats?.activePower, onUsageChange]);

  const loadData = useCallback(async (force = false) => {
    setData(getInitialSubstationLog(dateKey));
    setLoading(true);
    isInitialLoad.current = true;
    setSaveStatus('idle');

    try {
      const monthStart = startOfMonth(currentDate);
      const monthStartStr = format(monthStart, 'yyyy-MM-dd');
      const yesterdayStr = format(subDays(currentDate, 1), 'yyyy-MM-dd');
      
      // 1. 이번 달 과거 데이터 전체 조회 (누계 계산 및 연동용)
      const logsForMonth = await apiFetchRange("SUB_LOG_", monthStartStr, yesterdayStr);
      
      let hSum = 0;
      let latestPrevRecord = null;
      let sortedLogs: any[] = [];

      if (logsForMonth && logsForMonth.length > 0) {
        // 오늘 날짜(`SUB_LOG_${dateKey}`)보다 엄격하게 이전인 기록만 필터링
        const filteredHistory = logsForMonth.filter(row => {
          const rowDate = row.key.replace("SUB_LOG_", "");
          return rowDate < dateKey;
        });
        
        sortedLogs = [...filteredHistory].sort((a, b) => b.key.localeCompare(a.key));
        
        if (sortedLogs.length > 0) {
          latestPrevRecord = sortedLogs[0].data;
        }

        // 금월 누계 합산 (오늘 이전 기록들의 사용량 합계)
        filteredHistory.forEach(row => {
          const stats = row.data?.dailyStats || row.data?.daily_stats;
          const rowActive = stats?.activePower || stats?.active_power;
          if (rowActive) hSum += safeParseFloat(rowActive);
        });
      }
      historySumRef.current = hSum;

      // 2. 현재 날짜의 저장된 데이터 로드
      const fetched = await fetchSubstationLog(dateKey, force);
      let finalData: SubstationLogData = fetched || getInitialSubstationLog(dateKey);

      // 데이터 정규화 강제 수행 (DB 필드명 불일치 방지)
      const rawPU = (finalData.powerUsage || (finalData as any).power_usage) || {};
      finalData.powerUsage = {
        prev: normalizePowerReadings(rawPU.prev || rawPU["이전"]),
        curr: normalizePowerReadings(rawPU.curr || rawPU["현재"]),
        usage: normalizePowerReadings(rawPU.usage || rawPU["사용량"])
      };

      // 3. 전일 지침 자동 연동
      // 현재 전일지침이 비어있는 경우에만, 찾아낸 가장 최근 과거 기록의 '금일지침'을 가져옵니다.
      const currentPrevMid = finalData.powerUsage?.prev?.activeMid;
      const isPrevEmpty = !currentPrevMid || currentPrevMid.trim() === '' || currentPrevMid === '0';
      
      if (isPrevEmpty && latestPrevRecord) {
        const prevPU = latestPrevRecord.powerUsage || (latestPrevRecord as any).power_usage;
        if (prevPU) {
          const prevCurrRaw = prevPU.curr || prevPU["현재"] || prevPU.current;
          if (prevCurrRaw) {
            finalData.powerUsage.prev = normalizePowerReadings(prevCurrRaw);
            console.log(`[연동 성공] 이전 기록(${latestPrevRecord.date || '알수없음'})의 금일지침을 금일 전일지침으로 가져왔습니다.`);
          }
        }
      }

      // 4. 분석 수행 및 상태 반영
      const analyzedData = calculateDailyAnalysis(finalData, hSum);
      setData(analyzedData);
      lastLoadedDate.current = dateKey;
      setTimeout(() => { isInitialLoad.current = false; }, 300);
    } catch (e) { 
      console.error("Substation load error:", e); 
      setData(getInitialSubstationLog(dateKey));
    } finally { 
      setLoading(false); 
    }
  }, [dateKey, currentDate, calculateDailyAnalysis]);

  useEffect(() => { loadData(false); }, [dateKey]);

  const handleSave = async () => {
    if (saveStatus === 'loading') return;
    setSaveStatus('loading');
    try {
      const success = await saveSubstationLog(data);
      if (success) {
        let currentDaily = await fetchDailyData(dateKey, true);
        if (!currentDaily) currentDaily = getInitialDailyData(dateKey);
        
        await saveDailyData({
          ...currentDaily,
          utility: { 
            ...currentDaily.utility, 
            electricity: data.dailyStats.activePower 
          },
          lastUpdated: new Date().toISOString()
        });
        
        setSaveStatus('success');
        alert('저장이 완료되었습니다.');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장에 실패했습니다.');
      }
    } catch (e) { 
      console.error(e);
      setSaveStatus('error'); 
    }
  };

  const updateVcb = (time: 'time9' | 'time21', section: keyof VcbReadings, field: string, value: string) => {
    if (field === 'v') return; 
    setData(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as SubstationLogData;
      const targetSection = (next.vcb[time] as any)[section];
      if (targetSection) {
        targetSection[field] = value;
        if (section === 'main' && field === 'pf') {
          if (next.vcb[time].tr1) next.vcb[time].tr1.pf = value;
          if (next.vcb[time].tr2) next.vcb[time].tr2.pf = value;
          if (next.vcb[time].tr3) next.vcb[time].tr3.pf = value;
        }
      }
      return calculateDailyAnalysis(next, historySumRef.current);
    });
  };

  const updateAcb = (time: 'time9' | 'time21', section: keyof AcbReadings, field: string, value: string) => {
    setData(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as SubstationLogData;
      const targetSection = (next.acb[time] as any)[section];
      if (targetSection) targetSection[field] = value;
      return next;
    });
  };

  const updatePower = (row: 'prev' | 'curr' | 'usage', field: keyof PowerUsageReadings, value: string) => {
    if (row === 'usage') return; 
    setData(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as SubstationLogData;
      if (next.powerUsage) {
        next.powerUsage[row][field] = value;
      }
      return calculateDailyAnalysis(next, historySumRef.current);
    });
  };

  const handlePrint = () => {
    const printContent = document.getElementById('substation-log-print-area');
    if (!printContent) return;
    const formattedYear = format(currentDate, 'yyyy');
    const formattedMonth = format(currentDate, 'MM');
    const formattedDay = format(currentDate, 'dd');
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const formattedDayName = days[currentDate.getDay()];
    
    const inputs = printContent.querySelectorAll('input');
    inputs.forEach(input => { input.setAttribute('value', input.value); });
    
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>수변전반일지 - ${dateKey}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page { margin: 0; size: A4 portrait; }
            body { 
              background: #f1f5f9 !important; 
              font-family: sans-serif; 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact;
              width: 100%; 
              margin: 0; 
              padding: 0; 
            }
            .no-print { margin: 20px; display: flex; gap: 10px; justify-content: center; }
            @media print { .no-print { display: none !important; } body { background: white !important; } }
            .print-page { 
              width: 210mm; 
              min-height: 297mm;
              padding: 25mm 10mm 10mm 10mm;
              margin: 0 auto;
              box-sizing: border-box;
              background: white !important;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            @media print { .print-page { box-shadow: none !important; margin: 0; } }
            table { 
              width: 100% !important; 
              border-collapse: collapse !important; 
              border: 1.2px solid black !important; 
              table-layout: fixed !important; 
              margin-bottom: 12px; 
              background: white !important; 
            }
            th, td { 
              border: 1px solid black !important; 
              text-align: center !important; 
              height: 42px !important; 
              color: black !important; 
              background: white !important; 
              box-sizing: border-box !important;
              padding: 0 !important;
            }
            th { 
              font-weight: bold !important; 
              height: 38px !important; 
              font-size: 8.5pt !important; 
              background-color: #f9fafb !important;
            }
            td { font-size: 10pt !important; }
            input { 
              border: none !important; 
              width: 100% !important; 
              text-align: center !important; 
              font-size: 10.5pt !important; 
              height: 100% !important; 
              font-weight: bold !important; 
              color: black !important; 
              background: transparent !important; 
            }
            .flex-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; min-height: 100px; }
            .title-box { flex: 1; text-align: center; }
            .doc-title { font-size: 32pt; font-weight: 900; letter-spacing: 4px; line-height: 1.0; }
            .approval-table { width: 90mm !important; border: 1.5px solid black !important; margin-left: auto; flex-shrink: 0; table-layout: fixed !important; }
            .approval-table th { height: 22px !important; font-size: 8.5pt !important; background: #f3f4f6 !important; font-weight: bold; border: 1px solid black !important; }
            .approval-table td { height: 70px !important; border: 1px solid black !important; }
            .approval-table .side-header { width: 28px !important; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold; font-size: 11pt; }
            h3 { font-size: 12.5pt !important; margin-top: 15px !important; margin-bottom: 8px !important; font-weight: 900 !important; border-left: 7px solid black !important; padding-left: 10px; }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button>
          </div>
          <div class="print-page">
            <div class="flex-header">
              <div class="title-box"><div class="doc-title">수변전반일지</div></div>
              <table class="approval-table">
                <tr><th rowspan="2" class="side-header">결<br>재</th><th>담 당</th><th>주 임</th><th>대 리</th><th>과 장</th><th>소 장</th></tr>
                <tr><td></td><td></td><td></td><td></td><td></td></tr>
              </table>
            </div>
            <div class="info-row"><div>${formattedYear}년 ${formattedMonth}월 ${formattedDay}일 ${formattedDayName}</div></div>
            <div class="overflow-visible">${printContent.innerHTML}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const inputClass = "w-full text-center h-full py-2 outline-none bg-transparent text-black text-sm font-bold focus:ring-1 focus:ring-gray-400";
  const readonlyInputClass = "w-full text-center h-full py-2 outline-none bg-transparent text-black text-sm font-extrabold cursor-not-allowed opacity-80 bg-gray-50/30";
  const thClass = "border border-black px-0.5 py-2 font-bold bg-gray-50 text-gray-700 align-middle text-xs";
  const tdClass = "border border-black p-0 h-10 align-middle relative bg-transparent";

  return (
    <>
      <LogSheetLayout 
        title="수변전반 일지" 
        loading={loading} 
        saveStatus={saveStatus} 
        onRefresh={() => loadData(true)} 
        onSave={handleSave} 
        onPrint={handlePrint} 
        isEmbedded={isEmbedded} 
        hideSave={false}
      >
        <div id="substation-log-print-area" className="bg-white text-black">
          <section className="mb-6">
            <h3 className="text-lg font-bold text-black mb-2 border-l-4 border-black pl-2">1. VCB (특고압수전반)</h3>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse text-center table-fixed bg-white print:min-w-0 border-black">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: '40px' }} className={thClass}>구분</th>
                    <th colSpan={4} className={thClass}>특고압수전반 (MAIN VCB)</th>
                    <th colSpan={3} className={thClass}>VCB1 (TR1)</th>
                    <th colSpan={3} className={thClass}>VCB2 (TR2)</th>
                    <th colSpan={3} className={thClass}>VCB3 (TR3)</th>
                  </tr>
                  <tr>
                    <th className={thClass}>전압(kV)</th><th className={thClass}>전류(A)</th><th className={thClass}>역률(%)</th><th className={thClass}>Hz</th>
                    <th className={thClass}>전압(kV)</th><th className={thClass}>전류(A)</th><th className={thClass}>역률(%)</th>
                    <th className={thClass}>전압(kV)</th><th className={thClass}>전류(A)</th><th className={thClass}>역률(%)</th>
                    <th className={thClass}>전압(kV)</th><th className={thClass}>전류(A)</th><th className={thClass}>역률(%)</th>
                  </tr>
                </thead>
                <tbody>
                  {['time9', 'time21'].map((time) => (
                    <tr key={time}>
                      <td className="border border-black font-bold text-xs bg-gray-50 text-gray-700">{time === 'time9' ? '09:00' : '21:00'}</td>
                      <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.vcb?.[time as 'time9' | 'time21']?.main?.v || ''} readOnly /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.main?.a || ''} onChange={e => updateVcb(time as any, 'main', 'a', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.main?.pf || ''} onChange={e => updateVcb(time as any, 'main', 'pf', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.main?.hz || ''} onChange={e => updateVcb(time as any, 'main', 'hz', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr1?.v || ''} readOnly /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr1?.a || ''} onChange={e => updateVcb(time as any, 'tr1', 'a', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr1?.pf || ''} onChange={e => updateVcb(time as any, 'tr1', 'pf', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr2?.v || ''} readOnly /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr2?.a || ''} onChange={e => updateVcb(time as any, 'tr2', 'a', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr2?.pf || ''} onChange={e => updateVcb(time as any, 'tr2', 'pf', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr3?.v || ''} readOnly /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr3?.a || ''} onChange={e => updateVcb(time as any, 'tr3', 'a', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.vcb?.[time as 'time9' | 'time21']?.tr3?.pf || ''} onChange={e => updateVcb(time as any, 'tr3', 'pf', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-black mb-2 border-l-4 border-black pl-2">2. ACB / 변압기 온도</h3>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse text-center table-fixed bg-white print:min-w-0 border-black">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: '40px' }} className={thClass}>구분</th>
                    <th colSpan={3} className={thClass}>LV1 PANEL (ACB1)</th>
                    <th colSpan={3} className={thClass}>LV3 PANEL (ACB2)</th>
                    <th colSpan={3} className={thClass}>LV5 PANEL (ACB3)</th>
                    <th colSpan={3} className={thClass}>변압기 온도</th>
                  </tr>
                  <tr>
                    <th className={thClass}>전압(V)</th><th className={thClass}>전류(A)</th><th className={thClass}>전력(kW)</th>
                    <th className={thClass}>전압(V)</th><th className={thClass}>전류(A)</th><th className={thClass}>전력(kW)</th>
                    <th className={thClass}>전압(V)</th><th className={thClass}>전류(A)</th><th className={thClass}>전력(kW)</th>
                    <th className={thClass}>TR1(℃)</th><th className={thClass}>TR2(℃)</th><th className={thClass}>TR3(℃)</th>
                  </tr>
                </thead>
                <tbody>
                  {['time9', 'time21'].map((time) => (
                    <tr key={time}>
                      <td className="border border-black font-bold text-xs bg-gray-50 text-gray-700">{time === 'time9' ? '09:00' : '21:00'}</td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb1?.v || ''} onChange={e => updateAcb(time as any, 'acb1', 'v', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb1?.a || ''} onChange={e => updateAcb(time as any, 'acb1', 'a', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb1?.kw || ''} onChange={e => updateAcb(time as any, 'acb1', 'kw', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb2?.v || ''} onChange={e => updateAcb(time as any, 'acb2', 'v', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb2?.a || ''} onChange={e => updateAcb(time as any, 'acb2', 'a', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb2?.kw || ''} onChange={e => updateAcb(time as any, 'acb2', 'kw', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb3?.v || ''} onChange={e => updateAcb(time as any, 'acb3', 'v', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb3?.a || ''} onChange={e => updateAcb(time as any, 'acb3', 'a', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.acb3?.kw || ''} onChange={e => updateAcb(time as any, 'acb3', 'kw', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.trTemp?.tr1 || ''} onChange={e => updateAcb(time as any, 'trTemp', 'tr1', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.trTemp?.tr2 || ''} onChange={e => updateAcb(time as any, 'trTemp', 'tr2', e.target.value)} /></td>
                      <td className={tdClass}><input type="text" className={inputClass} value={data.acb?.[time as 'time9' | 'time21']?.trTemp?.tr3 || ''} onChange={e => updateAcb(time as any, 'trTemp', 'tr3', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-bold text-black mb-2 border-l-4 border-black pl-2">3. 전력량 사용 현황</h3>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse text-center table-fixed bg-white border-black">
                <thead>
                  <tr>
                    <th className={thClass} style={{ width: '100px' }}>구분</th>
                    <th className={thClass}>유효전력 중간(kWh)</th>
                    <th className={thClass}>유효전력 최대(kWh)</th>
                    <th className={thClass}>유효전력 경부하(kWh)</th>
                    <th className={thClass}>무효전력 중간(kVarh)</th>
                    <th className={thClass}>무효전력 최대(kVarh)</th>
                  </tr>
                </thead>
                <tbody>
                  {['prev', 'curr', 'usage'].map((row) => {
                    // 'usage' 행만 읽기 전용으로 설정하여 'prev'(전일지침)는 입력 가능하게 함
                    const isReadOnlyRow = row === 'usage';
                    const rowLabel = row === 'prev' ? '전일지침' : row === 'curr' ? '금일지침' : '사용량';
                    return (
                      <tr key={row}>
                        <td className="border border-black font-bold text-xs bg-gray-50 text-gray-700">{rowLabel}</td>
                        <td className={tdClass}><input type="text" className={isReadOnlyRow ? readonlyInputClass : inputClass} value={data.powerUsage?.[row as 'prev' | 'curr' | 'usage']?.activeMid || ''} onChange={isReadOnlyRow ? undefined : e => updatePower(row as any, 'activeMid', e.target.value)} readOnly={isReadOnlyRow} /></td>
                        <td className={tdClass}><input type="text" className={isReadOnlyRow ? readonlyInputClass : inputClass} value={data.powerUsage?.[row as 'prev' | 'curr' | 'usage']?.activeMax || ''} onChange={isReadOnlyRow ? undefined : e => updatePower(row as any, 'activeMax', e.target.value)} readOnly={isReadOnlyRow} /></td>
                        <td className={tdClass}><input type="text" className={isReadOnlyRow ? readonlyInputClass : inputClass} value={data.powerUsage?.[row as 'prev' | 'curr' | 'usage']?.activeLight || ''} onChange={isReadOnlyRow ? undefined : e => updatePower(row as any, 'activeLight', e.target.value)} readOnly={isReadOnlyRow} /></td>
                        <td className={tdClass}><input type="text" className={isReadOnlyRow ? readonlyInputClass : inputClass} value={data.powerUsage?.[row as 'prev' | 'curr' | 'usage']?.reactiveMid || ''} onChange={isReadOnlyRow ? undefined : e => updatePower(row as any, 'reactiveMid', e.target.value)} readOnly={isReadOnlyRow} /></td>
                        <td className={tdClass}><input type="text" className={isReadOnlyRow ? readonlyInputClass : inputClass} value={data.powerUsage?.[row as 'prev' | 'curr' | 'usage']?.reactiveMax || ''} onChange={isReadOnlyRow ? undefined : e => updatePower(row as any, 'reactiveMax', e.target.value)} readOnly={isReadOnlyRow} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-bold text-black mb-2 border-l-4 border-black pl-2">4. 일 사용량 분석</h3>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse table-fixed bg-white border-black">
                <thead>
                  <tr>
                    <th className={thClass} style={{ width: '100px' }}>구분</th>
                    <th className={thClass}>유효(kWh)</th>
                    <th className={thClass}>무효(kVarh)</th>
                    <th className={thClass}>금월누계(kWh)</th>
                    <th className={thClass}>최대(kW)</th>
                    <th className={thClass}>역율(%)</th>
                    <th className={thClass}>부하율(%)</th>
                    <th className={thClass}>수용율(%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="h-10">
                    <td className="border border-black font-bold text-sm bg-gray-50 text-gray-700 text-center">금일 사용량</td>
                    <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.activePower || ''} readOnly /></td>
                    <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.reactivePower || ''} readOnly /></td>
                    <td className={tdClass}><input type="text" className={`${readonlyInputClass} font-black text-base`} value={data.dailyStats?.monthTotal || ''} readOnly /></td>
                    <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.maxPower || ''} readOnly /></td>
                    <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.powerFactor || ''} readOnly /></td>
                    <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.loadFactor || ''} readOnly /></td>
                    <td className={tdClass}><input type="text" className={readonlyInputClass} value={data.dailyStats?.demandFactor || ''} readOnly /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 flex justify-center lg:static lg:bg-transparent lg:border-none lg:p-0 mt-12 z-40 print:hidden">
          <button 
            onClick={handleSave} 
            disabled={saveStatus === 'loading'} 
            className={`px-10 py-4 rounded-2xl shadow-xl transition-all duration-300 font-bold text-xl flex items-center justify-center space-x-3 w-full max-xl active:scale-95 ${saveStatus === 'loading' ? 'bg-blue-400 text-white cursor-wait' : saveStatus === 'success' ? 'bg-green-600 text-white' : saveStatus === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {saveStatus === 'loading' ? (
              <><RefreshCw size={24} className="animate-spin" /><span>데이터 동기화 중...</span></>
            ) : saveStatus === 'success' ? (
              <><CheckCircle2 size={24} /><span>Update Complete</span></>
            ) : (
              <><Save size={24} /><span>수변전반 데이터 서버 저장</span></>
            )}
          </button>
        </div>
      </LogSheetLayout>
    </>
  );
};

export default SubstationLog;
