
import React from 'react';
import { MenuId, MenuItem } from '../types';
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
      case MenuId.DASHBOARD: return <LayoutDashboard size={20} />;
      case MenuId.WORK_LOG: return <ClipboardList size={20} />;
      case MenuId.SCHEDULE: return <CalendarCheck size={20} />; 
      case MenuId.WEEKLY_WORK: return <CalendarDays size={20} />;
      case MenuId.ELEC_CHECK: return <Zap size={20} />;
      case MenuId.MECH_CHECK: return <Wrench size={20} />;
      case MenuId.FIRE_CHECK: return <Flame size={20} />;
      case MenuId.ELEVATOR_CHECK: return <ArrowUpDown size={20} />;
      case MenuId.PARKING_CHECK: return <Car size={20} />;
      case MenuId.CONSUMABLES: return <Package size={20} />;
      case MenuId.CONSTRUCTION: return <HardHat size={20} />;
      case MenuId.APPOINTMENTS: return <UserCheck size={20} />;
      case MenuId.STAFF: return <Users size={20} />;
      case MenuId.CONTRACTORS: return <Briefcase size={20} />;
      default: return <ClipboardList size={20} />;
    }
  };

  return (
    <aside className="bg-[#1e293b] text-slate-300 w-64 h-full flex flex-col shadow-2xl border-r border-slate-700/50">
      <div className="pt-12 pb-10 px-6 border-b border-slate-700/50 flex flex-col items-center justify-center shrink-0 bg-slate-900/20">
        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
          <Wrench className="text-white" size={24} />
        </div>
        <h1 className="text-[17px] font-black text-white text-center leading-tight tracking-tight">
          새마을운동중앙회<br/>
          <span className="text-[11px] font-bold text-blue-400 uppercase tracking-[0.1em] mt-1 block">대치동사옥 시설관리</span>
        </h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-6 scrollbar-hide">
        <ul className="space-y-1 px-4">
          {MENU_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onMenuSelect(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 group
                  ${activeMenu === item.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 ring-1 ring-blue-500/50' 
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
              >
                <span className={`${activeMenu === item.id ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'} transition-colors duration-200`}>
                  {getIcon(item.id)}
                </span>
                <span className={`text-[13px] tracking-tight ${activeMenu === item.id ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-6 border-t border-slate-700/50 bg-slate-900/30">
        <div className="flex items-center space-x-3 text-[11px] text-slate-500 font-bold px-2">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 absolute inset-0 animate-ping opacity-75"></div>
          </div>
          <span className="uppercase tracking-tighter">System Operational</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
