
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Car, 
  Search,
  Plus,
  Bell,
  LogOut,
  X,
  ClipboardList,
  Settings as SettingsIcon,
  AlertTriangle,
  Calendar,
  Wrench,
  Menu,
  ShieldCheck,
  Receipt,
  Archive,
  BarChart3,
  MessageSquare,
  Calculator,
  ShoppingCart,
  Mail as MailIcon,
  Bluetooth,
  Smartphone
} from 'lucide-react';
import { AppView, Customer, Vehicle, ServiceRecord, CompanyInfo, NotificationSettings, AutoBackupSettings, UserSettings, FixedService, PredefinedTask, Invoice, PartItem, StatsSettings, Task, CalendarEvent, SmsMessage, SmsSettings, Budget, UserShop } from './types';
import Dashboard from './components/Dashboard';
import CustomerManager from './components/CustomerManager';
import VehicleManager from './components/VehicleManager';
import OrderManager from './components/OrderManager';
import Settings from './components/Settings';
import Login from './components/Login';
import InvoiceManager from './components/InvoiceManager';
import ArchiveManager from './components/ArchiveManager';
import StatsManager from './components/StatsManager';
import CalendarManager from './components/CalendarManager';
import CommunicationCenter from './components/CommunicationCenter';
import BudgetManager from './components/BudgetManager';
import EshopManager from './components/EshopManager';
import EmailManager from './components/EmailManager';
import { googleCalendarService } from './services/googleCalendarService';

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', customerType: 'soukromý', firstName: 'Jan', lastName: 'Novák', email: 'jan.novak@email.cz', phone: '+420 777 123 456', address: 'Praha 1, Vodičkova 12', createdAt: '2023-10-01', updatedAt: new Date().toISOString() },
  { id: 'c2', customerType: 'firemní', firstName: 'Petr', lastName: 'Svoboda', email: 'info@autosvoboda.cz', phone: '+420 602 987 654', address: 'Brno, Česká 5', createdAt: '2023-11-15', updatedAt: new Date().toISOString(), companyName: 'Autodoprava Svoboda s.r.o.', companyAddress: 'Průmyslová 102, 602 00 Brno', ico: '12345678', dic: 'CZ12345678' },
];

const INITIAL_VEHICLES: Vehicle[] = [
  { id: 'v1', customerId: 'c1', make: 'Škoda', model: 'Octavia IV', year: 2021, vin: 'TMBGJ7NE3M8123456', licensePlate: '8A2 4567', mileage: 45000, engineCode: 'DSFE (2.0 TDI)', color: 'Modrá Race', lastServiceDate: '2024-01-10', oilChangeDate: '2024-01-10', oilChangeInterval: 12, stkExpirationDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], nextServiceDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], brakeFluidInterval: 24, coolantInterval: 60, gearboxOilInterval: 60, timingBeltInterval: 120, refrigerantInterval: 24, updatedAt: new Date().toISOString() },
  { id: 'v2', customerId: 'c2', make: 'Volkswagen', model: 'Golf 8', year: 2022, vin: 'WVWZZZCDZLW987654', licensePlate: '7B3 1234', mileage: 22000, engineCode: 'DADA (1.5 TSI)', color: 'Šedá Moon', lastServiceDate: '2023-12-05', oilChangeDate: '2023-12-05', oilChangeInterval: 12, stkExpirationDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], nextServiceDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], brakeFluidInterval: 24, coolantInterval: 60, gearboxOilInterval: 60, timingBeltInterval: 120, refrigerantInterval: 24, updatedAt: new Date().toISOString() },
  { id: 'v4', customerId: 'c2', make: 'BMW', model: 'M3 Competition', year: 2023, vin: 'WBS31AR020LM45678', licensePlate: '1AA 0001', mileage: 8500, engineCode: 'S58 (3.0 Bi-Turbo)', color: 'Isle of Man Green', lastServiceDate: '2024-03-01', oilChangeDate: '2024-03-01', oilChangeInterval: 12, stkExpirationDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], nextServiceDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], brakeFluidInterval: 24, coolantInterval: 60, gearboxOilInterval: 60, timingBeltInterval: 120, refrigerantInterval: 24, updatedAt: new Date().toISOString() },
];

const INITIAL_SERVICES: ServiceRecord[] = [
  { 
    id: '24/01/001', 
    vehicleId: 'v1', 
    date: '2024-01-10', 
    description: 'Výměna oleje a filtrů, kontrola brzd', 
    cost: 5350, 
    status: 'hotovo', 
    technician: 'Jan Mechanik',
    laborHours: 2,
    updatedAt: new Date().toISOString(),
    parts: [
      { id: 'p1', description: 'Motorový olej 5W30', quantity: 5, unit: 'l', unitPrice: 450, costPrice: 200 },
      { id: 'p2', description: 'Olejový filtr', quantity: 1, unit: 'ks', unitPrice: 350, costPrice: 120 },
      { id: 'p3', description: 'Vzduchový filtr', quantity: 1, unit: 'ks', unitPrice: 450, costPrice: 180 }
    ]
  },
  { id: '25/02/001', vehicleId: 'v2', date: '2024-05-20', description: 'Garanční prohlídka', cost: 3200, status: 'naplánováno', technician: 'Petr Rychlý', laborHours: 0, updatedAt: new Date().toISOString(), parts: [] },
  { 
    id: '25/02/002', 
    vehicleId: 'v4', 
    date: '2024-05-25', 
    description: 'Výměna brzdových destiček', 
    cost: 13700, 
    status: 'probíhá', 
    technician: 'Marek Šikovný',
    laborHours: 2,
    updatedAt: new Date().toISOString(),
    parts: [
      { id: 'p4', description: 'Brzdové destičky přední (ATE)', quantity: 1, unit: 'sada', unitPrice: 6500, costPrice: 3800 },
      { id: 'p5', description: 'Brzdové destičky zadní (ATE)', quantity: 1, unit: 'sada', unitPrice: 5500, costPrice: 2900 }
    ]
  },
];

const navItems = [
  { id: 'dashboard', label: 'Nástěnka', icon: LayoutDashboard },
  { id: 'orders', label: 'Zakázky', icon: ClipboardList },
  { id: 'eshop', label: 'E-shop', icon: ShoppingCart },
  { id: 'invoices', label: 'Fakturace', icon: Receipt },
  { id: 'vehicles', label: 'Vozidla', icon: Car },
  { id: 'customers', label: 'Zákazníci', icon: Users },
  { id: 'email', label: 'E-mail', icon: MailIcon },
  { id: 'calendar', label: 'Kalendář', icon: Calendar },
  { id: 'communication', label: 'Komunikace', icon: MessageSquare },
  { id: 'budget', label: 'Rozpočet', icon: Calculator },
  { id: 'stats', label: 'Statistiky', icon: BarChart3 },
  { id: 'archive', label: 'Archiv', icon: Archive },
  { id: 'settings', label: 'Nastavení', icon: SettingsIcon },
];

