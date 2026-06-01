import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Search, 
  Plus, 
  Trash2, 
  Save, 
  Printer, 
  Wrench, 
  Calendar, 
  Settings, 
  Layers, 
  Locate, 
  User, 
  Layers3, 
  Tag, 
  Activity,
  Edit,
  ArrowLeftRight,
  Camera,
  Upload,
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { getFromStorage, saveToCache, fetchEquipmentHistoryList, saveEquipmentHistoryList, fetchEquipmentMaintenanceRecords, saveEquipmentMaintenanceRecords } from '../services/dataService';

interface Equipment {
  id: string;
  name: string;
  category: '기계' | '전기' | '소방' | '승강기';
  modelName: string;
  manufacturer: string;
  specifications: string;
  location: string;
  installDate: string;
  supplier: string;
  warrantyPeriod: string;
  status: '정상' | '점검필요' | '수리중';
  imageUrl?: string;
}

interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  date: string;
  title: string;
  details: string;
  cost: number;
  contractor: string;
  manager: string;
  phone?: string;
}

const INITIAL_EQUIPMENTS: Equipment[] = [
  {
    id: 'eq-001',
    name: '중온수보일러 1호기',
    category: '기계',
    modelName: 'BOILER-1000',
    manufacturer: '대열보일러',
    specifications: '용량: 1.5Ton/hr, 압력: 7kg/cm²',
    location: '지하 3층 기계실',
    installDate: '2016-04-15',
    supplier: '주식회사 대열',
    warrantyPeriod: '기성 보증 종료',
    status: '정상'
  },
  {
    id: 'eq-002',
    name: '비상발전기 1호기',
    category: '전기',
    modelName: 'GEN-750KVA',
    manufacturer: '두산인프라코어',
    specifications: '출력: 750kVA, 전압: 380V/220V',
    location: '지하 3층 발전기실',
    installDate: '2016-04-15',
    supplier: '두산파워테크',
    warrantyPeriod: '기성 보증 종료',
    status: '정상'
  },
  {
    id: 'eq-003',
    name: '소방 고가수조 부스터펌프 1호',
    category: '소방',
    modelName: 'PUMP-FIRE-50A',
    manufacturer: '신강펌프',
    specifications: '양정: 75m, 유량: 120L/min',
    location: '지하 3층 기계실',
    installDate: '2018-11-20',
    supplier: '신강엔지니어링',
    warrantyPeriod: '종료',
    status: '점검필요'
  },
  {
    id: 'eq-004',
    name: '지상 1F 오수정화조 송풍기 2호기',
    category: '기계',
    modelName: 'BLOWER-SD100',
    manufacturer: '서도기공',
    specifications: '풍량: 4.5m³/min, 원동기: 5.5HP',
    location: '지하 3층 정화조실',
    installDate: '2016-04-15',
    supplier: '서도기전',
    warrantyPeriod: '기성 보증 종료',
    status: '정상'
  },
  {
    id: 'eq-005',
    name: '수해지 우수 조절 펌프',
    category: '기계',
    modelName: 'SUB-PUMP-150',
    manufacturer: '한일전기',
    specifications: '3상 380V, 15HP, 구경: 100mm',
    location: '지하 3층 유수지',
    installDate: '2020-03-10',
    supplier: '한일종합상사',
    warrantyPeriod: '종료',
    status: '수리중'
  },
];

const INITIAL_MAINTENANCE: MaintenanceRecord[] = [
  {
    id: 'm-001',
    equipmentId: 'eq-001',
    date: '2026-03-15',
    title: '보일러 안전밸브 검사 및 압력 조정',
    details: '밸브 설정작업 및 분출 압력 6.5kg/cm² 기밀 테스트 성적 완료',
    cost: 450000,
    contractor: '대성보일러텍',
    manager: '홍길동 과장',
    phone: ''
  },
  {
    id: 'm-002',
    equipmentId: 'eq-001',
    date: '2026-05-10',
    title: '노즐 세척 및 그을음 제거 작업',
    details: '연소율 향상을 위해 고압 노즐 및 유량 조절부 기계 청소',
    cost: 280000,
    contractor: '자체 시설팀',
    manager: '이순신 대리',
    phone: ''
  },
  {
    id: 'm-003',
    equipmentId: 'eq-002',
    date: '2026-04-20',
    title: '비상발전기 시동용 밧데리 전체 교체',
    details: '납축전지 12V 150AH x 2EA 설치 완료 및 충전 전압 점검(27.4V)',
    cost: 580000,
    contractor: '동양이엔지',
    manager: '김철수 부장',
    phone: ''
  },
  {
    id: 'm-004',
    equipmentId: 'eq-003',
    date: '2026-05-02',
    title: '고압 압력탱크 질소가스 보충',
    details: '체절부 압력 저하 개선을 위한 한수원 1.5kg 질소 주입',
    cost: 150000,
    contractor: '신강엔지니어링',
    manager: '이순신 대리',
    phone: ''
  }
];

