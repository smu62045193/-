import React, { useState, useEffect } from 'react';
import { Printer, X, ChevronLeft, ChevronRight, Save, RefreshCw, Edit2, CheckCircle, Lock, CheckCircle2 } from 'lucide-react';
import { fetchEnergyData, saveEnergyData } from '../services/dataService';

interface EnergyCheckProps {
  isPopupMode?: boolean;
}

const EnergyCheck: React.FC<EnergyCheckProps> = ({ isPopupMode = false }) => {
  const [year, setYear] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get('year') || '2026', 10);
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [data, setData] = useState(
    Array.from({ length: 12 }, (_, i) => ({
      month: `${i + 1}월`,
      electric: 0,
      hvac: 0,
      boiler: 0,
    }))
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const result = await fetchEnergyData(year);
      if (result) {
        setData(result);
      } else {
        // 데이터가 없으면 초기화
        setData(Array.from({ length: 12 }, (_, i) => ({
          month: `${i + 1}월`,
          electric: 0,
          hvac: 0,
          boiler: 0,
        })));
      }
    } catch (error) {
      console.error('Failed to load energy data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [year]);

  const handleSave = async () => {
    setIsLoading(true);
    setSaveStatus('loading');
    try {
      const success = await saveEnergyData(year, data);
      if (success) {
        setSaveStatus('success');
        setIsEditing(false);
        alert('서버에 저장되었습니다.');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'energy');
    url.searchParams.set('year', year.toString());
    window.open(url.toString(), 'EnergyPreview', 'width=800,height=900');
  };

  const handleInputChange = (index: number, field: 'electric' | 'hvac' | 'boiler', value: string) => {
    const newData = [...data];
    newData[index] = {
      ...newData[index],
      [field]: Number(value) || 0
    };
    setData(newData);
  };

  const tableContent = (
    <div className={`w-full bg-white ${isPopupMode ? 'rounded-none border border-black' : 'max-w-7xl mx-auto'} overflow-x-auto relative`}>
      {isLoading && !isPopupMode && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
          <RefreshCw className="animate-spin text-blue-600" size={32} />
        </div>
      )}
      <table className={`w-full text-center border-collapse border border-black`}>
        <thead className="bg-white border-b border-black">
          <tr className="h-[40px]">
            <th rowSpan={2} className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'} w-[10%]`}>
              <div className="flex items-center justify-center h-full px-2">월</div>
            </th>
            <th rowSpan={2} className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'} w-[20%]`}>
              <div className="flex items-center justify-center h-full px-2">전기사용량(kwh)</div>
            </th>
            <th colSpan={3} className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'} w-[70%]`}>
              <div className="flex items-center justify-center h-full px-2">도시가스(m³)</div>
            </th>
          </tr>
          <tr className="h-[40px]">
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'} w-[23%]`}>
              <div className="flex items-center justify-center h-full px-2">냉,온수기</div>
            </th>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'} w-[23%]`}>
              <div className="flex items-center justify-center h-full px-2">보일러</div>
            </th>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'} w-[24%]`}>
              <div className="flex items-center justify-center h-full px-2">합계</div>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {data.map((row, i) => (
            <tr key={i} className="h-[40px] hover:bg-blue-50/30 transition-colors border-b border-black text-center">
              <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                <div className="flex items-center justify-center h-full px-2">{row.month}</div>
              </td>
              <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                <div className="flex items-center justify-center h-full px-2">
                  {isEditing ? (
                    <input 
                      type="number" 
                      value={row.electric === 0 ? '' : row.electric} 
                      onChange={(e) => handleInputChange(i, 'electric', e.target.value)}
                      className="bg-transparent border-none outline-none shadow-none appearance-none w-full text-center text-[13px] font-normal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  ) : (
                    row.electric.toLocaleString()
                  )}
                </div>
              </td>
              <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                <div className="flex items-center justify-center h-full px-2">
                  {isEditing ? (
                    <input 
                      type="number" 
                      value={row.hvac === 0 ? '' : row.hvac} 
                      onChange={(e) => handleInputChange(i, 'hvac', e.target.value)}
                      className="bg-transparent border-none outline-none shadow-none appearance-none w-full text-center text-[13px] font-normal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  ) : (
                    row.hvac.toLocaleString()
                  )}
                </div>
              </td>
              <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                <div className="flex items-center justify-center h-full px-2">
                  {isEditing ? (
                    <input 
                      type="number" 
                      value={row.boiler === 0 ? '' : row.boiler} 
                      onChange={(e) => handleInputChange(i, 'boiler', e.target.value)}
                      className="bg-transparent border-none outline-none shadow-none appearance-none w-full text-center text-[13px] font-normal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  ) : (
                    row.boiler.toLocaleString()
                  )}
                </div>
              </td>
              <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
                <div className="flex items-center justify-center h-full px-2">{(row.hvac + row.boiler).toLocaleString()}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-black print:bg-white p-8 print:p-0 flex flex-col items-center print:block">
        <style>{`
          @page { size: A4 portrait; margin: 0; }
          @media print {
            .no-print { display: none !important; }
            html, body { background-color: white !important; margin: 0 !important; padding: 0 !important; }
            .print-container {
              width: 100% !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              background-color: white !important;
              box-shadow: none !important;
              display: block !important;
            }
            .print-page {
              box-shadow: none !important;
              margin: 0 !important;
              padding: 25mm 12mm 10mm 12mm !important;
              width: 210mm !important;
              height: auto !important;
              min-height: 297mm !important;
              page-break-after: avoid !important;
            }
            table {
              width: 100% !important;
              height: 220mm !important;
            }
          }
          .print-page {
            width: 210mm;
            min-height: 297mm;
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
          <button onClick={() => window.print()} style={{ padding: '10px 24px', background: '#1e3a8a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12pt' }}>인쇄하기</button>
        </div>
        <div className="print-container flex flex-col items-center">
          <div className="print-page shadow-2xl">
            <h1 className="text-3xl font-bold text-center mb-4">{year}년 에너지사용현황</h1>
            <hr className="border-black border-t-4 mb-8" />
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
          {/* 월네비게이션 */}
          <div className="flex items-center shrink-0">
            <button 
              onClick={() => setYear(year - 1)} 
              className="px-2 py-3 text-gray-500 hover:text-black transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-[14px] font-bold text-black min-w-[100px] text-center py-3">
              {year}년{" "}
            </div>
            <button 
              onClick={() => setYear(year + 1)} 
              className="px-2 py-3 text-gray-500 hover:text-black transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center shrink-0 px-2">
            <div className="w-[1px] h-6 bg-black"></div>
          </div>

          <div className="px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer bg-white text-orange-600">
            에너지사용현황
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
          </div>

          <div className="flex items-center shrink-0 px-2">
            <div className="w-[1px] h-6 bg-black"></div>
          </div>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw size={18} className={`mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </button>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-all relative whitespace-nowrap disabled:opacity-50 ${
              isEditing ? 'text-orange-600' : 'text-gray-500 hover:text-black'
            }`}
          >
            {isEditing ? <Lock size={18} className="mr-1.5" /> : <Edit2 size={18} className="mr-1.5" />}
            {isEditing ? '수정완료' : '수정'}
            {isEditing && <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />}
          </button>

          <button
            onClick={handleSave}
            disabled={isLoading || saveStatus === 'loading'}
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

export default EnergyCheck;
