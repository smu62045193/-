
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
  User,
  Power,
  PowerOff,
  Droplets,
  RotateCcw
} from 'lucide-react';
import { 
  fetchDailyData, 
  saveDailyData, 
  fetchStaffList, 
  getInitialDailyData, 
  apiFetchRange, 
  supabase,
  fetchShiftSettings,
  saveShiftSettings
} from '../services/dataService';
import { DailyData, StaffMember, DutyStatus, WorkLogData, TaskItem, LogCategory, ShiftSettings } from '../types';
import { format, differenceInDays, parseISO } from 'date-fns';
import { isNonWorkingDay } from '../services/automationService';
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

const DEFAULT_DUTY: DutyStatus = { 
  day: '', 
  night: '', 
  off: '', 
  vacation: '', 
  deputy: '', 
  chief: '',
  shiftMode: 'manual',
  baseDate: ''
};

const Dashboard: React.FC<DashboardProps> = ({ currentDate }) => {
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [dutyStatus, setDutyStatus] = useState<DutyStatus>(DEFAULT_DUTY);
  const [globalShift, setGlobalShift] = useState<ShiftSettings | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [selectedSearchYear, setSelectedSearchYear] = useState(new Date().getFullYear()); 
  const [isSearching, setIsSearching] = useState(false); 

  const [isDutyEditing, setIsDutyEditing] = useState(false);
  const [dutyWasEdited, setDutyWasEdited] = useState(false);

  const dateKey = format(currentDate, 'yyyy-MM-dd');

  const calculateAutoDutyBySeed = (
    date: Date, 
    settings: ShiftSettings,
    staff: StaffMember[]
  ): DutyStatus => {
    const isNonWorking = isNonWorkingDay(date);
    const list = staff.filter(s => s.category === '시설');
    const deputyName = list.find(s => s.jobTitle?.includes('대리'))?.name || '미지정';
    const chiefName = list.find(s => s.jobTitle?.includes('주임'))?.name || '미지정';

    const baseDate = parseISO(settings.baseDate);
    const diffDays = differenceInDays(date, baseDate);
    
    if (diffDays < 0) {
      return { 
        ...DEFAULT_DUTY, 
        deputy: deputyName, 
        chief: chiefName, 
        shiftMode: 'manual' 
      };
    }

    const names = [...settings.seedOrder];
    
    if (names.length > 0) {
      const rotationCount = diffDays % names.length;
      for (let i = 0; i < rotationCount; i++) {
        const last = names.pop();
        if (last) names.unshift(last);
      }
    }

    let duty: DutyStatus = {
      day: '', night: '', off: '', vacation: '',
      deputy: deputyName, chief: chiefName,
      shiftMode: settings.mode,
      baseDate: settings.baseDate
    };

    if (settings.mode === '3-shift') {
      duty.day = names[0] || '';
      duty.night = names[1] || '';
      duty.off = names.slice(2).join(', ') || '';

      if (isNonWorking && duty.day) {
        duty.off = duty.off ? `${duty.day}, ${duty.off}` : duty.day;
        duty.day = '';
      }
    } else {
      duty.night = names[0] || '';
      duty.off = names.slice(1).join(', ') || '';
      duty.day = '';
    }

    return duty;
  };

  const isAutoActiveOnCurrentDate = (mode: '2-shift' | '3-shift') => {
    if (!globalShift || globalShift.mode !== mode || !globalShift.baseDate) return false;
    const baseDate = parseISO(globalShift.baseDate);
    return differenceInDays(currentDate, baseDate) >= 0;
  };

  const loadData = async (triggerMode?: '2-shift' | '3-shift' | 'refresh') => {
    setLoading(true);
    try {
      const [staff, currentReport, settings] = await Promise.all([
        fetchStaffList(),
        fetchDailyData(dateKey, false),
        fetchShiftSettings()
      ]);
      
      setStaffList(staff || []);
      setGlobalShift(settings);
      
      const report = currentReport || getInitialDailyData(dateKey);
      setDailyData(report);

      const activeEngineers = (staff || []).filter(s => 
        s.category === '시설' && 
        s.jobTitle?.includes('기사') && 
        (!s.resignDate || s.resignDate === '' || s.resignDate >= dateKey)
      );

      if (triggerMode === '2-shift' || triggerMode === '3-shift') {
        const isCurrentlyActive = settings?.mode === triggerMode;
        
        if (isCurrentlyActive) {
          const manualSettings: ShiftSettings = { mode: 'manual', baseDate: dateKey, seedOrder: [] };
          await saveShiftSettings(manualSettings);
          setGlobalShift(manualSettings);
          setDutyStatus({ ...dutyStatus, shiftMode: 'manual' });
          alert(`${triggerMode === '2-shift' ? '2교대' : '3교대'} 자동화가 정지되었습니다.`);
        } else {
          const minRequired = triggerMode === '2-shift' ? 2 : 3;
          if (activeEngineers.length < minRequired) {
            alert(`기사가 ${activeEngineers.length}명입니다. ${minRequired}명 이상 필요합니다.`);
            setLoading(false);
            return;
          }

          const seedNames = triggerMode === '3-shift' 
            ? [dutyStatus.day, dutyStatus.night, ...dutyStatus.off.split(',').map(s=>s.trim())].filter(n => n && n !== '-' && n !== '')
            : [dutyStatus.night, ...dutyStatus.off.split(',').map(s=>s.trim())].filter(n => n && n !== '-' && n !== '');

          const finalSeed = seedNames.length >= minRequired ? seedNames : activeEngineers.map(e => e.name);

          const newSettings: ShiftSettings = {
            mode: triggerMode,
            baseDate: dateKey,
            seedOrder: finalSeed
          };

          await saveShiftSettings(newSettings);
          setGlobalShift(newSettings);
          const newDuty = calculateAutoDutyBySeed(currentDate, newSettings, staff || []);
          setDutyStatus(newDuty);
          alert(`${triggerMode === '2-shift' ? '2교대' : '3교대'} 자동화가 시작되었습니다.`);
        }
      } 
      else {
        if (settings && settings.mode !== 'manual') {
          const baseDate = parseISO(settings.baseDate);
          const isBeforeBaseDate = differenceInDays(currentDate, baseDate) < 0;

          if (isBeforeBaseDate) {
            if (currentReport?.facilityDuty) {
              setDutyStatus(currentReport.facilityDuty);
            } else {
              setDutyStatus(DEFAULT_DUTY);
            }
          } else {
            const autoDuty = calculateAutoDutyBySeed(currentDate, settings, staff || []);
            setDutyStatus(autoDuty);
          }
        } else if (currentReport?.facilityDuty) {
          setDutyStatus(currentReport.facilityDuty);
        } else {
          setDutyStatus(DEFAULT_DUTY);
        }
      }
    } catch (err) {
      console.error("Dashboard load error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setIsDutyEditing(false);
    setDutyWasEdited(false);
  }, [dateKey]);

  const handleSave = async (isConfirmShift = false) => {
    if (!dailyData) return;
    setShowConfirm(false);
    setSaveStatus('loading');
    try {
      const updatedStatus = { ...dutyStatus };
      
      if (isConfirmShift) {
        const seedNames = [dutyStatus.day, dutyStatus.night, ...dutyStatus.off.split(',').map(s=>s.trim())]
          .filter(n => n && n !== '-' && n !== '');
        
        const newSettings: ShiftSettings = {
          mode: globalShift?.mode || 'manual',
          baseDate: dateKey,
          seedOrder: seedNames
        };
        await saveShiftSettings(newSettings);
        setGlobalShift(newSettings);
        updatedStatus.baseDate = dateKey;
        updatedStatus.shiftMode = globalShift?.mode || 'manual';
      }

      const updatedData: DailyData = {
        ...dailyData,
        facilityDuty: updatedStatus,
        lastUpdated: new Date().toISOString()
      };
      const success = await saveDailyData(updatedData);
      if (success) {
        setSaveStatus('success');
        setDailyData(updatedData);
        setIsDutyEditing(false);
        setDutyWasEdited(false);
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const updateDutyField = (field: keyof DutyStatus, value: string) => {
    setDutyStatus(prev => ({ ...prev, [field]: value }));
  };

  const handleCancelEdit = () => {
    if (dailyData?.facilityDuty) setDutyStatus(dailyData.facilityDuty);
    setIsDutyEditing(false);
    setDutyWasEdited(false);
  };

  const startManualEdit = () => {
    setIsDutyEditing(true);
  };

  const handleLocalConfirm = () => {
    // 수동확정 시 로컬 상태만 변경하고 편집 모드 종료
    setIsDutyEditing(false);
    setDutyWasEdited(true); // 수정사항이 있음을 표시하여 통합 저장 시 반영하도록 함
  };

  const isHolidayMode = isNonWorkingDay(currentDate);

  const keyWorkTasks = useMemo(() => {
    if (!dailyData?.workLog) return [];
    const sections: { label: string; icon: React.ReactNode; tasks: string[] }[] = [];
    const workLog = dailyData.workLog;
    const categories: { key: keyof WorkLogData; label: string; icon: React.ReactNode }[] = [
      { key: 'electrical', label: '전기 설비', icon: <Zap size={16} /> },
      { key: 'mechanical', label: '기계 설비', icon: <Wrench size={16} /> },
      { key: 'fire', label: '소방 안전', icon: <Flame size={16} /> },
      { key: 'elevator', label: '승강기 관리', icon: <ArrowUpDown size={16} /> },
      { key: 'parking', label: '주차 관리', icon: <Car size={16} /> },
      { key: 'security', label: '경비 보안', icon: <ShieldAlert size={16} /> },
      { key: 'cleaning', label: '미화 위생', icon: <Droplets size={16} /> },
      { key: 'handover', label: '특이사항', icon: <Edit2 size={16} /> }
    ];
    categories.forEach(cat => {
      const log = (workLog as any)[cat.key] as LogCategory;
      if (log?.today) {
        const taskContents = log.today
          .filter((t: TaskItem) => t.id && t.id.includes('task_'))
          .map((t: TaskItem) => t.content)
          .filter((c: string) => c && c.trim() !== '');
          
        if (taskContents.length > 0) sections.push({ label: cat.label, icon: cat.icon, tasks: taskContents });
      }
    });
    return sections;
  }, [dailyData]);

  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;
    setIsSearching(true);
    try {
      const { data: searchData, error } = await supabase.from('daily_reports').select('*').like('id', `${selectedSearchYear}-%`);
      if (error) throw error;
      const results: SearchResultItem[] = [];
      const keyword = searchKeyword.replace(/\s+/g, '').toLowerCase();
      (searchData || []).forEach(report => {
        const workLog = report.work_log as WorkLogData;
        if (!workLog) return;
        Object.entries(workLog).forEach(([catKey, catValue]) => {
          if (catKey === 'scheduled' || catKey === 'mechanicalChemicals') return;
          const category = WORK_LOG_TABS.find(t => t.id === catKey)?.label || catKey;
          const logCat = catValue as LogCategory;
          if (logCat.today) logCat.today.forEach(task => {
            if (task.content && task.content.replace(/\s+/g, '').toLowerCase().includes(keyword)) {
              results.push({ id: task.id, category, type: '금일', content: task.content, date: report.id });
            }
          });
        });
      });
      setSearchResults(results);
      setIsSearchModalOpen(true);
    } catch (err) { alert("검색 중 오류 발생"); } finally { setIsSearching(false); }
  };

  const facilityStaffDisplay = useMemo(() => {
    const list = staffList.filter(s => s.category === '시설');
    const engineers = list.filter(s => s.jobTitle?.includes('기사') && (!s.resignDate || s.resignDate === '' || s.resignDate >= dateKey)).sort((a, b) => (a.joinDate || '').localeCompare(b.joinDate || ''));
    return {
      deputy: list.find(s => s.jobTitle?.includes('대리'))?.name || '미지정',
      chief: list.find(s => s.jobTitle?.includes('주임'))?.name || '미지정',
      engineers: engineers.map(e => e.name)
    };
  }, [staffList, dateKey]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-20">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-blue-600" size={20} />
            <h3 className="font-black text-slate-800">시설팀 인원 현황</h3>
          </div>
          <button onClick={() => loadData('refresh')} className="flex items-center px-4 py-2 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 border border-gray-200 font-bold shadow-sm transition-all text-sm active:scale-95">
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />데이터 갱신
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2"><label className="text-[11px] font-black text-slate-400">대리</label><div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 min-h-[60px] flex items-center"><UserCircle className="text-blue-500 mr-3 shrink-0" size={20} /><span className="text-blue-700 font-black truncate">{facilityStaffDisplay.deputy}</span></div></div>
            <div className="space-y-2"><label className="text-[11px] font-black text-slate-400">주임</label><div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 min-h-[60px] flex items-center"><UserCircle className="text-indigo-500 mr-3 shrink-0" size={20} /><span className="text-indigo-700 font-black truncate">{facilityStaffDisplay.chief}</span></div></div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2"><label className="text-[11px] font-black text-slate-400">기사 {i + 1}</label><div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 min-h-[60px] flex items-center"><User className="text-slate-500 mr-3 shrink-0" size={18} /><span className="text-slate-800 font-black truncate">{facilityStaffDisplay.engineers[i] || '공석'}</span></div></div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="text-emerald-600" size={20} />
              <h3 className="font-black text-slate-800">금일 시설 근무 현황</h3>
            </div>
            <span className={`px-4 py-1.5 rounded-full text-[12px] font-black uppercase tracking-widest shadow-md transition-colors ${isHolidayMode ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
              {isHolidayMode ? '휴무일 모드' : '평일 근무 모드'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => loadData('refresh')} className="p-2.5 bg-white text-slate-600 rounded-xl hover:bg-slate-50 border border-slate-200 shadow-sm transition-all active:scale-95" title="새로고침">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>

            <button 
              onClick={() => loadData('2-shift')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border shadow-sm active:scale-95 ${isAutoActiveOnCurrentDate('2-shift') ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              <Power size={16} />
              2교대 자동 {isAutoActiveOnCurrentDate('2-shift') ? '[작동중]' : '[정지]'}
            </button>

            <button 
              onClick={() => loadData('3-shift')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border shadow-sm active:scale-95 ${isAutoActiveOnCurrentDate('3-shift') ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              <Power size={16} />
              3교대 자동 {isAutoActiveOnCurrentDate('3-shift') ? '[작동중]' : '[정지]'}
            </button>

            {isDutyEditing ? (
              <div className="flex gap-2">
                <button onClick={handleCancelEdit} className="flex items-center px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold text-sm active:scale-95"><X size={18} className="mr-2" />취소</button>
                <button onClick={handleLocalConfirm} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-md text-sm active:scale-95">
                  <CheckCircle size={18} className="mr-2" />수동확정
                </button>
              </div>
            ) : (
              <button onClick={startManualEdit} className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-xl font-bold shadow-md text-sm hover:bg-slate-900 active:scale-95"><Edit2 size={18} className="mr-2" />수정</button>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-4">
              <label className="text-[11px] font-black text-slate-400 flex items-center justify-between">주간 근무 {isHolidayMode && <span className="text-rose-500 font-bold">[비번전환]</span>}</label>
              {isDutyEditing ? (
                <input type="text" value={dutyStatus.day || ''} onChange={(e) => updateDutyField('day', e.target.value)} className="w-full bg-white border-2 border-emerald-200 rounded-2xl px-5 py-4 text-emerald-700 text-base font-black outline-none" placeholder="성명 입력" />
              ) : (
                <div className={`border-2 rounded-2xl px-5 py-4 min-h-[64px] flex items-center ${isHolidayMode ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-emerald-50 border-emerald-100'}`}><span className={`${isHolidayMode ? 'text-slate-400' : 'text-emerald-700'} font-black text-base`}>{dutyStatus.day || (isHolidayMode ? '휴무' : '-')}</span></div>
              )}
            </div>
            <div className="space-y-4">
              <label className="text-[11px] font-black text-slate-400">당직 근무</label>
              {isDutyEditing ? (
                <input type="text" value={dutyStatus.night || ''} onChange={(e) => updateDutyField('night', e.target.value)} className="w-full bg-white border-2 border-orange-200 rounded-2xl px-5 py-4 text-orange-700 text-base font-black outline-none" placeholder="성명 입력" />
              ) : (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl px-5 py-4 min-h-[64px] flex items-center shadow-sm"><UserCheck className="text-orange-500 mr-3 shrink-0" size={20} /><span className="text-orange-700 font-black text-lg">{dutyStatus.night || '-'}</span></div>
              )}
            </div>
            <div className="space-y-4">
              <label className="text-[11px] font-black text-slate-400">비번 (휴무)</label>
              {isDutyEditing ? (
                <input type="text" value={dutyStatus.off || ''} onChange={(e) => updateDutyField('off', e.target.value)} className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 text-slate-700 text-base font-black outline-none" placeholder="성명 입력" />
              ) : (
                <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 min-h-[64px] flex items-center"><span className="text-slate-500 font-bold text-sm">{dutyStatus.off || '-'}</span></div>
              )}
            </div>
            <div className="space-y-4">
              <label className="text-[11px] font-black text-slate-400">휴가/연차 현황</label>
              <input type="text" value={dutyStatus.vacation || ''} onChange={(e) => updateDutyField('vacation', e.target.value)} placeholder="휴가 인원 입력" className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 text-slate-900 text-sm font-bold outline-none transition-all" />
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <AlertCircle size={14} className="text-blue-400" />
            <span>순환 기준일: <span className="text-blue-600">{globalShift?.baseDate || '미설정'}</span> | 모드: <span className="text-slate-800">{globalShift?.mode === 'manual' ? '수동 정지중' : globalShift?.mode === '2-shift' ? '2교대 작동중' : '3교대 작동중'}</span></span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row items-center gap-4">
          <div className="flex items-center gap-2 shrink-0"><Search className="text-blue-600" size={20} /><h3 className="font-black text-slate-800 whitespace-nowrap">과거 업무 일지 검색</h3></div>
          <select value={selectedSearchYear} onChange={e => setSelectedSearchYear(parseInt(e.target.value))} className="px-4 py-3 border border-slate-300 rounded-xl font-bold bg-white text-sm outline-none w-full lg:w-32">
            {Array.from({length: 11}, (_, i) => (new Date().getFullYear() - 5) + i).map(y => (<option key={y} value={y}>{y}년</option>))}
          </select>
          <div className="relative flex-1 w-full min-w-[200px]"><Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
          <input type="text" placeholder={`${selectedSearchYear}년도 전체 기록 검색...`} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none font-medium" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} /></div>
          <button onClick={handleSearch} disabled={isSearching} className="w-full lg:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2 whitespace-nowrap disabled:bg-slate-400">{isSearching ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}{isSearching ? "검색 중" : "검색하기"}</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2"><ClipboardList className="text-indigo-600" size={20} /><h3 className="font-black text-slate-800">금일 중요 업무 요약</h3></div>
        </div>
        <div className="p-6">
          {keyWorkTasks.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-slate-300"><Activity size={48} className="mb-2" /><p className="font-bold">금일 등록된 중요 업무 내역이 없습니다.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {keyWorkTasks.map((section, idx) => (
                <div key={idx} className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100"><div className="p-2 bg-white rounded-lg text-slate-500 shadow-sm">{section.icon}</div><span className="font-black text-slate-700 text-sm">{section.label}</span></div>
                  <ul className="space-y-2">{section.tasks.map((task, tidx) => (<li key={tidx} className="flex items-start gap-2 text-[13px] text-slate-600 font-medium leading-relaxed"><CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" /><span>{task}</span></li>))}</ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center pt-4 print:hidden">
        <div className="w-full max-xl:max-w-xl">
          <button onClick={() => setShowConfirm(true)} disabled={saveStatus === 'loading'} className={`px-10 py-5 rounded-3xl shadow-xl transition-all duration-300 font-black text-xl flex items-center justify-center space-x-3 w-full active:scale-95 ${saveStatus === 'loading' ? 'bg-blue-400 text-white cursor-wait' : saveStatus === 'success' ? 'bg-green-600 text-white' : saveStatus === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'}`}>
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

      {isSearchModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center"><div className="flex items-center gap-3"><div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg"><Search size={24} /></div><div><h3 className="text-xl font-black text-slate-900 leading-tight">작업 내용 검색 결과</h3></div></div><button onClick={() => setIsSearchModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"><X size={28} /></button></div>
            <div className="flex-1 overflow-y-auto p-6">
              {searchResults.length === 0 ? (<div className="py-20 text-center"><p className="text-slate-400 font-bold text-lg">검색 결과가 없습니다.</p></div>) : (
                <div className="space-y-3">{searchResults.map((res, idx) => (<div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all"><div className="flex items-start gap-4"><div className="flex flex-col items-center gap-1 shrink-0 pt-1"><span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${res.type === '금일' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>{res.type}</span><span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">{res.category}</span></div><div className="flex-1"><p className="text-slate-800 font-bold text-[15px] leading-relaxed">{res.content}</p><div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400 font-medium"><Calendar size={12} /><span>{res.date} 업무기록</span></div></div></div></div>))}</div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end"><button onClick={() => setIsSearchModalOpen(false)} className="px-8 py-3 bg-slate-800 text-white font-black rounded-2xl hover:bg-slate-900 transition-all shadow-lg shadow-blue-100">닫기</button></div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-100">
                <Cloud className="text-blue-600" size={36} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">대시보드 저장 확인</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">작성하신 근무 현황 및 휴가 데이터를<br/>서버에 안전하게 기록하시겠습니까?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center"><X size={20} className="mr-2" />취소</button>
                <button onClick={() => handleSave(dutyWasEdited)} className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95"><CheckCircle size={20} className="mr-2" />확인</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
