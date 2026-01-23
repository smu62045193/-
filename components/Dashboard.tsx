import React, { useState, useEffect, useRef } from 'react';
import { Save, User, UserCog, Zap, Flame, Droplets, RefreshCw, CheckCircle, Cloud, X, Info } from 'lucide-react';
import { DutyStatus, UtilityUsage, DailyData } from '../types';
import { fetchDailyData, saveDailyData, getInitialDailyData } from '../services/dataService';
import { format } from 'date-fns';

interface DashboardProps {
  currentDate: Date;
}

const DutySection = ({ 
  title, 
  data, 
  onUpdate, 
  colorClass,
  dateLabel 
}: { 
  title: string, 
  data: DutyStatus, 
  onUpdate: (data: DutyStatus) => void, 
  colorClass: string,
  dateLabel: string
}) => {
  const safeData = data || { day: '', night: '', off: '', vacation: '' };
  
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 flex flex-col h-full hover:shadow-md transition-all duration-300">
      <div className={`flex items-center justify-between mb-8 pb-6 border-b border-slate-50 ${colorClass}`}>
        <div className="flex items-center space-x-4">
          <div className="p-4 rounded-2xl bg-current bg-opacity-10">
            {title.includes('시설') ? <UserCog size={30} /> : <User size={30} />}
          </div>
          <div>
            <h3 className="font-black text-2xl text-slate-800 leading-none">{title}</h3>
            <span className="text-xs text-slate-400 font-bold mt-2 block tracking-widest uppercase">{dateLabel} 현황</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
        {['주간', '당직', '비번', '휴가'].map((label, idx) => {
          const key = ['day', 'night', 'off', 'vacation'][idx] as keyof DutyStatus;
          return (
            <div key={key} className="flex flex-col">
              <label className="text-[11px] font-black text-slate-400 mb-2 uppercase tracking-tighter">{label}</label>
              <input 
                type="text" 
                value={safeData[key] || ''} 
                onChange={(e) => onUpdate({ ...safeData, [key]: e.target.value })}
                className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-center placeholder-slate-300"
                placeholder="입력"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const EnergyCard = ({ 
  label, 
  value, 
  unit, 
  onChange, 
  icon, 
  subLabel 
}: { 
  label: string, 
  value: string, 
  unit: string, 
  onChange: (val: string) => void, 
  icon: React.ReactNode, 
  subLabel: string 
}) => (
  <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex items-center space-x-5 hover:border-blue-300 transition-all duration-300 group">
    <div className="p-4 bg-slate-50 rounded-2xl text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors shadow-inner">
      {icon}
    </div>
    <div className="flex-1">
      <div className="flex justify-between items-center mb-1">
        <h4 className="font-black text-slate-700 tracking-tight">{label}</h4>
        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-bold">{subLabel}</span>
      </div>
      <div className="flex items-baseline justify-end space-x-2">
        <input 
          type="text" 
          value={value || ''} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full max-w-[140px] text-3xl font-black text-slate-900 bg-transparent border-b-2 border-transparent focus:border-blue-500 focus:outline-none placeholder-slate-200 text-right pr-2"
          placeholder="0"
        />
        <span className="text-slate-400 font-black text-sm uppercase">{unit}</span>
      </div>
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ currentDate }) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showConfirm, setShowConfirm] = useState(false);
  const [fullData, setFullData] = useState<DailyData | null>(null);
  
  const [facilityDuty, setFacilityDuty] = useState<DutyStatus>({ day: '', night: '', off: '', vacation: '' });
  const [securityDuty, setSecurityDuty] = useState<DutyStatus>({ day: '', night: '', off: '', vacation: '' });
  const [utility, setUtility] = useState<UtilityUsage>({ electricity: '', hvacGas: '', boilerGas: '' });

  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const displayDate = format(currentDate, 'yyyy.MM.dd');
  
  const isInitialLoad = useRef(true);

  const loadData = async () => {
    setLoading(true);
    isInitialLoad.current = true;
    setSaveStatus('idle');
    try {
      const data = await fetchDailyData(dateKey);
      if (!data) throw new Error("Data not found");
      setFullData(data);
      setFacilityDuty(data.facilityDuty || { day: '', night: '', off: '', vacation: '' });
      setSecurityDuty(data.securityDuty || { day: '', night: '', off: '', vacation: '' });
      setUtility(data.utility || { electricity: '', hvacGas: '', boilerGas: '' });
      setTimeout(() => { isInitialLoad.current = false; }, 300);
    } catch (error) { 
      console.error("Failed to load dashboard data", error); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, [dateKey]);

  const handleManualSave = async () => {
    setShowConfirm(false);
    setSaveStatus('loading');
    try {
      const baseData = fullData || getInitialDailyData(dateKey);
      const updatedData: DailyData = { 
        ...baseData, 
        date: dateKey, 
        facilityDuty, 
        securityDuty, 
        utility, 
        lastUpdated: new Date().toISOString() 
      };
      const success = await saveDailyData(updatedData);
      if (success) {
        setSaveStatus('success');
        setFullData(updatedData);
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

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto pb-32 space-y-10">
      <div className="animate-fade-in space-y-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">시설 종합 대시보드</h2>
            <p className="text-slate-500 mt-2 flex items-center gap-2">
              <Info size={16} className="text-slate-400" />
              현황 입력 후 중앙 하단의 [서버저장] 버튼을 누르면 모든 데이터가 동기화됩니다.
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <DutySection title="시설 근무 현황" data={facilityDuty} onUpdate={setFacilityDuty} colorClass="text-blue-600" dateLabel={displayDate} />
          <DutySection title="보안 근무 현황" data={securityDuty} onUpdate={setSecurityDuty} colorClass="text-emerald-600" dateLabel={displayDate} />
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-slate-800 flex items-center">
              <span className="w-2 h-7 bg-amber-500 rounded-full mr-4"></span>
              일일 에너지 사용량 실시간 모니터링
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <EnergyCard label="전기 사용량" subLabel="수변전반" value={utility.electricity} unit="kWh" onChange={(v) => setUtility({...utility, electricity: v})} icon={<Zap size={28} />} />
            <EnergyCard label="냉·온수기 가스" subLabel="기계실" value={utility.hvacGas} unit="m³" onChange={(v) => setUtility({...utility, hvacGas: v})} icon={<Droplets size={28} />} />
            <EnergyCard label="보일러 가스" subLabel="기계실" value={utility.boilerGas} unit="m³" onChange={(v) => setUtility({...utility, boilerGas: v})} icon={<Flame size={28} />} />
          </div>
        </div>

        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 z-40">
          <button 
            onClick={() => setShowConfirm(true)}
            disabled={saveStatus === 'loading'}
            className={`px-10 py-5 rounded-3xl shadow-2xl transition-all duration-300 font-black text-xl flex items-center justify-center space-x-3 w-full active:scale-95 ${
              saveStatus === 'loading' ? 'bg-slate-400 text-white cursor-wait' : 
              saveStatus === 'success' ? 'bg-green-600 text-white' : 
              saveStatus === 'error' ? 'bg-rose-600 text-white' : 
              'bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-1'
            }`}
          >
            {saveStatus === 'loading' ? (
              <><RefreshCw size={24} className="animate-spin" /><span>동기화 중...</span></>
            ) : saveStatus === 'success' ? (
              <><CheckCircle size={24} /><span>동기화 완료</span></>
            ) : (
              <><Save size={24} /><span>서버저장</span></>
            )}
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-slate-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-100">
                <Cloud className="text-blue-600" size={36} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">서버저장 확인</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                작성하신 대시보드 현황 데이터를<br/>
                서버에 안전하게 반영하시겠습니까?
              </p>
              
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center"><X size={20} className="mr-2" />취소</button>
                <button onClick={handleManualSave} className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95"><CheckCircle size={20} className="mr-2" />확인</button>
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