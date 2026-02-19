
import React from 'react';
import { Save, Printer, Trash2, RefreshCw, CheckCircle, Info } from 'lucide-react';

interface LogSheetLayoutProps {
  title: React.ReactNode;
  date?: string;
  loading?: boolean;
  saveStatus?: 'idle' | 'loading' | 'success' | 'error';
  onSave?: () => void;
  onReset?: () => void;
  onPrint?: () => void;
  onRefresh?: () => void;
  extraActions?: React.ReactNode;
  isEmbedded?: boolean;
  hidePrint?: boolean;
  hideSave?: boolean;
  hideHeader?: boolean;
  hideReset?: boolean;
  hideRefresh?: boolean;
  children: React.ReactNode;
}

const LogSheetLayout: React.FC<LogSheetLayoutProps> = ({ 
  title, 
  date, 
  loading = false,
  saveStatus = 'idle',
  onSave, 
  onReset,
  onPrint,
  onRefresh,
  extraActions,
  isEmbedded = false,
  hidePrint = false,
  hideSave = true, 
  hideHeader = false,
  hideReset = true,
  hideRefresh = false,
  children 
}) => {
  const containerClass = isEmbedded 
    ? "p-4 sm:p-6 space-y-6 w-full bg-white" 
    : "p-4 sm:p-8 max-w-[1200px] mx-auto space-y-8 bg-white rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0";

  return (
    <div className={containerClass}>
      <div className="animate-fade-in space-y-6">
        {!hideHeader && (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-6 mb-2 print:hidden">
            <div className="flex flex-col gap-1">
              <div className="text-2xl font-black text-slate-800 flex items-center leading-none tracking-tight">
                {title}
              </div>
              {date && <span className="text-sm text-slate-400 font-medium flex items-center gap-1.5">
                <Info size={14} className="text-slate-300" />
                {date} 기준 데이터
              </span>}
            </div>
            
            <div className="flex flex-row flex-wrap gap-2 w-full sm:w-auto">
              {onRefresh && !hideRefresh && (
                <button 
                  onClick={onRefresh} 
                  disabled={loading} 
                  className="flex-1 sm:flex-none flex flex-row items-center justify-center px-4 py-2 bg-white text-emerald-600 border border-gray-200 rounded-xl hover:bg-emerald-50 border-emerald-100 font-bold shadow-sm transition-all text-sm disabled:opacity-50 active:scale-95 whitespace-nowrap"
                >
                  <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                  새로고침
                </button>
              )}
              
              {extraActions}

              {onSave && !hideSave && (
                <button 
                  onClick={onSave} 
                  disabled={loading || saveStatus === 'loading'} 
                  className={`flex-1 sm:flex-none flex flex-row items-center justify-center px-6 py-2.5 rounded-xl font-bold shadow-md shadow-blue-100 transition-all text-sm whitespace-nowrap ${
                    saveStatus === 'success' ? 'bg-green-600 text-white shadow-green-100' : 'bg-blue-600 text-white hover:bg-blue-700'
                  } disabled:bg-blue-400 active:scale-95`}
                >
                  {saveStatus === 'loading' ? (
                    <RefreshCw size={18} className="mr-2 animate-spin" />
                  ) : saveStatus === 'success' ? (
                    <CheckCircle size={18} className="mr-2" />
                  ) : (
                    <Save size={18} className="mr-2" />
                  )}
                  {saveStatus === 'success' ? '저장완료' : '서버저장'}
                </button>
              )}

              {!hidePrint && onPrint && (
                <button 
                  onClick={onPrint} 
                  className="flex-1 sm:flex-none flex flex-row items-center justify-center px-6 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-bold shadow-md text-sm transition-all active:scale-95 whitespace-nowrap"
                >
                  <Printer size={18} className="mr-2" />
                  미리보기
                </button>
              )}

              {onReset && !hideReset && (
                <button onClick={onReset} className="flex-1 sm:flex-none flex flex-row items-center justify-center px-4 py-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl hover:bg-rose-100 font-bold shadow-sm transition-all text-sm active:scale-95 whitespace-nowrap">
                  <Trash2 size={18} className="mr-2" />
                  초기화
                </button>
              )}
            </div>
          </div>
        )}

        <div className="print:w-full">{children}</div>
      </div>
    </div>
  );
};

export default LogSheetLayout;
