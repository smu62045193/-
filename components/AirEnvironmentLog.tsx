
import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { AirEnvironmentLogData, AirEmissionItem, AirPreventionItem } from '../types';
import { fetchAirEnvironmentLog, saveAirEnvironmentLog, getInitialAirEnvironmentLog, fetchHvacLog, fetchBoilerLog } from '../services/dataService';
import { format } from 'date-fns';
import { CloudSun, Edit2, Check, Thermometer } from 'lucide-react';

interface AirEnvironmentLogProps {
  currentDate: Date;
}

export interface AirEnvironmentLogHandle {
  handleSyncData: () => Promise<void>;
  handleSave: () => Promise<void>;
  handlePrint: () => void;
}

const AirEnvironmentLog = forwardRef<AirEnvironmentLogHandle, AirEnvironmentLogProps>(({ currentDate }, ref) => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isWeatherEditing, setIsWeatherEditing] = useState(false);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const [data, setData] = useState<AirEnvironmentLogData>(getInitialAirEnvironmentLog(dateKey));

  useImperativeHandle(ref, () => ({
    handleSyncData,
    handleSave,
    handlePrint
  }));

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
      
      newData.emissions[0].facilityName = '냉온수기1호기';
      newData.emissions[0].outletNo = '1';
      newData.emissions[1].facilityName = '냉온수기2호기';
      newData.emissions[1].outletNo = '2';
      newData.emissions[2].facilityName = '보일러';
      newData.emissions[2].outletNo = '3';

      newData.preventions[0].facilityName = '냉,온수기1호기';
      newData.preventions[0].location = '기계실';
      newData.preventions[0].pollutants = 'SOX, NOX, 먼지';
      newData.preventions[1].facilityName = '냉,온수기2호기';
      newData.preventions[1].location = '기계실';
      newData.preventions[1].pollutants = 'SOX, NOX, 먼지';
      newData.preventions[2].facilityName = '보일러';
      newData.preventions[2].location = '기계실';
      newData.preventions[2].pollutants = 'SOX, NOX, 먼지';

      const hvacRun = hvacData?.hvacLogs?.[0]?.runTime || '';
      const hCurr = parseFloat(String(hvacData?.gas?.curr || '0').replace(/,/g, '')) || 0;
      const hPrev = parseFloat(String(hvacData?.gas?.prev || '0').replace(/,/g, '')) || 0;
      const hvacGas = roundValue(Math.max(0, hCurr - hPrev).toString());
      
      const unit = hvacData?.unitNo || '';
      const isActuallyRunning = hvacRun && hvacRun.trim() !== '' && hvacRun.trim() !== '~';

      if (unit === '1' && isActuallyRunning) {
        newData.emissions[0].runTime = hvacRun;
        newData.emissions[0].remarks = '정상';
        newData.preventions[0].gasUsage = hvacGas;
      } else {
        newData.emissions[0].runTime = '';
        newData.emissions[0].remarks = '운휴';
        newData.preventions[0].gasUsage = '0';
      }

      if (unit === '2' && isActuallyRunning) {
        newData.emissions[1].runTime = hvacRun;
        newData.emissions[1].remarks = '정상';
        newData.preventions[1].gasUsage = hvacGas;
      } else {
        newData.emissions[1].runTime = '';
        newData.emissions[1].remarks = '운휴';
        newData.preventions[1].gasUsage = '0';
      }

      if (boilerData && boilerData.logs) {
        const boilerRunTimes = boilerData.logs
          .map(log => log.runTime)
          .filter(time => time && time.trim() !== '' && time.trim() !== '~')
          .join(', ');
          
        const isBoilerRunning = boilerRunTimes && boilerRunTimes.trim() !== '';
        newData.emissions[2].runTime = boilerRunTimes || '';
        newData.emissions[2].remarks = isBoilerRunning ? '정상' : '운휴';
        
        const bCurr = parseFloat(String(boilerData.gas?.curr || '0').replace(/,/g, '')) || 0;
        const bPrev = parseFloat(String(boilerData.gas?.prev || '0').replace(/,/g, '')) || 0;
        newData.preventions[2].gasUsage = roundValue(Math.max(0, bCurr - bPrev).toString());
      }

      setData(newData);
      return true;
    } catch (err) {
      console.error("Sync failed", err);
      return false;
    }
  }, [dateKey]);

  const loadData = async () => {
    setLoading(true);
    setIsWeatherEditing(false);
    try {
      const fetched = await fetchAirEnvironmentLog(dateKey);
      const initialData = getInitialAirEnvironmentLog(dateKey);
      
      if (fetched) {
        const fixedData = {
          ...fetched,
          emissions: fetched.emissions.map((item, idx) => ({
            ...item,
            outletNo: (idx + 1).toString(),
            facilityName: idx === 0 ? '냉온수기1호기' : idx === 1 ? '냉온수기2호기' : '보일러',
            remarks: (item.runTime && item.runTime.trim() !== '' && item.runTime.trim() !== '~') ? '정상' : '운휴'
          })),
          preventions: fetched.preventions.map((item, idx) => ({
            ...item,
            facilityName: idx === 0 ? '냉,온수기1호기' : idx === 1 ? '냉,온수기2호기' : '보일러',
            location: '기계실',
            pollutants: 'SOX, NOX, 먼지'
          }))
        };
        setData(fixedData);
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

  useEffect(() => {
    loadData();
  }, [dateKey]);

  const handleSyncData = async () => {
    setSyncing(true);
    try {
      const success = await syncFromMechanical(data);
      if (success) {
        alert('기계설비 일지 데이터가 최신 정보로 연동되었습니다.');
      } else {
        alert('연동할 데이터가 없거나 이미 최신 상태입니다.');
      }
    } catch (err) {
      alert('데이터 연동 중 오류가 발생했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    if (!data || saveStatus === 'loading') return;
    setSaveStatus('loading');
    try {
      const success = await saveAirEnvironmentLog(data);
      if (success) {
        setSaveStatus('success');
        alert('대기환경 기록부가 저장되었습니다.');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장에 실패했습니다.');
      }
    } catch (e) {
      setSaveStatus('error');
      alert('오류가 발생했습니다.');
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) {
      alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
      return;
    }

    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const formattedDate = format(currentDate, 'yyyy년 MM월 dd일');
    const dayName = days[currentDate.getDay()];

    printWindow.document.write(`
      <html>
        <head>
          <title>대기환경 기록부 - ${dateKey}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { font-family: "Noto Sans KR", sans-serif; margin: 0; padding: 0; background: black; color: black; line-height: 1.2; -webkit-print-color-adjust: exact; }
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
              background: white !important; 
              font-size: 8.5pt !important; 
              font-weight: normal; 
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
            
            table.main-table { width: 100%; border-collapse: collapse; border: 1px solid black; table-layout: fixed; margin-bottom: 5px; }
            table.main-table th { background: white !important; border: 1px solid black; padding: 12px 4px; font-size: 11pt; font-weight: normal; text-align: center; color: black; }
            table.main-table td { border: 1px solid black; padding: 10px; font-size: 12.5pt; text-align: center; height: 100px; vertical-align: middle; color: black; }
            .section-title { font-size: 14pt; font-weight: bold; margin: 15px 0 10px 0; text-align: left; border-left: 8px solid black; padding-left: 15px; }
            .unit-text { font-size: 10.5pt; font-weight: normal; margin-left: 3px; color: black; }
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
                <td class="weather-text">날씨: ${data.weatherCondition || '흐림'} &nbsp;&nbsp;|&nbsp;&nbsp; 온도: ${data.tempMin ?? '-1'}℃ ~ ${data.tempMax ?? '7'}℃</td>
              </tr>
            </table>
            <div class="section-title">1. 배출구별 주요 배출시설 및 방지시설 가동(조업)시간</div>
            <table class="main-table">
              <thead><tr><th style="width:13%">배 출 구</th><th style="width:37%">배 출 시 설</th><th style="width:35%">가 동 시 간</th><th style="width:15%">비 고</th></tr></thead>
              <tbody>
                ${data.emissions.map(item => `
                  <tr>
                    <td style="font-weight:normal; background:white; font-size:14pt; color:black;">${item.outletNo}</td>
                    <td style="font-weight:normal; color:black;">${item.facilityName}</td>
                    <td style="color:black; font-weight:normal; font-size:14pt;">${item.runTime || '-'}</td>
                    <td style="font-weight:normal; color:black;">${item.remarks || '운휴'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="remarks-note">* 비고란은 정상 여부 기재합니다.</div>
            <div class="section-title">2. 방지시설 운영사항</div>
            <table class="main-table">
              <thead><tr><th style="width:25%">방 지 시 설 명</th><th style="width:25%">설치 위치</th><th style="width:25%">가스사용량</th><th style="width:25%">처리오염물질</th></tr></thead>
              <tbody>
                ${data.preventions.map(item => `
                  <tr>
                    <td style="font-weight:normal; color:black;">${item.facilityName}</td>
                    <td style="color:black;">${item.location}</td>
                    <td style="text-align:right; padding-right:30px; color:black; font-weight:normal; font-size:15pt;">${roundValue(item.gasUsage || '0')} <span class="unit-text">㎥</span></td>
                    <td style="font-size:11.5pt; font-weight:normal; color:black;">${item.pollutants}</td>
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

  const thClass = "border border-black bg-white text-[13px] font-normal text-center h-[32px] align-middle text-black";
  const tdClass = "border border-black p-0 h-[32px] bg-white text-[13px] font-normal text-center text-black";
  const labelDivClass = "w-full h-full flex items-center justify-center text-[13px] font-normal text-black bg-white px-2";
  const dataDivClass = "w-full h-full flex items-center justify-center text-[13px] font-normal text-black bg-white px-2";

  return (
    <div className="bg-transparent text-black w-full">
      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      )}
      
      {!loading && (
        <>
          <div className="flex items-center justify-between mb-6 px-6 py-4 bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-4 font-bold text-slate-700 text-base">
              {isWeatherEditing ? (
                <div className="flex items-center gap-3 animate-fade-in">
                  <div className="flex items-center gap-2 bg-white px-2 py-1 border border-black">
                    <CloudSun size={18} className="text-blue-500" />
                    <input 
                      type="text" 
                      value={data.weatherCondition || ''} 
                      onChange={e => setData({...data, weatherCondition: e.target.value})} 
                      className="w-20 bg-transparent border-none outline-none shadow-none appearance-none font-normal text-blue-700 text-[13px]"
                      placeholder="날씨"
                    />
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-2 bg-white px-2 py-1 border border-black">
                    <Thermometer size={18} className="text-orange-500" />
                    <div className="flex items-center gap-1">
                      <input 
                        type="text" 
                        value={data.tempMin || ''} 
                        onChange={e => setData({...data, tempMin: e.target.value})} 
                        className="w-8 bg-transparent border-none outline-none shadow-none appearance-none font-normal text-orange-700 text-[13px] text-center"
                        placeholder="최저"
                      />
                      <span className="text-slate-400">~</span>
                      <input 
                        type="text" 
                        value={data.tempMax || ''} 
                        onChange={e => setData({...data, tempMax: e.target.value})} 
                        className="w-8 bg-transparent border-none outline-none shadow-none appearance-none font-normal text-orange-700 text-[13px] text-center"
                        placeholder="최고"
                      />
                      <span className="text-slate-400 text-[13px]">℃</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CloudSun size={20} className="text-blue-500" />
                  <span>날씨: <span className="text-blue-700">{data.weatherCondition || '흐림'}</span></span>
                  <span className="mx-2 text-slate-300">|</span>
                  <Thermometer size={20} className="text-orange-500" />
                  <span>온도: <span className="text-orange-700">{data.tempMin ?? '-1'}℃ ~ {data.tempMax ?? '7'}℃</span></span>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setIsWeatherEditing(!isWeatherEditing)}
              className={`flex items-center gap-2 px-5 py-2 font-bold text-[13px] transition-all shadow-sm ${
                isWeatherEditing 
                  ? 'bg-blue-600 text-white border border-blue-700 active:scale-95' 
                  : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 active:scale-95'
              }`}
            >
              {isWeatherEditing ? <Check size={16} /> : <Edit2 size={16} />}
              {isWeatherEditing ? '확인' : '날씨입력'}
            </button>
          </div>

          <div className="mb-8 max-w-7xl mx-auto">
            <h3 className="text-base font-bold mb-3 border-l-4 border-black pl-2 text-black">1. 배출구별 주요 배출시설 및 방지시설 가동(조업)시간</h3>
            <div className="max-w-7xl mx-auto">
              <table className="w-full border-collapse bg-white text-center text-black border border-black">
                <thead><tr className="border-b border-black h-[32px]"><th className={`${thClass} w-[13%]`}>배 출 구</th><th className={`${thClass} w-[37%]`}>배 출 시 설</th><th className={`${thClass} w-[35%]`}>가 동 시 간</th><th className={`${thClass} w-[15%]`}>비 고</th></tr></thead>
                <tbody>
                  {data?.emissions?.map((item) => (
                    <tr key={item.id} className="h-[32px]">
                      <td className={tdClass}>{item.outletNo}</td>
                      <td className={tdClass}><div className={labelDivClass}>{item.facilityName}</div></td>
                      <td className={tdClass}><div className={dataDivClass}>{item.runTime || '-'}</div></td>
                      <td className={tdClass}><div className={labelDivClass}>{item.remarks || '운휴'}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-2 font-medium text-black">* 비고란은 정상 여부 기재합니다.</p>
          </div>
          
          <div className="mt-8 max-w-7xl mx-auto">
            <h3 className="text-base font-bold mb-3 border-l-4 border-black pl-2 text-black">2. 방지시설 운영사항</h3>
            <div className="max-w-7xl mx-auto">
              <table className="w-full border-collapse bg-white text-center text-black border border-black">
                <thead><tr className="border-b border-black h-[32px]"><th className={`${thClass} w-[25%]`}>방 지 시 설 명</th><th className={`${thClass} w-[25%]`}>설치 위치</th><th className={`${thClass} w-[25%]`}>가스사용량</th><th className={`${thClass} w-[25%]`}>처리오염물질</th></tr></thead>
                <tbody>
                  {data?.preventions?.map((item) => (
                    <tr key={item.id} className="h-[32px]">
                      <td className={tdClass}><div className={labelDivClass}>{item.facilityName}</div></td>
                      <td className={tdClass}><div className={labelDivClass}>{item.location}</div></td>
                      <td className={tdClass}><div className={dataDivClass}>{roundValue(item.gasUsage)} ㎥</div></td>
                      <td className={tdClass}><div className={labelDivClass}>{item.pollutants}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export default AirEnvironmentLog;
