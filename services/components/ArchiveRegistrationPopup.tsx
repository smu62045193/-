import React, { useState, useEffect } from 'react';
import { Save, X, Paperclip, Loader2, CheckCircle2, Download } from 'lucide-react';
import { uploadArchiveFile, saveArchiveSettings, fetchArchiveSettings } from '../services/dataService';
import { ArchiveItem } from '../types';

const ArchiveRegistrationPopup: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<ArchiveItem>>({
    category: '',
    title: '',
    date: new Date().toISOString().split('T')[0],
    attachment: '',
    fileName: ''
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      setIsEditMode(true);
      setEditId(id);
      loadItemData(id);
    }
  }, []);

  const loadItemData = async (id: string) => {
    setIsLoading(true);
    try {
      const allData = await fetchArchiveSettings();
      const item = allData.find(i => i.id === id);
      if (item) {
        setFormData({
          category: item.category,
          title: item.title,
          date: item.date,
          attachment: item.attachment,
          fileName: item.fileName
        });
      }
    } catch (error) {
      console.error('Failed to load item data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (file: File) => {
    setIsLoading(true);
    try {
      const result = await uploadArchiveFile(file);
      if (result) {
        setFormData(prev => ({
          ...prev,
          attachment: result.url,
          fileName: file.name
        }));
        alert('파일이 업로드되었습니다.');
      } else {
        alert('파일 업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('File upload error:', error);
      alert('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.category || !formData.title) {
      alert('구분과 제목을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. 기존 데이터 가져오기
      const existingData = await fetchArchiveSettings();
      
      let updatedData: ArchiveItem[];
      
      if (isEditMode && editId) {
        // 수정 모드: 해당 ID의 항목을 찾아 업데이트
        updatedData = existingData.map(item => 
          item.id === editId ? {
            ...item,
            category: formData.category || '',
            title: formData.title || '',
            date: formData.date || new Date().toISOString().split('T')[0],
            attachment: formData.attachment || '',
            fileName: formData.fileName || ''
          } : item
        );
      } else {
        // 등록 모드: 새 데이터 추가
        const newItem: ArchiveItem = {
          id: Date.now().toString(),
          category: formData.category || '',
          title: formData.title || '',
          date: formData.date || new Date().toISOString().split('T')[0],
          attachment: formData.attachment || '',
          fileName: formData.fileName || ''
        };
        updatedData = [newItem, ...existingData];
      }
      
      // 3. 저장
      const success = await saveArchiveSettings(updatedData);
      
      if (success) {
        setSaveSuccess(true);
        alert(isEditMode ? '수정되었습니다.' : '등록되었습니다.');
        // 부모 창 새로고침 시도 (동일 도메인일 경우)
        if (window.opener) {
          try {
            window.opener.dispatchEvent(new CustomEvent('archive-updated'));
          } catch (e) {
            console.warn('Could not dispatch event to opener window', e);
          }
        }
        window.close();
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto bg-white shadow-lg border border-gray-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">{isEditMode ? '자료실 자료 수정' : '자료실 자료 등록'}</h1>
          <button onClick={() => window.close()} className="hover:text-gray-300 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* Category */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">구분</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="예: 전기, 소방, 기계 등"
              />
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">제목</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="자료 제목을 입력하세요"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">등록일</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            {/* Attachment */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">첨부파일</label>
              <div className="flex items-center gap-4">
                {formData.attachment ? (
                  <div className="flex-1 flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Download size={18} />
                      <span className="text-sm font-medium truncate max-w-[300px]">{formData.fileName}</span>
                    </div>
                    <button 
                      onClick={() => setFormData(prev => ({ ...prev, attachment: '', fileName: '' }))}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <label className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-md hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all group">
                    <Paperclip size={32} className="text-gray-400 group-hover:text-blue-500 mb-2" />
                    <span className="text-sm text-gray-500 group-hover:text-blue-600">클릭하여 파일 업로드 (Excel, PDF, 한글 등)</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                      accept=".pdf,.xlsx,.xls,.hwp,.doc,.docx"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-6 flex justify-end gap-4 border-t border-gray-200">
          <button
            onClick={() => window.close()}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 font-bold hover:bg-gray-100 transition-all"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-8 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-md"
          >
            {isSaving ? (
              <Loader2 size={20} className="animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 size={20} />
            ) : (
              <Save size={20} />
            )}
            {saveSuccess ? (isEditMode ? '수정완료' : '등록완료') : (isEditMode ? '수정하기' : '등록하기')}
          </button>
        </div>
      </div>
      
      {isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-blue-600" size={40} />
            <p className="font-bold text-gray-700">파일 업로드 중...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchiveRegistrationPopup;
