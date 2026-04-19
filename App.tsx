
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
import IntegratedInspectionList from './components/IntegratedInspectionList';
import FireExtinguisherCheck from './components/FireExtinguisherCheck';
import ElevatorCheckManager from './components/ElevatorCheckManager';
import ElevatorInspectionList from './components/ElevatorInspectionList';
import ConstructionManager from './components/ConstructionManager';
import ConstructionLog from './components/ConstructionLog';
import ConstructionContractorManager from './components/ConstructionContractorManager';
import FireElevatorManager from './components/FireElevatorManager';
import AppointmentManager from './components/AppointmentManager';
import AdminManager from './components/AdminManager';
import ArchiveRegistrationPopup from './components/ArchiveRegistrationPopup';
import MeterReadingPhotos from './components/MeterReadingPhotos';
import TenantStatus from './components/TenantStatus';
import WeeklyWorkImportPopup from './components/WeeklyWorkImportPopup';
import AirFilterCheck from './components/AirFilterCheck';
import FancoilCheck from './components/FancoilCheck';
import SepticTankCheck from './components/SepticTankCheck';
import EnergyCheck from './components/EnergyCheck';
import LoadCurrentFormPopup from './components/LoadCurrentFormPopup';
import { MenuId } from './types';
import { Menu as MenuIcon, X } from 'lucide-react';

const App: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<MenuId>(MenuId.DASHBOARD);
  const [currentDate, setCurrentDate] = useState<Date>(new Date()); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [isPopupMode, setIsPopupMode] = useState<'appointment' | 'staff' | 'contractor' | 'consumable' | 'construction_contractor' | 'construction_log' | 'elevator_contractor' | 'fire_contractor' | 'integrated_contractor' | 'fire_extinguisher' | 'parking_status' | 'meter_photo' | 'tenant' | 'search' | 'weekly_import' | 'air_filter' | 'fancoil' | 'septic' | 'energy' | 'load_current_form' | 'archive_reg' | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const popupType = params.get('popup');
    const validTypes = ['appointment', 'staff', 'contractor', 'consumable', 'construction_contractor', 'construction_log', 'elevator_contractor', 'fire_contractor', 'integrated_contractor', 'fire_extinguisher', 'parking_status', 'meter_photo', 'tenant', 'search', 'weekly_import', 'air_filter', 'fancoil', 'septic', 'energy', 'load_current_form', 'archive_reg'];
    return validTypes.includes(popupType || '') ? (popupType as any) : null;
  });
  
  const [importDateStr, setImportDateStr] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('date') || '';
  });

  const handleMenuSelect = (id: MenuId) => {
    setActiveMenu(id);
    setSidebarOpen(false);
  };

  // 팝업 모드일 경우 레이아웃 없이 해당 컴포넌트만 반환
  if (isPopupMode === 'weekly_import') {
    return <WeeklyWorkImportPopup startDateStr={importDateStr} />;
  }

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

  if (isPopupMode === 'integrated_contractor') {
    return <IntegratedInspectionList isPopupMode={true} />;
  }

  if (isPopupMode === 'fire_extinguisher') {
    return <FireExtinguisherCheck isPopupMode={true} />;
  }

  if (isPopupMode === 'parking_status') {
    return <ParkingStatusList isPopupMode={true} />;
  }

  if (isPopupMode === 'meter_photo') {
    return <MeterReadingPhotos currentDate={currentDate} isPopupMode={true} />;
  }

  if (isPopupMode === 'tenant') {
    return <TenantStatus isPopupMode={true} />;
  }

  if (isPopupMode === 'search') {
    return <Dashboard currentDate={currentDate} isSearchPopupMode={true} />;
  }

  if (isPopupMode === 'air_filter') {
    return <AirFilterCheck isPopupMode={true} />;
  }

  if (isPopupMode === 'fancoil') {
    return <FancoilCheck isPopupMode={true} />;
  }

  if (isPopupMode === 'septic') {
    return <SepticTankCheck isPopupMode={true} />;
  }

  if (isPopupMode === 'energy') {
    return <EnergyCheck isPopupMode={true} />;
  }

  if (isPopupMode === 'load_current_form') {
    return <LoadCurrentFormPopup />;
  }

  if (isPopupMode === 'archive_reg') {
    return <ArchiveRegistrationPopup />;
  }

  const renderContent = () => {
    switch (activeMenu) {
      case MenuId.DASHBOARD:
        return <Dashboard currentDate={currentDate} />;
      case MenuId.WORK_LOG:
        return <WorkLog currentDate={currentDate} />;
      case MenuId.WEEKLY_WORK:
        return <WeeklyWork currentDate={currentDate} onDateChange={setCurrentDate} />;
      case MenuId.CONSTRUCTION:
        return <ConstructionManager />;
      case MenuId.ELEC_CHECK:
        return <ElecCheckManager currentDate={currentDate} onDateChange={setCurrentDate} />;
      case MenuId.MECH_CHECK:
        return <MechCheckManager currentDate={currentDate} onDateChange={setCurrentDate} />;
      case MenuId.FIRE_ELEVATOR_CHECK:
        return <FireElevatorManager currentDate={currentDate} />;
      case MenuId.FIRE_CHECK:
        return <FireCheckManager />;
      case MenuId.ELEVATOR_CHECK:
        return <ElevatorCheckManager currentDate={currentDate} />;
      case MenuId.PARKING_CHECK:
        return <ParkingManager />;
      case MenuId.CONSUMABLES:
        return <ConsumablesManager />;
      case MenuId.STAFF:
        return <StaffManager />;
      case MenuId.ADMIN:
        return <AdminManager />;
      default:
        return <Dashboard currentDate={currentDate} />;
    }
  };

  return (
    <div className="flex h-screen bg-white text-black overflow-hidden relative print:h-auto print:overflow-visible print:block">
      
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

        <main className="flex-1 overflow-y-auto p-2 sm:p-4 bg-white relative w-full print:overflow-visible print:h-auto print:bg-white print:p-0">
          {renderContent()}
        </main>
      </div>

    </div>
  );
};

export default App;
