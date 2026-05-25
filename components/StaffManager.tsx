import React, { useState, useEffect, useCallback } from 'react';
import StaffStatus from './StaffStatus';
import LogoSealManager from './LogoSealManager';
import AppointmentManager from './AppointmentManager';
import ContractorManager from './ContractorManager';
import { LayoutList, User, Camera, Printer, RefreshCw, CalendarDays, UserPlus, Image as ImageIcon, Users, Edit2, Save, Search, Plus, Lock, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { 
  fetchStaffList, 
  saveStaffList,
  fetchUniformSettings,
  saveUniformSettings,
  fetchEmergencySettings,
  saveEmergencySettings
} from '../services/dataService';
import { StaffMember } from '../types';

interface StaffManagerProps {
  activeSubItem?: string | null;
}

const TABS = [
  { id: 'chart', label: '직원조직도' },
  { id: 'status', label: '직원현황' },
  { id: 'emergency', label: '비상연락망' },
  { id: 'uniform', label: '근무복' },
  { id: 'appointments', label: '선임현황' },
  { id: 'contractors', label: '협력업체' },
  { id: 'logoseal', label: '로고/직인' },
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

// 팀별 정원(T.O) 설정
const TEAM_QUOTAS: Record<string, number> = {
  '경비팀': 5,
  '시설팀': 5,
  '미화팀': 9
};

// YYYY-MM-DD -> YY.MM.DD 변환 함수
const formatShortDate = (dateStr?: string) => {
  if (!dateStr || dateStr.length < 10) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const yy = parts[0].substring(2);
  const mm = parts[1];
  const dd = parts[2];
  return `${yy}.${mm}.${dd}`;
};

const getJobRank = (title?: string): number => {
  if (!title) return 99;
  const t = title.trim();
  if (t.includes('현장대리인')) return 1;
  if (t.includes('과장')) return 2;
  if (t.includes('대리')) return 3;
  if (t.includes('실장') || t.includes('팀장') || t.includes('반장') || t.includes('조장')) return 4;
  if (t.includes('주임')) return 5;
  if (t.includes('기사') || t.includes('서무') || t.includes('경리')) return 6;
  if (t.includes('대원')) return 7;
  if (t.includes('여사')) return 8;
  return 10;
};

// 수직 연결선 컴포넌트
const VerticalLine = ({ height = 'h-4' }: { height?: string }) => (
  <div className={`w-0.5 bg-gray-300 print:bg-black print:w-[3px] ${height.includes('print:') ? height : (height === 'h-2' ? 'print:h-8' : 'print:h-12')} ${height}`}></div>
);

interface StaffCardProps {
  member: StaffMember & { isPlaceholder?: boolean };
  isManager?: boolean;
}

const StaffCard: React.FC<StaffCardProps> = ({ member, isManager = false }) => {
  if (member.isPlaceholder) {
    return (
      <div className={`
        relative rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center transition-all z-20 break-inside-avoid
        border-gray-200 bg-gray-50/30 print:border-gray-300 print:bg-white
        w-[115px] py-1.5 min-h-[140px] print:w-[120px] print:min-h-[140px]
      `}>
        <div className="w-[88px] h-[88px] rounded-md border border-dashed border-gray-200 flex items-center justify-center text-gray-300 mb-1">
          <UserPlus size={24} />
        </div>
        <div className="flex flex-col items-center justify-center w-full px-1">
          <span className="text-[11px] font-bold text-gray-300 print:text-gray-400">공석</span>
          <span className="text-[10px] text-gray-200 print:text-gray-300">충원 예정</span>
        </div>
      </div>
    );
  }

  const getSubTitle = () => {
    if (member.category === '미화') {
      if (member.jobTitle && member.jobTitle.includes('반장')) return member.jobTitle;
      return member.area || '미화';
    }
    return member.jobTitle || member.category;
  };

  const commonTextStyle = "text-[11px] print:text-[8pt] leading-tight";
  const birthText = member.birthDate ? `(${formatShortDate(member.birthDate)})` : '';
  const joinText = member.joinDate ? `(${formatShortDate(member.joinDate)})` : '';

  return (
    <div className={`
      relative rounded-lg border shadow-sm flex flex-col items-center justify-center text-center transition-all z-20 break-inside-avoid
      border-black print:shadow-none print:border-black print:border-[1.2px]
      w-[115px] py-1.5 min-h-[140px] print:w-[120px] print:min-h-[140px]
      ${isManager ? 'bg-blue-50' : 'bg-white'}
    `}>
      <div className={`
        relative rounded-md flex items-center justify-center mb-1 overflow-hidden border border-gray-100
        w-[88px] h-[88px] print:w-[88px] print:h-[88px]
        ${!member.photo ? (isManager ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500') : 'bg-white'}
      `}>
        {member.photo ? (
          <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
        ) : (
          <User size={isManager ? 30 : 22} />
        )}
      </div>
      
      <div className="flex flex-col items-center justify-center w-full px-1 overflow-hidden">
        <div className="flex items-center justify-center w-full whitespace-nowrap mb-0.5">
          <span className={`font-normal text-black ${commonTextStyle}`}>
            {member.name}
            <span className="font-normal text-black">
              {birthText}
            </span>
          </span>
        </div>
        
        <div className="flex items-center justify-center w-full whitespace-nowrap">
          <span className={`font-normal text-black ${commonTextStyle}`}>
            {getSubTitle()}
            <span className="font-normal text-black">
              {joinText}
            </span>
          </span>
        </div>
        
        {member.phone && (
          <span className={`font-normal text-black mt-0.5 text-[9px] print:text-[7pt]`}>
            {member.phone}
          </span>
        )}
      </div>
    </div>
  );
};

interface DepartmentGroupProps {
  title: string;
  members: StaffMember[];
  headerColorClass: string;
  position: 'first' | 'middle' | 'last' | 'single'; 
}

const DepartmentGroup: React.FC<DepartmentGroupProps> = ({ title, members, headerColorClass, position }) => {
  const facilityPriority = ['서동조', '김성현', '이창준', '이도성', '박평욱'];
  const securityPriority = ['김동창', '하병주', '민영학', '박종두', '이선근'];
  const cleaningPriority = ['조병태'];

  const sortedMembers = [...members].sort((a, b) => {
    const rankDiff = getJobRank(a.jobTitle) - getJobRank(b.jobTitle);
    if (rankDiff !== 0) return rankDiff;

    let priority: string[] | null = null;
    if (title === '경비팀') priority = securityPriority;
    if (title === '시설팀') priority = facilityPriority;
    if (title === '미화팀') priority = cleaningPriority;

    if (priority) {
      const idxA = priority.indexOf(a.name);
      const idxB = priority.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
    }

    return a.name.localeCompare(b.name);
  });

  const quota = TEAM_QUOTAS[title] || sortedMembers.length;
  const placeholdersNeeded = Math.max(0, quota - sortedMembers.length);
  const placeholderMembers: any[] = Array.from({ length: placeholdersNeeded }).map((_, i) => ({
    id: `placeholder-${title}-${i}`,
    name: '공석',
    category: title.replace('팀', ''),
    isPlaceholder: true
  }));

  const allDisplayMembers = [...sortedMembers, ...placeholderMembers];
  const leader = allDisplayMembers.length > 0 ? allDisplayMembers[0] : null;
  let teamMembers = leader ? allDisplayMembers.slice(1) : [];

  // 경비팀 특정 배치 요구사항 적용 (좌측: 대원A 2명 / 우측: 대원B 2명)
  if (title === '경비팀') {
    // 대원A 그룹 (하병주 포함)
    const daewonA = teamMembers.filter(m => !m.isPlaceholder && (m.jobTitle?.includes('대원A') || m.name === '하병주'));
    // 대원B 그룹 (박종두, 한응식 포함)
    const daewonB = teamMembers.filter(m => !m.isPlaceholder && (m.jobTitle?.includes('대원B') || m.name === '박종두' || m.name === '한응식'));

    const arranged: any[] = [];
    
    // 좌측열 (index 0, 2) - 대원A
    // 1순위: 하병주
    arranged[0] = daewonA.find(m => m.name === '하병주') || daewonA[0] || { id: 'fixed-ha', name: '하병주', category: '경비', isPlaceholder: true, jobTitle: '대원A' };
    // 2순위: 하병주가 아닌 다른 대원A
    arranged[2] = daewonA.find(m => m.id !== arranged[0].id) || { id: 'fixed-vacant-a2', name: '공석', category: '경비', isPlaceholder: true, jobTitle: '대원A' };
    
    // 우측열 (index 1, 3) - 대원B
    // 1순위: 박종두
    arranged[1] = daewonB.find(m => m.name === '박종두') || daewonB[0] || { id: 'fixed-park', name: '박종두', category: '경비', isPlaceholder: true, jobTitle: '대원B' };
    // 2순위: 한응식 (또는 박종두가 아닌 다른 대원B)
    arranged[3] = daewonB.find(m => m.name === '한응식' && m.id !== arranged[1].id) || daewonB.find(m => m.id !== arranged[1].id) || { id: 'fixed-han', name: '한응식', category: '경비', isPlaceholder: true, jobTitle: '대원B' };

    teamMembers = arranged;
  }

  const numCols = title === '시설팀' ? 1 : 2;
  const col1 = teamMembers.filter((_, i) => i % numCols === 0);
  const col2 = numCols >= 2 ? teamMembers.filter((_, i) => i % numCols === 1) : [];

  const connectorWidthClass = numCols === 2 ? 'w-[130px] print:w-[135px]' : 'w-0 border-l-0 border-r-0';

  return (
    <div className={`flex flex-col items-center flex-1 print:flex-none ${numCols === 2 ? 'min-w-[280px] print:min-w-[260px]' : 'min-w-[160px] print:min-w-[140px]'}`}>
      <div className="h-5 w-full relative print:h-3">
        {position !== 'single' && (
          <>
            {position === 'first' && <div className="absolute top-0 right-0 h-0 w-1/2 border-t-2 border-gray-300 print:border-black print:border-t-[3px]"></div>}
            {position === 'last' && <div className="absolute top-0 left-0 h-0 w-1/2 border-t-2 border-gray-300 print:border-black print:border-t-[3px]"></div>}
            {position === 'middle' && <div className="absolute top-0 left-0 h-0 w-full border-t-2 border-gray-300 print:border-black print:border-t-[3px]"></div>}
          </>
        )}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-full w-0.5 bg-gray-300 print:bg-black print:w-[3px]"></div>
      </div>

      <div className="flex flex-col items-center px-4 print:px-2">
        <div className={`${headerColorClass} text-white px-5 py-1.5 rounded-full font-bold shadow-sm relative z-20 text-xs print:text-[8pt] print:px-6 print:py-1.5 print:shadow-none print:bg-white print:text-black print:border-[2px] print:border-black`}>
          {title} ({members.length} / {quota})
        </div>

        <VerticalLine height="h-2 print:h-[10px]" />

        {leader && (
          <>
            <StaffCard member={leader} isManager={!leader.isPlaceholder && isManager(leader)} />
            {teamMembers.length > 0 && (
              <>
                <VerticalLine height="h-3 print:h-[10px]" />
                <div className={`h-2 border-t-2 border-l-2 border-r-2 border-gray-300 print:border-black print:border-t-[3px] print:border-l-[3px] print:border-r-[3px] print:h-2 ${connectorWidthClass}`}></div>
                <div className="flex gap-[15px] print:gap-[15px]">
                  <div className="flex flex-col items-center gap-[5px] print:gap-[5px]">
                    {col1.map((m, idx) => <StaffCard key={m.id || idx} member={m} />)}
                  </div>
                  {numCols >= 2 && (
                    <div className="flex flex-col items-center gap-[5px] print:gap-[5px]">
                      {col2.map((m, idx) => <StaffCard key={m.id || idx} member={m} />)}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const isManager = (member: StaffMember) => {
  return member.category === '현장대리인' || (member.jobTitle && member.jobTitle.includes('현장대리인'));
};

const StaffManager: React.FC<StaffManagerProps> = ({ activeSubItem }) => {
  const [activeTab, setActiveTab] = useState('chart');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // 근무복 및 비상연락망을 위한 상태 추가
  const [activeUniformSubTab, setActiveUniformSubTab] = useState('all');
  const [activeEmergencySubTab, setActiveEmergencySubTab] = useState('all');
  const [uniformData, setUniformData] = useState<any[]>([]);
  const [emergencyData, setEmergencyData] = useState<any[]>([]);
  const [isUniformEditMode, setIsUniformEditMode] = useState(false);
  const [isEmergencyEditMode, setIsEmergencyEditMode] = useState(false);
  const [uniformSaveSuccess, setUniformSaveSuccess] = useState(false);
  const [emergencySaveSuccess, setEmergencySaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (activeSubItem === '직원현황') setActiveTab('status');
    else if (activeSubItem === '직원조직도') setActiveTab('chart');
    else if (activeSubItem === '로고/직인') setActiveTab('logoseal');
    else if (activeSubItem === '비상연락망') setActiveTab('emergency');
    else if (activeSubItem === '근무복') setActiveTab('uniform');
  }, [activeSubItem]);

  useEffect(() => {
    setIsEditMode(false);
    setIsSaved(false);
    setIsUniformEditMode(false);
    setIsEmergencyEditMode(false);
  }, [activeTab]);

  useEffect(() => {
    const handleSaved = () => {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    };
    window.addEventListener('LOGOSEAL_SAVED', handleSaved);
    return () => window.removeEventListener('LOGOSEAL_SAVED', handleSaved);
  }, []);

  const loadEmergencyDataWithStaff = useCallback(async () => {
    setLoading(true);
    try {
      const [staffListRaw, savedEmergency] = await Promise.all([
        fetchStaffList(),
        fetchEmergencySettings()
      ]);
      
      const staffList = staffListRaw.filter(s => !s.resignDate || s.resignDate.trim() === '');
      const savedRows = savedEmergency || [];
      const nonLinkedData = savedRows.filter((r: any) => 
        !['시설', '경비', '미화'].includes(r.category)
      );

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
      setLoading(false);
    }
  }, []);

  const loadUniformDataWithStaff = useCallback(async () => {
    setLoading(true);
    try {
      const [staffList, savedUniforms] = await Promise.all([
        fetchStaffList(),
        fetchUniformSettings()
      ]);
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
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUniformChange = (id: string, field: string, value: string) => {
    setUniformData(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

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

  const handleEmergencySave = async () => {
    setIsSaving(true);
    try {
      const success = await saveEmergencySettings(emergencyData);
      if (success) {
        setEmergencySaveSuccess(true);
        setIsEmergencyEditMode(false);
        setTimeout(() => setEmergencySaveSuccess(false), 3000);
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (e) {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmergencyAddRow = () => {
    const categoryMap: Record<string, string> = {
      saemaul: '새마을',
      dispatch: '용역',
      facility: '시설',
      security: '경비',
      cleaning: '미화',
      tenant: '입주사'
    };
    const newRow = {
      id: Date.now().toString(),
      category: activeEmergencySubTab !== 'all' ? categoryMap[activeEmergencySubTab] : '',
      position: '',
      name: '',
      location: '',
      extensionNumber: '',
      phone: ''
    };
    setEmergencyData(prev => [...prev, newRow]);
  };

  const handleEmergencyDeleteRow = (id: string) => {
    setEmergencyData(prev => prev.filter(row => row.id !== id));
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
            table th:nth-child(1) { width: 80px !important; }
            table th:nth-child(2) { width: 150px !important; }
            table th:nth-child(3) { width: 100px !important; }
            table th:nth-child(4) { width: 100px !important; }
            table th:nth-child(5) { width: 100px !important; }
            .group-hover\\:opacity-100 {
              display: none !important; 
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
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
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
        if (activeEmergencySubTab === 'tenant' || (a.category === '입주사' && b.category === '입주사')) {
          const floorA = parseFloor(a.location);
          const floorB = parseFloor(b.location);
          if (floorA !== floorB) return floorB - floorA; 
          return (a.extensionNumber || '').localeCompare(b.extensionNumber || ''); 
        }

        const orderA = categorySortOrder[a.category] || 99;
        const orderB = categorySortOrder[b.category] || 99;
        if (orderA !== orderB) return orderA - orderB;

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
                        onClick={() => handleEmergencyDeleteRow(row.id)}
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
                      onClick={() => handleEmergencyDeleteRow(row.id)}
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

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchStaffList();
      setStaffList(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'chart' || activeTab === 'status') {
      loadData();
    } else if (activeTab === 'uniform') {
      loadUniformDataWithStaff();
    } else if (activeTab === 'emergency') {
      loadEmergencyDataWithStaff();
    }
  }, [activeTab, loadUniformDataWithStaff, loadEmergencyDataWithStaff]);

  const handlePrint = () => {
    const printContent = document.getElementById('staff-org-chart-container');
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>직원조직도 - 새마을운동중앙회 대치동사옥</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { font-family: 'Noto Sans KR', sans-serif; background: black; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
            .no-print { display: flex; justify-content: center; padding: 20px; }
            @media print { .no-print { display: none !important; } body { background: white !important; } .print-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; } }
            
            .print-page { 
              width: 210mm; 
              min-height: 297mm; 
              margin: 20px auto; 
              padding: 10mm 12mm 10mm 12mm; /* 상단 10mm, 하단 10mm 설정 */
              background: white; 
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); 
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            
            #print-wrap { 
              width: 100%; 
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            
            /* 수동 스타일 보정 */
            .bg-gray-300, .bg-gray-800 { background: black !important; }
            .border-gray-300, .border-black { border-color: black !important; }
            .bg-blue-50, .bg-blue-100, .bg-gray-100 { background-color: transparent !important; }
            .shadow-sm, .shadow-md { box-shadow: none !important; }
            
            h1 { 
              font-size: 20pt !important; 
              border-bottom: 5px solid black !important; 
              padding-bottom: 4px !important;
              white-space: nowrap !important;
              display: inline-block !important;
              line-height: 1.0 !important;
              letter-spacing: 2px;
              font-weight: 900 !important;
              text-align: center;
            }
            .break-inside-avoid { break-inside: avoid; }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" style="padding: 10px 24px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12pt;">인쇄하기</button>
          </div>
          <div class="print-page">
            <div id="print-wrap">${printContent.innerHTML}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // 조직도 표시용 (퇴사자 제외 및 소장 직책 제외)
  const activeStaff = staffList.filter(m => 
    (!m.resignDate || m.resignDate.trim() === '') && 
    !(m.jobTitle && m.jobTitle.includes('소장'))
  );
  
  const manager = activeStaff.find(isManager);
  const facilityTeam = activeStaff.filter(m => m.category === '시설' && m.id !== manager?.id);
  const securityTeam = activeStaff.filter(m => m.category === '경비' && m.id !== manager?.id);
  const cleaningTeam = activeStaff.filter(m => m.category === '미화' && m.id !== manager?.id);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-2 pb-32 animate-fade-in print:p-0">
      <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
        <div className="flex shrink-0 items-stretch">
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

        {(activeTab === 'chart' || activeTab === 'status' || activeTab === 'appointments' || activeTab === 'contractors' || activeTab === 'logoseal') && (
          <div className="flex items-center shrink-0 pr-2">
            <div className="px-2 flex items-center">
              <div className="w-px h-6 bg-black"></div>
            </div>
            <button 
              onClick={() => {
                if (activeTab === 'chart' || activeTab === 'status') loadData();
                else if (activeTab === 'appointments') window.dispatchEvent(new CustomEvent('REFRESH_APPOINTMENTS'));
                else if (activeTab === 'contractors') window.dispatchEvent(new CustomEvent('REFRESH_CONTRACTORS'));
                else if (activeTab === 'logoseal') window.dispatchEvent(new CustomEvent('REFRESH_LOGOSEAL'));
              }}
              disabled={loading}
              className="shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent text-gray-500 hover:text-black transition-colors whitespace-nowrap relative disabled:opacity-50"
            >
              <RefreshCw size={18} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />새로고침
            </button>

            {activeTab === 'logoseal' && (
              <>
                <button 
                  onClick={() => {
                    setIsEditMode(!isEditMode);
                    window.dispatchEvent(new CustomEvent('EDIT_LOGOSEAL'));
                  }}
                  disabled={loading}
                  className={`shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent transition-all relative disabled:opacity-50 whitespace-nowrap ${
                    isEditMode ? 'text-orange-600' : 'text-gray-500 hover:text-black'
                  }`}
                >
                  {isEditMode ? <Lock size={18} className="mr-1.5" /> : <Edit2 size={18} className="mr-1.5" />}
                  {isEditMode ? '수정완료' : '수정'}
                </button>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('SAVE_LOGOSEAL'))}
                  disabled={loading}
                  className={`shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent transition-all relative disabled:opacity-50 whitespace-nowrap ${
                    isSaved ? 'text-orange-600' : 'text-gray-500 hover:text-black'
                  }`}
                >
                  <Save size={18} className="mr-1.5" />저장
                </button>
              </>
            )}
            
            {(activeTab === 'status' || activeTab === 'appointments' || activeTab === 'contractors') && (
              <button 
                onClick={() => {
                  if (activeTab === 'status') window.dispatchEvent(new CustomEvent('ADD_STAFF'));
                  else if (activeTab === 'appointments') window.dispatchEvent(new CustomEvent('ADD_APPOINTMENT'));
                  else if (activeTab === 'contractors') window.dispatchEvent(new CustomEvent('ADD_CONTRACTOR'));
                }}
                disabled={loading}
                className="shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent text-gray-500 hover:text-black transition-colors whitespace-nowrap relative disabled:opacity-50"
              >
                <Plus size={18} className="mr-1.5" />등록
              </button>
            )}

            {(activeTab === 'chart' || activeTab === 'status' || activeTab === 'appointments' || activeTab === 'contractors') && (
              <button 
                onClick={() => {
                  if (activeTab === 'chart') handlePrint();
                  else if (activeTab === 'status') window.dispatchEvent(new CustomEvent('PRINT_STAFF'));
                  else if (activeTab === 'appointments') window.dispatchEvent(new CustomEvent('PRINT_APPOINTMENTS'));
                  else if (activeTab === 'contractors') window.dispatchEvent(new CustomEvent('PRINT_CONTRACTORS'));
                }} 
                disabled={loading}
                className="shrink-0 py-3 px-4 flex items-center text-[14px] font-bold bg-transparent text-gray-500 hover:text-black transition-colors whitespace-nowrap relative disabled:opacity-50"
              >
                <Printer size={18} className="mr-1.5" />인쇄
              </button>
            )}

            {(activeTab === 'status' || activeTab === 'contractors') && (
              <div className="px-2 flex items-center">
                <div className="w-px h-6 bg-black"></div>
              </div>
            )}

            {(activeTab === 'status' || activeTab === 'contractors') && (
              <div className="flex-1 flex justify-end items-center px-4 min-w-[200px]">
                <div className="relative w-full max-w-[280px]">
                  <input 
                    type="text" 
                    placeholder={activeTab === 'status' ? "성명 또는 담당구역 검색" : "업체명 또는 대표자 검색"} 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="w-full pl-9 pr-4 py-1.5 bg-transparent border-none rounded-none outline-none focus:ring-0 text-[13px] font-normal" 
                  />
                  <Search className="absolute left-3 top-2 text-gray-400" size={16} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 서브탭메뉴 (근무복일 때만 표시) */}
      {activeTab === 'uniform' && (
        <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
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

          <div className="flex items-center shrink-0 px-2">
            <div className="w-px h-6 bg-black"></div>
          </div>

          <div className="flex items-center shrink-0">
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
              <Edit2 size={18} className="mr-1.5" />
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

      {/* 서브탭메뉴 (비상연락망일 때만 표시) */}
      {activeTab === 'emergency' && (
        <div className="bg-white print:hidden w-full max-w-7xl mx-auto flex items-stretch justify-start overflow-x-auto scrollbar-hide border-b border-black">
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

          <div className="flex items-center shrink-0 px-2">
            <div className="w-px h-6 bg-black"></div>
          </div>

          <div className="flex items-center shrink-0">
            <button 
              onClick={loadEmergencyDataWithStaff}
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
              <Edit2 size={18} className="mr-1.5" />
              {isEmergencyEditMode ? '수정완료' : '수정'}
            </button>
            {activeEmergencySubTab === 'tenant' && isEmergencyEditMode && (
              <button 
                onClick={handleEmergencyAddRow}
                className="flex items-center shrink-0 px-4 py-3 bg-transparent text-gray-500 hover:text-black font-bold text-[14px] transition-colors relative whitespace-nowrap"
              >
                <Plus size={18} className="mr-1.5" />
                등록
              </button>
            )}
            <button 
              onClick={handleEmergencySave}
              disabled={isSaving || emergencySaveSuccess}
              className={`flex items-center shrink-0 px-4 py-3 bg-transparent text-[14px] transition-colors relative whitespace-nowrap disabled:opacity-50 ${
                emergencySaveSuccess ? 'text-orange-600 font-extrabold' : 'text-gray-500 hover:text-black font-bold'
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

      {loading && staffList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border-b border-black">
          <RefreshCw className="animate-spin text-blue-500 mb-4" size={32} />
          <p className="text-gray-500 font-bold">직원 정보를 불러오는 중...</p>
        </div>
      ) : activeTab === 'chart' ? (
        <div className="bg-white p-8 border border-black overflow-hidden print:p-0 print:border-none">
          <div id="staff-org-chart-container" className="flex flex-col items-center min-w-[750px] print:min-w-0 print:w-full">
            <h1 className="text-xl font-black text-gray-900 border-b-4 border-gray-800 pb-1.5 px-12 mb-0 print:text-[20pt] print:border-black print:mb-0">
              새마을운동중앙회 대치동사옥 조직도
            </h1>
            <div className="flex flex-col items-center mt-2 print:mt-1">
              {manager ? <StaffCard member={manager} isManager /> : <div className="p-10 border-2 border-dashed rounded-lg text-gray-400">현장대리인 공석</div>}
              <VerticalLine height="h-5 print:h-[10px]" />
            </div>
            <div className="flex justify-center items-start w-full px-4 print:px-0 gap-0">
              <DepartmentGroup title="경비팀" members={securityTeam} headerColorClass="bg-green-600" position="first" />
              <DepartmentGroup title="시설팀" members={facilityTeam} headerColorClass="bg-blue-600" position="middle" />
              <DepartmentGroup title="미화팀" members={cleaningTeam} headerColorClass="bg-orange-600" position="last" />
            </div>
          </div>
        </div>
      ) : activeTab === 'status' ? (
        <StaffStatus staffList={staffList} setStaffList={setStaffList} isEmbedded={true} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      ) : activeTab === 'appointments' ? (
        <AppointmentManager isEmbedded={true} />
      ) : activeTab === 'contractors' ? (
        <ContractorManager isEmbedded={true} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      ) : activeTab === 'emergency' ? (
        renderEmergencyContent()
      ) : activeTab === 'uniform' ? (
        renderUniformContent()
      ) : (
        <LogoSealManager isEmbedded={true} isEditMode={isEditMode} />
      )}
    </div>
  );
};

export default StaffManager;