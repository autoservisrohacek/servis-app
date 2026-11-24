import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Mail, 
  Phone, 
  MapPin, 
  MoreHorizontal, 
  UserPlus, 
  X, 
  Check, 
  Car, 
  Calendar,
  ChevronRight,
  User as UserIcon,
  Edit3,
  Trash2,
  AlertCircle,
  Building2,
  Briefcase,
  Type,
  User,
  Loader2,
  Sparkles,
  Printer,
  ShieldCheck,
  ShieldAlert,
  Paperclip,
  FolderOpen,
  FilePlus,
  FileText,
  Image as ImageIcon,
  Eye
} from 'lucide-react';
import { Customer, Vehicle, AttachmentItem } from '../types';

interface CustomerProps {
  customers: Customer[];
  vehicles: Vehicle[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  onAddCustomer: (customer: Customer) => void;
  onUpdateCustomer?: (customer: Customer) => void;
  onDeleteCustomer?: (id: string) => void;
  onNavigateToVehicle?: (vehicleId: string) => void;
  initialCustomerId?: string | null;
  autoOpen?: boolean;
  onModalOpened?: () => void;
  search: string;
  onSearchChange: (value: string) => void;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '---';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

const CustomerManager: React.FC<CustomerProps> = ({ 
  customers, 
  vehicles, 
  onAddCustomer, 
  onUpdateCustomer, 
  onDeleteCustomer,
  onNavigateToVehicle,
  initialCustomerId,
  autoOpen,
  onModalOpened,
  search,
  onSearchChange
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [selectedDetailCustomer, setSelectedDetailCustomer] = useState<Customer | null>(null);
  const [selectedVehiclesCustomer, setSelectedVehiclesCustomer] = useState<Customer | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);

  const initialFormData = {
    customerType: 'soukromý' as 'soukromý' | 'firemní',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    companyName: '',
    companyAddress: '',
    ico: '',
    dic: '',
    isVatPayer: false,
    contactPerson: '',
    gdprConsent: false
  };

  const [formData, setFormData] = useState(initialFormData);
  const [isAresLoading, setIsAresLoading] = useState(false);
  const [aresError, setAresError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDetailCustomer) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const fileData = new Uint8Array(arrayBuffer);
        
        // Identifikátor pro složku: [Příjmení] (nebo companyName)
        const identifier = selectedDetailCustomer.customerType === 'firemní' 
          ? (selectedDetailCustomer.companyName || selectedDetailCustomer.lastName)
          : selectedDetailCustomer.lastName;

        const newAttachment = await (window as any).electronAPI.attachment.upload({
          type: 'customer',
          identifier: identifier,
          fileName: file.name,
          fileData: fileData
        });

        const updatedCustomer = {
          ...selectedDetailCustomer,
          attachments: [...(selectedDetailCustomer.attachments || []), newAttachment],
          updatedAt: new Date().toISOString()
        };
        setSelectedDetailCustomer(updatedCustomer);
        if (onUpdateCustomer) onUpdateCustomer(updatedCustomer);
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
    if (!selectedDetailCustomer) return;
    if (!confirm('Opravdu chcete tento soubor smazat?')) return;

    try {
      await (window as any).electronAPI.attachment.delete(path);
      const updatedCustomer = {
        ...selectedDetailCustomer,
        attachments: (selectedDetailCustomer.attachments || []).filter(a => a.id !== attachmentId),
        updatedAt: new Date().toISOString()
      };
      setSelectedDetailCustomer(updatedCustomer);
      if (onUpdateCustomer) onUpdateCustomer(updatedCustomer);
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Mazání souboru selhalo.');
    }
  };

  const handleAresLookup = async () => {
    if (!formData.ico || formData.ico.trim().length < 6) {
      setAresError("Zadejte platné IČO.");
      return;
    }
    
    setIsAresLoading(true);
    setAresError(null);
    try {
      const response = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${formData.ico.trim()}`);
      if (!response.ok) {
        throw new Error("Při komunikaci s ARES došlo k chybě (IČO nenalezeno nebo je neplatné).");
      }
      const data = await response.json();
      
      const companyName = data.obchodniJmeno || "";
      let dic = data.dic || "";
      
      const addressObj = data.sidlo || {};
      const street = addressObj.nazevUlice || addressObj.nazevObce || "";
      const houseNum = addressObj.cisloDomovni ? `${addressObj.cisloDomovni}` : "";
      const orientNum = addressObj.cisloOrientacni ? `/${addressObj.cisloOrientacni}` : "";
      const fullStreet = houseNum ? `${street} ${houseNum}${orientNum}`.trim() : street;
      const city = addressObj.nazevObce || "";
      const psc = addressObj.psc ? addressObj.psc.toString() : "";
      
      const addressStr = [fullStreet, city, psc].filter(Boolean).join(", ");
      
      setFormData(prev => ({
        ...prev,
        companyName,
        companyAddress: addressStr,
        dic,
        isVatPayer: !!dic,
        customerType: 'firemní'
      }));
    } catch (err: any) {
      setAresError(err.message || "Nepodařilo se načíst data z ARES.");
    } finally {
      setIsAresLoading(false);
    }
  };

  useEffect(() => {
    if (autoOpen) {
      handleOpenAdd();
      if (onModalOpened) onModalOpened();
    }
  }, [autoOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const alphabet = useMemo(() => {
    const letters = new Set<string>();
    customers.forEach(c => {
      if (c.firstName.toLowerCase() === 'zákazník' && c.lastName.toLowerCase() === 'neznámý') return;
      const char = c.customerType === 'firemní' && c.companyName ? c.companyName[0] : (c.lastName ? c.lastName[0] : '');
      if (char) letters.add(char.toUpperCase());
    });
    return Array.from(letters).sort((a, b) => a.localeCompare(b, 'cs'));
  }, [customers]);

  const filtered = useMemo(() => {
    return customers
      .filter(c => {
        if (c.firstName.toLowerCase() === 'zákazník' && c.lastName.toLowerCase() === 'neznámý') return false;
        const customerVehicles = vehicles.filter(v => v.customerId === c.id);
        const hasMatchingVehicle = customerVehicles.some(v => 
          (v.licensePlate || "").toLowerCase().includes(search.toLowerCase())
        );

        const matchesSearch = 
          `${c.lastName} ${c.firstName}`.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase()) ||
          (c.companyName && c.companyName.toLowerCase().includes(search.toLowerCase())) ||
          c.phone.includes(search) ||
          hasMatchingVehicle;
        
        const char = c.customerType === 'firemní' && c.companyName ? c.companyName[0] : (c.lastName ? c.lastName[0] : '');
        const matchesLetter = !selectedLetter || (char.toUpperCase() === selectedLetter);
        
        return matchesSearch && matchesLetter;
      })
      .sort((a, b) => {
        const nameA = a.customerType === 'firemní' ? (a.companyName || '') : (a.lastName || '');
        const nameB = b.customerType === 'firemní' ? (b.companyName || '') : (b.lastName || '');
        return nameA.localeCompare(nameB, 'cs');
      });
  }, [customers, search, selectedLetter, vehicles]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData(initialFormData);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      customerType: customer.customerType || 'soukromý',
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      companyName: customer.companyName || '',
      companyAddress: customer.companyAddress || '',
      ico: customer.ico || '',
      dic: customer.dic || '',
      isVatPayer: customer.isVatPayer || false,
      contactPerson: customer.contactPerson || '',
      gdprConsent: customer.gdprConsent || false
    });
    setIsAddModalOpen(true);
    setOpenMenuId(null);
  };

  const handleCloseModals = () => {
    setIsAddModalOpen(false);
    setEditingCustomer(null);
    setDeletingCustomer(null);
    setSelectedDetailCustomer(null);
    setSelectedVehiclesCustomer(null);
    
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
    
    const submissionData = {
      ...formData,
      firstName: formData.customerType === 'soukromý' ? formData.firstName.trim() : '',
      lastName: formData.customerType === 'soukromý' ? formData.lastName.trim() : '',
      companyName: formData.customerType === 'firemní' ? formData.companyName.trim() : undefined,
      companyAddress: formData.companyAddress.trim() || undefined,
      ico: formData.ico.trim() || undefined,
      dic: formData.dic.trim() || undefined,
      isVatPayer: formData.customerType === 'firemní' ? formData.isVatPayer : false,
      contactPerson: formData.customerType === 'firemní' ? formData.contactPerson.trim() : undefined,
      gdprConsent: formData.gdprConsent
    };

    if (editingCustomer) {
      if (onUpdateCustomer) {
        onUpdateCustomer({
          ...editingCustomer,
          ...submissionData,
          updatedAt: new Date().toISOString()
        } as Customer);
      }
    } else {
      const newCustomer: Customer = {
        ...submissionData,
        id: `c${Date.now()}`,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      } as Customer;
      onAddCustomer(newCustomer);
    }
    handleCloseModals();
  };

  const confirmDelete = () => {
    if (deletingCustomer && onDeleteCustomer) {
      onDeleteCustomer(deletingCustomer.id);
      handleCloseModals();
    }
  };

  const printGdprConsent = (customer: Customer) => {
    const name = customer.customerType === 'firemní' 
      ? (customer.companyName || `${customer.lastName} ${customer.firstName}`) 
      : `${customer.lastName} ${customer.firstName}`;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Souhlas se zpracováním osobních údajů (GDPR)</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            h1 { font-size: 24px; text-transform: uppercase; margin: 0; }
            .section { margin-bottom: 25px; }
            .label { font-weight: bold; display: block; margin-bottom: 5px; text-transform: uppercase; font-size: 10px; color: #666; }
            .value { font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 5px; min-height: 20px; }
            .content { font-size: 12px; text-align: justify; }
            .signatures { margin-top: 80px; display: flex; justify-content: space-between; }
            .signature-box { border-top: 1px solid #333; width: 250px; text-align: center; padding-top: 10px; font-size: 12px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Souhlas se zpracováním osobních údajů</h1>
            <p>dle nařízení Evropského parlamentu a Rady (EU) 2016/679 (GDPR)</p>
          </div>

          <div class="section">
            <span class="label">Subjekt údajů (Zákazník)</span>
            <div class="value">${name}</div>
          </div>

          <div class="section">
            <span class="label">Adresa / Sídlo</span>
            <div class="value">${customer.address || ''}</div>
          </div>

          <div class="section">
            <span class="label">Telefon / E-mail</span>
            <div class="value">${customer.phone} ${customer.email ? ` / ${customer.email}` : ''}</div>
          </div>

          <div class="content">
            <p>Svým podpisem uděluji souhlas autoservisu se zpracováním mých osobních údajů v rozsahu: jméno a příjmení, název firmy, adresa bydliště/sídla, telefonní číslo, e-mailová adresa a údaje o mém vozidle (vč. SPZ a VIN).</p>
            <p><strong>Účel zpracování:</strong> Evidence zákazníků, provádění servisních prací, objednávání náhradních dílů, vystavování daňových dokladů a zasílání upozornění na blížící se termíny STK nebo pravidelného servisu (např. formou SMS nebo e-mailu).</p>
            <p>Tento souhlas uděluji na dobu neurčitou, nejdéle však do doby odvolání tohoto souhlasu. Byl jsem informován o svém právu na přístup k těmto údajům, právu na jejich opravu, výmaz nebo omezení zpracování.</p>
          </div>

          <div class="signatures">
            <div class="signature-box">
              V ......................... dne .........................
            </div>
            <div class="signature-box">
              Podpis zákazníka
            </div>
          </div>

          <div class="no-print" style="margin-top: 50px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer;">Tisk dokumentu</button>
          </div>
          <script>
            window.onload = () => {
              // window.print(); // Optional: Auto-print
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleViewVehicle = (vehicleId: string) => {
    if (onNavigateToVehicle) {
      onNavigateToVehicle(vehicleId);
      setSelectedVehiclesCustomer(null);
    }
  };

  const customerVehicles = selectedVehiclesCustomer 
    ? vehicles.filter(v => v.customerId === selectedVehiclesCustomer.id)
    : [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Zákazníci</h2>
          <p className="text-slate-500 font-medium">Správa kontaktů a klientských karet.</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
        >
          <UserPlus className="w-5 h-5" />
          Nový zákazník
        </button>
      </div>

      <div className="space-y-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Hledat podle jména, emailu, firmy, telefonu nebo SPZ..." 
            className="flex-1 text-sm font-medium outline-none bg-transparent"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {search && (
            <button 
              onClick={() => onSearchChange('')}
              className="text-blue-600 font-bold text-xs px-3 py-1 hover:bg-blue-50 rounded-lg transition-all"
            >
              Zrušit filtr
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 px-1 custom-scrollbar-h">
          <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center gap-2 shrink-0">
            <Type className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Abecedně:</span>
          </div>
          <button 
            onClick={() => setSelectedLetter(null)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${!selectedLetter ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'}`}
          >
            VŠE
          </button>
          {alphabet.map(letter => (
            <button 
              key={letter}
              onClick={() => setSelectedLetter(selectedLetter === letter ? null : letter)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${selectedLetter === letter ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'}`}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(c => (
          <div key={c.id} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-visible">
            <div className="absolute top-0 right-0 p-4">
              <div className="relative">
                <button 
                  onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                  className={`p-2 rounded-xl transition-all ${openMenuId === c.id ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:text-slate-900'}`}
                >
                  <MoreHorizontal className="w-6 h-6" />
                </button>

                {openMenuId === c.id && (
                  <div 
                    ref={menuRef}
                    className="absolute top-12 right-0 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[60] animate-in fade-in zoom-in-95 duration-200"
                  >
                    <button 
                      onClick={() => { printGdprConsent(c); setOpenMenuId(null); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors text-sm font-bold"
                    >
                      <Printer className="w-4 h-4 text-slate-400" />
                      Tisk GDPR souhlasu
                    </button>
                    <button 
                      onClick={() => handleOpenEdit(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors text-sm font-bold"
                    >
                      <Edit3 className="w-4 h-4 text-slate-400" />
                      Upravit kartu
                    </button>
                    <button 
                      onClick={() => { setDeletingCustomer(c); setOpenMenuId(null); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-600 transition-colors text-sm font-bold"
                    >
                      <Trash2 className="w-4 h-4" />
                      Smazat kartu
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-5 mb-6">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg transition-transform group-hover:scale-105 ${c.customerType === 'firemní' ? 'bg-slate-900 shadow-slate-900/20' : 'bg-blue-600 shadow-blue-600/20'}`}>
                {c.customerType === 'firemní' ? <Building2 className="w-8 h-8" /> : <UserIcon className="w-8 h-8" />}
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 leading-tight">
                  {c.customerType === 'firemní' ? (c.companyName || `${c.lastName} ${c.firstName}`) : `${c.lastName} ${c.firstName}`}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${c.customerType === 'firemní' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-600'}`}>
                    {c.customerType === 'firemní' ? 'FIRMA' : 'SOUKROMÝ'}
                  </span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Klient od {formatDate(c.createdAt)}</p>
                </div>
              </div>
              {c.gdprConsent ? (
                <div className="absolute top-16 right-4 flex items-center gap-1 text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full" title="Souhlas GDPR udělen">
                  <ShieldCheck className="w-3 h-3" />
                  <span className="text-[8px] font-black uppercase">GDPR OK</span>
                </div>
              ) : (
                <div className="absolute top-16 right-4 flex items-center gap-1 text-red-500 bg-red-50 px-2 py-0.5 rounded-full" title="Chybí souhlas GDPR">
                  <ShieldAlert className="w-3 h-3" />
                  <span className="text-[8px] font-black uppercase">GDPR !</span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-50">
              <div className="flex items-center gap-3 text-slate-600">
                <div className="p-2 bg-slate-50 rounded-lg"><Mail className="w-4 h-4" /></div>
                <span className="text-sm font-semibold truncate">{c.email || 'Bez e-mailu'}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <div className="p-2 bg-slate-50 rounded-lg"><Phone className="w-4 h-4" /></div>
                <span className="text-sm font-semibold">{c.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <div className="p-2 bg-slate-50 rounded-lg"><MapPin className="w-4 h-4" /></div>
                <span className="text-sm font-semibold truncate">
                  {c.customerType === 'firemní' ? (c.companyAddress || c.address) : c.address || 'Bez adresy'}
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button 
                onClick={() => setSelectedDetailCustomer(c)}
                className="flex-1 py-3 bg-slate-100 text-slate-900 rounded-xl font-bold text-xs hover:bg-slate-200 transition-colors uppercase tracking-wider"
              >
                Detail
              </button>
              <button 
                onClick={() => setSelectedVehiclesCustomer(c)}
                className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs hover:bg-blue-100 transition-colors uppercase tracking-wider"
              >
                Vozidla
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Opravdu smazat?</h3>
              <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                Opravdu chcete smazat kartu zákazníka <span className="font-bold text-slate-900">{deletingCustomer.companyName || `${deletingCustomer.lastName} ${deletingCustomer.firstName}`}</span>? Tato akce je nevratná.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={handleCloseModals}
                  className="flex-1 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                >
                  ZRUŠIT
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  SMAZAT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedDetailCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${selectedDetailCustomer.customerType === 'firemní' ? 'bg-slate-700' : 'bg-blue-600'}`}>
                  {selectedDetailCustomer.customerType === 'firemní' ? <Building2 className="w-6 h-6" /> : <UserIcon className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">
                    {selectedDetailCustomer.customerType === 'firemní' ? (selectedDetailCustomer.companyName || `${selectedDetailCustomer.lastName} ${selectedDetailCustomer.firstName}`) : `${selectedDetailCustomer.lastName} ${selectedDetailCustomer.firstName}`}
                  </h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Kompletní karta zákazníka</p>
                </div>
              </div>
              <button onClick={handleCloseModals} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              {selectedDetailCustomer.customerType === 'firemní' && (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Briefcase className="w-3 h-3" /> Firemní údaje
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Název firmy</p>
                      <p className="text-sm font-bold text-slate-900">{selectedDetailCustomer.companyName || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">IČO</p>
                      <p className="text-sm font-bold text-slate-900">{selectedDetailCustomer.ico || 'N/A'}</p>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Sídlo firmy</p>
                      <p className="text-sm font-bold text-slate-900">{selectedDetailCustomer.companyAddress || 'N/A'}</p>
                    </div>
                    {selectedDetailCustomer.dic && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">DIČ</p>
                        <p className="text-sm font-bold text-slate-900">{selectedDetailCustomer.dic}</p>
                      </div>
                    )}
                    <div className="col-span-2 space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Kontaktní osoba</p>
                      <p className="text-sm font-bold text-slate-900">{selectedDetailCustomer.contactPerson || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                {selectedDetailCustomer.customerType === 'soukromý' && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Osobní Jméno</p>
                    <p className="text-sm font-bold text-slate-900">{selectedDetailCustomer.lastName} {selectedDetailCustomer.firstName}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</p>
                  <p className="text-sm font-bold text-slate-900">{selectedDetailCustomer.email || 'Neuvedeno'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telefon</p>
                  <p className="text-sm font-bold text-slate-900">{selectedDetailCustomer.phone}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trvalá adresa / Bydliště</p>
                  <p className="text-sm font-bold text-slate-900">{selectedDetailCustomer.address || 'Neuvedeno'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registrován</p>
                  <p className="text-sm font-bold text-slate-900">{formatDate(selectedDetailCustomer.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Zákazníka</p>
                  <p className="text-sm font-mono font-bold text-blue-600">{selectedDetailCustomer.id}</p>
                </div>
              </div>

              {/* Dokumenty a přílohy */}
              <div className="space-y-6 pt-6 border-t border-slate-100">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-blue-600" /> Dokumenty a přílohy
                </h4>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl group hover:border-blue-300 hover:bg-blue-50/20 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Nahrát nový soubor</p>
                        <p className="text-[9px] font-bold text-slate-300 uppercase truncate max-w-[200px]">PDF, Obrázky, Dokumenty</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="p-3 bg-white text-blue-600 rounded-xl shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus className="w-4 h-4" />}
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      className="hidden" 
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
                    />
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    {selectedDetailCustomer.attachments && selectedDetailCustomer.attachments.length > 0 ? (
                      selectedDetailCustomer.attachments.map(att => (
                        <div key={att.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors group">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                              {att.name.toLowerCase().endsWith('.pdf') ? <FileText className="w-4 h-4" /> : att.name.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/) ? <ImageIcon className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-black text-slate-900 truncate uppercase mt-0.5">{att.name}</p>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{att.size} • {formatDate(att.uploadDate)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      <div className="py-8 text-center bg-slate-50/50 border border-slate-100 rounded-2xl">
                        <Paperclip className="w-8 h-8 text-slate-100 mx-auto mb-2" />
                        <p className="text-[10px] font-black text-slate-200 uppercase tracking-widest">Žádné přílohy</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button 
                onClick={handleCloseModals}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl transition-all"
              >
                ZAVŘÍT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicles Modal */}
      {selectedVehiclesCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-blue-600 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black tracking-tight">Vozidla zákazníka</h3>
                <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mt-1">
                  {selectedVehiclesCustomer.customerType === 'firemní' ? (selectedVehiclesCustomer.companyName || `${selectedVehiclesCustomer.lastName} ${selectedVehiclesCustomer.firstName}`) : `${selectedVehiclesCustomer.lastName} ${selectedVehiclesCustomer.firstName}`}
                </p>
              </div>
              <button onClick={handleCloseModals} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
              {customerVehicles.length > 0 ? (
                customerVehicles.map(v => (
                  <div 
                    key={v.id} 
                    onClick={() => handleViewVehicle(v.id)}
                    className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
                        <Car className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{v.make} {v.model}</p>
                        <p className="text-[10px] font-bold text-blue-600 font-mono tracking-wider uppercase">{v.licensePlate?.toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div className="hidden sm:block">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Přejít na kartu</p>
                        <p className="text-xs font-bold text-slate-900">{formatDate(v.stkExpirationDate)}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <Car className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold italic">Tento zákazník nemá v evidenci žádná vozidla.</p>
                </div>
              )}
            </div>
            <div className="p-8 border-t border-slate-50">
               <button 
                onClick={handleCloseModals}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-black py-4 rounded-2xl transition-all"
              >
                ZAVŘÍT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black tracking-tight">{editingCustomer ? 'Upravit zákazníka' : 'Nový zákazník'}</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                  {editingCustomer ? `Editace ID ${editingCustomer.id}` : 'Registrace do systému'}
                </p>
              </div>
              <button onClick={handleCloseModals} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Typ účtu</h4>
                <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-50 rounded-2xl">
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, customerType: 'soukromý'})}
                    className={`py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${formData.customerType === 'soukromý' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <UserIcon className="w-4 h-4" /> SOUKROMÁ OSOBA
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, customerType: 'firemní'})}
                    className={`py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${formData.customerType === 'firemní' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <Building2 className="w-4 h-4" /> FIREMNÍ ÚČET
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Základní údaje</h4>
                
                {formData.customerType === 'soukromý' ? (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-1 duration-200">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jméno *</label>
                      <input 
                        required={formData.customerType === 'soukromý'}
                        type="text" 
                        className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 outline-none transition-all font-bold"
                        value={formData.firstName}
                        onChange={e => setFormData({...formData, firstName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Příjmení *</label>
                      <input 
                        required={formData.customerType === 'soukromý'}
                        type="text" 
                        className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 outline-none transition-all font-bold"
                        value={formData.lastName}
                        onChange={e => setFormData({...formData, lastName: e.target.value})}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-top-1 duration-200">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Název firmy *</label>
                       <input 
                        autoFocus
                        required={formData.customerType === 'firemní'}
                        type="text" 
                        placeholder="Obchodní název společnosti..."
                        className="w-full bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl px-4 py-3 outline-none transition-all font-bold"
                        value={formData.companyName}
                        onChange={e => setFormData({...formData, companyName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kontaktní osoba</label>
                      <input 
                        type="text" 
                        placeholder="Jméno a příjmení kontaktní osoby..."
                        className="w-full bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl px-4 py-3 outline-none transition-all font-bold"
                        value={formData.contactPerson}
                        onChange={e => setFormData({...formData, contactPerson: e.target.value})}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trvalá adresa / Bydliště *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ulice, č.p., město, PSČ"
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 outline-none transition-all font-bold"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>

              {formData.customerType === 'firemní' && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Fakturační údaje firmy</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sídlo firmy (pokud se liší)</label>
                      <input 
                        type="text" 
                        placeholder="Zadejte fakturační adresu firmy..."
                        className="w-full bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl px-4 py-3 outline-none transition-all font-bold"
                        value={formData.companyAddress}
                        onChange={e => setFormData({...formData, companyAddress: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IČO *</label>
                        <div className="flex gap-2">
                          <input 
                            required={formData.customerType === 'firemní'}
                            type="text" 
                            className="w-full bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl px-4 py-3 outline-none transition-all font-bold"
                            value={formData.ico}
                            onChange={e => setFormData({...formData, ico: e.target.value})}
                          />
                          <button 
                            type="button" 
                            onClick={handleAresLookup}
                            disabled={isAresLoading}
                            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-blue-100 transition-all flex items-center justify-center min-w-[140px] shadow-sm disabled:opacity-50"
                          >
                            {isAresLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-3 h-3 mr-2" /> Načíst data</>}
                          </button>
                        </div>
                        {aresError && <p className="text-red-500 text-[10px] font-black px-2 mt-1">{aresError}</p>}
                      </div>
                      <div className="space-y-2 flex flex-col justify-end pb-1">
                        <label className="flex items-center gap-3 cursor-pointer group mb-2">
                           <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${formData.isVatPayer ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400 group-hover:bg-slate-300'}`}>
                             {formData.isVatPayer && <Check className="w-4 h-4" />}
                           </div>
                           <span className="text-xs font-bold text-slate-700">Plátce DPH</span>
                           <input type="checkbox" className="hidden" checked={formData.isVatPayer} onChange={e => setFormData({...formData, isVatPayer: e.target.checked})} />
                        </label>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">DIČ</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl px-4 py-3 outline-none transition-all font-bold"
                          value={formData.dic}
                          onChange={e => setFormData({...formData, dic: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Komunikace</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                    <input 
                      type="email" 
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 outline-none transition-all font-bold"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefon *</label>
                    <input 
                      required
                      type="tel" 
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 outline-none transition-all font-bold"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-3 cursor-pointer group p-4 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-blue-100 transition-all">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${formData.gdprConsent ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-white border-2 border-slate-200 text-slate-300'}`}>
                        {formData.gdprConsent ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Souhlas se zpracováním GDPR</p>
                        <p className="text-[9px] text-slate-400 font-bold leading-tight">Udělením souhlasu potvrzujete, že zákazník souhlasí s evidencí a SMS upozorněními.</p>
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={formData.gdprConsent} 
                        onChange={e => setFormData({...formData, gdprConsent: e.target.checked})} 
                      />
                    </label>
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-2 mt-4"
              >
                <Check className="w-5 h-5" />
                {editingCustomer ? 'ULOŽIT ZMĚNY' : 'ULOŽIT ZÁKAZNÍKA'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar-h::-webkit-scrollbar {
          height: 4px;
        }
        .custom-scrollbar-h::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar-h::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default CustomerManager;