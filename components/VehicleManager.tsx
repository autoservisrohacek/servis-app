import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Car, 
  Fingerprint, 
  Calendar, 
  Gauge, 
  ChevronRight, 
  ChevronDown,
  Cpu, 
  Plus, 
  X, 
  Check, 
  User,
  History as HistoryIcon,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Stethoscope,
  Search,
  Edit3,
  MoreHorizontal, 
  Trash2,
  AlertCircle,
  ShieldCheck,
  Clock,
  Timer,
  ClipboardList,
  Info,
  Layers,
  Palette,
  Type,
  FilePlus,
  FileText,
  Image as ImageIcon,
  Download,
  Paperclip,
  Eye,
  ClipboardPlus,
  TrendingUp,
  Wrench,
  Droplets,
  Wind,
  Settings2,
  Bot,
  RefreshCcw,
  ExternalLink,
  Loader2,
  SearchCode,
  Sparkles,
  Zap,
  Activity,
  Box,
  Fuel,
  BookOpen,
  Printer,
  FolderOpen
} from 'lucide-react';
import { Vehicle, Customer, ServiceRecord, AttachmentItem, CompanyInfo } from '../types';
import { fetchVehicleFromRsv, RsvVehicleData } from '../services/rsvService';
import ServiceHistoryReport from './ServiceHistoryReport';

interface VehicleManagerProps {
  vehicles: Vehicle[];
  customers: Customer[];
  services: ServiceRecord[];
  companyInfo: CompanyInfo; 
  onAddVehicle: (v: Vehicle) => void;
  onUpdateVehicle: (v: Vehicle) => void;
  onDeleteVehicle: (id: string) => void;
  onNavigateToCustomer: (id: string) => void;
  onNavigateToOrder: (id: string) => void;
  onCreateOrder: (id: string) => void;
  initialVehicleId?: string | null;
  autoOpen?: boolean;
  onModalOpened?: () => void;
  search: string;
  onSearchChange: (value: string) => void;
}

const formatDate = (dateStr: any) => {
  if (typeof dateStr !== 'string' || !dateStr) return '---';
  const datePart = dateStr.split('T')[0];
  if (!datePart) return '---';
  const parts = datePart.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

const calculateNextDate = (lastDate: string | undefined, intervalMonths: number | undefined) => {
  if (!lastDate || !intervalMonths || intervalMonths === 0) return null;
  const date = new Date(lastDate);
  if (isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + intervalMonths);
  return date;
};

const checkVehicleOverdueStatus = (v: Vehicle) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (v.stkExpirationDate && new Date(v.stkExpirationDate) < now) return true;
  if (v.nextServiceDate && new Date(v.nextServiceDate) < now) return true;
  
  const intervalChecks = [
    { date: v.oilChangeDate, months: v.oilChangeInterval },
    { date: v.brakeFluidDate, months: v.brakeFluidInterval },
    { date: v.coolantDate, months: v.coolantInterval },
    { date: v.timingBeltDate, months: v.timingBeltInterval },
    { date: v.refrigerantDate, months: v.refrigerantInterval },
  ];
  
  for (const item of intervalChecks) {
    const nextDate = calculateNextDate(item.date, item.months);
    if (nextDate && nextDate < now) return true;
  }

  // Gearbox check
  const isAutomat = v.gearboxType === 'AUTOMAT';
  const lastKm = v.gearboxOilLastKm || 0;
  const intervalKm = v.gearboxOilIntervalKm || (isAutomat ? 60000 : 240000);
  const isKmOverdue = lastKm > 0 && v.mileage >= (lastKm + intervalKm);
  if (isKmOverdue) return true;

  if (!isAutomat) {
    const nextGearboxDate = calculateNextDate(v.gearboxOilDate, v.gearboxOilInterval);
    if (nextGearboxDate && nextGearboxDate < now) return true;
  }

  return false;
};

