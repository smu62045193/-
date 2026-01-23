import React, { useState, useEffect } from 'react';
import { FireHistoryItem } from '../types';
import { fetchFireHistoryList } from '../services/dataService';

const FireHistoryList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<FireHistoryItem[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchFireHistoryList();
    setItems(data || []);
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4 animate-fade-in">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-bold text-gray-800">소방 점검 이력 리스트</h2>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-16">No</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-32">날짜</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-500 uppercase tracking-wider w-48">업체</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-500 uppercase tracking-wider">내용</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-500 uppercase tracking-wider w-48">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-20 text-center text-gray-400 italic text-sm">
                    데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-20 text-center text-gray-400 italic text-sm">
                    등록된 점검 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3 text-center text-gray-400 font-mono text-xs">{items.length - index}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700 font-medium">
                      {item.date}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 font-bold">
                      {item.company}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.content}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {item.note}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FireHistoryList;