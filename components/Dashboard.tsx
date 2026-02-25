
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Calendar, 
  ClipboardList, 
  CheckCircle, 
  RefreshCw, 
  Save, 
  UserCircle, 
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
  Droplets,
  Thermometer,
  Wind,
  Sunrise,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { 
  fetchDailyData, 
  saveDailyData, 
  fetchStaffList, 
  getInitialDailyData, 
  supabase,
  fetchShiftSettings,
  saveShiftSettings
} from '../services/dataService';
import { DailyData, StaffMember, DutyStatus, WorkLogData, TaskItem, LogCategory, ShiftSettings, WeatherData } from '../types';
import { format, differenceInDays, parseISO } from 'date-fns';
import { isNonWorkingDay } from '../services/automationService';
import { WORK_LOG_TABS } from '../constants';
import { fetchWeatherInfo } from '../services/geminiService';

interface DashboardProps {
  currentDate: Date;
  isSearchPopupMode?: boolean;
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

const Dashboard: React.FC<DashboardProps> = ({ currentDate, isSearchPopupMode = false }) => {
  const [loading, setLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [dutyStatus, setDutyStatus] = useState<DutyStatus>(DEFAULT_DUTY);
  const [globalShift, setGlobalShift] = useState<ShiftSettings | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  const [searchKeyword, setSearchKeyword] = useState(() => {
    if (isSearchPopupMode) {
      const params = new URLSearchParams(window.location.search);
      return params.get('keyword') || '';
    }
    return '';
  });
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
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

    const duty: DutyStatus = {
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

  const loadWeather = async () => {
    setWeatherLoading(true);
    try {
      const weatherData = await fetchWeatherInfo(dateKey, false, "09:00");
      setWeather(weatherData);
    } catch (e) {
      console.error("Weather load error", e);
    } finally {
      setWeatherLoading(false);
    }
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
      loadWeather();
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
        alert('저장이 완료되었습니다.');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert('저장에 실패했습니다.');
      }
    } catch (err) {
      setSaveStatus('error');
      alert('오류가 발생했습니다.');
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
    setIsDutyEditing(false);
    setDutyWasEdited(true); 
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
          .filter((t: TaskItem) => t.id && (t.id.includes('task_') || t.id.includes('from_prev_')))
          .map((t: TaskItem) => t.content?.trim())
          .filter((c: string) => c && c !== '');
          
        if (taskContents.length > 0) {
          const uniqueContents = Array.from(new Set(taskContents));
          sections.push({ label: cat.label, icon: cat.icon, tasks: uniqueContents });
        }
      }
    });
    return sections;
  }, [dailyData]);

  const handleSearch = async (keywordOverride?: string) => {
    const keywordToSearch = keywordOverride || searchKeyword;
    if (!keywordToSearch.trim()) return;

    if (!isSearchPopupMode) {
      // 메인 화면에서는 새 창을 띄움
      const url = `${window.location.origin}${window.location.pathname}?popup=search&keyword=${encodeURIComponent(keywordToSearch)}`;
      window.open(url, 'search_results', 'width=1100,height=900,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes');
      return;
    }

    setIsSearching(true);
    try {
      // 전체 기간 검색을 위해 연도 필터링 제거
      const { data: searchData, error } = await supabase.from('daily_reports').select('*');
      if (error) throw error;
      const results: SearchResultItem[] = [];
      const keyword = keywordToSearch.replace(/\s+/g, '').toLowerCase();
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
      // 날짜 역순 정렬 (최신순)
      results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setSearchResults(results);
    } catch (err) { 
      alert("검색 중 오류 발생"); 
    } finally { 
      setIsSearching(false); 
    }
  };

  useEffect(() => {
    if (isSearchPopupMode && searchKeyword) {
      handleSearch(searchKeyword);
    }
  }, [isSearchPopupMode]);

  const facilityStaffDisplay = useMemo(() => {
    const list = staffList.filter(s => s.category === '시설');
    const engineers = list.filter(s => s.jobTitle?.includes('기사') && (!s.resignDate || s.resignDate === '' || s.resignDate >= dateKey)).sort((a, b) => (a.joinDate || '').localeCompare(b.joinDate || ''));
    return {
      deputy: list.find(s => s.jobTitle?.includes('대리'))?.name || '미지정',
      chief: list.find(s => s.jobTitle?.includes('주임'))?.name || '미지정',
      engineers: engineers.map(e => e.name)
    };
  }, [staffList, dateKey]);

  if (isSearchPopupMode) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="p-8 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl">
              <Search size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">과거 업무 일지 검색 결과</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Search Engine Results (All Periods)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="검색어 입력..." 
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none font-bold focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all" 
                value={searchKeyword} 
                onChange={(e) => setSearchKeyword(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()} 
              />
            </div>
            <button onClick={() => handleSearch()} disabled={isSearching} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black shadow-md hover:bg-blue-700 transition-all flex items-center gap-2 whitespace-nowrap active:scale-95 disabled:bg-slate-400">
              {isSearching ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
              검색
            </button>
            <button onClick={() => window.close()} className="px-6 py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-black transition-all shadow-md active:scale-95">닫기</button>
          </div>
        </div>
        <div className="flex-1 p-8">
          {isSearching ? (
            <div className="py-32 text-center flex flex-col items-center">
              <RefreshCw size={64} className="text-blue-100 mb-4 animate-spin" />
              <p className="text-slate-400 font-black text-xl">데이터를 검색하고 있습니다...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-32 text-center flex flex-col items-center">
              <Search size={64} className="text-slate-100 mb-4" />
              <p className="text-slate-400 font-black text-xl">검색 결과가 존재하지 않습니다.</p>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="mb-4 text-sm font-bold text-slate-500">총 {searchResults.length}건의 결과가 검색되었습니다.</div>
              {searchResults.map((res, idx) => (
                <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group">
                  <div className="flex items-start gap-5">
                    <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                      <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${res.type === '금일' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>{res.type}</span>
                      <span className="text-[11px] font-black text-slate-400 whitespace-nowrap mt-1">{res.category}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-800 font-black text-lg leading-relaxed group-hover:text-blue-700 transition-colors">{res.content}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-bold">
                        <Calendar size={14} />
                        <span>작성일자: {res.date}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-3 pb-20">
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="text-emerald-600" size={20} />
              <h3 className="font-black text-xl text-slate-800 tracking-tight">금일 시설 근무 현황</h3>
            </div>
            <span className={`px-6 py-2.5 rounded-xl font-bold text-sm uppercase tracking-widest shadow-md transition-colors ${isHolidayMode ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'}`}>
              {isHolidayMode ? '휴일 근무' : '평일 근무'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => loadData('2-shift')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all border shadow-sm active:scale-95 ${isAutoActiveOnCurrentDate('2-shift') ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              <Power size={16} />
              2교대 자동 {isAutoActiveOnCurrentDate('2-shift') ? '[ON]' : '[OFF]'}
            </button>

            <button 
              onClick={() => loadData('3-shift')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all border shadow-sm active:scale-95 ${isAutoActiveOnCurrentDate('3-shift') ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              <Power size={16} />
              3교대 자동 {isAutoActiveOnCurrentDate('3-shift') ? '[ON]' : '[OFF]'}
            </button>

            <div className="h-6 w-px bg-slate-200 mx-1"></div>

            {isDutyEditing ? (
              <div className="flex gap-2">
                <button onClick={handleLocalConfirm} className="flex items-center px-6 py-2.5 bg-orange-600 text-white rounded-xl font-bold shadow-md text-sm active:scale-95">
                  <CheckCircle size={18} className="mr-2" />편집완료
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={startManualEdit} className="flex items-center px-6 py-2.5 bg-gray-100 text-slate-600 border border-slate-200 rounded-xl font-bold shadow-sm text-sm hover:bg-gray-200 active:scale-95"><Edit2 size={18} className="mr-2" />편집</button>
                <button 
                  onClick={() => handleSave(dutyWasEdited)} 
                  disabled={saveStatus === 'loading'} 
                  className={`flex items-center px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md active:scale-95 ${saveStatus === 'loading' ? 'bg-blue-400 text-white cursor-wait' : saveStatus === 'success' ? 'bg-green-600 text-white' : saveStatus === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {saveStatus === 'loading' ? <RefreshCw size={18} className="animate-spin mr-2" /> : saveStatus === 'success' ? <CheckCircle size={18} className="mr-2" /> : <Save size={18} className="mr-2" />}
                  {saveStatus === 'loading' ? '저장 중...' : saveStatus === 'success' ? '저장 완료' : '서버저장'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-400 flex items-center justify-between uppercase tracking-tighter">주간 {isHolidayMode && <span className="text-rose-500 font-bold">[휴무]</span>}</label>
              {isDutyEditing ? (
                <input type="text" value={dutyStatus.day || ''} onChange={(e) => updateDutyField('day', e.target.value)} className="w-full bg-emerald-50/30 border-2 border-emerald-200 rounded-2xl px-5 py-4 text-emerald-700 text-lg font-black outline-none focus:ring-2 focus:ring-emerald-400" placeholder="성명" />
              ) : (
                <div className={`border-2 rounded-2xl px-5 py-4 min-h-[70px] flex items-center justify-center shadow-sm ${isHolidayMode ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-emerald-50 border-emerald-100'}`}><span className={`${isHolidayMode ? 'text-slate-400' : 'text-emerald-700'} font-black text-xl tracking-tight`}>{dutyStatus.day || (isHolidayMode ? '휴무' : '-')}</span></div>
              )}
            </div>
            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-tighter">당직</label>
              {isDutyEditing ? (
                <input type="text" value={dutyStatus.night || ''} onChange={(e) => updateDutyField('night', e.target.value)} className="w-full bg-orange-50/30 border-2 border-orange-200 rounded-2xl px-5 py-4 text-blue-600 text-lg font-black outline-none focus:ring-2 focus:ring-orange-400" placeholder="성명" />
              ) : (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl px-5 py-4 min-h-[70px] flex items-center justify-center shadow-sm"><span className="text-blue-600 font-black text-xl tracking-tight">{dutyStatus.night || '-'}</span></div>
              )}
            </div>
            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-tighter">비번</label>
              {isDutyEditing ? (
                <input type="text" value={dutyStatus.off || ''} onChange={(e) => updateDutyField('off', e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-4 text-slate-700 text-lg font-black outline-none focus:ring-2 focus:ring-slate-400" placeholder="성명" />
              ) : (
                <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 min-h-[70px] flex items-center justify-center shadow-sm"><span className="text-slate-700 font-black text-xl tracking-tight">{dutyStatus.off || '-'}</span></div>
              )}
            </div>
            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-tighter">휴가</label>
              {isDutyEditing ? (
                <input type="text" value={dutyStatus.vacation || ''} onChange={(e) => updateDutyField('vacation', e.target.value)} className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 text-slate-900 text-lg font-black outline-none focus:ring-2 focus:ring-slate-400" placeholder="휴가 인원" />
              ) : (
                <div className="bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 min-h-[70px] flex items-center justify-center shadow-sm"><span className="text-slate-900 font-black text-xl tracking-tight">{dutyStatus.vacation || '-'}</span></div>
              )}
            </div>
          </div>
          
          <div className="mt-6 flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-inner">
            <AlertCircle size={14} className="text-blue-400" />
            <span className="uppercase tracking-widest">기준 로테이션 일자: <span className="text-blue-600">{globalShift?.baseDate || 'N/A'}</span> | 모드: <span className="text-slate-800">{globalShift?.mode === 'manual' ? '수동' : globalShift?.mode === '2-shift' ? '2교대 자동' : '3교대 자동'}</span></span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col lg:flex-row items-center gap-6">
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg text-white"><Search size={24} /></div>
          <div>
            <h3 className="font-black text-xl text-slate-800 tracking-tight">과거 업무 일지 검색</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Archive Retrieval System</p>
          </div>
        </div>
        <div className="flex flex-1 w-full gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="전체 기간 기록에서 검색어 입력..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-base outline-none font-bold focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          </div>
          <button onClick={() => handleSearch()} disabled={isSearching} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2 whitespace-nowrap active:scale-95 disabled:bg-slate-400">
            {isSearching ? <RefreshCw size={20} className="animate-spin" /> : <Search size={20} />}
            {isSearching ? "검색 중" : "검색하기"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-indigo-600" size={20} />
            <h3 className="font-black text-xl text-slate-800 tracking-tight">금일 중요 업무 요약</h3>
          </div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operational Summary</div>
        </div>
        <div className="p-6">
          {keyWorkTasks.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-slate-300">
              <Activity size={64} className="mb-4 opacity-50" />
              <p className="font-black text-lg uppercase tracking-widest">No active tasks found for today</p>
              <p className="text-sm font-medium">업무일지에 등록된 실적이나 예정사항이 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {keyWorkTasks.map((section, idx) => (
                <div key={idx} className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 hover:border-indigo-200 transition-colors group">
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                    <div className="p-2.5 bg-white rounded-xl text-slate-500 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">{section.icon}</div>
                    <span className="font-black text-slate-800 tracking-tight">{section.label}</span>
                  </div>
                  <ul className="space-y-3">
                    {section.tasks.map((task, tidx) => (
                      <li key={tidx} className="flex items-start gap-3 text-sm text-slate-600 font-bold leading-relaxed">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></div>
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


      {isSearchModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md shadow-2xl">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100">
            <div className="p-8 bg-slate-50 border-b border-slate-200 flex justify-between items-center"><div className="flex items-center gap-4"><div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl"><Search size={28} /></div><div><h3 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">작업 내용 검색 결과</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Search Engine Results</p></div></div><button onClick={() => setIsSearchModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"><X size={32} /></button></div>
            <div className="flex-1 overflow-y-auto p-8 bg-white">
              {searchResults.length === 0 ? (<div className="py-32 text-center flex flex-col items-center"><Search size={64} className="text-slate-100 mb-4" /><p className="text-slate-400 font-black text-xl">검색 결과가 존재하지 않습니다.</p></div>) : (
                <div className="space-y-4">{searchResults.map((res, idx) => (<div key={idx} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"><div className="flex items-start gap-5"><div className="flex flex-col items-center gap-1 shrink-0 pt-1"><span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${res.type === '금일' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>{res.type}</span><span className="text-[11px] font-black text-slate-400 whitespace-nowrap mt-1">{res.category}</span></div><div className="flex-1"><p className="text-slate-800 font-black text-lg leading-relaxed group-hover:text-blue-700 transition-colors">{res.content}</p><div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-bold"><Calendar size={14} /><span>REPORT DATE: {res.date}</span></div></div></div></div>))}</div>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end"><button onClick={() => setIsSearchModalOpen(false)} className="px-10 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95">닫기</button></div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scale-up { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-up { animation: scale-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default Dashboard;
