import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SmsMessage, SmsSettings, Vehicle, Customer, CompanyInfo, NotificationSettings } from '../types';
import { Send, Clock, RotateCcw, CheckCircle, XCircle, AlertCircle, Settings as SettingsIcon, MessageSquare, Search, Trash2, ShieldAlert, ShieldCheck } from 'lucide-react';

interface CommunicationCenterProps {
  vehicles: Vehicle[];
  customers: Customer[];
  messages: SmsMessage[];
  setMessages: React.Dispatch<React.SetStateAction<SmsMessage[]>>;
  settings: SmsSettings;
  setSettings: React.Dispatch<React.SetStateAction<SmsSettings>>;
  companyInfo: CompanyInfo;
  notifSettings: NotificationSettings;
}

const CommunicationCenter: React.FC<CommunicationCenterProps> = ({ vehicles, customers, messages, setMessages, settings, setSettings, companyInfo, notifSettings }) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'settings'>('queue');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);

  const removeDiacritics = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const formatDateForSms = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${day}.${month}.`;
  };

  const calculateNextDate = (lastDate: string | undefined, intervalMonths: number | undefined) => {
    if (!lastDate || !intervalMonths || intervalMonths === 0) return null;
    const date = new Date(lastDate);
    if (isNaN(date.getTime())) return null;
    date.setMonth(date.getMonth() + intervalMonths);
    return date;
  };

  // Generování fronty při načtení
  const generateQueue = useCallback(() => {
    setMessages(prevMessages => {
      const newMessages: SmsMessage[] = [];
      const today = new Date();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const isAlreadySuggestedOrSent = (vehicleId: string, item: string) => {
        // Kontrola v aktuálně existujících zprávách (prop messages)
        return prevMessages.some(m => 
          m.vehicleId === vehicleId && 
          m.serviceItem === item && 
          new Date(m.createdAt) > sixMonthsAgo
        );
      };

      vehicles.forEach(vehicle => {
        const customer = customers.find(c => c.id === vehicle.customerId);
        if (!customer || !customer.phone) return;

        const checkItem = (type: 'stk' | 'oil', dateStr: string | undefined, label: string, threshold: number, intervalMonths?: number) => {
          if (!dateStr) return;
          
          let targetDate: Date;
          if (intervalMonths) {
            const calculated = calculateNextDate(dateStr, intervalMonths);
            if (!calculated) return;
            targetDate = calculated;
          } else {
            targetDate = new Date(dateStr);
          }
          
          if (isNaN(targetDate.getTime())) return;
          
          const diffTime = targetDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          // Pokud je v limitu pro upozornění
          if (diffDays <= threshold) {
            if (!isAlreadySuggestedOrSent(vehicle.id, label)) {
              // --- Tvorba textu ---
              const template = type === 'stk' ? settings.stkTemplate : settings.oilTemplate;
              const dateToFormat = targetDate.toISOString().split('T')[0];
              const formattedDate = formatDateForSms(dateToFormat);
              
              let text = template
                .replace(/{SPZ}/gi, vehicle.licensePlate || '')
                .replace(/{Rz}/gi, vehicle.licensePlate || '')
                .replace(/{polozka}/gi, label)
                .replace(/\{datum(?:_stk)?\}/gi, formattedDate || 'termín brzy')
                .replace(/{JmenoServisu}/gi, companyInfo.name || '')
                .replace(/{Telefon}/gi, companyInfo.phone || '');
              
              text = removeDiacritics(text);

              const id = `sms-${vehicle.id}-${label.replace(/\s+/g, '')}-${dateToFormat}`;
              if (!newMessages.find(m => m.id === id)) {
                newMessages.push({
                  id,
                  recipientPhone: customer.phone,
                  recipientName: customer.firstName ? `${customer.firstName} ${customer.lastName}` : customer.companyName,
                  customerId: customer.id,
                  vehicleReg: vehicle.licensePlate,
                  vehicleId: vehicle.id,
                  serviceItem: label,
                  text: text,
                  status: 'Čeká na odeslání',
                  createdAt: today.toISOString(),
                  type: type
                });
              }
            }
          }
        };

        // 1. STK
        checkItem('stk', vehicle.stkExpirationDate, 'STK', notifSettings.stkThresholdDays);
        
        // 2. Obecný servis
        checkItem('oil', vehicle.nextServiceDate, 'Servisní prohlídka', notifSettings.serviceThresholdDays);
        
        // 3. Olej
        checkItem('oil', vehicle.oilChangeDate, 'Motorový olej', notifSettings.serviceThresholdDays, vehicle.oilChangeInterval || 12);
        
        // 4. Ostatní
        checkItem('oil', vehicle.brakeFluidDate, 'Brzdová kapalina', 15, vehicle.brakeFluidInterval || 24);
        checkItem('oil', vehicle.coolantDate, 'Chladicí kapalina', 15, vehicle.coolantInterval || 60);
        checkItem('oil', vehicle.timingBeltDate, 'Rozvody motoru', 30, vehicle.timingBeltInterval || 120);
        checkItem('oil', vehicle.refrigerantDate, 'Plnění klimatizace', 15, vehicle.refrigerantInterval || 24);
        
        // 5. Převodovka
        if (vehicle.gearboxType === 'MAN') {
          checkItem('oil', vehicle.gearboxOilDate, 'Olej v převodovce', 15, vehicle.gearboxOilInterval || 60);
        } else {
          // Pro automat se často řeší spíše kilometry, ale pokud je datum, zkontrolujeme ho taky
          if (vehicle.gearboxOilDate) {
            checkItem('oil', vehicle.gearboxOilDate, 'Olej v převodovce', 15, vehicle.gearboxOilInterval || 60);
          }
        }
      });

      if (newMessages.length > 0) {
        return [...prevMessages, ...newMessages];
      }
      return prevMessages;
    });
  }, [vehicles, customers, settings, companyInfo, notifSettings, messages, setMessages]);

  useEffect(() => {
    generateQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const queue = useMemo(() => messages.filter(m => m.status === 'Čeká na odeslání'), [messages]);
  const history = useMemo(() => messages.filter(m => m.status !== 'Čeká na odeslání').sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [messages]);

  const sendSms = async (phone: string, text: string, sender: string) => {
    // BulkGate HTTP Advanced API Integration
    const endpoint = 'https://portal.bulkgate.com/api/1.0/advanced/transactional';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BulkGate-Application-Id': settings.applicationId || '',
          'X-BulkGate-Application-Token': settings.applicationToken || '',
        },
        body: JSON.stringify({
          number: phone.replace(/\s/g, ''),
          text: text,
          unicode: true,
          sender_id: sender || "gSystem"
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || errorData.message || `API Error ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error('BulkGate Send Error:', err);
      throw err;
    }
  };

  const handleSendSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsSending(true);

    const msgsToSend = queue.filter(m => selectedIds.has(m.id));
    
    for (const msg of msgsToSend) {
      try {
        if (!settings.applicationId || !settings.applicationToken) {
          throw new Error("Chybí Application ID nebo Token pro BulkGate");
        }
        
        await sendSms(msg.recipientPhone, msg.text, settings.senderId || 'Info');
        
        // Úspěšné odeslání
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'Odesláno', sentAt: new Date().toISOString() } : m));
      } catch (err: any) {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'Chyba', errorMessage: err.message, sentAt: new Date().toISOString() } : m));
      }
    }

    setIsSending(false);
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    
    setMessages(prev => prev.map(m => 
      selectedIds.has(m.id) && m.status === 'Čeká na odeslání' 
        ? { ...m, status: 'Zrušeno', sentAt: new Date().toISOString() } 
        : m
    ));
    
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === queue.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(queue.map(q => q.id)));
    }
  };

  const statusColors = {
    'Čeká na odeslání': 'bg-amber-100 text-amber-700',
    'Odesláno': 'bg-blue-100 text-blue-700',
    'Doručeno': 'bg-emerald-100 text-emerald-700',
    'Chyba': 'bg-red-100 text-red-700',
    'Zrušeno': 'bg-slate-100 text-slate-600'
  };

  const statusIcons = {
    'Čeká na odeslání': <Clock className="w-4 h-4" />,
    'Odesláno': <Send className="w-4 h-4" />,
    'Doručeno': <CheckCircle className="w-4 h-4" />,
    'Chyba': <XCircle className="w-4 h-4" />,
    'Zrušeno': <AlertCircle className="w-4 h-4" />
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Komunikační centrum</h2>
          <p className="text-slate-500 font-medium">Automatické upozornění zákazníků na STK a olejové servisy.</p>
        </div>
      </div>

      <div className="flex bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm inline-flex">
        <button onClick={() => setActiveTab('queue')} className={`flex items-center gap-2 px-6 py-4 font-black text-xs uppercase tracking-widest transition-colors ${activeTab === 'queue' ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}>
          <Clock className="w-4 h-4" />
          Fronta k odeslání
          {queue.length > 0 && <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full">{queue.length}</span>}
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-6 py-4 font-black text-xs uppercase tracking-widest transition-colors ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}>
          <RotateCcw className="w-4 h-4" />
          Historie
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-2 px-6 py-4 font-black text-xs uppercase tracking-widest transition-colors ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}>
          <SettingsIcon className="w-4 h-4" />
          Nastavení brány
        </button>
      </div>

      {activeTab === 'queue' && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-black text-slate-900 uppercase tracking-widest">Fronta zpráv ({queue.length})</h3>
            <div className="flex gap-3">
              <button 
                onClick={generateQueue}
                className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase hover:bg-slate-50 transition-all shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Aktualizovat frontu
              </button>
              <button 
                disabled={selectedIds.size === 0 || isSending}
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 px-4 py-3 bg-white border border-red-200 text-red-600 rounded-xl font-black text-xs uppercase hover:bg-red-50 disabled:opacity-50 transition-all shadow-sm"
                title="Odstranit bez odeslání"
              >
                <Trash2 className="w-4 h-4" />
                Smazat ({selectedIds.size})
              </button>
              <button 
                disabled={selectedIds.size === 0 || isSending}
                onClick={handleSendSelected}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm shadow-blue-200"
              >
                {isSending ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Odeslat Vybrané ({selectedIds.size})
              </button>
            </div>
          </div>
          <div className="p-6">
            {queue.length === 0 ? (
              <div className="text-center py-10">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h4 className="text-lg font-black text-slate-400">Fronta je prázdná</h4>
                <p className="text-slate-500 mt-2">Všechny SMS pro upozornění na STK/Olejové intervaly byly odeslány.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <div className="col-span-1 border-slate-300 rounded cursor-pointer" onClick={toggleSelectAll}>
                    <input type="checkbox" checked={selectedIds.size === queue.length && queue.length > 0} readOnly />
                  </div>
                  <div className="col-span-2">Příjemce</div>
                  <div className="col-span-2">Vozidlo</div>
                  <div className="col-span-1">Typ</div>
                  <div className="col-span-6">Text zprávy</div>
                </div>
                {queue.map(msg => {
                  const customer = customers.find(c => c.id === msg.customerId);
                  const hasConsent = customer?.gdprConsent || false;
                  
                  return (
                    <div 
                      key={msg.id} 
                      className={`grid grid-cols-12 gap-4 p-4 rounded-2xl items-center transition-colors cursor-pointer border-2 ${
                        selectedIds.has(msg.id) ? 'border-blue-200' : 'border-transparent'
                      } ${
                        !hasConsent ? 'bg-red-50/50 hover:bg-red-100/50' : 'bg-slate-50 hover:bg-blue-50/50'
                      }`} 
                      onClick={() => toggleSelect(msg.id)}
                    >
                      <div className="col-span-1">
                        <input type="checkbox" checked={selectedIds.has(msg.id)} readOnly className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="col-span-2">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 text-sm">{msg.recipientName}</p>
                            {!hasConsent && (
                              <div className="flex items-center gap-1 text-red-600 animate-pulse" title="Chybí souhlas GDPR">
                                <ShieldAlert className="w-3 h-3" />
                                <span className="text-[8px] font-black uppercase">! GDPR</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-bold">{msg.recipientPhone}</p>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="px-2 py-1 bg-white border border-slate-200 rounded font-mono font-bold text-xs uppercase">{msg.vehicleReg}</span>
                      </div>
                      <div className="col-span-1">
                        <span className={`px-2 py-1 rounded inline-block text-[10px] font-black uppercase tracking-widest ${msg.type === 'stk' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                          {msg.type === 'custom' ? 'Servis' : `Návrh: ${msg.type.toUpperCase()}`}
                        </span>
                      </div>
                      <div className="col-span-6">
                        <p className="text-xs text-slate-600 font-medium line-clamp-2">{msg.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-black text-slate-900 uppercase tracking-widest">Historie odeslaných SMS</h3>
          </div>
          <div className="p-6">
            {history.length === 0 ? (
              <div className="text-center py-10">
                <RotateCcw className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h4 className="text-lg font-black text-slate-400">Historie je prázdná</h4>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <div className="col-span-2">Datum</div>
                  <div className="col-span-2">Příjemce</div>
                  <div className="col-span-2">Vozidlo</div>
                  <div className="col-span-4">Text zprávy</div>
                  <div className="col-span-2 text-right">Stav</div>
                </div>
                {history.map(msg => (
                  <div key={msg.id} className="grid grid-cols-12 gap-4 p-4 bg-slate-50 rounded-2xl items-center">
                    <div className="col-span-2">
                       <p className="text-xs font-bold text-slate-700">{new Date(msg.sentAt || msg.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="font-bold text-slate-900 text-sm">{msg.recipientName}</p>
                      <p className="text-xs text-slate-500 font-bold">{msg.recipientPhone}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="px-2 py-1 bg-white border border-slate-200 rounded font-mono font-bold text-xs uppercase">{msg.vehicleReg}</span>
                    </div>
                    <div className="col-span-4">
                      <p className="text-xs text-slate-600 font-medium line-clamp-2" title={msg.text}>{msg.text}</p>
                      {msg.errorMessage && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">Chyba: {msg.errorMessage}</p>}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${statusColors[msg.status]}`}>
                        {statusIcons[msg.status]}
                        {msg.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
             <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-widest"><SettingsIcon className="w-5 h-5 text-blue-600" /> Nastavení API Brány</h3>
             
             <div className="space-y-6">
               <div className="grid grid-cols-1 gap-4">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">BulkGate Application ID</label>
                    <input 
                      type="password"
                      value={settings.applicationId || ''}
                      onChange={(e) => setSettings({...settings, applicationId: e.target.value})}
                      placeholder="Application ID"
                      className={`w-full bg-slate-50 border-2 rounded-2xl px-4 py-3 outline-none font-bold tracking-widest transition-all ${!settings.applicationId ? 'border-red-200' : 'border-transparent focus:border-blue-500'}`}
                    />
                    {!settings.applicationId && (
                      <p className="text-[9px] text-red-500 font-black mt-1 uppercase flex items-center gap-1 animate-pulse px-1">
                        <AlertCircle className="w-3 h-3" /> API ID chybí
                      </p>
                    )}
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">BulkGate Application Token</label>
                    <input 
                      type="password"
                      value={settings.applicationToken || ''}
                      onChange={(e) => setSettings({...settings, applicationToken: e.target.value})}
                      placeholder="Application Token"
                      className={`w-full bg-slate-50 border-2 rounded-2xl px-4 py-3 outline-none font-bold tracking-widest transition-all ${!settings.applicationToken ? 'border-red-200' : 'border-transparent focus:border-blue-500'}`}
                    />
                    {!settings.applicationToken && (
                      <p className="text-[9px] text-red-500 font-black mt-1 uppercase flex items-center gap-1 animate-pulse px-1">
                        <AlertCircle className="w-3 h-3" /> Token chybí
                      </p>
                    )}
                 </div>
               </div>
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">ID Odesílatele (Sender ID)</label>
                  <input 
                    type="text"
                    value={settings.senderId}
                    onChange={(e) => setSettings({...settings, senderId: e.target.value.substring(0, 11)})}
                    placeholder="Název vaší firmy"
                    maxLength={11}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 outline-none font-bold uppercase"
                  />
                  <p className="text-[10px] text-slate-400 font-bold mt-2">Maximum 11 znaků. Zobrazí se jako odesílatel SMS zprávy.</p>
               </div>
               
               <div className="pt-6 border-t border-slate-100 flex items-center gap-3 bg-amber-50 p-4 rounded-2xl">
                 <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                 <p className="text-xs text-amber-800 font-bold">API klíče jsou bezpečně uloženy pouze ve vašem lokálním prohlížeči (LocalStorage) a nejsou nikam odesílány kromě SMS API poskytovatele.</p>
               </div>
             </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
             <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-widest"><MessageSquare className="w-5 h-5 text-blue-600" /> Šablony SMS Zpráv</h3>
             
             <div className="space-y-6">
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Upozornění na STK</label>
                  <textarea 
                    value={settings.stkTemplate}
                    onChange={(e) => setSettings({...settings, stkTemplate: e.target.value})}
                    rows={4}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 outline-none font-medium text-sm"
                  ></textarea>
                  <p className="text-[10px] text-slate-400 font-bold mt-2 leading-relaxed">Dostupné proměnné: <span className="text-blue-500 bg-blue-50 px-1 rounded">{'{SPZ}'}</span>, <span className="text-blue-500 bg-blue-50 px-1 rounded">{'{polozka}'}</span>, <span className="text-blue-500 bg-blue-50 px-1 rounded">{'{datum_stk}'}</span>, <span className="text-blue-500 bg-blue-50 px-1 rounded">{'{JmenoServisu}'}</span>, <span className="text-blue-500 bg-blue-50 px-1 rounded">{'{Telefon}'}</span><br/>Výsledná zpráva je vždy zkrácena o diakritiku (háčky a čárky).</p>
               </div>
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Upozornění na Servisní Intervaly</label>
                  <textarea 
                    value={settings.oilTemplate}
                    onChange={(e) => setSettings({...settings, oilTemplate: e.target.value})}
                    rows={4}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 outline-none font-medium text-sm"
                  ></textarea>
                  <p className="text-[10px] text-slate-400 font-bold mt-2 leading-relaxed">Dostupné proměnné: <span className="text-blue-500 bg-blue-50 px-1 rounded">{'{SPZ}'}</span>, <span className="text-blue-500 bg-blue-50 px-1 rounded">{'{polozka}'}</span>, <span className="text-blue-500 bg-blue-50 px-1 rounded">{'{JmenoServisu}'}</span>, <span className="text-blue-500 bg-blue-50 px-1 rounded">{'{Telefon}'}</span><br/>Výsledná zpráva je vždy zkrácena o diakritiku (háčky a čárky).</p>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunicationCenter;
