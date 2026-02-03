
import React from 'react';
import { MenuId } from '../types';
import { MENU_ITEMS } from '../constants';
import { 
  ClipboardList, 
  CalendarDays, 
  Zap, 
  Wrench, 
  Flame, 
  ArrowUpDown, 
  Car, 
  Package, 
  HardHat, 
  UserCheck, 
  Users, 
  Briefcase,
  CalendarCheck,
  LayoutDashboard
} from 'lucide-react';

interface SidebarProps {
  activeMenu: MenuId;
  onMenuSelect: (id: MenuId) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeMenu, onMenuSelect, isOpen, toggleSidebar }) => {
  const getIcon = (id: MenuId) => {
    switch (id) {
      case MenuId.DASHBOARD: return <LayoutDashboard size={25} />;
      case MenuId.WORK_LOG: return <ClipboardList size={25} />;
      case MenuId.SCHEDULE: return <CalendarCheck size={25} />; 
      case MenuId.WEEKLY_WORK: return <CalendarDays size={25} />;
      case MenuId.ELEC_CHECK: return <Zap size={25} />;
      case MenuId.MECH_CHECK: return <Wrench size={25} />;
      case MenuId.FIRE_CHECK: return <Flame size={25} />;
      case MenuId.ELEVATOR_CHECK: return <ArrowUpDown size={25} />;
      case MenuId.PARKING_CHECK: return <Car size={25} />;
      case MenuId.CONSUMABLES: return <Package size={25} />;
      case MenuId.CONSTRUCTION: return <HardHat size={25} />;
      case MenuId.APPOINTMENTS: return <UserCheck size={25} />;
      case MenuId.STAFF: return <Users size={25} />;
      case MenuId.CONTRACTORS: return <Briefcase size={25} />;
      default: return <ClipboardList size={25} />;
    }
  };

  return (
    <aside className="bg-[#2c3e50] text-gray-100 w-64 h-full flex flex-col shadow-xl">
      <div className="pt-10 pb-8 px-6 border-b border-gray-700 flex flex-col items-center justify-center shrink-0">
        <h1 className="text-lg font-bold text-center leading-tight">
          새마을운동중앙회<br/>
          <span className="text-xs font-light text-gray-400">대치동사옥 시설관리</span>
        </h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        <ul className="space-y-1 px-2">
          {MENU_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onMenuSelect(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group
                  ${activeMenu === item.id 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <span className={`${activeMenu === item.id ? 'text-white' : 'text-gray-500 group-hover:text-blue-400'}`}>
                  {getIcon(item.id)}
                </span>
                <span className="font-normal text-[13px] tracking-tight">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-700 text-center">
        <div className="flex items-center justify-center space-x-2 text-[10px] text-gray-500 font-medium">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
          <span>시스템 정상 작동 중</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
