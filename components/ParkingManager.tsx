
import React, { useState, useEffect } from 'react';
import ParkingStatusList from './ParkingStatusList';
import ParkingInspectionHistory from './ParkingInspectionHistory';
import { fetchParkingStatusList, fetchParkingLayout, saveParkingLayout } from '../services/dataService';
import { ParkingStatusItem } from '../types';
import { LayoutList, Printer, Map as MapIcon, RefreshCw, Save, Cloud, X, CheckCircle, Edit2, Lock, Car } from 'lucide-react';

const TABS = [
  { id: 'history', label: '변경이력' },
  { id: 'status', label: '차량현황' },
  { id: 'location', label: '차량위치' },
];

const INITIAL_LAYOUT = {
  'B2F': ['B2-11', 'B2-10', 'B2-9', 'B2-8', 'B2-7', 'B2-6', 'B2-5', 'B2-4', 'B2-3', 'B2-2', 'B2-1', 'B2-13', 'B2-12'],
  'B3F_Yeongdong': ['', '', '', '', '', '', '', 'B3-10', 'B3-1', 'B3-2', 'B3-3', 'B3-4', 'B3-5', 'B3-6', 'B3-7', 'B3-8', 'B3-9', ''],
  'B3F_Yusuji': ['', '', '', '', '', '', '', '', '', '', 'B3-11', '', '', '', '', '', '', '', '']
};

interface SlotProps {
  location: string;
  onLocationChange: (val: string) => void;
  statusData: ParkingStatusItem[];
  isEditMode: boolean;
  showLabel?: boolean;
}

const ParkingSlot: React.FC<SlotProps> = ({ location, onLocationChange, statusData, isEditMode, showLabel = true }) => {
  const locKey = (location || '').replace(/\s+/g, '').toUpperCase();
  const info = locKey ? statusData.find(d => (d.location || '').replace(/\s+/g, '').toUpperCase() === locKey) : null;
  const companyText = (info?.company === '테스트') ? '' : (info?.company || '');
  const plateText = (info?.plateNum === '00가 0000' || info?.plateNum === '00가0000') ? '' : (info?.plateNum || '');

  return (
    <div className={`border border-black flex flex-col h-32 w-full transition-colors shadow-sm ${location ? 'bg-gray-200' : 'bg-white'}`}>
      <div className={`h-1/3 border-b border-black flex items-center justify-center font-bold text-[13px] text-black ${isEditMode ? 'bg-orange-50' : ''}`}>
        <input 
          type="text" 
          value={location} 
          onChange={(e) => onLocationChange(e.target.value)}
          readOnly={!isEditMode}
          className={`w-full h-full text-center bg-transparent border-none outline-none font-bold text-black placeholder:text-gray-300 placeholder:font-normal ${isEditMode ? 'cursor-text focus:bg-orange-100' : 'cursor-default'}`}
          placeholder={isEditMode ? "위치" : ""}
        />
      </div>
      <div className="h-1/3 border-b border-black flex items-center justify-center text-[12px] font-bold text-center px-1 overflow-hidden leading-tight text-black bg-white/50">
        {companyText}
      </div>
      <div className="h-1/3 flex items-center justify-center text-[12px] font-bold text-blue-600 px-1 overflow-hidden whitespace-nowrap bg-white/50">
        {plateText}
      </div>
    </div>
  );
};

const ParkingManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('history');
  const [statusData, setStatusData] = useState<ParkingStatusItem[]>([]);
  const [layout, setLayout] = useState<any>(INITIAL_LAYOUT);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [currentFloor, setCurrentFloor] = useState<'B2F' | 'B3F_Yeongdong' | 'B3F_Yusuji'>('B2F');

  useEffect(() => {
    if (activeTab === 'location' || activeTab === 'status') {
      loadAllData();
    }
  }, [activeTab]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [statusRes, layoutRes] = await Promise.all([
        fetchParkingStatusList(),
        fetchParkingLayout()
      ]);
      setStatusData(Array.isArray(statusRes) ? statusRes : []);
      if (layoutRes) setLayout(layoutRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLayoutChange = (floor: string, index: number, value: string) => {
    setLayout((prev: any) => {
      const newFloorLayout = [...prev[floor]];
      newFloorLayout[index] = value;
      return { ...prev, [floor]: newFloorLayout };
    });
  };

  const handleSaveLayout = async () => {
    setSaveStatus('loading');
    try {
      const success = await saveParkingLayout(layout);
      if (success) {
        setSaveStatus('success');
        setIsEditMode(false);
        window.alert('저장이 완료되었습니다.');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        window.alert('저장에 실패했습니다.');
      }
    } catch (e) {
      setSaveStatus('error');
      window.alert('오류가 발생했습니다.');
    }
  };

  const handlePrintMap = () => {
    const printContent = document.getElementById('parking-map-container');
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;

    const floorLabels = {
      'B2F': 'B2F',
      'B3F_Yeongdong': 'B3F(영동대로변)',
      'B3F_Yusuji': 'B3F(유수지공원)'
    };

    printWindow.document.write(`
      <html>
        <head>
          <title>지정주차 배치도 - ${floorLabels[currentFloor]}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Noto Sans KR', sans-serif; padding: 0; background: black !important; margin: 0; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            input { border: none !important; background: transparent !important; }
            @media print { 
              @page { size: landscape; margin: 0; }
              .no-print { display: none !important; }
              body { background: black !important; padding: 0; }
            }
            .preview-page {
              background: white;
              padding: 15mm 12mm 15mm 12mm;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
              width: fit-content;
              margin: 0 auto;
              border: 1px solid #eee;
              box-sizing: border-box;
            }
            @media print { .preview-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; padding: 10mm 15mm; } }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button>
          </div>
          <div class="preview-page">
            <div class="mb-4 text-center">
              <h2 class="text-2xl font-bold border-b-2 border-black pb-2 inline-block">지정주차 배치도 (${floorLabels[currentFloor]})</h2>
            </div>
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSelectFromHistory = () => {
    setActiveTab('status');
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-2 pb-32 animate-fade-in">
      {/* 테이블 형태의 메뉴 구성 */}
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
        <div className="flex shrink-0">
          {TABS.map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer ${
                activeTab === tab.id 
                  ? 'text-orange-600' 
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'history' && <ParkingInspectionHistory onSelect={handleSelectFromHistory} />}
        {activeTab === 'status' && <ParkingStatusList />}
        {activeTab === 'location' && (
          <div className="flex flex-col items-center space-y-2">
            <div className="bg-white w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black shrink-0">
              <div className="flex shrink-0">
                <div 
                  onClick={() => setCurrentFloor('B2F')} 
                  className={`relative px-4 py-3 flex items-center text-[14px] font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${currentFloor === 'B2F' ? 'text-orange-600' : 'text-gray-500 hover:text-black'}`}
                >
                  B2F
                  {currentFloor === 'B2F' && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
                  )}
                </div>
                <div 
                  onClick={() => setCurrentFloor('B3F_Yeongdong')} 
                  className={`relative px-4 py-3 flex items-center text-[14px] font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${currentFloor === 'B3F_Yeongdong' ? 'text-orange-600' : 'text-gray-500 hover:text-black'}`}
                >
                  B3F(영동변)
                  {currentFloor === 'B3F_Yeongdong' && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
                  )}
                </div>
                <div 
                  onClick={() => setCurrentFloor('B3F_Yusuji')} 
                  className={`relative px-4 py-3 flex items-center text-[14px] font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${currentFloor === 'B3F_Yusuji' ? 'text-orange-600' : 'text-gray-500 hover:text-black'}`}
                >
                  B3F(유수지)
                  {currentFloor === 'B3F_Yusuji' && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
                  )}
                </div>
              </div>

              <div className="flex items-center px-2 shrink-0">
                <div className="h-6 w-[1px] bg-black" />
              </div>
              
              <div className="flex items-center shrink-0">
                <button 
                  onClick={loadAllData} 
                  disabled={loading}
                  className="shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent disabled:opacity-50 text-gray-500 hover:text-black transition-colors whitespace-nowrap relative"
                >
                  <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                  새로고침
                </button>
                <button 
                  onClick={() => setIsEditMode(!isEditMode)} 
                  disabled={loading}
                  className={`shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent transition-all whitespace-nowrap relative disabled:opacity-50 ${
                    isEditMode ? 'text-orange-600' : 'text-gray-500 hover:text-black'
                  }`}
                >
                  {isEditMode ? <Lock size={18} className="mr-1.5" /> : <Edit2 size={18} className="mr-1.5" />}
                  {isEditMode ? '수정완료' : '수정'}
                  {isEditMode && <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />}
                </button>
                <button 
                  onClick={handleSaveLayout} 
                  disabled={loading} 
                  className={`shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent transition-colors whitespace-nowrap disabled:opacity-50 relative ${
                    saveStatus === 'success' ? 'text-orange-600' : 'text-gray-500 hover:text-black'
                  }`}
                >
                  {saveStatus === 'loading' ? (
                    <RefreshCw size={18} className="animate-spin mr-1.5" />
                  ) : saveStatus === 'success' ? (
                    <CheckCircle size={18} className="mr-1.5" />
                  ) : (
                    <Save size={18} className="mr-1.5" />
                  )}
                  {saveStatus === 'success' ? '저장완료' : '저장'}
                </button>
                <button 
                  onClick={handlePrintMap} 
                  disabled={loading}
                  className="shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent text-gray-500 hover:text-black transition-colors whitespace-nowrap relative disabled:opacity-50"
                >
                  <Printer size={18} className="mr-1.5" />
                  인쇄
                </button>
              </div>
            </div>
            {loading ? (
              <div className="py-24 flex flex-col items-center gap-4">
                <RefreshCw className="animate-spin text-blue-500" size={48} />
                <p className="text-slate-400 font-black">데이터 로딩 중...</p>
              </div>
            ) : (
              <div id="parking-map-container" className="w-full flex justify-center">
                {currentFloor === 'B2F' && (
                  <div className="w-full max-w-6xl border-2 border-black p-8 bg-white relative mt-4 shadow-lg">
                    <div className="grid grid-cols-11 gap-px bg-black border border-black mb-12">
                      {layout.B2F.slice(0, 11).map((loc: string, i: number) => (
                        <div key={i} className="bg-white">
                          <ParkingSlot location={loc} onLocationChange={(val) => handleLayoutChange('B2F', i, val)} statusData={statusData} isEditMode={isEditMode} />
                        </div>
                      ))}
                    </div>
                    <div className="text-center mb-12"><h1 className="text-7xl font-black tracking-tighter text-black">B2F</h1></div>
                    <div className="grid grid-cols-11 gap-px">
                      <div className="col-span-3"></div>
                      <div className="bg-white border border-black">
                        <ParkingSlot location={layout.B2F[11]} onLocationChange={(val) => handleLayoutChange('B2F', 11, val)} statusData={statusData} isEditMode={isEditMode} />
                      </div>
                      <div className="col-span-3"></div>
                      <div className="bg-white border border-black">
                        <ParkingSlot location={layout.B2F[12]} onLocationChange={(val) => handleLayoutChange('B2F', 12, val)} statusData={statusData} isEditMode={isEditMode} />
                      </div>
                      <div className="col-span-3"></div>
                    </div>
                  </div>
                )}

                {currentFloor === 'B3F_Yeongdong' && (
                  <div className="w-full max-w-6xl border-2 border-black p-8 bg-white relative mt-4 shadow-lg flex flex-col items-center">
                    <div className="w-full flex justify-between mb-12 max-w-4xl">
                      <div className="grid grid-cols-4 w-[45%]">
                        {[0, 1, 2, 3].map(idx => <ParkingSlot key={idx} location={layout.B3F_Yeongdong[idx]} onLocationChange={(val) => handleLayoutChange('B3F_Yeongdong', idx, val)} statusData={statusData} isEditMode={isEditMode} />)}
                      </div>
                      <div className="grid grid-cols-4 w-[45%]">
                        {[4, 5, 6, 7].map(idx => <ParkingSlot key={idx} location={layout.B3F_Yeongdong[idx]} onLocationChange={(val) => handleLayoutChange('B3F_Yeongdong', idx, val)} statusData={statusData} isEditMode={isEditMode} />)}
                      </div>
                    </div>
                    <div className="text-center mb-12"><h1 className="text-7xl font-black text-black tracking-tight">B3F(영동대로변)</h1></div>
                    <div className="w-full">
                      <div className="grid grid-cols-10">
                        {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(idx => <ParkingSlot key={idx} location={layout.B3F_Yeongdong[idx]} onLocationChange={(val) => handleLayoutChange('B3F_Yeongdong', idx, val)} statusData={statusData} isEditMode={isEditMode} />)}
                      </div>
                    </div>
                  </div>
                )}

                {currentFloor === 'B3F_Yusuji' && (
                  <div className="w-full max-w-6xl border-2 border-black p-8 bg-white relative mt-4 shadow-lg flex flex-col items-center">
                    <div className="w-full mb-12">
                      <div className="grid grid-cols-11 gap-0">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(idx => <ParkingSlot key={idx} location={layout.B3F_Yusuji[idx]} onLocationChange={(val) => handleLayoutChange('B3F_Yusuji', idx, val)} statusData={statusData} isEditMode={isEditMode} />)}
                      </div>
                    </div>
                    <div className="text-center mb-12"><h1 className="text-7xl font-black text-black tracking-tighter">B3F(유수지공원)</h1></div>
                    <div className="w-full flex justify-between max-w-5xl">
                      <div className="grid grid-cols-4 w-[40%] gap-0">
                        {[11, 12, 13, 14].map(idx => <ParkingSlot key={idx} location={layout.B3F_Yusuji[idx]} onLocationChange={(val) => handleLayoutChange('B3F_Yusuji', idx, val)} statusData={statusData} isEditMode={isEditMode} />)}
                      </div>
                      <div className="grid grid-cols-4 w-[40%] gap-0">
                        {[15, 16, 17, 18].map(idx => <ParkingSlot key={idx} location={layout.B3F_Yusuji[idx]} onLocationChange={(val) => handleLayoutChange('B3F_Yusuji', idx, val)} statusData={statusData} isEditMode={isEditMode} />)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes scale-up {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-up {
          animation: scale-up 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ParkingManager;
