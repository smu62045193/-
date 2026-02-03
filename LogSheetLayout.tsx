import React, { useState } from 'react';
import { Save, Printer, Trash2, RefreshCw, CheckCircle, X, Cloud, Info } from 'lucide-react';

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
  const [showConfirm, setShowConfirm] = useState(false);

  const containerClass = isEmbedded 
    ? "p-4 sm:p-6 space-y-6 w-full bg-white" 
    : "p-4 sm:p-8 max-w-[1200px] mx-auto space-y-8 bg-white rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0";

  const handleConfirmSave = () => {
    setShowConfirm(false);
    if (onSave) onSave();
  };

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
            
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {onRefresh && !hideRefresh && (
                <button 
                  onClick={onRefresh} 
                  disabled={loading} 
                  className="flex-1 sm:flex-none items-center justify-center px-4 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 font-bold shadow-sm transition-all flex text-sm disabled:opacity-50 active:scale-95"
                >
                  <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                  새로고침
                </button>
              )}
              
              {onReset && !hideReset && (
                <button onClick={onReset} className="flex-1 sm:flex-none items-center justify-center px-4 py-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl hover:bg-rose-100 font-bold shadow-sm transition-all flex text-sm active:scale-95">
                  <Trash2 size={18} className="mr-2" />
                  초기화
                </button>
              )}

              {onSave && !hideSave && (
                <button 
                  onClick={() => setShowConfirm(true)} 
                  disabled={loading || saveStatus === 'loading'} 
                  className={`flex-1 sm:flex-none items-center justify-center px-6 py-2.5 rounded-xl font-bold shadow-md shadow-blue-100 transition-all flex text-sm ${
                    saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
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

              {extraActions}

              {!hidePrint && onPrint && (
                <button onClick={onPrint} className="flex-1 sm:flex-none items-center justify-center px-5 py-2.5 bg-slate-700 text-white rounded-xl hover:bg-slate-800 font-bold shadow-md transition-all flex text-sm active:scale-95">
                  <Printer size={18} className="mr-2" />
                  미리보기
                </button>
              )}
            </div>
          </div>
        )}

        <div className="print:w-full">{children}</div>
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
                작성하신 내용을 서버에 안전하게 기록하시겠습니까?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)} className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-colors flex items-center justify-center active:scale-95">
                  <X size={20} className="mr-2" />
                  취소
                </button>
                <button onClick={handleConfirmSave} className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95">
                  <CheckCircle size={20} className="mr-2" />
                  확인
                </button>
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

export default LogSheetLayout;