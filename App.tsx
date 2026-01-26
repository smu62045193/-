
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import WorkLog from './components/WorkLog';
import WeeklyWork from './components/WeeklyWork';
import StaffManager from './components/StaffManager';
import ConsumablesManager from './components/ConsumablesManager';
import ParkingManager from './components/ParkingManager';
import ContractorManager from './components/ContractorManager';
import ElecCheckManager from './components/ElecCheckManager';
import MechCheckManager from './components/MechCheckManager';
import FireCheckManager from './components/FireCheckManager';
import ElevatorCheckManager from './components/ElevatorCheckManager';
import ConstructionManager from './components/ConstructionManager';
import AppointmentManager from './components/AppointmentManager';
import { MenuId } from './types';
import { Menu as MenuIcon, X } from 'lucide-react';

const App: React.FC = () => {
  // 초기 활성화 메뉴를 대시보드(DASHBOARD)로 설정
  const [activeMenu, setActiveMenu] = useState<MenuId>(MenuId.DASHBOARD);
  const [currentDate, setCurrentDate] = useState<Date>(new Date()); 
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleMenuSelect = (id: MenuId) => {
    setActiveMenu(id);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    switch (activeMenu) {
      case MenuId.DASHBOARD:
        return <Dashboard currentDate={currentDate} />;
      case MenuId.WORK_LOG:
      case MenuId.SCHEDULE: 
        return <WorkLog currentDate={currentDate} />;
      case MenuId.WEEKLY_WORK:
        return <WeeklyWork currentDate={currentDate} onDateChange={setCurrentDate} />;
      case MenuId.ELEC_CHECK:
        return <ElecCheckManager currentDate={currentDate} onDateChange={setCurrentDate} />;
      case MenuId.MECH_CHECK:
        return <MechCheckManager currentDate={currentDate} onDateChange={setCurrentDate} />;
      case MenuId.FIRE_CHECK:
        return <FireCheckManager />;
      case MenuId.ELEVATOR_CHECK:
        return <ElevatorCheckManager currentDate={currentDate} />;
      case MenuId.PARKING_CHECK:
        return <ParkingManager />;
      case MenuId.CONSUMABLES:
        return <ConsumablesManager />;
      case MenuId.CONSTRUCTION:
        return <ConstructionManager />;
      case MenuId.APPOINTMENTS:
        return <AppointmentManager />;
      case MenuId.STAFF:
        return <StaffManager />;
      case MenuId.CONTRACTORS:
        return <ContractorManager />;
      default:
        return <Dashboard currentDate={currentDate} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden relative print:h-auto print:overflow-visible print:block">
      
      {/* Mobile Menu Button */}
      <button 
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md text-gray-700 hover:bg-gray-50 transition-colors print:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={24} /> : <MenuIcon size={24} />}
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden transition-opacity print:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} print:hidden`}>
        <Sidebar 
          activeMenu={activeMenu} 
          onMenuSelect={handleMenuSelect} 
          isOpen={sidebarOpen}
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full print:h-auto print:overflow-visible print:block">
        <div className="print:hidden">
          <Header 
            currentDate={currentDate} 
            onChangeDate={setCurrentDate} 
          />
        </div>

        <main className="flex-1 overflow-y-auto p-2 sm:p-4 bg-gray-50 relative w-full print:overflow-visible print:h-auto print:bg-white print:p-0">
          {renderContent()}
        </main>
      </div>

    </div>
  );
};

export default App;
