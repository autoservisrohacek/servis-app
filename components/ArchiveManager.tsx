
import React, { useState, useMemo } from 'react';
import { Search, Archive, ClipboardCheck, Receipt, Car, User, Clock, ChevronRight, Filter, Calendar, Eye, X, Printer, ArrowUpRight, Calculator, Trash2, RotateCcw, CheckCircle2 } from 'lucide-react';
import { ServiceRecord, Invoice, Vehicle, Customer, CompanyInfo, Budget } from '../types';
import { PrintTemplate } from './OrderManager';
import { InvoicePrintTemplate } from './InvoiceManager';

interface ArchiveManagerProps {
  services: ServiceRecord[];
  invoices: Invoice[];
  vehicles: Vehicle[];
  customers: Customer[];
  companyInfo: CompanyInfo;
  hourlyRate: number;
  budgets: Budget[];
  onDeleteBudget: (id: string) => void;
  onLoadBudget: (budget: Budget) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onNavigateToOrder: (id: string) => void;
}

const MONTHS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

const formatDate = (dateStr: any) => {
  if (typeof dateStr !== 'string' || !dateStr) return '---';
  const datePart = dateStr.split('T')[0];
  if (!datePart) return '---';
  const parts = datePart.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

const ArchiveManager: React.FC<ArchiveManagerProps> = ({ 
  services, 
  invoices, 
  vehicles, 
  customers, 
  companyInfo,
  hourlyRate,
  budgets,
  onDeleteBudget,
  onLoadBudget,
  search, 
  onSearchChange,
  onNavigateToOrder 
}) => {
  const [selectedYear, setSelectedYear] = useState<number | null>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [previewOrder, setPreviewOrder] = useState<ServiceRecord | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [activeType, setActiveType] = useState<'all' | 'orders' | 'invoices' | 'budgets'>('all');

  const handleOpenOrderPreview = (order: ServiceRecord) => {
    setPreviewInvoice(null);
    setPreviewOrder(order);
  };

  const handleOpenInvoicePreview = (inv: Invoice) => {
    setPreviewOrder(null);
    setPreviewInvoice(inv);
  };

  const filterFn = (item: any, type: 'order' | 'invoice' | 'budget') => {
    const dateStr = type === 'order' ? item.date : type === 'invoice' ? item.issueDate : item.date;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    
    const yearMatch = selectedYear === null || d.getFullYear() === selectedYear;
    const monthMatch = selectedMonth === null || d.getMonth() === selectedMonth;
    
    if (!yearMatch || !monthMatch) return false;
    if (!search) return true;

    const s = search.toLowerCase();
    if (type === 'order') {
      const vehicle = vehicles.find(v => v.id === item.vehicleId);
      const owner = customers.find(c => c.id === vehicle?.customerId);
      return (
        (item.id || "").toLowerCase().includes(s) ||
        (item.description || "").toLowerCase().includes(s) ||
        (vehicle?.licensePlate || "").toLowerCase().includes(s) ||
        (owner?.lastName || "").toLowerCase().includes(s) ||
        (owner?.companyName || "").toLowerCase().includes(s)
      );
    } else if (type === 'invoice') {
      const customer = customers.find(c => c.id === item.customerId);
      return (
        (item.id || "").toLowerCase().includes(s) ||
        (item.vehicleInfo || "").toLowerCase().includes(s) ||
        (customer?.lastName || "").toLowerCase().includes(s) ||
        (customer?.companyName || "").toLowerCase().includes(s)
      );
    } else {
      const vehicle = vehicles.find(v => v.id === item.vehicleId);
      const owner = customers.find(c => c.id === item.customerId);
      return (
        (vehicle?.licensePlate || "").toLowerCase().includes(s) ||
        (owner?.lastName || "").toLowerCase().includes(s) ||
        (owner?.companyName || "").toLowerCase().includes(s)
      );
    }
  };

  const archivedOrdersFiltered = useMemo(() => {
    return services
      .filter(s => (s.status === 'hotovo' || s.status === 'zrušeno'))
      .filter(s => filterFn(s, 'order'))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [services, search, selectedYear, selectedMonth, vehicles, customers]);

  const archivedInvoicesFiltered = useMemo(() => {
    return invoices
      .filter(inv => inv.archived === true)
      .filter(inv => filterFn(inv, 'invoice'))
      .sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || ""));
  }, [invoices, search, selectedYear, selectedMonth, customers]);

  const archivedBudgetFiltered = useMemo(() => {
    return budgets
      .filter(b => filterFn(b, 'budget'))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [budgets, search, selectedYear, selectedMonth, vehicles, customers]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    services.forEach(o => {
      if (o.date) years.add(new Date(o.date).getFullYear());
    });
    invoices.forEach(i => {
      if (i.issueDate) years.add(new Date(i.issueDate).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [services, invoices]);

  const handlePrint = () => window.print();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="print:hidden">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Archiv historie</h2>
        <p className="text-slate-500 font-medium">Přehled dokončených zakázek a archivovaných dokladů.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 print:hidden">
        <div className="lg:col-span-1 bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="flex flex-col gap-1 w-full text-[10px] font-black uppercase tracking-widest">
            <span className="text-slate-400 ml-1 mb-1">Typ dat</span>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setActiveType('all')}
                className={`py-2 rounded-xl transition-all ${activeType === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                VŠE
              </button>
              <button 
                onClick={() => setActiveType('budgets')}
                className={`py-2 rounded-xl transition-all px-2 flex items-center justify-center gap-1 ${activeType === 'budgets' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <Calculator className="w-3 h-3" /> Rozpočty
              </button>
              <button 
                onClick={() => setActiveType('orders')}
                className={`py-2 rounded-xl transition-all px-2 flex items-center justify-center gap-1 ${activeType === 'orders' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <ClipboardCheck className="w-3 h-3" /> Zakázky
              </button>
              <button 
                onClick={() => setActiveType('invoices')}
                className={`py-2 rounded-xl transition-all px-2 flex items-center justify-center gap-1 ${activeType === 'invoices' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <Receipt className="w-3 h-3" /> Faktury
              </button>
            </div>
          </div>
        </div>
        <div className="lg:col-span-2 bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 overflow-x-auto custom-scrollbar-h">
            <div className="flex gap-2 pb-2">
              <button onClick={() => setSelectedYear(null)} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all shrink-0 ${selectedYear === null ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-500'}`}>VŠE</button>
              {availableYears.map(year => (
                <button key={year} onClick={() => setSelectedYear(year)} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all shrink-0 ${selectedYear === year ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-500'}`}>{year}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedMonth(null)} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all shrink-0 ${selectedMonth === null ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>CELÝ ROK</button>
              {MONTHS.map((month, idx) => (
                <button key={month} onClick={() => setSelectedMonth(idx)} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all shrink-0 ${selectedMonth === idx ? 'bg-blue-500 text-white' : 'bg-slate-50 text-slate-400'}`}>{month.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Hledat..." 
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:divide-x divide-slate-200 print:hidden pb-20">
        {(activeType === 'all' || activeType === 'budgets') && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-500" />
                Archiv Rozpočtů ({archivedBudgetFiltered.length})
              </h3>
            </div>
            <div className="space-y-4">
              {archivedBudgetFiltered.map(budget => {
                const vehicle = vehicles.find(v => v.id === budget.vehicleId);
                const customer = customers.find(c => c.id === budget.customerId);
                return (
                  <div key={budget.id} className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:shadow-xl transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <Calculator className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-base font-black text-slate-900 uppercase italic">Rozpočet</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(budget.date)}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => onLoadBudget(budget)} title="Upravit / Tisknout" className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Printer className="w-5 h-5" /></button>
                        <button onClick={() => onDeleteBudget(budget.id)} title="Smazat" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <p className="text-sm font-bold text-slate-700 truncate">{customer?.companyName || `${customer?.firstName || ''} ${customer?.lastName || ''}`}</p>
                      <div className="flex items-center gap-2">
                        <Car className="w-3.5 h-3.5 text-slate-300" />
                        <span className="text-[10px] font-black text-indigo-600 uppercase font-mono tracking-wider">{vehicle?.licensePlate || '---'}</span>
                        <span className="text-[10px] font-bold text-slate-400">• {vehicle?.make} {vehicle?.model}</span>
                      </div>
                    </div>
                    
                    {budget.convertedToOrderId && (
                      <div className="mb-4 p-2 bg-emerald-50 rounded-xl flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span className="text-[9px] font-black text-emerald-700 uppercase italic">Převedeno na zakázku #{budget.convertedToOrderId}</span>
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                      <div className="flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase bg-slate-100 text-slate-500">ROZPOČET</span>
                      </div>
                      <p className="text-lg font-black text-slate-900">{budget.totalPriceInclVat.toLocaleString()} Kč <span className="text-[10px] font-bold text-slate-400">vč. DPH</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(activeType === 'all' || activeType === 'orders') && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-blue-500" />
                Historie Zakázek ({archivedOrdersFiltered.length})
              </h3>
            </div>
          <div className="space-y-4">
            {archivedOrdersFiltered.map(order => {
              const vehicle = vehicles.find(v => v.id === order.vehicleId);
              const customer = vehicle ? customers.find(c => c.id === vehicle.customerId) : null;
              return (
                <div key={order.id} className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:shadow-xl transition-all group cursor-pointer" onClick={() => handleOpenOrderPreview(order)}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <ClipboardCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900">#{order.id}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(order.date)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleOpenOrderPreview(order)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Eye className="w-5 h-5" /></button>
                      <button onClick={() => onNavigateToOrder(order.id)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-bold text-slate-700 truncate">{customer?.companyName || `${customer?.firstName || ''} ${customer?.lastName || ''}`}</p>
                    <div className="flex items-center gap-2">
                      <Car className="w-3.5 h-3.5 text-slate-300" />
                      <span className="text-[10px] font-black text-blue-600 uppercase font-mono tracking-wider">{vehicle?.licensePlate || '---'}</span>
                      <span className="text-[10px] font-bold text-slate-400">• {vehicle?.make} {vehicle?.model}</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${order.status === 'hotovo' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{order.status}</span>
                    <p className="text-lg font-black text-slate-900">{(order.cost * 1.21).toLocaleString()} Kč <span className="text-[10px] font-bold text-slate-400">vč. DPH</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(activeType === 'all' || activeType === 'invoices') && (
          <div className="lg:pl-8 space-y-6">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-500" />
                Archivované Faktury ({archivedInvoicesFiltered.length})
              </h3>
            </div>
          <div className="space-y-4">
            {archivedInvoicesFiltered.map(inv => {
              const customer = customers.find(c => c.id === inv.customerId);
              return (
                <div key={inv.id} className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:shadow-xl transition-all group cursor-pointer" onClick={() => handleOpenInvoicePreview(inv)}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Receipt className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900">{inv.id}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(inv.issueDate)}</p>
                      </div>
                    </div>
                    <button onClick={() => handleOpenInvoicePreview(inv)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"><Eye className="w-5 h-5" /></button>
                  </div>
                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-bold text-slate-700 truncate">{customer?.companyName || `${customer?.firstName || ''} ${customer?.lastName || ''}`}</p>
                    <p className="text-[10px] font-bold text-blue-600 uppercase truncate">{inv.vehicleInfo}</p>
                  </div>
                  <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="text-[9px] font-black uppercase text-emerald-600">Uhrazeno</span>
                    </div>
                    <p className="text-lg font-black text-slate-900">{inv.totalInclDph.toLocaleString()} Kč <span className="text-[10px] font-bold text-slate-400">vč. DPH</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>

      {(previewOrder || previewInvoice) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:p-0 print:bg-white print:absolute print:inset-0">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md no-print" onClick={() => { setPreviewOrder(null); setPreviewInvoice(null); }}></div>
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 print:h-auto print:static print:shadow-none print:bg-white print:rounded-none print:max-w-none print:w-full print:overflow-visible">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 shrink-0 no-print print:hidden">
               <div className="flex items-center gap-4">
                  <div className="bg-blue-600 p-2 rounded-xl text-white">
                    {previewOrder ? <ClipboardCheck className="w-6 h-6" /> : <Receipt className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Náhled dokumentu</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">#{previewOrder?.id || previewInvoice?.id}</p>
                  </div>
               </div>
               <div className="flex gap-4">
                  <button onClick={handlePrint} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-slate-800">
                    <Printer className="w-5 h-5" /> TISK / PDF
                  </button>
                  <button onClick={() => { setPreviewOrder(null); setPreviewInvoice(null); }} className="p-2 hover:bg-slate-200 rounded-xl">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-12 bg-slate-100 flex justify-center custom-scrollbar print:p-0 print:bg-white print:overflow-visible print:block">
               <div className="w-full max-w-[210mm] flex justify-center items-start min-h-full print:max-w-none print:w-full print:min-h-0 print:block">
                  {previewOrder && (
                    <div className="bg-white shadow-2xl print:shadow-none print:w-full print:p-0">
                      <PrintTemplate order={previewOrder} company={companyInfo} vehicles={vehicles} customers={customers} hourlyRate={hourlyRate} technicians={[]} isEditable={false} />
                    </div>
                  )}
                  {previewInvoice && (
                    <div className="w-full flex justify-center print:p-0">
                      <InvoicePrintTemplate invoice={previewInvoice} company={companyInfo} customers={customers} />
                    </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchiveManager;
