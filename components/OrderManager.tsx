
import React, { useState, useEffect, useMemo, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { 
  ClipboardList, Plus, User, Car, ArrowRight, X, Check, 
  Search, Package, Printer, Trash2, Tag, FileText, AlertCircle, Eye, CheckSquare, Square, Receipt,
  MoreHorizontal, Edit3, Clock, Timer, CheckCircle2, ChevronRight, ChevronDown, ListPlus, Calculator, Layout,
  Paperclip, FilePlus, Image as ImageIcon, Loader2, Table, FileSearch, Sparkles, FileDown
} from 'lucide-react';
import { ServiceRecord, Vehicle, Customer, PartItem, CompanyInfo, FixedService, VehicleChecklist, PredefinedTask, Invoice, AttachmentItem } from '../types';
import * as XLSX from 'xlsx';
import { processExcelLocally, parseNativeCsv } from '../services/fileParser';
import { analyzePdfParts } from '../services/geminiService';

interface OrderManagerProps {
  services: ServiceRecord[];
  vehicles: Vehicle[];
  customers: Customer[];
  invoices: Invoice[];
  technicians: string[];
  predefinedTasks: PredefinedTask[];
  hourlyRate: number;
  fixedServices: FixedService[];
  onUpdateFixedService: (service: FixedService) => void;
  companyInfo: CompanyInfo;
  onAddService: (service: ServiceRecord) => void;
  onUpdateService: (service: ServiceRecord) => void;
  onUpdateVehicle?: (vehicle: Vehicle) => void;
  onDeleteService: (orderId: string) => void;
  onCreateInvoice?: (orderId: string) => void;
  autoOpen?: boolean;
  onModalOpened?: () => void;
  initialOrderId?: string | null;
  preselectedVehicleId?: string | null;
  prefilledData?: Partial<ServiceRecord> | null;
  selectedPrinter?: string;
  search: string;
  onSearchChange: (value: string) => void;
  pendingEmailAttachment?: {
    fileData: string;
    fileName: string;
    fileType: string;
    orderId: string;
  } | null;
  onClearPendingAttachment?: () => void;
}

const formatDate = (dateStr: any) => {
  if (typeof dateStr !== 'string' || !dateStr) return '---';
  const datePart = dateStr.split('T')[0];
  if (!datePart) return '---';
  const parts = datePart.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

const OrderManager: React.FC<OrderManagerProps> = ({ 
  services, 
  vehicles, 
  customers,
  invoices,
  technicians,
  predefinedTasks,
  hourlyRate,
  fixedServices,
  onUpdateFixedService,
  companyInfo,
  onAddService,
  onUpdateService,
  onUpdateVehicle,
  onDeleteService,
  onCreateInvoice,
  autoOpen, 
  onModalOpened, 
  initialOrderId,
  preselectedVehicleId,
  prefilledData,
  search,
  onSearchChange,
  pendingEmailAttachment,
  onClearPendingAttachment
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [isPriceListPickerOpen, setIsPriceListPickerOpen] = useState(false);
  const [pricelistSearch, setPricelistSearch] = useState('');
  const pricelistInputRef = useRef<HTMLInputElement>(null);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  
  const [isAiImportOpen, setIsAiImportOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiImportItems, setAiImportItems] = useState<Partial<PartItem>[]>([]);
  const [selectedAiIndices, setSelectedAiIndices] = useState<Set<number>>(new Set());

  const [deletingOrder, setDeletingOrder] = useState<ServiceRecord | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showInvoicePrompt, setShowInvoicePrompt] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  const orderRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const saveOrderToArchive = async () => {
    if (!orderRef.current) return;
    setIsArchiving(true);
    try {
      const element = orderRef.current;
      
      // Sanitizace názvu souboru
      const safeOrderNumber = formData.id.replace(/\//g, '-');
      const fileName = `Zakázka - ${safeOrderNumber}.pdf`;

      // Dočasné nastavení šířky pro zachycení
      const originalWidth = element.style.width;
      element.style.width = '210mm';
      
      const opt = {
        margin: 0, 
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          width: 794
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const worker = (html2pdf as any)().from(element).set(opt);
      const pdfBlob = await worker.output('blob');

      // Vrátíme původní šířku
      element.style.width = originalWidth;

      const arrayBuffer = await pdfBlob.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      const newAttachment = await (window as any).electronAPI.attachment.upload({
        type: 'order',
        identifier: '', 
        fileName: fileName,
        fileData: fileData
      });

      const vehicle = vehicles.find(v => v.id === formData.vehicleId);
      if (vehicle && onUpdateVehicle) {
        const updatedVehicle = {
          ...vehicle,
          attachments: [...(vehicle.attachments || []), newAttachment],
          updatedAt: new Date().toISOString()
        };
        onUpdateVehicle(updatedVehicle);
      }
      alert('Zakázka byla uložena do archivu a k vozidlu.');
    } catch (err) {
      console.error(err);
      alert('Chyba při ukládání PDF zakázky.');
    } finally {
      setIsArchiving(false);
    }
  };

  const [formData, setFormData] = useState({
    id: '',
    vehicleId: '',
    description: '',
    parts: [] as PartItem[],
    date: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    endDate: '',
    technician: technicians[0] || '',
    laborHours: 0,
    status: 'naplánováno' as ServiceRecord['status'],
    fuelLevel: '50%' as ServiceRecord['fuelLevel'],
    mileageAtEntry: 0,
    estimatedPrice: 0,
    paymentType: 'Hotovost' as ServiceRecord['paymentType'],
    checklist: {
      rezerva: false, zvedak: false, klic: false, bezp_klic: false,
      trojuhelnik: false, lekarna: false, lepeni: false
    } as VehicleChecklist,
    attachments: [] as AttachmentItem[],
    returnParts: 'nevracet' as 'vrátit' | 'nevracet'
  });

  const materialCost = useMemo(() => {
    return (formData.parts || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }, [formData.parts]);

  const calculatedCost = useMemo(() => {
    return (formData.laborHours * hourlyRate) + materialCost;
  }, [formData.laborHours, materialCost, hourlyRate]);

  const resetForm = (vId?: string) => {
    const selectedVeh = vId ? vehicles.find(v => v.id === vId) : null;
    setFormData({
      id: '',
      vehicleId: vId || '',
      description: '',
      parts: [] as PartItem[],
      date: new Date().toISOString().split('T')[0],
      deliveryDate: '',
      endDate: '',
      technician: technicians[0] || '',
      laborHours: 0,
      status: 'naplánováno',
      fuelLevel: '50%',
      mileageAtEntry: selectedVeh ? selectedVeh.mileage : 0,
      estimatedPrice: 0,
      paymentType: 'Hotovost',
      checklist: {
        rezerva: false, zvedak: false, klic: false, bezp_klic: false,
        trojuhelnik: false, lekarna: false, lepeni: false
      },
      attachments: [],
      returnParts: 'nevracet'
    });
  };

  const handleCloseModals = () => {
    setIsModalOpen(false);
    setIsPriceListPickerOpen(false);
    setIsTemplatePickerOpen(false);
    setIsAiImportOpen(false);
    setDeletingOrder(null);
    setShowInvoicePrompt(null);
    setOpenMenuId(null);
    
    // Electron focus fix
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      window.focus();
    }, 50);
  };

  const handleAddNew = (vId?: string) => {
    resetForm(vId);
    if (prefilledData) {
      setFormData(prev => ({
        ...prev,
        ...prefilledData,
        checklist: prefilledData.checklist || prev.checklist,
        parts: prefilledData.parts || prev.parts,
        attachments: prefilledData.attachments || prev.attachments
      }));
    }
    setEditingOrderId(null);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (autoOpen) {
      handleAddNew(preselectedVehicleId || prefilledData?.vehicleId || undefined);
      if (onModalOpened) onModalOpened();
    }
  }, [autoOpen, preselectedVehicleId, prefilledData]);

  useEffect(() => {
    if (initialOrderId) {
      const order = services.find(s => s.id === initialOrderId);
      if (order) {
        handleEdit(order);
        if (onModalOpened) onModalOpened();
      }
    }
  }, [initialOrderId, services]);

  useEffect(() => {
    if (isModalOpen && editingOrderId && pendingEmailAttachment && pendingEmailAttachment.orderId === editingOrderId) {
      const { fileData, fileName, fileType } = pendingEmailAttachment;
      
      const processAttachment = async () => {
        setAiLoading(true);
        setIsAiImportOpen(true);

        try {
          let items: Partial<PartItem>[] = [];
          
          // 1. Zkusit nejdřív nativní CSV parser pro LKQ/SAG (pokud to není PDF)
          if (!fileName.toLowerCase().endsWith('.pdf')) {
            try {
              // Převod base64 na string pro nativní parser
              const binaryString = window.atob(fileData);
              // Dekódování UTF-8 (odolnější než jen atob)
              const decoder = new TextDecoder('utf-8');
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const decodedText = decoder.decode(bytes);
              
              const nativeItems = parseNativeCsv(decodedText);
              if (nativeItems && nativeItems.length > 0) {
                console.log('Using native CSV parser for:', fileName);
                items = nativeItems;
              }
            } catch (nativeErr) {
              console.warn('Native CSV parsing failed, falling back to generic/AI:', nativeErr);
            }
          }

          // 2. Pokud nativní parser nic nenašel, pokračovat původní logikou
          if (items.length === 0) {
            if (fileName.toLowerCase().endsWith('.pdf')) {
              items = await analyzePdfParts(fileData, companyInfo.isVatPayer);
            } else {
              // Obecné Excel/CSV parsování přes XLSX
              const binaryString = window.atob(fileData);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              const workbook = XLSX.read(bytes, { type: 'array' });
              const sheetName = workbook.SheetNames[0];
              const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
              items = processExcelLocally(jsonData, companyInfo.isVatPayer);
            }
          }

          setAiImportItems(items);
          setSelectedAiIndices(new Set(items.map((_, i) => i)));

          // Add as attachment to form
          const vehicle = vehicles.find(v => v.id === formData.vehicleId);
          const identifier = vehicle 
            ? `${vehicle.make} ${vehicle.model} - ${vehicle.licensePlate}` 
            : (formData.vehicleId || 'unsigned');

          const newAttachment = await (window as any).electronAPI.attachment.upload({
            type: 'vehicle',
            identifier: identifier,
            fileName: fileName,
            fileData: new Uint8Array(atob(fileData).split("").map(c => c.charCodeAt(0)))
          });
          setFormData(prev => ({ ...prev, attachments: [...prev.attachments, newAttachment] }));
        } catch (err) {
          console.error('Automatic analysis failed:', err);
        } finally {
          setAiLoading(false);
          onClearPendingAttachment?.();
        }
      };

      processAttachment();
    }
  }, [isModalOpen, editingOrderId, pendingEmailAttachment]);

  const handleEdit = (order: ServiceRecord) => {
    const vehicle = vehicles.find(v => v.id === order.vehicleId);
    setEditingOrderId(order.id);
    setFormData({
      id: order.id,
      vehicleId: order.vehicleId,
      description: order.description,
      parts: order.parts || [],
      date: order.date,
      deliveryDate: order.deliveryDate || '',
      endDate: order.endDate || '',
      technician: order.technician,
      laborHours: order.laborHours || 0,
      status: order.status,
      fuelLevel: order.fuelLevel || '50%',
      mileageAtEntry: order.mileageAtEntry || (vehicle?.mileage || 0),
      estimatedPrice: order.estimatedPrice || 0,
      paymentType: order.paymentType || 'Hotovost',
      checklist: order.checklist || {
        rezerva: false, zvedak: false, klic: false, bezp_klic: false,
        trojuhelnik: false, lekarna: false, lepeni: false
      },
      attachments: order.attachments || [],
      returnParts: order.returnParts || 'nevracet'
    });
    setIsModalOpen(true);
    setOpenMenuId(null);
  };

  const handleQuickStatusUpdate = (order: ServiceRecord, s: ServiceRecord['status']) => {
    const updates = { 
      ...order, 
      status: s,
      updatedAt: new Date().toISOString()
    };
    if (s === 'hotovo' && !order.deliveryDate) {
      updates.deliveryDate = new Date().toISOString().split('T')[0];
    }
    onUpdateService(updates);
  };

  const generateNewId = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `${year}/${month}/`;
    
    // FIX: Inteligentní vyhledání první volné mezery pro ID zakázky
    const monthlyOrders = services.filter(s => s.id.startsWith(prefix));
    const usedSeqs = new Set(monthlyOrders.map(s => {
      const parts = s.id.split('/');
      return parseInt(parts[parts.length - 1]);
    }));

    let seq = 1;
    while (usedSeqs.has(seq)) {
      seq++;
    }

    const nextSequence = seq.toString().padStart(3, '0');
    return `${prefix}${nextSequence}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalId = editingOrderId || generateNewId();
    const serviceData: ServiceRecord = {
      ...formData,
      id: finalId,
      cost: calculatedCost,
      updatedAt: new Date().toISOString()
    };
    if (editingOrderId) onUpdateService(serviceData);
    else onAddService(serviceData);
    handleCloseModals();
    
    const hasInvoice = invoices.some(inv => inv.orderId === finalId);
    if (serviceData.status === 'hotovo' && !hasInvoice) {
      setShowInvoicePrompt(finalId);
    }
    resetForm();
  };

  const addPart = () => {
    setFormData({
      ...formData,
      parts: [...(formData.parts || []), { id: Date.now().toString(), description: '', quantity: 1, unit: 'ks', unitPrice: 0, costPrice: 0 }]
    });
  };

  const removePart = (id: string) => {
    setFormData({ ...formData, parts: (formData.parts || []).filter(p => p.id !== id) });
  };

  const updatePart = (id: string, field: keyof PartItem, value: any) => {
    setFormData({
      ...formData,
      parts: (formData.parts || []).map(p => p.id === id ? { ...p, [field]: value } : p)
    });
  };

  const updateOrderField = (field: string, value: any) => {
    if (field === 'vehicleId') {
      const selectedVeh = vehicles.find(v => v.id === value);
      setFormData({
        ...formData,
        vehicleId: value,
        mileageAtEntry: selectedVeh ? selectedVeh.mileage : formData.mileageAtEntry
      });
    } else {
      setFormData(prev => {
        const next = { ...prev, [field]: value };
        if (field === 'status' && value === 'hotovo' && !next.deliveryDate) {
          next.deliveryDate = new Date().toISOString().split('T')[0];
        }
        return next;
      });
    }
  };

  useEffect(() => {
    if (isPriceListPickerOpen) {
      setPricelistSearch('');
      setTimeout(() => {
        if (pricelistInputRef.current) pricelistInputRef.current.focus();
      }, 100);
    }
  }, [isPriceListPickerOpen]);

  const [pricelistActiveTab, setPricelistActiveTab] = useState<'díly' | 'úkony' | 'materiál'>('díly');

  const addFromPriceList = (item: FixedService) => {
    const priceValue = item.price;
    const costValue = item.costPrice || 0;

    setFormData({
      ...formData,
      parts: [...(formData.parts || []), { 
        id: Date.now().toString(), 
        description: item.name, 
        quantity: 1, 
        unit: item.unit || 'ks', 
        unitPrice: priceValue,
        costPrice: costValue
      }]
    });
    
    // Increment usage count
    onUpdateFixedService({
      ...item,
      usageCount: (item.usageCount || 0) + 1
    });
    
    setIsPriceListPickerOpen(false);
  };

  const addFromTemplates = (item: PredefinedTask) => {
    const currentDesc = formData.description;
    const separator = currentDesc.trim() ? '\n\n' : '';
    setFormData({ ...formData, description: `${currentDesc}${separator}${item.description}` });
    setIsTemplatePickerOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    setAiLoading(true);
    setIsAiImportOpen(true);

    try {
      let extractedParts: Partial<PartItem>[] = [];

      // 1. Zkusit nativní CSV parser pro LKQ/SAG
      if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt')) {
        const text = await file.text();
        const nativeItems = parseNativeCsv(text);
        if (nativeItems && nativeItems.length > 0) {
          extractedParts = nativeItems;
        }
      }

      // 2. Pokud nativní nenašel nic, zkusit XLSX nebo PDF
      if (extractedParts.length === 0) {
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
          
          extractedParts = processExcelLocally(jsonData, companyInfo.isVatPayer);
        } else if (file.type === 'application/pdf') {
          const base64Promise = new Promise<string>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.readAsDataURL(file);
          });
          const base64Data = await base64Promise;
          const splitted = base64Data.split(',');
          extractedParts = await analyzePdfParts(splitted.length > 1 ? splitted[1] : splitted[0], companyInfo.isVatPayer);
        }
      }

      if (extractedParts.length > 0) {
        setAiImportItems(extractedParts);
        setSelectedAiIndices(new Set(extractedParts.map((_, i) => i)));
      }

      const arrayBuffer = await file.arrayBuffer();
      
      // Pro zakázku ukládáme do složky vozidla
      const vehicle = vehicles.find(v => v.id === formData.vehicleId);
      const identifier = vehicle 
        ? `${vehicle.make} ${vehicle.model} - ${vehicle.licensePlate}` 
        : (formData.vehicleId || 'unsigned');

      const newAttachment = await (window as any).electronAPI.attachment.upload({
        type: 'vehicle',
        identifier: identifier,
        fileName: file.name,
        fileData: new Uint8Array(arrayBuffer)
      });
      setFormData(prev => ({ ...prev, attachments: [...prev.attachments, newAttachment] }));

    } catch (err) {
      console.error("Import error:", err);
      alert("Chyba při zpracování souboru.");
      setIsAiImportOpen(false);
    } finally {
      setAiLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const filteredOrders = useMemo(() => {
    return services.filter(order => {
      const relatedInvoice = invoices.find(inv => inv.orderId === order.id);
      if (relatedInvoice?.status === 'uhrazeno' && (order.status === 'hotovo' || order.status === 'zrušeno')) return false;
      const vehicle = vehicles.find(v => v.id === order.vehicleId);
      const owner = customers.find(c => c.id === vehicle?.customerId);
      if (!search) return true;
      return (order.id || "").toLowerCase().includes(search.toLowerCase()) ||
             (order.description || "").toLowerCase().includes(search.toLowerCase()) ||
             (vehicle?.licensePlate || "").toLowerCase().includes(search.toLowerCase()) ||
             (owner?.lastName || "").toLowerCase().includes(search.toLowerCase());
    });
  }, [services, vehicles, customers, invoices, search]);

  const columns = useMemo(() => ({
    waiting: filteredOrders.filter(o => o.status === 'naplánováno').sort((a, b) => a.date.localeCompare(b.date)),
    active: filteredOrders.filter(o => o.status === 'probíhá').sort((a, b) => a.date.localeCompare(b.date)),
    done: filteredOrders.filter(o => o.status === 'hotovo' || o.status === 'zrušeno').sort((a, b) => b.date.localeCompare(a.date)),
  }), [filteredOrders]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="print:hidden space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Přehled zakázek</h2>
            <p className="text-slate-500 font-medium">Správa zakázkových listů a plánování.</p>
          </div>
          <button onClick={() => handleAddNew()} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg">
            <Plus className="w-5 h-5" /> Nová zakázka
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input type="text" placeholder="Hledat zakázku (ID, SPZ, Zákazník)..." className="flex-1 text-sm font-medium outline-none bg-transparent" value={search} onChange={(e) => onSearchChange(e.target.value)} />
          {search && (
            <button 
              onClick={() => onSearchChange('')}
              className="text-blue-600 font-bold text-xs px-3 py-1 hover:bg-blue-50 rounded-lg transition-all"
            >
              Zrušit filtr
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pb-12">
          <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest px-2">K VYŘÍZENÍ</h3>
            <div className="space-y-4">
              {columns.waiting.map(order => (
                <OrderCard key={order.id} order={order} vehicles={vehicles} customers={customers} onEdit={handleEdit} onUpdateStatus={(s) => handleQuickStatusUpdate(order, s)} onOpenMenu={setOpenMenuId} openMenuId={openMenuId} onCreateInvoice={onCreateInvoice} onDelete={() => setDeletingOrder(order)} />
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <h3 className="text-sm font-black text-amber-700 uppercase tracking-widest px-2">PROBÍHÁ</h3>
            <div className="space-y-4">
              {columns.active.map(order => (
                <OrderCard key={order.id} order={order} vehicles={vehicles} customers={customers} onEdit={handleEdit} onUpdateStatus={(s) => handleQuickStatusUpdate(order, s)} onOpenMenu={setOpenMenuId} openMenuId={openMenuId} onCreateInvoice={onCreateInvoice} onDelete={() => setDeletingOrder(order)} />
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <h3 className="text-sm font-black text-emerald-700 uppercase tracking-widest px-2">HOTOVO</h3>
            <div className="space-y-4">
              {columns.done.map(order => (
                <OrderCard key={order.id} order={order} vehicles={vehicles} customers={customers} onEdit={handleEdit} onUpdateStatus={(s) => handleQuickStatusUpdate(order, s)} onOpenMenu={setOpenMenuId} openMenuId={openMenuId} onCreateInvoice={onCreateInvoice} onDelete={() => setDeletingOrder(order)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:p-0 print:bg-white print:absolute print:inset-0 print:block">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md no-print" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-[1100px] h-[95vh] rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col print:h-auto print:static print:shadow-none print:bg-white print:rounded-none print:max-w-none print:w-full print:overflow-visible print:block">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 shrink-0 no-print">
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-2 rounded-xl text-white"><FileText className="w-6 h-6" /></div>
                <h3 className="text-xl font-black tracking-tight uppercase">Editace Zakázkového Listu</h3>
              </div>
              <div className="flex gap-4">
                <button 
                  type="button" 
                  disabled={isArchiving}
                  onClick={saveOrderToArchive} 
                  className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
                >
                  {isArchiving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />} 
                  ARCHIVOVAT PDF
                </button>
                <button type="button" onClick={() => window.print()} className="bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-slate-200"><Printer className="w-5 h-5" /> TISKNOUT</button>
                <button onClick={handleSubmit} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg hover:bg-blue-700"><Check className="w-5 h-5" /> ULOŽIT ZAKÁZKU</button>
                <button onClick={handleCloseModals} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-12 bg-slate-200/50 flex justify-center custom-scrollbar print:p-0 print:bg-white print:overflow-visible placeholder-print-fix">
            <div ref={orderRef} className="bg-white shadow-2xl p-0 font-sans text-black border-[1px] border-slate-300 w-full max-w-[210mm] min-h-[297mm] h-fit print:shadow-none print:p-0 print:border-none print:max-w-none print:w-full print:min-h-0 overflow-visible">
                <PrintTemplate 
                  order={{...formData, id: editingOrderId || 'NÁVRH', cost: calculatedCost}} 
                  company={companyInfo} 
                  vehicles={vehicles} 
                  customers={customers} 
                  hourlyRate={hourlyRate}
                  technicians={technicians}
                  isEditable={true}
                  onUpdatePart={updatePart}
                  onRemovePart={removePart}
                  onAddPart={addPart}
                  onUpdateOrder={updateOrderField}
                  onOpenPriceList={() => setIsPriceListPickerOpen(true)}
                  onOpenTemplates={() => setIsTemplatePickerOpen(true)}
                  fixedServices={fixedServices}
                  onFileUpload={handleFileUpload}
                  onDeleteAttachment={(id) => setFormData(prev => ({ ...prev, attachments: prev.attachments.filter(a => a.id !== id) }))}
                  onOpenAttachment={(att) => {
                     (window as any).electronAPI.attachment.open(att.relativePath);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {isPriceListPickerOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-blue-600 p-6 text-white">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black uppercase">Vybrat z ceníku</h3>
                <button onClick={handleCloseModals}><X className="w-6 h-6" /></button>
              </div>

              <div className="flex p-1 bg-blue-700/50 rounded-xl">
                {[
                  { id: 'díly', label: 'Díly', icon: Package },
                  { id: 'úkony', label: 'Úkony', icon: Clock },
                  { id: 'materiál', label: 'Materiál', icon: Tag }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setPricelistActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase transition-all ${pricelistActiveTab === tab.id ? 'bg-white text-blue-600 shadow-md' : 'text-blue-100 hover:text-white hover:bg-blue-600'}`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  ref={pricelistInputRef}
                  type="text" 
                  placeholder={`Hledat v sekci ${pricelistActiveTab === 'díly' ? 'díly' : pricelistActiveTab === 'úkony' ? 'úkony' : 'materiál'}...`} 
                  className="w-full pl-11 pr-4 py-3 bg-white border-2 border-transparent focus:border-blue-500 rounded-xl outline-none font-bold text-sm transition-all"
                  value={pricelistSearch}
                  onChange={(e) => setPricelistSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="p-6 max-h-[50vh] overflow-y-auto custom-scrollbar space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Ceny v ceníku jsou bez DPH {companyInfo.isVatPayer ? '(v zakázce se DPH přičte)' : ''}
              </p>
              {fixedServices
                .filter(item => {
                  const matchesSearch = item.name.toLowerCase().includes(pricelistSearch.toLowerCase());
                  const matchesTab = item.category === pricelistActiveTab || (!item.category && pricelistActiveTab === 'díly');
                  return matchesSearch && matchesTab;
                })
                .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
                .map(item => (
                <button 
                  key={item.id} 
                  onClick={() => addFromPriceList(item)}
                  className={`w-full text-left p-4 bg-slate-50 hover:bg-${pricelistActiveTab === 'díly' ? 'blue' : pricelistActiveTab === 'úkony' ? 'amber' : 'emerald'}-50 rounded-xl transition-all border border-slate-100 flex justify-between items-center group`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 group-hover:text-slate-900 block">{item.name}</span>
                      {(item.usageCount || 0) > 0 && (
                        <span className={`bg-${pricelistActiveTab === 'díly' ? 'blue' : pricelistActiveTab === 'úkony' ? 'amber' : 'emerald'}-100 text-${pricelistActiveTab === 'díly' ? 'blue' : pricelistActiveTab === 'úkony' ? 'amber' : 'emerald'}-600 text-[8px] py-0.5 px-1.5 rounded-full font-black uppercase tracking-widest`}>
                           Populární
                        </span>
                      )}
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">
                      {pricelistActiveTab === 'úkony' ? 'Sazba za ' + (item.unit || 'hod') : `Nákup: ${Math.round(item.costPrice || 0).toLocaleString()} Kč bez DPH (${item.unit || 'ks'})`}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`font-black text-${pricelistActiveTab === 'díly' ? 'blue' : pricelistActiveTab === 'úkony' ? 'amber' : 'emerald'}-600 block`}>
                      {Math.round(item.price).toLocaleString()} Kč
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">bez DPH</span>
                  </div>
                </button>
              ))}
              {fixedServices.filter(item => {
                const matchesSearch = item.name.toLowerCase().includes(pricelistSearch.toLowerCase());
                const matchesTab = item.category === pricelistActiveTab || (!item.category && pricelistActiveTab === 'díly');
                return matchesSearch && matchesTab;
              }).length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-slate-400 font-bold">V této kategorii nebyly nalezeny žádné položky.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isTemplatePickerOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase">Šablony oprav</h3>
              <button onClick={handleCloseModals}><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-4">
              {predefinedTasks.map(item => (
                <button 
                  key={item.id} 
                  onClick={() => addFromTemplates(item)}
                  className="w-full text-left p-5 bg-slate-50 hover:bg-blue-50 rounded-2xl transition-all border border-slate-100 group"
                >
                  <span className="block font-black text-slate-900 text-sm mb-1 uppercase tracking-tight group-hover:text-blue-700">{item.label}</span>
                  <span className="block text-xs font-medium text-slate-500 italic leading-relaxed">{item.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isAiImportOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => !aiLoading && handleCloseModals()}></div>
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="bg-emerald-600 p-6 text-white flex justify-between items-center shrink-0">
               <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-2 rounded-xl"><FileSearch className="w-6 h-6" /></div>
                  <h3 className="text-xl font-black uppercase">Import položek ze souboru</h3>
               </div>
               {!aiLoading && <button onClick={handleCloseModals} className="p-2 hover:bg-white/10 rounded-xl"><X className="w-5 h-5" /></button>}
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {aiLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
                  <p className="font-black text-slate-900 uppercase">Analyzuji soubor...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <table className="w-full text-left">
                    <thead><tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b"><th className="p-2">Vybrat</th><th className="p-2">Položka / Kód</th><th className="p-2 text-right">Nákup</th><th className="p-2 text-right">Prodej</th></tr></thead>
                    <tbody>
                      {aiImportItems.map((item, idx) => (
                        <tr key={idx} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => {
                          const n = new Set(selectedAiIndices);
                          if (n.has(idx)) n.delete(idx); else n.add(idx);
                          setSelectedAiIndices(n);
                        }}>
                          <td className="p-2"><input type="checkbox" checked={selectedAiIndices.has(idx)} readOnly /></td>
                          <td className="p-2 text-sm font-bold">{item.description}</td>
                          <td className="p-2 text-sm font-bold text-red-600 text-right">{Math.round(item.costPrice || 0).toLocaleString()} Kč</td>
                          <td className="p-2 text-sm font-black text-blue-600 text-right">{Math.round(item.unitPrice || 0).toLocaleString()} Kč</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button onClick={() => {
                     const items = aiImportItems.filter((_, i) => selectedAiIndices.has(i)).map(it => {
                        const rawCost = it.costPrice || 0;
                        const rawUnit = it.unitPrice || rawCost;
                        const finalCost = companyInfo.isVatPayer ? (rawCost / 1.21) : rawCost;
                        const finalUnit = companyInfo.isVatPayer ? (rawUnit / 1.21) : rawUnit;
                        
                        return { 
                          id: `imp-${Math.random()}`, 
                          description: it.description || '', 
                          quantity: it.quantity || 1, 
                          unit: 'ks', 
                          unitPrice: finalUnit,
                          costPrice: finalCost 
                        };
                     });
                     setFormData(p => ({ ...p, parts: [...(p.parts || []), ...items] }));
                     setIsAiImportOpen(false);
                  }} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase shadow-xl shadow-emerald-200">VLOŽIT VYBRANÉ ({selectedAiIndices.size})</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deletingOrder && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-md rounded-[2rem] p-8 text-center relative z-10 shadow-2xl">
             <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
             <h3 className="text-xl font-black mb-2">Opravdu smazat?</h3>
             <p className="text-slate-500 mb-8">Zakázka #{deletingOrder.id} bude trvale odstraněna.</p>
             <div className="flex gap-4">
                <button onClick={handleCloseModals} className="flex-1 py-4 bg-slate-100 rounded-xl font-bold">ZRUŠIT</button>
                <button onClick={() => { onDeleteService(deletingOrder.id); handleCloseModals(); }} className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold">SMAZAT</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Component for Order Card in Kanban board
const OrderCard: React.FC<{
  order: ServiceRecord;
  vehicles: Vehicle[];
  customers: Customer[];
  onEdit: (order: ServiceRecord) => void;
  onUpdateStatus: (status: ServiceRecord['status']) => void;
  onOpenMenu: (id: string | null) => void;
  openMenuId: string | null;
  onCreateInvoice?: (orderId: string) => void;
  onDelete: () => void;
}> = ({ order, vehicles, customers, onEdit, onUpdateStatus, onOpenMenu, openMenuId, onCreateInvoice, onDelete }) => {
  const vehicle = vehicles.find(v => v.id === order.vehicleId);
  const customer = vehicle ? customers.find(c => c.id === vehicle.customerId) : null;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onOpenMenu(null);
      }
    };
    if (openMenuId === order.id) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId, order.id, onOpenMenu]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-visible">
      <div className="absolute top-0 right-0 p-4">
        <div className="relative">
          <button 
            onClick={(e) => { e.stopPropagation(); onOpenMenu(openMenuId === order.id ? null : order.id); }}
            className={`p-2 rounded-xl transition-all ${openMenuId === order.id ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:text-slate-900'}`}
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {openMenuId === order.id && (
            <div 
              ref={menuRef}
              className="absolute top-12 right-0 w-52 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[60] animate-in fade-in zoom-in-95 duration-200"
            >
              <button 
                onClick={() => { onEdit(order); onOpenMenu(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors text-sm font-bold"
              >
                <Edit3 className="w-4 h-4 text-slate-400" />
                Upravit zakázku
              </button>
              
              <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-50 mt-1">Změnit stav</div>
              <div className="grid grid-cols-1 gap-1">
                {(['naplánováno', 'probíhá', 'hotovo'] as ServiceRecord['status'][]).map((s) => (
                  <button 
                    key={s}
                    onClick={() => { onUpdateStatus(s); onOpenMenu(null); }}
                    className={`w-full text-left px-4 py-2 rounded-xl text-xs font-bold transition-all ${order.status === s ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-500'}`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>

              {order.status === 'hotovo' && onCreateInvoice && (
                <button 
                  onClick={() => { onCreateInvoice(order.id); onOpenMenu(null); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-50 text-emerald-600 transition-colors text-sm font-bold border-t border-slate-50 mt-1"
                >
                  <Receipt className="w-4 h-4" /> Fakturovat
                </button>
              )}

              <div className="h-px bg-slate-100 my-1 mx-2"></div>
              <button 
                onClick={() => { onDelete(); onOpenMenu(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-600 transition-colors text-sm font-bold"
              >
                <Trash2 className="w-4 h-4" /> Odstranit
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
          order.status === 'hotovo' ? 'bg-emerald-50 text-emerald-600' : 
          order.status === 'probíhá' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
        }`}>
          {order.status === 'hotovo' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
        </div>
        <div>
          <h4 className="text-base font-black text-slate-900">#{order.id}</h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(order.date)}</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2 text-slate-700">
          <User className="w-4 h-4 text-slate-300" />
          <span className="text-sm font-bold truncate">
            {customer?.customerType === 'firemní' ? (customer?.companyName || `${customer?.firstName} ${customer?.lastName}`) : `${customer?.firstName} ${customer?.lastName}`}
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <Car className="w-4 h-4 text-slate-300" />
          <span className="text-[10px] font-black text-blue-600 font-mono tracking-wider uppercase">{vehicle?.licensePlate?.toUpperCase() || '---'}</span>
          <span className="text-xs font-bold text-slate-400">• {vehicle?.make} {vehicle?.model}</span>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-slate-400 uppercase">Odhad ceny</span>
          <span className="text-sm font-black text-slate-900">{order.estimatedPrice ? Math.round(order.estimatedPrice).toLocaleString() + ' Kč' : '---'}</span>
        </div>
        <button 
          onClick={() => onEdit(order)}
          className="flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
        >
          Otevřít list <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export const PrintTemplate: React.FC<{
  order: Partial<ServiceRecord> & { cost: number };
  company: CompanyInfo;
  vehicles: Vehicle[];
  customers: Customer[];
  hourlyRate: number;
  technicians: string[];
  isEditable?: boolean;
  onUpdatePart?: (id: string, field: keyof PartItem, value: any) => void;
  onRemovePart?: (id: string) => void;
  onAddPart?: () => void;
  onUpdateOrder?: (field: string, value: any) => void;
  onOpenPriceList?: () => void;
  onOpenTemplates?: () => void;
  fixedServices?: FixedService[];
  onFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteAttachment?: (id: string) => void;
  onOpenAttachment?: (att: AttachmentItem) => void;
}> = ({ 
  order, company, vehicles, customers, hourlyRate, technicians, isEditable, 
  onUpdatePart, onRemovePart, onAddPart, onUpdateOrder, onOpenPriceList, 
  onOpenTemplates, onFileUpload, onDeleteAttachment, onOpenAttachment 
}) => {
  const [activeTab, setActiveTab] = useState(1);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const vehicle = vehicles.find(v => v.id === order.vehicleId);
  const customer = vehicle ? customers.find(c => c.id === vehicle.customerId) : null;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasAttachment = (order.parts?.length || 0) > 16;
  
  // Auto-switch to tab 1 if attachment is removed
  useEffect(() => {
    if (!hasAttachment && activeTab === 2) {
      setActiveTab(1);
    }
  }, [hasAttachment, activeTab]);

  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch) return vehicles;
    const s = vehicleSearch.toLowerCase();
    return vehicles.filter(v => 
      (v.licensePlate || "").toLowerCase().includes(s) ||
      (v.make || "").toLowerCase().includes(s) ||
      (v.model || "").toLowerCase().includes(s)
    );
  }, [vehicles, vehicleSearch]);

  const labels = [
    { key: 'rezerva', label: 'Rezerva' }, { key: 'bezp_klic', label: 'Bezpečnostní klíč kola' },
    { key: 'zvedak', label: 'Zvedák' }, { key: 'trojuhelnik', label: 'Trojúhelník' },
    { key: 'klic', label: 'Klíč kolový' }, { key: 'lekarna', label: 'Lékárna' },
    { key: 'lepeni', label: 'Sada na lepení pneu' }
  ];

  const fuelLevels = ['0%', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'];

  const displayPrice = (unitPrice: number) => {
    return company?.isVatPayer ? Math.round(unitPrice * 1.21) : Math.round(unitPrice);
  };

  const handlePriceUpdate = (id: string, field: 'unitPrice' | 'costPrice', value: string) => {
    const rawValue = parseFloat(value) || 0;
    const finalValue = company?.isVatPayer ? (rawValue / 1.21) : rawValue;
    onUpdatePart?.(id, field, finalValue);
  };

  return (
    <>
      {/* Tab Navigation - Browser style, visible only in editor (no-print) */}
      {hasAttachment && (
        <div className="flex no-print sticky-tabs gap-[2px] items-end h-[50px]">
          <button 
            type="button"
            onClick={() => setActiveTab(1)}
            className={`flex items-center gap-2 px-6 py-2 text-[11px] font-black uppercase tracking-widest transition-all rounded-t-xl border-x border-t relative overflow-hidden group ${
              activeTab === 1 
                ? 'bg-white border-black/20 text-blue-700 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]' 
                : 'bg-white/40 border-transparent text-black/40 hover:bg-white/60 hover:text-black/60'
            }`}
          >
            <div className={`absolute top-0 left-0 w-full h-[3px] transition-colors ${activeTab === 1 ? 'bg-blue-600' : 'bg-transparent'}`}></div>
            <FileText className={`w-3.5 h-3.5 ${activeTab === 1 ? 'text-blue-600' : 'opacity-40'}`} />
            <span>HLAVNÍ LIST</span>
            <span className="ml-1 text-[9px] opacity-30 font-bold bg-black/5 px-1.5 rounded">P1</span>
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab(2)}
            className={`flex items-center gap-2 px-6 py-2 text-[11px] font-black uppercase tracking-widest transition-all rounded-t-xl border-x border-t relative overflow-hidden group ${
              activeTab === 2 
                ? 'bg-white border-black/20 text-blue-700 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]' 
                : 'bg-white/40 border-transparent text-black/40 hover:bg-white/60 hover:text-black/60'
            }`}
          >
            <div className={`absolute top-0 left-0 w-full h-[3px] transition-colors ${activeTab === 2 ? 'bg-blue-600' : 'bg-transparent'}`}></div>
            <Table className={`w-3.5 h-3.5 ${activeTab === 2 ? 'text-blue-600' : 'opacity-40'}`} />
            <span>PŘÍLOHA</span>
            <span className="ml-1 text-[9px] opacity-30 font-bold bg-black/5 px-1.5 rounded">P2</span>
          </button>
          <div className="flex-1"></div>
          <div className="pb-2 text-[8px] font-black uppercase opacity-20 italic">Navigátor editoru</div>
        </div>
      )}

      <div id="print-root-container" className={`print-block text-black bg-white flex flex-col relative ${activeTab !== 1 ? 'editor-tab-hidden' : ''}`} style={{ 
        width: '210mm', 
        height: '297mm',
        maxWidth: '210mm',
        maxHeight: '297mm', 
        margin: '0 auto', 
        padding: '10mm', 
        boxSizing: 'border-box', 
        fontFamily: 'sans-serif',
        border: '2px solid #000',
        background: 'white'
      }}>
      {/* Frame content */}
      <div className="flex flex-col flex-1">
        {/* Header Section - 10 columns for exact alignment */}
        <div className="grid grid-cols-10 border-b-2 border-black">
          <div className="col-span-3 border-r-2 border-black p-2 min-h-[85px]">
            <p className="text-[8px] font-black uppercase mb-1">Objednatel / Zákazník</p>
            <div className="text-[10px] font-bold uppercase leading-tight">
              {customer?.customerType === 'firemní' ? (
                <>
                  <span className="text-[11px] font-black">{customer?.companyName}</span><br />
                  {customer?.companyAddress || customer?.address}<br />
                  IČO: {customer?.ico} {customer?.dic ? `| DIČ: ${customer?.dic}` : ''}
                </>
              ) : (
                <>
                  <span className="text-[11px] font-black">{customer?.firstName} {customer?.lastName}</span><br />
                  {customer?.address}
                </>
              )}
              <br />Tel: {customer?.phone}
            </div>
          </div>
          <div className="col-span-4 border-r-2 border-black p-2 min-h-[85px] bg-gray-50/20">
            <p className="text-[8px] font-black uppercase mb-1">Dodavatel</p>
            <div className="text-[10px] font-bold uppercase leading-tight">
              {company?.name}<br />{company?.address}<br />IČO: {company?.ico}
            </div>
          </div>
          <div className="col-span-3 flex flex-col items-center justify-center p-2 min-h-[85px] bg-gray-100/10 relative text-center">
            <div className="flex flex-col items-center">
              <h1 className="text-[14px] font-black uppercase tracking-[0.05em] leading-tight">ZAKÁZKOVÝ LIST</h1>
              <p className="text-[12px] font-bold mt-1">č. <span className="font-black underline">{order.id}</span></p>
            </div>
            {isEditable && (
               <div className="flex gap-2 mt-2 no-print">
                 <button onClick={onOpenTemplates} title="Šablony" className="p-1 px-1.5 bg-slate-900 text-white rounded shadow-sm hover:scale-105 transition-transform"><ListPlus className="w-4 h-4" /></button>
                 <button onClick={() => fileInputRef.current?.click()} title="Nahrát přílohu / AI Import" className="p-1 px-1.5 bg-purple-600 text-white rounded shadow-sm hover:scale-105 transition-transform"><Sparkles className="w-4 h-4" /></button>
                 <input type="file" className="hidden" ref={fileInputRef} onChange={onFileUpload} accept=".xlsx,.xls,.pdf,image/*" />
               </div>
            )}
          </div>
        </div>

        {/* Attachments list (no-print) */}
        {order.attachments && order.attachments.length > 0 && (
          <div className="no-print border-b-2 border-black flex flex-wrap gap-2 px-3 py-1.5 bg-slate-50">
            {order.attachments.map(att => (
              <div key={att.id} className="flex items-center gap-1.5 px-2 py-0.5 bg-white rounded border border-slate-200 group">
                 <span className="text-[9px] font-bold max-w-[150px] truncate">{att.name}</span>
                 <div className="flex items-center gap-1">
                   <button onClick={() => onOpenAttachment?.(att)} className="text-blue-600 hover:text-blue-800"><Eye className="w-3.5 h-3.5" /></button>
                   {isEditable && <button onClick={() => onDeleteAttachment?.(att.id)} className="text-red-500 hover:text-red-700"><X className="w-3.5 h-3.5" /></button>}
                 </div>
              </div>
            ))}
          </div>
        )}

        {/* Vehicle and Info Section */}
        <div className="grid grid-cols-10 border-b-2 border-black text-[10px] font-bold">
          <div className="col-span-3 border-r-2 border-black flex flex-col py-0.5">
            {labels.map((item, idx) => (
              <div key={item.key} className={`flex items-center gap-2 px-3 h-[21px] group ${idx < labels.length - 1 ? 'border-b border-black/10' : ''}`}>
                <div 
                  className="w-3 h-3 border border-black flex items-center justify-center bg-white cursor-pointer shrink-0" 
                  onClick={() => isEditable && onUpdateOrder?.('checklist', { ...order.checklist, [item.key]: !order.checklist?.[item.key as keyof VehicleChecklist] })}
                >
                  {order.checklist?.[item.key as keyof VehicleChecklist] && <Check className="w-2 h-2 stroke-[4]" />}
                </div>
                <span className="text-[7.5px] uppercase tracking-tighter">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="col-span-4 border-r-2 border-black flex flex-col">
            <div className="p-1 px-2 border-b border-black min-h-[42px] flex flex-col justify-start bg-blue-50/5">
              <span className="text-[7.5px] uppercase opacity-50 font-black mb-0.5">VOZIDLO:</span>
              <div className="mt-0">
                {isEditable ? (
                  <div className="flex flex-col gap-1">
                    <div className="no-print flex items-center gap-1.5 bg-white px-2 py-0.5 rounded border border-slate-200 mb-1">
                       <Search className="w-3 h-3 text-slate-400" />
                       <input type="text" placeholder="Hledat..." className="bg-transparent border-none outline-none text-[8px] font-bold w-full" value={vehicleSearch} onChange={(e) => setVehicleSearch(e.target.value)} />
                    </div>
                    <select className="w-full bg-white border border-slate-300 outline-none font-black uppercase text-[10px] p-0.5 rounded" value={order.vehicleId} onChange={(e) => onUpdateOrder?.('vehicleId', e.target.value)}>
                      <option value="">-- Vozidlo --</option>
                      {filteredVehicles.map(v => <option key={v.id} value={v.id}>{v.licensePlate?.toUpperCase()} - {v.make} {v.model}</option>)}
                    </select>
                  </div>
                ) : (
                  <p className="font-black text-[11px] uppercase tracking-tight">
                    {vehicle?.make} {vehicle?.model} 
                    <span className="ml-2 font-mono text-blue-700 print:text-black">({vehicle?.licensePlate?.toUpperCase() || '---'})</span>
                  </p>
                )}
              </div>
            </div>
            <div className="p-0.5 px-2 border-b border-black flex-1 flex items-center justify-between text-[9px] items-start pt-1">
              <span className="opacity-50">MOTOR:</span> 
              <span className="font-black uppercase">{vehicle?.engineCode || '---'}</span>
            </div>
            <div className="p-0.5 px-2 border-b border-black flex-1 flex items-center justify-between text-[9px] items-start pt-1">
               <span className="opacity-50">STAV KM:</span>
               {isEditable ? (
                 <input 
                   type="number" 
                   className="bg-white rounded border border-slate-200 outline-none font-black text-[9px] w-24 px-1 py-0.5 text-right" 
                   value={order.mileageAtEntry || 0} 
                   onChange={(e) => onUpdateOrder?.('mileageAtEntry', parseInt(e.target.value) || 0)} 
                 />
               ) : (
                 <span className="font-black">{order.mileageAtEntry ? `${order.mileageAtEntry.toLocaleString()} km` : '---'}</span>
               )}
            </div>
            <div className="p-1 px-2 flex flex-col gap-1 justify-start pt-1">
              <span className="text-[7.5px] uppercase opacity-50">PHM:</span>
              <div className="flex flex-wrap gap-x-1.5 gap-y-1">
                {fuelLevels.map(l => (
                  <span 
                    key={l} 
                    onClick={() => isEditable && onUpdateOrder?.('fuelLevel', l)}
                    className={`px-0.5 rounded-[1px] text-[7.5px] border transition-colors ${isEditable ? 'cursor-pointer hover:border-black' : ''} ${order.fuelLevel === l ? 'font-black bg-black text-white border-black' : 'text-slate-400 border-slate-200'}`}
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-3 flex flex-col text-[9px]">
            <div className="p-0.5 px-2 border-b border-black flex-1 flex items-center justify-between items-start pt-1">
              <span className="opacity-50">ODHAD:</span> 
              {isEditable ? (
                <input type="number" className="bg-white rounded border border-slate-200 outline-none font-black text-[9px] w-20 px-1 text-right" value={order.estimatedPrice || 0} onChange={(e) => onUpdateOrder?.('estimatedPrice', parseInt(e.target.value) || 0)} />
              ) : (
                <span className="font-black">{order.estimatedPrice ? `${Math.round(order.estimatedPrice).toLocaleString()} Kč` : '---'}</span>
              )}
            </div>
            <div className="p-0.5 px-2 border-b border-black flex-1 flex items-center justify-between items-start pt-1">
              <span className="opacity-50">MECH:</span> 
              {isEditable ? (
                <select className="bg-white rounded border border-slate-200 outline-none font-black text-[9px] px-1 text-right" value={order.technician} onChange={(e) => onUpdateOrder?.('technician', e.target.value)}>
                  {technicians.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : (
                <span className="font-black">{order.technician}</span>
              )}
            </div>
            <div className="p-0.5 px-2 border-b border-black flex-1 flex items-center justify-between items-start pt-1">
              <span className="opacity-50">PŘÍJEM DNE:</span> 
              <span className="font-black">{formatDate(order.date || '')}</span>
            </div>
            <div className="p-0.5 px-2 border-b border-black flex-1 flex items-center justify-between items-start pt-1">
              <span className="opacity-50">PŘEDÁNÍ DNE:</span> 
              {isEditable ? (
                <>
                  <input 
                    type="date" 
                    className="bg-white rounded border border-slate-200 outline-none font-black text-[9px] px-1 print:hidden" 
                    value={order.deliveryDate || ''} 
                    onChange={(e) => onUpdateOrder?.('deliveryDate', e.target.value)} 
                  />
                  <span className="hidden print:inline font-black text-[9px]">
                    {order.deliveryDate ? formatDate(order.deliveryDate) : 'dd.mm.rrrr'}
                  </span>
                </>
              ) : (
                <span className="font-black">{formatDate(order.deliveryDate || '')}</span>
              )}
            </div>
            {isEditable && (
              <div className="p-0.5 px-2 border-b border-black flex-1 flex items-center justify-between items-start pt-1 no-print">
                <span className="opacity-50">PRÁCE (HOD):</span>
                <input 
                  type="number" 
                  step="0.5" 
                  className="bg-slate-100 rounded border border-slate-200 outline-none font-black text-[9px] w-12 px-1 text-center" 
                  value={order.laborHours || 0} 
                  onChange={(e) => onUpdateOrder?.('laborHours', parseFloat(e.target.value) || 0)} 
                />
              </div>
            )}
            <div className="p-0.5 px-2 flex-1 flex items-center justify-between items-start pt-1 print:hidden">
              <span className="opacity-50">STAV:</span> 
              {isEditable ? (
                <select className="bg-white rounded border border-slate-200 outline-none font-black text-[9px] px-1 uppercase text-right" value={order.status} onChange={(e) => onUpdateOrder?.('status', e.target.value as any)}>
                  <option value="naplánováno">Naplánováno</option>
                  <option value="probíhá">Probíhá</option>
                  <option value="hotovo">Hotovo</option>
                  <option value="zrušeno">Zrušeno</option>
                </select>
              ) : (
                <span className="font-black uppercase text-[8px]">{order.status}</span>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-10 border-b-2 border-black flex-1 overflow-hidden" style={{ minHeight: '400px' }}>
          <div className="col-span-5 border-r-2 border-black flex flex-col relative">
            <div className="bg-gray-100/50 border-b-2 border-black p-1 text-center font-black uppercase text-[8px] flex items-center justify-center relative">
               <span>Rozsah objednané opravy</span>
               {isEditable && (
                  <button type="button" onClick={onOpenTemplates} title="Šablony" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 bg-slate-900 text-white rounded shadow-sm no-print">
                     <ListPlus className="w-3 h-3" />
                  </button>
               )}
            </div>
            <div className="flex-1 p-3 text-[10px] whitespace-pre-wrap italic font-medium leading-normal bg-white">
              {isEditable ? (
                <textarea 
                  className="w-full h-full bg-transparent outline-none resize-none border-none leading-normal italic placeholder:opacity-30" 
                  value={order.description || ''} 
                  onChange={(e) => onUpdateOrder?.('description', e.target.value)} 
                  placeholder="Popište závady nebo požadované úkony..."
                />
              ) : (
                order.description || "Nebylo specifikováno."
              )}
            </div>
          </div>
          <div className="col-span-5 flex flex-col bg-white">
            <div className="bg-gray-100/50 border-b-2 border-black p-1 text-center font-black uppercase text-[8px] flex items-center justify-center relative">
              <span>{company?.isVatPayer ? 'Materiál / Práce (vč. DPH)' : 'Materiál / Práce'}</span>
              {isEditable && (
                <div className="absolute right-2 flex items-center gap-1 no-print">
                  <button type="button" onClick={onOpenPriceList} title="Položka z ceníku" className="p-0.5 bg-blue-600 text-white rounded"><Tag className="w-3 h-3" /></button>
                  <button type="button" onClick={onAddPart} title="Prázdný řádek" className="p-0.5 bg-emerald-600 text-white rounded"><Plus className="w-3 h-3" /></button>
                </div>
              )}
            </div>
             <div className="flex-1 overflow-hidden">
                <table className="w-full border-collapse text-[9px] table-fixed">
                   <thead>
                     <tr className="border-b border-black bg-gray-50 text-[7.5px] font-black uppercase">
                       <th className="p-1 px-2 text-left border-r border-black font-black">Položka</th>
                       <th className="p-1 text-center w-[35px] border-r border-black font-black">MN.</th>
                       <th className="p-1 text-right w-[65px] border-r border-black font-black">Cena/j</th>
                       <th className="p-1 text-right w-[75px] border-r border-black font-black">Celkem</th>
                       {isEditable && <th className="p-1 w-[24px] no-print"></th>}
                     </tr>
                   </thead>
                   <tbody className="font-bold">
                      {(order.parts || []).slice(0, (order.parts?.length || 0) > 16 ? 16 : 100).map((p) => (
                        <tr key={p.id} className="border-b border-black/10 h-6 group pdf-page-break-avoid">
                           <td className="p-0.5 px-2 border-r border-black/20 truncate text-left">
                             {isEditable ? (
                               <input className="w-full bg-transparent outline-none focus:bg-blue-50/20" value={p.description} onChange={(e) => onUpdatePart?.(p.id, 'description', e.target.value)} />
                             ) : p.description}
                           </td>
                           <td className="p-0.5 text-center border-r border-black/20">
                             {isEditable ? (
                               <input type="number" className="w-full bg-transparent outline-none text-center focus:bg-blue-50/20" value={p.quantity} onChange={(e) => onUpdatePart?.(p.id, 'quantity', parseFloat(e.target.value) || 0)} />
                             ) : p.quantity}
                           </td>
                           <td className="p-0.5 text-right border-r border-black/20">
                             {isEditable ? (
                               <input type="number" className="w-full bg-transparent outline-none text-right focus:bg-blue-50/20" value={displayPrice(p.unitPrice)} onChange={(e) => handlePriceUpdate(p.id, 'unitPrice', e.target.value)} />
                             ) : displayPrice(p.unitPrice).toLocaleString()}
                           </td>
                           <td className="p-0.5 text-right border-r border-black/20">
                             {Math.round(p.quantity * displayPrice(p.unitPrice)).toLocaleString()}
                           </td>
                           {isEditable && (
                             <td className="p-0.5 text-center no-print">
                               <button onClick={() => onRemovePart?.(p.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                             </td>
                           )}
                        </tr>
                      ))}
                      {/* Labor Row - show only on Page 1 if there's no attachment */}
                      {!hasAttachment && Number(order.laborHours || 0) > 0 && (
                        <tr className={`border-b border-black/10 h-6 bg-blue-50/5 pdf-page-break-avoid ${isEditable ? 'hidden print:table-row' : ''}`}>
                           <td className="p-0.5 px-2 border-r border-black/20 italic font-black text-blue-700 print:text-black text-left">
                             Servisní práce
                           </td>
                           <td className="p-0.5 text-center border-r border-black/20 font-black">
                             {order.laborHours} h
                           </td>
                           <td className="p-0.5 text-right border-r border-black/20 font-black">
                             {displayPrice(hourlyRate).toLocaleString()}
                           </td>
                           <td className="p-0.5 text-right border-r border-black/20 font-black">
                             {Math.round(order.laborHours * displayPrice(hourlyRate)).toLocaleString()}
                           </td>
                           <td className="p-0.5 no-print"></td>
                        </tr>
                      )}

                      {(order.parts?.length || 0) > 16 && (
                        <tr className="bg-amber-50/50 italic h-6">
                          <td colSpan={isEditable ? 5 : 4} className="p-1 px-4 text-[8px] font-black uppercase text-blue-600 text-center">
                            --- Pokračování v příloze ---
                          </td>
                        </tr>
                      )}
                      {/* Padding rows to fill table space */}
                      {Array.from({ length: Math.max(0, 14 - (order.parts?.length || 0) - (!hasAttachment && (order.laborHours || 0) > 0 ? 1 : 0)) }).map((_, i) => (
                        <tr key={`empty-${i}`} className="border-b border-black/5 h-6">
                           <td className="border-r border-black/20"></td>
                           <td className="border-r border-black/20"></td>
                           <td className="border-r border-black/20"></td>
                           <td className="border-r border-black/20"></td>
                           {isEditable && <td className="no-print"></td>}
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        </div>

        {/* Summary Area - Hidden if more than 16 items (shown in attachment) */}
        {(order.parts?.length || 0) <= 16 && !hasAttachment && (
          <div className="mt-auto no-print-mt-0">
            <div className="border-t-2 border-black">
              <div className="flex justify-between items-stretch bg-white">
                {/* Left Section: Signature and Info */}
                <div className="flex-1 border-r-2 border-black p-4 flex flex-col justify-between min-h-[140px]">
                  <div className="space-y-4">
                    <div className="flex justify-between items-end gap-3">
                      <span className="text-[9px] font-black uppercase whitespace-nowrap">Podpis objednatele:</span>
                      <div className="border-b border-black flex-1 min-w-[100px] mb-0.5"></div>
                      <span className="text-[10px] font-black tracking-[0.2em] opacity-10">SIGNATURE</span>
                    </div>
                    <div className="text-[10px] font-black flex items-center gap-4">
                      <span className="opacity-50 text-[9px]">VYMĚNĚNÉ DÍLY:</span> 
                      {isEditable ? (
                        <div className="flex gap-6">
                           <div className="flex items-center gap-2 cursor-pointer group" onClick={() => onUpdateOrder?.('returnParts', 'vrátit')}>
                              <div className={`w-4 h-4 border border-black flex items-center justify-center transition-colors ${order.returnParts === 'vrátit' ? 'bg-black' : 'bg-white'}`}>
                                 {order.returnParts === 'vrátit' && <Check className="w-2.5 h-2.5 stroke-[4] text-white" />}
                              </div>
                              <span className={`text-[9px] font-black ${order.returnParts === 'vrátit' ? 'opacity-100' : 'opacity-40'}`}>VRÁTIT</span>
                           </div>
                           <div className="flex items-center gap-2 cursor-pointer group" onClick={() => onUpdateOrder?.('returnParts', 'nevracet')}>
                              <div className={`w-4 h-4 border border-black flex items-center justify-center transition-colors ${order.returnParts === 'nevracet' ? 'bg-black' : 'bg-white'}`}>
                                 {order.returnParts === 'nevracet' && <Check className="w-2.5 h-2.5 stroke-[4] text-white" />}
                              </div>
                              <span className={`text-[9px] font-black ${order.returnParts === 'nevracet' ? 'opacity-100' : 'opacity-40'}`}>NEVRACET</span>
                           </div>
                        </div>
                      ) : (
                        <span className="underline font-black uppercase text-[11px]">{order.returnParts || 'NEVRACET'}</span>
                      )}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-dotted border-black/30 mt-4">
                    <p className="text-[10px] font-black uppercase tracking-tight">
                      Převzato zákazníkem dne: <span className="opacity-30">..................</span> Podpis: <span className="opacity-30">..................</span>
                    </p>
                  </div>
                </div>
                
                {/* Right Section: Price Summary Aligned Horizontally */}
                <div className="w-[300px] flex flex-col bg-gray-50/10">
                   <div className="flex-1 flex flex-col">
                      {company?.isVatPayer ? (
                        <div className="flex flex-col h-full uppercase">
                           <div className="p-3 px-5 border-b border-black flex justify-between font-bold text-[10px]">
                              <span className="opacity-40">Základ daně (bez DPH)</span>
                              <span className="font-black">{Math.round(order.cost || 0).toLocaleString()} Kč</span>
                           </div>
                           <div className="p-3 px-5 border-b border-black flex justify-between font-bold text-[10px]">
                              <span className="opacity-40">DPH 21%</span>
                              <span className="font-black">{Math.round((order.cost || 0) * 0.21).toLocaleString()} Kč</span>
                           </div>
                           <div className="flex-1 flex flex-col justify-center items-center p-4 bg-white">
                              <span className="text-[10px] font-black text-slate-400 mb-1">Cena k úhradě</span>
                              <span className="text-[32px] font-black leading-none">{Math.round((order.cost || 0) * 1.21).toLocaleString()} Kč</span>
                           </div>
                        </div>
                      ) : (
                        <div className="flex flex-col h-full justify-center items-center p-6 bg-white uppercase">
                            <span className="text-[11px] font-black text-slate-400 mb-1">Celková cena k úhradě</span>
                            <span className="text-[36px] font-black leading-none">{Math.round(order.cost || 0).toLocaleString()} Kč</span>
                            <span className="mt-3 text-[9px] font-black border border-black/20 px-2 py-0.5 opacity-50 tracking-widest">Nejsme plátci DPH</span>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </div>

            {/* Signature Section - Positioned with the requested gap */}
            <div className="grid grid-cols-2 gap-32 px-12 pt-[40px] pb-8 border-t-2 border-black opacity-100">
              <div className="text-center">
                <div className="border-t border-dotted border-black mb-1 opacity-50"></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Předal / Razítko a podpis</p>
              </div>
              <div className="text-center">
                <div className="border-t border-dotted border-black mb-1 opacity-50"></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Převzal (podpis zákazníka)</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>

      {/* Attachment Page (Order) */}
      {(order.parts?.length || 0) > 16 && (
        <div className={`bg-white text-black font-sans border-2 border-black print-page-break flex flex-col relative ${activeTab !== 2 ? 'editor-tab-hidden' : ''}`} style={{ 
          width: '210mm', 
          height: '297mm',
          maxWidth: '210mm',
          maxHeight: '297mm',
          margin: '0 auto',
          padding: '10mm',
          boxSizing: 'border-box',
          background: 'white'
        }}>
          <div className="flex-1">
            <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end bg-gray-50/30 p-4">
              <div>
                <h2 className="text-[18px] font-black uppercase">Příloha k zakázkovému listu {order.id}</h2>
                <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest">Detailní seznam materiálu a prací (Pokračování ze strany 1)</p>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                 {isEditable && (
                   <div className="flex gap-1 no-print mb-1">
                     <button type="button" onClick={onOpenPriceList} className="p-1 bg-blue-600 text-white rounded"><Tag className="w-4 h-4" /></button>
                     <button type="button" onClick={onAddPart} className="p-1 bg-emerald-600 text-white rounded"><Plus className="w-4 h-4" /></button>
                   </div>
                 )}
                 <p className="text-[11px] font-black text-blue-600 uppercase italic">Zákazník: {customer?.lastName} {customer?.firstName}</p>
                 <p className="text-[9px] font-bold uppercase opacity-30 mt-1 tracking-widest">Strana 2 / 2</p>
              </div>
            </div>

            <table className="w-full border-collapse text-[11px] mb-12">
              <thead>
                <tr className="border-b-2 border-black bg-gray-50 uppercase font-black text-[9px] h-10">
                  <th className="p-2 px-4 text-left">Popis položky materiálu nebo práce</th>
                  <th className="p-2 text-center w-[60px]">MN.</th>
                  <th className="p-2 text-right w-[100px]">Cena / j</th>
                  <th className="p-2 text-right w-[100px]">Celkem</th>
                  {isEditable && <th className="p-2 w-[40px] no-print"></th>}
                </tr>
              </thead>
              <tbody className="font-bold">
                {(order.parts || []).slice(16).map((p, idx) => (
                  <tr key={p.id || idx} className="border-b border-black/10 h-10 group pdf-page-break-avoid">
                    <td className="p-2 px-4 uppercase text-left">
                      {isEditable ? (
                        <input className="w-full bg-transparent outline-none focus:bg-blue-50/20 py-1" value={p.description} onChange={(e) => onUpdatePart?.(p.id, 'description', e.target.value)} />
                      ) : p.description}
                    </td>
                    <td className="p-2 text-center">
                      {isEditable ? (
                        <div className="flex items-center justify-center gap-1">
                          <input type="number" className="w-[40px] bg-transparent outline-none text-center focus:bg-blue-50/20" value={p.quantity} onChange={(e) => onUpdatePart?.(p.id, 'quantity', parseFloat(e.target.value) || 0)} />
                          <span className="text-[8px] opacity-40">ks</span>
                        </div>
                      ) : (
                        `${p.quantity} ks`
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {isEditable ? (
                        <input type="number" className="w-full bg-transparent outline-none text-right focus:bg-blue-50/20" value={displayPrice(p.unitPrice)} onChange={(e) => handlePriceUpdate(p.id, 'unitPrice', e.target.value)} />
                      ) : `${displayPrice(p.unitPrice).toLocaleString()} Kč`}
                    </td>
                    <td className="p-2 text-right">
                      {Math.round(p.quantity * displayPrice(p.unitPrice)).toLocaleString()} Kč
                    </td>
                    {isEditable && (
                      <td className="p-2 text-center no-print">
                        <button onClick={() => onRemovePart?.(p.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    )}
                  </tr>
                ))}
                
                {/* Labor Row in Attachment - show in print always if hours > 0, hide in editor UI if editable */}
                {Number(order.laborHours || 0) > 0 && (
                  <tr className={`border-b border-black h-10 bg-blue-50/5 ${isEditable ? 'hidden print:table-row' : ''}`}>
                    <td className="p-2 px-4 italic font-black text-blue-700 print:text-black uppercase text-left">
                      Servisní práce
                    </td>
                    <td className="p-2 text-center font-black">
                      {order.laborHours} h
                    </td>
                    <td className="p-2 text-right font-black">
                      {displayPrice(hourlyRate).toLocaleString()} Kč
                    </td>
                    <td className="p-2 text-right font-black text-blue-800 print:text-black">
                      {Math.round(order.laborHours * displayPrice(hourlyRate)).toLocaleString()} Kč
                    </td>
                    {isEditable && <td className="p-2 no-print"></td>}
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Combined Footer for Attachment (Prices + Signatures) fixed to bottom */}
          <div className="mt-auto">
            <div className="w-full h-full flex flex-col items-center">
              <div className="w-full flex justify-between items-end px-4 gap-8">
                 {/* Left: Subtotal & Tax */}
                 <div className="flex flex-col justify-end min-h-[80px] pb-2">
                    {company?.isVatPayer ? (
                      <div className="grid grid-cols-2 gap-x-12 min-w-[240px]">
                        <div className="text-[11px] font-black space-y-2 uppercase text-right opacity-50">
                           <p>Základ daně:</p>
                           <p>DPH 21%:</p>
                        </div>
                        <div className="text-[11px] font-black space-y-2 uppercase text-left">
                           <p>{Math.round(order.cost || 0).toLocaleString()} Kč</p>
                           <p>{Math.round((order.cost || 0) * 0.21).toLocaleString()} Kč</p>
                        </div>
                      </div>
                    ) : (
                       <div className="text-[10px] font-black uppercase opacity-50 tracking-widest border-l-4 border-black/10 pl-4 py-2">
                          Nejsme plátci DPH
                       </div>
                    )}
                 </div>

                 {/* Right: Total Price Box as requested in screenshot */}
                 <div className="w-[450px] p-8 bg-white text-black rounded-[2.5rem] flex flex-col items-center justify-center text-center border-[5px] border-black shadow-sm uppercase">
                    <span className="text-[14px] font-black uppercase text-black mb-1 tracking-[0.3em] underline underline-offset-8 decoration-black/10">KONEČNÁ CENA K ÚHRADĚ</span>
                    <span className="text-[48px] font-black leading-none tracking-tighter mt-4">
                      {company?.isVatPayer 
                        ? Math.round((order.cost || 0) * 1.21).toLocaleString() 
                        : Math.round(order.cost || 0).toLocaleString()
                      } Kč
                    </span>
                 </div>
              </div>

              {/* Signature Section */}
              <div className="grid grid-cols-2 gap-32 px-12 pt-[40px] pb-8 w-full border-t-2 border-black">
                <div className="text-center">
                  <div className="border-t border-dotted border-black mb-2 opacity-50"></div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Předal / Razítko a podpis</p>
                </div>
                <div className="text-center">
                  <div className="border-t border-dotted border-black mb-2 opacity-50"></div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Převzal (podpis zákazníka)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print styles and Page breaks */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          .editor-tab-hidden { display: none !important; }
          .sticky-tabs { 
            position: sticky; 
            top: -49px; 
            z-index: 100;
            background: #f1f5f9;
            margin-left: -2.5rem;
            margin-right: -2.5rem;
            margin-top: -2.5rem;
            padding: 0.5rem 2.5rem;
            border-bottom: 1px solid rgba(0,0,0,0.1);
          }
        }
        @media print {
          @page {
            size: A4;
            margin: 5mm;
          }
          body {
            margin: 0;
            padding: 0;
          }
          
          html, body { 
            height: auto !important; 
            overflow: visible !important; 
            margin: 0 !important; 
            padding: 0 !important;
            background: white !important;
            width: 200mm !important;
          }
          
          /* Forced Page Breaks for Electron */
          .print-block {
            page-break-after: always !important;
            break-after: page !important;
          }
          
          .print-page-break {
            page-break-before: always !important;
            break-before: page !important;
          }

          /* Isolate Modal for printing */
          .fixed, .absolute, .relative {
            position: static !important;
            float: none !important;
            display: block !important;
          }

          .fixed.print\\:absolute, .bg-white.print\\:static {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 200mm !important;
            margin: 0 auto !important;
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            max-width: none !important;
            border-radius: 0 !important;
          }

          /* truly center the content on A4 */
          #print-root-container {
             width: 200mm !important;
             margin: 0 auto !important;
             padding: 0 !important;
             display: flex !important;
             transform: none !important;
          }

          .print-block, .print-page-break, .editor-tab-hidden { 
            display: flex !important;
            flex-direction: column !important;
            margin: 0 auto !important; 
            padding: 10mm !important; 
            border: 2px solid #000 !important; 
            box-sizing: border-box !important;
            box-shadow: none !important; 
            background: white !important;
            width: 200mm !important;
            max-width: 200mm !important;
            height: 287mm !important;
            max-height: 287mm !important;
            position: relative !important;
            overflow: hidden !important;
          }

          .no-print, [class*="print:hidden"] { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
          
          .bg-gray-100, .bg-gray-50, .bg-slate-50 { background-color: rgba(243, 244, 246, 0.5) !important; }
          input, select, textarea { border: none !important; background: transparent !important; appearance: none !important; }
        }
      `}} />
    </>
  );
};

export default OrderManager;

