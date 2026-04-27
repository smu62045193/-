
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchLogoSealSettings, saveLogoSealSettings, uploadFile } from '../services/dataService';
import { Camera, Save, RefreshCw, CheckCircle, Cloud, X, Image as ImageIcon, Sparkles } from 'lucide-react';

interface LogoSealManagerProps {
  isEmbedded?: boolean;
  isEditMode?: boolean;
}

const LogoSealManager: React.FC<LogoSealManagerProps> = ({ isEmbedded = false, isEditMode = false }) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [settings, setSettings] = useState<{ logo?: string; seal?: string }>({ logo: '', seal: '' });
  const [previews, setPreviews] = useState<{ logo?: string; seal?: string }>({ logo: '', seal: '' });

  const logoInputRef = useRef<HTMLInputElement>(null);
  const sealInputRef = useRef<HTMLInputElement>(null);



  const loadSettings = useCallback(async () => {
    setLoading(true);
    console.log('LogoSealManager: Loading settings...');
    try {
      const data = await fetchLogoSealSettings();
      console.log('LogoSealManager: Loaded data:', data);
      if (data) {
        setSettings(data);
        setPreviews(data);
      }
    } catch (e) {
      console.error('LogoSealManager: Load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleSave = useCallback(async () => {
    if (loading) return;
    setSaveStatus('loading');
    console.log('LogoSealManager: Starting save process...');
    
    try {
      // 현재 상태를 기반으로 최종 저장할 객체 생성
      // previews에 값이 있으면 우선 사용, 없으면 기존 settings 사용
      const finalSettings = { 
        logo: previews.logo || settings.logo || '', 
        seal: previews.seal || settings.seal || '' 
      };

      console.log('LogoSealManager: Current previews:', previews);
      console.log('LogoSealManager: Current settings:', settings);

      // 1. 로고 업로드 처리 (새로 선택된 데이터 URL인 경우만)
      if (previews.logo && previews.logo.startsWith('data:image')) {
        console.log('LogoSealManager: Uploading new logo...');
        const uploadedUrl = await uploadFile('facility', 'brand', 'building_logo.png', previews.logo);
        if (uploadedUrl && uploadedUrl.startsWith('http')) {
          // 캐시 방지를 위해 타임스탬프 추가
          finalSettings.logo = `${uploadedUrl}?t=${Date.now()}`;
          console.log('LogoSealManager: Logo uploaded successfully:', finalSettings.logo);
        } else {
          console.error('LogoSealManager: Logo upload failed, returned:', uploadedUrl);
          throw new Error('로고 업로드에 실패했습니다. 서버 저장 공간(Storage) 설정을 확인해주세요.');
        }
      }

      // 2. 직인 업로드 처리 (새로 선택된 데이터 URL인 경우만)
      if (previews.seal && previews.seal.startsWith('data:image')) {
        console.log('LogoSealManager: Uploading new seal...');
        const uploadedUrl = await uploadFile('facility', 'brand', 'official_seal.png', previews.seal);
        if (uploadedUrl && uploadedUrl.startsWith('http')) {
          // 캐시 방지를 위해 타임스탬프 추가
          finalSettings.seal = `${uploadedUrl}?t=${Date.now()}`;
          console.log('LogoSealManager: Seal uploaded successfully:', finalSettings.seal);
        } else {
          console.error('LogoSealManager: Seal upload failed, returned:', uploadedUrl);
          throw new Error('직인 업로드에 실패했습니다. 서버 저장 공간(Storage) 설정을 확인해주세요.');
        }
      }

      // 만약 업로드 과정에서 오류가 없었고, 최종 설정값이 비어있지 않다면 저장 진행
      console.log('LogoSealManager: Saving final settings to database:', finalSettings);
      
      const success = await saveLogoSealSettings(finalSettings);
      if (success) {
        setSettings(finalSettings);
        setPreviews(finalSettings);
        setSaveStatus('success');
        
        // 부모 컴포넌트에 알림
        window.dispatchEvent(new CustomEvent('LOGOSEAL_SAVED'));
        
        setTimeout(() => setSaveStatus('idle'), 3000);
        alert('로고 및 직인 정보가 성공적으로 저장되었습니다.');
      } else {
        console.error('LogoSealManager: Database save failed');
        throw new Error('데이터베이스 저장에 실패했습니다. 네트워크 상태를 확인해주세요.');
      }
    } catch (e) {
      console.error('LogoSealManager: Save error:', e);
      setSaveStatus('error');
      alert(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [loading, previews, settings]);

  useEffect(() => {
    loadSettings();

    const handleRefresh = () => loadSettings();
    const handleSaveEvent = () => handleSave();

    window.addEventListener('REFRESH_LOGOSEAL', handleRefresh);
    window.addEventListener('SAVE_LOGOSEAL', handleSaveEvent);

    return () => {
      window.removeEventListener('REFRESH_LOGOSEAL', handleRefresh);
      window.removeEventListener('SAVE_LOGOSEAL', handleSaveEvent);
    };
  }, [loadSettings, handleSave]);

  return (
    <div className={`${isEmbedded ? "" : "bg-white p-8 rounded-none border border-black"} animate-fade-in space-y-2`}>
      <div className={isEmbedded ? "bg-white p-6 rounded-none border border-black" : ""}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* 로고 섹션 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <label className="text-sm font-black text-slate-400 uppercase tracking-widest">Building Logo</label>
              <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded uppercase">고지서 하단용</span>
            </div>
            <div 
              onClick={() => isEditMode && logoInputRef.current?.click()}
              className={`aspect-[3/1] w-full border border-black rounded-none flex flex-col items-center justify-center ${isEditMode ? 'cursor-pointer hover:bg-white' : 'cursor-default'} bg-slate-50/50 transition-all group overflow-hidden relative`}
            >
              {previews.logo ? (
                <img src={previews.logo} className="w-full h-full object-contain p-4" alt="건물 로고" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon size={48} className="text-slate-200 group-hover:text-blue-300 transition-colors" />
                  <span className="text-slate-400 font-bold group-hover:text-blue-500">로고 이미지 업로드</span>
                </div>
              )}
              {isEditMode && (
                <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-all flex items-center justify-center">
                  <Camera size={32} className="text-white opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all" />
                </div>
              )}
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
              onClick={() => isEditMode && sealInputRef.current?.click()}
              className={`aspect-square w-48 mx-auto border border-black rounded-none flex flex-col items-center justify-center ${isEditMode ? 'cursor-pointer hover:bg-white' : 'cursor-default'} bg-slate-50/50 transition-all group overflow-hidden relative`}
            >
              {previews.seal ? (
                <img src={previews.seal} className="w-full h-full object-contain p-6" alt="공식 직인" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon size={40} className="text-slate-200 group-hover:text-rose-300 transition-colors" />
                  <span className="text-slate-400 font-bold group-hover:text-rose-500">직인 업로드</span>
                </div>
              )}
              {isEditMode && (
                <div className="absolute inset-0 bg-rose-600/0 group-hover:bg-rose-600/5 transition-all flex items-center justify-center">
                  <Camera size={32} className="text-white opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all" />
                </div>
              )}
              <input ref={sealInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange('seal')} />
            </div>
            <p className="text-[11px] text-slate-400 text-center font-medium italic">투명 배경(PNG) 권장 / 정사각형 형태가 적합합니다.</p>
          </div>
        </div>

        <div className="mt-12 p-6 bg-blue-50 border border-black rounded-none flex items-start gap-4">
          <div className="p-2 bg-white border border-black rounded-none text-blue-600"><Cloud size={20} /></div>
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
