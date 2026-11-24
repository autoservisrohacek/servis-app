import React, { useState, useRef } from 'react';
import { 
  Building, Bell, Save, Printer,
  DollarSign, Loader2,
  Plus, Trash2, Database, DownloadCloud, UploadCloud, CheckCircle2, AlertCircle, Check, Info,
  Tag, User, Layout, Percent, X, FolderOpen, Clock, ShieldCheck, ShieldAlert, CreditCard,
  AlertOctagon, BarChart3, Coins, Wallet, Briefcase, Calendar, Key, UserPlus, Settings2,
  Wrench, AlertTriangle, Link as LinkIcon, Wifi, WifiOff, MessageSquare, Sparkles,
  ShoppingCart, Globe, Mail, Eye, RefreshCcw, Bluetooth, Smartphone
} from 'lucide-react';
import { CompanyInfo, NotificationSettings, Customer, Vehicle, ServiceRecord, AutoBackupSettings, UserSettings, FixedService, PredefinedTask, PartItem, Invoice, AttachmentItem, VehicleChecklist, StatsSettings, CostItem, CostCategory, SmsSettings, UserShop } from '../types';
import { fetchVehicleFromRsv } from '../services/rsvService';

interface SettingsProps {
  hourlyRate: number;
  onRateChange: (rate: number) => void;
  fixedServices: FixedService[];
  onFixedServicesChange: (services: FixedService[]) => void;
  predefinedTasks: PredefinedTask[];
  onPredefinedTasksChange: (tasks: PredefinedTask[]) => void;
  discountLevels: number[];
  onDiscountLevelsChange: (levels: number[]) => void;
  technicians: string[];
  onTechniciansChange: (techs: string[]) => void;
  companyInfo: CompanyInfo;
  onCompanyChange: (info: CompanyInfo) => void;
  notifSettings: NotificationSettings;
  onNotifSettingsChange: (settings: NotificationSettings) => void;
  statsSettings: StatsSettings;
  onStatsSettingsChange: (settings: StatsSettings) => void;
  customers: Customer[];
  vehicles: Vehicle[];
  services: ServiceRecord[];
  invoices: Invoice[];
  userShops: UserShop[];
  onUserShopsChange: (shops: UserShop[]) => void;
  onRestoreData: (fullState: any) => void;
  onClearAllData: () => void;
  onExportData: () => void;
  autoBackupSettings: AutoBackupSettings;
  onAutoBackupSettingsChange: (settings: AutoBackupSettings) => void;
  setDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void;
  directoryHandle: FileSystemDirectoryHandle | null;
  userSettings: UserSettings;
  onUserSettingsChange: (settings: UserSettings) => void;
  selectedPrinter: string;
  onPrinterChange: (printer: string) => void;
  smsSettings: SmsSettings;
  onSmsSettingsChange: (settings: SmsSettings) => void;
  onRestoreCustomer: (id: string) => void;
  onRestoreVehicle: (id: string) => void;
}

const UNITS = ['ks', 'litr', 'gram', 'kg', 'm', 'sada', 'úkon'];
const COST_CATEGORIES: CostCategory[] = ['energie', 'nájemné', 'spotřební zboží', 'mzdy', 'pojištění', 'marketing', 'ostatní'];

