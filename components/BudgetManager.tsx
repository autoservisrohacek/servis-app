import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, Plus, Trash2, Printer, RotateCcw, Car, Search, User, CheckCircle2, Save, ShoppingCart, X, DollarSign, Package, Clock, Tag } from 'lucide-react';
import { Vehicle, Customer, CompanyInfo, ServiceRecord, Budget, BudgetItem, FixedService } from '../types';

interface BudgetManagerProps {
  vehicles: Vehicle[];
  customers: Customer[];
  companyInfo: CompanyInfo;
  hourlyRate: number;
  initialBudgetData?: Budget | null;
  onSaveBudget: (budget: Budget) => void;
  onClearInitialData: () => void;
  onCreateOrder: (orderData: Partial<ServiceRecord>) => void;
  onVehicleChange: (vehicleId: string) => void;
  onNavigateToLkq: () => void;
  fixedServices: FixedService[];
  onUpdateFixedService: (service: FixedService) => void;
}

const BudgetManager: React.FC<BudgetManagerProps> = ({ 
  vehicles, 
  customers, 
  companyInfo, 
  hourlyRate, 
  initialBudgetData,
  onSaveBudget,
  onClearInitialData,
  onCreateOrder,
  onVehicleChange,
  onNavigateToLkq,
  fixedServices,
  onUpdateFixedService
}) => {
  const [currentBudgetId, setCurrentBudgetId] = useState<string>(`budget-${Date.now()}`);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [laborHours, setLaborHours] = useState<number>(0);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isPriceListPickerOpen, setIsPriceListPickerOpen] = useState(false);
  const [pricelistSearch, setPricelistSearch] = useState('');
  const pricelistInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPriceListPickerOpen) {
      setPricelistSearch('');
      setTimeout(() => {
        if (pricelistInputRef.current) pricelistInputRef.current.focus();
      }, 100);
    }
  }, [isPriceListPickerOpen]);

  useEffect(() => {
    if (initialBudgetData) {
      setCurrentBudgetId(initialBudgetData.id);
      setSelectedVehicleId(initialBudgetData.vehicleId);
      onVehicleChange(initialBudgetData.vehicleId);
      setLaborHours(initialBudgetData.laborHours);
      setItems(initialBudgetData.items);
      
      const v = vehicles.find(veh => veh.id === initialBudgetData.vehicleId);
      if (v) {
        setSearchQuery(`${v.licensePlate} - ${v.make} ${v.model}`);
      }
      
      // Clear navigation state so it doesn't re-trigger
      onClearInitialData();
    }
  }, [initialBudgetData, vehicles, onClearInitialData, onVehicleChange]);

  const selectedVehicle = useMemo(() => 
    vehicles.find(v => v.id === selectedVehicleId), 
    [vehicles, selectedVehicleId]
  );

  const selectedCustomer = useMemo(() => 
    selectedVehicle ? customers.find(c => c.id === selectedVehicle.customerId) : null,
    [selectedVehicle, customers]
  );

  const filteredVehicles = useMemo(() => {
    if (!searchQuery) return [];
    return vehicles.filter(v => 
      v.licensePlate?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.model.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);
  }, [vehicles, searchQuery]);

  const laborTotal = laborHours * hourlyRate;
  const itemsTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalBase = laborTotal + itemsTotal;
  const vatAmount = companyInfo.isVatPayer ? totalBase * 0.21 : 0;
  const totalWithVat = totalBase + vatAmount;

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), description: '', quantity: 1, unit: 'ks', unitPrice: 0 }]);
  };

  const updateItem = (id: string, field: keyof BudgetItem, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const [pricelistActiveTab, setPricelistActiveTab] = useState<'díly' | 'úkony' | 'materiál'>('díly');

  const addFromPriceList = (item: FixedService) => {
    setItems([...items, { 
      id: Date.now().toString(), 
      description: item.name, 
      quantity: 1, 
      unit: item.unit || 'ks', 
      unitPrice: item.price 
    }]);
    
    // Update usage count
    onUpdateFixedService({
      ...item,
      usageCount: (item.usageCount || 0) + 1
    });
    
    setIsPriceListPickerOpen(false);
  };

  const handleReset = () => {
    if (confirm('Opravdu chcete vymazat rozpočet?')) {
      setCurrentBudgetId(`budget-${Date.now()}`);
      setSelectedVehicleId('');
      onVehicleChange('');
      setLaborHours(0);
      setItems([]);
      setSearchQuery('');
      setSaveStatus('idle');
    }
  };

  const handleSave = () => {
    if (!selectedVehicleId) {
      alert('Nejdříve vyberte vozidlo.');
      return;
    }

    setSaveStatus('saving');
    const budget: Budget = {
      id: currentBudgetId,
      vehicleId: selectedVehicleId,
      customerId: selectedVehicle?.customerId || '',
      date: new Date().toISOString().split('T')[0],
      laborHours,
      items,
      totalPriceExclVat: totalBase,
      totalPriceInclVat: totalWithVat,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    onSaveBudget(budget);
    
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const handlePrint = () => {
    if (!selectedVehicleId) {
      alert('Nejdříve vyberte vozidlo.');
      return;
    }

    // Create a hidden iframe for isolated printing (standard for Electron environments)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    // Build the clean HTML for the budget with inline CSS (no Tailwind for print safety)
    const budgetHtml = `
      <!DOCTYPE html>
      <html lang="cs">
      <head>
        <meta charset="UTF-8">
        <title>Kalkulace opravy - ${selectedVehicle?.licensePlate || ''}</title>
        <style>
          @page {
            size: A4;
            margin: 10mm;
          }
          html, body, #root, .budget-print-container {
            height: auto !important;
            overflow: visible !important;
          }
          body { 
            font-family: 'Arial', sans-serif; 
            color: #000; 
            background: #fff; 
            padding: 10mm; 
            line-height: 1.4; 
            width: 210mm;
            margin: 0 auto;
            box-sizing: border-box;
          }
          .budget-print-container {
            width: 100%;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            border-bottom: 4px solid #000; 
            padding-bottom: 15px; 
            margin-bottom: 20px; 
          }
          .company-name { 
            font-size: 24px; 
            font-weight: 900; 
            text-transform: uppercase; 
            margin-bottom: 5px; 
            font-style: italic;
            letter-spacing: -0.5px;
          }
          .company-info { 
            font-size: 11px; 
            font-weight: bold; 
            color: #333; 
          }
          .title-area { 
            text-align: right; 
          }
          .title { 
            font-size: 20px; 
            font-weight: 900; 
            text-transform: uppercase; 
            color: #999; 
            margin-bottom: 10px;
            letter-spacing: 2px;
          }
          .date-box { 
            border: 2px solid #000; 
            padding: 5px 15px; 
            font-weight: 900; 
            display: inline-block; 
            font-size: 12px; 
          }
          
          .grid { 
            display: flex; 
            gap: 40px; 
            margin-bottom: 30px; 
          }
          .grid-item { 
            flex: 1; 
            padding: 20px; 
            border: 1px solid #eee; 
            border-radius: 10px; 
            background: #fafafa; 
          }
          .label { 
            font-size: 9px; 
            font-weight: 900; 
            text-transform: uppercase; 
            color: #999; 
            display: block; 
            margin-bottom: 5px; 
          }
          .value { 
            font-size: 16px; 
            font-weight: 900; 
            margin-bottom: 2px; 
          }
          .sub-value { 
            font-size: 11px; 
            color: #666; 
            font-weight: bold; 
          }
          
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px; 
            table-layout: fixed;
          }
          thead {
            display: table-header-group !important;
          }
          th { 
            border-bottom: 2px solid #000; 
            padding: 6px 8px; 
            text-align: left; 
            font-size: 10px; 
            font-weight: 900; 
            text-transform: uppercase; 
            background: #f5f5f5; 
          }
          td { 
            border-bottom: 1px solid #eee; 
            padding: 4px 8px; 
            vertical-align: middle; 
            font-size: 11px;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .item-desc {
            font-weight: 900;
            font-size: 11px;
            line-height: 1.2;
          }
          .item-sub {
            font-size: 9px;
            color: #666;
            text-transform: uppercase;
            margin-top: 1px;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          
          .totals-area { 
            display: flex; 
            justify-content: flex-end; 
            margin-bottom: 40px; 
          }
          .totals-box { 
            width: 320px; 
          }
          .total-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 4px 0; 
            font-size: 11px; 
            font-weight: bold; 
            color: #666; 
          }
          .final-row { 
            border-top: 3px solid #000; 
            margin-top: 5px; 
            padding-top: 10px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
          }
          .final-label { 
            font-size: 12px; 
            font-weight: 900; 
            text-transform: uppercase; 
            color: #444; 
          }
          .final-price { 
            font-size: 18px; 
            font-weight: 900; 
            color: #000; 
          }
          
          .footer { 
            border-top: 1px solid #eee; 
            padding-top: 20px; 
            display: flex; 
            justify-content: space-between; 
            margin-top: 20px; 
            break-inside: avoid;
          }
          .disclaimer { 
            font-size: 9px; 
            font-weight: bold; 
            font-style: italic; 
            color: #555; 
            max-width: 450px; 
            line-height: 1.5;
          }
          .signature { 
            text-align: center; 
            width: 220px; 
          }
          .sig-line { 
            border-bottom: 1.5px solid #000; 
            margin-bottom: 8px;
          }
          .sig-label {
            font-size: 9px; 
            font-weight: 900; 
            text-transform: uppercase;
            color: #444;
          }
          @media print { 
            body { 
              padding: 15mm; 
              margin: 0 auto;
              width: 210mm;
            } 
          }
        </style>
      </head>
      <body>
        <div class="budget-print-container">
          <div class="header">
          <div>
            <div class="company-name">${companyInfo.name}</div>
            <div class="company-info">
              ${companyInfo.address}<br>
              IČO: ${companyInfo.ico} ${companyInfo.dic ? `| DIČ: ${companyInfo.dic}` : ''}<br>
              TEL: ${companyInfo.phone} | EMAIL: ${companyInfo.email}
            </div>
          </div>
          <div class="title-area">
            <div class="title">Kalkulace opravy</div>
            <div class="date-box">DATUM: ${new Date().toLocaleDateString('cs-CZ')}</div>
          </div>
        </div>

        <div class="grid">
          <div class="grid-item">
            <span class="label">Zákazník</span>
            <div class="value">${selectedCustomer ? (selectedCustomer.companyName || `${selectedCustomer.firstName} ${selectedCustomer.lastName}`) : 'Neznámý zákazník'}</div>
            <div class="sub-value">${selectedCustomer?.address || ''}</div>
            ${selectedCustomer?.phone ? `<div class="sub-value" style="margin-top:5px">Tel: ${selectedCustomer.phone}</div>` : ''}
          </div>
          <div class="grid-item">
            <span class="label">Vozidlo</span>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px">
              <div style="border: 1px solid #000; padding: 2px 8px; font-size: 14px; font-weight: 900; font-family: monospace;">${selectedVehicle?.licensePlate || '---'}</div>
              <div style="font-size: 16px; font-weight: 900;">${selectedVehicle?.make} ${selectedVehicle?.model}</div>
            </div>
            <div class="sub-value">Rok výroby: ${selectedVehicle?.year || '---'}</div>
            <div class="sub-value" style="opacity:0.6">VIN: ${selectedVehicle?.vin || '---'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th width="50%">Popis položky / práce</th>
              <th width="15%" class="text-center">Množství</th>
              <th width="15%" class="text-right">Cena/Jedn.</th>
              <th width="20%" class="text-right">Celkem</th>
            </tr>
          </thead>
          <tbody>
            ${laborHours > 0 ? `
              <tr>
                <td>
                  <div class="item-desc">Servisní práce</div>
                  <div class="item-sub">Sazba: ${hourlyRate.toLocaleString()} Kč/h</div>
                </td>
                <td class="text-center" style="font-weight:900">${laborHours} h</td>
                <td class="text-right" style="font-weight:bold; color: #444">${hourlyRate.toLocaleString()} Kč</td>
                <td class="text-right" style="font-weight:900">${laborTotal.toLocaleString()} Kč</td>
              </tr>
            ` : ''}
            ${items.map(item => `
              <tr>
                <td><div class="item-desc">${item.description || 'Položka'}</div></td>
                <td class="text-center" style="font-weight:900">${item.quantity} ${item.unit}</td>
                <td class="text-right" style="font-weight:bold; color: #444">${item.unitPrice.toLocaleString()} Kč</td>
                <td class="text-right" style="font-weight:900">${(item.quantity * item.unitPrice).toLocaleString()} Kč</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-area">
          <div class="totals-box">
             ${companyInfo.isVatPayer ? `
               <div class="total-row">
                  <span style="font-weight:900; text-transform: uppercase; font-size: 10px; color: #999">Základ bez DPH</span>
                  <span style="color: #000; font-size: 14px">${totalBase.toLocaleString()} Kč</span>
               </div>
               <div class="total-row" style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px">
                  <span style="font-weight:900; text-transform: uppercase; font-size: 10px; color: #999">DPH (21%)</span>
                  <span style="color: #000; font-size: 14px">${vatAmount.toLocaleString()} Kč</span>
               </div>
               <div class="final-row">
                  <div style="display:flex; flex-direction:column">
                    <span class="final-label">Celkem k úhradě</span>
                    <span style="font-size:8px; font-weight:900; text-transform:uppercase; color: #999; letter-spacing:1px; margin-top: 2px">včetně DPH</span>
                  </div>
                  <div class="final-price">${totalWithVat.toLocaleString()} Kč</div>
               </div>
             ` : `
               <div class="final-row">
                  <span class="final-label">Celková cena</span>
                  <div class="final-price">${totalBase.toLocaleString()} Kč</div>
               </div>
             `}
          </div>
        </div>

        <div class="footer">
          <div class="disclaimer">
             Tento dokument je předběžná kalkulace a neslouží jako daňový doklad. Konečná cena může být upravena na základě skutečně provedených prací a zjištěného stavu vozidla během opravy. Finální vyúčtování proběhne řádným daňovým dokladem po ukončení servisu.
          </div>
          <div class="signature">
            <div class="sig-line"></div>
            <div class="sig-label">Razítko a podpis servisu</div>
          </div>
        </div>
        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(budgetHtml);
    doc.close();

    // Small delay to ensure styles and logic are fully ready before printing
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        // Remove iframe after user closes print dialog
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    };
  };

  const handleConvertToOrder = () => {
    if (!selectedVehicleId) {
      alert('Nejdříve vyberte vozidlo.');
      return;
    }

    // Save budget first
    const budget: Budget = {
      id: currentBudgetId,
      vehicleId: selectedVehicleId,
      customerId: selectedVehicle?.customerId || '',
      date: new Date().toISOString().split('T')[0],
      laborHours,
      items,
      totalPriceExclVat: totalBase,
      totalPriceInclVat: totalWithVat,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    onSaveBudget(budget);

    const orderParts: any[] = items.map(item => ({
      id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      costPrice: 0 // Budget usually doesn't have cost price
    }));

    onCreateOrder({
      vehicleId: selectedVehicleId,
      description: `Převedeno z rozpočtu: ${items.length > 0 ? items[0].description : 'Servisní práce'}`,
      laborHours: laborHours,
      parts: orderParts,
      date: new Date().toISOString().split('T')[0],
      status: 'naplánováno',
      convertedFromBudgetId: currentBudgetId
    });

    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {showSuccessToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-2xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-200" />
            Vytvořen koncept zakázky! Můžete přejít do modulu Zakázky.
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Calculator className="text-white w-7 h-7" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Kalkulace opravy</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Předběžný rozpočet pro zákazníka</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 no-print">
          <button onClick={handleReset} className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-all flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Vymazat
          </button>
          <button onClick={handleSave} className={`px-6 py-4 rounded-2xl font-black text-xs uppercase transition-all flex items-center gap-2 ${saveStatus === 'saved' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
            {saveStatus === 'saving' ? 'Ukládám...' : saveStatus === 'saved' ? <><CheckCircle2 className="w-4 h-4" /> Uloženo</> : <><Save className="w-4 h-4" /> Uložit</>}
          </button>
          <button onClick={handleConvertToOrder} className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Vytvořit zakázku
          </button>
          <button onClick={handlePrint} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-2">
            <Printer className="w-4 h-4" /> Tisk rozpočtu
          </button>
          {selectedVehicle?.vin && (
            <button 
              onClick={onNavigateToLkq} 
              className="px-6 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase hover:border-indigo-600 hover:text-indigo-600 transition-all flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" /> Hledat v Profi Garáži
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Editor */}
        <div className="lg:col-span-2 space-y-8 no-print">
          {/* Výběr vozu */}
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm space-y-6">
            <h3 className="font-black uppercase text-xs tracking-widest text-slate-400 flex items-center gap-2">
              <Car className="w-4 h-4" /> Informace o vozidle
            </h3>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input 
                type="text"
                placeholder="Vyhledat SPZ, značku nebo model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none font-bold text-slate-900 transition-all"
              />
              
              {filteredVehicles.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden">
                  {filteredVehicles.map(v => (
                    <button 
                      key={v.id}
                      onClick={() => {
                        setSelectedVehicleId(v.id);
                        onVehicleChange(v.id);
                        setSearchQuery(`${v.licensePlate} - ${v.make} ${v.model}`);
                      }}
                      className="w-full p-4 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors flex items-center justify-between"
                    >
                      <span className="font-black text-slate-900">{v.licensePlate}</span>
                      <span className="text-slate-400 font-bold text-xs uppercase">{v.make} {v.model}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedVehicle && (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
                    <User className="text-indigo-600 w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Zákazník</span>
                    <span className="font-black text-slate-900 text-lg">
                      {selectedCustomer ? (selectedCustomer.companyName || `${selectedCustomer.firstName} ${selectedCustomer.lastName}`) : 'Neznámý'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Práce a položky */}
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="font-black uppercase text-xs tracking-widest text-slate-400 flex items-center gap-2">
                <Calculator className="w-4 h-4" /> Položky rozpočtu
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsPriceListPickerOpen(true)}
                  className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition-all"
                >
                  <DollarSign className="w-4 h-4" /> Vybrat z ceníku
                </button>
                <button onClick={addItem} className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-all">
                  <Plus className="w-4 h-4" /> Přidat položku
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* Práce */}
              <div className="grid grid-cols-12 gap-4 items-end">
                <div className="col-span-8">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Servisní práce</label>
                  <input readOnly value={`Servisní práce (Sazba: ${hourlyRate} Kč/h)`} className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-4 py-4 font-bold text-slate-400 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Hodin</label>
                  <input 
                    type="number"
                    value={laborHours || ''}
                    onChange={(e) => setLaborHours(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl px-4 py-4 font-black text-slate-900 text-center outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Celkem</label>
                  <div className="py-4 font-black text-slate-900 text-right pr-2">
                    {laborTotal.toLocaleString()} Kč
                  </div>
                </div>
              </div>

              {/* Ostatní položky */}
              {items.map(item => (
                <div key={item.id} className="grid grid-cols-12 gap-4 items-end animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="col-span-5">
                    <input 
                      placeholder="Název dílu / materiálu..."
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl px-4 py-4 font-bold text-slate-900 outline-none"
                    />
                  </div>
                  <div className="col-span-1">
                    <select 
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl px-2 py-4 font-black text-slate-900 text-center outline-none appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <option value="ks">ks</option>
                      <option value="l">l</option>
                      <option value="g">g</option>
                      <option value="sada">sada</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="number"
                      placeholder="Částka"
                      value={item.unitPrice || ''}
                      onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl px-4 py-4 font-black text-slate-900 text-center outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center bg-slate-50 border-2 border-transparent focus-within:border-indigo-600 rounded-2xl transition-all h-[58px]">
                      <button 
                        onClick={() => updateItem(item.id, 'quantity', Math.max(0, (item.quantity || 0) - 1))}
                        className="px-3 text-slate-400 hover:text-indigo-600 transition-colors font-black text-xl"
                      >
                        -
                      </button>
                      <input 
                        type="number"
                        value={item.quantity || 0}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent font-black text-slate-900 text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button 
                        onClick={() => updateItem(item.id, 'quantity', (item.quantity || 0) + 1)}
                        className="px-3 text-slate-400 hover:text-indigo-600 transition-colors font-black text-xl"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="col-span-1">
                    <div className="py-4 font-black text-slate-900 text-right pr-2">
                      {(item.quantity * item.unitPrice).toLocaleString()} Kč
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-center pb-3">
                    <button onClick={() => removeItem(item.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sumarizace */}
        <div className="space-y-6 no-print">
          <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
             
             <h3 className="font-black uppercase text-[10px] tracking-[0.3em] text-indigo-400 mb-8 border-b border-white/10 pb-4">
                Rekapitulace Rozpočtu
             </h3>

             <div className="space-y-6">
                <div className="flex justify-between items-center text-slate-400 font-bold uppercase text-[10px]">
                   <span>Práce celkem</span>
                   <span className="text-white text-base font-black">{laborTotal.toLocaleString()} Kč</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 font-bold uppercase text-[10px]">
                   <span>Materiál celkem</span>
                   <span className="text-white text-base font-black">{itemsTotal.toLocaleString()} Kč</span>
                </div>
                
                <div className="pt-6 mt-6 border-t border-white/10 flex justify-between items-center">
                   <div className="flex flex-col">
                      <span className="text-indigo-400 font-black uppercase text-[10px] tracking-widest mb-1">Celková cena</span>
                      <span className="text-3xl font-black italic tracking-tighter">{totalWithVat.toLocaleString()} Kč</span>
                   </div>
                </div>

                {companyInfo.isVatPayer && (
                  <div className="text-[10px] font-bold text-slate-500 italic mt-4">
                    Cena obsahuje DPH 21% ({vatAmount.toLocaleString()} Kč)
                  </div>
                )}
             </div>
          </div>

          <div className="p-8 bg-indigo-50 border-2 border-indigo-100 rounded-[2.5rem]">
            <h4 className="font-black text-indigo-900 uppercase text-xs mb-3">Informace</h4>
            <p className="text-indigo-700/70 text-xs font-medium leading-relaxed">
              Tento rozpočet je orientační a slouží pro potřeby zákazníka. Pro finální vyúčtování použijte modul Zakázky a následnou fakturaci.
            </p>
          </div>
        </div>
      </div>

      {isPriceListPickerOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsPriceListPickerOpen(false)}></div>
          <div className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-emerald-600 p-6 text-white">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black uppercase">Vybrat z ceníku</h3>
                <button onClick={() => setIsPriceListPickerOpen(false)}><X className="w-6 h-6" /></button>
              </div>

              <div className="flex p-1 bg-emerald-700/50 rounded-xl">
                {[
                  { id: 'díly', label: 'Díly', icon: Package },
                  { id: 'úkony', label: 'Úkony', icon: Clock },
                  { id: 'materiál', label: 'Materiál', icon: Tag }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setPricelistActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase transition-all ${pricelistActiveTab === tab.id ? 'bg-white text-emerald-600 shadow-md' : 'text-emerald-100 hover:text-white hover:bg-emerald-600'}`}
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
                  placeholder={`Hledat v sekci ${pricelistActiveTab}...`} 
                  className="w-full pl-11 pr-4 py-3 bg-white border-2 border-transparent focus:border-emerald-500 rounded-xl outline-none font-bold text-sm transition-all"
                  value={pricelistSearch}
                  onChange={(e) => setPricelistSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="p-6 max-h-[50vh] overflow-y-auto custom-scrollbar space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Ceny v ceníku jsou bez DPH {companyInfo.isVatPayer ? '(v rozpočtu se DPH přičte)' : ''}
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
    </div>
  );
};

export default BudgetManager;
