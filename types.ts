
export interface PartItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  costPrice?: number; // Nákupní cena (základ daně)
}

export interface BudgetItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface Budget {
  id: string;
  vehicleId: string;
  customerId: string;
  date: string;
  laborHours: number;
  items: BudgetItem[];
  totalPriceExclVat: number;
  totalPriceInclVat: number;
  convertedToOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FixedService {
  id: string;
  name: string;
  price: number; // Prodejní cena (základ daně - nově bez DPH)
  costPrice?: number; // Nákupní cena (základ daně - nově bez DPH)
  unit?: string; // Měrná jednotka
  usageCount?: number; // Počet použití (pro řazení v ceníku)
  category?: 'díly' | 'úkony' | 'materiál';
}

export interface PredefinedTask {
  id: string;
  label: string;
  description: string;
}

export interface Invoice {
  uid: string; // Vnitřní unikátní ID pro React a DB operace
  id: string; // Číslo faktury (viditelné)
  orderId: string;
  issueDate: string;
  dueDate: string;
  customerId: string;
  vehicleInfo: string;
  items: PartItem[];
  totalExclDph: number;
  totalInclDph: number;
  costs?: number; // Pořizovací náklady pro výpočet zisku
  paymentType: 'Hotově' | 'Převodem';
  status: 'uhrazeno' | 'neuhrazeno';
  discount?: number;
  mileageAtEntry?: number;
  archived?: boolean;
  excludeFromStats?: boolean;
  updatedAt: string;
}

export interface Customer {
  id: string;
  customerType: 'soukromý' | 'firemní';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
  updatedAt: string;
  // Firemní údaje
  companyName?: string;
  companyAddress?: string;
  ico?: string;
  dic?: string;
  isVatPayer?: boolean;
  contactPerson?: string;
  gdprConsent?: boolean;
  localHidden?: boolean;
  attachments?: AttachmentItem[];
}

export interface AttachmentItem {
  id: string;
  name: string;
  size: string;
  uploadDate: string;
  relativePath: string; // Cesta relativní vůči kořenu aplikace
}

export interface SmsMessage {
  id: string;
  recipientPhone: string;
  recipientName?: string;
  customerId?: string;
  vehicleReg?: string;
  vehicleId?: string;
  serviceItem?: string; // Název servisní operace (STK, Motorový olej, atd.)
  text: string;
  status: 'Čeká na odeslání' | 'Odesláno' | 'Doručeno' | 'Chyba' | 'Zrušeno';
  sentAt?: string;
  createdAt: string;
  type: 'stk' | 'oil' | 'custom';
  errorMessage?: string;
}

export interface SmsSettings {
  applicationId: string;
  applicationToken: string;
  senderId: string;
  stkTemplate: string;
  oilTemplate: string;
}

export interface Vehicle {
  id: string;
  customerId: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  licensePlate: string;
  mileage: number;
  engineCode: string;
  enginePower?: string; // Výkon v kW
  driveType?: string;   // Druh pohonu (4x4, Přední...)
  bodyType?: string;    // Typ karoserie (Sedan, Kombi...)
  color: string;
  lastServiceDate: string;
  stkExpirationDate: string;
  nextServiceDate: string;
  updatedAt: string;
  serviceIntervalKm?: number;
  serviceIntervalMonths?: number;
  notes?: string;
  attachments?: AttachmentItem[];
  fuelType?: 'Benzín 95' | 'Benzín 98' | 'Nafta' | 'Ostatní';
  // Specifické servisní intervaly - data poslední výměny
  oilChangeDate?: string;
  brakeFluidDate?: string;
  coolantDate?: string;
  gearboxOilDate?: string;
  timingBeltDate?: string;
  refrigerantDate?: string;
  // Specifické servisní intervaly - délka intervalu v měsících
  oilChangeInterval?: number;
  brakeFluidInterval?: number;
  coolantInterval?: number;
  gearboxOilInterval?: number;
  timingBeltInterval?: number;
  refrigerantInterval?: number;
  // Specifické servisní intervaly pro převodovku
  gearboxType?: 'MAN' | 'AUTOMAT';
  gearboxOilLastKm?: number;
  gearboxOilIntervalKm?: number;
  localHidden?: boolean;
}

export interface VehicleChecklist {
  rezerva: boolean;
  zvedak: boolean;
  klic: boolean;
  bezp_klic: boolean;
  trojuhelnik: boolean;
  lekarna: boolean;
  lepeni: boolean;
}

export interface ServiceRecord {
  id: string;
  vehicleId: string;
  date: string;
  endDate?: string;
  deliveryDate?: string;
  description: string;
  parts?: PartItem[];
  laborHours?: number;
  cost: number;
  status: 'naplánováno' | 'probíhá' | 'hotovo' | 'zrušeno';
  technician: string;
  updatedAt: string;
  fuelLevel?: string;
  checklist?: VehicleChecklist;
  mileageAtEntry?: number;
  estimatedPrice?: number;
  paymentType?: 'Hotovost' | 'Faktura' | 'Pojišťovna';
  attachments?: AttachmentItem[];
  returnParts?: 'vrátit' | 'nevracet';
  convertedFromBudgetId?: string;
  aiTransformedDescription?: string;
}

export interface CompanyInfo {
  name: string;
  address: string;
  ico: string;
  dic: string;
  phone: string;
  email: string;
  bankAccount?: string;
  isVatPayer: boolean;
  foundationDate?: string; // Datum vzniku/registrace u ŽÚ
  rsvApiKey?: string; // API klíč pro Registr silničních vozidel
  rsvProxyUrl?: string; // Volitelná proxy pro obejití CORS
}

export interface NotificationSettings {
  stkThresholdDays: number;
  serviceThresholdDays: number;
}

export type CostCategory = 'energie' | 'nájemné' | 'spotřební zboží' | 'mzdy' | 'pojištění' | 'marketing' | 'ostatní';

export interface CostItem {
  id: string;
  name: string;
  amount: number;
  category: CostCategory;
  isRecurring: boolean; // true = měsíční, false = jednorázový
}

export interface StatsSettings {
  costItems: CostItem[];
}

export interface AutoBackupSettings {
  enabled: boolean;
  hour: number;
  lastBackupDate: string | null;
  folderName: string | null;
}

export interface UserSettings {
  enabled: boolean;
  username: string;
  password: string;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: string; // ISO formát s časem
  endDate: string;   // ISO formát s časem
  vehicleId?: string; // Vazba na existující vozidlo
  color: string;      // HEX kód nebo název barvy
}

export interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  body?: string;
  date: string;
  timestamp: number;
  attachments?: GmailAttachment[];
}

export type AppView = 'dashboard' | 'customers' | 'vehicles' | 'orders' | 'settings' | 'invoices' | 'archive' | 'stats' | 'calendar' | 'communication' | 'budget' | 'eshop' | 'email';

export interface UserShop {
  id: string;
  name: string;
  url: string;
}

// Add missing types for Gemini-related components
export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: Date;
  metadata?: {
    sources?: Array<{ uri: string; title: string }>;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}