// Helper function to compress images locally in browser using Canvas API
const compressImage = (file: File, maxWidth = 500, maxHeight = 500, quality = 0.5): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } else {
          resolve(e.target?.result as string || '');
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// Helper function to parse equipment names and sort by dynamic sub-category roles
const parseEquipmentNameForSorting = (name: string) => {
  const suffixes = ['순환펌프', '냉각수펌프', '전동기'];
  let base = name;
  let suffixIndex = -1;

  for (let i = 0; i < suffixes.length; i++) {
    if (name.includes(suffixes[i])) {
      base = name.replace(suffixes[i], '');
      suffixIndex = i;
      break;
    }
  }

  return { base, suffixIndex };
};

const EquipmentHistory: React.FC = () => {
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState<boolean>(false);
  const [equipments, setEquipments] = useState<Equipment[]>([]);

  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);

  const [selectedEqId, setSelectedEqId] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  // Edit mode toggles
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  
  // Form states for currently selected equipment
  const [editForm, setEditForm] = useState<Equipment | null>(null);
  
  // Maintenance Record fields in modal / adding area
  const [newMaintDate, setNewMaintDate] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const [newMaintTitle, setNewMaintTitle] = useState<string>('');
  const [newMaintDetails, setNewMaintDetails] = useState<string>('');
  const [newMaintCost, setNewMaintCost] = useState<string>('0');
  const [newMaintContractor, setNewMaintContractor] = useState<string>('');
  const [newMaintManager, setNewMaintManager] = useState<string>('');
  const [newMaintPhone, setNewMaintPhone] = useState<string>('');
  
  // Maintenance Record editing form states
  const [editingMaintId, setEditingMaintId] = useState<string | null>(null);
  const [editMaintDate, setEditMaintDate] = useState<string>('');
  const [editMaintTitle, setEditMaintTitle] = useState<string>('');
  const [editMaintDetails, setEditMaintDetails] = useState<string>('');
  const [editMaintContractor, setEditMaintContractor] = useState<string>('');
  const [editMaintManager, setEditMaintManager] = useState<string>('');
  const [editMaintPhone, setEditMaintPhone] = useState<string>('');
  
  const [showAddMaintBox, setShowAddMaintBox] = useState<boolean>(false);
  const [isAddingNewEquipment, setIsAddingNewEquipment] = useState<boolean>(false);
  const [newEqImageUrl, setNewEqImageUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');

  // 동적 사양 항목 상태 
  const [newEqSpecs, setNewEqSpecs] = useState<{ id: string; label: string; value: string }[]>([
    { id: '1', label: '용량 및 규격', value: '' }
  ]);
  const [editEqSpecs, setEditEqSpecs] = useState<{ id: string; label: string; value: string }[]>([]);

  useEffect(() => {
    const loadSupabaseData = async () => {
      try {
        const eqDb = await fetchEquipmentHistoryList();
        const maintDb = await fetchEquipmentMaintenanceRecords();
        
        let finalEq: Equipment[] = [];
        if (eqDb && eqDb.length > 0) {
          finalEq = eqDb;
        } else {
          finalEq = getFromStorage('equipment_history_list') || INITIAL_EQUIPMENTS;
        }

        let finalMaint: MaintenanceRecord[] = [];
        if (maintDb && maintDb.length > 0) {
          finalMaint = maintDb;
        } else {
          finalMaint = getFromStorage('equipment_maintenance_records') || INITIAL_MAINTENANCE;
        }

        setEquipments(finalEq);
        setMaintenance(finalMaint);

        // 장비이력카드 메뉴 최초 선택 시 빈 페이지(선택된 장비 없음)로 나오도록 초기 선택을 비워둡니다.
        setSelectedEqId('');
        setEditForm(null);
      } catch (err) {
        console.error('Failed to load equipment data from Supabase:', err);
      } finally {
        setIsInitialLoading(false);
      }
    };
    loadSupabaseData();
  }, []);

  // specifications 문자열을 { id, label, value } 객체 배열로 변환하는 파서
  const parseSpecs = (specStr: string): { id: string; label: string; value: string }[] => {
    if (!specStr) return [{ id: '1', label: '용량 및 규격', value: '' }];
    
    let parts: string[] = [];
    if (specStr.includes('\n')) {
      parts = specStr.split('\n');
    } else if (specStr.includes(',') && specStr.includes(':')) {
      parts = specStr.split(',');
    } else {
      parts = [specStr];
    }
    
    const parsed = parts.map((part, idx) => {
      const colIdx = part.indexOf(':');
      if (colIdx !== -1) {
        return {
          id: `spec-${idx}-${Date.now()}`,
          label: part.substring(0, colIdx).trim(),
          value: part.substring(colIdx + 1).trim()
        };
      }
      return {
        id: `spec-${idx}-${Date.now()}`,
        label: '용량 및 규격',
        value: part.trim()
      };
    }).filter(p => p.label || p.value);
    
    return parsed.length > 0 ? parsed : [{ id: '1', label: '용량 및 규격', value: '' }];
  };

  const serializeSpecs = (specs: { label: string; value: string }[]) => {
    return specs
      .filter(s => s.label.trim() || s.value.trim())
      .map(s => `${s.label.trim()}: ${s.value.trim()}`)
      .join('\n');
  };

  // Derive current equipment & maintenance records
  const currentEquipment = equipments.find(e => e.id === selectedEqId);
  const currentMaintRecords = maintenance
    .filter(m => m.equipmentId === selectedEqId)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Reset states when selected Equipment changes
  const selectEquipment = (id: string) => {
    setSelectedEqId(id);
    setIsEditMode(false);
    setShowAddMaintBox(false);
    setIsAddingNewEquipment(false);
    setNewEqSpecs([{ id: '1', label: '용량 및 규격', value: '' }]);
    const eq = equipments.find(e => e.id === id);
    setEditForm(eq || null);
  };

  const startEditing = () => {
    if (currentEquipment) {
      setEditForm({ ...currentEquipment });
      setEditEqSpecs(parseSpecs(currentEquipment.specifications));
      setIsEditMode(true);
    }
  };

  const saveEquipmentsState = (newList: Equipment[]) => {
    setEquipments(newList);
    saveToCache('equipment_history_list', newList);
    saveEquipmentHistoryList(newList).catch(err => {
      console.error('Supabase equipment save error:', err);
    });
  };

  const saveMaintenanceState = (newList: MaintenanceRecord[]) => {
    setMaintenance(newList);
    saveToCache('equipment_maintenance_records', newList);
    saveEquipmentMaintenanceRecords(newList).catch(err => {
      console.error('Supabase maintenance save error:', err);
    });
  };

  const handleRefresh = async () => {
    setIsInitialLoading(true);
    try {
      const eqDb = await fetchEquipmentHistoryList();
      const maintDb = await fetchEquipmentMaintenanceRecords();
      
      let finalEq: Equipment[] = [];
      if (eqDb && eqDb.length > 0) {
        finalEq = eqDb;
      } else {
        finalEq = getFromStorage('equipment_history_list') || INITIAL_EQUIPMENTS;
      }

      let finalMaint: MaintenanceRecord[] = [];
      if (maintDb && maintDb.length > 0) {
        finalMaint = maintDb;
      } else {
        finalMaint = getFromStorage('equipment_maintenance_records') || INITIAL_MAINTENANCE;
      }

      setEquipments(finalEq);
      setMaintenance(finalMaint);

      const activeId = finalEq.some(e => e.id === selectedEqId) ? selectedEqId : '';
      setSelectedEqId(activeId);
      const activeEq = finalEq.find(e => e.id === activeId);
      if (activeEq) {
        setEditForm(activeEq);
      } else {
        setEditForm(null);
      }
      alert('새로고침이 완료되었습니다.');
    } catch (err) {
      console.error('새로고침 오류:', err);
      alert('새로고침 중 오류가 발생했습니다.');
    } finally {
      setIsInitialLoading(false);
    }
  };

  const handleSaveToSupabase = async () => {
    try {
      const isEqSaved = await saveEquipmentHistoryList(equipments);
      const isMaintSaved = await saveEquipmentMaintenanceRecords(maintenance);
      if (isEqSaved && isMaintSaved) {
        setIsSavedSuccessfully(true);
        alert('저장완료');
        setTimeout(() => setIsSavedSuccessfully(false), 2000);
      } else {
        alert('수파베이스 저장 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('Supabase save error:', err);
      alert('수파베이스 저장 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateEquipment = () => {
    if (!editForm) return;
    const finalSpecs = serializeSpecs(editEqSpecs);
    const updatedForm = { ...editForm, specifications: finalSpecs };
    const updated = equipments.map(eq => eq.id === editForm.id ? updatedForm : eq);
    saveEquipmentsState(updated);
    setIsEditMode(false);
    alert('장비 스펙 카드가 성공적으로 업데이트되었습니다.');
  };

  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    
    const newEq: Equipment = {
      id: `eq-${Date.now()}`,
      name: new FormData(form).get('name') as string,
      category: new FormData(form).get('category') as any,
      modelName: new FormData(form).get('modelName') as string,
      manufacturer: new FormData(form).get('manufacturer') as string,
      specifications: serializeSpecs(newEqSpecs),
      location: new FormData(form).get('location') as string,
      installDate: (new FormData(form).get('installDate') as string)?.substring(0, 7) || new Date().toISOString().substring(0, 7),
      supplier: new FormData(form).get('supplier') as string,
      warrantyPeriod: new FormData(form).get('warrantyPeriod') as string,
      status: new FormData(form).get('status') as any || '정상',
      imageUrl: newEqImageUrl || undefined,
    };

    if (!newEq.name) {
      alert('장비명을 입력해주세요.');
      return;
    }

    try {
      const updatedList = [...equipments, newEq];
      const isSuccess = await saveEquipmentHistoryList(updatedList);
      if (isSuccess) {
        setEquipments(updatedList);
        saveToCache('equipment_history_list', updatedList);
        setSelectedEqId(newEq.id);
        setEditForm(newEq);
        
        // Native independent browser window alert
        alert('저장완료');
        
        setIsAddingNewEquipment(false);
        setNewEqImageUrl('');
        setNewEqSpecs([{ id: '1', label: '용량 및 규격', value: '' }]);
      } else {
        alert('데이터베이스 저장 중 오류가 발생했습니다.');
      }
    } catch (err: any) {
      console.error('Error creating equipment:', err);
      alert(err?.message || '장비 등록 중 시스템 에러가 발생했습니다.');
    }
  };

  const handleDeleteEquipment = (id: string) => {
    if (window.confirm('정말로 이 장비 카드를 삭제하시겠습니까? 등록된 모든 유지보수 이력도 함께 영구 파기됩니다.')) {
      const filteredEq = equipments.filter(eq => eq.id !== id);
      const filteredMaint = maintenance.filter(m => m.equipmentId !== id);
      saveEquipmentsState(filteredEq);
      saveMaintenanceState(filteredMaint);
      if (selectedEqId === id && filteredEq.length > 0) {
        setSelectedEqId(filteredEq[0].id);
      } else if (filteredEq.length === 0) {
        setSelectedEqId('');
      }
    }
  };

  const handleAddMaintenance = () => {
    if (!newMaintTitle.trim()) {
      alert('작업명을 입력해주세요.');
      return;
    }
    const record: MaintenanceRecord = {
      id: `m-${Date.now()}`,
      equipmentId: selectedEqId,
      date: newMaintDate,
      title: newMaintTitle,
      details: newMaintDetails,
      cost: Number(newMaintCost) || 0,
      contractor: newMaintContractor,
      manager: newMaintManager,
      phone: newMaintPhone,
    };

    const updated = [...maintenance, record];
    saveMaintenanceState(updated);
    
    // Reset forms
    setNewMaintTitle('');
    setNewMaintDetails('');
    setNewMaintCost('0');
    setNewMaintContractor('');
    setNewMaintManager('');
    setNewMaintPhone('');
    setShowAddMaintBox(false);
    alert('유지 관리 작업 이력이 성공적으로 추가되었습니다.');
  };

  const handleDeleteMaintenance = (maintId: string) => {
    if (window.confirm('선택하신 유지보수 기록을 복구불가능하도록 삭제하시겠습니까?')) {
      const filtered = maintenance.filter(m => m.id !== maintId);
      saveMaintenanceState(filtered);
      if (editingMaintId === maintId) {
        setEditingMaintId(null);
      }
    }
  };

  const handleStartEditMaintenance = (rec: MaintenanceRecord) => {
    setEditingMaintId(rec.id);
    setEditMaintDate(rec.date);
    setEditMaintTitle(rec.title);
    setEditMaintDetails(rec.details || '');
    setEditMaintContractor(rec.contractor || '');
    setEditMaintManager(rec.manager || '');
    setEditMaintPhone(rec.phone || '');
  };

  const handleSaveEditMaintenance = () => {
    if (!editMaintTitle.trim()) {
      alert('작업명을 입력해주세요.');
      return;
    }
    const updated = maintenance.map(m => {
      if (m.id === editingMaintId) {
        return {
          ...m,
          date: editMaintDate,
          title: editMaintTitle,
          details: editMaintDetails,
          contractor: editMaintContractor,
          manager: editMaintManager,
          phone: editMaintPhone
        };
      }
      return m;
    });
    saveMaintenanceState(updated);
    setEditingMaintId(null);
    alert('기록이 수정되었습니다.');
  };

  // Filtered Equipment list
  const filteredEquipments = equipments.filter(eq => {
    const matchesCategory = selectedCategory === '전체' || eq.category === selectedCategory;
    const matchesSearch = 
      eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.modelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.manufacturer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    const parseA = parseEquipmentNameForSorting(a.name);
    const parseB = parseEquipmentNameForSorting(b.name);

    if (parseA.base === parseB.base) {
      return parseA.suffixIndex - parseB.suffixIndex;
    }
    return parseA.base.localeCompare(parseB.base, 'ko', { numeric: true });
  });

  // Pagination logic
  const itemsPerPage = 8;
  const totalPages = Math.ceil(filteredEquipments.length / itemsPerPage) || 1;
  const currentEquipments = filteredEquipments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Print function
  const handlePrint = () => {
    if (!currentEquipment) return;
    
    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return;

    const tableRows = currentMaintRecords.map((rec, i) => `
      <tr>
        <td style="text-align: center;">${i + 1}</td>
        <td style="text-align: center;">${rec.date}</td>
        <td>${rec.title}<br/><span style="font-size: 8pt; color: #555;">${rec.details}</span></td>
        <td>${rec.contractor}</td>
      </tr>
    `).join('') || `<tr><td colspan="4" style="text-align: center; color: #777; padding: 20px;">등록된 작업 이력이 없습니다.</td></tr>`;

    // Parse specifications to match main screen list format
    const parsedSpecs = parseSpecs(currentEquipment.specifications);
    const specRows: string[] = [];
    for (let i = 0; i < parsedSpecs.length; i += 2) {
      const left = parsedSpecs[i];
      const right = parsedSpecs[i + 1];
      specRows.push(`
        <tr>
          <th style="background-color: #ffffff; text-align: center; width: 15%; font-weight: normal; border: 1px solid #cbd5e1;">${left ? left.label : '-'}</th>
          <td style="width: 35%; border: 1px solid #cbd5e1;">${left ? left.value : '-'}</td>
          <th style="background-color: #ffffff; text-align: center; width: 15%; font-weight: normal; border: 1px solid #cbd5e1;">${right ? right.label : ''}</th>
          <td style="width: 35%; border: 1px solid #cbd5e1;">${right ? right.value : ''}</td>
        </tr>
      `);
    }
    const specTableHtml = specRows.join('') || `<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 15px; border: 1px solid #cbd5e1;">등록된 사양 제원이 없습니다.</td></tr>`;

    const html = `
      <html>
        <head>
          <title>장비이력카드 인쇄 - ${currentEquipment.name}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body {
              font-family: "Malgun Gothic", "Inter", sans-serif;
              color: #1e293b;
              padding: 0;
              margin: 0;
              background-color: #000000;
              display: flex;
              flex-direction: column;
              align-items: center;
              min-height: 100vh;
            }
            .no-print {
              width: 100%;
              text-align: center;
              padding: 15px;
              background: #111111;
              border-bottom: 1px solid #222222;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .print-btn {
              padding: 10px 24px;
              background: #2563eb;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-weight: normal;
              font-size: 10pt;
              transition: all 0.2s;
            }
            .print-btn:hover { background: #1d4ed8; }
            
            .sheet {
              background-color: #ffffff;
              width: 210mm;
              padding: 20mm 15mm;
              box-sizing: border-box;
              margin: 20px auto;
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
              border-radius: 4px;
            }

            @media print {
              body {
                background-color: #ffffff !important;
              }
              .no-print {
                display: none !important;
              }
              .sheet {
                width: auto;
                min-height: auto;
                padding: 0;
                margin: 0;
                box-shadow: none;
                background-color: transparent;
                border-radius: 0;
              }
            }
            
            .header { text-align: center; margin-bottom: 25px; position: relative; }
            .header h1 { font-size: 20pt; margin: 0 0 8px 0; font-weight: normal; border-bottom: 2px solid #0f172a; padding-bottom: 8px; color: #0f172a; letter-spacing: 2px; }
            .section-title { font-size: 11.5pt; font-weight: normal; margin: 25px 0 10px 0; border-left: 5px solid #2563eb; padding-left: 10px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9pt; }
            th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; }
            th { background-color: #ffffff; font-weight: normal; color: #334155; }
            .meta-table th { width: 15%; text-align: center; }
            .meta-table td { width: 35%; }
            .status-badge { font-weight: normal; text-align: center; }
            .photo-box {
              width: 180px; height: 160px; border: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-right: 20px; background-color: #ffffff; flex-shrink: 0;
            }
            .info-container {
              display: flex; align-items: stretch; margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="print-btn" onclick="window.print()">인쇄하기</button>
          </div>
          <div class="sheet">
            <div class="header">
              <h1>장 비 이 력 카 드</h1>
              <div style="text-align: right; font-size: 9pt; font-weight: bold; color: #64748b;">새마을운동중앙회 대치동사옥</div>
            </div>

            <div class="section-title" style="margin-top: 5px;">1. 장비 기본 제원 및 사양</div>
            
            <div class="info-container">
              ${currentEquipment.imageUrl ? `
                <div class="photo-box">
                  <img src="${currentEquipment.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" referrerpolicy="no-referrer" />
                </div>
              ` : `
                <div class="photo-box" style="flex-direction: column; color: #94a3b8; background-color: #ffffff;">
                  <span style="font-size: 20px; margin-bottom: 4px;">📷</span>
                  <span style="font-size: 8pt; font-weight: normal;">등록된 사진 없음</span>
                </div>
              `}
              <table class="meta-table" style="margin: 0; flex-grow: 1;">
                <tr>
                  <th>장비명</th>
                  <td>${currentEquipment.name}</td>
                  <th>장비분류</th>
                  <td>${currentEquipment.category}</td>
                </tr>
                <tr>
                  <th>모델명</th>
                  <td>${currentEquipment.modelName || '-'}</td>
                  <th>제조사</th>
                  <td>${currentEquipment.manufacturer || '-'}</td>
                </tr>
                <tr>
                  <th>설치위치</th>
                  <td>${currentEquipment.location || '-'}</td>
                  <th>제조년월</th>
                  <td>${currentEquipment.installDate ? currentEquipment.installDate.substring(0, 7) : '-'}</td>
                </tr>
              </table>
            </div>

            <div class="section-title">2. 장비 세부 사양 제원 이력</div>
            <table style="border: 1px solid #cbd5e1;">
              <tbody>
                ${specTableHtml}
              </tbody>
            </table>

            <div class="section-title">3. 장비 유지 관리 및 수리 이력 내역</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 5%; text-align: center; font-weight: normal;">No</th>
                  <th style="width: 15%; text-align: center; font-weight: normal;">작업일자</th>
                  <th style="width: 60%; font-weight: normal;">유지보수 작업명 및 내용 요약</th>
                  <th style="width: 20%; font-weight: normal;">작업업체</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div id="equipment-history-container" className="p-4 max-w-7xl mx-auto space-y-4 pb-32 animate-fade-in text-slate-800">
      
      {/* 1. 상단 컨트롤/탭 바 통합 구성 */}
      <div id="equipment-control-bar" className="w-full max-w-7xl mx-auto bg-white border-b border-black flex items-stretch justify-start overflow-x-auto whitespace-nowrap scrollbar-hide select-none mb-4">
        <button 
          id="tab-details"
          onClick={() => {
            setIsAddingNewEquipment(false);
            setActiveTab('details');
          }}
          type="button"
          className={`relative flex items-center gap-1.5 px-4 py-3 text-[14px] font-bold cursor-pointer shrink-0 transition-colors focus:outline-none ${
            activeTab === 'details' && !isAddingNewEquipment ? 'text-orange-600 bg-white' : 'text-gray-500 hover:text-black bg-white'
          }`}
        >
          <span>장비제원</span>
          {activeTab === 'details' && !isAddingNewEquipment && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
          )}
        </button>

        <button 
          id="tab-history"
          onClick={() => {
            setIsAddingNewEquipment(false);
            setActiveTab('history');
          }}
          type="button"
          className={`relative flex items-center gap-1.5 px-4 py-3 text-[14px] font-bold cursor-pointer shrink-0 transition-colors focus:outline-none ${
            activeTab === 'history' && !isAddingNewEquipment ? 'text-orange-600 bg-white' : 'text-gray-500 hover:text-black bg-white'
          }`}
        >
          <span>점검이력</span>
          {activeTab === 'history' && !isAddingNewEquipment && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
          )}
        </button>
        
        {isAddingNewEquipment ? (
          <>
            <div className="flex items-center shrink-0 px-2">
              <div className="w-[1px] h-6 bg-black"></div>
            </div>
            <button 
              id="btn-refresh-register"
              type="button"
              onClick={handleRefresh}
              className="px-4 py-3 text-[14px] font-bold text-gray-500 hover:text-black bg-white flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              <RefreshCw size={14} />
              새로고침
            </button>

            <button 
              id="btn-register-submit"
              type="submit"
              form="new-equipment-form"
              className="relative flex items-center gap-1.5 px-4 py-3 text-[14px] font-bold text-orange-600 bg-white transition-colors shrink-0 cursor-pointer focus:outline-none"
            >
              <span>완료</span>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
            </button>

            <button 
              id="btn-cancel-register"
              type="button"
              onClick={() => {
                setIsAddingNewEquipment(false);
                setSelectedEqId('');
                setEditForm(null);
                setNewEqSpecs([{ id: '1', label: '용량 및 규격', value: '' }]);
              }}
              className="px-4 py-3 text-[14px] font-bold text-gray-500 hover:text-black bg-white flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              취소
            </button>

            <button 
              id="btn-edit-register"
              type="button"
              disabled
              className="px-4 py-3 text-[14px] font-bold text-gray-300 bg-white flex items-center gap-1.5 transition-colors shrink-0 cursor-not-allowed"
            >
              <Edit size={14} />
              수정
            </button>

            <button 
              id="btn-save-register"
              type="button"
              disabled
              className="px-4 py-3 text-[14px] font-bold text-gray-300 bg-white flex items-center gap-1.5 transition-colors shrink-0 cursor-not-allowed"
            >
              <Save size={14} />
              저장
            </button>

            <button 
              id="btn-print-register"
              type="button"
              disabled
              className="px-4 py-3 text-[14px] font-bold text-gray-300 bg-white flex items-center gap-1.5 transition-colors shrink-0 cursor-not-allowed"
            >
              <Printer size={14} />
              인쇄
            </button>
          </>
        ) : isEditMode ? (
          <>
            <div className="flex items-center shrink-0 px-2">
              <div className="w-[1px] h-6 bg-black"></div>
            </div>
            <button 
              id="btn-refresh-edit"
              type="button"
              disabled
              className="px-4 py-3 text-[14px] font-bold text-gray-300 bg-white flex items-center gap-1.5 transition-colors shrink-0 cursor-not-allowed"
            >
              <RefreshCw size={14} />
              새로고침
            </button>

            <button 
              id="btn-register-edit"
              type="button"
              disabled
              className="px-4 py-3 text-[14px] font-bold text-gray-300 bg-white flex items-center gap-1.5 transition-colors shrink-0 cursor-not-allowed"
            >
              <Plus size={14} />
              등록
            </button>

            <button 
              id="btn-edit-submit"
              type="button"
              onClick={handleUpdateEquipment}
              className="relative flex items-center gap-1.5 px-4 py-3 text-[14px] font-bold text-orange-600 bg-white transition-colors shrink-0 cursor-pointer focus:outline-none"
            >
              <span>완료</span>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
            </button>

            <button 
              id="btn-save-edit"
              type="button"
              disabled
              className="px-4 py-3 text-[14px] font-bold text-gray-300 bg-white flex items-center gap-1.5 transition-colors shrink-0 cursor-not-allowed"
            >
              <Save size={14} />
              저장
            </button>

            <button 
              id="btn-print-edit"
              type="button"
              disabled
              className="px-4 py-3 text-[14px] font-bold text-gray-300 bg-white flex items-center gap-1.5 transition-colors shrink-0 cursor-not-allowed"
            >
              <Printer size={14} />
              인쇄
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center shrink-0 px-2">
              <div className="w-[1px] h-6 bg-black"></div>
            </div>
            <button 
              id="btn-refresh"
              onClick={handleRefresh}
              className="px-4 py-3 text-[14px] font-bold text-gray-500 hover:text-black bg-white flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              <RefreshCw size={14} />
              새로고침
            </button>

            <button 
              id="btn-register"
              onClick={() => {
                if (activeTab === 'history') {
                  setShowAddMaintBox(true);
                } else {
                  setIsAddingNewEquipment(true);
                }
              }}
              className="px-4 py-3 text-[14px] font-bold text-gray-500 hover:text-black bg-white flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              <Plus size={14} />
              등록
            </button>

            {activeTab === 'details' && currentEquipment && (
              <button 
                id="btn-edit"
                onClick={startEditing}
                className="px-4 py-3 text-[14px] font-bold text-gray-500 hover:text-black bg-white flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
              >
                <Edit size={14} />
                수정
              </button>
            )}

            <button 
              id="btn-save-supabase"
              onClick={handleSaveToSupabase}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-[14px] font-bold transition-colors shrink-0 cursor-pointer focus:outline-none ${
                isSavedSuccessfully 
                  ? 'text-orange-600 bg-white' 
                  : 'text-gray-500 hover:text-black bg-white'
              }`}
            >
              <Save size={14} className={isSavedSuccessfully ? 'text-orange-600' : ''} />
              <span>{isSavedSuccessfully ? '저장완료' : '저장'}</span>
              {isSavedSuccessfully && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />
              )}
            </button>

            {currentEquipment && (
              <button 
                id="btn-print"
                onClick={handlePrint}
                className="px-4 py-3 text-[14px] font-bold text-gray-500 hover:text-black bg-white flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
              >
                <Printer size={14} />
                인쇄
              </button>
            )}
          </>
        )}
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column - Search, Category Filters, and Equipment List (lg:col-span-3) */}
        <div className="lg:col-span-3 bg-white border border-black shadow-sm p-4 space-y-4">
          
          {/* Search Box */}
          <div className="relative w-full sm:w-[250px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black" size={18} />
            <input 
              type="text" 
              placeholder="장비명, 설치위치, 모델 등 검색"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 border-none text-[14px] font-bold bg-white text-black outline-none transition-all"
            />
          </div>

          {/* Category Badges */}
          <div className="flex items-center justify-center gap-1 border-b border-black h-[38px] w-full">
            {['전체', '기계', '전기', '소방', '승강기'].map(cat => (
              <div
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setCurrentPage(1);
                }}
                className={`px-3 h-full flex items-center text-[13px] font-bold whitespace-nowrap transition-all relative cursor-pointer leading-none ${
                  selectedCategory === cat 
                    ? 'text-orange-600' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {cat}
                {selectedCategory === cat && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange-600" />
                )}
              </div>
            ))}
          </div>

          {/* Equipment Selection List list */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {isInitialLoading ? (
              <div className="text-center py-12 text-slate-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto mb-2"></div>
                <p className="text-xs font-medium">데이터를 불러오는 중입니다...</p>
              </div>
            ) : filteredEquipments.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Settings size={28} className="mx-auto mb-2 opacity-40 animate-spin-slow" />
                <p className="text-xs font-medium">해당 조건에 만족하는 장비가 없습니다.</p>
              </div>
            ) : (
              currentEquipments.map((eq) => {
                const isActive = eq.id === selectedEqId;

                return (
                  <div
                    key={eq.id}
                    onClick={() => selectEquipment(eq.id)}
                    className={`p-3 border rounded-none cursor-pointer transition-all flex items-center justify-between gap-1.5 ${
                      isActive 
                        ? 'bg-blue-50/50 border-blue-400' 
                        : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50/20'
                    }`}
                  >
                    <div className="flex items-center justify-start gap-2.5 min-w-0">
                      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-black bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                        {eq.category}
                      </span>
                      <h4 className="text-[13px] font-normal text-black leading-tight truncate">
                        {eq.name}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEquipment(eq.id);
                      }}
                      className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                      title="삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {filteredEquipments.length > 0 && (
            <div className="flex items-center justify-between border-t border-black pt-3 text-xs">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="p-1 px-2 border border-black bg-white hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white text-black font-bold flex items-center gap-1 transition-all cursor-pointer select-none"
              >
                <ChevronLeft size={14} />
                <span>이전</span>
              </button>
              
              <div className="font-bold text-slate-700">
                <span className="text-orange-600 font-sans">{currentPage}</span> / <span className="font-sans">{totalPages}</span>
              </div>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="p-1 px-2 border border-black bg-white hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white text-black font-bold flex items-center gap-1 transition-all cursor-pointer select-none"
              >
                <span>다음</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Setup Specs & Maintenance History logs (lg:col-span-9) */}
        <div className="lg:col-span-9 space-y-6">
          {isAddingNewEquipment ? (
            <form id="new-equipment-form" onSubmit={handleCreateEquipment} className="bg-white border border-black overflow-hidden animate-in fade-in duration-300 flex flex-col space-y-2">
              <div className="p-6 bg-white">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Left: Equipment Photo Section */}
                  <div className="w-full md:w-56 shrink-0 flex flex-col gap-2">
                    <div className="w-full h-44 bg-slate-50 border border-dashed border-slate-200 rounded-xl relative overflow-hidden flex flex-col items-center justify-center group min-h-[176px]">
                      {newEqImageUrl ? (
                        <>
                          <img 
                            src={newEqImageUrl} 
                            alt="새 장비 사진 프리뷰" 
                            className="w-full h-full object-cover animate-in fade-in duration-200"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => setNewEqImageUrl('')}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shadow-sm active:scale-95 flex items-center justify-center"
                            title="사진 삭제"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center justify-center p-4 text-center h-full w-full hover:bg-slate-100/50 transition-colors">
                          <Camera className="text-slate-400 mb-2" size={24} />
                          <span className="text-xs font-bold text-slate-500">사진 등록하기</span>
                          <span className="text-[10px] text-slate-400 mt-1">클릭하여 이미지 파일 선택</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const compressedData = await compressImage(file, 500, 500, 0.5);
                                  setNewEqImageUrl(compressedData);
                                } catch (err) {
                                  console.error("이미지 압축 안됨, 원본으로 저장:", err);
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setNewEqImageUrl(reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Right: Unified input layout in 2 columns */}
                  <div className="flex-1 min-w-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8 text-xs sm:text-sm">
                      
                      {/* 1행 좌: 장비명 */}
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 shrink-0">
                          <Tag size={15} />
                        </div>
                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                          <div className="text-[13px] text-slate-500 font-normal whitespace-nowrap">장비명 * :</div>
                          <input 
                            required
                            name="name"
                            type="text" 
                            placeholder="예: 변압기 TR-01, 오수펌프"
                            className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500" 
                          />
                        </div>
                      </div>

                      {/* 1행 우: 장비 분류 */}
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 shrink-0">
                          <Layers size={15} />
                        </div>
                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                          <div className="text-[13px] text-slate-500 font-normal whitespace-nowrap">장비 분류 :</div>
                          <select 
                            name="category"
                            className="flex-1 min-w-0 px-1.5 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                          >
                            <option value="기계">기계</option>
                            <option value="전기">전기</option>
                            <option value="소방">소방</option>
                            <option value="승강기">승강기</option>
                          </select>
                        </div>
                      </div>

                      {/* 2행 좌: 제조사 */}
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 shrink-0">
                          <Settings size={15} />
                        </div>
                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                          <div className="text-[13px] text-slate-500 font-normal whitespace-nowrap">제조사 :</div>
                          <input 
                            name="manufacturer"
                            type="text" 
                            placeholder="예: 현대일렉트릭"
                            className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500" 
                            autoComplete="off"
                          />
                        </div>
                      </div>

                      {/* 2행 우: 모델명 */}
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 shrink-0">
                          <Activity size={15} />
                        </div>
                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                          <div className="text-[13px] text-slate-500 font-normal whitespace-nowrap">모델명 :</div>
                          <input 
                            name="modelName"
                            type="text" 
                            placeholder="예: TR-100KVA"
                            className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500" 
                            autoComplete="off"
                          />
                        </div>
                      </div>

                      {/* 3행 좌: 제조년월 (installDate) */}
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 shrink-0">
                          <Calendar size={15} />
                        </div>
                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                          <div className="text-[13px] text-slate-500 font-normal whitespace-nowrap">제조년월 :</div>
                          <input 
                            name="installDate"
                            type="month" 
                            defaultValue={new Date().toISOString().substring(0, 7)}
                            className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold font-mono text-slate-800 focus:outline-none focus:border-orange-500" 
                            autoComplete="off"
                          />
                        </div>
                      </div>

                      {/* 3행 우: 설치위치 */}
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 shrink-0">
                          <Locate size={15} />
                        </div>
                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                          <div className="text-[13px] text-slate-500 font-normal whitespace-nowrap">설치위치 :</div>
                          <input 
                            name="location"
                            type="text" 
                            placeholder="예: B3F 전기기계실"
                            className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500" 
                            autoComplete="off"
                          />
                        </div>
                      </div>

                      {/* 사양 제원 동적 항목 목록 */}
                      <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-bold text-slate-700 flex items-center gap-1.5 select-none">
                            <Layers3 size={15} className="text-orange-600" />
                            장비 사양 제원 목록
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewEqSpecs([...newEqSpecs, { id: String(Date.now()), label: '', value: '' }]);
                            }}
                            className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-600 text-[11px] font-bold rounded flex items-center gap-1 transition-colors border border-orange-100 cursor-pointer"
                          >
                            <Plus size={11} />
                            항목 추가
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {newEqSpecs.map((spec, index) => (
                            <div key={spec.id} className="flex items-center gap-2 bg-slate-55 p-2 rounded-lg border border-slate-200 relative group animate-in fade-in duration-200">
                              <input
                                type="text"
                                value={spec.label}
                                onChange={(e) => {
                                  const updated = [...newEqSpecs];
                                  updated[index].label = e.target.value;
                                  setNewEqSpecs(updated);
                                }}
                                placeholder="라벨명 (예: 용량및규격)"
                                className="w-1/3 min-w-[70px] px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                              />
                              <span className="text-slate-400 font-bold">:</span>
                              <input
                                type="text"
                                value={spec.value}
                                onChange={(e) => {
                                  const updated = [...newEqSpecs];
                                  updated[index].value = e.target.value;
                                  setNewEqSpecs(updated);
                                }}
                                placeholder="세부 사양 값 입력"
                                className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                              />
                              {newEqSpecs.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewEqSpecs(newEqSpecs.filter(s => s.id !== spec.id));
                                  }}
                                  className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                                  title="삭제"
                                >
                                  <X size={13} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </form>
          ) : currentEquipment ? (
            <>
              {/* Card Base Specification Panel */}
              <div className="bg-white flex flex-col space-y-2">
                {activeTab === 'details' ? (
                  <div className="p-6 border border-black bg-white">
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* Left: Equipment Photo Section */}
                      <div className="w-full md:w-56 shrink-0 flex flex-col gap-2">
                        <div className="w-full h-44 bg-slate-50 border border-dashed border-slate-200 rounded-xl relative overflow-hidden flex flex-col items-center justify-center group min-h-[176px]">
                          {isEditMode && editForm ? (
                            editForm.imageUrl ? (
                              <>
                                <img 
                                  src={editForm.imageUrl} 
                                  alt="장비 사진" 
                                  className="w-full h-full object-cover animate-in fade-in duration-200"
                                  referrerPolicy="no-referrer"
                                />
                                <button
                                  type="button"
                                  onClick={() => setEditForm({ ...editForm, imageUrl: '' })}
                                  className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shadow-sm active:scale-95 flex items-center justify-center"
                                  title="사진 삭제"
                                >
                                  <X size={12} />
                                </button>
                              </>
                            ) : (
                              <label className="cursor-pointer flex flex-col items-center justify-center p-4 text-center h-full w-full hover:bg-slate-100/50 transition-colors">
                                <Camera className="text-slate-400 mb-2" size={24} />
                                <span className="text-xs font-bold text-slate-500">사진 등록하기</span>
                                <span className="text-[10px] text-slate-400 mt-1">클릭하여 이미지 파일 선택</span>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file && editForm) {
                                      try {
                                        const compressedData = await compressImage(file, 500, 500, 0.5);
                                        setEditForm({ ...editForm, imageUrl: compressedData });
                                      } catch (err) {
                                        console.error("이미지 압축 안됨, 원본으로 저장:", err);
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          setEditForm({ ...editForm, imageUrl: reader.result as string });
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }
                                  }}
                                />
                              </label>
                            )
                          ) : (
                            currentEquipment.imageUrl ? (
                              <img 
                                src={currentEquipment.imageUrl} 
                                alt="장비 사진" 
                                className="w-full h-full object-cover animate-in fade-in duration-300"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center p-4 text-center">
                                <ImageIcon className="text-slate-300 mb-2" size={24} />
                                <span className="text-[11px] text-slate-400 font-bold">등록된 사진 없음</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      {/* Right: Unified display & inline edit layout in 2 columns */}
                      <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8 text-xs sm:text-sm">
                          
                          {/* 1행 좌: 장비명 */}
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 shrink-0">
                              <Tag size={15} />
                            </div>
                            <div className="min-w-0 flex-1 flex items-center gap-1.5">
                              <div className="text-[13px] text-slate-500 font-normal whitespace-nowrap">장비명 :</div>
                              {isEditMode && editForm ? (
                                <input 
                                  type="text" 
                                  value={editForm.name} 
                                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                  className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500" 
                                />
                              ) : (
                                <div className="font-normal text-black text-[13px] whitespace-nowrap truncate">{currentEquipment.name}</div>
                              )}
                            </div>
                          </div>

                          {/* 1행 우: 장비 분류 */}
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 shrink-0">
                              <Layers size={15} />
                            </div>
                            <div className="min-w-0 flex-1 flex items-center gap-1.5">
                              <div className="text-[13px] text-slate-500 font-normal whitespace-nowrap">장비 분류 :</div>
                              {isEditMode && editForm ? (
                                <select 
                                  value={editForm.category} 
                                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value as any })}
                                  className="flex-1 min-w-0 px-1.5 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                                >
                                  <option value="기계">기계</option>
                                  <option value="전기">전기</option>
                                  <option value="소방">소방</option>
                                  <option value="승강기">승강기</option>
                                </select>
                              ) : (
                                <div className="font-normal text-black text-[13px] whitespace-nowrap">{currentEquipment.category}</div>
                              )}
                            </div>
                          </div>

                          {/* 2행 좌: 제조사 */}
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 shrink-0">
                              <Settings size={15} />
                            </div>
                            <div className="min-w-0 flex-1 flex items-center gap-1.5">
                              <div className="text-[13px] text-slate-500 font-normal whitespace-nowrap">제조사 :</div>
                              {isEditMode && editForm ? (
                                <input 
                                  type="text" 
                                  value={editForm.manufacturer} 
                                  onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                                  className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500" 
                                  autoComplete="off"
                                />
                              ) : (
                                <div className="font-normal text-black text-[13px] whitespace-nowrap truncate">{currentEquipment ? (currentEquipment.manufacturer || '-') : '-'}</div>
                              )}
                            </div>
                          </div>

                          {/* 2행 우: 모델명 */}
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 shrink-0">
                              <Activity size={15} />
                            </div>
                            <div className="min-w-0 flex-1 flex items-center gap-1.5">
                              <div className="text-[13px] text-slate-500 font-normal whitespace-nowrap">모델명 :</div>
                              {isEditMode && editForm ? (
                                <input 
                                  type="text" 
                                  value={editForm.modelName} 
                                  onChange={(e) => setEditForm({ ...editForm, modelName: e.target.value })}
                                  className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500" 
                                  autoComplete="off"
                                />
                              ) : (
                                <div className="font-normal text-black text-[13px] whitespace-nowrap truncate">{currentEquipment ? (currentEquipment.modelName || '-') : '-'}</div>
                              )}
                            </div>
                          </div>

                          {/* 3행 좌: 제조년월 */}
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 shrink-0">
                              <Calendar size={15} />
                            </div>
                            <div className="min-w-0 flex-1 flex items-center gap-1.5">
                              <div className="text-[13px] text-slate-500 font-normal whitespace-nowrap">제조년월 :</div>
                              {isEditMode && editForm ? (
                                <input 
                                  type="month" 
                                  value={editForm.installDate ? editForm.installDate.substring(0, 7) : ''} 
                                  onChange={(e) => setEditForm({ ...editForm, installDate: e.target.value })}
                                  className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold font-mono text-slate-800 focus:outline-none focus:border-orange-500" 
                                  autoComplete="off"
                                />
                              ) : (
                                <div className="font-normal text-black text-[13px] whitespace-nowrap">{currentEquipment ? (currentEquipment.installDate ? currentEquipment.installDate.substring(0, 7) : '-') : '-'}</div>
                              )}
                            </div>
                          </div>

                          {/* 3행 우: 설치위치 */}
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 shrink-0">
                              <Locate size={15} />
                            </div>
                            <div className="min-w-0 flex-1 flex items-center gap-1.5">
                              <div className="text-[13px] text-slate-500 font-normal whitespace-nowrap">설치위치 :</div>
                              {isEditMode && editForm ? (
                                <input 
                                  type="text" 
                                  value={editForm.location} 
                                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                                  className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500" 
                                  autoComplete="off"
                                />
                              ) : (
                                <div className="font-normal text-black text-[13px] whitespace-nowrap truncate">{currentEquipment ? (currentEquipment.location || '-') : '-'}</div>
                              )}
                            </div>
                          </div>

                          {/* 용량 및 규격 */}
                          <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] font-bold text-slate-700 flex items-center gap-1.5 select-none">
                                <Layers3 size={15} className="text-orange-600" />
                                장비 사양 제원 목록
                              </span>
                              {isEditMode && editForm && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditEqSpecs([...editEqSpecs, { id: String(Date.now()), label: '', value: '' }]);
                                  }}
                                  className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-600 text-[11px] font-bold rounded flex items-center gap-1 transition-colors border border-orange-100 cursor-pointer"
                                >
                                  <Plus size={11} />
                                  항목 추가
                                </button>
                              )}
                            </div>

                            {isEditMode && editForm ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {editEqSpecs.map((spec, index) => (
                                  <div key={spec.id} className="flex items-center gap-2 bg-slate-55 p-2 rounded-lg border border-slate-200 relative group animate-in fade-in duration-200">
                                    <input
                                      type="text"
                                      value={spec.label}
                                      onChange={(e) => {
                                        const updated = [...editEqSpecs];
                                        updated[index].label = e.target.value;
                                        setEditEqSpecs(updated);
                                      }}
                                      placeholder="라벨명 (예: 용량및규격)"
                                      className="w-1/3 min-w-[70px] px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                                    />
                                    <span className="text-slate-400 font-bold">:</span>
                                    <input
                                      type="text"
                                      value={spec.value}
                                      onChange={(e) => {
                                        const updated = [...editEqSpecs];
                                        updated[index].value = e.target.value;
                                        setEditEqSpecs(updated);
                                      }}
                                      placeholder="세부 사양 값 입력"
                                      className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                                    />
                                    {editEqSpecs.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditEqSpecs(editEqSpecs.filter(s => s.id !== spec.id));
                                        }}
                                        className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                                        title="삭제"
                                      >
                                        <X size={13} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                {parseSpecs(currentEquipment.specifications).map((spec, index) => (
                                  <div key={index} className="flex items-center gap-3">
                                    <div className="p-1 px-2.5 bg-white border border-slate-200 rounded-md text-slate-600 text-[11px] font-bold shrink-0 select-none shadow-3xs">
                                      {spec.label}
                                    </div>
                                    <div className="font-bold text-slate-800 text-[13px] whitespace-nowrap truncate">
                                      {spec.value || '-'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-0 select-none border border-black bg-white">
                    {/* Maintenance Records Data Table */}
                    <div className="overflow-x-auto text-xs sm:text-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                            <th className="py-3 px-4 text-center w-[15%]">작업일자</th>
                            <th className="py-3 px-4 w-[38%]">조치 내역 요약</th>
                            <th className="py-3 px-4 w-[15%]">작업업체</th>
                            <th className="py-3 px-4 w-[12%]">담당자</th>
                            <th className="py-3 px-4 w-[12%]">연락처</th>
                            <th className="py-3 px-4 text-center w-[8%]">관리</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {showAddMaintBox && (
                            <tr className="bg-indigo-50/30 font-semibold animate-in slide-in-from-top duration-200">
                              <td className="py-2.5 px-3 text-center">
                                <input 
                                  type="text"
                                  value={newMaintDate}
                                  onChange={(e) => setNewMaintDate(e.target.value)}
                                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-center font-mono font-bold font-sans text-slate-800 focus:border-indigo-500 focus:outline-none"
                                  placeholder="YYYY-MM-DD 또는 범위"
                                />
                              </td>
                              <td className="py-2.5 px-3 space-y-1.5 col-span-1">
                                <input 
                                  type="text"
                                  value={newMaintTitle}
                                  onChange={(e) => setNewMaintTitle(e.target.value)}
                                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold font-sans text-slate-800 focus:border-indigo-500 focus:outline-none"
                                  placeholder="작업명 / 조치 내역 요약"
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <input 
                                  type="text"
                                  value={newMaintContractor}
                                  onChange={(e) => setNewMaintContractor(e.target.value)}
                                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 font-sans focus:border-indigo-500 focus:outline-none"
                                  placeholder="작업업체"
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <input 
                                  type="text"
                                  value={newMaintManager}
                                  onChange={(e) => setNewMaintManager(e.target.value)}
                                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-600 font-sans focus:border-indigo-500 focus:outline-none"
                                  placeholder="담당자"
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <input 
                                  type="text"
                                  value={newMaintPhone}
                                  onChange={(e) => setNewMaintPhone(e.target.value)}
                                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-600 font-sans focus:border-indigo-500 focus:outline-none"
                                  placeholder="연락처"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  <button 
                                    type="button"
                                    onClick={handleAddMaintenance}
                                    className="px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded transition-all active:scale-95 cursor-pointer"
                                  >
                                    추가
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => setShowAddMaintBox(false)}
                                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] rounded transition-all active:scale-95 cursor-pointer"
                                  >
                                    취소
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                          {currentMaintRecords.length === 0 && !showAddMaintBox ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                                등록된 안전 검사나 가동 및 수리 이력이 없습니다.
                              </td>
                            </tr>
                          ) : (
                            currentMaintRecords.map((rec) => (
                              editingMaintId === rec.id ? (
                                <tr key={rec.id} className="bg-indigo-50/20">
                                  <td className="py-2.5 px-3 text-center">
                                    <input 
                                      type="text"
                                      value={editMaintDate}
                                      onChange={(e) => setEditMaintDate(e.target.value)}
                                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-center font-mono font-bold font-sans text-slate-800"
                                      placeholder="YYYY-MM-DD 또는 범위"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3 space-y-1.5 col-span-1">
                                    <input 
                                      type="text"
                                      value={editMaintTitle}
                                      onChange={(e) => setEditMaintTitle(e.target.value)}
                                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold font-sans text-slate-800"
                                      placeholder="조치 내역 요약"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <input 
                                      type="text"
                                      value={editMaintContractor}
                                      onChange={(e) => setEditMaintContractor(e.target.value)}
                                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 font-sans"
                                      placeholder="작업업체"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <input 
                                      type="text"
                                      value={editMaintManager}
                                      onChange={(e) => setEditMaintManager(e.target.value)}
                                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-600 font-sans"
                                      placeholder="담당자"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <input 
                                      type="text"
                                      value={editMaintPhone}
                                      onChange={(e) => setEditMaintPhone(e.target.value)}
                                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-600 font-sans"
                                      placeholder="연락처"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1">
                                      <button 
                                        type="button"
                                        onClick={handleSaveEditMaintenance}
                                        className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded transition-all active:scale-95 cursor-pointer"
                                      >
                                        저장
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => setEditingMaintId(null)}
                                        className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] rounded transition-all active:scale-95 cursor-pointer"
                                      >
                                        취소
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono text-slate-500">
                                    {rec.date}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <div className="font-bold text-slate-800">{rec.title}</div>
                                    {rec.details && (
                                      <div className="text-[11px] text-slate-400 font-medium mt-0.5 leading-relaxed">
                                        {rec.details}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 font-semibold text-slate-700 truncate max-w-[124px]">
                                    {rec.contractor || '-'}
                                  </td>
                                  <td className="py-3.5 px-4 font-semibold text-slate-500 whitespace-nowrap">
                                    {rec.manager || '-'}
                                  </td>
                                  <td className="py-3.5 px-4 font-semibold text-slate-500 whitespace-nowrap">
                                    {rec.phone || '-'}
                                  </td>
                                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button 
                                        type="button"
                                        onClick={() => handleStartEditMaintenance(rec)}
                                        className="text-blue-500 hover:text-blue-700 p-1.5 transition-colors rounded-full hover:bg-slate-100 cursor-pointer"
                                        title="수정"
                                      >
                                        <Edit size={13} />
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => handleDeleteMaintenance(rec.id)}
                                        className="text-slate-300 hover:text-red-500 p-1.5 transition-colors rounded-full hover:bg-slate-100 cursor-pointer"
                                        title="삭제"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white border select-none border-slate-200 shadow-sm rounded-none p-12 text-center text-slate-400">
              <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
              <h4 className="text-[15px] font-bold text-slate-600 mb-1">선택된 장비 없음</h4>
              <p className="text-xs font-medium">좌측 장비 목록에서 사양/이력을 볼 장비를 선택해주십시오.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default EquipmentHistory;
