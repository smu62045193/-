import React, { useState, useEffect, useCallback } from 'react';
import { Printer, X, RefreshCw, Edit2, Save, CheckCircle, Lock, CheckCircle2 } from 'lucide-react';
import { fetchFancoilLog, saveFancoilLog } from '../services/dataService';
import { format } from 'date-fns';

interface FancoilData {
  floor: string;
  loc: string;
  sensor1Top: string;
  sensor2Top: string;
  sensor1Bot: string;
  sensor2Bot: string;
  autoControlTop: string;
  operationStatusTop: string;
  solenoidLeakTop: string;
  autoControlBot: string;
  operationStatusBot: string;
  solenoidLeakBot: string;
  strainerLeakTop: string;
  strainerLeakBot: string;
  bypassTop: string;
  bypassBot: string;
  remarksTop: string;
  remarksBot: string;
}

interface FancoilCheckProps {
  isPopupMode?: boolean;
}

const initialData: FancoilData[] = [
  { floor: '10F', loc: '9F', sensor1Top: '실내온도1', sensor2Top: '학여울', sensor1Bot: '실내온도2', sensor2Bot: '삼성역', autoControlTop: '', operationStatusTop: '', solenoidLeakTop: '', autoControlBot: '', operationStatusBot: '', solenoidLeakBot: '', strainerLeakTop: '', strainerLeakBot: '', bypassTop: '', bypassBot: '', remarksTop: '', remarksBot: '' },
  { floor: '9F', loc: '8F', sensor1Top: '실내온도1', sensor2Top: '학여울', sensor1Bot: '실내온도2', sensor2Bot: '삼성역', autoControlTop: '', operationStatusTop: '', solenoidLeakTop: '', autoControlBot: '', operationStatusBot: '', solenoidLeakBot: '', strainerLeakTop: '', strainerLeakBot: '', bypassTop: '', bypassBot: '', remarksTop: '', remarksBot: '' },
  { floor: '8F', loc: '7F', sensor1Top: '실내온도1', sensor2Top: '학여울', sensor1Bot: '실내온도2', sensor2Bot: '삼성역', autoControlTop: '', operationStatusTop: '', solenoidLeakTop: '', autoControlBot: '', operationStatusBot: '', solenoidLeakBot: '', strainerLeakTop: '', strainerLeakBot: '', bypassTop: '', bypassBot: '', remarksTop: '', remarksBot: '' },
  { floor: '7F', loc: '6F', sensor1Top: '실내온도1', sensor2Top: '학여울', sensor1Bot: '실내온도2', sensor2Bot: '삼성역', autoControlTop: '', operationStatusTop: '', solenoidLeakTop: '', autoControlBot: '', operationStatusBot: '', solenoidLeakBot: '', strainerLeakTop: '', strainerLeakBot: '', bypassTop: '', bypassBot: '', remarksTop: '', remarksBot: '' },
  { floor: '6F', loc: '5F', sensor1Top: '실내온도1', sensor2Top: '학여울', sensor1Bot: '실내온도2', sensor2Bot: '삼성역', autoControlTop: '', operationStatusTop: '', solenoidLeakTop: '', autoControlBot: '', operationStatusBot: '', solenoidLeakBot: '', strainerLeakTop: '', strainerLeakBot: '', bypassTop: '', bypassBot: '', remarksTop: '', remarksBot: '' },
  { floor: '5F', loc: '4F', sensor1Top: '실내온도1', sensor2Top: '학여울', sensor1Bot: '실내온도2', sensor2Bot: '삼성역', autoControlTop: '', operationStatusTop: '', solenoidLeakTop: '', autoControlBot: '', operationStatusBot: '', solenoidLeakBot: '', strainerLeakTop: '', strainerLeakBot: '', bypassTop: '', bypassBot: '', remarksTop: '', remarksBot: '' },
  { floor: '4F', loc: '3F', sensor1Top: '실내온도1', sensor2Top: '학여울', sensor1Bot: '실내온도2', sensor2Bot: '삼성역', autoControlTop: '', operationStatusTop: '', solenoidLeakTop: '', autoControlBot: '', operationStatusBot: '', solenoidLeakBot: '', strainerLeakTop: '', strainerLeakBot: '', bypassTop: '', bypassBot: '', remarksTop: '', remarksBot: '' },
  { floor: '3F', loc: '2F', sensor1Top: '실내온도1', sensor2Top: '학여울', sensor1Bot: '실내온도2', sensor2Bot: '삼성역', autoControlTop: '', operationStatusTop: '', solenoidLeakTop: '', autoControlBot: '', operationStatusBot: '', solenoidLeakBot: '', strainerLeakTop: '', strainerLeakBot: '', bypassTop: '', bypassBot: '', remarksTop: '', remarksBot: '' },
  { floor: '2F', loc: '1F', sensor1Top: '실내온도1', sensor2Top: '학여울', sensor1Bot: '실내온도2', sensor2Bot: '삼성역', autoControlTop: '', operationStatusTop: '', solenoidLeakTop: '', autoControlBot: '', operationStatusBot: '', solenoidLeakBot: '', strainerLeakTop: '', strainerLeakBot: '', bypassTop: '', bypassBot: '', remarksTop: '', remarksBot: '' },
  { floor: '1F', loc: 'B1F', sensor1Top: '실내온도1', sensor2Top: '', sensor1Bot: '실내온도2', sensor2Bot: '', autoControlTop: '', operationStatusTop: '', solenoidLeakTop: '', autoControlBot: '', operationStatusBot: '', solenoidLeakBot: '', strainerLeakTop: '', strainerLeakBot: '', bypassTop: '', bypassBot: '', remarksTop: '', remarksBot: '' },
];

