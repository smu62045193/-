import React from 'react';
import { Printer, RefreshCw } from 'lucide-react';

interface AirFilterCheckProps {
  isPopupMode?: boolean;
}

const AirFilterCheck: React.FC<AirFilterCheckProps> = ({ isPopupMode = false }) => {
  const handlePreview = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'air_filter');
    window.open(url.toString(), 'AirFilterPreview', 'width=1000,height=800');
  };

  const diagonalBg = {
    background: 'linear-gradient(to bottom right, transparent calc(50% - 0.5px), #000 calc(50% - 0.5px), #000 calc(50% + 0.5px), transparent calc(50% + 0.5px))'
  };

  const rowHeight = isPopupMode ? 'h-[60px]' : 'h-[40px]';

  const tableContent = (
    <div className={`w-full bg-white ${isPopupMode ? 'rounded-none border border-black' : 'max-w-7xl mx-auto'} overflow-x-auto mb-4`}>
      <table className="w-full text-center border-collapse border border-black">
        <thead className="bg-white border-b border-black">
          <tr className={rowHeight}>
            <th rowSpan={3} className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">사 이 즈</div>
            </th>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">명 칭</div>
            </th>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">사무공간</div>
            </th>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">강당</div>
            </th>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">1F~5F</div>
            </th>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">6~10F</div>
            </th>
          </tr>
          <tr className={rowHeight}>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">위 치</div>
            </th>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">B1F공조실</div>
            </th>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">B1F이가마루</div>
            </th>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">B6F기계실</div>
            </th>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">PH공조실</div>
            </th>
          </tr>
          <tr className={rowHeight}>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">구 분</div>
            </th>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">1호기</div>
            </th>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">1-2호기</div>
            </th>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">2호기</div>
            </th>
            <th className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">3호기</div>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
          <tr className={`${rowHeight} hover:bg-blue-50/30 transition-colors border-b border-black text-center`}>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">594X594X20T</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">프 리</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">2</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">2</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">8</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">6</div>
            </td>
          </tr>
          <tr className={`${rowHeight} hover:bg-blue-50/30 transition-colors border-b border-black text-center`}>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">594X594X75T</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">리 듐</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">2</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">2</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">8</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">6</div>
            </td>
          </tr>
          <tr className={`${rowHeight} hover:bg-blue-50/30 transition-colors border-b border-black text-center`}>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">594X289X20T</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">프 리</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">2</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">2</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">4</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">5</div>
            </td>
          </tr>
          <tr className={`${rowHeight} hover:bg-blue-50/30 transition-colors border-b border-black text-center`}>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">594X289X75T</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">리 듐</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">2</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">2</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">4</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">5</div>
            </td>
          </tr>
          <tr className={`${rowHeight} hover:bg-blue-50/30 transition-colors border-b border-black text-center`}>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">289X289X20T</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">프 리</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`} style={diagonalBg}>
              <div className="flex items-center justify-center h-full px-2"></div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`} style={diagonalBg}>
              <div className="flex items-center justify-center h-full px-2"></div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`} style={diagonalBg}>
              <div className="flex items-center justify-center h-full px-2"></div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">1</div>
            </td>
          </tr>
          <tr className={`${rowHeight} hover:bg-blue-50/30 transition-colors border-b border-black text-center`}>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">289X289X75T</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">리 듐</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`} style={diagonalBg}>
              <div className="flex items-center justify-center h-full px-2"></div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`} style={diagonalBg}>
              <div className="flex items-center justify-center h-full px-2"></div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`} style={diagonalBg}>
              <div className="flex items-center justify-center h-full px-2"></div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">1</div>
            </td>
          </tr>
          <tr className={`${rowHeight} hover:bg-blue-50/30 transition-colors border-b border-black text-center`}>
            <td rowSpan={2} className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">합 계</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">프 리</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">4</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">4</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">12</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">12</div>
            </td>
          </tr>
          <tr className={`${rowHeight} hover:bg-blue-50/30 transition-colors border-b border-black text-center`}>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">리 듐</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">4</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">4</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">12</div>
            </td>
            <td className={`border border-black text-[13px] font-normal ${isPopupMode ? 'text-black' : 'text-gray-800'}`}>
              <div className="flex items-center justify-center h-full px-2">12</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-black p-8 flex flex-col items-center overflow-auto print-main-container">
        <style>{`
          @page {
            size: A4 portrait;
            margin: 0;
          }
          @media print {
            .no-print { display: none !important; }
            .print-main-container { background-color: white !important; padding: 0 !important; min-height: auto !important; }
            body { background-color: white !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
            .print-container {
              width: 100% !important;
              height: 100% !important;
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
              height: 297mm !important;
              transform: none !important;
              border: none !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
            }
          }
          .print-page {
            width: 210mm;
            height: 297mm;
            padding: 25mm 12mm 10mm 12mm;
            margin: 20px auto;
            background: white;
            box-shadow: none;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            border: none;
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
          <div className="print-page">
            <h1 className="text-3xl font-bold text-center mb-4">공조기 필터 각호기별 사이즈 현황</h1>
            <hr className="border-t-4 border-black mb-6" />
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
            공조기필터현황
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
          </div>
          
          <div className="flex items-center shrink-0 px-2">
            <div className="w-[1px] h-6 bg-black"></div>
          </div>

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

export default AirFilterCheck;