const Settings: React.FC<SettingsProps> = ({ 
  hourlyRate, onRateChange, fixedServices, onFixedServicesChange,
  predefinedTasks, onPredefinedTasksChange,
  discountLevels, onDiscountLevelsChange,
  technicians, onTechniciansChange,
  companyInfo, onCompanyChange, notifSettings, onNotifSettingsChange,
  statsSettings, onStatsSettingsChange,
  customers, vehicles, services, invoices, userShops, onUserShopsChange, onRestoreData, onClearAllData, onExportData,
  autoBackupSettings, onAutoBackupSettingsChange, setDirectoryHandle, directoryHandle,
  userSettings, onUserSettingsChange, smsSettings, onSmsSettingsChange,
  onRestoreCustomer, onRestoreVehicle
}) => {
  const [activeTab, setActiveTab] = useState<'company' | 'invoicing' | 'notifications' | 'services' | 'backups' | 'team' | 'templates' | 'stats_config' | 'sms' | 'shops' | 'integrations' | 'p2p'>('company');
  const [trashTab, setTrashTab] = useState<'customers' | 'vehicles'>('customers');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [backupStatus, setBackupStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  
  const [newTechName, setNewTechName] = useState('');
  const [newDiscount, setNewDiscount] = useState<string>('');
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [geminiSaveStatus, setGeminiSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [googleClientId, setGoogleClientId] = useState(() => localStorage.getItem('google_client_id') || '');
  const [googleClientSecret, setGoogleClientSecret] = useState(() => localStorage.getItem('google_client_secret') || '');
  const [googleSaveStatus, setGoogleSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [allowedEmailFilters, setAllowedEmailFilters] = useState<string[]>(() => {
    const saved = localStorage.getItem('allowed_email_filters');
    return saved ? JSON.parse(saved) : [];
  });
  const [newEmailFilter, setNewEmailFilter] = useState('');
  const [emailFilterSaveStatus, setEmailFilterSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [newShopName, setNewShopName] = useState('');
  const [newShopUrl, setNewShopUrl] = useState('');
  const [deletingFixedService, setDeletingFixedService] = useState<FixedService | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<PredefinedTask | null>(null);
  const [isClearDataConfirmOpen, setIsClearDataConfirmOpen] = useState(false);

  const [p2pMode, setP2pMode] = useState<'off' | 'server' | 'client'>(() => (localStorage.getItem('p2p_mode') as any) || 'off');
  const [p2pServerIp, setP2pServerIp] = useState(() => localStorage.getItem('p2p_server_ip') || '');
  const [p2pBtPort, setP2pBtPort] = useState(() => localStorage.getItem('p2p_bt_port') || 'COM4');
  const [p2pSaveStatus, setP2pSaveStatus] = useState<'idle' | 'saved'>('idle');

  const [localPcIp, setLocalPcIp] = useState(() => {
    const hostname = window.location.hostname;
    return (hostname && hostname !== 'localhost' && !hostname.includes('127.0.0.1')) ? hostname : '192.168.1.100';
  });

  React.useEffect(() => {
    const electron = (window as any).electronAPI;
    if (electron?.p2p?.getIpAddress) {
      electron.p2p.getIpAddress().then((ip: string) => {
        if (ip) {
          setLocalPcIp(ip);
        }
      }).catch((err: any) => {
        console.error("Chyba při zjišťování IP adresy:", err);
      });
    }
  }, []);

  // Stavové proměnné pro trenažér mobilní aplikace
  const [simQuery, setSimQuery] = useState('');
  const [simSelectedVehicle, setSimSelectedVehicle] = useState<Vehicle | null>(null);
  const [simIsManual, setSimIsManual] = useState(false);
  const [simPlate, setSimPlate] = useState('');
  const [simMake, setSimMake] = useState('');
  const [simModel, setSimModel] = useState('');
  const [simKm, setSimKm] = useState('');
  const [simFuel, setSimFuel] = useState('50%');
  const [simEquipment, setSimEquipment] = useState({
    spareTyre: false,
    securityKey: false,
    jack: false,
    triangle: false,
    wheelWrench: false,
    firstAid: false,
    tyreKit: false
  });
  const [simNotes, setSimNotes] = useState('');

  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCloseModals = () => {
    setDeletingFixedService(null);
    setDeletingTemplate(null);
    setIsClearDataConfirmOpen(false);
    setRestoreConfirmOpen(false);
    
    // Electron focus fix
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      window.focus();
    }, 50);
  };

  const handleSave = () => {
    setSaveStatus('saving');
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  };

  const handleSaveGeminiKey = () => {
    localStorage.setItem('gemini_api_key', geminiApiKey);
    setGeminiSaveStatus('saved');
    setTimeout(() => setGeminiSaveStatus('idle'), 2000);
  };

  const handleSaveGoogleConfig = () => {
    localStorage.setItem('google_client_id', googleClientId);
    localStorage.setItem('google_client_secret', googleClientSecret);
    setGoogleSaveStatus('saved');
    setTimeout(() => setGoogleSaveStatus('idle'), 2000);
  };

  const handleSaveEmailFilters = () => {
    localStorage.setItem('allowed_email_filters', JSON.stringify(allowedEmailFilters));
    setEmailFilterSaveStatus('saved');
    setTimeout(() => setEmailFilterSaveStatus('idle'), 2000);
  };

  const addEmailFilter = () => {
    if (newEmailFilter && !allowedEmailFilters.includes(newEmailFilter)) {
      const updated = [...allowedEmailFilters, newEmailFilter];
      handleSaveEmailFiltersUpdate(updated);
      setNewEmailFilter('');
    }
  };

  const removeEmailFilter = (email: string) => {
    const updated = allowedEmailFilters.filter(e => e !== email);
    handleSaveEmailFiltersUpdate(updated);
  };

  const handleSaveEmailFiltersUpdate = (updated: string[]) => {
    setAllowedEmailFilters(updated);
    localStorage.setItem('allowed_email_filters', JSON.stringify(updated));
  };

  const handleSaveP2PSettings = () => {
    localStorage.setItem('p2p_mode', p2pMode);
    localStorage.setItem('p2p_server_ip', p2pServerIp);
    localStorage.setItem('p2p_bt_port', p2pBtPort);
    
    // Notify Main Process via IPC (Electron)
    if ((window as any).electronAPI?.p2p) {
      (window as any).electronAPI.p2p.updateSettings({
        mode: p2pMode,
        serverIp: p2pServerIp
      });
    }

    if ((window as any).electronAPI?.bluetooth) {
      (window as any).electronAPI.bluetooth.updatePort(p2pBtPort);
    }

    setP2pSaveStatus('saved');
    setTimeout(() => setP2pSaveStatus('idle'), 2000);
  };

  const handleAddShop = () => {
    if (newShopName && newShopUrl) {
      const newShop: UserShop = {
        id: `shop-${Date.now()}`,
        name: newShopName,
        url: newShopUrl.startsWith('http') ? newShopUrl : `https://${newShopUrl}`
      };
      onUserShopsChange([...userShops, newShop]);
      setNewShopName('');
      setNewShopUrl('');
    }
  };

  const removeShop = (id: string) => {
    onUserShopsChange(userShops.filter(s => s.id !== id));
  };

  const handleTestRsv = async () => {
    if (!companyInfo.rsvApiKey) {
      setTestStatus('error');
      setTestError('Chybí API klíč.');
      return;
    }
    setTestStatus('loading');
    setTestError('');
    try {
      await fetchVehicleFromRsv('TESTCONNECTION123', companyInfo.rsvApiKey, companyInfo.rsvProxyUrl);
      setTestStatus('success');
    } catch (err: any) {
      setTestStatus('error');
      setTestError(err.message);
    }
  };

  const handleJSONImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBackupStatus('processing');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        // Základní validace integrity
        if (!data.customers || !data.vehicles) {
          throw new Error('Nevalidní soubor zálohy. Chybí základní data (zákazníci/vozidla).');
        }

        setPendingRestoreData(data);
        setRestoreConfirmOpen(true);
        setBackupStatus('idle');
      } catch (err: any) {
        console.error("Import failed:", err);
        setBackupStatus('error');
        alert(err.message || 'Nepodařilo se načíst soubor zálohy. Ujistěte se, že jde o platný JSON formát.');
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const addCostItem = () => {
    const newItem: CostItem = {
      id: `cost-${Date.now()}`,
      name: '',
      amount: 0,
      category: 'ostatní',
      isRecurring: true
    };
    onStatsSettingsChange({
      ...statsSettings,
      costItems: [...(statsSettings.costItems || []), newItem]
    });
  };

  const updateCostItem = (id: string, field: keyof CostItem, value: any) => {
    onStatsSettingsChange({
      ...statsSettings,
      costItems: statsSettings.costItems.map(item => item.id === id ? { ...item, [field]: value } : item)
    });
  };

  const removeCostItem = (id: string) => {
    onStatsSettingsChange({
      ...statsSettings,
      costItems: statsSettings.costItems.filter(item => item.id !== id)
    });
  };

  const addDiscountLevel = () => {
    const val = parseInt(newDiscount);
    if (!isNaN(val) && !discountLevels.includes(val)) {
      onDiscountLevelsChange([...discountLevels, val].sort((a, b) => a - b));
      setNewDiscount('');
    }
  };

  const removeDiscountLevel = (val: number) => onDiscountLevelsChange(discountLevels.filter(d => d !== val));

  const addFixedService = (category: 'díly' | 'úkony' | 'materiál') => onFixedServicesChange([...fixedServices, { 
    id: `fs${Date.now()}`, 
    name: '', 
    price: 0, 
    costPrice: 0, 
    unit: category === 'úkony' ? 'hod' : 'ks',
    category 
  }]);
  const updateFixedService = (id: string, field: keyof FixedService, value: string | number) => onFixedServicesChange(fixedServices.map(fs => fs.id === id ? { ...fs, [field]: value } : fs));

  const addTemplate = () => onPredefinedTasksChange([...predefinedTasks, { id: `pt${Date.now()}`, label: '', description: '' }]);
  const updateTemplate = (id: string, field: keyof PredefinedTask, value: string) => onPredefinedTasksChange(predefinedTasks.map(pt => pt.id === id ? { ...pt, [field]: value } : pt));

  const addTechnician = () => {
    if (newTechName.trim()) {
      onTechniciansChange([...technicians, newTechName.trim()]);
      setNewTechName('');
    }
  };
  const removeTechnician = (name: string) => onTechniciansChange(technicians.filter(t => t !== name));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Nastavení systému</h2>
          <p className="text-slate-500 font-medium">Konfigurace parametrů vašeho servisu.</p>
        </div>
        <button onClick={handleSave} className={`px-8 py-4 rounded-2xl font-black text-xs transition-all flex items-center gap-3 shadow-xl ${saveStatus === 'saved' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
          {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : saveStatus === 'saved' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saveStatus === 'saving' ? 'UKLÁDÁM...' : saveStatus === 'saved' ? 'ULOŽENO' : 'ULOŽIT VŠE'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-200/50 w-fit rounded-2xl">
        {[
          { id: 'company', label: 'Moje Firma', icon: Building },
          { id: 'invoicing', label: 'Fakturace', icon: Percent },
          { id: 'team', label: 'Tým', icon: User },
          { id: 'services', label: 'Ceník', icon: DollarSign },
          { id: 'templates', label: 'Šablony', icon: Layout },
          { id: 'stats_config', label: 'Statistiky', icon: BarChart3 },
          { id: 'shops', label: 'Moje E-shopy', icon: ShoppingCart },
          { id: 'integrations', label: 'Integrace', icon: LinkIcon },
          { id: 'p2p', label: 'Síťová synchronizace (P2P)', icon: Printer },
          { id: 'notifications', label: 'Upozornění', icon: Bell },
          { id: 'sms', label: 'SMS Brána', icon: MessageSquare },
          { id: 'backups', label: 'Zálohování', icon: Database }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-5xl">
        {activeTab === 'company' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                      <Building className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                      <h3 className="text-2xl font-black text-slate-900">Firemní údaje</h3>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Základní identifikace firmy</p>
                  </div>
                </div>
                <div className="bg-slate-50 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-100 shadow-inner">
                  <button 
                    onClick={() => onCompanyChange({...companyInfo, isVatPayer: true})}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${companyInfo?.isVatPayer ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <ShieldCheck className="w-4 h-4" /> Jsme plátce DPH
                  </button>
                  <button 
                    onClick={() => onCompanyChange({...companyInfo, isVatPayer: false})}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${!companyInfo?.isVatPayer ? 'bg-white text-slate-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <ShieldAlert className="w-4 h-4" /> Nejsme plátce
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Název servisu</label>
                  <input type="text" className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold" value={companyInfo?.name || ''} onChange={e => onCompanyChange({...companyInfo, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fakturační adresa</label>
                  <input type="text" className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold" value={companyInfo?.address || ''} onChange={e => onCompanyChange({...companyInfo, address: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IČO</label>
                  <input type="text" className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl px-4 py-3 outline-none transition-all font-bold" value={companyInfo?.ico || ''} onChange={e => onCompanyChange({...companyInfo, ico: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">DIČ</label>
                  <input type="text" className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl px-4 py-3 outline-none transition-all font-bold" value={companyInfo?.dic || ''} onChange={e => onCompanyChange({...companyInfo, dic: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefon</label>
                  <input type="text" className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl px-4 py-3 outline-none transition-all font-bold" value={companyInfo?.phone || ''} onChange={e => onCompanyChange({...companyInfo, phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                  <input type="text" className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl px-4 py-3 outline-none transition-all font-bold" value={companyInfo?.email || ''} onChange={e => onCompanyChange({...companyInfo, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <CreditCard className="w-3 h-3" /> Bankovní účet
                  </label>
                  <input type="text" placeholder="Např. 123456789/0100" className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold" value={companyInfo?.bankAccount || ''} onChange={e => onCompanyChange({...companyInfo, bankAccount: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Datum registrace u ŽÚ
                  </label>
                  <input type="date" className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold" value={companyInfo?.foundationDate || ''} onChange={e => onCompanyChange({...companyInfo, foundationDate: e.target.value})} />
                </div>
              </div>

              <div className="pt-8 border-t border-slate-50 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center">
                      <Key className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 uppercase">Registr silničních vozidel (RSV)</h3>
                      <p className="text-slate-400 text-xs font-bold">API klíč pro automatickou synchronizaci dat z dataovozidlech.cz</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleTestRsv}
                    disabled={testStatus === 'loading'}
                    className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all flex items-center gap-2 shadow-sm ${
                      testStatus === 'success' ? 'bg-emerald-500 text-white' : 
                      testStatus === 'error' ? 'bg-red-500 text-white' : 
                      'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {testStatus === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : testStatus === 'success' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {testStatus === 'loading' ? 'TESTUJI...' : testStatus === 'success' ? 'SPOJENÍ OK' : testStatus === 'error' ? 'CHYBA SPOJENÍ' : 'OTESTOVAT SPOJENÍ'}
                  </button>
                </div>

                {testStatus === 'error' && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
                     <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                     <div className="text-xs font-bold text-red-600 leading-relaxed">
                        Chyba: {testError}<br/>
                        <span className="opacity-70 font-medium italic">Tip: Zkuste nastavit "CORS Proxy" níže na "https://corsproxy.io/?", to většinou problém vyřeší.</span>
                     </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">RSV API Klíč (přidělený přes e-mail)</label>
                    <input 
                      type="password" 
                      className={`w-full px-5 py-4 bg-slate-50 border-2 rounded-2xl outline-none font-bold font-mono tracking-widest transition-all ${!companyInfo?.rsvApiKey ? 'border-red-200' : 'border-transparent focus:border-blue-500'}`}
                      value={companyInfo?.rsvApiKey || ''} 
                      onChange={e => onCompanyChange({...companyInfo, rsvApiKey: e.target.value})} 
                      placeholder="Vložte váš přidělený API_KEY..."
                    />
                    {!companyInfo?.rsvApiKey && (
                      <p className="text-[9px] text-red-500 font-black mt-1 uppercase flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3" /> Klíč chybí - Služba nebude fungovat
                      </p>
                    )}
                    <p className="text-[9px] text-slate-400 mt-2 italic">Klíč získáte po bezplatné registraci na <a href="https://dataovozidlech.cz/registraceapi" target="_blank" rel="noreferrer" className="text-blue-600 underline">dataovozidlech.cz/registraceapi</a></p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <LinkIcon className="w-3 h-3" /> CORS Proxy URL (Pro stabilní spojení)
                    </label>
                    <input 
                      type="text" 
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold" 
                      value={companyInfo?.rsvProxyUrl || ''} 
                      onChange={e => onCompanyChange({...companyInfo, rsvProxyUrl: e.target.value})} 
                      placeholder="https://corsproxy.io/?"
                    />
                    <p className="text-[9px] text-slate-400 mt-2 italic leading-relaxed">
                      Doporučená hodnota pro prohlížeč: <b>https://corsproxy.io/?</b>
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-50 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 uppercase">Gemini AI (Umělá inteligence)</h3>
                      <p className="text-slate-400 text-xs font-bold">Váš osobní API klíč pro pokročilé diagnostiky a analýzy</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleSaveGeminiKey}
                    className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all flex items-center gap-2 shadow-sm ${
                      geminiSaveStatus === 'saved' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {geminiSaveStatus === 'saved' ? <CheckCircle2 className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                    {geminiSaveStatus === 'saved' ? 'ULOŽENO' : 'ULOŽIT KLÍČ'}
                  </button>
                </div>

                <div className="space-y-2 max-w-2xl">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gemini API Klíč</label>
                  <input 
                    type="password" 
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none font-bold font-mono tracking-widest transition-all"
                    value={geminiApiKey} 
                    onChange={e => setGeminiApiKey(e.target.value)} 
                    placeholder="Vložte váš Gemini API klíč..."
                  />
                  <p className="text-[9px] text-slate-400 mt-2 italic">
                    Pokud pole necháte prázdné, bude použit systémový klíč servisu. Vlastní klíč získáte zdarma na <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-purple-600 underline">aistudio.google.com</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'invoicing' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
                    <Percent className="w-8 h-8 text-red-600" />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-900">Fakturační nastavení</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Správa slev a hodinových sazeb</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hodinová sazba servisu (bez DPH)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold"
                      value={Math.round(hourlyRate)}
                      onChange={e => onRateChange(parseFloat(e.target.value) || 0)}
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-300">Kč / h</span>
                  </div>
                  {companyInfo.isVatPayer && <p className="text-[10px] font-bold text-slate-400 uppercase">Včetně DPH 21%: {Math.round(hourlyRate * 1.21)} Kč / h</p>}
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stupně slev (%)</label>
                  <div className="flex flex-wrap gap-3">
                    {discountLevels.map(level => (
                      <div key={level} className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 group">
                        <span className="font-bold text-slate-900">{level}%</span>
                        <button onClick={() => removeDiscountLevel(level)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        placeholder="%"
                        className="w-16 px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-red-500 rounded-xl outline-none font-bold text-center"
                        value={newDiscount}
                        onChange={e => setNewDiscount(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addDiscountLevel()}
                      />
                      <button onClick={addDiscountLevel} className="p-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors">
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <User className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-900">Správa týmu</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Seznam techniků a mechaniků</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {technicians.map((name, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-all">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                             <User className="w-5 h-5 text-slate-400" />
                          </div>
                          <span className="font-bold text-slate-900">{name}</span>
                       </div>
                       <button onClick={() => removeTechnician(name)} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  ))}
                </div>

                <div className="max-w-md pt-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nový člen týmu</label>
                  <div className="flex gap-2 mt-2">
                    <input 
                      type="text" 
                      placeholder="Jméno technika..."
                      className="flex-1 px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold"
                      value={newTechName}
                      onChange={e => setNewTechName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTechnician()}
                    />
                    <button onClick={addTechnician} className="bg-slate-900 text-white px-6 rounded-2xl font-black text-xs uppercase hover:bg-slate-800 transition-all flex items-center gap-2">
                      <UserPlus className="w-4 h-4" /> PŘIDAT
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'services' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-left-4">
            {/* Category: Náhradní díly */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                      <Wrench className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                      <h3 className="text-2xl font-black text-slate-900">Náhradní díly</h3>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Ceník dílů (ceny bez DPH)</p>
                  </div>
                </div>
                <button onClick={() => addFixedService('díly')} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Nový díl
                </button>
              </div>

              <div className="space-y-3">
                 {fixedServices.filter(s => s.category === 'díly' || !s.category).map(fs => (
                   <div key={fs.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all group">
                      <div className="md:col-span-5">
                         <input 
                           placeholder="Název dílu"
                           className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                           value={fs.name}
                           onChange={e => updateFixedService(fs.id, 'name', e.target.value)}
                         />
                      </div>
                      <div className="md:col-span-2">
                         <div className="relative">
                            <input 
                              type="number"
                              placeholder="Nákup"
                              className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-red-500 text-red-600"
                              value={fs.costPrice || ''}
                              onChange={e => updateFixedService(fs.id, 'costPrice', parseFloat(e.target.value) || 0)}
                            />
                         </div>
                      </div>
                      <div className="md:col-span-2">
                         <div className="relative">
                            <input 
                              type="number"
                              placeholder="Prodej"
                              className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 text-blue-600"
                              value={fs.price || ''}
                              onChange={(e) => updateFixedService(fs.id, 'price', parseFloat(e.target.value) || 0)}
                            />
                         </div>
                      </div>
                      <div className="md:col-span-2">
                         <select 
                           className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                           value={fs.unit || 'ks'}
                           onChange={e => updateFixedService(fs.id, 'unit', e.target.value)}
                         >
                           {UNITS.filter(u => u !== 'hod').map(u => <option key={u} value={u}>{u}</option>)}
                         </select>
                      </div>
                      <div className="md:col-span-1 flex items-center justify-end">
                         <button onClick={() => setDeletingFixedService(fs)} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                           <Trash2 className="w-5 h-5" />
                         </button>
                      </div>
                   </div>
                 ))}
              </div>
            </div>

            {/* Category: Úkony */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center">
                      <Clock className="w-8 h-8 text-amber-600" />
                  </div>
                  <div>
                      <h3 className="text-2xl font-black text-slate-900">Servisní úkony</h3>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Hodinové a úkolové sazby (ceny bez DPH)</p>
                  </div>
                </div>
                <button onClick={() => addFixedService('úkony')} className="bg-amber-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-amber-700 shadow-lg shadow-amber-200 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Nový úkon
                </button>
              </div>

              <div className="space-y-3">
                 {fixedServices.filter(s => s.category === 'úkony').map(fs => (
                   <div key={fs.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-amber-200 transition-all group">
                      <div className="md:col-span-5">
                         <input 
                           placeholder="Název úkonu"
                           className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500"
                           value={fs.name}
                           onChange={e => updateFixedService(fs.id, 'name', e.target.value)}
                         />
                      </div>
                      <div className="md:col-span-2">
                         <div className="relative">
                            <input 
                              type="number"
                              placeholder="Náklad"
                              className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-red-500 text-red-600"
                              value={fs.costPrice || ''}
                              onChange={e => updateFixedService(fs.id, 'costPrice', parseFloat(e.target.value) || 0)}
                            />
                         </div>
                      </div>
                      <div className="md:col-span-2">
                         <div className="relative">
                            <input 
                              type="number"
                              placeholder="Prodej"
                              className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500 text-amber-600"
                              value={fs.price || ''}
                              onChange={(e) => updateFixedService(fs.id, 'price', parseFloat(e.target.value) || 0)}
                            />
                         </div>
                      </div>
                      <div className="md:col-span-2">
                         <select 
                           className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500 appearance-none"
                           value={fs.unit || 'hod'}
                           onChange={e => updateFixedService(fs.id, 'unit', e.target.value)}
                         >
                           <option value="hod">hod</option>
                           <option value="úkon">úkon</option>
                         </select>
                      </div>
                      <div className="md:col-span-1 flex items-center justify-end">
                         <button onClick={() => setDeletingFixedService(fs)} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                           <Trash2 className="w-5 h-5" />
                         </button>
                      </div>
                   </div>
                 ))}
              </div>
            </div>

            {/* Category: Spotřební materiál */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center">
                      <Tag className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div>
                      <h3 className="text-2xl font-black text-slate-900">Spotřební materiál</h3>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Oleje, kapaliny, drobný materiál (ceny bez DPH)</p>
                  </div>
                </div>
                <button onClick={() => addFixedService('materiál')} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-emerald-700 shadow-lg shadow-emerald-200 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Nový materiál
                </button>
              </div>

              <div className="space-y-3">
                 {fixedServices.filter(s => s.category === 'materiál').map(fs => (
                   <div key={fs.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-all group">
                      <div className="md:col-span-5">
                         <input 
                           placeholder="Název materiálu"
                           className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                           value={fs.name}
                           onChange={e => updateFixedService(fs.id, 'name', e.target.value)}
                         />
                      </div>
                      <div className="md:col-span-2">
                         <div className="relative">
                            <input 
                              type="number"
                              placeholder="Nákup"
                              className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-red-500 text-red-600"
                              value={fs.costPrice || ''}
                              onChange={e => updateFixedService(fs.id, 'costPrice', parseFloat(e.target.value) || 0)}
                            />
                         </div>
                      </div>
                      <div className="md:col-span-2">
                         <div className="relative">
                            <input 
                              type="number"
                              placeholder="Prodej"
                              className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-emerald-600"
                              value={fs.price || ''}
                              onChange={(e) => updateFixedService(fs.id, 'price', parseFloat(e.target.value) || 0)}
                            />
                         </div>
                      </div>
                      <div className="md:col-span-2">
                         <select 
                           className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                           value={fs.unit || 'ks'}
                           onChange={e => updateFixedService(fs.id, 'unit', e.target.value)}
                         >
                           {UNITS.filter(u => u !== 'hod').map(u => <option key={u} value={u}>{u}</option>)}
                         </select>
                      </div>
                      <div className="md:col-span-1 flex items-center justify-end">
                         <button onClick={() => setDeletingFixedService(fs)} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                           <Trash2 className="w-5 h-5" />
                         </button>
                      </div>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                      <Layout className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                      <h3 className="text-2xl font-black text-slate-900">Šablony oprav</h3>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Texty pro automatické vkládání do zakázek</p>
                  </div>
                </div>
                <button onClick={addTemplate} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-slate-800 shadow-lg flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Nová šablona
                </button>
              </div>

              <div className="space-y-6">
                 {predefinedTasks.map(pt => (
                   <div key={pt.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4 group">
                      <div className="flex items-center justify-between gap-4">
                         <input 
                           placeholder="Název šablony (např. Garanční prohlídka)"
                           className="flex-1 bg-white border-none rounded-xl px-5 py-3 font-black text-sm outline-none focus:ring-2 focus:ring-blue-500"
                           value={pt.label}
                           onChange={e => updateTemplate(pt.id, 'label', e.target.value)}
                         />
                         <button onClick={() => setDeletingTemplate(pt)} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                           <Trash2 className="w-5 h-5" />
                         </button>
                      </div>
                      <textarea 
                        rows={3}
                        placeholder="Detailní popis úkonů, které se vloží do zakázky..."
                        className="w-full bg-white border-none rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
                        value={pt.description}
                        onChange={e => updateTemplate(pt.id, 'description', e.target.value)}
                      />
                   </div>
                 ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats_config' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                      <BarChart3 className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                      <h3 className="text-2xl font-black text-slate-900">Režijní náklady</h3>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Konfigurace fixních a variabilních výdajů pro výpočet zisku</p>
                  </div>
                </div>
                <button onClick={addCostItem} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-slate-800 shadow-lg flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Přidat výdaj
                </button>
              </div>

              <div className="space-y-3">
                 {(statsSettings.costItems || []).map(item => (
                   <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-red-200 transition-all group">
                      <div className="md:col-span-4">
                         <input 
                           placeholder="Název nákladu (např. Nájem)"
                           className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                           value={item.name}
                           onChange={e => updateCostItem(item.id, 'name', e.target.value)}
                         />
                      </div>
                      <div className="md:col-span-2">
                         <input 
                           type="number"
                           placeholder="Částka"
                           className="w-full bg-white border-none rounded-xl px-4 py-3 font-black text-sm outline-none focus:ring-2 focus:ring-red-500 text-red-600"
                           value={item.amount || ''}
                           onChange={e => updateCostItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                         />
                      </div>
                      <div className="md:col-span-3">
                         <select 
                           className="w-full bg-white border-none rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 appearance-none uppercase"
                           value={item.category}
                           onChange={e => updateCostItem(item.id, 'category', e.target.value as CostCategory)}
                         >
                           {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                         </select>
                      </div>
                      <div className="md:col-span-2 flex items-center gap-2">
                         <button 
                           onClick={() => updateCostItem(item.id, 'isRecurring', !item.isRecurring)}
                           className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${item.isRecurring ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 hover:bg-slate-100'}`}
                         >
                           {item.isRecurring ? 'Měsíčně' : 'Jednoráz.'}
                         </button>
                      </div>
                      <div className="md:col-span-1 flex items-center justify-end">
                         <button onClick={() => removeCostItem(item.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                           <Trash2 className="w-5 h-5" />
                         </button>
                      </div>
                   </div>
                 ))}
                 {(statsSettings.costItems || []).length === 0 && (
                   <div className="py-20 text-center flex flex-col items-center">
                      <Coins className="w-12 h-12 text-slate-200 mb-4" />
                      <p className="text-slate-400 font-bold italic">Zatím nebyly definovány žádné režijní náklady.</p>
                   </div>
                 )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shops' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <ShoppingCart className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Moje E-shopy</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Správa dodavatelů dílů</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userShops.map((shop) => (
                  <div key={shop.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 group hover:border-blue-200 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                        <Globe className="w-6 h-6 text-slate-400" />
                      </div>
                      <div>
                        <span className="font-black text-slate-900 uppercase italic tracking-tight">{shop.name}</span>
                        <p className="text-[10px] font-bold text-slate-400 truncate max-w-[200px]">{shop.url}</p>
                      </div>
                    </div>
                    <button onClick={() => removeShop(shop.id)} className="p-3 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 bg-white rounded-xl shadow-sm">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="max-w-xl pt-8 border-t border-slate-50">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-4">Přidat nový e-shop</h4>
                <div className="space-y-4">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Název</label>
                         <input 
                           type="text" 
                           placeholder="Název (např. Auto Kelly)"
                           className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold"
                           value={newShopName}
                           onChange={e => setNewShopName(e.target.value)}
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">URL adresa</label>
                         <input 
                           type="text" 
                           placeholder="www.eshop.cz"
                           className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold"
                           value={newShopUrl}
                           onChange={e => setNewShopUrl(e.target.value)}
                         />
                      </div>
                   </div>
                   <button 
                     onClick={handleAddShop} 
                     className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
                   >
                     <Plus className="w-4 h-4" /> PŘIDAT E-SHOP
                   </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <Calendar className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Google Kalendář</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Konfigurace OAuth 2.0 integrace</p>
                  </div>
                </div>
                <button 
                  onClick={handleSaveGoogleConfig}
                  className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all flex items-center gap-2 shadow-sm ${
                    googleSaveStatus === 'saved' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {googleSaveStatus === 'saved' ? <CheckCircle2 className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                  {googleSaveStatus === 'saved' ? 'ULOŽENO' : 'ULOŽIT KONFIGURACI'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Google Client ID</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold font-mono text-xs"
                    value={googleClientId} 
                    onChange={e => setGoogleClientId(e.target.value)} 
                    placeholder="Vložte Google Client ID..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Google Client Secret</label>
                  <input 
                    type="password" 
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold font-mono tracking-widest transition-all"
                    value={googleClientSecret} 
                    onChange={e => setGoogleClientSecret(e.target.value)} 
                    placeholder="Vložte Google Client Secret..."
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-xs font-medium text-blue-700 leading-relaxed">
                  Tyto údaje získáte v <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="font-bold underline">Google Cloud Console</a>. 
                  Ujistěte se, že máte povolenou <b>Google Calendar API</b> a nastavenou Redirect URI na <code>http://127.0.0.1:3002</code>.
                </div>
              </div>

              <div className="pt-8 border-t border-slate-50 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                      <Mail className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 uppercase">Filtr dodavatelů e-mailu</h3>
                      <p className="text-slate-400 text-xs font-bold">Povolené e-maily pro aktivaci chytré analýzy dodacích listů</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`${emailFilterSaveStatus === 'saved' ? 'opacity-100' : 'opacity-0'} transition-opacity flex items-center gap-1 text-emerald-600 font-bold text-[10px] uppercase`}>
                      <CheckCircle2 className="w-3 h-3" /> Uloženo
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allowedEmailFilters.map((email, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-purple-200 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                            <Mail className="w-5 h-5 text-slate-400" />
                          </div>
                          <span className="font-bold text-slate-900">{email}</span>
                        </div>
                        <button onClick={() => removeEmailFilter(email)} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="max-w-md pt-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Přidat e-mail dodavatele</label>
                    <div className="flex gap-2 mt-2">
                      <input 
                        type="email" 
                        placeholder="např. dily@dodavatel.cz"
                        className="flex-1 px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none font-bold"
                        value={newEmailFilter}
                        onChange={e => setNewEmailFilter(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addEmailFilter()}
                      />
                      <button onClick={addEmailFilter} className="bg-slate-900 text-white px-6 rounded-2xl font-black text-xs uppercase hover:bg-slate-800 transition-all flex items-center gap-2">
                        <Plus className="w-4 h-4" /> PŘIDAT
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-2 italic leading-relaxed">
                      Zadejte celé e-mailové adresy dodavatelů, od kterých chcete přijímat dodací listy přímo do systému.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* P2P Sekce */}
        {activeTab === 'p2p' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <Printer className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Síťová synchronizace (P2P)</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Sdílení dat mezi více počítači v lokální síti</p>
                  </div>
                </div>
                <button 
                  onClick={handleSaveP2PSettings}
                  className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all flex items-center gap-2 shadow-sm ${
                    p2pSaveStatus === 'saved' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {p2pSaveStatus === 'saved' ? <CheckCircle2 className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                  {p2pSaveStatus === 'saved' ? 'ULOŽENO' : 'ULOŽIT SÍŤOVÉ NASTAVENÍ'}
                </button>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setP2pMode('off')}
                    className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-4 ${p2pMode === 'off' ? 'border-slate-500 bg-slate-50 text-slate-700 shadow-lg' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
                  >
                    <WifiOff className={`w-8 h-8 ${p2pMode === 'off' ? 'text-slate-600' : 'text-slate-300'}`} />
                    <span className="font-black text-[10px] uppercase tracking-widest">VYPNUTO</span>
                  </button>
                  <button
                    onClick={() => setP2pMode('server')}
                    className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-4 ${p2pMode === 'server' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
                  >
                    <Database className={`w-8 h-8 ${p2pMode === 'server' ? 'text-blue-600' : 'text-slate-300'}`} />
                    <span className="font-black text-[10px] uppercase tracking-widest">HLAVNÍ PC (SERVER)</span>
                  </button>
                  <button
                    onClick={() => setP2pMode('client')}
                    className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-4 ${p2pMode === 'client' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-lg' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
                  >
                    <Layout className={`w-8 h-8 ${p2pMode === 'client' ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <span className="font-black text-[10px] uppercase tracking-widest">VEDLEJŠÍ PC (KLIENT)</span>
                  </button>
                </div>

                <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 italic font-medium text-slate-600">
                  {p2pMode === 'off' && (
                    <p className="flex items-center gap-3">
                      <Info className="w-5 h-5 text-slate-400" />
                      Síťová synchronizace je vypnutá. Aplikace pracuje pouze s lokálními daty.
                    </p>
                  )}
                  {p2pMode === 'server' && (
                    <div className="space-y-4 not-italic">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <p className="font-bold text-slate-900">Tento počítač funguje jako síťový server na portu 3003.</p>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed uppercase font-black">
                        Pokračujte v práci, server běží na pozadí.
                      </p>
                    </div>
                  )}
                  {p2pMode === 'client' && (
                    <div className="space-y-4 not-italic">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IP adresa hlavního počítače</label>
                        <input 
                          type="text" 
                          placeholder="Např. 192.168.1.15"
                          className="w-full px-5 py-4 bg-white border-2 border-slate-200 focus:border-emerald-500 rounded-2xl outline-none font-bold font-mono tracking-tight transition-all"
                          value={p2pServerIp}
                          onChange={e => setP2pServerIp(e.target.value)}
                        />
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed uppercase font-black">
                        POZOR: Pro správné fungování musí oba počítače běžet ve stejné lokální síti na portu 3003.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Lokální síťový Mobilní příjem */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-400">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <Smartphone className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Mobilní příjem přes lokální síť</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Bezdrátový síťový přenos a automatické zakládání spolehlivě přes Wi-Fi</p>
                  </div>
                </div>
                <button 
                  onClick={handleSaveP2PSettings}
                  className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all flex items-center gap-2 shadow-sm ${
                    p2pSaveStatus === 'saved' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {p2pSaveStatus === 'saved' ? <CheckCircle2 className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                  {p2pSaveStatus === 'saved' ? 'ULOŽENO' : 'ULOŽIT SÍŤOVÉ NASTAVENÍ'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-8 bg-blue-50/50 rounded-[2rem] border border-blue-100/50 flex flex-col justify-center space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse shrink-0"></div>
                    <span className="font-extrabold text-sm text-blue-900 uppercase tracking-wider">Aktivní Síťová Služba (Port 3003)</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-bold">
                    Služba příjmu je aktivní. V mobilní aplikaci zadejte IP adresu tohoto PC: <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono font-black">{localPcIp}</code> a port <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono font-black">3003</code>.
                  </p>
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
                    * Pro úspěšný přenos musí být telefon i počítač připojené na stejnou Wi-Fi síť.
                  </p>
                </div>

                <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col justify-center space-y-3">
                  <span className="font-extrabold text-xs text-slate-700 uppercase tracking-wider block">Odpis zbytečných COM portů</span>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    Bluetooth COM rozhraní bylo plně nahrazeno stabilnějším a rychlejším síťovým HTTP protokolem (Fetch API), což předchází potížím s blokováním virtuálních portů ve Windows.
                  </p>
                </div>
              </div>

               {/* Dělící čára pro Bluetooth trenažér */}
               <div className="border-t border-slate-100 pt-8 mt-8">
                 <div className="flex flex-col gap-6">
                   <div>
                     <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                       <Smartphone className="w-5 h-5 text-blue-600 animate-pulse" />
                       Interaktivní trenažér mobilní aplikace "Autoservis Příjem"
                     </h4>
                     <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                       Otestujte dvousměrný síťový Wi-Fi přenos z mobilu do PC přímo v našem rozhraní
                     </p>
                   </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Levé info & Návod */}
                    <div className="lg:col-span-5 space-y-6">
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                        <span className="bg-slate-900 text-white font-black text-[9px] px-2.5 py-1 rounded-[6px] tracking-wider uppercase">
                          Jak to funguje?
                        </span>
                        <ul className="space-y-3 font-semibold text-xs text-slate-600 list-disc list-inside">
                          <li>Mobilní mechanik pracuje offline přímo u auta na dvoře.</li>
                          <li>Zadá stav km, vybere <strong className="text-slate-800">palivo v 10% krocích</strong> a zkontroluje výbavu.</li>
                          <li>Po kliknutí na modré tlačítko naši simulátoři vygenerují validní JSON balíček.</li>
                          <li>Zprávu okamžitě zachytí náš PC program na pozadí, přehraje <strong className="text-blue-600">příchozí chodbový tón</strong> a otevře předvyplněný zakázkový list.</li>
                        </ul>
                      </div>

                      <div className="p-6 bg-blue-50/30 rounded-3xl border border-blue-100/50 space-y-3">
                        <span className="text-[10px] font-black text-blue-900 uppercase tracking-wider block">
                          📂 Zdrojový kód pro Android (.apk)
                        </span>
                        <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                          Kompletní kód pro tuto mobilní aplikaci jsme již plně připravili a uložili do vašeho pracovního adresáře jako <code className="font-mono bg-blue-100/50 px-1 py-0.5 rounded text-blue-800">mobile_app_expo.txt</code>. Můžete ho okamžitě zkopírovat, spustit v Expo / React Native a vygenerovat <code className="font-mono">.apk</code> pro Váš Android telefon.
                        </p>
                      </div>
                    </div>

                    {/* Pravý sloupec - Simulátor telefonu */}
                    <div className="lg:col-span-7 flex justify-center">
                      <div className="w-full max-w-[400px] bg-slate-950 rounded-[3rem] p-4.5 pt-11 pb-11 shadow-2xl relative border-4 border-slate-800">
                        {/* Kamera / Reproduktor telefonu nahoře */}
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-32 h-5 bg-slate-800 rounded-full flex items-center justify-center gap-1.5 px-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-900"></div>
                          <div className="flex-1 h-1 bg-slate-900 rounded-full"></div>
                        </div>

                        {/* Displej telefonu */}
                        <div className="bg-slate-50 rounded-[2.2rem] overflow-hidden flex flex-col font-sans text-slate-900 select-none border border-slate-800" style={{ minHeight: '620px' }}>
                          {/* Mobilní záhlaví */}
                          <div className="bg-slate-900 px-4 py-4.5 flex flex-col items-center border-b border-slate-800">
                            <span className="text-white font-black text-[13px] tracking-wider uppercase">AUTOSERVIS PŘÍJEM</span>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">OFFLINE KARTOTÉKA</span>
                            </div>
                          </div>

                          {/* Vnitřek mobilní aplikace */}
                          <div className="flex-1 overflow-y-auto p-4 space-y-5" style={{ maxHeight: '480px' }}>
                            {/* 1. Výběr vozu */}
                            <div className="bg-white rounded-2xl p-4.5 border border-slate-100 shadow-sm space-y-3">
                              <span className="font-black text-[10px] text-slate-400 uppercase tracking-widest block font-sans">
                                1. Vyhledání vozu na dvoře
                              </span>

                              <input
                                type="text"
                                placeholder="Hledat SPZ, model, klienta..."
                                className="w-full px-4.5 py-3 bg-slate-50 border-2 border-slate-100 text-xs font-bold rounded-xl outline-none focus:border-blue-500 transition-all placeholder:text-slate-400"
                                value={simQuery}
                                onChange={e => {
                                  setSimQuery(e.target.value);
                                  if (!e.target.value) {
                                    // reset selection
                                  }
                                }}
                              />

                              {/* Podoba nalezených výsledků */}
                              {simQuery.trim() !== '' && (
                                <div className="bg-slate-50 rounded-xl border border-slate-100 p-1.5 max-h-[150px] overflow-y-auto space-y-1">
                                  {vehicles.filter(v => {
                                    const c = customers.find(cust => cust.id === v.customerId);
                                    const owner = c ? `${c.firstName} ${c.lastName} ${c.companyName || ''}`.toLowerCase() : '';
                                    const q = simQuery.toLowerCase();
                                    return v.licensePlate.toLowerCase().includes(q) ||
                                           v.make.toLowerCase().includes(q) ||
                                           v.model.toLowerCase().includes(q) ||
                                           owner.includes(q);
                                  }).slice(0, 5).map(veh => {
                                    const c = customers.find(cust => cust.id === veh.customerId);
                                    return (
                                      <button
                                        key={veh.id}
                                        type="button"
                                        onClick={() => {
                                          setSimSelectedVehicle(veh);
                                          setSimIsManual(false);
                                          setSimQuery('');
                                        }}
                                        className="w-full text-left p-2 hover:bg-white rounded-lg flex items-center justify-between text-[11px] font-bold border border-transparent hover:border-slate-100 transition-all"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="text-slate-800 font-extrabold truncate">{veh.make} {veh.model}</div>
                                          <div className="text-slate-400 text-[9px] truncate">Majitel: {c ? `${c.firstName} ${c.lastName}` : 'Neznámý'}</div>
                                        </div>
                                        <span className="bg-slate-900 text-white font-black px-2 py-0.5 rounded text-[10px] tracking-tight shrink-0 ml-2">
                                          {veh.licensePlate}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {simSelectedVehicle ? (
                                <div className="bg-blue-50 rounded-xl border border-blue-100 p-3 flex justify-between items-center">
                                  <div className="min-w-0">
                                    <span className="text-[9px] text-blue-600 font-black uppercase tracking-wider block">VYBRANÝ VŮZ</span>
                                    <span className="text-xs font-black text-blue-950 truncate block">
                                      {simSelectedVehicle.make} {simSelectedVehicle.model}
                                    </span>
                                    <span className="text-[10px] text-blue-500 font-bold block">{simSelectedVehicle.licensePlate}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSimSelectedVehicle(null)}
                                    className="bg-blue-100 text-blue-600 hover:bg-blue-200 p-1.5 rounded-lg text-[10px] font-black uppercase transition-all"
                                  >
                                    Zrušit
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSimSelectedVehicle(null);
                                    setSimIsManual(!simIsManual);
                                  }}
                                  className={`w-full py-2.5 rounded-xl text-xs font-black transition-all ${
                                    simIsManual 
                                      ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-300' 
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-slate-100'
                                  }`}
                                >
                                  {simIsManual ? '✓ RUČNÍ PŘÍJEM INTEGRACE AKTIVNÍ' : '➕ RUČNÍ PŘÍJEM (NOVÝ VŮZ)'}
                                </button>
                              )}

                              {simIsManual && !simSelectedVehicle && (
                                <div className="space-y-2 border-t border-slate-100 pt-3">
                                  <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-0.5 mb-1">STÁTNÍ POZNÁVACÍ ZNAČKA *</label>
                                    <input
                                      type="text"
                                      placeholder="Např. 3AI 5595"
                                      className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-lg text-xs font-extrabold uppercase placeholder:text-slate-300"
                                      value={simPlate}
                                      onChange={e => setSimPlate(e.target.value)}
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-0.5 mb-1">Značka</label>
                                      <input
                                        type="text"
                                        placeholder="Např. Škoda"
                                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-lg text-xs font-bold"
                                        value={simMake}
                                        onChange={e => setSimMake(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-0.5 mb-1">Model</label>
                                      <input
                                        type="text"
                                        placeholder="Např. Octavia"
                                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-lg text-xs font-bold"
                                        value={simModel}
                                        onChange={e => setSimModel(e.target.value)}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* 2. Kilometry */}
                            <div className="bg-white rounded-2xl p-4.5 border border-slate-100 shadow-sm space-y-2">
                              <span className="font-black text-[10px] text-slate-400 uppercase tracking-widest block">
                                2. Stav Kilometrů (km)
                              </span>
                              <input
                                type="number"
                                placeholder="Zadejte stav km..."
                                className="w-full px-4.5 py-3 bg-slate-50 border-2 border-slate-100 text-sm font-black rounded-xl text-center"
                                value={simKm}
                                onChange={e => setSimKm(e.target.value)}
                              />
                            </div>

                            {/* 3. Stav Paliva - 10% Kroky */}
                            <div className="bg-white rounded-2xl p-4.5 border border-slate-100 shadow-sm space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="font-black text-[10px] text-slate-400 uppercase tracking-widest">
                                  3. Stav Paliva (PHM)
                                </span>
                                <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-lg">
                                  {simFuel}
                                </span>
                              </div>

                              {/* Grid 10% tlačítek */}
                              <div className="grid grid-cols-4 gap-1.5">
                                {['0%', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'].map(step => (
                                  <button
                                    key={step}
                                    type="button"
                                    onClick={() => setSimFuel(step)}
                                    className={`py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                                      simFuel === step 
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/50'
                                    }`}
                                  >
                                    {step}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 4. Checklist Výbavy */}
                            <div className="bg-white rounded-2xl p-4.5 border border-slate-100 shadow-sm space-y-3">
                              <span className="font-black text-[10px] text-slate-400 uppercase tracking-widest block">
                                4. Checklist Povinné výbavy
                              </span>

                              <div className="space-y-1.5 text-xs font-bold text-slate-700">
                                {[
                                  { key: 'spareTyre', label: 'Rezerva' },
                                  { key: 'securityKey', label: 'Bezpečnostní klíč kola' },
                                  { key: 'jack', label: 'Zvedák' },
                                  { key: 'triangle', label: 'Trojúhelník' },
                                  { key: 'wheelWrench', label: 'Klíč kolový' },
                                  { key: 'firstAid', label: 'Lékárna' },
                                  { key: 'tyreKit', label: 'Sada na lepení pneu' }
                                ].map(item => (
                                  <label key={item.key} className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition-all cursor-pointer">
                                    <span>{item.label}</span>
                                    <input
                                      type="checkbox"
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                                      checked={(simEquipment as any)[item.key]}
                                      onChange={() => {
                                        setSimEquipment(prev => ({
                                          ...prev,
                                          [item.key]: !(prev as any)[item.key]
                                        }));
                                      }}
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* 5. Rozsah opravy */}
                            <div className="bg-white rounded-2xl p-4.5 border border-slate-100 shadow-sm space-y-2">
                              <span className="font-black text-[10px] text-slate-400 uppercase tracking-widest block">
                                5. Rozsah opravy (Závady)
                              </span>
                              <textarea
                                placeholder="Závady zjištěné na dvoře..."
                                rows={3}
                                className="w-full p-3 bg-slate-50 border-2 border-slate-100 text-[11px] font-bold rounded-xl outline-none focus:border-blue-500 transition-all placeholder:text-slate-300 resize-none"
                                value={simNotes}
                                onChange={e => setSimNotes(e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Spodní mobilní tlačítko Odeslat přes BT */}
                          <div className="p-4 bg-white border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => {
                                const plate = simSelectedVehicle ? simSelectedVehicle.licensePlate : simPlate;
                                if (!plate || plate.trim() === '') {
                                  alert('Prosím uveďte SPZ vozu.');
                                  return;
                                }

                                const completePayload = {
                                  vehicleId: simSelectedVehicle ? simSelectedVehicle.id : null,
                                  licensePlate: plate.toUpperCase(),
                                  make: simSelectedVehicle ? simSelectedVehicle.make : simMake || 'Neznámá',
                                  model: simSelectedVehicle ? simSelectedVehicle.model : simModel || 'Neznámý',
                                  mileage: parseInt(simKm, 10) || 0,
                                  fuelLevel: simFuel,
                                  equipment: simEquipment,
                                  notes: simNotes || 'Výměna oleje a filtrů...'
                                };

                                // Dispatch simulated checkin event
                                const testEvent = new CustomEvent('simulated-mobile-checkin', { detail: completePayload });
                                window.dispatchEvent(testEvent);

                                // If electron is present on desktop, we can also push through
                                if ((window as any).electronAPI?.bluetooth) {
                                  // Just to keep electron pipeline consistent
                                }

                                // Reset simulation input
                                setSimQuery('');
                                setSimKm('');
                                setSimNotes('');
                              }}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-[1.3rem] font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                            >
                              <span>⚡ ODESLAT DO PC PŘES LOKÁLNÍ SÍŤ</span>
                            </button>
                          </div>
                        </div>

                        {/* Spodní domovské tlačítko telefonu */}
                        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 w-24 h-1.5 bg-slate-800 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>


            {/* Lokální koš (Skryté položky) */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                    <Trash2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Lokální koš (Skryté položky)</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Obnovení dat skrytých pouze na tomto PC</p>
                  </div>
                </div>
                
                <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl w-fit">
                  <button
                    onClick={() => setTrashTab('customers')}
                    className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${
                      trashTab === 'customers' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Skrytí Zákazníci
                  </button>
                  <button
                    onClick={() => setTrashTab('vehicles')}
                    className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${
                      trashTab === 'vehicles' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Skrytá Vozidla
                  </button>
                </div>
              </div>

              <div className="border border-slate-100 rounded-[2rem] overflow-hidden bg-white">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Informace</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Akce</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {trashTab === 'customers' ? (
                      customers.filter(c => c.localHidden).length > 0 ? (
                        customers.filter(c => c.localHidden).map(customer => (
                          <tr key={customer.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-8 py-6">
                              <div className="font-bold text-slate-900">{customer.firstName} {customer.lastName}{customer.companyName ? ` (${customer.companyName})` : ''}</div>
                              <div className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-tight">{customer.phone}</div>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <button
                                onClick={() => onRestoreCustomer(customer.id)}
                                className="inline-flex items-center gap-2 px-5 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                              >
                                <RefreshCcw className="w-3.5 h-3.5" />
                                OBNOVIT
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="px-8 py-16 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <CheckCircle2 className="w-10 h-10 text-slate-100" />
                              <span className="text-slate-300 text-xs font-bold uppercase tracking-widest">Žádní skrytí zákazníci</span>
                            </div>
                          </td>
                        </tr>
                      )
                    ) : (
                      vehicles.filter(v => v.localHidden).length > 0 ? (
                        vehicles.filter(v => v.localHidden).map(vehicle => (
                          <tr key={vehicle.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-8 py-6">
                              <div className="font-bold text-slate-900">{vehicle.make} {vehicle.model}</div>
                              <div className="text-xs text-slate-400 font-black mt-1 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-lg w-fit">{vehicle.licensePlate}</div>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <button
                                onClick={() => onRestoreVehicle(vehicle.id)}
                                className="inline-flex items-center gap-2 px-5 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                              >
                                <RefreshCcw className="w-3.5 h-3.5" />
                                OBNOVIT
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="px-8 py-16 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <CheckCircle2 className="w-10 h-10 text-slate-100" />
                              <span className="text-slate-300 text-xs font-bold uppercase tracking-widest">Žádná skrytá vozidla</span>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <Bell className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-900">Upozornění</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Nastavení limitů pro servisní varování</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                   <div className="flex items-center gap-3 text-slate-900">
                      <ShieldCheck className="w-6 h-6 text-blue-600" />
                      <h4 className="font-black uppercase text-sm tracking-tight">Limit pro STK</h4>
                   </div>
                   <p className="text-xs text-slate-500 font-medium">Počet dní před vypršením platnosti STK, kdy se vozidlo zobrazí jako varování na nástěnce.</p>
                   <div className="flex items-center gap-4 pt-2">
                      <input 
                        type="range" min="5" max="90" step="5"
                        className="flex-1 h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        value={notifSettings.stkThresholdDays}
                        onChange={e => onNotifSettingsChange({...notifSettings, stkThresholdDays: parseInt(e.target.value)})}
                      />
                      <span className="w-16 text-center font-black text-blue-600 text-lg">{notifSettings.stkThresholdDays} d</span>
                   </div>
                </div>

                <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                   <div className="flex items-center gap-3 text-slate-900">
                      <Wrench className="w-6 h-6 text-blue-600" />
                      <h4 className="font-black uppercase text-sm tracking-tight">Servisní prohlídka</h4>
                   </div>
                   <p className="text-xs text-slate-500 font-medium">Počet dní před plánovaným servisem, kdy bot začne varovat mechanika.</p>
                   <div className="flex items-center gap-4 pt-2">
                      <input 
                        type="range" min="1" max="60" step="1"
                        className="flex-1 h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        value={notifSettings.serviceThresholdDays}
                        onChange={e => onNotifSettingsChange({...notifSettings, serviceThresholdDays: parseInt(e.target.value)})}
                      />
                      <span className="w-16 text-center font-black text-blue-600 text-lg">{notifSettings.serviceThresholdDays} d</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sms' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <MessageSquare className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase">SMS Komunikace</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Nastavení BulkGate API a šablon zpráv</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h4 className="font-black text-slate-900 uppercase text-sm border-b border-slate-50 pb-4">API Konfigurace (BulkGate)</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Application ID</label>
                      <input 
                        type="password" 
                        className={`w-full px-5 py-4 bg-slate-50 border-2 rounded-2xl outline-none font-bold tracking-widest transition-all ${!smsSettings.applicationId ? 'border-red-200' : 'border-transparent focus:border-blue-500'}`}
                        value={smsSettings.applicationId || ''} 
                        onChange={e => onSmsSettingsChange({...smsSettings, applicationId: e.target.value})} 
                        placeholder="Vložte BulkGate Application ID"
                      />
                      {!smsSettings.applicationId && (
                        <p className="text-[9px] text-red-500 font-black mt-1 uppercase flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="w-3 h-3" /> API ID chybí
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Application Token</label>
                      <input 
                        type="password" 
                        className={`w-full px-5 py-4 bg-slate-50 border-2 rounded-2xl outline-none font-bold tracking-widest transition-all ${!smsSettings.applicationToken ? 'border-red-200' : 'border-transparent focus:border-blue-500'}`}
                        value={smsSettings.applicationToken || ''} 
                        onChange={e => onSmsSettingsChange({...smsSettings, applicationToken: e.target.value})} 
                        placeholder="Vložte BulkGate Application Token"
                      />
                      {!smsSettings.applicationToken && (
                        <p className="text-[9px] text-red-500 font-black mt-1 uppercase flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="w-3 h-3" /> Token chybí
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Odesílatele (Sender ID)</label>
                      <input 
                        type="text" 
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold uppercase" 
                        value={smsSettings.senderId || ''} 
                        onChange={e => onSmsSettingsChange({...smsSettings, senderId: e.target.value.substring(0, 11)})} 
                        placeholder="NÁZEV FIRMY"
                        maxLength={11}
                      />
                      <p className="text-[9px] text-slate-400 font-bold ml-1 uppercase">Max. 11 znaků. Zobrazí se příjemci jako jméno odesílatele.</p>
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-amber-800 leading-relaxed uppercase">
                      API klíče jsou bezpečně uloženy pouze ve vašem prohlížeči. Pro používání BulkGate HTTP Advanced API musíte mít vytvořenou aplikaci v BulkGate portálu.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="font-black text-slate-900 uppercase text-sm border-b border-slate-50 pb-4">Šablony zpráv</h4>
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Upozornění na STK</label>
                       <textarea 
                         rows={4}
                         className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-medium text-sm resize-none leading-relaxed"
                         value={smsSettings.stkTemplate}
                         onChange={e => onSmsSettingsChange({...smsSettings, stkTemplate: e.target.value})}
                       />
                       <p className="text-[9px] text-slate-400 font-bold ml-1">
                         Proměnné: <span className="text-blue-600">{"{SPZ}"}</span>, <span className="text-blue-600">{"{datum_stk}"}</span>, <span className="text-blue-600">{"{JmenoServisu}"}</span>, <span className="text-blue-600">{"{Telefon}"}</span>
                       </p>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Olejový servis</label>
                       <textarea 
                         rows={4}
                         className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-medium text-sm resize-none leading-relaxed"
                         value={smsSettings.oilTemplate}
                         onChange={e => onSmsSettingsChange({...smsSettings, oilTemplate: e.target.value})}
                       />
                       <p className="text-[9px] text-slate-400 font-bold ml-1">
                         Proměnné: <span className="text-blue-600">{"{SPZ}"}</span>, <span className="text-blue-600">{"{JmenoServisu}"}</span>, <span className="text-blue-600">{"{Telefon}"}</span>
                       </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'backups' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <Database className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-900">Zálohování a údržba</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Export a import kompletních dat aplikace</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 space-y-6">
                   <h4 className="font-black uppercase text-xs tracking-[0.2em] text-slate-400 flex items-center gap-2">
                      <DownloadCloud className="w-4 h-4" /> Kompletní Export
                   </h4>
                   <p className="text-sm text-slate-500 font-medium leading-relaxed">Stáhne veškerá data (zákazníky, vozidla, servisní intervaly, zakázky, faktury, nastavení a historii) do jednoho JSON souboru.</p>
                   <button onClick={onExportData} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200">
                      <DownloadCloud className="w-5 h-5" />
                      STÁHNOUT ZÁLOHU (JSON)
                   </button>
                </div>

                <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 space-y-6">
                   <h4 className="font-black uppercase text-xs tracking-[0.2em] text-slate-400 flex items-center gap-2">
                      <UploadCloud className="w-4 h-4" /> Kompletní Import
                   </h4>
                   <p className="text-sm text-slate-500 font-medium leading-relaxed">Nahráním záložního souboru (JSON) nahradíte všechna stávající data daty ze zálohy. Akce je nevratná.</p>
                   <label className="w-full py-4 bg-white text-slate-900 border-2 border-slate-200 rounded-2xl font-black text-xs uppercase hover:border-blue-600 transition-all flex items-center justify-center gap-3 cursor-pointer">
                      <UploadCloud className="w-5 h-5 text-blue-600" />
                      NAHRÁT ZÁLOHU (JSON)
                      <input type="file" className="hidden" accept=".json" onChange={handleJSONImport} />
                   </label>
                </div>
              </div>

              <div className="pt-8 border-t border-red-50">
                 <div className="p-8 bg-red-50 rounded-[2rem] border border-red-100 flex flex-col sm:flex-row items-center gap-8">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shrink-0">
                       <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                       <h4 className="font-black text-red-900 uppercase text-sm mb-1 tracking-tight">Kritická akce: Vymazat vše</h4>
                       <p className="text-red-700/60 text-xs font-bold leading-relaxed">Tato akce okamžitě a nenávratně odstraní veškerý obsah systému. Před vymazáním se ujistěte, že máte staženou zálohu.</p>
                    </div>
                    <button onClick={() => setIsClearDataConfirmOpen(true)} className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase hover:bg-red-700 transition-all shadow-xl shadow-red-200">
                       VYMAZAT SYSTÉM
                    </button>
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {restoreConfirmOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Database className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2 uppercase">Obnovit ze zálohy?</h3>
              <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                Tato akce <span className="text-blue-600 font-black">NAHRADÍ VŠECHNA STÁVAJÍCÍ DATA</span> daty ze zálohy. Chcete pokračovat?
              </p>
              <div className="flex gap-3">
                <button onClick={handleCloseModals} className="flex-1 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-xs uppercase">ZRUŠIT</button>
                <button 
                  onClick={() => { onRestoreData(pendingRestoreData); handleCloseModals(); }}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-blue-600/20"
                >
                  ANO, OBNOVIT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isClearDataConfirmOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertOctagon className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2 uppercase">Destruktivní akce</h3>
              <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                Opravdu chcete nenávratně <span className="text-red-600 font-black">VYMAZAT VŠECHNA DATA</span>? Všechny záznamy o klientech a vozidlech budou ztraceny.
              </p>
              <div className="flex gap-3">
                <button onClick={handleCloseModals} className="flex-1 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-xs uppercase">ZRUŠIT</button>
                <button 
                  onClick={() => { onClearAllData(); handleCloseModals(); }}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-600/20"
                >
                  ANO, VYMAZAT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deletingFixedService && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 text-center relative z-10 shadow-2xl">
             <h3 className="text-xl font-black mb-2">Smazat z ceníku?</h3>
             <p className="text-slate-500 mb-8">{deletingFixedService.name}</p>
             <div className="flex gap-3">
                <button onClick={handleCloseModals} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-xs">ZRUŠIT</button>
                <button 
                  onClick={() => { onFixedServicesChange(fixedServices.filter(f => f.id !== deletingFixedService.id)); handleCloseModals(); }}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg"
                >
                  SMAZAT
                </button>
             </div>
          </div>
        </div>
      )}

      {deletingTemplate && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 text-center relative z-10 shadow-2xl">
             <h3 className="text-xl font-black mb-2 uppercase">Smazat šablonu?</h3>
             <p className="text-slate-500 mb-8">{deletingTemplate.label}</p>
             <div className="flex gap-3">
                <button onClick={handleCloseModals} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-xs">ZRUŠIT</button>
                <button 
                  onClick={() => { onPredefinedTasksChange(predefinedTasks.filter(t => t.id !== deletingTemplate.id)); handleCloseModals(); }}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg"
                >
                  SMAZAT
                </button>
             </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar-h::-webkit-scrollbar { height: 4px; }
        .custom-scrollbar-h::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-h::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default Settings;