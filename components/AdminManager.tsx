import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Trash2, Save, Loader2, CheckCircle2, Paperclip, Download, FileText, 
  RefreshCw, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Printer, Edit
} from 'lucide-react';
import { 
  fetchAutoRegSettings, 
  saveAutoRegSettings, 
  fetchArchiveSettings, 
  saveArchiveSettings,
  fetchNetworkSettings,
  saveNetworkSettings,
  fetchPasswordSettings,
  savePasswordSettings,
  uploadArchiveFile,
  generateUUID,
  fetchStaffList,
  fetchUniformSettings,
  saveUniformSettings,
  fetchOutdoorUnitSettings,
  saveOutdoorUnitSettings,
  fetchEmergencySettings,
  saveEmergencySettings
} from '../services/dataService';
import { AutoRegRow, ArchiveItem, OutdoorUnitRooftopItem } from '../types';

const TABS = [
  { id: 'auto_reg', label: '자동등록' },
  { id: 'form', label: '자료실' },
  { id: 'network', label: '네트워크' },
  { id: 'password', label: '비밀번호' },
  { id: 'uniform', label: '근무복' },
  { id: 'outdoor_unit', label: '실외기' },
  { id: 'emergency', label: '비상연락망' },
];

const SUB_TABS_AUTO_REG = [
  { id: 'elec', label: '전기' },
  { id: 'mech', label: '기계' },
  { id: 'fire', label: '소방' },
  { id: 'elevator', label: '승강기' },
  { id: 'parking', label: '주차' },
  { id: 'security', label: '경비' },
  { id: 'cleaning', label: '미화' },
];

const SUB_TABS_NETWORK = [
  { id: 'general', label: '일반설정' },
  { id: 'pc_nas', label: '개인PC/NAS' },
  { id: 'router', label: '공유기' },
];

const SUB_TABS_PASSWORD = [
  { id: 'site', label: '사이트' },
  { id: 'building', label: '사옥' },
  { id: 'warehouse', label: '창고' },
];

const SUB_TABS_OUTDOOR_UNIT = [
  { id: 'rooftop', label: '옥상' },
  { id: 'outside_1f', label: '1F건물외곽' },
  { id: 'garden_1f', label: '1F화단' },
  { id: 'b2_b3', label: 'B2F주차장' },
];

const SUB_TABS_ARCHIVE = [
  { id: 'all', label: '전체' },
  { id: 'elec', label: '전기' },
  { id: 'mech', label: '기계' },
  { id: 'fire', label: '소방' },
  { id: 'elevator', label: '승강기' },
  { id: 'parking', label: '주차' },
  { id: 'form', label: '양식' },
  { id: 'etc', label: '기타' },
];

const SUB_TABS_UNIFORM = [
  { id: 'all', label: '전체' },
  { id: 'facilities', label: '시설' },
  { id: 'security', label: '경비' },
  { id: 'cleaning', label: '미화' },
];

const SUB_TABS_EMERGENCY = [
  { id: 'all', label: '전체' },
  { id: 'saemaul', label: '새마을' },
  { id: 'dispatch', label: '용역' },
  { id: 'facility', label: '시설' },
  { id: 'security', label: '경비' },
  { id: 'cleaning', label: '미화' },
  { id: 'tenant', label: '입주사' },
];

const AdminManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('auto_reg');
  const [activeSubTab, setActiveSubTab] = useState('elec');
  const [activeArchiveSubTab, setActiveArchiveSubTab] = useState('all');
  const [activeUniformSubTab, setActiveUniformSubTab] = useState('all');
  const [activeNetworkSubTab, setActiveNetworkSubTab] = useState('general');
  const [networkGeneralData, setNetworkGeneralData] = useState<any[]>([
    { id: '1', category: 'IP 주소(PC)', ipAddress: '', gateway: '', primaryDns: '', secondaryDns: '' }
  ]);
  const [pcNasData, setPcNasData] = useState<any[]>([
    { id: '1', category: '', ipAddress: '', loginId: '', loginPw: '', note: '' }
  ]);
  const [routerData, setRouterData] = useState<any[]>([
    { id: '1', category: '', ipAddress: '', loginId: '', loginPw: '', note: '' }
  ]);
  const [activePasswordSubTab, setActivePasswordSubTab] = useState('site');
  const [passwordSiteData, setPasswordSiteData] = useState<any[]>([
    { id: '1', category: '', siteName: '', url: '', loginId: '', loginPw: '', note: '' }
  ]);
  const [passwordBuildingData, setPasswordBuildingData] = useState<any[]>([
    { id: '1', category: '', deviceName: '', ipAddress: '', loginId: '', loginPw: '', note: '' }
  ]);
  const [passwordWarehouseData, setPasswordWarehouseData] = useState<any[]>([
    { id: '1', category: '', deviceName: '', ipAddress: '', loginId: '', loginPw: '', note: '' }
  ]);
  const [uniformData, setUniformData] = useState<any[]>([
    { id: '1', category: '', position: '', name: '', winterTop: '', winterBottom: '', summerTop: '', summerBottom: '', note: '' },
    { id: '2', category: '', position: '', name: '', winterTop: '', winterBottom: '', summerTop: '', summerBottom: '', note: '' },
    { id: '3', category: '', position: '', name: '', winterTop: '', winterBottom: '', summerTop: '', summerBottom: '', note: '' },
    { id: '4', category: '', position: '', name: '', winterTop: '', winterBottom: '', summerTop: '', summerBottom: '', note: '' },
    { id: '5', category: '', position: '', name: '', winterTop: '', winterBottom: '', summerTop: '', summerBottom: '', note: '' },
    { id: '6', category: '', position: '', name: '', winterTop: '', winterBottom: '', summerTop: '', summerBottom: '', note: '' },
    { id: '7', category: '', position: '', name: '', winterTop: '', winterBottom: '', summerTop: '', summerBottom: '', note: '' },
  ]);
  const [isPasswordEditMode, setIsPasswordEditMode] = useState(false);
  const [isUniformEditMode, setIsUniformEditMode] = useState(false);
  const [uniformSaveSuccess, setUniformSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isNetworkEditMode, setIsNetworkEditMode] = useState(false);
  const [isOutdoorUnitEditMode, setIsOutdoorUnitEditMode] = useState(false);
  const [activeOutdoorUnitSubTab, setActiveOutdoorUnitSubTab] = useState('rooftop');
  const [activeEmergencySubTab, setActiveEmergencySubTab] = useState('all');
  const [isEmergencyEditMode, setIsEmergencyEditMode] = useState(false);
  const [emergencySaveSuccess, setEmergencySaveSuccess] = useState(false);
  const [emergencyData, setEmergencyData] = useState<any[]>([
    { id: '1', category: '새마을', position: '', name: '', location: '', extensionNumber: '', phone: '' }
  ]);

  const handleOutdoorUnitRefresh = async () => {
    const data = await fetchOutdoorUnitSettings();
    if (data) {
      if (data.rooftop) setOutdoorUnitRooftopData(data.rooftop);
      if (data.outside1F) setOutdoorUnitOutside1FData(data.outside1F);
      if (data.garden1F) setOutdoorUnitGarden1FData(data.garden1F);
      if (data.b1b2) setOutdoorUnitB1B2Data(data.b1b2);
    } else {
      // If no data in DB, we could optionally reset to defaults here 
      // but usually the initial state already has defaults.
    }
  };

  const handleOutdoorUnitSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const success = await saveOutdoorUnitSettings({
        rooftop: outdoorUnitRooftopData,
        outside1F: outdoorUnitOutside1FData,
        garden1F: outdoorUnitGarden1FData,
        b1b2: outdoorUnitB1B2Data
      });
      
      if (success) {
        setSaveSuccess(true);
        alert('실외기 설정이 저장되었습니다.');
        setIsOutdoorUnitEditMode(false);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Outdoor unit save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'outdoor_unit') {
      handleOutdoorUnitRefresh();
    }
  }, [activeTab]);

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

  const handleOutdoorUnitRooftopChange = (id: string, value: string) => {
    setOutdoorUnitRooftopData(prev => prev.map(item => item.id === id ? { ...item, label: value } : item));
  };

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

  const handleOutdoorUnitOutside1FChange = (id: string, value: string) => {
    setOutdoorUnitOutside1FData(prev => prev.map(item => item.id === id ? { ...item, label: value } : item));
  };

  const [outdoorUnitGarden1FData, setOutdoorUnitGarden1FData] = useState<Record<string, string>>({
    label1: '삼성 /\n1F/ 매머드커\n피',
    label234: '삼성 / B1F / 이가마루',
    label5: '삼성 / B1F / 티엠에너지',
  });

  const handleOutdoorUnitGarden1FChange = (key: string, value: string) => {
    setOutdoorUnitGarden1FData(prev => ({ ...prev, [key]: value }));
  };

  const [outdoorUnitB1B2Data, setOutdoorUnitB1B2Data] = useState<Record<string, string>>({
    label1: '캐리어 / B2F / 식당',
    label2: 'LG / B1F / 매점',
    label3: 'LG / B2F / 식당',
    label4: 'LG / B2F / 경비',
    label5: '캐리어 / B2F / 미화',
  });

  const handleOutdoorUnitB1B2Change = (key: string, value: string) => {
    setOutdoorUnitB1B2Data(prev => ({ ...prev, [key]: value }));
  };
  
  // State for rows per sub-tab
  const [rowsData, setRowsData] = useState<Record<string, AutoRegRow[]>>({
    elec: [],
    mech: [],
    fire: [],
    elevator: [],
    parking: [],
    security: [],
    cleaning: [],
  });

  const [archiveRows, setArchiveRows] = useState<ArchiveItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch data from Supabase when activeSubTab changes
  const handleNetworkPrint = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>네트워크 설정 인쇄</title>
          <style>
            @page { 
              size: A4; 
              margin: 0; 
            }
            body { 
              font-family: "Malgun Gothic", sans-serif; 
              background-color: black; 
              color: black; 
              padding: 0;
              margin: 0;
              -webkit-print-color-adjust: exact;
            }
            .no-print {
              display: flex;
              justify-content: center;
              padding: 20px;
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
              .print-page { box-shadow: none !important; margin: 0 !important; }
            }
            .print-page {
              width: 210mm;
              min-height: 297mm;
              padding: 15mm 10mm;
              margin: 20px auto;
              background-color: white;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
              box-sizing: border-box;
            }
            h1 { 
              text-align: center; 
              font-size: 24pt; 
              margin-bottom: 20px; 
              font-weight: 900;
              border-bottom: 2px solid black;
              padding-bottom: 10px;
            }
            h2 { 
              font-size: 14pt; 
              margin-top: 25px; 
              margin-bottom: 10px; 
              font-weight: bold;
              border-left: 5px solid black;
              padding-left: 10px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px; 
            }
            th, td { 
              border: 1px solid black; 
              padding: 8px 4px; 
              text-align: center; 
              font-size: 10pt; 
              height: 35px;
            }
            th { 
              background-color: white; 
              color: black;
              font-weight: normal;
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="print-btn" onclick="window.print()">인쇄하기</button>
          </div>
          <div class="print-page">
            <h1>네트워크 설정 현황</h1>
            
            <h2>1. 일반설정</h2>
            <table>
              <thead>
                <tr>
                  <th style="width: 20%;">구 분</th>
                  <th style="width: 20%;">IP Address</th>
                  <th style="width: 20%;">기본게이트웨이</th>
                  <th style="width: 20%;">기본DNS서버</th>
                  <th style="width: 20%;">보조DNS서버</th>
                </tr>
              </thead>
              <tbody>
                ${networkGeneralData.map(row => `
                  <tr>
                    <td>${row.category || ''}</td>
                    <td>${row.ipAddress || ''}</td>
                    <td>${row.gateway || ''}</td>
                    <td>${row.primaryDns || ''}</td>
                    <td>${row.secondaryDns || ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <h2>2. 개인PC / NAS</h2>
            <table>
              <thead>
                <tr>
                  <th style="width: 20%;">구분</th>
                  <th style="width: 20%;">IP Address</th>
                  <th style="width: 20%;">ID</th>
                  <th style="width: 20%;">PW</th>
                  <th style="width: 20%;">비고</th>
                </tr>
              </thead>
              <tbody>
                ${pcNasData.map(row => `
                  <tr>
                    <td>${row.category || ''}</td>
                    <td>${row.ipAddress || ''}</td>
                    <td>${row.loginId || ''}</td>
                    <td>${row.loginPw || ''}</td>
                    <td>${row.note || ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <h2>3. 공유기 설정</h2>
            <table>
              <thead>
                <tr>
                  <th style="width: 20%;">구분</th>
                  <th style="width: 20%;">IP Address</th>
                  <th style="width: 20%;">ID</th>
                  <th style="width: 20%;">PW</th>
                  <th style="width: 20%;">비고</th>
                </tr>
              </thead>
              <tbody>
                ${routerData.map(row => `
                  <tr>
                    <td>${row.category || ''}</td>
                    <td>${row.ipAddress || ''}</td>
                    <td>${row.loginId || ''}</td>
                    <td>${row.loginPw || ''}</td>
                    <td>${row.note || ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePasswordPrint = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>비밀번호 설정 인쇄</title>
          <style>
            @page { 
              size: A4; 
              margin: 0; 
            }
            body { 
              font-family: "Malgun Gothic", sans-serif; 
              background-color: black; 
              color: black; 
              padding: 0;
              margin: 0;
              -webkit-print-color-adjust: exact;
            }
            .no-print {
              display: flex;
              justify-content: center;
              padding: 20px;
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
              .print-page { box-shadow: none !important; margin: 0 !important; }
            }
            .print-page {
              width: 210mm;
              min-height: 297mm;
              padding: 15mm 10mm;
              margin: 20px auto;
              background-color: white;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
              box-sizing: border-box;
            }
            h1 { 
              text-align: center; 
              font-size: 24pt; 
              margin-bottom: 20px; 
              font-weight: 900;
              border-bottom: 2px solid black;
              padding-bottom: 10px;
            }
            h2 { 
              font-size: 14pt; 
              margin-top: 25px; 
              margin-bottom: 10px; 
              font-weight: bold;
              border-left: 5px solid black;
              padding-left: 10px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px; 
            }
            th, td { 
              border: 1px solid black; 
              padding: 8px 4px; 
              text-align: center; 
              font-size: 11px; 
              height: 35px;
            }
            th { 
              background-color: white; 
              color: black;
              font-weight: normal;
            }
            .flex-row {
              display: flex;
              gap: 20px;
              margin-top: 25px;
            }
            .flex-col {
              flex: 1;
            }
            .flex-col h2 {
              margin-top: 0;
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="print-btn" onclick="window.print()">인쇄하기</button>
          </div>
          <div class="print-page">
            <h1>비밀번호 관리 현황</h1>
            
            <h2>1. 사이트</h2>
            <table>
              <thead>
                <tr>
                  <th style="width: 15%;">구분</th>
                  <th style="width: 20%;">사이트명</th>
                  <th style="width: 25%;">URL</th>
                  <th style="width: 15%;">ID</th>
                  <th style="width: 15%;">PW</th>
                  <th style="width: 10%;">비고</th>
                </tr>
              </thead>
              <tbody>
                ${passwordSiteData.map(row => `
                  <tr>
                    <td>${row.category || ''}</td>
                    <td>${row.siteName || ''}</td>
                    <td style="text-align: left; font-size: 8pt; word-break: break-all;">${row.url || ''}</td>
                    <td>${row.loginId || ''}</td>
                    <td>${row.loginPw || ''}</td>
                    <td>${row.note || ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="flex-row">
              <div class="flex-col">
                <h2>2. 사옥</h2>
                <table>
                  <thead>
                    <tr>
                      <th style="width: 30%;">구분</th>
                      <th style="width: 35%;">PW</th>
                      <th style="width: 35%;">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${passwordBuildingData.map(row => `
                      <tr>
                        <td>${row.category || ''}</td>
                        <td>${row.loginPw || ''}</td>
                        <td>${row.note || ''}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>

              <div class="flex-col">
                <h2>3. 창고</h2>
                <table>
                  <thead>
                    <tr>
                      <th style="width: 30%;">구분</th>
                      <th style="width: 35%;">PW</th>
                      <th style="width: 35%;">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${passwordWarehouseData.map(row => `
                      <tr>
                        <td>${row.category || ''}</td>
                        <td>${row.loginPw || ''}</td>
                        <td>${row.note || ''}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
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

  const loadEmergencyDataWithStaff = useCallback(async () => {
    setIsLoading(true);
    try {
      const [staffListRaw, savedEmergency] = await Promise.all([
        fetchStaffList(),
        fetchEmergencySettings()
      ]);
      
      // Filter out resigned staff
      const staffList = staffListRaw.filter(s => !s.resignDate || s.resignDate.trim() === '');
      
      const savedRows = savedEmergency || [];
      
      // Separate non-linked categories (새마을, 용역 등)
      const nonLinkedData = savedRows.filter((r: any) => 
        !['시설', '경비', '미화'].includes(r.category)
      );

      // Facility (현장대리인 + 시설)
      const facilityStaff = staffList.filter(s => s.category === '현장대리인' || s.category === '시설');
      const facilityRows = facilityStaff.map(staff => {
        const saved = savedRows.find((r: any) => r.name === staff.name && (r.category === '시설' || r.category === '현장대리인'));
        return {
          id: staff.id,
          category: '시설',
          position: staff.jobTitle,
          name: staff.name,
          location: saved ? saved.location : '',
          extensionNumber: saved ? saved.extensionNumber : '',
          phone: staff.phone
        };
      });

      // Security
      const securityStaff = staffList.filter(s => s.category === '경비');
      const securityRows = securityStaff.map(staff => {
        const saved = savedRows.find((r: any) => r.name === staff.name && r.category === '경비');
        return {
          id: staff.id,
          category: '경비',
          position: staff.jobTitle,
          name: staff.name,
          location: saved ? saved.location : '',
          extensionNumber: saved ? saved.extensionNumber : '',
          phone: staff.phone
        };
      });

      // Cleaning
      const cleaningStaff = staffList.filter(s => s.category === '미화');
      const cleaningRows = cleaningStaff.map(staff => {
        const saved = savedRows.find((r: any) => r.name === staff.name && r.category === '미화');
        return {
          id: staff.id,
          category: '미화',
          position: staff.jobTitle,
          name: staff.name,
          location: saved ? saved.location : '',
          extensionNumber: saved ? saved.extensionNumber : '',
          phone: staff.phone
        };
      });

      setEmergencyData([...nonLinkedData, ...facilityRows, ...securityRows, ...cleaningRows]);
    } catch (error) {
      console.error('Failed to load emergency data with staff:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'auto_reg') {
        const data = await fetchAutoRegSettings(activeSubTab);
        // data is now the direct array of AutoRegRow objects from system_settings
        const mappedRows = data.map(item => ({
          id: item.id,
          item: item.item || item.item_name || '', // Handle both old and new formats
          mon: !!item.mon,
          tue: !!item.tue,
          wed: !!item.wed,
          thu: !!item.thu,
          fri: !!item.fri,
          sat: !!item.sat,
          sun: !!item.sun,
          excludeHolidays: !!(item.excludeHolidays || item.exclude_holidays)
        }));
        
        setRowsData(prev => ({
          ...prev,
          [activeSubTab]: mappedRows.length > 0 ? mappedRows : [{ id: '1', item: '', mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false, excludeHolidays: false }]
        }));
      } else if (activeTab === 'form') {
        const data = await fetchArchiveSettings();
        setArchiveRows(data.length > 0 ? data : [{ id: '1', category: '', title: '', date: '', attachment: '' }]);
      } else if (activeTab === 'network') {
        const [general, pcNas, router] = await Promise.all([
          fetchNetworkSettings('general'),
          fetchNetworkSettings('pc_nas'),
          fetchNetworkSettings('router')
        ]);
        if (general.length > 0) setNetworkGeneralData(general);
        if (pcNas.length > 0) setPcNasData(pcNas);
        if (router.length > 0) setRouterData(router);
      } else if (activeTab === 'password') {
        const [site, building, warehouse] = await Promise.all([
          fetchPasswordSettings('site'),
          fetchPasswordSettings('building'),
          fetchPasswordSettings('warehouse')
        ]);
        if (site.length > 0) setPasswordSiteData(site);
        if (building.length > 0) setPasswordBuildingData(building);
        if (warehouse.length > 0) setPasswordWarehouseData(warehouse);
      } else if (activeTab === 'emergency') {
        loadEmergencyDataWithStaff();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, activeSubTab, loadEmergencyDataWithStaff]);

  useEffect(() => {
    if (activeTab === 'auto_reg' || activeTab === 'form' || activeTab === 'network' || activeTab === 'password' || activeTab === 'emergency') {
      loadData();
    }

    if (activeTab === 'network') {
      setIsNetworkEditMode(false);
    }
    if (activeTab === 'password') {
      setIsPasswordEditMode(false);
    }

    const handleArchiveUpdate = () => {
      if (activeTab === 'form') {
        loadData();
      }
    };

    window.addEventListener('archive-updated', handleArchiveUpdate);
    return () => window.removeEventListener('archive-updated', handleArchiveUpdate);
  }, [activeTab, activeNetworkSubTab, activePasswordSubTab, loadData]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      let success = false;
      if (activeTab === 'auto_reg') {
        success = await saveAutoRegSettings(activeSubTab, rowsData[activeSubTab]);
      } else if (activeTab === 'form') {
        success = await saveArchiveSettings(archiveRows);
      } else if (activeTab === 'network') {
        let dataToSave = [];
        if (activeNetworkSubTab === 'general') dataToSave = networkGeneralData;
        else if (activeNetworkSubTab === 'pc_nas') dataToSave = pcNasData;
        else if (activeNetworkSubTab === 'router') dataToSave = routerData;
        
        success = await saveNetworkSettings(activeNetworkSubTab, dataToSave);
      } else if (activeTab === 'password') {
        let dataToSave = [];
        if (activePasswordSubTab === 'site') dataToSave = passwordSiteData;
        else if (activePasswordSubTab === 'building') dataToSave = passwordBuildingData;
        else if (activePasswordSubTab === 'warehouse') dataToSave = passwordWarehouseData;
        
        success = await savePasswordSettings(activePasswordSubTab, dataToSave);
      }
      
      if (success) {
        setSaveSuccess(true);
        alert('저장되었습니다.');
        if (activeTab === 'network') {
          setIsNetworkEditMode(false);
        }
        if (activeTab === 'password') {
          setIsPasswordEditMode(false);
        }
        loadData(); // Refresh data to get correct IDs from DB
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, [activeTab, activeSubTab, activeNetworkSubTab, activePasswordSubTab, rowsData, archiveRows, networkGeneralData, pcNasData, routerData, passwordSiteData, passwordBuildingData, passwordWarehouseData, loadData]);

  const handleAddRow = () => {
    if (activeTab === 'auto_reg') {
      const newRow: AutoRegRow = {
        id: Date.now().toString(),
        item: '',
        mon: false,
        tue: false,
        wed: false,
        thu: false,
        fri: false,
        sat: false,
        sun: false,
        excludeHolidays: false,
      };
      setRowsData(prev => ({
        ...prev,
        [activeSubTab]: [...prev[activeSubTab], newRow]
      }));
    } else if (activeTab === 'form') {
      // 자료실 등록은 독립창(새 창)으로 수행
      const width = 600;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      window.open(
        `${window.location.origin}${window.location.pathname}?popup=archive_reg`,
        'ArchiveRegistration',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );
    } else if (activeTab === 'network') {
      const newRow = { id: Date.now().toString(), category: '', ipAddress: '', loginId: '', loginPw: '', note: '' };
      if (activeNetworkSubTab === 'pc_nas') {
        setPcNasData(prev => [...prev, newRow]);
      } else if (activeNetworkSubTab === 'router') {
        setRouterData(prev => [...prev, newRow]);
      }
    } else if (activeTab === 'password') {
      if (activePasswordSubTab === 'site') {
        const newRow = { id: generateUUID(), category: '', siteName: '', url: '', loginId: '', loginPw: '', note: '' };
        setPasswordSiteData(prev => [...prev, newRow]);
      } else if (activePasswordSubTab === 'building') {
        const newRow = { id: generateUUID(), category: '', deviceName: '', ipAddress: '', loginId: '', loginPw: '', note: '' };
        setPasswordBuildingData(prev => [...prev, newRow]);
      } else if (activePasswordSubTab === 'warehouse') {
        const newRow = { id: generateUUID(), category: '', deviceName: '', ipAddress: '', loginId: '', loginPw: '', note: '' };
        setPasswordWarehouseData(prev => [...prev, newRow]);
      }
    } else if (activeTab === 'emergency') {
      const categoryMap: Record<string, string> = {
        saemaul: '새마을',
        dispatch: '용역',
        facility: '시설',
        security: '경비',
        cleaning: '미화',
        tenant: '입주사'
      };
      const newRow = { 
        id: generateUUID(), 
        category: activeEmergencySubTab !== 'all' ? categoryMap[activeEmergencySubTab] : '', 
        position: '', 
        name: '', 
        location: '', 
        extensionNumber: '', 
        phone: '',
        employeeCount: '' 
      };
      setEmergencyData(prev => [...prev, newRow]);
    }
  };

  const handleDeleteRow = (id: string) => {
    if (activeTab === 'auto_reg') {
      setRowsData(prev => ({
        ...prev,
        [activeSubTab]: prev[activeSubTab].filter(row => row.id !== id)
      }));
    } else if (activeTab === 'form') {
      setArchiveRows(prev => prev.filter(row => row.id !== id));
    } else if (activeTab === 'emergency') {
      setEmergencyData(prev => prev.filter(row => row.id !== id));
    }
  };

  const handleUpdateRow = (id: string, field: string, value: any) => {
    if (activeTab === 'auto_reg') {
      setRowsData(prev => ({
        ...prev,
        [activeSubTab]: prev[activeSubTab].map(row => 
          row.id === id ? { ...row, [field]: value } : row
        )
      }));
    } else if (activeTab === 'form') {
      setArchiveRows(prev => prev.map(row => 
        row.id === id ? { ...row, [field]: value } : row
      ));
    }
  };

  const handleFileChange = async (id: string, file: File) => {
    setIsLoading(true);
    try {
      const result = await uploadArchiveFile(file);
      if (result) {
        handleUpdateRow(id, 'attachment', result.url);
        handleUpdateRow(id, 'fileName', file.name);
        alert('파일이 업로드되었습니다.');
      } else {
        alert('파일 업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('File upload error:', error);
      alert('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileDownload = async (url: string, title: string, originalFileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      
      // 원본 파일명에서 확장자 추출
      let extension = '';
      const parts = originalFileName.split('.');
      if (parts.length > 1) {
        extension = `.${parts.pop()}`;
      } else {
        // URL에서 확장자 추출 시도
        const urlParts = url.split('.');
        if (urlParts.length > 1) {
          extension = `.${urlParts.pop()?.split('?')[0]}`;
        }
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      // 제목을 파일명으로 설정
      link.download = `${title}${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download error:', error);
      // 실패 시 기본 브라우저 다운로드/열기 시도
      window.open(url, '_blank');
    }
  };

  const renderPagination = (totalItems: number) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
      <div className="flex justify-center items-center gap-2 mt-6 mb-10 select-none">
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className={`p-2 transition-all active:scale-90 ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-black cursor-pointer'}`}
        >
          <ChevronLeft size={18} />
        </button>

        {pageNumbers.map(number => (
          <button
            key={number}
            onClick={() => setCurrentPage(number)}
            className={`w-9 h-9 flex items-center justify-center transition-all active:scale-90 border-none rounded-none bg-transparent shadow-none ${
              currentPage === number 
                ? 'text-black font-bold scale-110 cursor-default' 
                : 'text-black font-normal cursor-pointer'
            }`}
          >
            {number}
          </button>
        ))}

        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className={`p-2 transition-all active:scale-90 ${currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-black cursor-pointer'}`}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    );
  };

  const handleEditArchive = (id: string) => {
    const width = 600;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    window.open(
      `${window.location.origin}${window.location.pathname}?popup=archive_reg&id=${id}`,
      'ArchiveRegistration',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };

  const renderArchiveTable = () => {
    const filteredRows = archiveRows.filter(row => {
      const matchesSearch = row.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           row.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const categoryMap: Record<string, string> = {
        all: '전체',
        elec: '전기',
        mech: '기계',
        fire: '소방',
        elevator: '승강기',
        parking: '주차',
        form: '양식',
        etc: '기타'
      };
      
      const targetCategory = categoryMap[activeArchiveSubTab];
      const matchesTab = activeArchiveSubTab === 'all' ? true : row.category === targetCategory;
      
      return matchesSearch && matchesTab;
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredRows.slice(indexOfFirstItem, indexOfLastItem);

    return (
      <div className="w-full max-w-7xl mx-auto relative">
        <div className="overflow-x-auto">
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
              <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          )}
          <table className="w-full border-collapse border border-black text-center bg-white">
            <thead>
              <tr className="h-[40px] bg-white">
                <th className="border border-black text-[13px] font-normal px-2 w-[60px]">No</th>
                <th className="border border-black text-[13px] font-normal px-2 w-[120px]">구분</th>
                <th className="border border-black text-[13px] font-normal px-2 w-[350px]">제목</th>
                <th className="border border-black text-[13px] font-normal px-2 w-[150px]">등록일</th>
                <th className="border border-black text-[13px] font-normal px-2 w-[250px]">첨부</th>
                <th className="border border-black text-[13px] font-normal px-2 w-[80px]">관리</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((row, index) => (
                <tr key={row.id} className="h-[40px] border-b border-black">
                  <td className="border border-black text-[13px] font-normal px-2">
                    <div className="flex items-center justify-center h-full">{indexOfFirstItem + index + 1}</div>
                  </td>
                  <td className="border border-black text-[13px] font-normal px-2">
                    <div className="flex items-center justify-center h-full text-[13px] font-normal">
                      {row.category}
                    </div>
                  </td>
                  <td className="border border-black text-[13px] font-normal px-2">
                    <div className="flex items-center justify-start h-full text-[13px] font-normal">
                      {row.title}
                    </div>
                  </td>
                  <td className="border border-black text-[13px] font-normal px-2">
                    <div className="flex items-center justify-center h-full text-[13px] font-normal">
                      {row.date}
                    </div>
                  </td>
                  <td className="border border-black text-[13px] font-normal px-2">
                    <div className="flex items-center justify-center h-full gap-2">
                      {row.attachment ? (
                        <button 
                          onClick={() => handleFileDownload(row.attachment!, row.title, row.fileName || '파일')}
                          className="text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer"
                          title={row.fileName || '다운로드'}
                        >
                          <Download size={16} />
                          <span className="text-[11px] truncate max-w-[60px]">{row.fileName || '파일'}</span>
                        </button>
                      ) : (
                        <label className="cursor-pointer text-gray-400 hover:text-blue-600 transition-colors">
                          <Paperclip size={16} />
                          <input 
                            type="file" 
                            className="hidden" 
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleFileChange(row.id, e.target.files[0]);
                              }
                            }}
                            accept=".pdf,.xlsx,.xls,.hwp,.doc,.docx"
                          />
                        </label>
                      )}
                    </div>
                  </td>
                  <td className="border border-black text-[13px] font-normal px-2">
                    <div className="flex items-center justify-center h-full gap-2">
                      <button 
                        onClick={() => handleEditArchive(row.id)}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                        title="수정"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm('정말 삭제하시겠습니까?')) {
                            handleDeleteRow(row.id);
                          }
                        }}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {currentItems.length === 0 && (
                <tr className="h-[100px]">
                  <td colSpan={6} className="border border-black text-gray-400">데이터가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {renderPagination(filteredRows.length)}
      </div>
    );
  };

  const renderAutoRegTable = () => {
    const rows = rowsData[activeSubTab] || [];
    
    return (
      <div className="w-full max-w-7xl mx-auto overflow-x-auto relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        )}
        <table className="w-full border-collapse border border-black text-center bg-white">
          <thead>
            <tr className="h-[40px] bg-white">
              <th className="border border-black text-[13px] font-normal px-2 w-[50px]">NO</th>
              <th className="border border-black text-[13px] font-normal px-2">항목</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[70px]">월요일</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[70px]">화요일</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[70px]">수요일</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[70px]">목요일</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[70px]">금요일</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[70px]">토요일</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[70px]">일요일</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[80px]">공휴일제외</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[60px]">관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="h-[40px] border-b border-black">
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center justify-center h-full">{index + 1}</div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center h-full">
                    <input 
                      type="text" 
                      value={row.item}
                      onChange={(e) => handleUpdateRow(row.id, 'item', e.target.value)}
                      className="w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal"
                      placeholder="항목 입력"
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center justify-center h-full">
                    <input 
                      type="checkbox" 
                      checked={row.mon}
                      onChange={(e) => handleUpdateRow(row.id, 'mon', e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center justify-center h-full">
                    <input 
                      type="checkbox" 
                      checked={row.tue}
                      onChange={(e) => handleUpdateRow(row.id, 'tue', e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center justify-center h-full">
                    <input 
                      type="checkbox" 
                      checked={row.wed}
                      onChange={(e) => handleUpdateRow(row.id, 'wed', e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center justify-center h-full">
                    <input 
                      type="checkbox" 
                      checked={row.thu}
                      onChange={(e) => handleUpdateRow(row.id, 'thu', e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center justify-center h-full">
                    <input 
                      type="checkbox" 
                      checked={row.fri}
                      onChange={(e) => handleUpdateRow(row.id, 'fri', e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center justify-center h-full">
                    <input 
                      type="checkbox" 
                      checked={row.sat}
                      onChange={(e) => handleUpdateRow(row.id, 'sat', e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center justify-center h-full">
                    <input 
                      type="checkbox" 
                      checked={row.sun}
                      onChange={(e) => handleUpdateRow(row.id, 'sun', e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center justify-center h-full">
                    <input 
                      type="checkbox" 
                      checked={row.excludeHolidays}
                      onChange={(e) => handleUpdateRow(row.id, 'excludeHolidays', e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center justify-center h-full">
                    <button 
                      onClick={() => handleDeleteRow(row.id)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-between items-center">
          <div className="text-[12px] text-gray-500">
            * 각 요일별로 자동 등록될 항목을 설정하세요.
          </div>
        </div>
      </div>
    );
  };

  const renderNetworkGeneralTable = () => {
    return (
      <div className="w-full max-w-7xl mx-auto overflow-x-auto relative">
        <table className="w-full border-collapse border border-black text-center bg-white">
          <thead>
            <tr className="h-[40px] bg-white">
              <th className="border border-black text-[13px] font-normal px-2 w-1/5">구 분</th>
              <th className="border border-black text-[13px] font-normal px-2 w-1/5">IP Addres</th>
              <th className="border border-black text-[13px] font-normal px-2 w-1/5">기본게이트웨이</th>
              <th className="border border-black text-[13px] font-normal px-2 w-1/5">기본DNS서버</th>
              <th className="border border-black text-[13px] font-normal px-2 w-1/5">보조DNS서버</th>
            </tr>
          </thead>
          <tbody>
            {networkGeneralData.map((row) => (
              <tr key={row.id} className="h-[40px] border-b border-black">
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center justify-center h-full">
                    {row.category}
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center h-full">
                    <input 
                      type="text" 
                      value={row.ipAddress}
                      onChange={(e) => setNetworkGeneralData(prev => prev.map(r => r.id === row.id ? { ...r, ipAddress: e.target.value } : r))}
                      readOnly={!isNetworkEditMode}
                      className={`w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal ${!isNetworkEditMode ? 'cursor-default' : ''}`}
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center h-full">
                    <input 
                      type="text" 
                      value={row.gateway}
                      onChange={(e) => setNetworkGeneralData(prev => prev.map(r => r.id === row.id ? { ...r, gateway: e.target.value } : r))}
                      readOnly={!isNetworkEditMode}
                      className={`w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal ${!isNetworkEditMode ? 'cursor-default' : ''}`}
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center h-full">
                    <input 
                      type="text" 
                      value={row.primaryDns}
                      onChange={(e) => setNetworkGeneralData(prev => prev.map(r => r.id === row.id ? { ...r, primaryDns: e.target.value } : r))}
                      readOnly={!isNetworkEditMode}
                      className={`w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal ${!isNetworkEditMode ? 'cursor-default' : ''}`}
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center h-full">
                    <input 
                      type="text" 
                      value={row.secondaryDns}
                      onChange={(e) => setNetworkGeneralData(prev => prev.map(r => r.id === row.id ? { ...r, secondaryDns: e.target.value } : r))}
                      readOnly={!isNetworkEditMode}
                      className={`w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal ${!isNetworkEditMode ? 'cursor-default' : ''}`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderNetworkDeviceTable = (data: any[], setData: React.Dispatch<React.SetStateAction<any[]>>) => {
    return (
      <div className="w-full max-w-7xl mx-auto overflow-x-auto relative">
        <table className="w-full border-collapse border border-black text-center bg-white">
          <thead>
            <tr className="h-[40px] bg-white">
              <th className="border border-black text-[13px] font-normal px-2">구분</th>
              <th className="border border-black text-[13px] font-normal px-2">IP Addres</th>
              <th className="border border-black text-[13px] font-normal px-2">ID</th>
              <th className="border border-black text-[13px] font-normal px-2">PW</th>
              <th className="border border-black text-[13px] font-normal px-2">비고</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="h-[40px] border-b border-black">
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center h-full">
                    <input 
                      type="text" 
                      value={row.category}
                      onChange={(e) => setData(prev => prev.map(r => r.id === row.id ? { ...r, category: e.target.value } : r))}
                      readOnly={!isNetworkEditMode}
                      className={`w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal ${!isNetworkEditMode ? 'cursor-default' : ''}`}
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center h-full">
                    <input 
                      type="text" 
                      value={row.ipAddress}
                      onChange={(e) => setData(prev => prev.map(r => r.id === row.id ? { ...r, ipAddress: e.target.value } : r))}
                      readOnly={!isNetworkEditMode}
                      className={`w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal ${!isNetworkEditMode ? 'cursor-default' : ''}`}
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center h-full">
                    <input 
                      type="text" 
                      value={row.loginId}
                      onChange={(e) => setData(prev => prev.map(r => r.id === row.id ? { ...r, loginId: e.target.value } : r))}
                      readOnly={!isNetworkEditMode}
                      className={`w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal ${!isNetworkEditMode ? 'cursor-default' : ''}`}
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center h-full">
                    <input 
                      type="text" 
                      value={row.loginPw}
                      onChange={(e) => setData(prev => prev.map(r => r.id === row.id ? { ...r, loginPw: e.target.value } : r))}
                      readOnly={!isNetworkEditMode}
                      className={`w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal ${!isNetworkEditMode ? 'cursor-default' : ''}`}
                    />
                  </div>
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <div className="flex items-center h-full">
                    <input 
                      type="text" 
                      value={row.note}
                      onChange={(e) => setData(prev => prev.map(r => r.id === row.id ? { ...r, note: e.target.value } : r))}
                      readOnly={!isNetworkEditMode}
                      className={`w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal ${!isNetworkEditMode ? 'cursor-default' : ''}`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderNetworkContent = () => {
    if (activeNetworkSubTab === 'general') {
      return renderNetworkGeneralTable();
    } else if (activeNetworkSubTab === 'pc_nas') {
      return renderNetworkDeviceTable(pcNasData, setPcNasData);
    } else if (activeNetworkSubTab === 'router') {
      return renderNetworkDeviceTable(routerData, setRouterData);
    }
    return null;
  };

  const renderPasswordSiteTable = () => {
    return (
      <div className="w-full overflow-x-auto relative">
        <table className="w-full border-collapse border border-black text-center bg-white">
          <thead>
            <tr className="h-[40px] bg-white">
              <th className="border border-black text-[13px] font-normal px-2 w-[16.6%]">구분</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[16.6%]">사이트명</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[16.6%]">URL</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[16.6%]">ID</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[16.6%]">PW</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[16.6%]">관리</th>
            </tr>
          </thead>
          <tbody>
            {passwordSiteData.map((row, index) => (
              <tr key={row.id} className="h-[40px] border-b border-black">
                <td className="border border-black text-[13px] font-normal px-2">
                  <input 
                    type="text" 
                    value={row.category}
                    onChange={(e) => setPasswordSiteData(prev => prev.map(r => r.id === row.id ? { ...r, category: e.target.value } : r))}
                    readOnly={!isPasswordEditMode}
                    className={`w-full bg-transparent border-none outline-none text-center ${!isPasswordEditMode ? 'cursor-default' : ''}`}
                  />
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <input 
                    type="text" 
                    value={row.siteName}
                    onChange={(e) => setPasswordSiteData(prev => prev.map(r => r.id === row.id ? { ...r, siteName: e.target.value } : r))}
                    readOnly={!isPasswordEditMode}
                    className={`w-full bg-transparent border-none outline-none text-center ${!isPasswordEditMode ? 'cursor-default' : ''}`}
                  />
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <input 
                    type="text" 
                    value={row.url}
                    onChange={(e) => setPasswordSiteData(prev => prev.map(r => r.id === row.id ? { ...r, url: e.target.value } : r))}
                    readOnly={!isPasswordEditMode}
                    className={`w-full bg-transparent border-none outline-none text-center ${!isPasswordEditMode ? 'cursor-default' : ''}`}
                  />
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <input 
                    type="text" 
                    value={row.loginId}
                    onChange={(e) => setPasswordSiteData(prev => prev.map(r => r.id === row.id ? { ...r, loginId: e.target.value } : r))}
                    readOnly={!isPasswordEditMode}
                    className={`w-full bg-transparent border-none outline-none text-center ${!isPasswordEditMode ? 'cursor-default' : ''}`}
                  />
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <input 
                    type="text" 
                    value={row.loginPw}
                    onChange={(e) => setPasswordSiteData(prev => prev.map(r => r.id === row.id ? { ...r, loginPw: e.target.value } : r))}
                    readOnly={!isPasswordEditMode}
                    className={`w-full bg-transparent border-none outline-none text-center ${!isPasswordEditMode ? 'cursor-default' : ''}`}
                  />
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <button onClick={() => setPasswordSiteData(prev => prev.filter(r => r.id !== row.id))} className="text-red-500 hover:text-red-700 mx-auto block">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPasswordDeviceTable = (data: any[], setData: React.Dispatch<React.SetStateAction<any[]>>) => {
    const pairs = [];
    for (let i = 0; i < data.length; i += 2) {
      pairs.push([data[i], data[i + 1]]);
    }

    return (
      <div className="w-full overflow-x-auto relative">
        <table className="w-full border-collapse border border-black text-center bg-white">
          <thead>
            <tr className="h-[40px] bg-white">
              <th className="border border-black text-[13px] font-normal px-2 w-[12.5%]">구분</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[12.5%]">PW</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[12.5%]">비고</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[12.5%]">관리</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[12.5%]">구분</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[12.5%]">PW</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[12.5%]">비고</th>
              <th className="border border-black text-[13px] font-normal px-2 w-[12.5%]">관리</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((pair, pairIndex) => (
              <tr key={pairIndex} className="h-[40px] border-b border-black">
                {/* Left Column Set */}
                <td className="border border-black text-[13px] font-normal px-2">
                  <input 
                    type="text" 
                    value={pair[0].category}
                    onChange={(e) => setData(prev => prev.map(r => r.id === pair[0].id ? { ...r, category: e.target.value } : r))}
                    readOnly={!isPasswordEditMode}
                    className={`w-full bg-transparent border-none outline-none text-center ${!isPasswordEditMode ? 'cursor-default' : ''}`}
                  />
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <input 
                    type="text" 
                    value={pair[0].loginPw}
                    onChange={(e) => setData(prev => prev.map(r => r.id === pair[0].id ? { ...r, loginPw: e.target.value } : r))}
                    readOnly={!isPasswordEditMode}
                    className={`w-full bg-transparent border-none outline-none text-center ${!isPasswordEditMode ? 'cursor-default' : ''}`}
                  />
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <input 
                    type="text" 
                    value={pair[0].note}
                    onChange={(e) => setData(prev => prev.map(r => r.id === pair[0].id ? { ...r, note: e.target.value } : r))}
                    readOnly={!isPasswordEditMode}
                    className={`w-full bg-transparent border-none outline-none text-center ${!isPasswordEditMode ? 'cursor-default' : ''}`}
                  />
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <button onClick={() => setData(prev => prev.filter(r => r.id !== pair[0].id))} className="text-red-500 hover:text-red-700 mx-auto block">
                    <Trash2 size={16} />
                  </button>
                </td>

                {/* Right Column Set */}
                {pair[1] ? (
                  <>
                    <td className="border border-black text-[13px] font-normal px-2">
                      <input 
                        type="text" 
                        value={pair[1].category}
                        onChange={(e) => setData(prev => prev.map(r => r.id === pair[1].id ? { ...r, category: e.target.value } : r))}
                        readOnly={!isPasswordEditMode}
                        className={`w-full bg-transparent border-none outline-none text-center ${!isPasswordEditMode ? 'cursor-default' : ''}`}
                      />
                    </td>
                    <td className="border border-black text-[13px] font-normal px-2">
                      <input 
                        type="text" 
                        value={pair[1].loginPw}
                        onChange={(e) => setData(prev => prev.map(r => r.id === pair[1].id ? { ...r, loginPw: e.target.value } : r))}
                        readOnly={!isPasswordEditMode}
                        className={`w-full bg-transparent border-none outline-none text-center ${!isPasswordEditMode ? 'cursor-default' : ''}`}
                      />
                    </td>
                    <td className="border border-black text-[13px] font-normal px-2">
                      <input 
                        type="text" 
                        value={pair[1].note}
                        onChange={(e) => setData(prev => prev.map(r => r.id === pair[1].id ? { ...r, note: e.target.value } : r))}
                        readOnly={!isPasswordEditMode}
                        className={`w-full bg-transparent border-none outline-none text-center ${!isPasswordEditMode ? 'cursor-default' : ''}`}
                      />
                    </td>
                    <td className="border border-black text-[13px] font-normal px-2">
                      <button onClick={() => setData(prev => prev.filter(r => r.id !== pair[1].id))} className="text-red-500 hover:text-red-700 mx-auto block">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="border border-black px-2"></td>
                    <td className="border border-black px-2"></td>
                    <td className="border border-black px-2"></td>
                    <td className="border border-black px-2"></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const handleUniformAddRow = () => {
    setUniformData(prev => [
      ...prev,
      { id: Date.now().toString(), category: '', position: '', name: '', winterTop: '', winterBottom: '', summerTop: '', summerBottom: '', note: '' }
    ]);
  };

  const handleUniformChange = (id: string, field: string, value: string) => {
    setUniformData(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const loadUniformDataWithStaff = useCallback(async () => {
    try {
      const [staffList, savedUniforms] = await Promise.all([
        fetchStaffList(),
        fetchUniformSettings()
      ]);
      // Exclude those with a resignDate (퇴사일)
      const activeStaff = staffList.filter(s => !s.resignDate || s.resignDate.trim() === '');
      
      const getCategoryOrder = (cat?: string) => {
        if (!cat) return 99;
        if (cat.includes('현장대리인')) return 1;
        if (cat.includes('시설')) return 2;
        if (cat.includes('경비')) return 3;
        if (cat.includes('미화')) return 4;
        return 99;
      };

      const getPositionOrder = (pos?: string) => {
        if (!pos) return 99;
        if (pos.includes('과장')) return 1;
        if (pos.includes('대리')) return 2;
        if (pos.includes('주임') || pos.includes('반장')) return 3;
        if (pos.includes('기사')) return 4;
        if (pos.includes('대원A') || pos.includes('경비A')) return 5;
        if (pos.includes('대원B') || pos.includes('경비B')) return 6;
        if (pos.includes('대원') || pos.includes('경비')) return 7;
        if (pos.includes('미화')) return 8;
        return 99;
      };

      activeStaff.sort((a, b) => {
        const catA = getCategoryOrder(a.category);
        const catB = getCategoryOrder(b.category);
        if (catA !== catB) return catA - catB;

        const posA = getPositionOrder(a.jobTitle);
        const posB = getPositionOrder(b.jobTitle);
        return posA - posB;
      });

      // Update uniform data but preserve existing typed data if possible
      setUniformData(() => {
        return activeStaff.map(staff => {
          const saved = savedUniforms.find((p: any) => p.id === staff.id);
          return {
            id: staff.id,
            category: staff.category || '',
            position: staff.jobTitle || '',
            name: staff.name || '',
            winterTop: saved ? saved.winterTop : '',
            winterBottom: saved ? saved.winterBottom : '',
            summerTop: saved ? saved.summerTop : '',
            summerBottom: saved ? saved.summerBottom : '',
            note: saved ? saved.note : ''
          };
        });
      });
    } catch (error) {
      console.error("Failed to load staff list for uniform", error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'uniform') {
      loadUniformDataWithStaff();
    }
  }, [activeTab, loadUniformDataWithStaff]);

  const handleUniformSave = async () => {
    setIsSaving(true);
    try {
      const success = await saveUniformSettings(uniformData);
      if (success) {
        setUniformSaveSuccess(true);
        setTimeout(() => setUniformSaveSuccess(false), 3000);
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (e) {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmergencyPrint = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;

    const printContent = document.querySelector('.print-page');
    if (!printContent) {
      printWindow.close();
      return;
    }

    const title = SUB_TABS_EMERGENCY.find(t => t.id === activeEmergencySubTab)?.label || '비상연락망';

    const html = `
      <html>
        <head>
          <title>${title} 비상연락망 인쇄</title>
          <style>
            @page { 
              size: A4 portrait; 
              margin: 15mm 10mm; 
            }
            body { 
              font-family: "Malgun Gothic", sans-serif; 
              background-color: black; 
              color: black; 
              padding: 0;
              margin: 0;
              -webkit-print-color-adjust: exact;
            }
            .no-print {
              display: flex;
              justify-content: center;
              padding: 20px;
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
              .print-page { 
                box-shadow: none !important; 
                margin: 0 !important; 
                padding: 0 !important;
                min-height: auto !important;
              }
            }
            .print-page {
              width: 210mm;
              min-height: 297mm;
              padding: 15mm 10mm;
              margin: 20px auto;
              background-color: white;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
              box-sizing: border-box;
            }
            h1 { 
              text-align: center; 
              font-size: 24pt; 
              margin-bottom: 20px; 
              font-weight: 900;
              border-bottom: 2px solid black;
              padding-bottom: 10px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px; 
            }
            th, td { 
              border: 1px solid black; 
              padding: 4px 4px; 
              text-align: center; 
              font-size: 10pt; 
              height: 35px;
            }
            th { 
              background-color: white !important; 
              color: black;
            }
            input {
              width: 100%;
              text-align: center;
              border: none;
              background: transparent;
              font-size: 10pt;
            }
            /* Enforce specific widths for print as previously requested */
            table th:nth-child(1) { width: 80px !important; }
            table th:nth-child(2) { width: 150px !important; }
            table th:nth-child(3) { width: 100px !important; }
            table th:nth-child(4) { width: 100px !important; }
            table th:nth-child(5) { width: 100px !important; }
            .group-hover\\:opacity-100 {
              display: none !important; /* Hide delete buttons */
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="print-btn" onclick="window.print()">인쇄하기</button>
          </div>
          <div class="print-page">
            <h1>${title} 비상연락망</h1>
            ${printContent.innerHTML.replace(/<button[^>]*>.*?<\/button>/gi, '')}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleUniformPrint = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;

    const filteredData = uniformData.filter(row => {
      if (activeUniformSubTab === 'all') {
        const categories = ['시설', '경비', '미화', '현장대리인'];
        return categories.includes(row.category);
      }
      const categoryMap: Record<string, string> = {
        facilities: '시설',
        security: '경비',
        cleaning: '미화'
      };
      const targetCategory = categoryMap[activeUniformSubTab];
      
      if (activeUniformSubTab === 'facilities') {
        return row.category === '시설' || row.category === '현장대리인';
      }
      
      return row.category === targetCategory;
    });

    const html = `
      <html>
        <head>
          <title>${activeUniformSubTab === 'all' ? '전체' : (activeUniformSubTab === 'facilities' ? '시설' : (activeUniformSubTab === 'security' ? '경비' : '미화'))} 근무복 현황 인쇄</title>
          <style>
            @page { 
              size: A4 portrait; 
              margin: 0; 
            }
            body { 
              font-family: "Malgun Gothic", sans-serif; 
              background-color: black; 
              color: black; 
              padding: 0;
              margin: 0;
              -webkit-print-color-adjust: exact;
            }
            .no-print {
              display: flex;
              justify-content: center;
              padding: 20px;
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
              .print-page { box-shadow: none !important; margin: 0 !important; }
            }
            .print-page {
              width: 210mm;
              min-height: 297mm;
              padding: 15mm 10mm;
              margin: 20px auto;
              background-color: white;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
              box-sizing: border-box;
            }
            h1 { 
              text-align: center; 
              font-size: 24pt; 
              margin-bottom: 20px; 
              font-weight: 900;
              border-bottom: 2px solid black;
              padding-bottom: 10px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px; 
            }
            th, td { 
              border: 1px solid black; 
              padding: 8px 4px; 
              text-align: center; 
              font-size: 12px; 
              height: 35px;
            }
            th { 
              background-color: white; 
              color: black;
              font-weight: normal;
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="print-btn" onclick="window.print()">인쇄하기</button>
          </div>
          <div class="print-page">
            <h1>새마을운동중앙회 대치동사옥 근무복 현황 (${activeUniformSubTab === 'all' ? '전체' : (activeUniformSubTab === 'facilities' ? '시설' : (activeUniformSubTab === 'security' ? '경비' : '미화'))})</h1>
            <table>
              <thead>
                <tr>
                  <th rowspan="2" style="width: 10%;">구 분</th>
                  <th rowspan="2" style="width: 10%;">직 책</th>
                  <th rowspan="2" style="width: 12%;">성 명</th>
                  <th colspan="2" style="width: 24%;">동 계</th>
                  <th colspan="2" style="width: 24%;">하 계</th>
                  <th rowspan="2" style="width: 20%;">비 고</th>
                </tr>
                <tr>
                  <th style="width: 12%;">상 의</th>
                  <th style="width: 12%;">하 의</th>
                  <th style="width: 12%;">상 의</th>
                  <th style="width: 12%;">하 의</th>
                </tr>
              </thead>
              <tbody>
                ${filteredData.map(row => `
                  <tr>
                    <td>${row.category || ''}</td>
                    <td>${row.position || ''}</td>
                    <td>${row.name || ''}</td>
                    <td>${row.winterTop || ''}</td>
                    <td>${row.winterBottom || ''}</td>
                    <td>${row.summerTop || ''}</td>
                    <td>${row.summerBottom || ''}</td>
                    <td>${row.note || ''}</td>
                  </tr>
                `).join('')}
                ${filteredData.length === 0 ? '<tr><td colspan="8">데이터가 없습니다.</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const renderPasswordContent = () => {
    if (activePasswordSubTab === 'site') {
      return renderPasswordSiteTable();
    } else if (activePasswordSubTab === 'building') {
      return renderPasswordDeviceTable(passwordBuildingData, setPasswordBuildingData);
    } else if (activePasswordSubTab === 'warehouse') {
      return renderPasswordDeviceTable(passwordWarehouseData, setPasswordWarehouseData);
    }
    return null;
  };

  const renderOutdoorUnitRooftopContent = () => {
    const mainItems = outdoorUnitRooftopData.slice(0, 9);
    const bottomItems = outdoorUnitRooftopData.slice(9, 14);
    const lastItem = outdoorUnitRooftopData[14];

    return (
      <div className="bg-white p-8 overflow-auto">
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
      <div className="bg-white p-8 overflow-auto">
        <div className="max-w-4xl mx-auto relative flex justify-center min-h-[750px]">
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
      <div className="bg-white p-8 overflow-auto">
        <div className="max-w-6xl mx-auto flex justify-between space-x-12 min-h-[600px]">
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
                <div className="flex items-end">
                  <div className="flex flex-col">
                    <div className="w-32 h-12 border-2 border-[#0066CC] flex items-center justify-center font-bold text-2xl bg-white shadow-sm">
                      2
                    </div>
                    <div className="w-32 h-12 border-2 border-[#0066CC] border-t-0 flex items-center justify-center font-bold text-2xl bg-white shadow-sm">
                      3
                    </div>
                  </div>
                  <div className="w-32 h-12 border-2 border-[#0066CC] flex items-center justify-center font-bold text-2xl bg-white shadow-sm mb-0 ml-4">
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

            <div className="flex-1 relative flex flex-col items-center justify-center p-8">
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
      <div className="bg-white p-8 overflow-auto">
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

  const handleEmergencyRefresh = async () => {
    await loadEmergencyDataWithStaff();
  };

  const handleEmergencySave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setEmergencySaveSuccess(false);
    try {
      const success = await saveEmergencySettings(emergencyData);
      if (success) {
        setEmergencySaveSuccess(true);
        setSaveSuccess(true);
        alert('저장되었습니다.');
        setIsEmergencyEditMode(false);
        setTimeout(() => {
          setEmergencySaveSuccess(false);
          setSaveSuccess(false);
        }, 3000);
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (e) {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderEmergencyContent = () => {
    const categorySortOrder: Record<string, number> = {
      '새마을': 1,
      '용역': 2,
      '시설': 3,
      '경비': 4,
      '미화': 5,
      '입주사': 6
    };

    const getPositionOrder = (category: string, position: string) => {
      const pos = position || '';
      if (category === '시설') {
        if (pos.includes('과장')) return 1;
        if (pos.includes('대리')) return 2;
        if (pos.includes('주임')) return 3;
        if (pos.includes('기사')) return 4;
      } else if (category === '경비') {
        if (pos.includes('반장')) return 1;
        if (pos.includes('대원A')) return 2;
        if (pos.includes('대원B')) return 3;
        if (pos.includes('대원')) return 4;
      } else if (category === '미화') {
        if (pos.includes('반장')) return 1;
        if (pos.includes('미화')) return 2;
      }
      return 99;
    };

    const parseFloor = (floorStr: string) => {
      if (!floorStr) return -999;
      const f = floorStr.toString().trim();
      if (f.startsWith('지하') || f.toUpperCase().startsWith('B')) {
        const num = parseInt(f.replace(/[^0-9]/g, '')) || 0;
        return -num;
      }
      return parseInt(f.replace(/[^0-9]/g, '')) || 0;
    };

    const filteredData = [...emergencyData]
      .filter(row => {
        if (activeEmergencySubTab === 'all') return row.category !== '입주사';
        const categoryMap: Record<string, string> = {
          saemaul: '새마을',
          dispatch: '용역',
          facility: '시설',
          security: '경비',
          cleaning: '미화',
          tenant: '입주사'
        };
        return row.category === categoryMap[activeEmergencySubTab];
      })
      .sort((a, b) => {
        // 입주사 전용 정렬: 층 내림차순 (10층 -> 지하2층)
        if (activeEmergencySubTab === 'tenant' || (a.category === '입주사' && b.category === '입주사')) {
          const floorA = parseFloor(a.location);
          const floorB = parseFloor(b.location);
          if (floorA !== floorB) return floorB - floorA; 
          return (a.extensionNumber || '').localeCompare(b.extensionNumber || ''); 
        }

        // First level: Category order
        const orderA = categorySortOrder[a.category] || 99;
        const orderB = categorySortOrder[b.category] || 99;
        if (orderA !== orderB) return orderA - orderB;

        // Second level: Position order
        const posOrderA = getPositionOrder(a.category, a.position);
        const posOrderB = getPositionOrder(b.category, b.position);
        return posOrderA - posOrderB;
      });

    if (activeEmergencySubTab === 'tenant') {
      return (
        <div className="w-full max-w-7xl mx-auto bg-white mt-4 overflow-x-auto print-page">
          <table className="w-full text-center border border-black border-collapse">
            <thead>
              <tr className="h-[40px] bg-white">
                <th className="border border-black font-normal text-[14px] px-2 w-[80px]" style={{ width: '80px' }}>층</th>
                <th className="border border-black font-normal text-[14px] px-2 w-[200px]" style={{ width: '200px' }}>회사명</th>
                <th className="border border-black font-normal text-[14px] px-2 w-[150px]" style={{ width: '150px' }}>직책</th>
                <th className="border border-black font-normal text-[14px] px-2 w-[150px]" style={{ width: '150px' }}>성명</th>
                <th className="border border-black font-normal text-[14px] px-2 w-[150px]" style={{ width: '150px' }}>근무인원</th>
                <th className="border border-black font-normal text-[14px] px-2">전화번호</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => (
                <tr key={row.id} className="h-[40px] border-b border-black">
                  <td className="border border-black text-[13px] font-normal px-2">
                    <input 
                      type="text" 
                      value={row.location}
                      onChange={(e) => setEmergencyData(prev => prev.map(r => r.id === row.id ? { ...r, location: e.target.value } : r))}
                      readOnly={!isEmergencyEditMode}
                      className={`w-full text-center focus:outline-none ${isEmergencyEditMode ? 'bg-orange-50' : 'bg-transparent'}`}
                    />
                  </td>
                  <td className="border border-black text-[13px] font-normal px-2">
                    <input 
                      type="text" 
                      value={row.extensionNumber}
                      onChange={(e) => setEmergencyData(prev => prev.map(r => r.id === row.id ? { ...r, extensionNumber: e.target.value } : r))}
                      readOnly={!isEmergencyEditMode}
                      className={`w-full text-center focus:outline-none ${isEmergencyEditMode ? 'bg-orange-50' : 'bg-transparent'}`}
                      placeholder={isEmergencyEditMode ? "회사명" : ""}
                    />
                  </td>
                  <td className="border border-black text-[13px] font-normal px-2">
                    <input 
                      type="text" 
                      value={row.position}
                      onChange={(e) => setEmergencyData(prev => prev.map(r => r.id === row.id ? { ...r, position: e.target.value } : r))}
                      readOnly={!isEmergencyEditMode}
                      className={`w-full text-center focus:outline-none ${isEmergencyEditMode ? 'bg-orange-50' : 'bg-transparent'}`}
                    />
                  </td>
                  <td className="border border-black text-[13px] font-normal px-2">
                    <input 
                      type="text" 
                      value={row.name}
                      onChange={(e) => setEmergencyData(prev => prev.map(r => r.id === row.id ? { ...r, name: e.target.value } : r))}
                      readOnly={!isEmergencyEditMode}
                      className={`w-full text-center focus:outline-none ${isEmergencyEditMode ? 'bg-orange-50' : 'bg-transparent'}`}
                    />
                  </td>
                  <td className="border border-black text-[13px] font-normal px-2">
                    <input 
                      type="text" 
                      value={row.employeeCount || ''}
                      onChange={(e) => setEmergencyData(prev => prev.map(r => r.id === row.id ? { ...r, employeeCount: e.target.value } : r))}
                      readOnly={!isEmergencyEditMode}
                      className={`w-full text-center focus:outline-none ${isEmergencyEditMode ? 'bg-orange-50' : 'bg-transparent'}`}
                    />
                  </td>
                  <td className="border border-black text-[13px] font-normal px-2 relative group">
                    <input 
                      type="text" 
                      value={row.phone}
                      onChange={(e) => setEmergencyData(prev => prev.map(r => r.id === row.id ? { ...r, phone: e.target.value } : r))}
                      readOnly={!isEmergencyEditMode}
                      className={`w-full text-center focus:outline-none ${isEmergencyEditMode ? 'bg-orange-50' : 'bg-transparent'}`}
                    />
                    {isEmergencyEditMode && (
                      <button 
                        onClick={() => handleDeleteRow(row.id)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded"
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr className="h-[100px]">
                  <td colSpan={6} className="border border-black text-gray-400">데이터가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="w-full max-w-7xl mx-auto bg-white mt-4 overflow-x-auto print-page">
        <table className="w-full text-center border border-black border-collapse">
          <thead>
            <tr className="h-[40px] bg-white">
              <th className="border border-black font-normal text-[14px] px-2 w-[100px]">구분</th>
              <th className="border border-black font-normal text-[14px] px-2 w-[120px]">직책</th>
              <th className="border border-black font-normal text-[14px] px-2 w-[120px]">성명</th>
              <th className="border border-black font-normal text-[14px] px-2 w-[120px]">위치</th>
              <th className="border border-black font-normal text-[14px] px-2">구내번호</th>
              <th className="border border-black font-normal text-[14px] px-2">핸드폰</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row) => (
              <tr key={row.id} className="h-[40px] border-b border-black">
                <td className="border border-black text-[13px] font-normal px-2 relative group">
                  <input 
                    type="text" 
                    value={row.category}
                    onChange={(e) => setEmergencyData(prev => prev.map(r => r.id === row.id ? { ...r, category: e.target.value } : r))}
                    readOnly={!isEmergencyEditMode}
                    className={`w-full bg-transparent border-none outline-none text-center ${!isEmergencyEditMode ? 'cursor-default' : ''}`}
                  />
                  {isEmergencyEditMode && (
                    <button 
                      onClick={() => handleDeleteRow(row.id)}
                      className="absolute left-1 top-1/2 -translate-y-1/2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <input 
                    type="text" 
                    value={row.position}
                    onChange={(e) => setEmergencyData(prev => prev.map(r => r.id === row.id ? { ...r, position: e.target.value } : r))}
                    readOnly={!isEmergencyEditMode}
                    className={`w-full bg-transparent border-none outline-none text-center ${!isEmergencyEditMode ? 'cursor-default' : ''}`}
                  />
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <input 
                    type="text" 
                    value={row.name}
                    onChange={(e) => setEmergencyData(prev => prev.map(r => r.id === row.id ? { ...r, name: e.target.value } : r))}
                    readOnly={!isEmergencyEditMode}
                    className={`w-full bg-transparent border-none outline-none text-center ${!isEmergencyEditMode ? 'cursor-default' : ''}`}
                  />
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <input 
                    type="text" 
                    value={row.location}
                    onChange={(e) => setEmergencyData(prev => prev.map(r => r.id === row.id ? { ...r, location: e.target.value } : r))}
                    readOnly={!isEmergencyEditMode}
                    className={`w-full bg-transparent border-none outline-none text-center ${!isEmergencyEditMode ? 'cursor-default' : ''}`}
                  />
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <input 
                    type="text" 
                    value={row.extensionNumber}
                    onChange={(e) => setEmergencyData(prev => prev.map(r => r.id === row.id ? { ...r, extensionNumber: e.target.value } : r))}
                    readOnly={!isEmergencyEditMode}
                    className={`w-full bg-transparent border-none outline-none text-center ${!isEmergencyEditMode ? 'cursor-default' : ''}`}
                  />
                </td>
                <td className="border border-black text-[13px] font-normal px-2">
                  <input 
                    type="text" 
                    value={row.phone}
                    onChange={(e) => setEmergencyData(prev => prev.map(r => r.id === row.id ? { ...r, phone: e.target.value } : r))}
                    readOnly={!isEmergencyEditMode}
                    className={`w-full bg-transparent border-none outline-none text-center ${!isEmergencyEditMode ? 'cursor-default' : ''}`}
                  />
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr className="h-[40px]">
                <td colSpan={6} className="border border-black text-[13px] text-gray-400">데이터가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderUniformContent = () => {
    const filteredData = uniformData.filter(row => {
      if (activeUniformSubTab === 'all') return true;
      const categoryMap: Record<string, string> = {
        facilities: '시설',
        security: '경비',
        cleaning: '미화'
      };
      const targetCategory = categoryMap[activeUniformSubTab];
      
      if (activeUniformSubTab === 'facilities') {
        return row.category === '시설' || row.category === '현장대리인';
      }
      
      return row.category === targetCategory;
    });

    return (
      <div className="w-full max-w-7xl mx-auto bg-white mt-4 overflow-x-auto print-page">
        <table className="w-full text-center border border-black border-collapse">
          <thead>
            <tr className="border-b border-black">
              <th rowSpan={2} className="border border-black font-normal text-[13px] px-2 w-[80px] h-[40px]">구 분</th>
              <th rowSpan={2} className="border border-black font-normal text-[13px] px-2 w-[80px]">직 책</th>
              <th rowSpan={2} className="border border-black font-normal text-[13px] px-2 w-[80px]">성 명</th>
              <th colSpan={2} className="border border-black font-normal text-[13px] px-2 h-[40px]">동 계</th>
              <th colSpan={2} className="border border-black font-normal text-[13px] px-2">하 계</th>
              <th rowSpan={2} className="border border-black font-normal text-[13px] px-2 w-[200px]">비 고</th>
            </tr>
            <tr className="border-b border-black">
              <th className="border border-black font-normal text-[13px] px-2 w-[120px] h-[40px]">상 의</th>
              <th className="border border-black font-normal text-[13px] px-2 w-[120px]">하 의</th>
              <th className="border border-black font-normal text-[13px] px-2 w-[120px]">상 의</th>
              <th className="border border-black font-normal text-[13px] px-2 w-[120px]">하 의</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row) => (
              <tr key={row.id} className="border-b border-black h-[40px]">
                <td className="border border-black p-0">
                  <div className="flex items-center justify-center h-full px-2">
                    <input
                      type="text"
                      value={row.category}
                      onChange={(e) => handleUniformChange(row.id, 'category', e.target.value)}
                      readOnly={!isUniformEditMode}
                      className="w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal text-center"
                    />
                  </div>
                </td>
                <td className="border border-black p-0">
                  <div className="flex items-center justify-center h-full px-2">
                    <input
                      type="text"
                      value={row.position}
                      onChange={(e) => handleUniformChange(row.id, 'position', e.target.value)}
                      readOnly={!isUniformEditMode}
                      className="w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal text-center"
                    />
                  </div>
                </td>
                <td className="border border-black p-0">
                  <div className="flex items-center justify-center h-full px-2">
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => handleUniformChange(row.id, 'name', e.target.value)}
                      readOnly={!isUniformEditMode}
                      className="w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal text-center"
                    />
                  </div>
                </td>
                <td className="border border-black p-0">
                  <div className="flex items-center justify-center h-full px-2">
                    <input
                      type="text"
                      value={row.winterTop}
                      onChange={(e) => handleUniformChange(row.id, 'winterTop', e.target.value)}
                      readOnly={!isUniformEditMode}
                      className="w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal text-center"
                    />
                  </div>
                </td>
                <td className="border border-black p-0">
                  <div className="flex items-center justify-center h-full px-2">
                    <input
                      type="text"
                      value={row.winterBottom}
                      onChange={(e) => handleUniformChange(row.id, 'winterBottom', e.target.value)}
                      readOnly={!isUniformEditMode}
                      className="w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal text-center"
                    />
                  </div>
                </td>
                <td className="border border-black p-0">
                  <div className="flex items-center justify-center h-full px-2">
                    <input
                      type="text"
                      value={row.summerTop}
                      onChange={(e) => handleUniformChange(row.id, 'summerTop', e.target.value)}
                      readOnly={!isUniformEditMode}
                      className="w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal text-center"
                    />
                  </div>
                </td>
                <td className="border border-black p-0">
                  <div className="flex items-center justify-center h-full px-2">
                    <input
                      type="text"
                      value={row.summerBottom}
                      onChange={(e) => handleUniformChange(row.id, 'summerBottom', e.target.value)}
                      readOnly={!isUniformEditMode}
                      className="w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal text-center"
                    />
                  </div>
                </td>
                <td className="border border-black p-0">
                  <div className="flex items-center justify-center h-full px-2">
                    <input
                      type="text"
                      value={row.note}
                      onChange={(e) => handleUniformChange(row.id, 'note', e.target.value)}
                      readOnly={!isUniformEditMode}
                      className="w-full bg-transparent border-none outline-none shadow-none appearance-none text-[13px] font-normal text-center"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-2 pb-32">
      {/* 메인탭메뉴 */}
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

        {/* 근무복 탭일 때만 표시되는 구분선과 버튼들 (서브탭 메뉴로 이동함) */}
        {activeTab === 'uniform' && (
          <div className="flex-1"></div>
        )}

        {/* 자료실 탭일 때만 표시되는 구분선과 등록 버튼 (서브탭 메뉴로 이동함) */}
        {activeTab === 'form' && (
          <div className="flex-1"></div>
        )}
      </div>

      {/* 서브탭메뉴 (근무복일 때만 표시) */}
      {activeTab === 'uniform' && (
        <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
          {/* 서브탭 */}
          <div className="flex items-stretch shrink-0">
            {SUB_TABS_UNIFORM.map(subTab => (
              <div
                key={subTab.id}
                onClick={() => setActiveUniformSubTab(subTab.id)}
                className={`flex items-center px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer ${
                  activeUniformSubTab === subTab.id 
                    ? 'text-orange-600' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {subTab.label}
                {activeUniformSubTab === subTab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
                )}
              </div>
            ))}
          </div>

          {/* 구분선 (검정색 1px) */}
          <div className="flex items-center shrink-0 px-2">
            <div className="w-px h-6 bg-black"></div>
          </div>

          {/* 액션 버튼들 */}
          <div className="flex items-stretch shrink-0">
            <button 
              onClick={loadUniformDataWithStaff}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
            >
              <RefreshCw size={18} className="mr-1.5" />
              새로고침
            </button>
            <button 
              onClick={() => setIsUniformEditMode(!isUniformEditMode)}
              className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap ${
                isUniformEditMode ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              <Edit size={18} className="mr-1.5" />
              {isUniformEditMode ? '수정완료' : '수정'}
            </button>
            <button 
              onClick={handleUniformSave}
              disabled={isSaving || uniformSaveSuccess}
              className={`flex items-center shrink-0 px-4 py-3 bg-transparent text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50 ${
                uniformSaveSuccess ? 'text-orange-600 font-extrabold' : 'text-gray-500 hover:text-black font-bold'
              }`}
            >
              {isSaving ? (
                <Loader2 size={18} className="mr-1.5 animate-spin" />
              ) : uniformSaveSuccess ? (
                <CheckCircle2 size={18} className="mr-1.5" />
              ) : (
                <Save size={18} className="mr-1.5" />
              )}
              {uniformSaveSuccess ? '저장완료' : '저장'}
            </button>
            <button 
              onClick={handleUniformPrint}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
            >
              <Printer size={18} className="mr-1.5" />
              인쇄
            </button>
          </div>
        </div>
      )}

      {/* 서브탭메뉴 (자료실일 때만 표시) */}
      {activeTab === 'form' && (
        <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
          {/* 검색창 */}
          <div className="flex items-center shrink-0 w-full sm:w-[250px]">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black" size={18} />
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="자료 검색..."
                className="w-full pl-10 pr-4 py-3 bg-white border-none rounded-none text-[14px] font-bold text-black outline-none transition-all"
              />
            </div>
          </div>

          {/* 구분선 (검정색 1px) */}
          <div className="flex items-center shrink-0 px-2">
            <div className="w-px h-6 bg-black"></div>
          </div>

          {/* 서브탭 */}
          <div className="flex items-stretch shrink-0">
            {SUB_TABS_ARCHIVE.map(subTab => (
              <div
                key={subTab.id}
                onClick={() => setActiveArchiveSubTab(subTab.id)}
                className={`flex items-center px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer ${
                  activeArchiveSubTab === subTab.id 
                    ? 'text-orange-600' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {subTab.label}
                {activeArchiveSubTab === subTab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
                )}
              </div>
            ))}
          </div>

          {/* 구분선 (검정색 1px) */}
          <div className="flex items-center shrink-0 px-2">
            <div className="w-px h-6 bg-black"></div>
          </div>

          {/* 액션 버튼들 */}
          <div className="flex items-stretch shrink-0">
            <button 
              onClick={loadData}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
            >
              <RefreshCw size={18} className="mr-1.5" />
              새로고침
            </button>

            <button 
              onClick={handleAddRow}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
            >
              <Plus size={18} className="mr-1.5" />
              등록
            </button>

            <button 
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50 ${
                saveSuccess ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              {isSaving ? (
                <Loader2 size={18} className="mr-1.5 animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle2 size={18} className="mr-1.5" />
              ) : (
                <Save size={18} className="mr-1.5" />
              )}
              {saveSuccess ? '저장완료' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* 서브탭메뉴 (자동등록일 때만 표시) */}
      {activeTab === 'auto_reg' && (
        <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
          <div className="flex items-center shrink-0">
            {SUB_TABS_AUTO_REG.map(subTab => (
              <div
                key={subTab.id}
                onClick={() => setActiveSubTab(subTab.id)}
                className={`px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer ${
                  activeSubTab === subTab.id 
                    ? 'text-orange-600' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {subTab.label}
                {activeSubTab === subTab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
                )}
              </div>
            ))}
          </div>

          {/* 구분선 (검정색 1px) */}
          <div className="flex items-center shrink-0 px-2">
            <div className="w-px h-6 bg-black"></div>
          </div>

          {/* 액션 버튼들 */}
          <div className="flex items-center shrink-0">
            <button 
              onClick={handleAddRow}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
            >
              <Plus size={18} className="mr-1.5" />
              행추가
            </button>
            
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50 ${
                saveSuccess ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              {isSaving ? (
                <Loader2 size={18} className="mr-1.5 animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle2 size={18} className="mr-1.5" />
              ) : (
                <Save size={18} className="mr-1.5" />
              )}
              {saveSuccess ? '저장완료' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* 서브탭메뉴 (네트워크일 때만 표시) */}
      {activeTab === 'network' && (
        <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
          <div className="flex items-center shrink-0">
            {SUB_TABS_NETWORK.map(subTab => (
              <div
                key={subTab.id}
                onClick={() => setActiveNetworkSubTab(subTab.id)}
                className={`px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer ${
                  activeNetworkSubTab === subTab.id 
                    ? 'text-orange-600' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {subTab.label}
                {activeNetworkSubTab === subTab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
                )}
              </div>
            ))}
          </div>

          {/* 구분선 (검정색 1px) */}
          <div className="flex items-center shrink-0 px-2">
            <div className="w-px h-6 bg-black"></div>
          </div>

          {/* 액션 버튼들 */}
          <div className="flex items-center shrink-0">
            {(activeTab !== 'network' || isNetworkEditMode) && (
              <button 
                onClick={handleAddRow}
                className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
              >
                <Plus size={18} className="mr-1.5" />
                {activeTab === 'form' ? '등록' : '행추가'}
              </button>
            )}

            {activeTab !== 'form' && (
              <button 
                onClick={() => {
                  if (activeTab === 'network') {
                    if (isNetworkEditMode) {
                      handleSave();
                    } else {
                      setIsNetworkEditMode(true);
                    }
                  }
                }}
                className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap ${
                  activeTab === 'network' && isNetworkEditMode ? 'text-orange-600' : 'text-gray-500 hover:text-black'
                }`}
              >
                <Edit size={18} className="mr-1.5" />
                {activeTab === 'network' && isNetworkEditMode ? '수정완료' : '수정'}
              </button>
            )}
            
            {activeTab !== 'form' && (activeTab !== 'network' || isNetworkEditMode) && (
              <button 
                onClick={handleSave}
                className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
              >
                <Save size={18} className="mr-1.5" />
                저장
              </button>
            )}

            <button 
              onClick={() => {
                if (activeTab === 'network') {
                  handleNetworkPrint();
                }
              }}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
            >
              <Printer size={18} className="mr-1.5" />
              인쇄
            </button>
          </div>
        </div>
      )}

      {/* 서브탭메뉴 (비밀번호일 때만 표시) */}
      {activeTab === 'password' && (
        <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
          <div className="flex items-center shrink-0">
            {SUB_TABS_PASSWORD.map(subTab => (
              <div
                key={subTab.id}
                onClick={() => setActivePasswordSubTab(subTab.id)}
                className={`px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer ${
                  activePasswordSubTab === subTab.id 
                    ? 'text-orange-600' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {subTab.label}
                {activePasswordSubTab === subTab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
                )}
              </div>
            ))}
          </div>

          {/* 구분선 (검정색 1px) */}
          <div className="flex items-center shrink-0 px-2">
            <div className="w-px h-6 bg-black"></div>
          </div>

          {/* 액션 버튼들 */}
          <div className="flex items-center shrink-0">
            {isPasswordEditMode && (
              <button 
                onClick={handleAddRow}
                className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
              >
                <Plus size={18} className="mr-1.5" />
                행추가
              </button>
            )}

            <button 
              onClick={() => {
                if (isPasswordEditMode) {
                  handleSave();
                } else {
                  setIsPasswordEditMode(true);
                }
              }}
              className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap ${
                isPasswordEditMode ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              <Edit size={18} className="mr-1.5" />
              {isPasswordEditMode ? '수정완료' : '수정'}
            </button>
            
            {isPasswordEditMode && (
              <button 
                onClick={handleSave}
                className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
              >
                <Save size={18} className="mr-1.5" />
                저장
              </button>
            )}

            <button 
              onClick={() => {
                if (activeTab === 'password') {
                  handlePasswordPrint();
                }
              }}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
            >
              <Printer size={18} className="mr-1.5" />
              인쇄
            </button>
          </div>
        </div>
      )}

      {/* 서브탭메뉴 (실외기일 때 표시) */}
      {activeTab === 'outdoor_unit' && (
        <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
          <div className="flex items-center shrink-0">
            {SUB_TABS_OUTDOOR_UNIT.map(subTab => (
              <div
                key={subTab.id}
                onClick={() => setActiveOutdoorUnitSubTab(subTab.id)}
                className={`px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer ${
                  activeOutdoorUnitSubTab === subTab.id 
                    ? 'text-orange-600' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {subTab.label}
                {activeOutdoorUnitSubTab === subTab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
                )}
              </div>
            ))}
          </div>

          {/* 구분선 (검정색 1px) */}
          <div className="flex items-center shrink-0 px-2">
            <div className="w-px h-6 bg-black"></div>
          </div>

          {/* 액션 버튼들 */}
          <div className="flex items-center shrink-0">
            <button 
              onClick={handleOutdoorUnitRefresh}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
            >
              <RefreshCw size={18} className="mr-1.5" />
              새로고침
            </button>
            <button 
              onClick={() => setIsOutdoorUnitEditMode(!isOutdoorUnitEditMode)}
              className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap ${
                isOutdoorUnitEditMode ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              <Edit size={18} className="mr-1.5" />
              {isOutdoorUnitEditMode ? '수정완료' : '수정'}
            </button>
            <button 
              onClick={handleOutdoorUnitSave} 
              disabled={isSaving}
              className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap ${
                saveSuccess ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              {isSaving ? (
                <Loader2 size={18} className="mr-1.5 animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle2 size={18} className="mr-1.5" />
              ) : (
                <Save size={18} className="mr-1.5" />
              )}
              {saveSuccess ? '저장완료' : '저장'}
            </button>
            <button 
              onClick={handleOutdoorUnitPrint}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
            >
              <Printer size={18} className="mr-1.5" />
              인쇄
            </button>
          </div>
        </div>
      )}

      {/* 서브탭메뉴 (비상연락망일 때 표시) */}
      {activeTab === 'emergency' && (
        <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
          {/* 서브탭 */}
          <div className="flex items-stretch shrink-0">
            {SUB_TABS_EMERGENCY.map(subTab => (
              <div
                key={subTab.id}
                onClick={() => setActiveEmergencySubTab(subTab.id)}
                className={`flex items-center px-4 py-3 text-[14px] font-bold whitespace-nowrap shrink-0 transition-all relative cursor-pointer ${
                  activeEmergencySubTab === subTab.id 
                    ? 'text-orange-600' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {subTab.label}
                {activeEmergencySubTab === subTab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
                )}
              </div>
            ))}
          </div>

          {/* 구분선 (검정색 1px) */}
          <div className="flex items-center shrink-0 px-2">
            <div className="w-px h-6 bg-black"></div>
          </div>

          {/* 액션 버튼들 */}
          <div className="flex items-stretch shrink-0">
            <button 
              onClick={handleAddRow}
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
            >
              <Plus size={18} className="mr-1.5" />
              연락처추가
            </button>
            <button 
              onClick={handleEmergencyRefresh} 
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
            >
              <RefreshCw size={18} className="mr-1.5" />
              새로고침
            </button>
            <button 
              onClick={() => setIsEmergencyEditMode(!isEmergencyEditMode)}
              className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap ${
                isEmergencyEditMode ? 'text-orange-600' : 'text-gray-500 hover:text-black'
              }`}
            >
              <Edit size={18} className="mr-1.5" />
              {isEmergencyEditMode ? '수정완료' : '수정'}
            </button>
            <button 
              onClick={handleEmergencySave} 
              disabled={isSaving}
              className={`flex items-center shrink-0 px-4 py-3 bg-transparent font-bold text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50 ${
                emergencySaveSuccess ? 'text-orange-600 font-extrabold' : 'text-gray-500 hover:text-black'
              }`}
            >
              {isSaving ? (
                <Loader2 size={18} className="mr-1.5 animate-spin" />
              ) : emergencySaveSuccess ? (
                <CheckCircle2 size={18} className="mr-1.5" />
              ) : (
                <Save size={18} className="mr-1.5" />
              )}
              {emergencySaveSuccess ? '저장완료' : '저장'}
            </button>
            <button 
              onClick={handleEmergencyPrint} 
              className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
            >
              <Printer size={18} className="mr-1.5" />
              인쇄
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="min-h-[400px]">
        {activeTab === 'auto_reg' ? (
          renderAutoRegTable()
        ) : activeTab === 'form' ? (
          renderArchiveTable()
        ) : activeTab === 'network' ? (
          renderNetworkContent()
        ) : activeTab === 'password' ? (
          renderPasswordContent()
        ) : activeTab === 'uniform' ? (
          renderUniformContent()
        ) : activeTab === 'outdoor_unit' ? (
          renderOutdoorUnitContent()
        ) : activeTab === 'emergency' ? (
          renderEmergencyContent()
        ) : (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                {TABS.find(t => t.id === activeTab)?.label}
              </h2>
              <p className="text-gray-500">이 메뉴는 현재 준비 중입니다.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminManager;