const VehicleManager: React.FC<VehicleManagerProps> = ({ 
  vehicles, 
  customers, 
  services,
  companyInfo,
  onAddVehicle, 
  onUpdateVehicle, 
  onDeleteVehicle,
  onNavigateToCustomer,
  onNavigateToOrder,
  onCreateOrder,
  initialVehicleId,
  autoOpen,
  onModalOpened,
  search,
  onSearchChange
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'intervals'>('basic');
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [historyVehicleId, setHistoryVehicleId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  
  const [isRsvLoading, setIsRsvLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });
  const [enrichedServices, setEnrichedServices] = useState<ServiceRecord[]>([]);
  const [isFormRsvLoading, setIsFormRsvLoading] = useState(false);
  const [rsvDiffs, setRsvDiffs] = useState<Array<{field: keyof Vehicle, label: string, oldVal: string, newVal: string}>>([]);
  const [rsvSourceData, setRsvSourceData] = useState<RsvVehicleData | null>(null);

  const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const customerSelectRef = useRef<HTMLDivElement>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  const selectedVehicle = useMemo(() => vehicles.find(v => v.id === selectedVehicleId) || null, [vehicles, selectedVehicleId]);
  const historyVehicle = useMemo(() => vehicles.find(v => v.id === historyVehicleId) || null, [vehicles, historyVehicleId]);

  const initialFormData: Partial<Vehicle> = {
    make: '', model: '', year: new Date().getFullYear(), vin: '', licensePlate: '', mileage: 0, engineCode: '', enginePower: '', driveType: '', bodyType: '', color: '', stkExpirationDate: '', nextServiceDate: '', serviceIntervalKm: 15000, serviceIntervalMonths: 12, customerId: customers[0]?.id || '', attachments: [], oilChangeDate: '', oilChangeInterval: 12, brakeFluidDate: '', coolantDate: '', gearboxOilDate: '', timingBeltDate: '', refrigerantDate: '', brakeFluidInterval: 24, coolantInterval: 60, gearboxOilInterval: 60, timingBeltInterval: 120, refrigerantInterval: 24, gearboxType: 'MAN', gearboxOilIntervalKm: 240000
  };

  const [formData, setFormData] = useState<Partial<Vehicle>>(initialFormData);

  useEffect(() => {
    if (autoOpen) {
      setEditingVehicle(null);
      setFormData(initialFormData);
      setActiveTab('basic');
      setIsModalOpen(true);
      if (onModalOpened) onModalOpened();
    }
  }, [autoOpen]);

  useEffect(() => {
    if (initialVehicleId) {
      setSelectedVehicleId(initialVehicleId);
      if (onModalOpened) onModalOpened();
    }
  }, [initialVehicleId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
      if (customerSelectRef.current && !customerSelectRef.current.contains(event.target as Node)) {
        setIsCustomerSelectOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const alphabet = useMemo(() => {
    const letters = new Set<string>();
    vehicles.forEach(v => { if (v.make) letters.add(v.make[0].toUpperCase()); });
    return Array.from(letters).sort((a, b) => a.localeCompare(b, 'cs'));
  }, [vehicles]);

  const sortedFilteredCustomersForSelect = useMemo(() => {
    let list = [...customers];
    
    // Sort alphabetically
    list.sort((a, b) => {
      const nameA = a.customerType === 'firemní' ? (a.companyName || '') : (a.lastName || '');
      const nameB = b.customerType === 'firemní' ? (b.companyName || '') : (b.lastName || '');
      return nameA.localeCompare(nameB, 'cs');
    });

    // Filter by search query
    if (customerSearchQuery) {
      const q = customerSearchQuery.toLowerCase();
      list = list.filter(c => {
        const name = c.customerType === 'firemní' ? (c.companyName || '') : `${c.lastName} ${c.firstName}`;
        return name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || (c.email && c.email.toLowerCase().includes(q));
      });
    }

    // Always pull "Zákazník neznámý" to the very top, if present
    const unknownIdx = list.findIndex(c => c.firstName.toLowerCase() === 'zákazník' && c.lastName.toLowerCase() === 'neznámý');
    if (unknownIdx !== -1) {
      const [unknown] = list.splice(unknownIdx, 1);
      list.unshift(unknown);
    }
    
    return list;
  }, [customers, customerSearchQuery]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const customer = customers.find(c => c.id === v.customerId);
      const customerName = customer ? (customer.customerType === 'firemní' ? customer.companyName : `${customer.lastName} ${customer.firstName}`) : "";
      const matchesSearch = (v.licensePlate || "").toLowerCase().includes(search.toLowerCase()) || (v.make || "").toLowerCase().includes(search.toLowerCase()) || (v.model || "").toLowerCase().includes(search.toLowerCase()) || (v.vin || "").toLowerCase().includes(search.toLowerCase()) || customerName?.toLowerCase().includes(search.toLowerCase());
      const matchesLetter = !selectedLetter || (v.make && v.make[0].toUpperCase() === selectedLetter);
      return matchesSearch && matchesLetter;
    }).sort((a, b) => (a.make || "").localeCompare(b.make || "", 'cs'));
  }, [vehicles, search, selectedLetter, customers]);

  const handleAddNew = () => { setEditingVehicle(null); setFormData(initialFormData); setActiveTab('basic'); setIsModalOpen(true); };
  const handleEdit = (v: Vehicle) => { setEditingVehicle(v); setFormData({ ...initialFormData, ...v }); setActiveTab('basic'); setIsModalOpen(true); setOpenMenuId(null); };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedVehicle) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const fileData = new Uint8Array(arrayBuffer);
        
        // Identifikátor pro složku: [Značka] [Model] - [SPZ]
        const identifier = `${selectedVehicle.make} ${selectedVehicle.model} - ${selectedVehicle.licensePlate}`;

        const newAttachment = await (window as any).electronAPI.attachment.upload({
          type: 'vehicle',
          identifier: identifier,
          fileName: file.name,
          fileData: fileData
        });

        const updatedVehicle = {
          ...selectedVehicle,
          attachments: [...(selectedVehicle.attachments || []), newAttachment],
          updatedAt: new Date().toISOString()
        };
        onUpdateVehicle(updatedVehicle);
      };
      reader.onerror = () => {
        alert('Chyba při čtení souboru.');
        setIsUploading(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Nahrávání souboru selhalo.');
      setIsUploading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setIsUploading(false), 1000);
    }
  };

  const handleOpenFile = async (path: string) => {
    await (window as any).electronAPI.attachment.open(path);
  };

  const handleDeleteFile = async (attachmentId: string, path: string) => {
    if (!selectedVehicle) return;
    if (!confirm('Opravdu chcete tento soubor smazat?')) return;

    try {
      await (window as any).electronAPI.attachment.delete(path);
      const updatedVehicle = {
        ...selectedVehicle,
        attachments: (selectedVehicle.attachments || []).filter(a => a.id !== attachmentId),
        updatedAt: new Date().toISOString()
      };
      onUpdateVehicle(updatedVehicle);
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Mazání souboru selhalo.');
    }
  };

  const handleCloseModals = () => {
    setIsModalOpen(false);
    setEditingVehicle(null);
    setDeletingVehicle(null);
    setSelectedVehicleId(null);
    setHistoryVehicleId(null);
    setIsCustomerSelectOpen(false);
    setOpenMenuId(null);
    
    // Electron focus fix
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      window.focus();
    }, 50);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedData = { 
      ...formData, 
      licensePlate: (formData.licensePlate || '').trim().toUpperCase(), 
      vin: (formData.vin || '').trim().toUpperCase(),
      updatedAt: new Date().toISOString()
    };
    if (editingVehicle) onUpdateVehicle({ ...editingVehicle, ...sanitizedData } as Vehicle);
    else onAddVehicle({ ...sanitizedData, id: `v${Date.now()}` } as Vehicle);
    handleCloseModals();
  };

  const handleFormRsvSync = async () => {
    const vin = (formData.vin || '').trim();
    if (!vin || vin.length < 10) {
      alert("Pro vyhledání zadejte platný VIN kód (minimálně 10 znaků).");
      return;
    }
    if (!companyInfo.rsvApiKey) {
      alert("Pro tuto funkci musíte v Nastavení -> Moje Firma vyplnit RSV API Klíč.");
      return;
    }

    setIsFormRsvLoading(true);
    try {
      const data = await fetchVehicleFromRsv(vin, companyInfo.rsvApiKey, companyInfo.rsvProxyUrl);
      if (!data) {
        alert("Vozidlo s tímto VIN nebylo v registru nalezeno.");
        return;
      }

      setFormData(prev => ({
        ...prev,
        make: data.TovarniZnacka || prev.make,
        model: data.ObchodniOznaceni || prev.model,
        engineCode: data.MotorTyp || prev.engineCode,
        enginePower: data.MotorMaxVykon || prev.enginePower,
        bodyType: data.VozidloKaroserieDruh || prev.bodyType,
        color: data.VozidloKaroserieBarva || prev.color,
        stkExpirationDate: data.PravidelnaTechnickaProhlidkaDo?.split('T')[0] || prev.stkExpirationDate,
        year: data.RokVyroby || prev.year
      }));
      
      alert("Údaje o vozidle byly úspěšně načteny a doplněny do formuláře.");
    } catch (err: any) {
      alert(err.message || "Při komunikaci s registrem RSV došlo k chybě.");
    } finally {
      setIsFormRsvLoading(false);
    }
  };

  const handleRsvSync = async () => {
    if (!selectedVehicle || !selectedVehicle.vin) return;
    if (!companyInfo.rsvApiKey) {
      alert("Pro tuto funkci musíte v Nastavení -> Moje Firma vyplnit RSV API Klíč.");
      return;
    }

    setIsRsvLoading(true);
    setRsvDiffs([]);
    
    try {
      const data = await fetchVehicleFromRsv(selectedVehicle.vin, companyInfo.rsvApiKey, companyInfo.rsvProxyUrl);
      if (!data) {
        alert("Vozidlo s tímto VIN nebylo v registru nalezeno.");
        setIsRsvLoading(false);
        return;
      }

      setRsvSourceData(data);
      
      const diffs: any[] = [];
      const newStk = data.PravidelnaTechnickaProhlidkaDo?.split('T')[0] || '';
      
      const normalize = (val: any) => String(val || '').trim().toUpperCase();

      if (data.TovarniZnacka && normalize(data.TovarniZnacka) !== normalize(selectedVehicle.make)) {
        diffs.push({ field: 'make', label: 'Značka', oldVal: selectedVehicle.make, newVal: data.TovarniZnacka });
      }
      if (data.ObchodniOznaceni && normalize(data.ObchodniOznaceni) !== normalize(selectedVehicle.model)) {
        diffs.push({ field: 'model', label: 'Model', oldVal: selectedVehicle.model, newVal: data.ObchodniOznaceni });
      }
      if (data.MotorTyp && normalize(data.MotorTyp) !== normalize(selectedVehicle.engineCode)) {
        diffs.push({ field: 'engineCode', label: 'Kód motoru', oldVal: selectedVehicle.engineCode, newVal: data.MotorTyp });
      }
      if (data.MotorMaxVykon && normalize(data.MotorMaxVykon) !== normalize(selectedVehicle.enginePower)) {
        diffs.push({ field: 'enginePower', label: 'Výkon motoru', oldVal: selectedVehicle.enginePower || '---', newVal: data.MotorMaxVykon });
      }
      if (data.VozidloKaroserieDruh && normalize(data.VozidloKaroserieDruh) !== normalize(selectedVehicle.bodyType)) {
        diffs.push({ field: 'bodyType', label: 'Karoserie', oldVal: selectedVehicle.bodyType || '---', newVal: data.VozidloKaroserieDruh });
      }
      if (data.VozidloKaroserieBarva && normalize(data.VozidloKaroserieBarva) !== normalize(selectedVehicle.color)) {
        diffs.push({ field: 'color', label: 'Barva', oldVal: selectedVehicle.color, newVal: data.VozidloKaroserieBarva });
      }
      if (newStk && newStk !== selectedVehicle.stkExpirationDate) {
        diffs.push({ field: 'stkExpirationDate', label: 'STK Platnost', oldVal: selectedVehicle.stkExpirationDate, newVal: newStk });
      }

      if (diffs.length === 0) {
        alert("Data v kartě vozidla jsou aktuální a shodují se s registrem RSV.");
      } else {
        setRsvDiffs(diffs);
      }
    } catch (err: any) {
      alert(err.message || "Při komunikaci s registrem RSV došlo k neočekávané chybě.");
    } finally {
      setIsRsvLoading(false);
    }
  };

  const applyRsvChanges = () => {
    if (!selectedVehicle || !rsvSourceData) return;
    const updatedVehicle = { 
      ...selectedVehicle,
      updatedAt: new Date().toISOString()
    };
    rsvDiffs.forEach(diff => { (updatedVehicle as any)[diff.field] = diff.newVal; });
    onUpdateVehicle(updatedVehicle);
    setRsvDiffs([]);
    setRsvSourceData(null);
  };

  const vehicleServices = useMemo(() => historyVehicleId ? services.filter(s => s.vehicleId === historyVehicleId).sort((a, b) => (b.date || "").localeCompare(a.date || "")) : [], [historyVehicleId, services]);

  const handlePrintHistory = async (vId: string) => {
    const vehicle = vehicles.find(v => v.id === vId);
    if (vehicle) {
      const filteredServices = services.filter(s => s.vehicleId === vId && (s.status === 'hotovo' || s.status === 'předáno'));
      
      if (filteredServices.length === 0) {
        alert("Pro toto vozidlo nejsou k dispozici žádné dokončené servisní záznamy.");
        return;
      }

      setIsAiProcessing(true);
      setAiProgress({ current: 0, total: filteredServices.length });

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
        
        let completedCount = 0;
        const enriched = await Promise.all(filteredServices.map(async (record) => {
          try {
            const partsList = record.parts?.map(p => p.description).join(', ') || 'žádné díly';
            const laborInfo = record.laborHours ? `${record.laborHours}h práce` : 'žádná práce';
            const rawData = `Popis: ${record.description}, Díly: ${partsList}, Práce: ${laborInfo}`;

            const response = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: [{ parts: [{ text: `Z následujících dat ze servisu vytvořit jednu profesionální, kultivovanou větu v češtině pro servisní knížku. Data: ${rawData}. Výstupem bude pouze ta jedna věta bez uvozovek.` }] }]
            });

            const transformedText = response.text?.trim() || record.description;
            completedCount++;
            setAiProgress({ current: completedCount, total: filteredServices.length });
            
            return {
              ...record,
              aiTransformedDescription: transformedText
            };
          } catch (error) {
            console.error('AI transformation failed for record:', record.id, error);
            completedCount++;
            setAiProgress({ current: completedCount, total: filteredServices.length });
            return record; // Fallback to original
          }
        }));

        setEnrichedServices(enriched);
        setHistoryVehicleId(vId); 
        setOpenMenuId(null);
        
        // Wait for React to render the component into the DOM
        setTimeout(() => {
          const reportElement = document.getElementById('service-history-report-content');
          if (!reportElement) {
            console.error('Report element not found');
            setIsAiProcessing(false);
            return;
          }

          const reportHtml = reportElement.innerHTML;
          const printWindow = window.open('', '_blank');
          
          if (printWindow) {
            printWindow.document.write(`
              <html>
                <head>
                  <title>Servisní historie - ${vehicle.licensePlate}</title>
                  <script src="https://cdn.tailwindcss.com"></script>
                  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
                  <style>
                    body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; }
                    @media print {
                      @page { size: A4; margin: 0; }
                    }
                  </style>
                </head>
                <body>
                  <div class="service-history-standalone">
                    ${reportHtml}
                  </div>
                  <script>
                    // Wait for Tailwind to process classes
                    setTimeout(() => {
                      window.print();
                      // Close after a short delay to allow print dialog to handle it
                      setTimeout(() => window.close(), 500);
                    }, 800);
                  </script>
                </body>
              </html>
            `);
            printWindow.document.close();
          } else {
            // Fallback if window.open is blocked
            window.print();
          }
          setIsAiProcessing(false);
        }, 1000);
      } catch (err) {
        console.error('General AI transformation error:', err);
        alert("Při generování profesionálních záznamů došlo k chybě. Bude použit původní text.");
        setEnrichedServices(filteredServices);
        setHistoryVehicleId(vId);
        setIsAiProcessing(false);
        
        // Final fallback print attempt
        setTimeout(() => window.print(), 1000);
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Vozidla</h2>
          <p className="text-slate-500 font-medium">Evidence vozového parku a servisních intervalů.</p>
        </div>
        <button onClick={handleAddNew} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg"><Plus className="w-5 h-5" />Nové vozidlo</button>
      </div>

      <div className="space-y-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input type="text" placeholder="Hledat podle SPZ, značky, modelu, VIN nebo jména majitele..." className="flex-1 text-sm font-medium outline-none bg-transparent" value={search} onChange={(e) => onSearchChange(e.target.value)} />
          {search && <button onClick={() => onSearchChange('')} className="text-blue-600 font-bold text-xs px-3 py-1 hover:bg-blue-50 rounded-lg transition-all">Zrušit filtr</button>}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 px-1 custom-scrollbar-h">
          <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center gap-2 shrink-0"><Type className="w-4 h-4 text-slate-400" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Značka:</span></div>
          <button onClick={() => setSelectedLetter(null)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${!selectedLetter ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'}`}>VŠE</button>
          {alphabet.map(letter => <button key={letter} onClick={() => setSelectedLetter(selectedLetter === letter ? null : letter)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${selectedLetter === letter ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'}`}>{letter}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredVehicles.map(v => {
          const isOverdue = checkVehicleOverdueStatus(v);
          return (
            <div key={v.id} className={`bg-white rounded-[2.5rem] border ${isOverdue ? 'border-red-200 bg-red-50/5' : 'border-slate-100'} p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-visible`}>
              {isOverdue && <div className="absolute -top-2 -left-2 z-10 animate-bounce"><div className="bg-red-600 text-white p-2 rounded-full shadow-lg border-2 border-white"><AlertTriangle className="w-5 h-5 stroke-[3]" /></div></div>}
              <div className="absolute top-0 right-0 p-6">
                <div className="relative">
                  <button onClick={() => setOpenMenuId(openMenuId === v.id ? null : v.id)} className={`p-2 rounded-xl transition-all ${openMenuId === v.id ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:text-slate-900'}`}><MoreHorizontal className="w-5 h-5" /></button>
                  {openMenuId === v.id && (
                    <div ref={menuRef} className="absolute top-12 right-0 w-52 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[60] animate-in fade-in zoom-in-95 duration-200">
                      <button onClick={() => handleEdit(v)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors text-sm font-bold"><Edit3 className="w-4 h-4 text-slate-400" />Upravit vozidlo</button>
                      <button onClick={() => { handlePrintHistory(v.id); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors text-sm font-bold"><BookOpen className="w-4 h-4 text-slate-400" />Tisk historie</button>
                      <button onClick={() => { onCreateOrder(v.id); setOpenMenuId(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-blue-50 text-blue-600 transition-colors text-sm font-bold"><ClipboardPlus className="w-4 h-4 text-blue-400" />Vytvořit zakázku</button>
                      <div className="h-px bg-slate-100 my-1 mx-2"></div>
                      <button onClick={() => { setDeletingVehicle(v); setOpenMenuId(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-600 transition-colors text-sm font-bold"><Trash2 className="w-4 h-4" />Smazat vozidlo</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-6 mb-6">
                <div className={`w-20 h-20 rounded-3xl ${isOverdue ? 'bg-red-500 shadow-red-200' : 'bg-slate-900 shadow-slate-200'} flex items-center justify-center text-white font-black text-xl shadow-xl transition-transform group-hover:scale-105`}><Car className="w-10 h-10" /></div>
                <div className="min-w-0 pr-8">
                  <h3 className="text-xl font-black text-slate-900 leading-tight truncate">{v.make} {v.model}</h3>
                  {(() => {
                    const owner = customers.find(c => c.id === v.customerId);
                    if (!owner) return <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Bez majitele</p>;
                    return (
                      <p className="text-xs font-bold text-blue-600/70 truncate mt-1">
                        {owner.customerType === 'firemní' ? owner.companyName : `${owner.lastName} ${owner.firstName}`}
                      </p>
                    );
                  })()}
                  <div className="flex flex-col gap-1 mt-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-blue-600 font-mono tracking-widest uppercase">{v.licensePlate?.toUpperCase()}</p>
                      {isOverdue && <span className="text-[10px] font-black text-red-600 px-2 py-0.5 bg-red-50 rounded-lg uppercase tracking-tighter">Prošlý servis</span>}
                    </div>
                    {v.engineCode && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Cpu className="w-3 h-3" />
                        <span className="text-[10px] font-black uppercase tracking-tight">{v.engineCode}</span>
                      </div>
                    )}
                    {v.fuelType && (
                      <div className="flex items-center gap-1.5 text-blue-500">
                        <Fuel className="w-3 h-3" />
                        <span className="text-[10px] font-black uppercase tracking-tight">{v.fuelType}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button onClick={() => setSelectedVehicleId(v.id)} className="py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-xs hover:bg-slate-200 transition-colors uppercase tracking-wider">Detail karty</button>
                <button onClick={() => setHistoryVehicleId(v.id)} className="py-4 bg-blue-50 text-blue-600 rounded-2xl font-black text-xs hover:bg-blue-100 transition-colors uppercase tracking-wider flex items-center justify-center gap-2"><HistoryIcon className="w-4 h-4" />Historie</button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedVehicle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 p-10 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center font-black shadow-inner"><Car className="w-8 h-8" /></div>
                <div>
                  <h3 className="text-3xl font-black tracking-tighter">{selectedVehicle.make} {selectedVehicle.model}</h3>
                  <p className="text-slate-400 text-sm font-black uppercase tracking-[0.2em] mt-1">{selectedVehicle.licensePlate?.toUpperCase()}</p>
                </div>
              </div>
              <button onClick={handleCloseModals} className="p-3 hover:bg-white/10 rounded-2xl transition-colors"><X className="w-8 h-8" /></button>
            </div>
            
            <div className="p-10 space-y-10 overflow-y-auto custom-scrollbar bg-white">
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden border border-white/5">
                <div className="absolute top-0 right-0 p-6 opacity-10"><SearchCode className="w-24 h-24" /></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40"><RefreshCcw className="w-6 h-6" /></div>
                    <h4 className="text-base font-black uppercase tracking-widest">AKTUALIZACE Z REGISTRU (RSV)</h4>
                  </div>
                  
                  {rsvDiffs.length > 0 ? (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                      <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-white/5 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                              <th className="px-5 py-3">Údaj</th>
                              <th className="px-5 py-3">Původní</th>
                              <th className="px-5 py-3">Registr (Nové)</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs font-bold divide-y divide-white/5">
                            {rsvDiffs.map((diff, i) => (
                              <tr key={i}>
                                <td className="px-5 py-4 text-slate-400 uppercase text-[10px]">{diff.label}</td>
                                <td className="px-5 py-4 line-through opacity-40">{diff.field === 'stkExpirationDate' ? formatDate(diff.oldVal) : diff.oldVal || '---'}</td>
                                <td className="px-5 py-4 text-blue-400">{diff.field === 'stkExpirationDate' ? formatDate(diff.newVal) : diff.newVal}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex gap-4">
                        <button onClick={() => setRsvDiffs([])} className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-xs uppercase transition-all">Zrušit</button>
                        <button onClick={applyRsvChanges} className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase shadow-xl transition-all flex items-center justify-center gap-2"><Check className="w-5 h-5" /> AKTUALIZOVAT KARTU</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6">
                      <p className="text-sm font-medium text-slate-400 leading-relaxed">Bot se připojí k databázi <b>dataovozidlech.cz</b> přes API a porovná technická data vašeho vozidla s úředním registrem.</p>
                      <button onClick={handleRsvSync} disabled={isRsvLoading || !selectedVehicle.vin} className="flex items-center justify-center gap-4 w-full py-5 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl transition-all border border-white/5 font-black text-sm uppercase">
                        {isRsvLoading ? <Loader2 className="w-6 h-6 animate-spin text-blue-400" /> : <SearchCode className="w-6 h-6" />}
                        {isRsvLoading ? 'PŘIPOJOVÁNÍ K REGISTRU...' : 'AKTUALIZOVAT DATA DLE VIN'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-xs font-black text-blue-600 uppercase tracking-[0.3em] border-b border-slate-100 pb-3 flex items-center gap-3"><User className="w-4 h-4" /> Majitel vozidla</h4>
                {(() => {
                  const customer = customers.find(c => c.id === selectedVehicle.customerId);
                  if (!customer) return (
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 border-dashed text-slate-400 text-sm font-bold flex items-center justify-center gap-3">
                      <AlertCircle className="w-5 h-5 opacity-50" />
                      Bez přiřazeného majitele
                    </div>
                  );
                  return (
                    <div 
                      onClick={() => {
                        onNavigateToCustomer(customer.id);
                        setSelectedVehicleId(null);
                      }}
                      className="p-6 bg-blue-50/50 border border-blue-100 rounded-[2rem] cursor-pointer hover:bg-blue-100/50 transition-all group shadow-sm active:scale-[0.99]"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm group-hover:bg-blue-600 transition-colors">
                            <User className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Zákazník</p>
                            <p className="text-lg font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                              {customer.customerType === 'firemní' ? customer.companyName : `${customer.lastName} ${customer.firstName}`}
                            </p>
                            <p className="text-xs font-bold text-slate-500 mt-0.5 flex items-center gap-3">
                              {customer.phone} 
                              {customer.email && <span className="opacity-30">|</span>}
                              {customer.email}
                            </p>
                          </div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
                          <ChevronRight className="w-5 h-5 text-blue-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-6">
                <h4 className="text-xs font-black text-blue-600 uppercase tracking-[0.3em] border-b border-slate-100 pb-3 flex items-center gap-3"><Layers className="w-4 h-4" /> Technické údaje</h4>
                <div className="grid grid-cols-1 gap-4">
                   <div className="flex flex-col p-5 bg-slate-50 rounded-3xl border border-slate-100"><span className="text-[10px] font-black text-slate-400 uppercase mb-1">VIN kód</span><span className="text-base font-mono font-black text-slate-900 break-all uppercase tracking-wider">{selectedVehicle.vin?.toUpperCase() || 'Neuvedeno'}</span></div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col p-5 bg-slate-50 rounded-3xl border border-slate-100"><span className="text-[10px] font-black text-slate-400 uppercase mb-1">Značka</span><span className="text-xl font-black text-slate-900 uppercase">{selectedVehicle.make}</span></div>
                      <div className="flex flex-col p-5 bg-slate-50 rounded-3xl border border-slate-100"><span className="text-[10px] font-black text-slate-400 uppercase mb-1">Model</span><span className="text-xl font-black text-slate-900 uppercase">{selectedVehicle.model}</span></div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col p-5 bg-slate-50 rounded-3xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Stav kilometrů</span>
                        <div className="flex items-baseline gap-1">
                           <span className="text-xl font-black text-slate-900">{selectedVehicle.mileage ? selectedVehicle.mileage.toLocaleString() : '---'}</span>
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">KM</span>
                        </div>
                      </div>
                      <div className="flex flex-col p-5 bg-slate-50 rounded-3xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Rok výroby</span>
                        <span className="text-xl font-black text-slate-900">{selectedVehicle.year || '---'}</span>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col p-5 bg-slate-50 rounded-3xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Výkon motoru</span>
                        <div className="flex items-baseline gap-2">
                           <span className="text-xl font-black text-slate-900 uppercase">{selectedVehicle.enginePower || '---'} <span className="text-[10px] text-slate-400">kW</span></span>
                           {selectedVehicle.enginePower && <span className="text-[10px] font-bold text-slate-400">({Math.round(parseFloat(selectedVehicle.enginePower) * 1.341)} HP)</span>}
                        </div>
                      </div>
                      <div className="flex flex-col p-5 bg-slate-50 rounded-3xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Kód motoru</span>
                        <span className="text-xl font-black text-slate-900 uppercase">{selectedVehicle.engineCode || '---'}</span>
                      </div>
                   </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="flex flex-col p-5 bg-slate-50 rounded-3xl border border-slate-100">
                         <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Druh paliva</span>
                         <div className="flex items-center gap-2">
                           <Fuel className="w-4 h-4 text-blue-600" />
                           <span className="text-xl font-black text-slate-900 uppercase">{selectedVehicle.fuelType || '---'}</span>
                         </div>
                       </div>
                       <div className="flex flex-col p-5 bg-slate-50 rounded-3xl border border-slate-100">
                         <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Karoserie</span>
                         <span className="text-sm font-black text-slate-900 uppercase">{selectedVehicle.bodyType || 'Neuvedeno'}</span>
                       </div>
                    </div>
                    <div className="flex flex-col p-5 bg-slate-50 rounded-3xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Druh pohonu</span>
                      <span className="text-sm font-black text-slate-900 uppercase">{selectedVehicle.driveType || 'Neuvedeno'}</span>
                    </div>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-xs font-black text-blue-600 uppercase tracking-[0.3em] border-b border-slate-100 pb-3 flex items-center gap-3"><Timer className="w-4 h-4" /> Servisní intervaly</h4>
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { key: 'stk', label: 'STK', date: selectedVehicle.stkExpirationDate, interval: 0, icon: ShieldCheck, color: 'text-emerald-600' },
                    { key: 'oil', label: 'Motorový olej', date: selectedVehicle.oilChangeDate, interval: selectedVehicle.oilChangeInterval || selectedVehicle.serviceIntervalMonths || 12, icon: Wrench, color: 'text-amber-500' },
                    { key: 'brake', label: 'Brzdová kapalina', date: selectedVehicle.brakeFluidDate, interval: selectedVehicle.brakeFluidInterval || 24, icon: Droplets, color: 'text-blue-500' },
                    { key: 'coolant', label: 'Chladicí kapalina', date: selectedVehicle.coolantDate, interval: selectedVehicle.coolantInterval || 60, icon: Droplets, color: 'text-emerald-500' },
                    { key: 'timing', label: 'Rozvody motoru', date: selectedVehicle.timingBeltDate, interval: selectedVehicle.timingBeltInterval || 120, icon: Settings2, color: 'text-red-500' },
                  ].map((item, idx) => {
                    const nextDate = item.key === 'stk' ? (item.date ? new Date(item.date) : null) : calculateNextDate(item.date, item.interval);
                    const isOverdue = nextDate && nextDate < new Date();
                    
                    return (
                      <div key={idx} className={`rounded-[2rem] p-6 border transition-all ${isOverdue ? 'bg-red-50 border-red-200 animate-pulse' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex justify-between items-center mb-4"><span className={`text-[11px] font-black uppercase flex items-center gap-2 ${isOverdue ? 'text-red-600' : item.color}`}><item.icon className="w-4 h-4" /> {item.label}</span></div>
                        <div className="flex justify-between items-end">
                           {item.key === 'stk' ? (
                             <>
                               <div><p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Platnost do</p><p className={`text-lg font-black ${isOverdue ? 'text-red-600' : (nextDate ? 'text-emerald-600' : 'text-slate-300')}`}>{nextDate ? nextDate.toLocaleDateString('cs-CZ') : '---'}</p></div>
                               <div className="text-right">
                                  {isOverdue && <span className="text-[8px] font-black bg-red-600 text-white px-2 py-0.5 rounded uppercase">Prošlá!</span>}
                               </div>
                             </>
                           ) : (
                             <>
                               <div><p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Naposledy</p><p className="text-sm font-black">{formatDate(item.date)}</p></div>
                               <div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Doporučená výměna</p><p className={`text-lg font-black ${isOverdue ? 'text-red-600' : (nextDate ? 'text-emerald-600' : 'text-slate-300')}`}>{nextDate ? nextDate.toLocaleDateString('cs-CZ') : '---'}</p></div>
                             </>
                           )}
                        </div>
                      </div>
                    );
                  })}

                  {(() => {
                    const isAutomat = selectedVehicle.gearboxType === 'AUTOMAT';
                    const lastKm = selectedVehicle.gearboxOilLastKm || 0;
                    const intervalKm = selectedVehicle.gearboxOilIntervalKm || (isAutomat ? 60000 : 240000);
                    const nextKm = lastKm > 0 ? (lastKm + intervalKm) : null;
                    const isKmOverdue = nextKm && selectedVehicle.mileage >= nextKm;

                    const nextGearboxDate = !isAutomat ? calculateNextDate(selectedVehicle.gearboxOilDate, selectedVehicle.gearboxOilInterval) : null;
                    const isDateOverdue = nextGearboxDate && nextGearboxDate < new Date();
                    
                    const isOverdue = isKmOverdue || isDateOverdue;

                    return (
                      <div className={`rounded-[2rem] p-6 border transition-all ${isOverdue ? 'bg-red-50 border-red-200 animate-pulse' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex justify-between items-center mb-4">
                          <span className={`text-[11px] font-black uppercase flex items-center gap-2 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                            <Droplets className="w-4 h-4" /> Olej převodovky ({isAutomat ? 'AUTOMAT' : 'MANUÁL'})
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <div><p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Naposledy při</p><p className="text-sm font-black">{lastKm > 0 ? `${lastKm.toLocaleString()} km` : '---'}</p></div>
                              <div className="mt-2"><p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Doporučená výměna v km</p><p className={`text-lg font-black ${isKmOverdue ? 'text-red-600' : (nextKm ? 'text-emerald-600' : 'text-slate-300')}`}>{nextKm ? `${nextKm.toLocaleString()} km` : '---'}</p></div>
                           </div>

                           {!isAutomat && (
                             <div className="text-right">
                               <div><p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Naposledy (Datum)</p><p className="text-sm font-black">{formatDate(selectedVehicle.gearboxOilDate)}</p></div>
                               <div className="mt-2"><p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Doporučená výměna (Datum)</p><p className={`text-lg font-black ${isDateOverdue ? 'text-red-600' : (nextGearboxDate ? 'text-emerald-600' : 'text-slate-300')}`}>{nextGearboxDate ? nextGearboxDate.toLocaleDateString('cs-CZ') : '---'}</p></div>
                             </div>
                           )}
                           {isAutomat && (
                             <div className="text-right flex flex-col justify-end">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Mění se pouze</p>
                                <p className="text-xs font-black">podle nájezdu</p>
                             </div>
                           )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-6">
                  <h4 className="text-xs font-black text-blue-600 uppercase tracking-[0.3em] border-b border-slate-100 pb-3 flex items-center gap-3"><FolderOpen className="w-4 h-4" /> Dokumenty a Přílohy vozu</h4>
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest overflow-hidden text-ellipsis whitespace-nowrap">Relativní cesta: Priloha/Vozidla/{selectedVehicle.make} {selectedVehicle.model} - {selectedVehicle.licensePlate}/</p>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 shrink-0"
                      >
                        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus className="w-3.5 h-3.5" />}
                        {isUploading ? 'NAHRÁVÁM...' : 'PŘIDAT SOUBOR'}
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
                      />
                    </div>

                    <div className="space-y-2">
                      {selectedVehicle.attachments && selectedVehicle.attachments.length > 0 ? (
                        selectedVehicle.attachments.map(att => (
                          <div key={att.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:bg-white hover:shadow-md transition-all">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-slate-400 group-hover:text-blue-600 transition-colors shrink-0">
                                {att.name.toLowerCase().endsWith('.pdf') ? <FileText className="w-5 h-5" /> : att.name.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/) ? <ImageIcon className="w-5 h-5" /> : <Paperclip className="w-5 h-5" />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-900 truncate uppercase mt-0.5">{att.name}</p>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{att.size}</span>
                                  <span className="text-[9px] font-black text-slate-300">•</span>
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{formatDate(att.uploadDate)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity ml-4 shrink-0">
                              <button 
                                onClick={() => handleOpenFile(att.relativePath)}
                                className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                                title="Otevřít"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteFile(att.id, att.relativePath)}
                                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                                title="Smazat"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-slate-300 bg-slate-50/30">
                          <FolderOpen className="w-12 h-12 opacity-10 mb-3" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Žádné přílohy k tomuto vozu</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-10 border-t border-slate-50 bg-white shrink-0"><button onClick={handleCloseModals} className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] transition-all hover:bg-slate-800 shadow-2xl">ZAVŘÍT KARTU</button></div>
          </div>
        </div>
      )}

      {historyVehicle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><HistoryIcon className="w-6 h-6" /></div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Historie oprav</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">{historyVehicle.make} {historyVehicle.model} ({historyVehicle.licensePlate})</p>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handlePrintHistory(historyVehicle.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all shadow-lg"
                  >
                    <BookOpen className="w-4 h-4" /> Tisk historie
                  </button>
                  <button onClick={handleCloseModals} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X className="w-6 h-6" /></button>
               </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50 custom-scrollbar">
              {vehicleServices.length > 0 ? (
                <div className="space-y-4">
                  {vehicleServices.map((s) => (
                    <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 opacity-20 group-hover:opacity-100 transition-opacity"></div>
                       <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDate(s.date)}</span>
                               <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded">#{s.id}</span>
                            </div>
                            <h4 className="text-base font-black text-slate-900 line-clamp-1">{s.description}</h4>
                          </div>
                          <button onClick={() => { onNavigateToOrder(s.id); setHistoryVehicleId(null); }} className="p-2 text-slate-300 hover:text-blue-600 transition-colors"><ChevronRight className="w-6 h-6" /></button>
                       </div>
                       <div className="flex flex-wrap gap-4 items-center pt-4 border-t border-slate-50">
                          <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center"><User className="w-4 h-4 text-slate-400" /></div><span className="text-xs font-bold text-slate-600">{s.technician}</span></div>
                          <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center"><Gauge className="w-4 h-4 text-slate-400" /></div><span className="text-xs font-bold text-slate-600">{s.mileageAtEntry?.toLocaleString() || '---'} km</span></div>
                          <div className="ml-auto text-right"><span className="text-[10px] font-black text-slate-400 uppercase block mb-0.5">Celkem vč. DPH</span><span className="text-base font-black text-slate-900">{(s.cost * 1.21).toLocaleString()} Kč</span></div>
                       </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center flex flex-col items-center">
                  <Wrench className="w-16 h-16 text-slate-200 mb-6" />
                  <h4 className="text-lg font-black text-slate-400 uppercase">Žádná historie</h4>
                  <p className="text-sm font-medium text-slate-400 max-w-xs mx-auto mt-2">Tento vůz zatím nemá v systému žádné dokončené servisní záznamy.</p>
                </div>
              )}
            </div>
            
            <div className="p-8 border-t bg-white shrink-0">
               <button onClick={() => setHistoryVehicleId(null)} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all uppercase text-xs tracking-widest">Zavřít historii</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
              <h3 className="text-2xl font-black tracking-tight">{editingVehicle ? 'Upravit vozidlo' : 'Nové vozidlo'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex border-b border-slate-100 bg-slate-50">
               <button onClick={() => setActiveTab('basic')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'basic' ? 'border-b-4 border-blue-600 text-blue-600 bg-white' : 'text-slate-400 hover:text-slate-600'}`}>Základní údaje</button>
               <button onClick={() => setActiveTab('intervals')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'intervals' ? 'border-b-4 border-blue-600 text-blue-600 bg-white' : 'text-slate-400 hover:text-slate-600'}`}>Intervaly</button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
              {activeTab === 'basic' ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">VIN kód</label>
                    <div className="flex gap-2">
                       <input 
                        autoFocus
                        type="text" 
                        placeholder="Zadejte VIN..."
                        className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none font-black uppercase font-mono tracking-widest" 
                        value={formData.vin || ''} 
                        onChange={e => setFormData({...formData, vin: e.target.value.toUpperCase()})} 
                      />
                      <button 
                        type="button"
                        onClick={handleFormRsvSync}
                        disabled={isFormRsvLoading || !formData.vin}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 rounded-2xl shadow-lg transition-all flex items-center justify-center group"
                        title="Načíst údaje z registru dle VIN"
                      >
                        {isFormRsvLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                      </button>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter ml-1">Tip: Použijte tlačítko s hvězdičkami pro automatické vyplnění údajů.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Značka</label><input required type="text" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none font-bold" value={formData.make} onChange={e => setFormData({...formData, make: e.target.value})} /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Model</label><input required type="text" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none font-bold" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} /></div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rok výroby</label><input type="number" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none font-bold" value={formData.year} onChange={e => setFormData({...formData, year: parseInt(e.target.value) || 0})} /></div>
                    <div className="space-y-2 col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SPZ / RZ</label><input required type="text" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none font-bold uppercase tracking-widest" value={formData.licensePlate || ''} onChange={e => setFormData({...formData, licensePlate: e.target.value.toUpperCase()})} /></div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Druh pohonu</label>
                      <input type="text" placeholder="např. 4x4, Přední" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none font-bold" value={formData.driveType || ''} onChange={e => setFormData({...formData, driveType: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Typ karoserie</label>
                      <input type="text" placeholder="např. KOMBI, SEDAN" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none font-bold uppercase" value={formData.bodyType || ''} onChange={e => setFormData({...formData, bodyType: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Druh paliva</label>
                       <select 
                         className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none font-bold appearance-none"
                         value={formData.fuelType || ''}
                         onChange={e => setFormData({...formData, fuelType: e.target.value as any})}
                       >
                         <option value="">Vyberte palivo...</option>
                         <option value="Benzín 95">Benzín 95</option>
                         <option value="Benzín 98">Benzín 98</option>
                         <option value="Nafta">Nafta</option>
                         <option value="Ostatní">Ostatní</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Typ převodovky</label>
                       <select 
                         className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none font-bold appearance-none"
                         value={formData.gearboxType || 'MAN'}
                         onChange={e => {
                           const val = e.target.value as 'MAN' | 'AUTOMAT';
                           setFormData({
                             ...formData, 
                             gearboxType: val, 
                             gearboxOilIntervalKm: val === 'AUTOMAT' ? 60000 : 240000,
                             ...(val === 'MAN' && { gearboxOilInterval: 60 })
                           });
                         }}
                       >
                         <option value="MAN">MANUÁLNÍ</option>
                         <option value="AUTOMAT">AUTOMATICKÁ</option>
                       </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Najeto (km)</label><input type="number" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none font-bold" value={formData.mileage || 0} onChange={e => setFormData({...formData, mileage: parseInt(e.target.value) || 0})} /></div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Výkon (kW)</label>
                      <input type="text" placeholder="např. 110" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none font-bold" value={formData.enginePower || ''} onChange={e => setFormData({...formData, enginePower: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kód motoru</label>
                      <input type="text" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none font-bold uppercase" value={formData.engineCode || ''} onChange={e => setFormData({...formData, engineCode: e.target.value})} />
                    </div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">STK do</label><input type="date" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none font-bold" value={formData.stkExpirationDate || ''} onChange={e => setFormData({...formData, stkExpirationDate: e.target.value})} /></div>
                  </div>
                    <div className="space-y-2 relative" ref={customerSelectRef}>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vlastník / Zákazník</label>
                      <button 
                        type="button"
                        onClick={() => setIsCustomerSelectOpen(!isCustomerSelectOpen)}
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 outline-none font-bold text-left flex justify-between items-center"
                      >
                        <span className="truncate">
                          {(() => {
                            const selectedCust = customers.find(c => c.id === formData.customerId);
                            if (!selectedCust) return 'Vyberte zákazníka...';
                            return selectedCust.customerType === 'firemní' ? selectedCust.companyName : `${selectedCust.lastName} ${selectedCust.firstName}`;
                          })()}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isCustomerSelectOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {isCustomerSelectOpen && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden" onClick={e => e.stopPropagation()}>
                          <div className="p-3 border-b border-slate-100 relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-6 top-1/2 -translate-y-1/2" />
                            <input 
                              type="text" 
                              placeholder="Hledat zákazníka..." 
                              className="w-full bg-slate-50 rounded-xl pl-10 pr-4 py-2 text-sm font-bold outline-none"
                              value={customerSearchQuery}
                              onChange={e => setCustomerSearchQuery(e.target.value)}
                              autoFocus
                            />
                          </div>
                          <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                            {sortedFilteredCustomersForSelect.length > 0 ? (
                              sortedFilteredCustomersForSelect.map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setFormData({...formData, customerId: c.id});
                                    setIsCustomerSelectOpen(false);
                                    setCustomerSearchQuery('');
                                  }}
                                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-colors ${formData.customerId === c.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                  {c.customerType === 'firemní' ? c.companyName : `${c.lastName} ${c.firstName}`}
                                </button>
                              ))
                            ) : (
                              <div className="px-4 py-3 text-sm text-slate-400 text-center font-bold">Nenalezen žádný zákazník</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
              ) : (
                <div className="space-y-6">
                    {[
                    { label: 'Motorový olej', date: 'oilChangeDate', interval: 'oilChangeInterval' },
                    { label: 'Brzdová kapalina', date: 'brakeFluidDate', interval: 'brakeFluidInterval' },
                    { label: 'Chladicí kapalina', date: 'coolantDate', interval: 'coolantInterval' },
                    { label: 'Rozvody motoru', date: 'timingBeltDate', interval: 'timingBeltInterval' },
                    { label: 'Klimatizace', date: 'refrigerantDate', interval: 'refrigerantInterval' },
                  ].map(item => (
                    <div key={item.date} className="grid grid-cols-2 gap-6 p-6 bg-slate-50 rounded-3xl">
                       <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.label}</label><input type="date" className="w-full bg-white border-none rounded-xl px-4 py-2 font-bold text-xs" value={(formData as any)[item.date] || ''} onChange={e => setFormData({...formData, [item.date]: e.target.value})} /></div>
                       <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Interval (měsíce)</label><input type="number" className="w-full bg-white border-none rounded-xl px-4 py-2 font-bold text-xs" value={(formData as any)[item.interval] || 0} onChange={e => setFormData({...formData, [item.interval]: parseInt(e.target.value) || 0})} /></div>
                    </div>
                  ))}
                  
                  <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                     <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                       <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Olej převodovky ({formData.gearboxType === 'AUTOMAT' ? 'AUTOMAT' : 'MANUÁL'})</label>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-6 pt-2">
                       <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Při kolika km měněno</label><input type="number" className="w-full bg-white border-none rounded-xl px-4 py-2 font-bold text-xs" value={formData.gearboxOilLastKm || ''} onChange={e => setFormData({...formData, gearboxOilLastKm: parseInt(e.target.value) || 0})} /></div>
                       <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Interval (km)</label><input type="number" className="w-full bg-white border-none rounded-xl px-4 py-2 font-bold text-xs" value={formData.gearboxOilIntervalKm || ''} onChange={e => setFormData({...formData, gearboxOilIntervalKm: parseInt(e.target.value) || 0})} /></div>
                     </div>

                     {formData.gearboxType !== 'AUTOMAT' && (
                       <div className="grid grid-cols-2 gap-6 pt-2">
                         <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nebo datum měnění</label><input type="date" className="w-full bg-white border-none rounded-xl px-4 py-2 font-bold text-xs" value={formData.gearboxOilDate || ''} onChange={e => setFormData({...formData, gearboxOilDate: e.target.value})} /></div>
                         <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Interval (měsíce)</label><input type="number" className="w-full bg-white border-none rounded-xl px-4 py-2 font-bold text-xs" value={formData.gearboxOilInterval || 0} onChange={e => setFormData({...formData, gearboxOilInterval: parseInt(e.target.value) || 0})} /></div>
                       </div>
                     )}
                  </div>
                </div>
              )}
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3"><Check className="w-6 h-6" /> {editingVehicle ? 'ULOŽIT ZMĚNY' : 'REGISTROVAT VOZIDLO'}</button>
            </form>
          </div>
        </div>
      )}

      {deletingVehicle && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 text-center relative z-10 shadow-2xl">
             <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
             <h3 className="text-2xl font-black mb-2 tracking-tighter">Opravdu smazat?</h3>
             <p className="text-slate-500 mb-8 font-medium leading-relaxed">Vozidlo {deletingVehicle.make} {deletingVehicle.model} bude trvale odstraněno z databáze.</p>
             <div className="flex gap-4">
                <button onClick={() => setDeletingVehicle(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-sm uppercase">Zrušit</button>
                <button onClick={() => { onDeleteVehicle(deletingVehicle.id); setDeletingVehicle(null); }} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-sm uppercase shadow-lg shadow-red-600/20">Smazat</button>
             </div>
          </div>
        </div>
      )}

      {historyVehicle && (
        <ServiceHistoryReport 
          vehicle={historyVehicle}
          services={enrichedServices.length > 0 ? enrichedServices : services.filter(s => s.vehicleId === historyVehicle.id)}
          companyInfo={companyInfo}
        />
      )}

      {isAiProcessing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"></div>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 text-center relative z-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="relative mb-8">
              <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                <Sparkles className="w-10 h-10 animate-pulse" />
              </div>
              <div className="absolute -top-2 -right-2">
                <div className="bg-slate-900 text-white text-[10px] font-black px-3 py-1 rounded-full border-2 border-white shadow-lg">AI</div>
              </div>
            </div>
            
            <h3 className="text-xl font-black mb-2 tracking-tight">AI optimalizuje záznamy...</h3>
            <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
              Transformujeme servisní poznámky na profesionální servisní věty.
            </p>
            
            <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
              <div 
                className="absolute top-0 left-0 h-full bg-blue-600 transition-all duration-500 ease-out rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                style={{ width: `${(aiProgress.current / aiProgress.total) * 100}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>Zpracovávání...</span>
              <span className="text-blue-600">{aiProgress.current} / {aiProgress.total}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleManager;