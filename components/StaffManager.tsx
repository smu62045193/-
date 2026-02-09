
import React, { useState, useEffect } from 'react';
import StaffStatus from './StaffStatus';
import LogoSealManager from './LogoSealManager';
import { LayoutList, User, Camera, Printer, RefreshCw, CalendarDays, UserPlus, Image as ImageIcon } from 'lucide-react';
import { fetchStaffList, saveStaffList } from '../services/dataService';
import { StaffMember } from '../types';

interface StaffManagerProps {
  activeSubItem?: string | null;
}

const TABS = [
  { id: 'chart', label: '직원 조직도' },
  { id: 'status', label: '직원 현황' },
  { id: 'logoseal', label: '로고/직인' },
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
  onPhotoUpdate: (id: string, photo: string) => void;
}

const StaffCard: React.FC<StaffCardProps> = ({ member, isManager = false, onPhotoUpdate }) => {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 300; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          onPhotoUpdate(member.id, dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

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
      <label className={`
        relative rounded-md flex items-center justify-center mb-1 overflow-hidden border border-gray-100 cursor-pointer group
        w-[88px] h-[88px] print:w-[88px] print:h-[88px]
        ${!member.photo ? (isManager ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500') : 'bg-white'}
      `}>
        {member.photo ? (
          <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
        ) : (
          <User size={isManager ? 30 : 22} />
        )}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center print:hidden">
          <Camera className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={14} />
        </div>
        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </label>
      
      <div className="flex flex-col items-center justify-center w-full px-1 overflow-hidden">
        <div className="flex items-center justify-center w-full whitespace-nowrap mb-0.5">
          <span className={`font-bold text-black ${commonTextStyle}`}>
            {member.name}
            <span className="font-medium text-black">
              {birthText}
            </span>
          </span>
        </div>
        
        <div className="flex items-center justify-center w-full whitespace-nowrap">
          <span className={`font-bold text-black ${commonTextStyle}`}>
            {getSubTitle()}
            <span className="font-medium text-black">
              {joinText}
            </span>
          </span>
        </div>
        
        {member.phone && (
          <span className={`font-bold text-black mt-0.5 text-[9px] print:text-[7pt]`}>
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
  onPhotoUpdate: (id: string, photo: string) => void;
  position: 'first' | 'middle' | 'last' | 'single'; 
}

const DepartmentGroup: React.FC<DepartmentGroupProps> = ({ title, members, headerColorClass, onPhotoUpdate, position }) => {
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

  // 경비팀 특정 배치 요구사항 적용 (수직: 하병주-공석 / 박종두-이선근)
  if (title === '경비팀') {
    const ha = teamMembers.find(m => m.name === '하병주');
    const park = teamMembers.find(m => m.name === '박종두');
    const lee = teamMembers.find(m => m.name === '이선근');
    
    const arranged: any[] = [];
    arranged[0] = ha || { id: 'fixed-ha', name: '하병주', category: '경비', isPlaceholder: true };
    arranged[2] = { id: 'fixed-vacant-a', name: '공석', category: '경비', isPlaceholder: true };
    arranged[1] = park || { id: 'fixed-park', name: '박종두', category: '경비', isPlaceholder: true };
    arranged[3] = lee || { id: 'fixed-lee', name: '이선근', category: '경비', isPlaceholder: true };
    
    const others = teamMembers.filter(m => m !== ha && m !== park && m !== lee && !m.isPlaceholder);
    teamMembers = [...arranged, ...others];
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
            <StaffCard member={leader} isManager={!leader.isPlaceholder && isManager(leader)} onPhotoUpdate={onPhotoUpdate} />
            {teamMembers.length > 0 && (
              <>
                <VerticalLine height="h-3 print:h-[10px]" />
                <div className={`h-2 border-t-2 border-l-2 border-r-2 border-gray-300 print:border-black print:border-t-[3px] print:border-l-[3px] print:border-r-[3px] print:h-2 ${connectorWidthClass}`}></div>
                <div className="flex gap-[15px] print:gap-[15px]">
                  <div className="flex flex-col items-center gap-[5px] print:gap-[5px]">
                    {col1.map((m, idx) => <StaffCard key={m.id || idx} member={m} onPhotoUpdate={onPhotoUpdate} />)}
                  </div>
                  {numCols >= 2 && (
                    <div className="flex flex-col items-center gap-[5px] print:gap-[5px]">
                      {col2.map((m, idx) => <StaffCard key={m.id || idx} member={m} onPhotoUpdate={onPhotoUpdate} />)}
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

  useEffect(() => {
    if (activeSubItem === '직원현황') setActiveTab('status');
    else if (activeSubItem === '직원조직도') setActiveTab('chart');
    else if (activeSubItem === '로고/직인') setActiveTab('logoseal');
  }, [activeSubItem]);

  useEffect(() => {
    if (activeTab !== 'logoseal') loadData();
  }, [activeTab]);

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

  const handlePhotoUpdate = async (id: string, photo: string) => {
    const updatedList = staffList.map(m => m.id === id ? { ...m, photo } : m);
    setStaffList(updatedList);
    await saveStaffList(updatedList);
  };

  const handlePrint = () => {
    const printContent = document.getElementById('staff-org-chart-container');
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>직원 조직도 - 새마을운동중앙회 대치동사옥</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { font-family: 'Noto Sans KR', sans-serif; background: #f1f5f9; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
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
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in print:p-0">
      <div className="mb-2 print:hidden flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">직원 관리</h2>
          <p className="text-slate-500 mt-2 text-base font-medium">조직 구성 및 직원 현황을 관리합니다.</p>
        </div>
      </div>

      <div className="flex overflow-x-auto whitespace-nowrap gap-2 pb-4 mb-4 scrollbar-hide border-b border-slate-200 items-center print:hidden">
        <div className="mr-3 text-slate-400 p-2 bg-white rounded-xl shadow-sm border border-slate-100">
           <CalendarDays size={22} />
        </div>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 rounded-2xl text-sm font-black transition-all duration-300 border ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100 scale-105' 
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && staffList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <RefreshCw className="animate-spin text-blue-500 mb-4" size={32} />
          <p className="text-gray-500 font-bold">직원 정보를 불러오는 중...</p>
        </div>
      ) : activeTab === 'chart' ? (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 overflow-hidden print:p-0 print:border-none">
          <div className="flex justify-end mb-6 print:hidden gap-2">
            <button 
              onClick={loadData}
              disabled={loading}
              className="flex items-center justify-center px-4 py-2 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 border border-gray-200 font-bold shadow-sm transition-all text-sm active:scale-95"
            >
              <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />새로고침
            </button>
            <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 font-bold text-sm transition-colors">
              <Printer size={16} className="mr-2" /> 미리보기
            </button>
          </div>
          <div id="staff-org-chart-container" className="flex flex-col items-center min-w-[750px] print:min-w-0 print:w-full">
            <h1 className="text-xl font-black text-gray-900 border-b-4 border-gray-800 pb-1.5 px-12 mb-0 print:text-[20pt] print:border-black print:mb-0">
              새마을운동중앙회 대치동사옥 조직도
            </h1>
            <div className="flex flex-col items-center mt-2 print:mt-1">
              {manager ? <StaffCard member={manager} isManager onPhotoUpdate={handlePhotoUpdate} /> : <div className="p-10 border-2 border-dashed rounded-lg text-gray-400">현장대리인 공석</div>}
              <VerticalLine height="h-5 print:h-[10px]" />
            </div>
            <div className="flex justify-center items-start w-full px-4 print:px-0 gap-0">
              <DepartmentGroup title="경비팀" members={securityTeam} headerColorClass="bg-green-600" onPhotoUpdate={handlePhotoUpdate} position="first" />
              <DepartmentGroup title="시설팀" members={facilityTeam} headerColorClass="bg-blue-600" onPhotoUpdate={handlePhotoUpdate} position="middle" />
              <DepartmentGroup title="미화팀" members={cleaningTeam} headerColorClass="bg-orange-600" onPhotoUpdate={handlePhotoUpdate} position="last" />
            </div>
          </div>
        </div>
      ) : activeTab === 'status' ? (
        <StaffStatus staffList={staffList} setStaffList={setStaffList} />
      ) : (
        <LogoSealManager />
      )}
    </div>
  );
};

export default StaffManager;