const FancoilCheck: React.FC<FancoilCheckProps> = ({ isPopupMode = false }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [fancoilData, setFancoilData] = useState<FancoilData[]>(initialData);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await fetchFancoilLog();
      if (fetched) {
        // Sort data: 10F, 9F, ..., 1F
        const sorted = [...fetched].sort((a, b) => {
          const numA = parseInt(a.floor);
          const numB = parseInt(b.floor);
          return numB - numA;
        });
        setFancoilData(sorted);
      } else {
        setFancoilData(initialData);
      }
    } catch (err) {
      console.error('loadData error:', err);
      setFancoilData(initialData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePreview = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'fancoil');
    window.open(url.toString(), 'FancoilPreview', 'width=1000,height=800');
  };

  const handleRefresh = () => {
    loadData();
  };

  const handleSave = async () => {
    setSaveStatus('loading');
    try {
      const success = await saveFancoilLog('', fancoilData);
      if (success) {
        setSaveStatus('success');
        setIsEditMode(false);
        alert('저장이 완료되었습니다.');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장 실패');
      }
    } catch (err) {
      console.error('handleSave error:', err);
      setSaveStatus('error');
      alert('오류가 발생했습니다.');
    }
  };

  const updateCell = (idx: number, field: keyof FancoilData, value: string) => {
    const newData = [...fancoilData];
    newData[idx] = { ...newData[idx], [field]: value };
    setFancoilData(newData);
  };

  const fontSize = isPopupMode ? 'text-[11px]' : 'text-[13px]';

  const tableContent = (
    <div className={`w-full bg-white ${isPopupMode ? 'rounded-none border border-black' : 'max-w-7xl mx-auto'} overflow-x-auto`}>
      <table className={`w-full text-center border-collapse ${isPopupMode ? 'border border-black table-fixed' : 'border border-black'}`}>
        {isPopupMode && (
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
        )}
        <thead className="bg-white border-b border-black">
          <tr className="h-[40px]">
            <th rowSpan={2} className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">층</div>
            </th>
            <th rowSpan={2} className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">{isPopupMode ? '위치' : '위 치'}</div>
            </th>
            <th rowSpan={2} className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">구분</div>
            </th>
            <th rowSpan={2} className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">{isPopupMode ? <>{'센서'}<br/>{'방향'}</> : '센서방향'}</div>
            </th>
            <th colSpan={3} className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">전자변</div>
            </th>
            <th rowSpan={2} className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">{isPopupMode ? <>{'스트'}<br/>{'레이너'}</> : '스트레이너'}</div>
            </th>
            <th rowSpan={2} className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">{isPopupMode ? <>{'바이'}<br/>{'패스'}</> : '바이패스'}</div>
            </th>
            <th rowSpan={2} className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">비고</div>
            </th>
          </tr>
          <tr className="h-[40px]">
            <th className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'} w-[10%]`}>
              <div className="flex items-center justify-center h-full px-2">자동제어</div>
            </th>
            <th className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'} w-[10%]`}>
              <div className="flex items-center justify-center h-full px-2">작동여부</div>
            </th>
            <th className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'} w-[10%]`}>
              <div className="flex items-center justify-center h-full px-2">전자변</div>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {fancoilData.map((row, idx) => (
            <React.Fragment key={idx}>
              <tr className="h-[40px] hover:bg-blue-50/30 transition-colors border-b border-black text-center">
                <td rowSpan={2} className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">{row.floor}</div>
                </td>
                <td rowSpan={2} className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">{row.loc}</div>
                </td>
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">{row.sensor1Top}</div>
                </td>
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">{row.sensor2Top}</div>
                </td>
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">
                    {isEditMode ? (
                      <select value={row.autoControlTop} onChange={(e) => updateCell(idx, 'autoControlTop', e.target.value)} className={`bg-transparent border-none outline-none shadow-none appearance-none w-full text-center ${fontSize} font-normal`}>
                        <option value="">선택</option>
                        <option value="수동(M)_0">수동(M)_0</option>
                        <option value="수동(M)_100">수동(M)_100</option>
                        <option value="자동(A)">자동(A)</option>
                      </select>
                    ) : row.autoControlTop}
                  </div>
                </td>
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">
                    {isEditMode ? (
                      <select value={row.operationStatusTop} onChange={(e) => updateCell(idx, 'operationStatusTop', e.target.value)} className={`bg-transparent border-none outline-none shadow-none appearance-none w-full text-center ${fontSize} font-normal`}>
                        <option value="">선택</option>
                        <option value="정상">정상</option>
                        <option value="고장">고장</option>
                      </select>
                    ) : row.operationStatusTop}
                  </div>
                </td>
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">
                    {isEditMode ? (
                      <select value={row.solenoidLeakTop} onChange={(e) => updateCell(idx, 'solenoidLeakTop', e.target.value)} className={`bg-transparent border-none outline-none shadow-none appearance-none w-full text-center ${fontSize} font-normal`}>
                        <option value="">선택</option>
                        <option value="누수">누수</option>
                      </select>
                    ) : row.solenoidLeakTop}
                  </div>
                </td>
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">
                    {isEditMode ? (
                      <select value={row.strainerLeakTop} onChange={(e) => updateCell(idx, 'strainerLeakTop', e.target.value)} className={`bg-transparent border-none outline-none shadow-none appearance-none w-full text-center ${fontSize} font-normal`}>
                        <option value="">선택</option>
                        <option value="누수">누수</option>
                      </select>
                    ) : row.strainerLeakTop}
                  </div>
                </td>
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">
                    {isEditMode ? (
                      <select value={row.bypassTop} onChange={(e) => updateCell(idx, 'bypassTop', e.target.value)} className={`bg-transparent border-none outline-none shadow-none appearance-none w-full text-center ${fontSize} font-normal`}>
                        <option value="">선택</option>
                        <option value="사용중">사용중</option>
                      </select>
                    ) : row.bypassTop}
                  </div>
                </td>
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">
                    {isEditMode ? (
                      <input type="text" value={row.remarksTop} onChange={(e) => updateCell(idx, 'remarksTop', e.target.value)} className={`bg-transparent border-none outline-none shadow-none appearance-none w-full text-center ${fontSize} font-normal`} />
                    ) : row.remarksTop}
                  </div>
                </td>
              </tr>
              <tr className="h-[40px] hover:bg-blue-50/30 transition-colors border-b border-black text-center">
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">{row.sensor1Bot}</div>
                </td>
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">{row.sensor2Bot}</div>
                </td>
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">
                    {isEditMode ? (
                      <select value={row.autoControlBot} onChange={(e) => updateCell(idx, 'autoControlBot', e.target.value)} className={`bg-transparent border-none outline-none shadow-none appearance-none w-full text-center ${fontSize} font-normal`}>
                        <option value="">선택</option>
                        <option value="수동(M)_0">수동(M)_0</option>
                        <option value="수동(M)_100">수동(M)_100</option>
                        <option value="자동(A)">자동(A)</option>
                      </select>
                    ) : row.autoControlBot}
                  </div>
                </td>
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">
                    {isEditMode ? (
                      <select value={row.operationStatusBot} onChange={(e) => updateCell(idx, 'operationStatusBot', e.target.value)} className={`bg-transparent border-none outline-none shadow-none appearance-none w-full text-center ${fontSize} font-normal`}>
                        <option value="">선택</option>
                        <option value="정상">정상</option>
                        <option value="고장">고장</option>
                      </select>
                    ) : row.operationStatusBot}
                  </div>
                </td>
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">
                    {isEditMode ? (
                      <select value={row.solenoidLeakBot} onChange={(e) => updateCell(idx, 'solenoidLeakBot', e.target.value)} className={`bg-transparent border-none outline-none shadow-none appearance-none w-full text-center ${fontSize} font-normal`}>
                        <option value="">선택</option>
                        <option value="누수">누수</option>
                      </select>
                    ) : row.solenoidLeakBot}
                  </div>
                </td>
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">
                    {isEditMode ? (
                      <select value={row.strainerLeakBot} onChange={(e) => updateCell(idx, 'strainerLeakBot', e.target.value)} className={`bg-transparent border-none outline-none shadow-none appearance-none w-full text-center ${fontSize} font-normal`}>
                        <option value="">선택</option>
                        <option value="누수">누수</option>
                      </select>
                    ) : row.strainerLeakBot}
                  </div>
                </td>
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">
                    {isEditMode ? (
                      <select value={row.bypassBot} onChange={(e) => updateCell(idx, 'bypassBot', e.target.value)} className={`bg-transparent border-none outline-none shadow-none appearance-none w-full text-center ${fontSize} font-normal`}>
                        <option value="">선택</option>
                        <option value="사용중">사용중</option>
                      </select>
                    ) : row.bypassBot}
                  </div>
                </td>
                <td className={`border border-black ${fontSize} font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                  <div className="flex items-center justify-center h-full px-2">
                    {isEditMode ? (
                      <input type="text" value={row.remarksBot} onChange={(e) => updateCell(idx, 'remarksBot', e.target.value)} className={`bg-transparent border-none outline-none shadow-none appearance-none w-full text-center ${fontSize} font-normal`} />
                    ) : row.remarksBot}
                  </div>
                </td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-black p-8 flex flex-col items-center print:bg-white print:p-0">
        <style>{`
          @page {
            size: A4 portrait;
            margin: 0;
          }
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print { display: none !important; }
            body { background-color: white !important; }
            .print-container {
              width: 100% !important;
              height: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background-color: white !important;
              box-shadow: none !important;
            }
            .print-page {
              box-shadow: none !important;
              margin: 0 !important;
              padding: 25mm 12mm 10mm 12mm !important;
              width: 210mm !important;
              height: auto !important;
              min-height: 297mm !important;
            }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
          }
          .print-page {
            width: 210mm;
            min-height: 297mm;
            height: auto;
            padding: 25mm 12mm 10mm 12mm;
            margin: 20px auto;
            background: white;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
          }
        `}</style>
        <div className="no-print mb-4">
          <button
            onClick={() => window.print()}
            style={{ padding: '10px 24px', background: '#1e3a8a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12pt' }}
          >
            인쇄하기
          </button>
        </div>
        <div className="print-container">
          <div className="print-page shadow-2xl">
            <h1 className="text-3xl font-bold text-center mb-4">팬코일 전자변/실내온도 현황</h1>
            <hr className="border-t-4 border-black mb-8" />
            {tableContent}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-fade-in">
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
        <div className="flex items-center shrink-0">
          <div className="px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer bg-white text-orange-600">
            팬코일전자변/실내온도현황
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
          </div>
          
          <div className="flex items-center shrink-0 px-2">
            <div className="w-[1px] h-6 bg-black"></div>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>

          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-all relative whitespace-nowrap disabled:opacity-50 ${
              isEditMode ? 'text-orange-600' : 'text-gray-500 hover:text-black'
            }`}
          >
            {isEditMode ? <Lock size={18} className="mr-1.5" /> : <Edit2 size={18} className="mr-1.5" />}
            {isEditMode ? '수정완료' : '수정'}
            {isEditMode && <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />}
          </button>

          <button
            onClick={handleSave}
            disabled={loading || saveStatus === 'loading'}
            className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50 ${
              saveStatus === 'success' ? 'text-orange-600' : 'text-gray-500 hover:text-black'
            }`}
          >
            {saveStatus === 'loading' ? (
              <RefreshCw size={18} className="mr-1.5 animate-spin" />
            ) : saveStatus === 'success' ? (
              <CheckCircle2 size={18} className="mr-1.5" />
            ) : (
              <Save size={18} className="mr-1.5" />
            )}
            {saveStatus === 'success' ? '저장완료' : '저장'}
          </button>

          <button
            onClick={handlePreview}
            className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
          >
            <Printer size={18} className="mr-1.5" />
            인쇄
          </button>
        </div>
      </div>
      {tableContent}
    </div>
  );
};

export default FancoilCheck;
