
import React, { useState, useEffect, useRef } from 'react';
import { fetchLogoSealSettings, saveLogoSealSettings, uploadFile } from '../services/dataService';
import { Camera, Save, RefreshCw, CheckCircle, Cloud, X, Image as ImageIcon, Sparkles } from 'lucide-react';

const LogoSealManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [settings, setSettings] = useState<{ logo?: string; seal?: string }>({ logo: '', seal: '' });
  const [previews, setPreviews] = useState<{ logo?: string; seal?: string }>({ logo: '', seal: '' });

  const logoInputRef = useRef<HTMLInputElement>(null);
  const sealInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await fetchLogoSealSettings();
      if (data) {
        setSettings(data);
        setPreviews(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (type: 'logo' | 'seal') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setPreviews(prev => ({ ...prev, [type]: dataUrl }));
        // 실제 저장 전에는 previews에만 담아두고 Save 버튼 클릭 시 업로드 진행
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setSaveStatus('loading');
    try {
      const finalSettings = { ...settings };

      // 1. 로고 업로드 처리 (새로 바뀐 경우만)
      if (previews.logo && previews.logo.startsWith('data:image')) {
        const uploadedUrl = await uploadFile('facility', 'brand', 'building_logo.png', previews.logo);
        if (uploadedUrl) finalSettings.logo = uploadedUrl;
      }

      // 2. 직인 업로드 처리 (새로 바뀐 경우만)
      if (previews.seal && previews.seal.startsWith('data:image')) {
        const uploadedUrl = await uploadFile('facility', 'brand', 'official_seal.png', previews.seal);
        if (uploadedUrl) finalSettings.seal = uploadedUrl;
      }

      const success = await saveLogoSealSettings(finalSettings);
      if (success) {
        setSettings(finalSettings);
        setPreviews(finalSettings);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
        alert('로고 및 직인 정보가 서버에 저장되었습니다.');
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      setSaveStatus('error');
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">건물 로고 및 직인 관리</h3>
              <p className="text-sm text-slate-500 font-medium">전기요금 고지서 및 공식 문서에 사용될 이미지를 설정합니다.</p>
            </div>
          </div>
          <button 
            onClick={handleSave} 
            disabled={saveStatus === 'loading'}
            className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-black shadow-lg transition-all active:scale-95 ${
              saveStatus === 'success' ? 'bg-emerald-600 text-white shadow-emerald-100' : 'bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700'
            }`}
          >
            {saveStatus === 'loading' ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
            {saveStatus === 'success' ? '저장 완료' : '설정 저장'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* 로고 섹션 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <label className="text-sm font-black text-slate-400 uppercase tracking-widest">Building Logo</label>
              <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded uppercase">고지서 하단용</span>
            </div>
            <div 
              onClick={() => logoInputRef.current?.click()}
              className="aspect-[3/1] w-full border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-white hover:border-blue-400 transition-all group overflow-hidden relative shadow-inner"
            >
              {previews.logo ? (
                <img src={previews.logo} className="w-full h-full object-contain p-4" alt="건물 로고" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon size={48} className="text-slate-200 group-hover:text-blue-300 transition-colors" />
                  <span className="text-slate-400 font-bold group-hover:text-blue-500">로고 이미지 업로드</span>
                </div>
              )}
              <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-all flex items-center justify-center">
                <Camera size={32} className="text-white opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all" />
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange('logo')} />
            </div>
            <p className="text-[11px] text-slate-400 text-center font-medium italic">투명 배경(PNG) 권장 / 가로가 긴 형태가 적합합니다.</p>
          </div>

          {/* 직인 섹션 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <label className="text-sm font-black text-slate-400 uppercase tracking-widest">Official Seal</label>
              <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded uppercase">문서 직인용</span>
            </div>
            <div 
              onClick={() => sealInputRef.current?.click()}
              className="aspect-square w-48 mx-auto border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-white hover:border-rose-400 transition-all group overflow-hidden relative shadow-inner"
            >
              {previews.seal ? (
                <img src={previews.seal} className="w-full h-full object-contain p-6" alt="공식 직인" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon size={40} className="text-slate-200 group-hover:text-rose-300 transition-colors" />
                  <span className="text-slate-400 font-bold group-hover:text-rose-500">직인 업로드</span>
                </div>
              )}
              <div className="absolute inset-0 bg-rose-600/0 group-hover:bg-rose-600/5 transition-all flex items-center justify-center">
                <Camera size={32} className="text-white opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all" />
              </div>
              <input ref={sealInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange('seal')} />
            </div>
            <p className="text-[11px] text-slate-400 text-center font-medium italic">투명 배경(PNG) 권장 / 정사각형 형태가 적합합니다.</p>
          </div>
        </div>

        <div className="mt-12 p-6 bg-blue-50 border border-blue-100 rounded-3xl flex items-start gap-4">
          <div className="p-2 bg-white rounded-xl text-blue-600 shadow-sm"><Cloud size={20} /></div>
          <div>
            <h4 className="font-black text-blue-900 text-sm mb-1">이미지 연동 안내</h4>
            <p className="text-xs text-blue-700 leading-relaxed font-medium">
              이곳에서 업로드한 <span className="font-bold">건물 로고</span>는 입주사 전기요금 고지서 하단에 즉시 반영됩니다.<br/>
              <span className="font-bold">공식 직인</span>은 추후 업데이트될 문서 결재 및 인계인수증 발급 기능에서 사용됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogoSealManager;
