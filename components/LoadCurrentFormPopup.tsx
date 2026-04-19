
import React, { useState, useEffect } from 'react';
import { LoadCurrentItem } from '../types';
import { X, Save, Edit2, Plus } from 'lucide-react';

const LoadCurrentFormPopup: React.FC = () => {
  const [formData, setFormData] = useState<Partial<LoadCurrentItem>>(() => {
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get('data');
    if (dataParam) {
      try {
        return JSON.parse(decodeURIComponent(dataParam));
      } catch (e) {
        console.error('Failed to parse data from URL', e);
      }
    }
    const floor = params.get('floor') || '';
    return {
      floor,
      inspectionDate: new Date().toISOString().split('T')[0],
      targetL: '', orderL: '', capacityL: '', valueL: '', noteL: '',
      orderR: '', capacityR: '', valueR: '', noteR: ''
    };
  });

  const isEditing = Boolean(formData.id);

  const handleSubmit = () => {
    if (window.opener) {
      window.opener.postMessage({
        type: 'LOAD_CURRENT_SUBMIT',
        payload: formData
      }, '*');
      window.close();
    }
  };

  const handleCancel = () => {
    window.close();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100">
        <div className="bg-orange-600 p-4 flex justify-between items-center text-white">
          <h3 className="text-lg font-bold flex items-center">
            {isEditing ? <Edit2 size={20} className="mr-2" /> : <Plus size={20} className="mr-2" />}
            부하 전류 점검 항목 {isEditing ? '수정' : '등록'}
          </h3>
          <button onClick={handleCancel} className="hover:bg-white/20 p-1 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 ml-1">층</label>
              <input 
                type="text" 
                value={formData.floor || ''} 
                onChange={e => setFormData({...formData, floor: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-100 outline-none transition-all"
                placeholder="예: 1F, B1"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 ml-1">점검대상</label>
              <input 
                type="text" 
                value={formData.targetL || ''} 
                onChange={e => setFormData({...formData, targetL: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-100 outline-none transition-all"
                placeholder="점검 대상 명칭"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* 좌측 정보 */}
            <div className="space-y-4 p-4 bg-blue-50/30 rounded-xl border border-blue-100">
              <h4 className="font-bold text-blue-700 text-sm border-b border-blue-100 pb-2">좌측 정보</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 ml-1">순서</label>
                  <input 
                    type="text" 
                    value={formData.orderL || ''} 
                    onChange={e => setFormData({...formData, orderL: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 ml-1">용량</label>
                  <input 
                    type="text" 
                    value={formData.capacityL || ''} 
                    onChange={e => setFormData({...formData, capacityL: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 ml-1">측정값</label>
                <input 
                  type="text" 
                  value={formData.valueL || ''} 
                  onChange={e => setFormData({...formData, valueL: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-blue-600 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 ml-1">비고</label>
                <input 
                  type="text" 
                  value={formData.noteL || ''} 
                  onChange={e => setFormData({...formData, noteL: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>

            {/* 우측 정보 */}
            <div className="space-y-4 p-4 bg-orange-50/30 rounded-xl border border-orange-100">
              <h4 className="font-bold text-orange-700 text-sm border-b border-orange-100 pb-2">우측 정보</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 ml-1">순서</label>
                  <input 
                    type="text" 
                    value={formData.orderR || ''} 
                    onChange={e => setFormData({...formData, orderR: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 ml-1">용량</label>
                  <input 
                    type="text" 
                    value={formData.capacityR || ''} 
                    onChange={e => setFormData({...formData, capacityR: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 ml-1">측정값</label>
                <input 
                  type="text" 
                  value={formData.valueR || ''} 
                  onChange={e => setFormData({...formData, valueR: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-orange-600 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 ml-1">비고</label>
                <input 
                  type="text" 
                  value={formData.noteR || ''} 
                  onChange={e => setFormData({...formData, noteR: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={handleCancel}
            className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all active:scale-95"
          >
            취소
          </button>
          <button 
            onClick={handleSubmit}
            className="px-8 py-2.5 bg-orange-600 text-white rounded-xl font-bold shadow-lg shadow-orange-100 hover:bg-orange-700 transition-all active:scale-95 flex items-center"
          >
            <Save size={18} className="mr-2" />
            {isEditing ? '수정 완료' : '등록 하기'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoadCurrentFormPopup;
