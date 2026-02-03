import React, { useState, useEffect } from 'react';
import { LayoutList, Hammer } from 'lucide-react';

interface SubPageProps {
  title: string;
  subItems?: string[];
  onItemClick?: (item: string) => void;
}

const SubPage: React.FC<SubPageProps> = ({ title, subItems, onItemClick }) => {
  const [activeTab, setActiveTab] = useState<string>('');

  useEffect(() => {
    if (subItems && subItems.length > 0) {
      setActiveTab(subItems[0]);
    }
  }, [subItems]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in h-full flex flex-col">
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
        <p className="text-gray-500 mt-1 text-base">해당 항목의 세부 점검 및 관리를 수행합니다.</p>
      </div>

      {subItems && subItems.length > 0 ? (
        <>
          {/* Tab Navigation */}
          <div className="flex overflow-x-auto whitespace-nowrap gap-2 pb-2 mb-4 scrollbar-hide border-b border-gray-200 items-center">
            <div className="mr-2 text-gray-500">
               <LayoutList size={20} />
            </div>
            {subItems.map((item) => (
              <button
                key={item}
                onClick={() => setActiveTab(item)}
                className={`px-4 py-2 rounded-full text-base font-medium transition-all duration-200 border ${
                  activeTab === item
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 flex flex-col items-center justify-center min-h-[400px] animate-fade-in">
            <div className="p-6 bg-gray-50 rounded-full mb-6">
              <Hammer size={48} className="text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">{activeTab}</h3>
            <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-base font-medium">
              기능 준비중입니다
            </div>
            <p className="text-gray-400 mt-4 text-center max-w-md">
              현재 해당 메뉴에 대한 기능이 개발 중에 있습니다.<br/>
              빠른 시일 내에 업데이트될 예정입니다.
            </p>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white rounded-xl border border-gray-200 shadow-sm p-10">
          <p className="text-xl font-bold text-gray-500">하위 메뉴가 없습니다.</p>
        </div>
      )}
    </div>
  );
};

export default SubPage;