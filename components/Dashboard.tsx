
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Calendar, 
  ClipboardList, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  Save, 
  UserCircle, 
  UserCheck, 
  Activity,
  AlertCircle,
  Cloud,
  X,
  Zap,
  Wrench,
  Flame,
  ArrowUpDown,
  Car,
  ShieldAlert,
  Edit2,
  Search,
  User
} from 'lucide-react';
import { fetchDailyData, saveDailyData, fetchStaffList, getInitialDailyData, apiFetchRange } from '../services/dataService';
import { DailyData, StaffMember, DutyStatus, WorkLogData, TaskItem, LogCategory } from '../types';
import { format, differenceInDays, parseISO } from 'date-fns';
import { isHolidayOrSunday } from '../services/automationService';
import { WORK_LOG_TABS } from '../constants';

interface DashboardProps {
  currentDate: Date;
}

interface SearchResultItem {
  category: string;
  type: '금일' | '익일';
  content: string;
  id: string;
  date?: string; 
}

const Dashboard: React.FC<DashboardProps> = ({ currentDate }) => {
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showConfirm, setShowConfirm] = useState(false);
  
  // 검색 관련 상태
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [selectedSearchYear, setSelectedSearchYear] = useState(new Date().getFullYear()); 
  const [isSearching, setIsSearching] = useState(false); 

  // 수정 모드 상태 분리
  const [isStaffEditing, setIsStaffEditing] = useState(false);
  const [isDutyEditing, setIsDutyEditing] = useState(false);

  const dateKey = format(currentDate, 'yyyy-MM-dd');

  // 데이터 로드 함수
  const loadData = async (force = false) => {
    setLoading(true);
    try {
      const [staff, daily] = await Promise.all([
        fetchStaffList(),
        fetchDailyData(dateKey, force)
      ]);
      setStaffList(staff || []);
      setDailyData(daily || getInitialDailyData(dateKey));
    } catch (err) {
      console.error("Dashboard data load error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setIsStaffEditing(false);
    setIsDutyEditing(false);
  }, [dateKey]);

  // 시설팀 인원 정보 (대리, 주임, 기사)
  const facilityStaff = useMemo(() => {
    const list = staffList.filter(s => s.category === '시설');
    
    const engineers = list
      .filter(s => s.jobTitle.includes('기사') && (!s.resignDate || s.resignDate === '' || s.resignDate >= dateKey))
      .sort((a, b) => a.joinDate.localeCompare(b.joinDate));

    return {
      deputy: list.find(s => s.jobTitle.includes('대리'))?.name || '미지정',
      chief: list.find(s => s.jobTitle.includes('주임'))?.name || '미지정',
      engineers: engineers.map(e => e.name)
    };
  }, [staffList, dateKey]);

  // 자동 근무 현황 계산 로직
  const calculatedDuty = useMemo(() => {
    if (dailyData?.facilityDuty && (dailyData.facilityDuty.day || dailyData.facilityDuty.night)) {
      return dailyData.facilityDuty;
    }

    const isHoliday = isHolidayOrSunday(currentDate);
    const engCount = facilityStaff.engineers.length;
    
    let duty: DutyStatus = {
      day: '',
      night: '',
      off: '',
      vacation: '',
      deputy: facilityStaff.deputy,
      chief: facilityStaff.chief
    };

    if (isHoliday) {
      duty.off = `${facilityStaff.deputy}, ${facilityStaff.chief}`;
    } else {
      duty.day = `${facilityStaff.deputy}, ${facilityStaff.chief}`;
    }

    if (engCount > 0) {
      const baseDate = parseISO('2024-01-01');
      const diffDays = Math.abs(differenceInDays(currentDate, baseDate));
      
      if (engCount >= 3) {
        const dayIdx = diffDays % 3;
        const nightIdx = (diffDays + 2) % 3;
        const offIdx = (diffDays + 1) % 3;
        const engDay = facilityStaff.engineers[dayIdx];
        const engNight = facilityStaff.engineers[nightIdx];
        const engOff = facilityStaff.engineers[offIdx];

        if (isHoliday) {
          duty.off = duty.off ? `${duty.off}, ${engDay}, ${engOff}` : `${engDay}, ${engOff}`;
          duty.night = engNight;
        } else {
          duty.day = duty.day ? `${duty.day}, ${engDay}` : engDay;
          duty.night = engNight;
          duty.off = duty.off ? `${duty.off}, ${engOff}` : engOff;
        }
      } else if (engCount === 2) {
        const dayIdx = diffDays % 2;
        const nightIdx = (diffDays + 1) % 2;
        const engDay = facilityStaff.engineers[dayIdx];
        const engNight = facilityStaff.engineers[nightIdx];

        if (isHoliday) {
          duty.off = duty.off ? `${duty.off}, ${engDay}` : engDay;
          duty.night = engNight;
        } else {
          duty.day = duty.day ? `${duty.day}, ${engDay}` : engDay;
          duty.night = engNight;
        }
      } else {
        duty.day = duty.day ? `${duty.day}, ${facilityStaff.engineers[0]}` : facilityStaff.engineers[0];
      }
    }
    return duty;
  }, [facilityStaff, currentDate, dailyData]);

  // 중요 업무 내용 추출
  const keyWorkTasks = useMemo(() => {
    if (!dailyData?.workLog) return [];

    const categories = [
      { id: 'electrical', label: '전기', icon: <Zap size={16} /> },
      { id: 'mechanical', label: '기계', icon: <Wrench size={16} /> },
      { id: 'fire', label: '소방', icon: <Flame size={16} /> },
      { id: 'elevator', label: '승강기', icon: <ArrowUpDown size={16} /> },
      { id: 'park_sec_clean', label: '주차/경비/미화', icon: <Car size={16} />, subIds: ['parking', 'security', 'cleaning'] },
      { id: 'handover', label: '특이사항', icon: <ShieldAlert size={16} /> },
    ];

    const results: { label: string; tasks: string[]; icon: React.ReactNode }[] = [];

    categories.forEach(cat => {
      let manualTasks: string[] = [];
      if (cat.subIds) {
        cat.subIds.forEach(subId => {
          const list = (dailyData.workLog as any)[subId]?.today || [];
          const filtered = list
            .filter((t: TaskItem) => t.content && !t.id.startsWith('auto-'))
            .map((t: TaskItem) => t.content);
          manualTasks = [...manualTasks, ...filtered];
        });
      } else {
        const list = (dailyData.workLog as any)[cat.id]?.today || [];
        manualTasks = list
          .filter((t: TaskItem) => t.content && !t.id.startsWith('auto-'))
          .map((t: TaskItem) => t.content);
      }
      if (manualTasks.length > 0) {
        results.push({ label: cat.label, tasks: manualTasks, icon: cat.icon });
      }
    });
    return results;
  }, [dailyData]);

  const handleSave = async () => {
    if (!dailyData) return;
    setShowConfirm(false);
    setSaveStatus('loading');
    try {
      const updatedData: DailyData = {
        ...dailyData,
        facilityDuty: {
          ...calculatedDuty,
          vacation: dailyData.facilityDuty?.vacation || ''
        },
        lastUpdated: new Date().toISOString()
      };
      const success = await saveDailyData(updatedData);
      if (success) {
        setSaveStatus('success');
        setDailyData(updatedData);
        setIsStaffEditing(false);
        setIsDutyEditing(false);
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const updateDutyField = (field: keyof DutyStatus, value: string) => {
    if (!dailyData) return;
    setDailyData({
      ...dailyData,
      facilityDuty: {
        ...calculatedDuty,
        [field]: value
      }
    });
  };

  // 업무일지 검색 로직
  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      alert('검색어를 입력해주세요.');
      return;
    }
    setIsSearching(true);
    const results: SearchResultItem[] = [];
    const normalize = (text: string) => text.replace(/\s+/g, '').toLowerCase();
    const normalizedKeyword = normalize(searchKeyword);
    const categoriesToSearch: (keyof WorkLogData)[] = [
      'electrical', 'mechanical', 'fire', 'elevator', 'handover', 'parking', 'security', 'cleaning'
    ];
    try {
      const yearStart = `${selectedSearchYear}-01-01`;
      const yearEnd = `${selectedSearchYear}-12-31`;
      const annualLogs = await apiFetchRange("DAILY_", yearStart, yearEnd);
      annualLogs.forEach(entry => {
        const entryDateKey = entry.key.replace("DAILY_", "");
        const entryWorkLog = entry.data?.workLog;
        if (!entryWorkLog) return;
        categoriesToSearch.forEach((catKey) => {
          const catData = entryWorkLog[catKey] as LogCategory;
          if (!catData) return;
          const catLabel = WORK_LOG_TABS.find(t => t.id === catKey)?.label || catKey;
          if (catData.today) {
            catData.today.forEach(task => {
              if (task.content && normalize(task.content).includes(normalizedKeyword)) {
                results.push({ category: catLabel, type: '금일', content: task.content, id: task.id, date: entryDateKey });
              }
            });
          }
        });
      });
      results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setSearchResults(results);
      setIsSearchModalOpen(true);
    } catch (e) {
      console.error("Search Error:", e);
      alert("검색 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  if (loading && !dailyData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <RefreshCw size={48} className="animate-spin text-blue-500 mb-4" />
        <p className="text-gray-500 font-bold">대시보드 데이터를 구성 중입니다...</p>
      </div>
    );
  }

  const InputField = ({ label, value, field }: { label: string, value: string, field: keyof DutyStatus }) => (
    <div className="flex flex-col">
      <label className="text-[10px] font-black text-slate-400 mb-1 uppercase">{label}</label>
      <input 
        type="text"
        value={value || ''}
        onChange={(e) => updateDutyField(field, e.target.value)}
        className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-blue-700 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
      />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-20">
      {/* 섹션 1: 시설팀 인적 자원 현황 (카드 스타일 변경됨) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-blue-600" size={20} />
            <h3 className="font-black text-slate-800">시설팀 인원 현황</h3>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => loadData(true)}
              className="flex items-center justify-center px-4 py-2 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 border border-gray-200 font-bold shadow-sm transition-all text-sm active:scale-95"
            >
              <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />새로고침
            </button>
            <button 
              onClick={() => setIsStaffEditing(!isStaffEditing)}
              className={`flex items-center justify-center px-4 py-2 rounded-lg font-bold shadow-sm transition-all text-sm active:scale-95 ${isStaffEditing ? 'bg-rose-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              {isStaffEditing ? <><X size={18} className="mr-2" />수정취소</> : <><Edit2 size={18} className="mr-2" />수정</>}
            </button>
          </div>
        </div>
        <div className="p-6">
          {isStaffEditing ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <InputField label="대리" value={calculatedDuty.deputy || ''} field="deputy" />
              <InputField label="주임" value={calculatedDuty.chief || ''} field="chief" />
              <InputField label="기사 1" value={facilityStaff.engineers[0] || ''} field="day" />
              <InputField label="기사 2" value={facilityStaff.engineers[1] || ''} field="night" />
              <InputField label="기사 3" value={facilityStaff.engineers[2] || ''} field="off" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* 대리 카드 */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 mb-2 uppercase tracking-tighter">대리</label>
                <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 min-h-[60px] flex items-center shadow-sm">
                  <UserCircle className="text-blue-500 mr-3 shrink-0" size={20} />
                  <span className="text-blue-700 font-black text-base truncate">{calculatedDuty.deputy || facilityStaff.deputy}</span>
                </div>
              </div>
              {/* 주임 카드 */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 mb-2 uppercase tracking-tighter">주임</label>
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 min-h-[60px] flex items-center shadow-sm">
                  <UserCircle className="text-indigo-500 mr-3 shrink-0" size={20} />
                  <span className="text-indigo-700 font-black text-base truncate">{calculatedDuty.chief || facilityStaff.chief}</span>
                </div>
              </div>
              {/* 기사 1~3 카드 */}
              {Array.from({ length: 3 }).map((_, i) => {
                const name = facilityStaff.engineers[i];
                const isVacant = !name;
                return (
                  <div key={i} className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 mb-2 uppercase tracking-tighter">기사 {i + 1}</label>
                    <div className={`${isVacant ? 'bg-slate-50 border-slate-100' : 'bg-slate-50 border-slate-200'} rounded-2xl px-5 py-4 min-h-[60px] flex items-center shadow-sm transition-all`}>
                      <User className={`${isVacant ? 'text-slate-200' : 'text-slate-500'} mr-3 shrink-0`} size={18} />
                      <span className={`${isVacant ? 'text-slate-300 italic font-medium' : 'text-slate-800 font-black'} text-base truncate`}>
                        {name || '공석'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 섹션 2: 시설 근무 현황 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="text-emerald-600" size={20} />
            <h3 className="font-black text-slate-800">금일 시설 근무 현황</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isHolidayOrSunday(currentDate) ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {isHolidayOrSunday(currentDate) ? '휴무일 모드' : '평일 근무 모드'}
            </span>
            <button 
              onClick={() => loadData(true)}
              className="flex items-center justify-center px-4 py-2 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 border border-gray-200 font-bold shadow-sm transition-all text-sm active:scale-95"
            >
              <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />새로고침
            </button>
            <button 
              onClick={() => setIsDutyEditing(!isDutyEditing)}
              className={`flex items-center justify-center px-4 py-2 rounded-lg font-bold shadow-sm transition-all text-sm active:scale-95 ${isDutyEditing ? 'bg-rose-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              {isDutyEditing ? <><X size={18} className="mr-2" />수정취소</> : <><Edit2 size={18} className="mr-2" />수정</>}
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-[11px] font-black text-slate-400 mb-2 uppercase tracking-tighter">주간 근무</label>
                {isDutyEditing ? (
                  <input 
                    type="text" 
                    value={calculatedDuty.day || ''} 
                    onChange={(e) => updateDutyField('day', e.target.value)}
                    className="w-full bg-white border border-blue-200 rounded-2xl px-5 py-4 text-emerald-700 text-base font-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                ) : (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4 min-h-[60px] flex items-center">
                    <span className="text-emerald-700 font-black text-base">{calculatedDuty.day || '-'}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-[11px] font-black text-slate-400 mb-2 uppercase tracking-tighter">당직 근무</label>
                {isDutyEditing ? (
                  <input 
                    type="text" 
                    value={calculatedDuty.night || ''} 
                    onChange={(e) => updateDutyField('night', e.target.value)}
                    className="w-full bg-white border border-blue-200 rounded-2xl px-5 py-4 text-orange-700 text-base font-black focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                ) : (
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 min-h-[60px] flex items-center shadow-sm">
                    <UserCheck className="text-orange-500 mr-3 shrink-0" size={20} />
                    <span className="text-orange-700 font-black text-lg">{calculatedDuty.night || '-'}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-[11px] font-black text-slate-400 mb-2 uppercase tracking-tighter">비번 (휴무)</label>
                {isDutyEditing ? (
                  <input 
                    type="text" 
                    value={calculatedDuty.off || ''} 
                    onChange={(e) => updateDutyField('off', e.target.value)}
                    className="w-full bg-white border border-blue-200 rounded-2xl px-5 py-4 text-slate-700 text-base font-black focus:ring-2 focus:ring-slate-500 outline-none"
                  />
                ) : (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 min-h-[60px] flex items-center">
                    <span className="text-slate-500 font-bold text-sm">{calculatedDuty.off || '-'}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-[11px] font-black text-slate-400 mb-2 uppercase tracking-tighter">휴가 현황</label>
                <input 
                  type="text" 
                  value={dailyData?.facilityDuty?.vacation || ''} 
                  onChange={(e) => setDailyData(prev => prev ? {...prev, facilityDuty: {...(prev.facilityDuty || calculatedDuty), vacation: e.target.value}} : null)}
                  placeholder="휴가 인원 입력"
                  className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-slate-300"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 섹션: 업무 일지 통합 검색 (1행 통합 버전) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Search className="text-blue-600" size={20} />
            <h3 className="font-black text-slate-800 whitespace-nowrap">과거 업무 일지 검색</h3>
          </div>
          
          <select 
            value={selectedSearchYear} 
            onChange={e => setSelectedSearchYear(parseInt(e.target.value))} 
            className="px-4 py-3 border border-slate-300 rounded-xl font-bold bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all w-full lg:w-32"
          >
            {Array.from({length: 11}, (_, i) => (new Date().getFullYear() - 5) + i).map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>

          <div className="relative flex-1 w-full min-w-[200px]">
            <Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder={`${selectedSearchYear}년도 전체 기록 검색 (공백 무시)...`}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          
          <button 
            onClick={handleSearch} 
            disabled={isSearching}
            className="w-full lg:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap disabled:bg-slate-400"
          >
            {isSearching ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
            {isSearching ? "검색 중" : "검색하기"}
          </button>
        </div>
      </div>

      {/* 섹션 3: 금일 중요 업무 요약 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-indigo-600" size={20} />
            <h3 className="font-black text-slate-800">금일 중요 업무 요약</h3>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => loadData(true)}
              className="flex items-center justify-center px-4 py-2 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 border border-gray-200 font-bold shadow-sm transition-all text-sm active:scale-95"
            >
              <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />새로고침
            </button>
            <span className="text-[11px] font-bold text-slate-400 italic">업무일지 직접 입력 항목만 표시 (읽기 전용)</span>
          </div>
        </div>
        <div className="p-6">
          {keyWorkTasks.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-slate-300">
              <Activity size={48} className="mb-2" />
              <p className="font-bold">금일 등록된 중요 업무 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {keyWorkTasks.map((section, idx) => (
                <div key={idx} className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                    <div className="p-2 bg-white rounded-lg text-slate-500 shadow-sm">
                      {section.icon}
                    </div>
                    <span className="font-black text-slate-700 text-sm">{section.label}</span>
                  </div>
                  <ul className="space-y-2">
                    {section.tasks.map((task, tidx) => (
                      <li key={tidx} className="flex items-start gap-2 text-[13px] text-slate-600 font-medium leading-relaxed">
                        <CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 서버 저장 버튼 */}
      <div className="flex justify-center pt-4 print:hidden">
        <div className="w-full max-w-xl">
          <button 
            onClick={() => setShowConfirm(true)}
            disabled={saveStatus === 'loading'}
            className={`px-10 py-5 rounded-3xl shadow-xl transition-all duration-300 font-black text-xl flex items-center justify-center space-x-3 w-full active:scale-95 ${
              saveStatus === 'loading' ? 'bg-blue-400 text-white cursor-wait' : 
              saveStatus === 'success' ? 'bg-green-600 text-white' : 
              saveStatus === 'error' ? 'bg-rose-600 text-white' : 
              'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-2xl'
            }`}
          >
            {saveStatus === 'loading' ? (
              <><RefreshCw size={24} className="animate-spin" /><span>동기화 중...</span></>
            ) : saveStatus === 'success' ? (
              <><CheckCircle size={24} /><span>동기화 완료</span></>
            ) : (
              <><Save size={24} /><span>대시보드 통합 저장</span></>
            )}
          </button>
        </div>
      </div>

      {/* 검색 결과 모달 */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100 animate-scale-up">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg">
                  <Search size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 leading-tight">작업 내용 검색 결과</h3>
                  <p className="text-sm text-slate-500 font-medium mt-0.5">
                    <span className="text-blue-600 font-bold">"{searchKeyword}"</span> {selectedSearchYear}년 기록에서 <span className="text-slate-900 font-bold">{searchResults.length}건</span>이 발견되었습니다.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSearchModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                <X size={28} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              {searchResults.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <Search size={32} className="text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-bold text-lg">검색 결과가 없습니다.</p>
                  <p className="text-slate-300 text-sm mt-1">다른 검색어 또는 다른 연도를 시도해 보세요.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((res, idx) => (
                    <div key={res.id + idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all group">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${res.type === '금일' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                            {res.type}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
                            {res.category}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-slate-800 font-bold text-[15px] leading-relaxed group-hover:text-blue-700 transition-colors">
                            {res.content}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                            <Calendar size={12} />
                            <span>{res.date || dateKey} 업무기록</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setIsSearchModalOpen(false)}
                className="px-8 py-3 bg-slate-800 text-white font-black rounded-2xl hover:bg-slate-900 transition-all active:scale-95 shadow-lg shadow-blue-100"
              >
                확인 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-slate-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-100">
                <Cloud className="text-blue-600" size={36} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">대시보드 저장 확인</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                작성하신 근무 현황 및 휴가 데이터를<br/>
                서버에 안전하게 반영하시겠습니까?
              </p>
              
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center"><X size={20} className="mr-2" />취소</button>
                <button onClick={handleSave} className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95"><CheckCircle size={20} className="mr-2" />확인</button>
              </div>
            </div>
          </div>
        </div>
      )}

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

export default Dashboard;
