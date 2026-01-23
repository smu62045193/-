import React, { useState, useEffect, useCallback } from 'react';
import { AirEnvironmentLogData, AirEmissionItem, AirPreventionItem, WeatherData } from '../types';
import { fetchAirEnvironmentLog, saveAirEnvironmentLog, getInitialAirEnvironmentLog, fetchHvacLog, fetchBoilerLog, saveToCache } from '../services/dataService';
import { fetchWeatherInfo } from '../services/geminiService';
import { format } from 'date-fns';
import { RefreshCw, Printer } from 'lucide-react';
import LogSheetLayout from './LogSheetLayout';

interface AirEnvironmentLogProps {
  currentDate: Date;
}

const AirEnvironmentLog: React.FC<AirEnvironmentLogProps> = ({ currentDate }) => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const [data, setData] = useState<AirEnvironmentLogData>(getInitialAirEnvironmentLog(dateKey));
  const [weather, setWeather] = useState<WeatherData | null>(null);

  const roundValue = (val: string) => {
    if (!val) return '0';
    const parsed = parseFloat(val.replace(/,/g, ''));
    return isNaN(parsed) ? '0' : Math.round(parsed).toString();
  };

  const syncFromMechanical = useCallback(async (currentData: AirEnvironmentLogData) => {
    try {
      const [hvacData, boilerData] = await Promise.all([
        fetchHvacLog(dateKey, true), 
        fetchBoilerLog(dateKey, true)
      ]);

      const newData = { ...currentData };
      let hasAnyChange = false;

      // --- 냉온수기 (1호기 & 2호기) 처리 개선 ---
      const hvacRun = hvacData?.hvacLogs?.[0]?.runTime || '';
      const rawHvacGas = hvacData?.gas?.usage || '0';
      const hvacGas = roundValue(rawHvacGas);
      const unit = hvacData?.unitNo || '';
      const isActuallyRunning = hvacRun && hvacRun.trim() !== '' && hvacRun.trim() !== '~';

      // 1호기 업데이트 로직
      if (unit === '1' && isActuallyRunning) {
        newData.emissions[0].runTime = hvacRun;
        newData.emissions[0].remarks = '정상';
        newData.preventions[0].gasUsage = hvacGas;
      } else {
        newData.emissions[0].runTime = unit === '1' ? hvacRun : '';
        newData.emissions[0].remarks = '운휴';
        newData.preventions[0].gasUsage = unit === '1' ? hvacGas : '0';
      }

      // 2호기 업데이트 로직
      if (unit === '2' && isActuallyRunning) {
        newData.emissions[1].runTime = hvacRun;
        newData.emissions[1].remarks = '정상';
        newData.preventions[1].gasUsage = hvacGas;
      } else {
        newData.emissions[1].runTime = unit === '2' ? hvacRun : '';
        newData.emissions[1].remarks = '운휴';
        newData.preventions[1].gasUsage = unit === '2' ? hvacGas : '0';
      }
      hasAnyChange = true;

      // --- 보일러 처리 ---
      if (boilerData && boilerData.logs) {
        const boilerRunTimes = boilerData.logs
          .map(log => log.runTime)
          .filter(time => time && time.trim() !== '' && time.trim() !== '~')
          .join(', ');
          
        const isBoilerRunning = boilerRunTimes && boilerRunTimes.trim() !== '';
        
        newData.emissions[2].runTime = boilerRunTimes || '';
        newData.emissions[2].remarks = isBoilerRunning ? '정상' : '운휴';
        newData.preventions[2].gasUsage = roundValue(boilerData.gas?.usage || '0');
        hasAnyChange = true;
      }

      if (hasAnyChange) {
        setData(newData);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Sync failed", err);
      return false;
    }
  }, [dateKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetched = await fetchAirEnvironmentLog(dateKey);
      const initialData = getInitialAirEnvironmentLog(dateKey);
      
      if (fetched) {
        setData(fetched);
      } else {
        setData(initialData);
        await syncFromMechanical(initialData);
      }
    } catch (e) {
      console.error(e);
      setData(getInitialAirEnvironmentLog(dateKey));
    } finally {
      setLoading(false);
    }
  };

  const loadWeather = async () => {
    try {
      const w = await fetchWeatherInfo(dateKey, false, "17:00");
      setWeather(w);
    } catch (e) {
      console.error("Failed to load weather", e);
    }
  };

  useEffect(() => {
    loadData();
    loadWeather();
  }, [dateKey]);

  useEffect(() => {
    if (!loading && data) {
      saveToCache(`AIR_ENV_${dateKey}`, data, true);
    }
  }, [data, dateKey, loading]);

  const handleSyncData = async () => {
    setSyncing(true);
    const success = await syncFromMechanical(data);
    if (success) {
      alert('기계설비 일지 데이터가 최신 정보로 연동되었습니다.');
    } else {
      alert('연동할 데이터가 없거나 이미 최신 상태입니다.');
    }
    setSyncing(false);
  };

  const handleSave = async () => {
    if (!data) return;
    const success = await saveAirEnvironmentLog(data);
    if (success) alert('저장되었습니다.');
    else alert('저장 실패');
  };

  const handlePrint = () => {
    const printContent = document.getElementById('air-env-log-content');
    if (!printContent) return;

    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const formattedDate = format(currentDate, 'yyyy년 MM월 dd일');
    const dayName = days[currentDate.getDay()];

    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>대기환경 기록부 - ${dateKey}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { font-family: "Noto Sans KR", sans-serif; margin: 0; padding: 0; background: #f1f5f9; color: black; line-height: 1.2; -webkit-print-color-adjust: exact; }
            .no-print { margin: 20px; display: flex; gap: 10px; justify-content: center; }
            @media print { .no-print { display: none !important; } body { background: white !important; } }
            
            .print-page { 
              width: 210mm; 
              min-height: 297mm; 
              padding: 25mm 10mm 10mm 10mm; 
              margin: 0 auto; 
              box-sizing: border-box; 
              display: flex; 
              flex-direction: column; 
              background: white;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            @media print { .print-page { box-shadow: none !important; margin: 0; } }
            
            .header-flex { 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              margin-bottom: 5px; 
              min-height: 100px;
            }
            .title-area { 
              flex: 1; 
              text-align: center; 
            }
            .doc-title { 
              font-size: 22pt; 
              font-weight: 900; 
              letter-spacing: -1px;
              line-height: 1.1;
            }

            .approval-table { 
              width: 90mm !important; 
              border: 1.5px solid black !important; 
              border-collapse: collapse !important;
              margin-left: auto; 
              flex-shrink: 0; 
              table-layout: fixed !important;
            }
            .approval-table th { 
              border: 1px solid black !important; 
              background: #f2f2f2 !important; 
              font-size: 8.5pt !important; 
              font-weight: bold; 
              text-align: center; 
              height: 24px !important; 
            }
            .approval-table td { 
              border: 1px solid black !important; 
              height: 70px !important; 
              background: white !important;
            }
            .approval-table .side-header { width: 28px !important; }

            .info-table { width: 100%; border-collapse: collapse; border: none; margin-bottom: 10px; }
            .info-table td { padding: 5px 15px; font-size: 11pt; font-weight: bold; border: none; }
            .weather-text { text-align: right; }
            
            table.main-table { width: 100%; border-collapse: collapse; border: 1.5px solid black; table-layout: fixed; margin-bottom: 5px; }
            table.main-table th { background: #f2f2f2 !important; border: 1px solid black; padding: 12px 4px; font-size: 11pt; font-weight: bold; text-align: center; }
            table.main-table td { border: 1px solid black; padding: 10px; font-size: 12.5pt; text-align: center; height: 100px; vertical-align: middle; }
            .section-title { font-size: 14pt; font-weight: bold; margin: 15px 0 10px 0; text-align: left; border-left: 8px solid black; padding-left: 15px; }
            .unit-text { font-size: 10.5pt; font-weight: bold; margin-left: 3px; color: #444; }
            .remarks-note { font-size: 10pt; color: #444; margin-top: 5px; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button>
          </div>
          <div class="print-page">
            <div class="header-flex">
              <div class="title-area">
                <div class="doc-title">대기배출시설 및 방지시설<br/>운영기록부</div>
              </div>
              <table class="approval-table">
                <tr><th rowspan="2" class="side-header">결<br/>재</th><th>담 당</th><th>주 임</th><th>대 리</th><th>과 장</th><th>소 장</th></tr>
                <tr><td></td><td></td><td></td><td></td><td></td></tr>
              </table>
            </div>
            
            <table class="info-table">
              <tr>
                <td>${formattedDate} (${dayName})</td>
                <td class="weather-text">날씨: ${weather?.condition || '맑음'} &nbsp;&nbsp;|&nbsp;&nbsp; 온도: ${weather?.tempMin || '-'}℃ ~ ${weather?.tempMax || '-'}℃</td>
              </tr>
            </table>
            <div class="section-title">1. 배출구별 주요 배출시설 및 방지시설 가동(조업)시간</div>
            <table class="main-table">
              <thead><tr><th style="width:13%">배 출 구</th><th style="width:37%">배 출 시 설</th><th style="width:35%">가 동 시 간</th><th style="width:15%">비 고</th></tr></thead>
              <tbody>
                ${data.emissions.map(item => `
                  <tr>
                    <td style="font-weight:900; background:#fafafa; font-size:14pt;">${item.outletNo}</td>
                    <td style="font-weight:bold;">${item.facilityName}</td>
                    <td style="color:#1d4ed8; font-weight:900; font-size:14pt;">${item.runTime || '-'}</td>
                    <td style="font-weight:bold;">${item.remarks || '운휴'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="remarks-note">* 비고란은 정상 여부 기재합니다.</div>
            <div class="section-title">2. 방지시설 운영사항</div>
            <table class="main-table">
              <thead><tr><th style="width:25%">방 지 시 설 명</th><th style="width:25%">설 치 위 위치</th><th style="width:25%">가스사용량</th><th style="width:25%">처리오염물질</th></tr></thead>
              <tbody>
                ${data.preventions.map(item => `
                  <tr>
                    <td style="font-weight:bold;">${item.facilityName}</td>
                    <td>${item.location}</td>
                    <td style="text-align:right; padding-right:30px; color:#1d4ed8; font-weight:900; font-size:15pt;">${roundValue(item.gasUsage || '0')} <span class="unit-text">㎥</span></td>
                    <td style="font-size:11.5pt; font-weight:bold;">${item.pollutants}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const updateEmissionItem = (id: string, field: keyof AirEmissionItem, value: string) => {
    const newEmissions = data.emissions.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    setData({ ...data, emissions: newEmissions });
  };

  const updatePreventionItem = (id: string, field: keyof AirPreventionItem, value: string) => {
    const newPreventions = data.preventions.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    setData({ ...data, preventions: newPreventions });
  };

  const thClass = "border border-gray-300 bg-gray-50 p-2 font-bold text-center align-middle text-sm h-10 text-gray-700";
  const tdClass = "border border-gray-300 p-0 h-10 relative bg-white"; 
  const inputClass = "w-full h-full text-center outline-none bg-white text-black p-1 text-sm font-medium focus:bg-blue-50";

  const syncButton = (
    <button 
      onClick={handleSyncData} 
      disabled={syncing || loading} 
      className={`flex-1 sm:flex-none items-center justify-center px-4 py-2.5 rounded-xl font-bold shadow-sm transition-all active:scale-95 flex text-sm ${syncing ? 'bg-gray-100 text-gray-400' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
    >
      <RefreshCw className={`mr-2 ${syncing ? 'animate-spin' : ''}`} size={18} />
      <span>데이터 다시 불러오기</span>
    </button>
  );

  return (
    <LogSheetLayout 
      title="대기배출시설 및 방지시설 운영기록부" 
      loading={loading} 
      onSave={handleSave} 
      onPrint={handlePrint} 
      hideRefresh={true}
      extraActions={syncButton}
    >
      <div id="air-env-log-content" className="bg-white p-4 text-black min-w-[850px] max-w-5xl mx-auto shadow-sm border border-gray-100 rounded-lg">
        <div className="mb-10">
          <h3 className="text-base font-bold mb-3 border-l-4 border-gray-800 pl-2">1. 배출구별 주요 배출시설 및 방지시설 가동(조업)시간</h3>
          <div className="overflow-hidden border border-gray-300 rounded-lg shadow-sm">
            <table className="w-full border-collapse text-center">
              <thead><tr className="bg-gray-50"><th className={`${thClass} w-[13%]`}>배 출 구</th><th className={`${thClass} w-[37%]`}>배 출 시 설</th><th className={`${thClass} w-[35%]`}>가 동 시 간</th><th className={`${thClass} w-[15%]`}>비 고</th></tr></thead>
              <tbody>
                {data?.emissions?.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className={`${tdClass} font-bold text-gray-500 bg-gray-50/20`}>{item.outletNo}</td>
                    <td className={`${tdClass} font-bold`}><input type="text" className={inputClass} value={item.facilityName} onChange={(e) => updateEmissionItem(item.id, 'facilityName', e.target.value)} /></td>
                    <td className={tdClass}><div className="flex items-center justify-center h-full px-4"><input type="text" className={`${inputClass} text-center font-bold text-blue-700`} value={item.runTime} onChange={(e) => updateEmissionItem(item.id, 'runTime', e.target.value)} placeholder="~" /></div></td>
                    <td className={tdClass}><input type="text" className={inputClass} value={item.remarks} onChange={(e) => updateEmissionItem(item.id, 'remarks', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2 font-medium text-gray-500">* 비고란은 정상 여부 기재합니다.</p>
        </div>
        
        <div className="mt-12">
          <h3 className="text-base font-bold mb-3 border-l-4 border-gray-800 pl-2">2. 방지시설 운영사항</h3>
          <div className="overflow-hidden border border-gray-300 rounded-lg shadow-sm">
            <table className="w-full border-collapse text-center">
              <thead><tr className="bg-gray-50"><th className={`${thClass} w-[25%]`}>방 지 시 설 명</th><th className={`${thClass} w-[25%]`}>설 치 위 위치</th><th className={`${thClass} w-[25%]`}>가스사용량</th><th className={`${thClass} w-[25%]`}>처리오염물질</th></tr></thead>
              <tbody>
                {data?.preventions?.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className={`${tdClass} font-medium`}><input type="text" className={inputClass} value={item.facilityName} onChange={(e) => updatePreventionItem(item.id, 'facilityName', e.target.value)} /></td>
                    <td className={`${tdClass} font-medium`}><input type="text" className={inputClass} value={item.location} onChange={(e) => updatePreventionItem(item.id, 'location', e.target.value)} /></td>
                    <td className={tdClass}><div className="flex items-center justify-center h-full relative pr-8"><input type="text" className={`${inputClass} text-right font-black pr-1 text-blue-700`} value={roundValue(item.gasUsage)} onChange={(e) => updatePreventionItem(item.id, 'gasUsage', e.target.value)} onBlur={(e) => updatePreventionItem(item.id, 'gasUsage', roundValue(e.target.value))} /><span className="ml-1 text-xs font-bold text-gray-400">㎥</span></div></td>
                    <td className={`${tdClass} font-medium px-2`}><input type="text" className={inputClass} value={item.pollutants} onChange={(e) => updatePreventionItem(item.id, 'pollutants', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </LogSheetLayout>
  );
};

export default AirEnvironmentLog;