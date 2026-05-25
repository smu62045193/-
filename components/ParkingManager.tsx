
import React, { useState, useEffect } from 'react';
import ParkingStatusList from './ParkingStatusList';
import ParkingInspectionHistory from './ParkingInspectionHistory';
import { 
  fetchParkingStatusList, 
  fetchParkingLayout, 
  saveParkingLayout,
  fetchOutdoorUnitSettings,
  saveOutdoorUnitSettings
} from '../services/dataService';
import { ParkingStatusItem, OutdoorUnitRooftopItem } from '../types';
import { 
  LayoutList, 
  Printer, 
  Map as MapIcon, 
  RefreshCw, 
  Save, 
  Cloud, 
  X, 
  CheckCircle, 
  Edit2, 
  Lock, 
  Car,
  Trash2,
  Plus
} from 'lucide-react';

const TABS = [
  { id: 'history', label: '변경이력' },
  { id: 'status', label: '차량현황' },
  { id: 'location', label: '차량위치' },
  { id: 'outdoor_unit', label: '실외기' },
];

const SUB_TABS_OUTDOOR_UNIT = [
  { id: 'rooftop', label: '옥상' },
  { id: 'outside_1f', label: '1F건물외곽' },
  { id: 'garden_1f', label: '1F화단' },
  { id: 'b2_b3', label: 'B2F주차장' },
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
  const [activeTab, setActiveTab ] = useState('history');
  const [statusData, setStatusData] = useState<ParkingStatusItem[]>([]);
  const [layout, setLayout] = useState<any>(INITIAL_LAYOUT);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [currentFloor, setCurrentFloor] = useState<'B2F' | 'B3F_Yeongdong' | 'B3F_Yusuji'>('B2F');

  // Outdoor unit states
  const [isOutdoorUnitEditMode, setIsOutdoorUnitEditMode] = useState(false);
  const [activeOutdoorUnitSubTab, setActiveOutdoorUnitSubTab] = useState('rooftop');
  const [outdoorUnitSaveSuccess, setOutdoorUnitSaveSuccess] = useState(false);

  const [outdoorUnitRooftopData, setOutdoorUnitRooftopData] = useState<OutdoorUnitRooftopItem[]>([
    { id: '1', label: '삼성 / 6F / 이가자산' },
    { id: '2', label: '삼성 / 6F / 이가자산' },
    { id: '3', label: '삼성 / 6F / 이가자산' },
    { id: '4', label: '' },
    { id: '5', label: '삼성 / 9F / 유명' },
    { id: '6', label: '삼성 / 9F / 유명' },
    { id: '7', label: '' },
    { id: '8', label: '삼성 / 8F / 얼머스' },
    { id: '9', label: 'LG / 10F / 해주' },
    { id: '10', label: 'LG / 10F / 이가ACM' },
    { id: '11', label: '' },
    { id: '12', label: '위니아 / E/L승강기 (중앙)' },
    { id: '13', label: '위니아 / E/L승강기 (중앙)' },
    { id: '14', label: 'LG / 8F / 승강기' },
    { id: '15', label: '캐리어 / E/L승강기 (비상)' },
  ]);

  const [outdoorUnitOutside1FData, setOutdoorUnitOutside1FData] = useState<OutdoorUnitRooftopItem[]>([
    { id: '13', label: '삼성 / 1F / 이가' },
    { id: '12', label: 'LG / 1F / 이가' },
    { id: '11', label: '캐리어 / 1F / 이가' },
    { id: '10', label: '캐리어 / 1F / 이가' },
    { id: '9', label: 'LG / 3~5F / 이가건축' },
    { id: '8', label: 'LG / 3~5F / 이가건축' },
    { id: '7', label: 'LG / 3~5F / 이가건축' },
    { id: '6', label: 'LG / 3~5F / 이가건축' },
    { id: '5', label: '실외기 받침대 있음' },
    { id: '4', label: 'LG / 3~5F / 이가건축' },
    { id: '3', label: '캐리어 / 3~5F / 이가건축' },
    { id: '2', label: '삼성 / 2F / 이가건축' },
    { id: '1', label: 'LG / 1F / 관리사무실, 방재실, 1F 로비' },
  ]);

  const [outdoorUnitGarden1FData, setOutdoorUnitGarden1FData] = useState<Record<string, string>>({
    label1: '삼성 /\n1F/ 매머드커\n피',
    label234: '삼성 / B1F / 이가마루',
    label5: '삼성 / B1F / 티엠에너지',
  });

  const [outdoorUnitB1B2Data, setOutdoorUnitB1B2Data] = useState<Record<string, string>>({
    label1: '캐리어 / B2F / 식당',
    label2: 'LG / B1F / 매점',
    label3: 'LG / B2F / 식당',
    label4: 'LG / B2F / 경비',
    label5: '캐리어 / B2F / 미화',
  });

  const handleOutdoorUnitRooftopChange = (id: string, value: string) => {
    setOutdoorUnitRooftopData(prev => prev.map(item => item.id === id ? { ...item, label: value } : item));
  };

  const handleOutdoorUnitOutside1FChange = (id: string, value: string) => {
    setOutdoorUnitOutside1FData(prev => prev.map(item => item.id === id ? { ...item, label: value } : item));
  };

  const handleOutdoorUnitGarden1FChange = (key: string, value: string) => {
    setOutdoorUnitGarden1FData(prev => ({ ...prev, [key]: value }));
  };

  const handleOutdoorUnitB1B2Change = (key: string, value: string) => {
    setOutdoorUnitB1B2Data(prev => ({ ...prev, [key]: value }));
  };

  const handleOutdoorUnitRefresh = async () => {
    setLoading(true);
    try {
      const data = await fetchOutdoorUnitSettings();
      if (data) {
        if (data.rooftop) setOutdoorUnitRooftopData(data.rooftop);
        if (data.outside1F) setOutdoorUnitOutside1FData(data.outside1F);
        if (data.garden1F) setOutdoorUnitGarden1FData(data.garden1F);
        if (data.b1b2) setOutdoorUnitB1B2Data(data.b1b2);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOutdoorUnitSave = async () => {
    setLoading(true);
    setOutdoorUnitSaveSuccess(false);
    try {
      const success = await saveOutdoorUnitSettings({
        rooftop: outdoorUnitRooftopData,
        outside1F: outdoorUnitOutside1FData,
        garden1F: outdoorUnitGarden1FData,
        b1b2: outdoorUnitB1B2Data
      });
      
      if (success) {
        setOutdoorUnitSaveSuccess(true);
        alert('실외기 설정이 저장되었습니다.');
        setIsOutdoorUnitEditMode(false);
        setTimeout(() => setOutdoorUnitSaveSuccess(false), 3000);
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Outdoor unit save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'location' || activeTab === 'status') {
      loadAllData();
    } else if (activeTab === 'outdoor_unit') {
      handleOutdoorUnitRefresh();
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

  const handleOutdoorUnitPrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return;

    let contentHtml = '';
    const activeTabText = SUB_TABS_OUTDOOR_UNIT.find(t => t.id === activeOutdoorUnitSubTab)?.label || '';

    if (activeOutdoorUnitSubTab === 'rooftop') {
      contentHtml = `
        <div class="print-page">
          <h1>실외기 설치 현황 (${activeTabText})</h1>
          <div class="diagram-container">
            ${outdoorUnitRooftopData.slice(0, 9).map((item, idx) => `
              <div class="unit-box" style="top: ${idx * 45}px; left: 0px; width: 70px; height: 35px;">${item.id}</div>
              <div class="label-text" style="top: ${idx * 45 + 10}px; left: 80px;">${item.label}</div>
            `).join('')}
            
            <div class="border-box" style="top: 0px; left: 330px; width: 300px; height: 380px; flex-direction: column;">
              <div class="red-label" style="font-size: 30pt; margin-bottom: 10px;">냉 각 탑</div>
              <div class="red-label" style="font-size: 30pt;">2호기</div>
            </div>

            <div style="position: absolute; top: 480px; left: 0; right: 0; display: flex; justify-content: space-between;">
              <div style="display: flex; gap: 25px;">
                ${outdoorUnitRooftopData.slice(9, 14).map((item) => `
                  <div style="display: flex; flex-direction: column; align-items: center; width: 80px;">
                    <div class="unit-box" style="position: static; width: 70px; height: 35px; border-width: 2px;">${item.id}</div>
                    <div class="label-text" style="position: static; text-align: center; margin-top: 5px;">${item.label.replace(/\n/g, '<br/>')}</div>
                  </div>
                `).join('')}
              </div>
              <div style="display: flex; flex-direction: column; align-items: center; width: 80px;">
                <div class="unit-box" style="position: static; width: 70px; height: 35px; border-width: 2px;">${outdoorUnitRooftopData[14].id}</div>
                <div class="label-text" style="position: static; text-align: center; margin-top: 5px;">${outdoorUnitRooftopData[14].label.replace(/\n/g, '<br/>')}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (activeOutdoorUnitSubTab === 'outside_1f') {
      contentHtml = `
        <div class="print-page">
          <h1>실외기 설치 현황 (${activeTabText})</h1>
          <div class="diagram-container" style="display: flex; justify-content: center; align-items: center;">
            <div style="position: relative; width: 450px; height: 650px;">
              <div style="position: absolute; left: -125px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: space-around; align-items: center; width: 120px;">
                 <div style="text-align: center;">
                    <div style="font-weight: bold; font-size: 14pt;">영동대로쪽</div>
                    <div style="font-size: 24pt;">↑</div>
                 </div>
                 <div class="red-label" style="font-size: 24pt; transform: rotate(0deg);">새마을</div>
                 <div style="text-align: center;">
                    <div style="font-size: 24pt;">↓</div>
                    <div style="font-weight: bold; font-size: 14pt;">주차<br/>정산소쪽</div>
                 </div>
              </div>
              
              <div style="display: flex; flex-direction: column; align-items: flex-start; padding: 20px; gap: 12px; border-left: 2px solid black; border-right: 2px solid black; height: 100%; margin: 0 40px;">
                ${outdoorUnitOutside1FData.map(item => `
                  <div style="display: flex; align-items: center; gap: 15px;">
                    <div class="unit-box" style="position: static; width: 60px; height: 30px;">${item.id}</div>
                    <div class="label-text" style="position: static;">${item.label}</div>
                  </div>
                `).join('')}
              </div>

              <div class="red-label" style="position: absolute; right: -115px; top: 50%; transform: translateY(-50%); font-size: 24pt; text-align: center; line-height: 1.2;">더채플앳<br/>대치</div>
            </div>
          </div>
        </div>
      `;
    } else if (activeOutdoorUnitSubTab === 'garden_1f') {
      contentHtml = `
        <div class="print-page">
          <h1>실외기 설치 현황 (${activeTabText})</h1>
          <div class="diagram-container" style="display: flex; justify-content: center; align-items: center; flex-direction: column;">
             <div style="display: flex; gap: 30px;">
                <div style="width: 420px; height: 550px; border: 4px solid black; position: relative;">
                   <div style="height: 80px; border-bottom: 4px solid black; display: flex; align-items: center; justify-content: center;">
                      <span class="red-label" style="font-size: 20pt;">커피점테라스</span>
                   </div>
                   <div style="position: absolute; top: 100px; right: 30px; display: flex; flex-direction: column; align-items: center;">
                      <div class="label-text" style="position: static; margin-bottom: 5px; text-align: center;">${outdoorUnitGarden1FData.label1.replace(/\n/g, '<br/>')}</div>
                      <div class="unit-box" style="position: static; width: 100px; height: 40px; font-size: 20pt;">1</div>
                   </div>
                   <div style="position: absolute; top: 280px; left: 30px; display: flex; flex-direction: column; align-items: center;">
                      <div style="display: flex; align-items: flex-end; gap: 15px;">
                         <div style="display: flex; flex-direction: column;">
                            <div class="unit-box" style="position: static; width: 100px; height: 40px; font-size: 20pt;">2</div>
                            <div class="unit-box" style="position: static; width: 100px; height: 40px; border-top: 0; font-size: 20pt;">3</div>
                         </div>
                         <div class="unit-box" style="position: static; width: 100px; height: 40px; font-size: 20pt;">4</div>
                      </div>
                      <div class="label-text" style="position: static; margin-top: 10px;">${outdoorUnitGarden1FData.label234}</div>
                   </div>
                   <div class="red-label" style="position: absolute; bottom: 30px; left: 0; right: 0; text-align: center; font-size: 40pt; letter-spacing: 0.5em;">화 단</div>
                </div>
                <div style="width: 230px; height: 550px; border: 4px solid black; position: relative;">
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 200px; border-bottom: 4px solid black; display: flex; align-items: center; justify-content: center;">
                       <span class="red-label" style="font-size: 30pt;">썬 큰</span>
                    </div>
                    <div style="position: absolute; top: 250px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center;">
                        <div class="unit-box" style="position: static; width: 100px; height: 40px; font-size: 20pt;">5</div>
                        <div class="label-text" style="position: static; margin-top: 10px; text-align: center;">${outdoorUnitGarden1FData.label5}</div>
                    </div>
                    <div class="red-label" style="position: absolute; bottom: 30px; left: 0; right: 0; text-align: center; font-size: 30pt;">화 단</div>
                </div>
              </div>
          </div>
        </div>
      `;
    } else if (activeOutdoorUnitSubTab === 'b2_b3') {
      contentHtml = `
        <div class="print-page">
          <h1>실외기 설치 현황 (${activeTabText})</h1>
          <div class="diagram-container">
             <div class="border-box" style="left: 0; top: 0; width: 130px; height: 350px;">
                <span class="red-label" style="font-size: 24pt;">정압실</span>
             </div>
             <div class="border-box" style="left: 0; bottom: 30px; width: 130px; height: 100px;">
                <span class="red-label" style="font-size: 24pt;">팬 룸</span>
             </div>
             <div class="red-label" style="position: absolute; left: 130px; width: 150px; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 24pt; text-align: center; letter-spacing: 0.2em; line-height: 1.5;">주<br/>차<br/>램<br/>프</div>
             
             <div style="position: absolute; left: 280px; top: 0; right: 0; bottom: 0;">
                <div style="border: 4px solid black; height: 400px; position: relative; padding: 30px 20px;">
                   <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                      <div style="display: flex; flex-direction: column; gap: 30px;">
                         <div style="display: flex; flex-direction: column; align-items: center;">
                            <div class="unit-box" style="position: static; width: 100px; height: 40px; font-size: 20pt;">1</div>
                            <div class="label-text" style="position: static; margin-top: 5px;">${outdoorUnitB1B2Data.label1}</div>
                         </div>
                         <div style="display: flex; flex-direction: column; align-items: center;">
                            <div class="unit-box" style="position: static; width: 100px; height: 40px; font-size: 20pt;">2</div>
                            <div class="label-text" style="position: static; margin-top: 5px;">${outdoorUnitB1B2Data.label2}</div>
                         </div>
                      </div>
                      <div style="display: flex; flex-direction: column; align-items: center; margin-top: -15px;">
                         <div class="red-label" style="font-size: 24pt; margin-bottom: 20px;">미화대기실</div>
                         <div class="unit-box" style="position: static; width: 100px; height: 40px; font-size: 20pt;">5</div>
                         <div class="label-text" style="position: static; margin-top: 5px;">${outdoorUnitB1B2Data.label5}</div>
                      </div>
                   </div>
                   <div style="position: absolute; bottom: 30px; left: 20px; right: 20px; display: flex; justify-content: space-between;">
                      <span class="red-label" style="font-size: 24pt;">식 당</span>
                      <span class="red-label" style="font-size: 24pt;">경비대기실</span>
                   </div>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 0 20px; margin-top: 40px;">
                    <div style="display: flex; flex-direction: column; align-items: center;">
                      <div class="unit-box" style="position: static; width: 100px; height: 40px; font-size: 20pt;">3</div>
                      <div class="label-text" style="position: static; margin-top: 5px;">${outdoorUnitB1B2Data.label3}</div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: center;">
                      <div class="unit-box" style="position: static; width: 100px; height: 40px; font-size: 20pt;">4</div>
                      <div class="label-text" style="position: static; margin-top: 5px;">${outdoorUnitB1B2Data.label4}</div>
                    </div>
                </div>
             </div>
          </div>
        </div>
      `;
    }

    const html = `
      <html>
        <head>
          <title>실외기 설치 현황 인쇄</title>
          <style>
            @page { 
              size: A4 portrait; 
              margin: 10mm; 
            }
            body { 
              font-family: "Malgun Gothic", sans-serif; 
              background-color: black; 
              color: black; 
              padding: 0;
              margin: 0;
            }
            .no-print {
              display: flex;
              justify-content: center;
              padding: 20px;
              background-color: #111;
              border-bottom: 1px solid #333;
            }
            .print-btn {
              padding: 10px 24px;
              background-color: #1e3a8a;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
              font-size: 12pt;
            }
            @media print {
              .no-print { display: none !important; }
              body { background-color: white !important; }
              .print-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
            }
            .print-page {
              width: 190mm;
              min-height: 277mm;
              padding: 10mm;
              margin: 20px auto;
              background-color: white;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
              box-sizing: border-box;
              position: relative;
            }
            h1 { 
              text-align: center; 
              font-size: 20pt; 
              margin-bottom: 20px; 
              font-weight: 900;
              border-bottom: 2px solid black;
              padding-bottom: 10px;
            }
            .section-title {
              font-size: 16pt;
              font-weight: bold;
              margin-bottom: 15px;
              padding-left: 10px;
              border-left: 5px solid #1e3a8a;
            }
            
            /* Diagram specific styles */
            .diagram-container {
              position: relative;
              width: 100%;
              min-height: 180mm;
            }
            .unit-box {
              position: absolute;
              border: 2px solid #0066CC;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              background-color: white;
            }
            .label-text {
              position: absolute;
              font-size: 11pt;
              font-weight: 500;
              line-height: 1.2;
            }
            .red-label {
              color: #ef4444;
              font-weight: bold;
            }
            .border-box {
              position: absolute;
              border: 3px solid black;
              display: flex;
              align-items: center;
              justify-content: center;
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="print-btn" onclick="window.print()">인쇄하기</button>
          </div>
          ${contentHtml}
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const renderOutdoorUnitRooftopContent = () => {
    const mainItems = outdoorUnitRooftopData.slice(0, 9);
    const bottomItems = outdoorUnitRooftopData.slice(9, 14);
    const lastItem = outdoorUnitRooftopData[14];

    return (
      <div className="bg-white p-8 overflow-auto border border-black relative">
        <div className="max-w-4xl mx-auto relative min-h-[700px]">
          {/* Left Column (1-9) */}
          <div className="flex flex-col space-y-6 w-[350px]">
            {mainItems.map((item) => (
              <div key={item.id} className="flex items-center space-x-6">
                <div className="w-20 h-10 border-2 border-[#0066CC] flex items-center justify-center font-bold text-lg bg-white shrink-0">
                  {item.id}
                </div>
                {isOutdoorUnitEditMode ? (
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => handleOutdoorUnitRooftopChange(item.id, e.target.value)}
                    className="flex-1 border border-orange-300 p-1 text-[15px] font-medium rounded"
                  />
                ) : (
                  <span className="text-[15px] font-medium whitespace-nowrap">{item.label}</span>
                )}
              </div>
            ))}
          </div>

          {/* Central Cooling Tower Box */}
          <div className="absolute top-0 left-[450px] w-[350px] h-[450px] border-4 border-black flex flex-col items-center justify-center p-4">
            <div className="text-red-500 font-bold text-4xl mb-4">냉 각 탑</div>
            <div className="text-red-500 font-bold text-4xl">2호기</div>
          </div>

          {/* Bottom Row (10-15) */}
          <div className="mt-6 flex items-start justify-between">
            <div className="flex space-x-6">
              {bottomItems.map((item) => (
                <div key={item.id} className="flex flex-col items-center space-y-2 w-24">
                  <div className="w-full h-10 border-2 border-[#0066CC] flex items-center justify-center font-bold text-lg bg-white">
                    {item.id}
                  </div>
                  {isOutdoorUnitEditMode ? (
                    <textarea
                      value={item.label}
                      onChange={(e) => handleOutdoorUnitRooftopChange(item.id, e.target.value)}
                      rows={2}
                      className="w-full border border-orange-300 p-1 text-[13px] font-medium text-center leading-tight rounded resize-none"
                    />
                  ) : (
                    <div className="text-[13px] font-medium text-center leading-tight min-h-[32px] flex items-center justify-center">
                      {item.label.split('\n').map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center space-y-2 w-24">
              <div className="w-full h-10 border-2 border-[#0066CC] flex items-center justify-center font-bold text-lg bg-white">
                {lastItem.id}
              </div>
              {isOutdoorUnitEditMode ? (
                <textarea
                  value={lastItem.label}
                  onChange={(e) => handleOutdoorUnitRooftopChange(lastItem.id, e.target.value)}
                  rows={2}
                  className="w-full border border-orange-300 p-1 text-[13px] font-medium text-center leading-tight rounded resize-none"
                />
              ) : (
                <div className="text-[13px] font-medium text-center leading-tight min-h-[32px] flex items-center justify-center">
                  {lastItem.label.split('\n').map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Labels */}
          <div className="mt-8 pt-4 border-t-2 border-black flex justify-between items-center">
            <div className="text-red-500 font-bold text-2xl px-4">전실입구</div>
            <div className="text-red-500 font-bold text-2xl px-4">EPS실</div>
          </div>
        </div>
      </div>
    );
  };

  const renderOutdoorUnitOutside1FContent = () => {
    return (
      <div className="bg-white p-8 overflow-auto border border-black relative">
        <div className="max-w-4xl mx-auto relative flex justify-center min-h-[750px] bg-white">
          {/* Left Annotations */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-around py-20 items-center w-32">
            <div className="flex flex-col items-center">
              <div className="text-black font-bold text-xl">영동대로쪽</div>
              <div className="text-black text-4xl">↑</div>
            </div>
            <div className="text-red-500 font-bold text-4xl -rotate-0">새마을</div>
            <div className="flex flex-col items-center">
              <div className="text-black text-4xl">↓</div>
              <div className="text-black font-bold text-xl text-center">주차<br/>정산소쪽</div>
            </div>
          </div>

          {/* Central Vertical Layout */}
          <div className="flex flex-col space-y-4 w-full max-w-lg px-12 items-center">
            <div className="w-full border-l-2 border-l-black border-r-2 border-r-black px-12 flex flex-col space-y-4 items-center h-fit pb-8">
              {outdoorUnitOutside1FData.map((item) => (
                <div key={item.id} className="flex items-center space-x-4 w-full">
                  <div className="w-16 h-8 border-2 border-[#0066CC] flex items-center justify-center font-bold text-base bg-white shrink-0">
                    {item.id}
                  </div>
                  {isOutdoorUnitEditMode ? (
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => handleOutdoorUnitOutside1FChange(item.id, e.target.value)}
                      className="flex-1 border border-orange-300 p-1 text-[14px] font-medium rounded"
                    />
                  ) : (
                    <span className="text-[14px] font-medium whitespace-pre-wrap">{item.label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Annotations */}
          <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center items-center w-32">
            <div className="text-red-500 font-bold text-4xl text-center leading-tight">더채플앳<br/>대치</div>
          </div>
        </div>
      </div>
    );
  };

  const renderOutdoorUnitGarden1FContent = () => {
    return (
      <div className="bg-white p-8 overflow-auto border border-black relative">
        <div className="max-w-6xl mx-auto flex justify-between space-x-12 min-h-[600px] bg-white">
          {/* Left Garden (화단) */}
          <div className="flex-1 border-4 border-black relative flex flex-col min-h-[600px]">
            {/* Top Area: 커피점테라스 */}
            <div className="w-full h-24 border-b-4 border-black flex items-center justify-center">
              <span className="text-red-500 font-bold text-4xl">커피점테라스</span>
            </div>

            {/* Content Area Inside Left Garden */}
            <div className="flex-1 relative p-8">
              {/* Unit 1 Block */}
              <div className="absolute top-8 right-16 flex flex-col items-center">
                <div className="mb-2 text-center">
                  {isOutdoorUnitEditMode ? (
                    <textarea
                      value={outdoorUnitGarden1FData.label1}
                      onChange={(e) => handleOutdoorUnitGarden1FChange('label1', e.target.value)}
                      className="border border-orange-300 p-1 text-[13px] font-medium text-center w-64 leading-tight rounded resize-none"
                      rows={2}
                    />
                  ) : (
                    <div className="text-[13px] font-medium leading-tight whitespace-pre-wrap">
                      {outdoorUnitGarden1FData.label1}
                    </div>
                  )}
                </div>
                <div className="w-32 h-12 border-2 border-[#0066CC] flex items-center justify-center font-bold text-2xl bg-white shadow-sm">
                  1
                </div>
              </div>

              {/* Units 2, 3, 4 Cluster */}
              <div className="absolute top-48 left-12 flex flex-col items-center">
                <div className="flex items-end flex-wrap gap-2">
                  <div className="flex flex-col">
                    <div className="w-32 h-12 border-2 border-[#0066CC] flex items-center justify-center font-bold text-2xl bg-white shadow-sm">
                      2
                    </div>
                    <div className="w-32 h-12 border-2 border-[#0066CC] border-t-0 flex items-center justify-center font-bold text-2xl bg-white shadow-sm">
                      3
                    </div>
                  </div>
                  <div className="w-32 h-12 border-2 border-[#0066CC] flex items-center justify-center font-bold text-2xl bg-white shadow-sm mb-0">
                    4
                  </div>
                </div>
                {/* Cluster Label */}
                <div className="mt-4 text-center">
                  {isOutdoorUnitEditMode ? (
                    <input
                      type="text"
                      value={outdoorUnitGarden1FData.label234}
                      onChange={(e) => handleOutdoorUnitGarden1FChange('label234', e.target.value)}
                      className="border border-orange-300 p-1 text-[15px] font-medium text-center w-64 rounded"
                    />
                  ) : (
                    <div className="text-[15px] font-medium">{outdoorUnitGarden1FData.label234}</div>
                  )}
                </div>
              </div>

              <div className="absolute bottom-8 left-0 right-0 text-center">
                <span className="text-red-500 font-bold text-4xl">화 단</span>
              </div>
            </div>
          </div>

          {/* Right Garden (화단) */}
          <div className="flex-1 border-4 border-black relative flex flex-col min-h-[600px]">
            {/* 썬 큰 label box */}
            <div className="w-full h-[240px] border-b-4 border-black flex items-center justify-center bg-white">
              <span className="text-red-500 font-bold text-4xl">썬 큰</span>
            </div>

            <div className="flex-1 relative p-8 flex flex-col items-center justify-center">
              {/* Unit 5 Block */}
              <div className="flex flex-col items-center mt-4">
                <div className="w-32 h-12 border-2 border-[#0066CC] flex items-center justify-center font-bold text-2xl bg-white shadow-sm">
                  5
                </div>
                <div className="mt-4 text-center">
                  {isOutdoorUnitEditMode ? (
                    <input
                      type="text"
                      value={outdoorUnitGarden1FData.label5}
                      onChange={(e) => handleOutdoorUnitGarden1FChange('label5', e.target.value)}
                      className="border border-orange-300 p-1 text-[15px] font-medium text-center w-72 rounded"
                    />
                  ) : (
                    <div className="text-[15px] font-medium whitespace-nowrap">{outdoorUnitGarden1FData.label5}</div>
                  )}
                </div>
              </div>

              {/* Bottom "화 단" label */}
              <div className="mt-8">
                <span className="text-red-500 font-bold text-4xl">화 단</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOutdoorUnitB1B2Content = () => {
    return (
      <div className="bg-white p-8 overflow-auto border border-black relative">
        <div className="max-w-6xl mx-auto relative min-h-[650px] bg-white">
          {/* Left Area: 정압실 and 팬룸 */}
          <div className="absolute left-0 top-0 w-56 h-[400px] border-4 border-black flex items-center justify-center">
            <span className="text-red-500 font-bold text-4xl">정압실</span>
          </div>
          
          <div className="absolute left-0 bottom-4 w-56 h-28 border-4 border-black flex items-center justify-center">
            <span className="text-red-500 font-bold text-4xl">팬 룸</span>
          </div>

          {/* 주차램프 Label */}
          <div className="absolute left-64 top-10 bottom-4 flex flex-col justify-center items-center w-24">
            <div className="text-red-500 font-bold text-5xl leading-[1.3] whitespace-pre-wrap text-center tracking-widest">
              {"주\n차\n램\n프"}
            </div>
          </div>

          {/* Right Main Content Area */}
          <div className="ml-96">
            {/* Main Box Area */}
            <div className="border-4 border-black p-8 min-h-[480px] relative">
              {/* Top Row inside box */}
              <div className="flex justify-between items-start">
                {/* Unit 1 & Label */}
                <div className="flex flex-col items-center mt-12 ml-4">
                  <div className="w-28 h-12 border-2 border-[#0066CC] flex items-center justify-center font-bold text-xl bg-white shadow-sm">
                    1
                  </div>
                  <div className="mt-2 text-center">
                    {isOutdoorUnitEditMode ? (
                      <input
                        type="text"
                        value={outdoorUnitB1B2Data.label1}
                        onChange={(e) => handleOutdoorUnitB1B2Change('label1', e.target.value)}
                        className="border border-orange-300 p-1 text-[13px] font-medium text-center w-36 rounded shadow-inner"
                      />
                    ) : (
                      <div className="text-[13px] font-medium leading-tight">{outdoorUnitB1B2Data.label1}</div>
                    )}
                  </div>
                </div>

                {/* 미화대기실 & Unit 5 */}
                <div className="flex flex-col items-center mr-4">
                  <span className="text-red-500 font-bold text-4xl mb-6">미화대기실</span>
                  <div className="w-28 h-12 border-2 border-[#0066CC] flex items-center justify-center font-bold text-xl bg-white shadow-sm">
                    5
                  </div>
                  <div className="mt-2 text-center">
                    {isOutdoorUnitEditMode ? (
                      <input
                        type="text"
                        value={outdoorUnitB1B2Data.label5}
                        onChange={(e) => handleOutdoorUnitB1B2Change('label5', e.target.value)}
                        className="border border-orange-300 p-1 text-[13px] font-medium text-center w-36 rounded shadow-inner"
                      />
                    ) : (
                      <div className="text-[13px] font-medium leading-tight">{outdoorUnitB1B2Data.label5}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle Row inside box */}
              <div className="mt-4 ml-4">
                {/* Unit 2 & Label */}
                <div className="flex flex-col items-center w-fit">
                  <div className="w-28 h-12 border-2 border-[#0066CC] flex items-center justify-center font-bold text-xl bg-white shadow-sm">
                    2
                  </div>
                  <div className="mt-2 text-center">
                    {isOutdoorUnitEditMode ? (
                      <input
                        type="text"
                        value={outdoorUnitB1B2Data.label2}
                        onChange={(e) => handleOutdoorUnitB1B2Change('label2', e.target.value)}
                        className="border border-orange-300 p-1 text-[13px] font-medium text-center w-36 rounded shadow-inner"
                      />
                    ) : (
                      <div className="text-[13px] font-medium leading-tight">{outdoorUnitB1B2Data.label2}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Labels inside box */}
              <div className="absolute bottom-10 left-12 right-12 flex justify-between items-end">
                <span className="text-red-500 font-bold text-4xl">식 당</span>
                <span className="text-red-500 font-bold text-4xl">경비대기실</span>
              </div>
            </div>

            {/* Bottom Content (Outside box) */}
            <div className="mt-12 flex justify-center space-x-24 pr-12">
              {/* Unit 3 & Label */}
              <div className="flex flex-col items-center">
                <div className="w-28 h-12 border-2 border-[#0066CC] flex items-center justify-center font-bold text-xl bg-white shadow-sm">
                  3
                </div>
                <div className="mt-2 text-center">
                  {isOutdoorUnitEditMode ? (
                    <input
                      type="text"
                      value={outdoorUnitB1B2Data.label3}
                      onChange={(e) => handleOutdoorUnitB1B2Change('label3', e.target.value)}
                      className="border border-orange-300 p-1 text-[13px] font-medium text-center w-40 rounded shadow-inner"
                    />
                  ) : (
                    <div className="text-[13px] font-medium leading-tight">{outdoorUnitB1B2Data.label3}</div>
                  )}
                </div>
              </div>

              {/* Unit 4 & Label */}
              <div className="flex flex-col items-center">
                <div className="w-28 h-12 border-2 border-[#0066CC] flex items-center justify-center font-bold text-xl bg-white shadow-sm">
                  4
                </div>
                <div className="mt-2 text-center">
                  {isOutdoorUnitEditMode ? (
                    <input
                      type="text"
                      value={outdoorUnitB1B2Data.label4}
                      onChange={(e) => handleOutdoorUnitB1B2Change('label4', e.target.value)}
                      className="border border-orange-300 p-1 text-[13px] font-medium text-center w-40 rounded shadow-inner"
                    />
                  ) : (
                    <div className="text-[13px] font-medium leading-tight">{outdoorUnitB1B2Data.label4}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOutdoorUnitContent = () => {
    switch (activeOutdoorUnitSubTab) {
      case 'rooftop':
        return renderOutdoorUnitRooftopContent();
      case 'outside_1f':
        return renderOutdoorUnitOutside1FContent();
      case 'garden_1f':
        return renderOutdoorUnitGarden1FContent();
      case 'b2_b3':
        return renderOutdoorUnitB1B2Content();
      default:
        return (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                {SUB_TABS_OUTDOOR_UNIT.find(t => t.id === activeOutdoorUnitSubTab)?.label}
              </h2>
              <p className="text-gray-500">이 메뉴는 현재 준비 중입니다.</p>
            </div>
          </div>
        );
    }
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

        {activeTab === 'outdoor_unit' && (
          <div className="flex flex-col items-center space-y-2">
            <div className="bg-white w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black shrink-0">
              <div className="flex shrink-0">
                {SUB_TABS_OUTDOOR_UNIT.map(subTab => (
                  <div 
                    key={subTab.id}
                    onClick={() => setActiveOutdoorUnitSubTab(subTab.id)} 
                    className={`relative px-4 py-3 flex items-center text-[14px] font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${activeOutdoorUnitSubTab === subTab.id ? 'text-orange-600' : 'text-gray-500 hover:text-black'}`}
                  >
                    {subTab.label}
                    {activeOutdoorUnitSubTab === subTab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center px-2 shrink-0">
                <div className="h-6 w-[1px] bg-black" />
              </div>
              
              <div className="flex items-center shrink-0">
                <button 
                  onClick={handleOutdoorUnitRefresh} 
                  disabled={loading}
                  className="shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent disabled:opacity-50 text-gray-500 hover:text-black transition-colors whitespace-nowrap relative"
                >
                  <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                  새로고침
                </button>
                <button 
                  onClick={() => setIsOutdoorUnitEditMode(!isOutdoorUnitEditMode)} 
                  disabled={loading}
                  className={`shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent transition-all whitespace-nowrap relative disabled:opacity-50 ${
                    isOutdoorUnitEditMode ? 'text-orange-600' : 'text-gray-500 hover:text-black'
                  }`}
                >
                  {isOutdoorUnitEditMode ? <Lock size={18} className="mr-1.5" /> : <Edit2 size={18} className="mr-1.5" />}
                  {isOutdoorUnitEditMode ? '수정완료' : '수정'}
                  {isOutdoorUnitEditMode && <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />}
                </button>
                <button 
                  onClick={handleOutdoorUnitSave} 
                  disabled={loading} 
                  className={`shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent transition-colors whitespace-nowrap disabled:opacity-50 relative ${
                    outdoorUnitSaveSuccess ? 'text-orange-600' : 'text-gray-500 hover:text-black'
                  }`}
                >
                  {loading ? (
                    <RefreshCw size={18} className="animate-spin mr-1.5" />
                  ) : outdoorUnitSaveSuccess ? (
                    <CheckCircle size={18} className="mr-1.5" />
                  ) : (
                    <Save size={18} className="mr-1.5" />
                  )}
                  {outdoorUnitSaveSuccess ? '저장완료' : '저장'}
                </button>
                <button 
                  onClick={handleOutdoorUnitPrint} 
                  disabled={loading}
                  className="shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent text-gray-500 hover:text-black transition-colors whitespace-nowrap relative disabled:opacity-50"
                >
                  <Printer size={18} className="mr-1.5" />
                  인쇄
                </button>
              </div>
            </div>

            <div className="w-full mt-4">
              {renderOutdoorUnitContent()}
            </div>
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
