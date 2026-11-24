import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Cpu, Send, Trash2, AlertCircle, Bot, Loader2, MessageSquare, X } from 'lucide-react';
import { askKanas, checkGeminiKeyConfigured } from '../services/geminiService';
import { Customer, Vehicle, ServiceRecord, AppView, SmsMessage } from '../types';

interface Message {
  id: string;
  sender: 'user' | 'kanas';
  text: string;
  timestamp: Date;
}

interface KanasChatWidgetProps {
  customers: Customer[];
  vehicles: Vehicle[];
  services: ServiceRecord[];
  onNavigate?: (view: AppView, autoOpen?: boolean) => void;
  smsMessages?: SmsMessage[];
  setSmsMessages?: React.Dispatch<React.SetStateAction<SmsMessage[]>>;
  onCreateOrderKanas?: (vehicleId: string, dateStr: string, description: string) => void;
  onCreateCalendarEventKanas?: (title: string, dateStr: string, description: string, vehicleId?: string) => void;
}

export const KanasChatWidget: React.FC<KanasChatWidgetProps> = ({
  customers,
  vehicles,
  services,
  onNavigate,
  smsMessages,
  setSmsMessages,
  onCreateOrderKanas,
  onCreateCalendarEventKanas,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isKeyConfigured, setIsKeyConfigured] = useState(true);
  
  // Track dismissed completed order actions
  const [dismissedActions, setDismissedActions] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('kanas_dismissed_sms_orders') || '[]');
    } catch {
      return [];
    }
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Filter completed or pending-předání orders that haven't been dismissed yet
  const completedOrders = services.filter(
    (order) => (order.status === 'hotovo' || order.status === 'probíhá') && !dismissedActions.includes(order.id)
  );
  // Specifically, let's look for 'hotovo' as the primary trigger
  const completedHotovoOrders = services.filter(
    (order) => order.status === 'hotovo' && !dismissedActions.includes(order.id)
  );

  const activeCompletedOrder = completedHotovoOrders[completedHotovoOrders.length - 1];

  const activeVehicle = activeCompletedOrder 
    ? vehicles.find(v => v.id === activeCompletedOrder.vehicleId)
    : null;

  const activeCustomer = activeVehicle 
    ? customers.find(c => c.id === activeVehicle.customerId)
    : null;

  const company = JSON.parse(localStorage.getItem('companyInfo') || 'null');
  const isVatPayer = company?.isVatPayer || false;
  const rawCost = activeCompletedOrder ? (activeCompletedOrder.cost || 0) : 0;
  const totalPrice = isVatPayer ? Math.round(rawCost * 1.21) : Math.round(rawCost);

  const autoInfo = activeVehicle ? `${activeVehicle.make} ${activeVehicle.model}`.trim() : 'vozidlo';
  const customerName = activeCustomer 
    ? (activeCustomer.companyName || `${activeCustomer.firstName} ${activeCustomer.lastName}`.trim())
    : 'zákazník';
  const customerPhone = activeCustomer ? activeCustomer.phone : '';

  const smsText = `Dobrý den, Vaše ${autoInfo} je připraveno k vyzvednutí. Celková cena za opravu je ${totalPrice.toLocaleString('cs-CZ')} Kč. Autoservis Roháček.`;

  const removeDiacritics = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const handlePrepareSms = async () => {
    if (!activeCompletedOrder || !activeCustomer) return;

    try {
      await navigator.clipboard.writeText(smsText);
    } catch (e) {
      console.warn("Clipboard write failed. Continuing.");
    }

    if (setSmsMessages) {
      const dbSmsList = JSON.parse(localStorage.getItem('autoservis-sms') || '[]');
      const newSms: SmsMessage = {
        id: `kanas-auto-${activeCompletedOrder.id}-${Date.now()}`,
        recipientPhone: customerPhone || '',
        recipientName: customerName,
        customerId: activeCustomer.id,
        vehicleReg: activeVehicle?.licensePlate || '',
        vehicleId: activeVehicle?.id || '',
        serviceItem: `Dokončení zakázky #${activeCompletedOrder.id}`,
        text: removeDiacritics(smsText),
        status: 'Čeká na odeslání',
        createdAt: new Date().toISOString(),
        type: 'custom'
      };

      const updatedSmsList = [...dbSmsList, newSms];
      localStorage.setItem('autoservis-sms', JSON.stringify(updatedSmsList));
      setSmsMessages(updatedSmsList);
    }

    // Dismiss action so card disappears
    handleDismissAction(activeCompletedOrder.id);

    // Redirect to communication tab
    if (onNavigate) {
      onNavigate('communication');
    }
  };

  const handleDismissAction = (orderId: string) => {
    const updatedDismissed = [...dismissedActions, orderId];
    setDismissedActions(updatedDismissed);
    localStorage.setItem('kanas_dismissed_sms_orders', JSON.stringify(updatedDismissed));
  };

  // Check key on mount and when window/localstorage might update
  useEffect(() => {
    const checkKey = () => {
      setIsKeyConfigured(checkGeminiKeyConfigured());
    };
    checkKey();
    
    // Periodically re-check or listen to storage/focus events
    window.addEventListener('focus', checkKey);
    return () => window.removeEventListener('focus', checkKey);
  }, []);

  // Welcome message if chat empty
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          sender: 'kanas',
          text: 'Ahoj! Jsem KANAS, tvůj kancelářský asistent. Mám plný přístup k databázi zákazníků, vozidel i zakázek (pouze pro čtení). S čím ti dnes mohu pomoci? Můžeš se mě zeptat na statistiky, historii servisu nebo konkrétní auta a zákazníky.',
          timestamp: new Date(),
        },
      ]);
    }
  }, [messages]);

  // Autoscroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue.trim();
    setInputValue('');

    // Add user message
    const userMsgId = Math.random().toString(36).substring(7);
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await askKanas(userText, customers, vehicles, services);
      
      // Parse eventual commands from response
      const cmdRegex = /\[\[CMD:([A-Z_]+)\|([^\]]+)\]\]/;
      const match = response.match(cmdRegex);
      let cleanedText = response;

      if (match) {
        const cmdType = match[1];
        const paramsStr = match[2];
        
        const params: { [key: string]: string } = {};
        paramsStr.split('|').forEach(p => {
          const idx = p.indexOf(':');
          if (idx !== -1) {
            const key = p.substring(0, idx).trim();
            const value = p.substring(idx + 1).trim();
            params[key] = value;
          }
        });

        cleanedText = response.replace(cmdRegex, '').trim();

        if (cmdType === 'CREATE_ORDER' && onCreateOrderKanas) {
          const vId = params['vehicleId'];
          const date = params['date'];
          const text = params['text'];
          if (vId) {
            setTimeout(() => {
              onCreateOrderKanas(vId, date, text);
            }, 800);
          }
        } else if (cmdType === 'CALENDAR_EVENT' && onCreateCalendarEventKanas) {
          const title = params['title'];
          const date = params['date'];
          const description = params['description'];
          const vId = params['vehicleId'];
          
          setTimeout(() => {
            onCreateCalendarEventKanas(title, date, description, vId);
          }, 800);
        }
      }
      
      const kanasMsgId = Math.random().toString(36).substring(7);
      const kanasMsg: Message = {
        id: kanasMsgId,
        sender: 'kanas',
        text: cleanedText,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, kanasMsg]);
    } catch (err: any) {
      const errorMsgId = Math.random().toString(36).substring(7);
      const errorMsg: Message = {
        id: errorMsgId,
        sender: 'kanas',
        text: `Došlo k chybě při analýze: ${err.message || err}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'kanas',
        text: 'Historie vyčištěna. S čím dalším ti mohu pomoci?',
        timestamp: new Date(),
      },
    ]);
  };

  // Helper to format line breaks and markdown-style bold text / bullet points simply
  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Check for bullet lines
      const isBullet = line.trim().startsWith('-') || line.trim().startsWith('*');
      let cleanedLine = isBullet ? line.trim().substring(1).trim() : line;

      // Simplistic custom bold parsing (**text** -> <strong>text</strong>)
      const parts = cleanedLine.split(/\*\*([^*]+)\*\*/g);
      const formatted = parts.map((part, index) => {
        if (index % 2 === 1) {
          return <strong key={index} className="font-extrabold text-slate-900">{part}</strong>;
        }
        return part;
      });

      if (isBullet) {
        return (
          <div key={i} className="flex items-start gap-2 ml-4 my-1">
            <span className="text-blue-500 font-bold mt-1 shrink-0">•</span>
            <span className="text-sm text-slate-700 leading-relaxed font-medium">{formatted}</span>
          </div>
        );
      }

      return (
        <p key={i} className="text-sm text-slate-700 leading-relaxed font-medium my-1 min-h-[1rem]">
          {formatted}
        </p>
      );
    });
  };

  return (
    <div id="kanas-assistant-widget" className="xl:col-span-2 bg-white rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col h-[520px] overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 px-8 py-5 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-blue-500/20 text-white animate-pulse">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black tracking-tight uppercase">KANAS</h3>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                Aktivní Fáze 2
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">KAncelářský ASistent</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isKeyConfigured ? (
            <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              Offline
            </span>
          )}
          {messages.length > 1 && (
            <button
              onClick={clearHistory}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Vymazat chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Recommended Actions (Doporučené akce) Section */}
      {activeCompletedOrder && (
        <div className="bg-blue-50/80 border-b border-blue-100 px-8 py-4 shrink-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-start gap-3 flex-1">
            <div className="bg-blue-600 text-white p-2.5 rounded-2xl shrink-0 shadow-md">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                  Doporučené akce
                </span>
                <span className="text-[10px] text-slate-405 font-bold uppercase tracking-wider">
                  Příprava SMS k zakázce
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                Detekoval jsem dokončenou zakázku <span className="font-extrabold text-blue-900">#{activeCompletedOrder.id}</span>. Pro majitele <span className="font-extrabold text-slate-900">{customerName}</span> (tel: <span className="font-extrabold text-slate-900">{customerPhone || 'Neuveden'}</span>) s vozem <span className="font-extrabold text-slate-900">{autoInfo}</span> jsem připravil zprávu o dokončení. Celková cena s DPH je <span className="font-extrabold text-slate-900">{totalPrice.toLocaleString('cs-CZ')} Kč</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-stretch md:self-auto shrink-0 justify-end">
            <button
              onClick={() => handleDismissAction(activeCompletedOrder.id)}
              className="px-3.5 py-2 hover:bg-slate-100 rounded-xl font-bold text-xs text-slate-500 uppercase tracking-widest transition-all cursor-pointer"
            >
              Skrýt
            </button>
            <button
              onClick={handlePrepareSms}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Připravit SMS
            </button>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar space-y-4">
        {messages.map((msg) => {
          const isKanas = msg.sender === 'kanas';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 max-w-[85%] ${
                isKanas ? 'mr-auto' : 'ml-auto flex-row-reverse'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  isKanas
                    ? 'bg-slate-900 border border-slate-800 text-white'
                    : 'bg-blue-600 border border-blue-500 text-white'
                }`}
              >
                {isKanas ? <Bot className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              </div>
              <div
                className={`p-4 rounded-[1.5rem] shadow-sm font-sans ${
                  isKanas
                    ? 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'
                    : 'bg-blue-600 text-white rounded-tr-none'
                }`}
              >
                {isKanas ? (
                  <div>{renderFormattedText(msg.text)}</div>
                ) : (
                  <p className="text-sm font-semibold leading-relaxed font-sans">{msg.text}</p>
                )}
                <span
                  className={`text-[9px] font-black uppercase tracking-tighter block mt-2 ${
                    isKanas ? 'text-slate-400' : 'text-blue-200'
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString('cs-CZ', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          );
        })}

        {/* Loading Analyzer State */}
        {isLoading && (
          <div className="flex items-start gap-3 mr-auto max-w-[85%] animate-pulse">
            <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-white">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-white border border-slate-100 p-4 rounded-[1.5rem] rounded-tl-none shadow-sm flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <p className="text-sm font-semibold text-slate-700 italic">
                KANAS analyzuje databázi servisu...
              </p>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input / Fallback Footer */}
      <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0">
        {!isKeyConfigured ? (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 p-4 rounded-2xl text-red-700">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-xs font-bold leading-relaxed">
              Systém KANAS je offline. Zadejte Gemini API klíč v Nastavení.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              placeholder="Zeptej se mě na cokoliv ohledně servisu, např. 'Která vozidla mají propadlé STK?'"
              className="flex-1 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-5 py-3 outline-none font-bold text-sm transition-all"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-3.5 rounded-2xl font-black shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 transition-all flex items-center justify-center cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
