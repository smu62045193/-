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
  generateUUID
} from '../services/dataService';
import { AutoRegRow, ArchiveItem } from '../types';

const TABS = [
  { id: 'auto_reg', label: '자동등록' },
  { id: 'form', label: '자료실' },
  { id: 'network', label: '네트워크' },
  { id: 'password', label: '비밀번호' },
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

const AdminManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('auto_reg');
  const [activeSubTab, setActiveSubTab] = useState('elec');
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
  const [isPasswordEditMode, setIsPasswordEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isNetworkEditMode, setIsNetworkEditMode] = useState(false);
  
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
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, activeSubTab]);

  useEffect(() => {
    if (activeTab === 'auto_reg' || activeTab === 'form' || activeTab === 'network' || activeTab === 'password') {
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
    const filteredRows = archiveRows.filter(row => 
      row.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                <th className="border border-black text-[13px] font-normal px-2 w-[60px]">관리</th>
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
                        <a 
                          href={row.attachment} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                          title={row.fileName || '다운로드'}
                        >
                          <Download size={16} />
                          <span className="text-[11px] truncate max-w-[60px]">{row.fileName || '파일'}</span>
                        </a>
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
                    <div className="flex items-center justify-center h-full">
                      <button 
                        onClick={() => handleEditArchive(row.id)}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                        title="수정"
                      >
                        <Edit size={16} />
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

        {/* 자료실 탭일 때만 표시되는 구분선과 등록 버튼 */}
        {activeTab === 'form' && (
          <>
            <div className="flex items-center shrink-0 px-2">
              <div className="w-px h-6 bg-black"></div>
            </div>
            <div className="flex items-center shrink-0">
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
            </div>

            <div className="flex items-center shrink-0 px-2">
              <div className="w-px h-6 bg-black"></div>
            </div>

            <div className="flex items-center flex-1 px-4">
              <div className="relative w-full sm:w-[250px]">
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
          </>
        )}
      </div>

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