const App: React.FC = () => {
  const [smsMessages, setSmsMessages] = useState<SmsMessage[]>(() => {
    const saved = localStorage.getItem('autoservis-sms');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [smsSettings, setSmsSettings] = useState<SmsSettings>(() => {
    const saved = localStorage.getItem('autoservis-sms-settings');
    return saved ? JSON.parse(saved) : { applicationId: '', applicationToken: '', senderId: '', stkTemplate: 'Dobrý den, Vašemu vozu {SPZ} končí dne {datum_stk} platnost TK. Rezervujte si termín prohlídky včas u nás v {JmenoServisu}. Tel: {Telefon}.', oilTemplate: 'Dobrý den, u vašeho vozidla {SPZ} se blíží termín výměny oleje (nebo uběhlo 11 měsíců). Rádi vás v našem servisu přivítáme.' };
  });

  const [activeView, setActiveView] = useState<AppView>('dashboard');

  const [targetVehicleId, setTargetVehicleId] = useState<string | null>(null);
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);
  const [btNotification, setBtNotification] = useState<{ show: boolean, message: string, licensePlate: string } | null>(null);
  const [targetCustomerId, setTargetCustomerId] = useState<string | null>(null);
  const [pendingOrderData, setPendingOrderData] = useState<Partial<ServiceRecord> | null>(null);
  const [pendingVinSearch, setPendingVinSearch] = useState<string | null>(null);
  const [initialBudgetData, setInitialBudgetData] = useState<Budget | null>(null);
  const [pendingFileForAnalysis, setPendingFileForAnalysis] = useState<{
    fileData: string;
    fileName: string;
    fileType: string;
    orderId: string;
  } | null>(null);

  const handleNavigateToEshop = (vin?: string) => {
    if (vin) {
      setPendingVinSearch(vin);
    }
    setActiveView('eshop');
  };

  const handleClearVinSearch = () => {
    setPendingVinSearch(null);
  };
  const [budgetVehicleId, setBudgetVehicleId] = useState<string | null>(null);
  const [shouldOpenModal, setShouldOpenModal] = useState(false);

  const [customerSearch, setCustomerSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [archiveSearch, setArchiveSearch] = useState('');

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('customers');
    const data = saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
    return data.map((c: any) => ({ ...c, updatedAt: c.updatedAt || new Date().toISOString() }));
  });
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const saved = localStorage.getItem('vehicles');
    const data = saved ? JSON.parse(saved) : INITIAL_VEHICLES;
    return data.map((v: any) => ({ ...v, updatedAt: v.updatedAt || new Date().toISOString() }));
  });
  const [services, setServices] = useState<ServiceRecord[]>(() => {
    const saved = localStorage.getItem('services');
    const data = saved ? JSON.parse(saved) : INITIAL_SERVICES;
    return data.map((s: any) => ({ ...s, updatedAt: s.updatedAt || new Date().toISOString() }));
  });
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('invoices');
    const data = saved ? JSON.parse(saved) : [];
    return data.map((inv: any) => ({ 
      ...inv, 
      uid: inv.uid || `inv-uid-${Math.random().toString(36).substr(2, 9)}`,
      updatedAt: inv.updatedAt || new Date().toISOString()
    }));
  });
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('tasks');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem('calendarEvents');
    return saved ? JSON.parse(saved) : [];
  });

  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const saved = localStorage.getItem('budgets');
    const data = saved ? JSON.parse(saved) : [];
    return data.map((b: any) => ({
      ...b,
      updatedAt: b.updatedAt || new Date().toISOString()
    }));
  });

  const [hourlyRate, setHourlyRate] = useState<number>(() => {
    const saved = localStorage.getItem('hourlyRate');
    return saved ? JSON.parse(saved) : 850;
  });
  const [fixedServices, setFixedServices] = useState<FixedService[]>(() => {
    const saved = localStorage.getItem('fixedServices');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      // Migration: Ensure all items have a category
      let migrated = false;
      const normalized = parsed.map((item: any) => {
        if (!item.category) {
          migrated = true;
          return { ...item, category: 'díly' };
        }
        return item;
      });
      if (migrated) {
        localStorage.setItem('fixedServices', JSON.stringify(normalized));
      }
      return normalized;
    } catch {
      return [];
    }
  });
  const [userShops, setUserShops] = useState<UserShop[]>(() => {
    const saved = localStorage.getItem('user_shops');
    return saved ? JSON.parse(saved) : [
      { id: 'lkq', name: 'LKQ', url: 'https://www.lkq.cz' },
      { id: 'sag', name: 'SAG', url: 'https://www.sag.cz' }
    ];
  });
  const [predefinedTasks, setPredefinedTasks] = useState<PredefinedTask[]>(() => {
    const saved = localStorage.getItem('predefinedTasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [discountLevels, setDiscountLevels] = useState<number[]>(() => {
    const saved = localStorage.getItem('discountLevels');
    return saved ? JSON.parse(saved) : [0, 5, 10, 15, 20, 25, 50];
  });
  const [technicians, setTechnicians] = useState<string[]>(() => {
    const saved = localStorage.getItem('technicians');
    return saved ? JSON.parse(saved) : ['Jan Mechanik', 'Petr Rychlý', 'Marek Šikovný', 'Tomáš Pečlivý'];
  });
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(() => {
    const saved = localStorage.getItem('companyInfo');
    const defaults = {
      name: 'AutoService Pro Praha',
      address: 'Průmyslová 1024/12, 102 00 Praha 10',
      ico: '',
      dic: '',
      phone: '+420 222 333 444',
      email: 'servis@autoservice.pro',
      bankAccount: '',
      isVatPayer: false,
      foundationDate: '2001-02-07'
    };
    try {
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => {
    const saved = localStorage.getItem('notifSettings');
    return saved ? JSON.parse(saved) : {
      stkThresholdDays: 30,
      serviceThresholdDays: 15
    };
  });

  const [statsSettings, setStatsSettings] = useState<StatsSettings>(() => {
    const saved = localStorage.getItem('statsSettings');
    try {
      return saved ? JSON.parse(saved) : { costItems: [] };
    } catch {
      return { costItems: [] };
    }
  });

  const [selectedPrinter, setSelectedPrinter] = useState<string>(() => {
    const saved = localStorage.getItem('selectedPrinter');
    return saved ? JSON.parse(saved) : 'HP LaserJet Pro M404dn (Kancelář)';
  });

  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('userSettings');
    return saved ? JSON.parse(saved) : { enabled: false, username: 'admin', password: '' };
  });
  const [isAuthenticated, setIsAuthenticated] = useState(!userSettings.enabled);

  const [autoBackupSettings, setAutoBackupSettings] = useState<AutoBackupSettings>(() => {
    const saved = localStorage.getItem('autoBackupSettings');
    return saved ? JSON.parse(saved) : { enabled: false, hour: 20, lastBackupDate: null, folderName: null };
  });

  useEffect(() => { localStorage.setItem('customers', JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem('vehicles', JSON.stringify(vehicles)); }, [vehicles]);
  useEffect(() => { localStorage.setItem('services', JSON.stringify(services)); }, [services]);
  useEffect(() => { localStorage.setItem('invoices', JSON.stringify(invoices)); }, [invoices]);
  useEffect(() => { localStorage.setItem('tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('calendarEvents', JSON.stringify(calendarEvents)); }, [calendarEvents]);
  useEffect(() => { localStorage.setItem('budgets', JSON.stringify(budgets)); }, [budgets]);
  useEffect(() => { localStorage.setItem('hourlyRate', JSON.stringify(hourlyRate)); }, [hourlyRate]);
  useEffect(() => { localStorage.setItem('fixedServices', JSON.stringify(fixedServices)); }, [fixedServices]);
  useEffect(() => { localStorage.setItem('predefinedTasks', JSON.stringify(predefinedTasks)); }, [predefinedTasks]);
  useEffect(() => { localStorage.setItem('discountLevels', JSON.stringify(discountLevels)); }, [discountLevels]);
  useEffect(() => { localStorage.setItem('technicians', JSON.stringify(technicians)); }, [technicians]);
  useEffect(() => { localStorage.setItem('companyInfo', JSON.stringify(companyInfo)); }, [companyInfo]);
  useEffect(() => { localStorage.setItem('notifSettings', JSON.stringify(notifSettings)); }, [notifSettings]);
  useEffect(() => { localStorage.setItem('statsSettings', JSON.stringify(statsSettings)); }, [statsSettings]);
  useEffect(() => { localStorage.setItem('selectedPrinter', JSON.stringify(selectedPrinter)); }, [selectedPrinter]);
  useEffect(() => { localStorage.setItem('autoservis-sms', JSON.stringify(smsMessages)); }, [smsMessages]);
  useEffect(() => { localStorage.setItem('autoservis-sms-settings', JSON.stringify(smsSettings)); }, [smsSettings]);
  useEffect(() => { localStorage.setItem('user_shops', JSON.stringify(userShops)); }, [userShops]);

  useEffect(() => { 
    localStorage.setItem('userSettings', JSON.stringify(userSettings));
    if (!userSettings.enabled) {
      setIsAuthenticated(true);
    }
  }, [userSettings]);

  useEffect(() => {
    // Run once on load to merge any "unknown" customers into a single canonical one.
    const hasUnmergedUnknowns = customers.some(c => {
      const nameStr = `${c.firstName || ''} ${c.lastName || ''} ${c.companyName || ''}`.toLowerCase();
      return nameStr.includes('neznám') || nameStr.includes('neznámý') || nameStr.includes('neznamy') || nameStr.includes('neznami');
    });

    if (hasUnmergedUnknowns) {
      let canonicalUnknown = customers.find(c => c.firstName.toLowerCase() === 'zákazník' && c.lastName.toLowerCase() === 'neznámý');
      
      const unknownVariants = customers.filter(c => {
        const nameStr = `${c.firstName || ''} ${c.lastName || ''} ${c.companyName || ''}`.toLowerCase();
        return (nameStr.includes('neznám') || nameStr.includes('neznámý') || nameStr.includes('neznamy') || nameStr.includes('neznami'));
      });

      if (unknownVariants.length > 1 || (unknownVariants.length === 1 && !canonicalUnknown)) {
        if (!canonicalUnknown) {
          canonicalUnknown = { ...unknownVariants[0], firstName: 'Zákazník', lastName: 'neznámý', customerType: 'soukromý' };
        }
        
        const canonicalId = canonicalUnknown.id;
        const idsToMerge = unknownVariants.map(v => v.id).filter(id => id !== canonicalId);

        if (idsToMerge.length > 0) {
          setVehicles(prev => prev.map(v => idsToMerge.includes(v.customerId) ? { ...v, customerId: canonicalId } : v));
          setInvoices(prev => prev.map(inv => idsToMerge.includes(inv.customerId) ? { ...inv, customerId: canonicalId } : inv));
          setCustomers(prev => {
            const others = prev.filter(c => !idsToMerge.includes(c.id) && c.id !== canonicalId);
            return [...others, canonicalUnknown!];
          });
        }
      }
    }
  }, []); // Run once on mount

  // --- P2P SYNCHRONIZATION ---
  useEffect(() => {
    const electron = (window as any).electronAPI;
    if (!electron?.p2p) return;

    // Handle requests for full state (INIT_DUMP)
    electron.p2p.onRequestFullState(() => {
      console.log('P2P: Renderer received request for full state');
      const fullState = {
        customers: JSON.parse(localStorage.getItem('customers') || '[]'),
        vehicles: JSON.parse(localStorage.getItem('vehicles') || '[]')
        // We no longer sync services, invoices, or budgets
      };
      electron.p2p.sendFullState(fullState);
    });

    // Handle incoming incremental updates
    electron.p2p.onUpdateReceived((data: { type: string, id: string, payload: any }) => {
      console.log('P2P: Received update for', data.type, data.id);
      
      const unsubscribeFullState = electron.p2p.onRequestFullState(() => {
      console.log('P2P PC: Mobil zaťukal na síť a stahuje reálnou databázi...');
      const fullState = {
        customers: JSON.parse(localStorage.getItem('customers') || '[]'),
        vehicles: JSON.parse(localStorage.getItem('vehicles') || '[]')
      };
      // Pošleme data do main.js, který je zabalí do JSONu a vystřelí do mobilu
      electron.p2p.sendFullState(fullState);
	  });

      switch (data.type) {
        case 'CUSTOMERS':
          setCustomers(prev => {
            const existing = prev.find(item => item.id === data.id);
            if (isNewer(existing, data.payload)) {
              if (existing) {
                // Keep local hidden status
                return prev.map(item => item.id === data.id ? { ...data.payload, localHidden: item.localHidden } : item);
              } else {
                // For new items from network, assume not hidden locally
                return [{ ...data.payload, localHidden: false }, ...prev];
              }
            }
            return prev;
          });
          break;
        case 'VEHICLES':
          setVehicles(prev => {
            const existing = prev.find(item => item.id === data.id);
            if (isNewer(existing, data.payload)) {
              if (existing) {
                // Keep local hidden status
                return prev.map(item => item.id === data.id ? { ...data.payload, localHidden: item.localHidden } : item);
              } else {
                // For new items from network, assume not hidden locally
                return [{ ...data.payload, localHidden: false }, ...prev];
              }
            }
            return prev;
          });
          break;
        // SERVICES, INVOICES, and BUDGETS are no longer received via P2P
      }
    });

    // Handle full state dump (re-sync)
    electron.p2p.onInitDumpReceived((state: any) => {
      console.log('P2P: Received Initial Dump');
      
      const mergeArrays = (prev: any[], incoming: any[], idField: string) => {
        const merged = [...prev];
        incoming.forEach(incItem => {
          const idx = merged.findIndex(p => p[idField] === incItem[idField]);
          if (idx === -1) {
            // New item from network - default to not hidden locally
            merged.push({ ...incItem, localHidden: false });
          } else {
            const existingTime = new Date(merged[idx].updatedAt).getTime();
            const incomingTime = new Date(incItem.updatedAt).getTime();
            if (incomingTime > existingTime) {
              // Update with incoming data but preserve local hidden status
              merged[idx] = { ...incItem, localHidden: merged[idx].localHidden };
            }
          }
        });
        return merged;
      };

      if (state.customers) setCustomers(prev => mergeArrays(prev, state.customers, 'id'));
      if (state.vehicles) setVehicles(prev => mergeArrays(prev, state.vehicles, 'id'));
      // We no longer process services, invoices, or budgets from INIT_DUMP
    });

    // Handle Bidirectional Sync Handshake
    electron.p2p.onRequestSyncFromNetwork(() => {
      console.log('P2P: Network requested sync. Sending full state.');
      const payload = {
        customers: JSON.parse(localStorage.getItem('customers') || '[]'),
        vehicles: JSON.parse(localStorage.getItem('vehicles') || '[]')
      };
      electron.p2p.sendFullSync(payload);
    });

    electron.p2p.onFullSyncReceived((state: any) => {
      console.log('P2P: Received Full Sync payload from network');
      
      const mergeArrays = (prev: any[], incoming: any[], idField: string) => {
        const merged = [...prev];
        incoming.forEach(incItem => {
          const idx = merged.findIndex(p => p[idField] === incItem[idField]);
          if (idx === -1) {
            // New item from network - default to not hidden locally
            merged.push({ ...incItem, localHidden: false });
          } else {
            const existingTime = new Date(merged[idx].updatedAt).getTime();
            const incomingTime = new Date(incItem.updatedAt).getTime();
            if (incomingTime > existingTime) {
              // Update with incoming data but preserve local hidden status
              merged[idx] = { ...incItem, localHidden: merged[idx].localHidden };
            }
          }
        });
        return merged;
      };

      if (state.customers) setCustomers(prev => mergeArrays(prev, state.customers, 'id'));
      if (state.vehicles) setVehicles(prev => mergeArrays(prev, state.vehicles, 'id'));
    });

    // Handle requests for P2P settings (on app start)
    electron.p2p.onRequestSettings(() => {
      console.log('P2P: Renderer received request for P2P settings');
      const mode = localStorage.getItem('p2p_mode') || 'off';
      const serverIp = localStorage.getItem('p2p_server_ip') || '';
      electron.p2p.updateSettings({ mode, serverIp });
    });

    // Proactively send settings on mount
    const initMode = localStorage.getItem('p2p_mode') || 'off';
    const initServerIp = localStorage.getItem('p2p_server_ip') || '';
    if (initMode !== 'off') {
      console.log('P2P: Aktivní odesílání nastavení při startu:', initMode);
      electron.p2p.updateSettings({ mode: initMode, serverIp: initServerIp });
    }

    // Proactively send Bluetooth port settings on mount
    if (electron?.bluetooth) {
      const initBtPort = localStorage.getItem('p2p_bt_port') || 'COM4';
      electron.bluetooth.updatePort(initBtPort);
    }

    const handleIncomingCheckIn = (data: any) => {
      console.log('BT: Zpracovávám data z mobilního check-inu', data);
      
      // 1. Play chime sound using Web Audio API (cross-platform, zero dependencies)
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          gain1.gain.setValueAtTime(0.08, ctx.currentTime);
          gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
          osc1.start(ctx.currentTime);
          osc1.stop(ctx.currentTime + 0.25);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.12); // G5
          gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.12);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          osc2.start(ctx.currentTime + 0.12);
          osc2.stop(ctx.currentTime + 0.5);
        }
      } catch (err) {
        console.warn("Chyba přehrávání zvuku:", err);
      }

      // 2. Parse data
      const vId = data.vehicleId || data.vehicleID || '';
      const mileage = Number(data.mileage || data.km || data.stavKm || 0);
      const fuelLevel = data.fuelLevel || data.fuel || data.palivo || '';
      const equipment = data.equipment || data.vybava || '';
      const notes = data.notes || data.poznámky || data.note || data.zavada || '';

      // Safely check latest vehicles from localStorage to prevent stale React closures
      let rZ = 'Neznámé';
      let foundVehicleId = vId;
      try {
        const storedVehs = JSON.parse(localStorage.getItem('vehicles') || '[]');
        const matched = storedVehs.find((v: any) => v.id === vId || v.licensePlate === vId || v.vin === vId);
        if (matched) {
          rZ = matched.licensePlate;
          foundVehicleId = matched.id;
        } else if (data.licensePlate) {
          rZ = data.licensePlate;
        }
      } catch (e) {
        console.error("Chyba při parsování vozidel pro BT příjem:", e);
      }

      // Checklist detection safely mapping from both object schema and simple array/string
      let hasSpare = false;
      let hasSecurityKey = false;
      let hasJack = false;
      let hasTriangle = false;
      let hasWrench = false;
      let hasFirstAid = false;
      let hasTyreKit = false;

      if (equipment && typeof equipment === 'object' && !Array.isArray(equipment)) {
        hasSpare = !!(equipment.spareTyre ?? equipment.rezerva);
        hasSecurityKey = !!(equipment.securityKey ?? equipment.bezp_klic);
        hasJack = !!(equipment.jack ?? equipment.zvedak);
        hasTriangle = !!(equipment.triangle ?? equipment.trojuhelnik);
        hasWrench = !!(equipment.wheelWrench ?? equipment.klic);
        hasFirstAid = !!(equipment.firstAid ?? equipment.lekarna);
        hasTyreKit = !!(equipment.tyreKit ?? equipment.lepeni);
      } else {
        const eqStr = Array.isArray(equipment) ? equipment.join(' ').toLowerCase() : String(equipment).toLowerCase();
        hasSpare = eqStr.includes('rezerv') || eqStr.includes('spare');
        hasSecurityKey = eqStr.includes('bezp') || eqStr.includes('security');
        hasJack = eqStr.includes('zved') || eqStr.includes('jack');
        hasTriangle = eqStr.includes('troj') || eqStr.includes('triangle');
        hasWrench = eqStr.includes('klic') || eqStr.includes('klíč') || eqStr.includes('wrench');
        hasFirstAid = eqStr.includes('lekarn') || eqStr.includes('lékárn') || eqStr.includes('aid');
        hasTyreKit = eqStr.includes('lepen') || eqStr.includes('kit');
      }

      const prefilledNotes = notes ? String(notes).trim() : '';

      // 3. Set alert toast
      setBtNotification({
        show: true,
        message: `Přijata data z mobilního příjmu vozu ${rZ}`,
        licensePlate: rZ
      });

      // 4. Fill pendingOrderData and trigger Order screen
      setPendingOrderData({
        vehicleId: foundVehicleId,
        date: new Date().toISOString().split('T')[0],
        description: prefilledNotes,
        status: 'probíhá',
        mileageAtEntry: mileage || undefined,
        parts: [],
        attachments: [],
        fuelLevel: fuelLevel || undefined,
        checklist: {
          rezerva: hasSpare,
          zvedak: hasJack,
          klic: hasWrench,
          bezp_klic: hasSecurityKey,
          trojuhelnik: hasTriangle,
          lekarna: hasFirstAid,
          lepeni: hasTyreKit
        }
      });

      setActiveView('orders');
      setShouldOpenModal(true);
      setTargetOrderId(null);
      setTargetVehicleId(null);
    };

    // Listen to mobile Bluetooth checkins
    let unsubBluetooth = () => {};
    if (electron?.bluetooth) {
      unsubBluetooth = electron.bluetooth.onMobileCheckInReceived((data: any) => {
        handleIncomingCheckIn(data);
      });
    }

    // Register simple window listener for simulated browser bluetooth transmissions
    const handleSimulatedCheckinEvent = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail) {
        handleIncomingCheckIn(customEv.detail);
      }
    };
    window.addEventListener('simulated-mobile-checkin', handleSimulatedCheckinEvent);

    return () => {
      if (typeof unsubscribeFullState === 'function') unsubscribeFullState();
    };
  }, [customers, vehicles]); // HLAVNÍ ZMĚNA: Přidali jsme sem závislosti, aby PC poslalo vždy čerstvě uložená auta

  const broadcastP2P = (type: string, id: string, payload: any) => {
    const electron = (window as any).electronAPI;
    if (electron?.p2p) {
      electron.p2p.broadcastUpdate({ type, id, payload });
    }
  };

  // --- FOCUS MANAGEMENT SAFETY ---
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // If user clicks on body or empty space, and nothing has focus, force focus back to window
      // This helps with "freezing" issues in Electron when focus is lost after modal close
      if (document.activeElement === document.body || !document.activeElement) {
        window.focus();
      }
    };

    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, []);

  const recoverFocus = useCallback(() => {
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      window.focus();
      // Also try to focus the body to ensure we have a base level of focus
      document.body.focus();
    }, 50);
  }, []);

  const handleDeleteCustomer = useCallback((id: string) => {
    setCustomers(prev => prev.map(c => {
      if (c.id === id) {
        const updated = { ...c, localHidden: true, updatedAt: new Date().toISOString() };
        broadcastP2P('CUSTOMERS', updated.id, updated);
        return updated;
      }
      return c;
    }));
  }, [broadcastP2P]);

  const handleDeleteVehicle = useCallback((id: string) => {
    setVehicles(prev => prev.map(v => {
      if (v.id === id) {
        const updated = { ...v, localHidden: true, updatedAt: new Date().toISOString() };
        broadcastP2P('VEHICLES', updated.id, updated);
        return updated;
      }
      return v;
    }));
  }, [broadcastP2P]);

  const handleRestoreCustomer = useCallback((id: string) => {
    setCustomers(prev => prev.map(c => {
      if (c.id === id) {
        const updated = { ...c, localHidden: false, updatedAt: new Date().toISOString() };
        broadcastP2P('CUSTOMERS', updated.id, updated);
        return updated;
      }
      return c;
    }));
  }, [broadcastP2P]);

  const handleRestoreVehicle = useCallback((id: string) => {
    setVehicles(prev => prev.map(v => {
      if (v.id === id) {
        const updated = { ...v, localHidden: false, updatedAt: new Date().toISOString() };
        broadcastP2P('VEHICLES', updated.id, updated);
        return updated;
      }
      return v;
    }));
  }, [broadcastP2P]);

  const syncVehicleMileage = useCallback((vehicleId: string, mileageAtEntry?: number) => {
    if (mileageAtEntry === undefined || mileageAtEntry === null || mileageAtEntry === 0) return;
    setVehicles(prevVehicles => prevVehicles.map(v => {
      if (v.id === vehicleId && mileageAtEntry > v.mileage) {
        return { ...v, mileage: mileageAtEntry, updatedAt: new Date().toISOString() };
      }
      return v;
    }));
  }, []);

  const syncVehicleDates = useCallback((service: ServiceRecord) => {
    if (service.status !== 'hotovo') return;
    
    const parts = service.parts || [];
    const mainDesc = (service.description || "").toLowerCase();
    const partsText = parts.map(p => (p.description || "").toLowerCase()).join(" ");
    const fullText = `${mainDesc} ${partsText}`;
    
    const hasSTK = fullText.includes('ek+tk') || fullText.includes('technicka kontrola') || fullText.includes('technická kontrola');
    const hasOil = fullText.includes('motorovy olej') || fullText.includes('motorový olej') || fullText.includes('vymena oleje');
    
    // Nově sledované výrazy
    const hasBrakeFluid = fullText.includes('brzdova kapalina') || fullText.includes('brzdová kapalina');
    const hasCoolant = fullText.includes('chladici kapalina') || fullText.includes('chladící kapalina') || fullText.includes('chlad. kapalina');
    const hasGearboxOil = fullText.includes('prevodovy olej') || fullText.includes('převodový olej') || fullText.includes('olej prevodovky') || fullText.includes('olej převodovky') || fullText.includes('olej prevodovy') || fullText.includes('olej převodový');
    const hasTimingBelt = fullText.includes('rozvodova sada') || fullText.includes('rozvodová sada') || fullText.includes('sada rozvodu') || fullText.includes('sada rozvodů');
    const hasRefrigerant = fullText.includes('chladivo r134') || fullText.includes('chladivo klimatizace') || fullText.includes('plneni klimatizace') || fullText.includes('plnění klimatizace');
    
    const baseDateStr = service.deliveryDate || service.date;
    const baseDate = new Date(baseDateStr);
    if (isNaN(baseDate.getTime())) return;

    setVehicles(prevVehicles => prevVehicles.map(v => {
      if (v.id === service.vehicleId) {
        let updates: Partial<Vehicle> = { updatedAt: new Date().toISOString() };
        
        if (hasSTK) {
          const nextSTK = new Date(baseDate);
          nextSTK.setFullYear(nextSTK.getFullYear() + 2);
          updates.stkExpirationDate = nextSTK.toISOString().split('T')[0];
        }
        
        if (hasOil) {
          const nextService = new Date(baseDate);
          const intervalMonths = v.serviceIntervalMonths || 12;
          nextService.setMonth(nextService.getMonth() + intervalMonths);
          updates.nextServiceDate = nextService.toISOString().split('T')[0];
          updates.lastServiceDate = baseDateStr;
          updates.oilChangeDate = baseDateStr; // Nově přidáno pro explicitní sledování oleje
        }

        // Aktualizace specifických dat výměn
        if (hasBrakeFluid) updates.brakeFluidDate = baseDateStr;
        if (hasCoolant) updates.coolantDate = baseDateStr;
        if (hasGearboxOil) updates.gearboxOilDate = baseDateStr;
        if (hasTimingBelt) updates.timingBeltDate = baseDateStr;
        if (hasRefrigerant) updates.refrigerantDate = baseDateStr;
        
        return { ...v, ...updates };
      }
      return v;
    }));
  }, []);

  const handleAddService = (service: ServiceRecord) => {
    const serviceWithTimestamp = { ...service, updatedAt: new Date().toISOString() };
    setServices(prev => [serviceWithTimestamp, ...prev]);
    // P2P: Services are now local only
    syncVehicleMileage(serviceWithTimestamp.vehicleId, serviceWithTimestamp.mileageAtEntry);
    syncVehicleDates(serviceWithTimestamp);
    
    if (serviceWithTimestamp.convertedFromBudgetId) {
      setBudgets(prev => prev.map(b => {
        if (b.id === serviceWithTimestamp.convertedFromBudgetId) {
          const updated = { ...b, convertedToOrderId: serviceWithTimestamp.id, updatedAt: new Date().toISOString() };
          // P2P: Budgets are now local only
          return updated;
        }
        return b;
      }));
    }
  };

  const handleUpdateService = (service: ServiceRecord) => {
    const serviceWithTimestamp = { ...service, updatedAt: new Date().toISOString() };
    setServices(prev => prev.map(item => item.id === serviceWithTimestamp.id ? serviceWithTimestamp : item));
    // P2P: Services are now local only
    syncVehicleMileage(serviceWithTimestamp.vehicleId, serviceWithTimestamp.mileageAtEntry);
    syncVehicleDates(serviceWithTimestamp);

    if (serviceWithTimestamp.convertedFromBudgetId) {
      setBudgets(prev => prev.map(b => {
        if (b.id === serviceWithTimestamp.convertedFromBudgetId) {
          const updated = { ...b, convertedToOrderId: serviceWithTimestamp.id, updatedAt: new Date().toISOString() };
          // P2P: Budgets are now local only
          return updated;
        }
        return b;
      }));
    }
  };

  const handleUpdateInvoice = (updatedInvoice: Invoice) => {
    const invoiceWithTimestamp = { ...updatedInvoice, updatedAt: new Date().toISOString() };
    setInvoices(prev => prev.map(inv => inv.uid === invoiceWithTimestamp.uid ? invoiceWithTimestamp : inv));
    // P2P: Invoices are now local only
  };

  const handleCreateInvoiceFromOrder = (orderId: string) => {
    const order = services.find(s => s.id === orderId);
    if (!order) return;
    
    const vehicle = vehicles.find(v => v.id === order.vehicleId);
    if (!vehicle) return;

    const existingInvoice = invoices.find(inv => inv.orderId === orderId);
    if (existingInvoice) {
      setActiveView('invoices');
      return;
    }

    const invoiceItems: PartItem[] = [];
    if (order.parts && order.parts.length > 0) {
      order.parts.forEach(p => invoiceItems.push({ ...p }));
    }

    if (order.laborHours && order.laborHours > 0) {
      invoiceItems.push({ 
        id: `labor-${Date.now()}`, 
        description: `Servisní práce (${order.laborHours} h)`, 
        quantity: order.laborHours, 
        unit: 'h', 
        unitPrice: hourlyRate,
        costPrice: 0 
      });
    }

    if (invoiceItems.length === 0 && order.cost > 0) {
      invoiceItems.push({
        id: `fallback-${Date.now()}`,
        description: 'Servisní práce a materiál (dle zakázky)',
        quantity: 1,
        unit: 'ks',
        unitPrice: order.cost,
        costPrice: 0
      });
    }

    const taxDateStr = order.deliveryDate || order.date;
    const issueDate = new Date(taxDateStr);
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 14);

    const yearPrefix = new Date().getFullYear().toString().slice(-2);
    const monthPrefix = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const prefix = `${yearPrefix}/${monthPrefix}/`;

    const monthlyInvoices = invoices.filter(inv => inv.id.startsWith(prefix));
    const usedSequences = new Set(monthlyInvoices.map(inv => {
      const parts = inv.id.split('/');
      return parseInt(parts[parts.length - 1]);
    }));

    let seq = 1;
    while (usedSequences.has(seq)) {
      seq++;
    }
    
    const nextSequence = seq.toString().padStart(3, '0');
    const invoiceId = `${prefix}${nextSequence}`;

    const calculatedTotalExclDph = invoiceItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const newInvoice: Invoice = {
      uid: `inv-uid-${Math.random().toString(36).substr(2, 9)}`,
      id: invoiceId,
      orderId: order.id,
      issueDate: taxDateStr,
      dueDate: dueDate.toISOString().split('T')[0],
      customerId: vehicle.customerId,
      vehicleInfo: `${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})`,
      items: invoiceItems,
      totalExclDph: calculatedTotalExclDph,
      totalInclDph: companyInfo.isVatPayer ? Math.round(calculatedTotalExclDph * 1.21) : Math.round(calculatedTotalExclDph),
      paymentType: 'Převodem',
      status: 'neuhrazeno',
      discount: 0,
      mileageAtEntry: order.mileageAtEntry,
      costs: Math.round(order.parts?.reduce((sum, p) => sum + ((p.costPrice || 0) * p.quantity), 0) || 0),
      updatedAt: new Date().toISOString()
    };

    setInvoices([newInvoice, ...invoices]);
    // P2P: Invoices are now local only
    resetAllSearches();
    setActiveView('invoices');
  };

  const handleUpdateFixedService = (updated: FixedService) => {
    setFixedServices(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const resetAllSearches = () => {
    setCustomerSearch('');
    setVehicleSearch('');
    setOrderSearch('');
    setInvoiceSearch('');
    setArchiveSearch('');
  };

  const handleNavigate = (view: AppView, autoOpen: boolean = false) => {
    resetAllSearches();
    setTargetVehicleId(null);
    setTargetOrderId(null);
    setTargetCustomerId(null);
    setActiveView(view);
    setShouldOpenModal(autoOpen);
  };

  const handleRestoreData = (fullState: any) => {
    // 1. ZÁKAZNÍCI (Zajištění polí jako gdprConsent)
    if (fullState.customers) {
      const sanitizedCustomers = fullState.customers.map((c: any) => ({
        ...c,
        gdprConsent: c.gdprConsent ?? false,
        customerType: c.customerType || 'soukromý',
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        createdAt: c.createdAt || new Date().toISOString(),
        updatedAt: c.updatedAt || new Date().toISOString()
      }));
      setCustomers(sanitizedCustomers);
      localStorage.setItem('customers', JSON.stringify(sanitizedCustomers));
    }

    // 2. VOZIDLA
    if (fullState.vehicles) {
      const sanitizedVehicles = fullState.vehicles.map((v: any) => ({
        ...v,
        make: v.make || '',
        model: v.model || '',
        year: v.year || new Date().getFullYear(),
        mileage: v.mileage || 0,
        licensePlate: v.licensePlate || '',
        vin: v.vin || '',
        updatedAt: v.updatedAt || new Date().toISOString()
      }));
      setVehicles(sanitizedVehicles);
      localStorage.setItem('vehicles', JSON.stringify(sanitizedVehicles));
    }

    // 3. ZAKÁZKY / SLUŽBY
    if (fullState.services) {
      const sanitizedServices = fullState.services.map((s: any) => ({
        ...s,
        updatedAt: s.updatedAt || new Date().toISOString()
      }));
      setServices(sanitizedServices);
      localStorage.setItem('services', JSON.stringify(sanitizedServices));
    }

    // 4. FAKTURY
    if (fullState.invoices) {
      const sanitizedInvoices = fullState.invoices.map((inv: any) => ({
        ...inv,
        uid: inv.uid || `inv-uid-restored-${Math.random().toString(36).substr(2, 9)}`,
        updatedAt: inv.updatedAt || new Date().toISOString()
      }));
      setInvoices(sanitizedInvoices);
      localStorage.setItem('invoices', JSON.stringify(sanitizedInvoices));
    }

    // 5. ÚKOLY
    if (fullState.tasks) {
      setTasks([...fullState.tasks]);
      localStorage.setItem('tasks', JSON.stringify(fullState.tasks));
    }

    // 6. UDÁLOSTI KALENDÁŘE
    if (fullState.calendarEvents) {
      setCalendarEvents([...fullState.calendarEvents]);
      localStorage.setItem('calendarEvents', JSON.stringify(fullState.calendarEvents));
    }

    // 7. SMS ZPRÁVY A HISTORIE
    if (fullState.smsMessages) {
      setSmsMessages([...fullState.smsMessages]);
      localStorage.setItem('autoservis-sms', JSON.stringify(fullState.smsMessages));
    }

    // 7.5 ROZPOČTY
    if (fullState.budgets) {
      const sanitizedBudgets = fullState.budgets.map((b: any) => ({
        ...b,
        updatedAt: b.updatedAt || new Date().toISOString()
      }));
      setBudgets(sanitizedBudgets);
      localStorage.setItem('budgets', JSON.stringify(sanitizedBudgets));
    }

    // 8. NASTAVENÍ (ZÁKLADNÍ)
    if (fullState.hourlyRate !== undefined) {
      setHourlyRate(fullState.hourlyRate);
      localStorage.setItem('hourlyRate', JSON.stringify(fullState.hourlyRate));
    }
    if (fullState.fixedServices) {
      setFixedServices([...fullState.fixedServices]);
      localStorage.setItem('fixedServices', JSON.stringify(fullState.fixedServices));
    }
    if (fullState.predefinedTasks) {
      setPredefinedTasks([...fullState.predefinedTasks]);
      localStorage.setItem('predefinedTasks', JSON.stringify(fullState.predefinedTasks));
    }
    if (fullState.technicians) {
      setTechnicians([...fullState.technicians]);
      localStorage.setItem('technicians', JSON.stringify(fullState.technicians));
    }
    if (fullState.discountLevels) {
      setDiscountLevels([...fullState.discountLevels]);
      localStorage.setItem('discountLevels', JSON.stringify(fullState.discountLevels));
    }

    // 9. FIRMA A OSTATNÍ
    if (fullState.companyInfo) {
      setCompanyInfo({...fullState.companyInfo});
      localStorage.setItem('companyInfo', JSON.stringify(fullState.companyInfo));
    }
    if (fullState.notifSettings) {
      setNotifSettings({...fullState.notifSettings});
      localStorage.setItem('notifSettings', JSON.stringify(fullState.notifSettings));
    }
    if (fullState.statsSettings) {
      setStatsSettings({...fullState.statsSettings});
      localStorage.setItem('statsSettings', JSON.stringify(fullState.statsSettings));
    }
    if (fullState.smsSettings) {
      setSmsSettings({...fullState.smsSettings});
      localStorage.setItem('autoservis-sms-settings', JSON.stringify(fullState.smsSettings));
    }
    if (fullState.userSettings) {
      setUserSettings({...fullState.userSettings});
      localStorage.setItem('userSettings', JSON.stringify(fullState.userSettings));
    }
    if (fullState.autoBackupSettings) {
      setAutoBackupSettings({...fullState.autoBackupSettings});
      localStorage.setItem('autoBackupSettings', JSON.stringify(fullState.autoBackupSettings));
    }
    if (fullState.geminiApiKey) {
      localStorage.setItem('gemini_api_key', fullState.geminiApiKey);
    }
    
    // Refresh aplikace aby se projevily změny
    window.location.reload();
  };

  const handleClearAllData = () => {
    setCustomers([]);
    setVehicles([]);
    setServices([]);
    setInvoices([]);
    setTasks([]);
    resetAllSearches();
    setActiveView('dashboard');
  };

  const handleExportData = () => {
    const dataObj = {
      customers,
      vehicles,
      services,
      invoices,
      budgets,
      tasks,
      calendarEvents,
      smsMessages,
      smsSettings,
      hourlyRate,
      fixedServices,
      predefinedTasks,
      discountLevels,
      technicians,
      companyInfo,
      notifSettings,
      statsSettings,
      userSettings,
      autoBackupSettings,
      selectedPrinter,
      geminiApiKey: localStorage.getItem('gemini_api_key') || '',
      exportDate: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(dataObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `autoservis_zaloha_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleNavigateToVehicle = (vId: string) => { 
    resetAllSearches();
    const v = vehicles.find(item => item.id === vId);
    if (v) setVehicleSearch(v.licensePlate);
    setTargetVehicleId(vId); 
    setActiveView('vehicles'); 
  };

  const handleNavigateToOrder = (oId: string) => { 
    resetAllSearches();
    const order = services.find(item => item.id === oId);
    if (!order) return;

    const relatedInvoice = invoices.find(inv => inv.orderId === order.id);
    const isArchived = relatedInvoice?.status === 'uhrazeno' && (order.status === 'hotovo' || order.status === 'zrušeno');

    if (isArchived) {
      setArchiveSearch(order.id);
      setActiveView('archive');
    } else {
      setTargetOrderId(oId);
      setShouldOpenModal(true);
      setActiveView('orders');
    }
  };

  const handleCreateOrderForVehicle = (vId: string) => {
    resetAllSearches();
    setTargetVehicleId(vId);
    setTargetOrderId(null);
    setPendingOrderData(null);
    setActiveView('orders');
    setShouldOpenModal(true);
  };

  const handleCreateOrderFromBudget = (orderData: Partial<ServiceRecord>) => {
    resetAllSearches();
    setPendingOrderData(orderData);
    setTargetVehicleId(null);
    setTargetOrderId(null);
    setActiveView('orders');
    setShouldOpenModal(true);
  };

  const handleCreateOrderForKanas = (vId: string, dateStr: string, description: string) => {
    resetAllSearches();
    
    // Split date to YYYY-MM-DD format as required by OrderManager prefilled fields
    const parsedDate = dateStr ? dateStr.split('T')[0] : new Date().toISOString().split('T')[0];
    
    setPendingOrderData({
      vehicleId: vId,
      date: parsedDate,
      description: description || 'Nová zakázka od asistenta KANAS',
      status: 'přijato',
      parts: [],
      attachments: []
    });
    setTargetVehicleId(null);
    setTargetOrderId(null);
    setActiveView('orders');
    setShouldOpenModal(true);
  };

  const handleCreateCalendarEventForKanas = async (title: string, dateStr: string, description: string, vId?: string) => {
    try {
      const vehicle = vId ? vehicles.find(v => v.id === vId) : undefined;
      const customer = vehicle ? customers.find(c => c.id === vehicle.customerId) : undefined;

      const startObj = dateStr ? new Date(dateStr) : new Date();
      if (isNaN(startObj.getTime())) {
        console.warn("Invalid date specified for Kanas event creation", dateStr);
      }
      const endObj = new Date(startObj.getTime() + 60 * 60 * 1000); // Default to +1h duration

      let newEvent: CalendarEvent = {
        id: `ev-${Date.now()}`,
        title: title || 'Schůzka od KANAS',
        description: description || '',
        startDate: startObj.toISOString(),
        endDate: endObj.toISOString(),
        vehicleId: vId || '',
        color: '#2563eb' // Nice default brand blue color
      };

      const isConnected = googleCalendarService.isAuthenticated();
      if (isConnected) {
        try {
          const googleId = await googleCalendarService.createEvent(newEvent, vehicle, customer);
          if (googleId) {
            newEvent = { ...newEvent, id: googleId };
          }
        } catch (err) {
          console.error("Failed to create Google Calendar Event:", err);
        }
      }

      setCalendarEvents(prev => [...prev, newEvent]);
    } catch (err) {
      console.error("KANAS event creator error:", err);
    }
  };

  const handleSaveBudget = (budget: any) => {
    const budgetWithTimestamp = { ...budget, updatedAt: new Date().toISOString() };
    setBudgets(prev => {
      const exists = prev.find(b => b.id === budgetWithTimestamp.id);
      if (exists) {
        return prev.map(b => b.id === budgetWithTimestamp.id ? budgetWithTimestamp : b);
      }
      return [budgetWithTimestamp, ...prev];
    });
    // P2P: Budgets are now local only
  };

  const handleDeleteBudget = (id: string) => {
    if (confirm('Opravdu chcete tento rozpočet smazat?')) {
      setBudgets(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleLoadBudgetToEditor = (budget: any) => {
    setInitialBudgetData(budget);
    setBudgetVehicleId(budget.vehicleId);
    setActiveView('budget');
  };

  const handleNavigateToCustomer = (cId: string) => { 
    resetAllSearches();
    const c = customers.find(item => item.id === cId);
    if (c) setCustomerSearch(c.lastName || c.companyName || '');
    setTargetCustomerId(cId); 
    setActiveView('customers'); 
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  const handleAddTask = (text: string) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      text,
      completed: false,
      createdAt: new Date().toISOString()
    };
    setTasks([newTask, ...tasks]);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  if (userSettings.enabled && !isAuthenticated) {
    return <Login settings={userSettings} onLogin={() => setIsAuthenticated(true)} />;
  }

  const companyNameParts = (companyInfo?.name || '').split(' ');

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden text-slate-900">
      <header className="bg-white border-b border-slate-200 shrink-0 sticky top-0 z-40 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-center relative">
          <nav className="hidden lg:flex items-center gap-3">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id as AppView)}
                className={`flex items-center gap-2 px-2.5 py-2.5 rounded-xl transition-all duration-200 text-sm font-bold ${
                  activeView === item.id 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="whitespace-nowrap hidden xl:block">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="absolute right-6 flex items-center gap-4">
            {userSettings.enabled && (
              <button 
                onClick={handleLogout}
                className="hidden lg:flex items-center gap-2 px-2.5 py-2.5 text-slate-500 hover:text-red-600 font-bold text-sm transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="whitespace-nowrap hidden xl:block">Odhlásit</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className={`flex-1 overflow-y-auto ${activeView === 'eshop' ? 'p-0' : 'p-6 md:p-10'} print:p-0 relative`}>
        <div className={`${activeView === 'eshop' ? 'w-full h-full' : 'max-w-7xl mx-auto pb-10'} print:max-w-none`}>
          <EshopManager 
            isVisible={activeView === 'eshop'} 
            vinToSearch={pendingVinSearch} 
            onSearchHandled={handleClearVinSearch}
            userShops={userShops}
          />
          
          {activeView === 'dashboard' && (
            <Dashboard 
              customers={customers.filter(c => !c.localHidden)} 
              vehicles={vehicles.filter(v => !v.localHidden)} 
              services={services} 
              tasks={tasks}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onNavigate={handleNavigate} 
              onViewVehicle={handleNavigateToVehicle} 
              onViewOrder={handleNavigateToOrder} 
              notifSettings={notifSettings} 
              smsMessages={smsMessages}
              setSmsMessages={setSmsMessages}
              onCreateOrderKanas={handleCreateOrderForKanas}
              onCreateCalendarEventKanas={handleCreateCalendarEventForKanas}
            />
          )}
          {activeView === 'orders' && <OrderManager 
            services={services} 
            vehicles={vehicles} 
            customers={customers} 
            invoices={invoices} 
            technicians={technicians} 
            predefinedTasks={predefinedTasks} 
            hourlyRate={hourlyRate} 
            fixedServices={fixedServices} 
            onUpdateFixedService={handleUpdateFixedService} 
            companyInfo={companyInfo} 
            onAddService={handleAddService} 
            onUpdateService={handleUpdateService} 
            onUpdateVehicle={(v) => { const withTs = { ...v, updatedAt: new Date().toISOString() }; setVehicles(prev => prev.map(item => item.id === v.id ? withTs : item)); broadcastP2P('VEHICLES', withTs.id, withTs); }}
            onDeleteService={(id) => setServices(prev => prev.filter(item => item.id !== id))} 
            autoOpen={shouldOpenModal} 
            onModalOpened={() => { setShouldOpenModal(false); setTargetOrderId(null); setTargetVehicleId(null); setPendingOrderData(null); }} 
            initialOrderId={targetOrderId} 
            preselectedVehicleId={targetVehicleId} 
            prefilledData={pendingOrderData} 
            selectedPrinter={selectedPrinter} 
            onCreateInvoice={handleCreateInvoiceFromOrder} 
            search={orderSearch} 
            onSearchChange={setOrderSearch} 
            pendingEmailAttachment={pendingFileForAnalysis}
            onClearPendingAttachment={() => setPendingFileForAnalysis(null)}
          />}
          {activeView === 'invoices' && <InvoiceManager 
            invoices={invoices} 
            customers={customers} 
            services={services} 
            companyInfo={companyInfo} 
            discountLevels={discountLevels} 
            onDeleteInvoice={(uid) => setInvoices(prev => prev.filter(inv => inv.uid !== uid))} 
            onUpdateCustomer={(c) => { const withTs = { ...c, updatedAt: new Date().toISOString() }; setCustomers(prev => prev.map(item => item.id === c.id ? withTs : item)); broadcastP2P('CUSTOMERS', withTs.id, withTs); }}
            onUpdateInvoiceStatus={(uid, status) => {
            const updatedAt = new Date().toISOString();
            setInvoices(prev => prev.map(inv => {
              if (inv.uid === uid) {
                const updated = {...inv, status, updatedAt};
                // P2P: Invoices are now local only
                return updated;
              }
              return inv;
            }));
          }} onUpdateInvoice={handleUpdateInvoice} search={invoiceSearch} onSearchChange={setInvoiceSearch} />}
          {activeView === 'customers' && <CustomerManager customers={customers.filter(c => !c.localHidden)} vehicles={vehicles.filter(v => !v.localHidden)} setCustomers={setCustomers} onAddCustomer={(c) => { const withTs = { ...c, updatedAt: new Date().toISOString() }; setCustomers([withTs, ...customers]); broadcastP2P('CUSTOMERS', withTs.id, withTs); }} onUpdateCustomer={(c) => { const withTs = { ...c, updatedAt: new Date().toISOString() }; setCustomers(prev => prev.map(item => item.id === c.id ? withTs : item)); broadcastP2P('CUSTOMERS', withTs.id, withTs); }} onDeleteCustomer={handleDeleteCustomer} onNavigateToVehicle={handleNavigateToVehicle} initialCustomerId={targetCustomerId} autoOpen={shouldOpenModal} onModalOpened={() => { setShouldOpenModal(false); setTargetCustomerId(null); }} search={customerSearch} onSearchChange={setCustomerSearch} />}
          {activeView === 'vehicles' && <VehicleManager vehicles={vehicles.filter(v => !v.localHidden)} customers={customers.filter(c => !c.localHidden)} services={services} companyInfo={companyInfo} onAddVehicle={(v) => { const withTs = { ...v, updatedAt: new Date().toISOString() }; setVehicles([withTs, ...vehicles]); broadcastP2P('VEHICLES', withTs.id, withTs); }} onUpdateVehicle={(v) => { const withTs = { ...v, updatedAt: new Date().toISOString() }; setVehicles(prev => prev.map(item => item.id === v.id ? withTs : item)); broadcastP2P('VEHICLES', withTs.id, withTs); }} onDeleteVehicle={handleDeleteVehicle} onNavigateToCustomer={handleNavigateToCustomer} onNavigateToOrder={handleNavigateToOrder} onCreateOrder={handleCreateOrderForVehicle} initialVehicleId={targetVehicleId} autoOpen={shouldOpenModal} onModalOpened={() => { setShouldOpenModal(false); setTargetVehicleId(null); }} search={vehicleSearch} onSearchChange={setVehicleSearch} />}
          {activeView === 'archive' && (
            <ArchiveManager 
              services={services} 
              invoices={invoices} 
              vehicles={vehicles} 
              customers={customers} 
              companyInfo={companyInfo} 
              hourlyRate={hourlyRate} 
              budgets={budgets}
              onDeleteBudget={handleDeleteBudget}
              onLoadBudget={handleLoadBudgetToEditor}
              search={archiveSearch} 
              onSearchChange={setArchiveSearch} 
              onNavigateToOrder={handleNavigateToOrder} 
            />
          )}
          {activeView === 'communication' && <CommunicationCenter vehicles={vehicles} customers={customers} messages={smsMessages} setMessages={setSmsMessages} settings={smsSettings} setSettings={setSmsSettings} companyInfo={companyInfo} notifSettings={notifSettings} />}
          {activeView === 'budget' && (
            <BudgetManager 
              vehicles={vehicles} 
              customers={customers} 
              companyInfo={companyInfo} 
              hourlyRate={hourlyRate} 
              initialBudgetData={initialBudgetData}
              onSaveBudget={handleSaveBudget}
              onClearInitialData={() => setInitialBudgetData(null)}
              onCreateOrder={handleCreateOrderFromBudget} 
              onVehicleChange={(vId) => setBudgetVehicleId(vId)}
              onNavigateToLkq={() => handleNavigateToEshop(vehicles.find(v => v.id === budgetVehicleId)?.vin)}
              fixedServices={fixedServices}
              onUpdateFixedService={handleUpdateFixedService}
            />
          )}
          {activeView === 'calendar' && (
            <CalendarManager 
              events={calendarEvents} 
              vehicles={vehicles} 
              customers={customers}
              onAddEvent={(e) => setCalendarEvents(prev => [...prev, e])}
              onUpdateEvent={(e) => setCalendarEvents(prev => prev.map(ev => ev.id === e.id ? e : ev))}
              onDeleteEvent={(id) => setCalendarEvents(prev => prev.filter(ev => ev.id !== id))}
              onSyncEvents={(gEvents) => {
                setCalendarEvents(prev => {
                  const filtered = prev.filter(e => !e.id.startsWith('gcal-'));
                  return [...filtered, ...gEvents];
                });
              }}
            />
          )}
          {activeView === 'email' && (
            <EmailManager 
              isVisible={activeView === 'email'} 
              services={services}
              vehicles={vehicles}
              customers={customers}
              onUpdateServices={setServices}
              onImportToOrder={(orderId, fileData, fileName, fileType) => {
                setPendingFileForAnalysis({ orderId, fileData, fileName, fileType });
                handleNavigateToOrder(orderId);
              }}
            />
          )}
          {activeView === 'stats' && <StatsManager services={services} invoices={invoices} vehicles={vehicles} customers={customers} statsSettings={statsSettings} companyInfo={companyInfo} />}
          {activeView === 'settings' && <Settings technicians={technicians} onTechniciansChange={setTechnicians} predefinedTasks={predefinedTasks} onPredefinedTasksChange={setPredefinedTasks} discountLevels={discountLevels} onDiscountLevelsChange={setDiscountLevels} hourlyRate={hourlyRate} onRateChange={setHourlyRate} fixedServices={fixedServices} onFixedServicesChange={setFixedServices} userShops={userShops} onUserShopsChange={setUserShops} selectedPrinter={selectedPrinter} onPrinterChange={setSelectedPrinter} companyInfo={companyInfo} onCompanyChange={setCompanyInfo} notifSettings={notifSettings} onNotifSettingsChange={setNotifSettings} statsSettings={statsSettings} onStatsSettingsChange={setStatsSettings} customers={customers} vehicles={vehicles} services={services} invoices={invoices} onRestoreData={handleRestoreData} onClearAllData={handleClearAllData} onExportData={handleExportData} autoBackupSettings={autoBackupSettings} onAutoBackupSettingsChange={() => {}} setDirectoryHandle={() => {}} directoryHandle={null} userSettings={userSettings} onUserSettingsChange={setUserSettings} smsSettings={smsSettings} onSmsSettingsChange={setSmsSettings} onRestoreCustomer={handleRestoreCustomer} onRestoreVehicle={handleRestoreVehicle} />}
        </div>
      </main>

      {/* Mobile network check-in toast alert */}
      {btNotification?.show && (
        <div id="bt-mobile-checkin-alert" className="fixed bottom-6 right-6 z-[100] max-w-md bg-blue-600 text-white rounded-[2rem] shadow-2xl shadow-blue-500/30 p-6 flex flex-col gap-4 border border-white/10 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-start gap-4">
            <div className="bg-white/15 p-3 rounded-2xl animate-pulse shrink-0">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-white text-blue-600 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Mobilní příjem (Síť)
                </span>
                <span className="text-[10px] text-blue-100 font-bold uppercase tracking-wider">
                  Nové auto na dílně
                </span>
              </div>
              <p className="text-sm font-black leading-snug break-words">
                {btNotification.message}
              </p>
              <p className="text-xs text-blue-100 mt-1 leading-normal font-semibold">
                Kilometry, palivo a výbava byly automaticky načteny do nového zakázkového listu.
              </p>
            </div>
            <button 
              onClick={() => setBtNotification(prev => prev ? { ...prev, show: false } : null)}
              className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-3">
            <button
              onClick={() => setBtNotification(prev => prev ? { ...prev, show: false } : null)}
              className="px-4 py-2 hover:bg-white/10 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Zavřít
            </button>
            <button
              onClick={() => {
                setBtNotification(prev => prev ? { ...prev, show: false } : null);
                setActiveView('orders');
                setShouldOpenModal(true);
              }}
              className="flex items-center gap-1.5 px-4.5 py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
            >
              Zobrazit Zakázku
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
