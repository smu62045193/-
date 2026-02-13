
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import WorkLog from './components/WorkLog';
import WeeklyWork from './components/WeeklyWork';
import StaffManager from './components/StaffManager';
import StaffStatus from './components/StaffStatus';
import ConsumablesManager from './components/ConsumablesManager';
import ConsumablesLedger from './components/ConsumablesLedger';
import ParkingManager from './components/ParkingManager';
import ParkingStatusList from './components/ParkingStatusList';
import ContractorManager from './components/ContractorManager';
import ElecCheckManager from './components/ElecCheckManager';
import MechCheckManager from './components/MechCheckManager';
import FireCheckManager from './components/FireCheckManager';
import FireHistoryList from './components/FireHistoryList';
import FireExtinguisherCheck from './components/FireExtinguisherCheck';
import ElevatorCheckManager from './components/ElevatorCheckManager';
import ElevatorInspectionList from './components/ElevatorInspectionList';
import ConstructionManager from './components/ConstructionManager';
import ConstructionLog from './components/ConstructionLog';
import ConstructionContractorManager from './components/ConstructionContractorManager';
import AppointmentManager from './components/AppointmentManager';
import { MenuId } from './types';
import { Menu as MenuIcon, X } from 'lucide-react';

const App: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<MenuId>(MenuId.DASHBOARD);
  const [currentDate, setCurrentDate] = useState<Date>(new Date()); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPopupMode, setIsPopupMode] = useState<'appointment' | 'staff' | 'contractor' | 'consumable' | 'construction_contractor' | 'construction_log' | 'elevator_contractor' | 'fire_contractor' | 'fire_extinguisher' | 'parking_status' | null>(null);

  // 접속 URL 파라미터 체크 (팝업 모드 여부 확인)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const popupType = params.get('popup');
    if (popupType === 'appointment') {
      setIsPopupMode('appointment');
    } else if (popupType === 'staff') {
      setIsPopupMode('staff');
    } else if (popupType === 'contractor') {
      setIsPopupMode('contractor');
    } else if (popupType === 'consumable') {
      setIsPopupMode('consumable');
    } else if (popupType === 'construction_contractor') {
      setIsPopupMode('construction_contractor');
    } else if (popupType === 'construction_log') {
      setIsPopupMode('construction_log');
    } else if (popupType === 'elevator_contractor') {
      setIsPopupMode('elevator_contractor');
    } else if (popupType === 'fire_contractor') {
      setIsPopupMode('fire_contractor');
    } else if (popupType === 'fire_extinguisher') {
      setIsPopupMode('fire_extinguisher');
    } else if (popupType === 'parking_status') {
      setIsPopupMode('parking_status');
    }
  }, []);

  const handleMenuSelect = (id: MenuId) => {
    setActiveMenu(id);
    setSidebarOpen(false);
  };

  // 팝업 모드일 경우 레이아웃 없이 해당 컴포넌트만 반환
  if (isPopupMode === 'appointment') {
    return <AppointmentManager isPopupMode={true} />;
  }
  
  if (isPopupMode === 'staff') {
    return <StaffStatus staffList={[]} setStaffList={() => {}} isPopupMode={true} />;
  }

  if (isPopupMode === 'contractor') {
    return <ContractorManager isPopupMode={true} />;
  }

  if (isPopupMode === 'consumable') {
    return <ConsumablesLedger isPopupMode={true} />;
  }

  if (isPopupMode === 'construction_contractor') {
    return <ConstructionContractorManager isPopupMode={true} />;
  }

  if (isPopupMode === 'construction_log') {
    return <ConstructionLog mode="external" isPopupMode={true} />;
  }

  if (isPopupMode === 'elevator_contractor') {
    return <ElevatorInspectionList isKeywordPopupMode={true} />;
  }

  if (isPopupMode === 'fire_contractor') {
    return <FireHistoryList isKeywordPopupMode={true} />;
  }

  if (isPopupMode === 'fire_extinguisher') {
    return <FireExtinguisherCheck isPopupMode={true} />;
  }

  if (isPopupMode === 'parking_status') {
    return <ParkingStatusList isPopupMode={true} />;
  }

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
