import React, { useState } from 'react';
import { Printer, RefreshCw, Edit2, Save } from 'lucide-react';

interface SepticTankCheckProps {
  isPopupMode?: boolean;
}

const SepticTankCheck: React.FC<SepticTankCheckProps> = ({ isPopupMode = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const handlePreview = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('popup', 'septic');
    window.open(url.toString(), 'SepticPreview', 'width=800,height=900');
  };

  const rows = Array.from({ length: 12 }, (_, i) => i + 1);

  const infoSection = (isPopup: boolean) => {
    if (isPopup) {
      return (
        <div className="w-full bg-white mb-6 border-2 border-black overflow-hidden">
          <table className="w-full border-collapse border-hidden">
            <tbody>
              <tr>
                <td className="border border-black p-4 font-normal text-sm bg-white w-[10%] text-center">일 자</td>
                <td className="border border-black p-4 w-[22%] text-center text-sm">
                  202&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;년&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;일
                </td>
                <td className="border border-black p-4 font-normal text-sm bg-white w-[10%] text-center">시 간</td>
                <td className="border border-black p-4 w-[23%] text-center text-sm">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ~ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                </td>
                <td className="border border-black p-4 font-normal text-sm bg-white w-[12%] text-center">점검자</td>
                <td className="border border-black p-4 w-[23%] text-center text-sm">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="w-full max-w-7xl mx-auto flex overflow-x-auto scrollbar-hide border-b border-black items-stretch">
        <div className="flex items-center shrink-0 gap-2">
          <div className="flex items-center gap-4 px-4 py-2">
            <span className="text-[14px] font-bold text-gray-500 uppercase whitespace-nowrap">일 자</span>
            <input 
              type="date" 
              className={`text-sm font-bold text-black bg-transparent rounded-none outline-none transition-all px-2 py-1 ${
                isEditing ? 'border-b-2 border-blue-500 bg-blue-50/30' : 'border-none'
              }`} 
            />
          </div>
          <div className="flex items-center gap-4 px-4 py-2">
            <span className="text-[14px] font-bold text-gray-500 uppercase whitespace-nowrap">시 간</span>
            <input 
              type="text" 
              placeholder="00:00 ~ 00:00" 
              className={`text-sm font-bold text-black bg-transparent rounded-none outline-none transition-all px-2 py-1 ${
                isEditing ? 'border-b-2 border-blue-500 bg-blue-50/30' : 'border-none'
              }`} 
            />
          </div>
          <div className="flex items-center gap-4 px-4 py-2">
            <span className="text-[14px] font-bold text-gray-500 uppercase whitespace-nowrap">점검자</span>
            <input 
              type="text" 
              className={`text-sm font-bold text-black bg-transparent rounded-none outline-none transition-all px-2 py-1 ${
                isEditing ? 'border-b-2 border-blue-500 bg-blue-50/30' : 'border-none'
              }`} 
            />
          </div>
        </div>
      </div>
    );
  };

  const listSection = (isPopup: boolean) => (
    <div className={`w-full bg-white ${isPopup ? 'border-2 border-black' : 'max-w-7xl mx-auto overflow-x-auto'} overflow-hidden`}>
      <table className={`w-full border-collapse text-center ${isPopup ? 'border-hidden' : 'border border-black'}`}>
        <thead className={isPopup ? 'bg-white' : 'bg-white border-b border-black'}>
          <tr className={isPopup ? '' : 'h-[40px]'}>
            <th className={`px-2 ${isPopup ? 'py-3 text-sm font-normal border-black border' : 'text-[13px] font-normal border border-black'} text-center uppercase tracking-wider w-[10%]`}>
              <div className={isPopup ? '' : 'flex items-center justify-center h-full px-2'}>순 번</div>
            </th>
            <th className={`px-2 ${isPopup ? 'py-3 text-sm font-normal border-black border' : 'text-[13px] font-normal border border-black'} text-center uppercase tracking-wider w-[30%]`}>
              <div className={isPopup ? '' : 'flex items-center justify-center h-full px-2'}>차 량 번 호</div>
            </th>
            <th className={`px-2 ${isPopup ? 'py-3 text-sm font-normal border-black border' : 'text-[13px] font-normal border border-black'} text-center uppercase tracking-wider w-[20%]`}>
              <div className={isPopup ? '' : 'flex items-center justify-center h-full px-2'}>톤 수</div>
            </th>
            <th className={`px-2 ${isPopup ? 'py-3 text-sm font-normal border-black border' : 'text-[13px] font-normal border border-black'} text-center uppercase tracking-wider w-[20%]`}>
              <div className={isPopup ? '' : 'flex items-center justify-center h-full px-2'}>운 전 자</div>
            </th>
            <th className={`px-2 ${isPopup ? 'py-3 text-sm font-normal border-black border' : 'text-[13px] font-normal border border-black'} text-center uppercase tracking-wider w-[20%]`}>
              <div className={isPopup ? '' : 'flex items-center justify-center h-full px-2'}>확 인</div>
            </th>
          </tr>
        </thead>
        <tbody className={isPopup ? '' : 'bg-white'}>
          {rows.map((row) => (
            <tr key={row} className={`${isPopup ? '' : 'h-[40px] hover:bg-blue-50/30 transition-colors border-b border-black'} text-center`}>
              <td className={`px-2 ${isPopup ? 'py-4 text-sm font-normal border-black border' : 'text-[13px] font-normal border border-black'}`}>
                <div className={isPopup ? '' : 'flex items-center justify-center h-full px-2'}>{row}</div>
              </td>
              <td className={`px-2 ${isPopup ? 'py-4 text-sm font-normal border-black border' : 'text-[13px] font-normal border border-black'}`}>
                <div className={isPopup ? '' : 'flex items-center justify-center h-full px-2'}>
                  {isEditing && !isPopup ? (
                    <input type="text" className="bg-transparent border-none outline-none shadow-none appearance-none w-full text-center text-[13px] font-normal" />
                  ) : null}
                </div>
              </td>
              <td className={`px-2 ${isPopup ? 'py-4 text-sm font-normal border-black border' : 'text-[13px] font-normal border border-black'}`}>
                <div className={isPopup ? '' : 'flex items-center justify-center h-full px-2'}>
                  {isEditing && !isPopup ? (
                    <input type="text" className="bg-transparent border-none outline-none shadow-none appearance-none w-full text-center text-[13px] font-normal" />
                  ) : null}
                </div>
              </td>
              <td className={`px-2 ${isPopup ? 'py-4 text-sm font-normal border-black border' : 'text-[13px] font-normal border border-black'}`}>
                <div className={isPopup ? '' : 'flex items-center justify-center h-full px-2'}>
                  {isEditing && !isPopup ? (
                    <input type="text" className="bg-transparent border-none outline-none shadow-none appearance-none w-full text-center text-[13px] font-normal" />
                  ) : null}
                </div>
              </td>
              <td className={`px-2 ${isPopup ? 'py-4 text-sm font-normal border-black border' : 'text-[13px] font-normal border border-black'}`}>
                <div className={isPopup ? '' : 'flex items-center justify-center h-full px-2'}>
                  {isEditing && !isPopup ? (
                    <input type="text" className="bg-transparent border-none outline-none shadow-none appearance-none w-full text-center text-[13px] font-normal" />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
          <tr className={`${isPopup ? '' : 'h-[40px] hover:bg-blue-50/30 transition-colors border-b border-black'} text-center font-normal`}>
            <td colSpan={2} className={`px-2 ${isPopup ? 'py-4 text-sm font-normal border-black border' : 'text-[13px] font-bold border border-black'}`}>
              <div className={isPopup ? '' : 'flex items-center justify-center h-full px-2'}>총 합 계</div>
            </td>
            <td className={`px-2 ${isPopup ? 'py-4 text-sm font-normal border-black border' : 'text-[13px] font-bold border border-black'}`}>
              <div className={isPopup ? '' : 'flex items-center justify-center h-full px-2'}></div>
            </td>
            <td className={`px-2 ${isPopup ? 'py-4 text-sm font-normal border-black border' : 'text-[13px] font-bold border border-black'}`}>
              <div className={isPopup ? '' : 'flex items-center justify-center h-full px-2'}></div>
            </td>
            <td className={`px-2 ${isPopup ? 'py-4 text-sm font-normal border-black border' : 'text-[13px] font-bold border border-black'}`}>
              <div className={isPopup ? '' : 'flex items-center justify-center h-full px-2'}></div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  if (isPopupMode) {
    return (
      <div className="min-h-screen bg-black print:bg-white p-8 print:p-0 flex flex-col items-center print:block">
        <style>{`
          @page {
            size: A4 portrait;
            margin: 0;
          }
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
            justify-content: flex-start;
          }
          .flex-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; min-height: 100px; }
          .title-box { flex: 1; text-align: center; }
          .doc-title { font-size: 24pt; font-weight: 900; letter-spacing: 2px; line-height: 1.1; color: black; }
          .approval-table { width: 80mm !important; border: 1.5px solid black !important; margin-left: auto; flex-shrink: 0; border-collapse: collapse; }
          .approval-table th { height: 22px !important; font-size: 8.5pt !important; background: white !important; font-weight: normal; text-align: center; border: 1px solid black !important; color: black; }
          .approval-table td { height: 65px !important; border: 1px solid black !important; background: white !important; }
          .approval-table .side-header { width: 26px !important; }
        `}</style>
        <div className="no-print mb-4">
          <button
            onClick={() => window.print()}
            style={{ padding: '10px 24px', background: '#1e3a8a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12pt' }}
          >
            인쇄하기
          </button>
        </div>
        <div className="print-container flex flex-col items-center">
          <div className="print-page shadow-2xl">
            {/* Box 1: Title & Approval */}
            <div className="flex-header">
              <div className="title-box">
                <div className="doc-title">정화조 청소 차량확인서</div>
              </div>
              <table className="approval-table">
                <tbody>
                  <tr>
                    <th rowSpan={2} className="side-header">결<br/>재</th>
                    <th>주 임</th>
                    <th>대 리</th>
                    <th>과 장</th>
                    <th>소 장</th>
                  </tr>
                  <tr>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Box 2: Info (Table style) */}
            {infoSection(true)}

            {/* Box 3: List (Table style) */}
            {listSection(true)}
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
            정화조 청소 차량확인서
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
      {infoSection(false)}
      {listSection(false)}
    </div>
  );
};

export default SepticTankCheck;
