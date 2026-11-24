import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  AlertCircle, 
  Plus, 
  Car, 
  Wrench, 
  ShieldAlert, 
  UserPlus,
  ClipboardPlus,
  Clock,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  Check,
  ListTodo,
  Droplets,
  Settings2,
  AlertTriangle
} from 'lucide-react';
import { Customer, Vehicle, ServiceRecord, AppView, NotificationSettings, Task, SmsMessage } from '../types';
import { KanasChatWidget } from './KanasChatWidget';

interface DashboardProps {
  customers: Customer[];
  vehicles: Vehicle[];
  services: ServiceRecord[];
  tasks: Task[];
  onAddTask: (text: string) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onNavigate: (view: AppView, autoOpen?: boolean) => void;
  onViewVehicle: (vehicleId: string) => void;
  onViewOrder: (orderId: string) => void;
  notifSettings: NotificationSettings;
  smsMessages?: SmsMessage[];
  setSmsMessages?: React.Dispatch<React.SetStateAction<SmsMessage[]>>;
  onCreateOrderKanas?: (vehicleId: string, dateStr: string, description: string) => void;
  onCreateCalendarEventKanas?: (title: string, dateStr: string, description: string, vehicleId?: string) => void;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '---';
  const parts = dateStr.split('T')[0].split('-');
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

const Dashboard: React.FC<DashboardProps> = ({ 
  vehicles, 
  customers, 
  services, 
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onNavigate, 
  onViewVehicle, 
  onViewOrder,
  notifSettings,
  smsMessages,
  setSmsMessages,
  onCreateOrderKanas,
  onCreateCalendarEventKanas
}) => {
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>(() => {
    const saved = localStorage.getItem('dismissedAlerts');
    return saved ? JSON.parse(saved) : [];
  });

  const [newTaskText, setNewTaskText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskText, setEditTaskText] = useState('');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [alertToDismiss, setAlertToDismiss] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleCloseModals = () => {
    setIsQuickActionOpen(false);
    setEditingTaskId(null);
    setTaskToDelete(null);
    setAlertToDismiss(null);
    
    // Electron focus fix
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      window.focus();
    }, 50);
  };

  useEffect(() => {
    localStorage.setItem('dismissedAlerts', JSON.stringify(dismissedAlerts));
  }, [dismissedAlerts]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsQuickActionOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const vehicleAlerts = useMemo(() => {
    const alerts: { id: string; type: string; label: string; vehicle: Vehicle; daysLeft: number; priority: 'high' | 'medium' }[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    vehicles.forEach(v => {
      const checkDate = (dateStr: string | undefined, label: string, type: string, threshold: number, intervalMonths?: number) => {
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
        
        const diffTime = targetDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Zobrazit pokud je po termínu (diffDays < 0) nebo v limitu (diffDays <= threshold)
        if (diffDays <= threshold) {
          const alertId = `${v.id}-${type}-${targetDate.toISOString().split('T')[0]}`;
          if (!dismissedAlerts.includes(alertId)) {
            alerts.push({ 
              id: alertId,
              type, 
              label, 
              vehicle: v, 
              daysLeft: diffDays,
              priority: diffDays < 0 ? 'high' : 'medium'
            });
          }
        }
      };

      // 1. STK - dateStr je přímo datum konce platnosti
      checkDate(v.stkExpirationDate, 'STK Expirace', 'stk', notifSettings.stkThresholdDays);
      
      // 2. Obecný servis / Olej
      checkDate(v.nextServiceDate, 'Plánovaný servis', 'service', notifSettings.serviceThresholdDays);
      checkDate(v.oilChangeDate, 'Výměna oleje', 'oil', notifSettings.serviceThresholdDays, v.oilChangeInterval || 12);
      
      // 3. Ostatní intervaly
      checkDate(v.brakeFluidDate, 'Brzdová kapalina', 'fluid', 15, v.brakeFluidInterval || 24);
      checkDate(v.timingBeltDate, 'Rozvody motoru', 'timing', 30, v.timingBeltInterval || 120);
    });

    // Seřadíme tak, aby ty nejurgentnější (nejvíce v záporu) byly nahoře
    return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [vehicles, notifSettings, dismissedAlerts]);

  const activeOrders = useMemo(() => {
    return services.filter(s => s.status === 'naplánováno' || s.status === 'probíhá')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [services]);

  const quickActions = [
    { label: 'Nový zákazník', icon: UserPlus, view: 'customers' as AppView, desc: 'Registrace nového klienta' },
    { label: 'Nové vozidlo', icon: Car, view: 'vehicles' as AppView, desc: 'Evidence nového vozu' },
    { label: 'Nová zakázka', icon: ClipboardPlus, view: 'orders' as AppView, desc: 'Založení servisního listu' },
  ];

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskText.trim()) {
      onAddTask(newTaskText.trim());
      setNewTaskText('');
    }
  };

  const startEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTaskText(task.text);
  };

  const saveEditTask = () => {
    if (editingTaskId && editTaskText.trim()) {
      const task = tasks.find(t => t.id === editingTaskId);
      if (task) {
        onUpdateTask({ ...task, text: editTaskText.trim() });
      }
      setEditingTaskId(null);
    }
  };

  const toggleTask = (task: Task) => {
    onUpdateTask({ ...task, completed: !task.completed });
  };

  const getAlertIcon = (type: string) => {
    switch(type) {
      case 'stk': return <ShieldAlert className="w-4 h-4" />;
      case 'oil': return <Droplets className="w-4 h-4" />;
      case 'timing': return <Settings2 className="w-4 h-4" />;
      default: return <Wrench className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Přehled servisu</h2>
          <p className="text-slate-500 font-medium">AutoService Pro je připraven k práci.</p>
        </div>
        
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsQuickActionOpen(!isQuickActionOpen)}
            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center gap-3"
          >
            <Plus className={`w-6 h-6 transition-transform duration-300 ${isQuickActionOpen ? 'rotate-45' : ''}`} />
            Rychlá akce
          </button>
          {isQuickActionOpen && (
            <div className="absolute top-20 right-0 w-72 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-2">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => { onNavigate(action.view, true); setIsQuickActionOpen(false); }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors group text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <action.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{action.label}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{action.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden flex flex-col h-[400px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6 text-amber-400 shrink-0">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-xl font-black tracking-tight">Důležitá upozornění</h3>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar relative">
              {vehicleAlerts.length > 0 ? vehicleAlerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`p-5 rounded-2xl border transition-all hover:scale-[1.01] cursor-pointer group relative ${alert.priority === 'high' ? 'bg-red-500/10 border-red-500/30 text-red-100 hover:bg-red-500/20' : 'bg-blue-500/10 border-blue-500/30 text-blue-100 hover:bg-blue-500/20'}`} 
                  onClick={() => onViewVehicle(alert.vehicle.id)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAlertToDismiss(alert.id);
                    }}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-white text-slate-900 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-red-500 hover:text-white z-20"
                    title="Skrýt upozornění"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      {getAlertIcon(alert.type)}
                      <span className="text-[9px] font-black uppercase tracking-widest">{alert.label}</span>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${alert.daysLeft < 0 ? 'bg-red-600 text-white animate-pulse' : (alert.daysLeft <= 5 ? 'bg-red-500 text-white' : 'bg-white/10')}`}>
                      {alert.daysLeft < 0 ? `PROŠLÉ ${Math.abs(alert.daysLeft)} d` : (alert.daysLeft === 0 ? 'DNES' : `Zbývá ${alert.daysLeft} d`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0"><Car className="w-5 h-5" /></div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-white/50 truncate mb-0.5">
                        {(() => {
                          const owner = customers.find(c => c.id === alert.vehicle.customerId);
                          return owner ? (owner.customerType === 'firemní' ? owner.companyName : `${owner.lastName} ${owner.firstName}`) : 'Bez majitele';
                        })()}
                      </p>
                      <p className="text-sm font-black tracking-tight truncate">{alert.vehicle.make} {alert.vehicle.model}</p>
                      <p className="text-[10px] font-bold font-mono opacity-50 uppercase">{alert.vehicle.licensePlate}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="h-full bg-white/5 p-8 rounded-[2rem] border border-white/10 text-center flex flex-col items-center justify-center">
                  <ShieldAlert className="w-10 h-10 text-slate-600 mb-3" /><p className="text-slate-400 font-bold italic text-sm">Bez aktuálních upozornění.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-indigo-950 p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden flex flex-col h-[400px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6 text-blue-400 shrink-0">
              <ClipboardList className="w-6 h-6" />
              <h3 className="text-xl font-black tracking-tight">Aktivní zakázky</h3>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar relative">
              {activeOrders.length > 0 ? activeOrders.map((order) => {
                const vehicle = vehicles.find(v => v.id === order.vehicleId);
                const customer = customers.find(c => c.id === vehicle?.customerId);
                return (
                  <div key={order.id} className="p-5 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-100 transition-all hover:scale-[1.01] hover:bg-indigo-500/20 cursor-pointer" onClick={() => onViewOrder(order.id)}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2 text-indigo-300"><Clock className="w-3.5 h-3.5" /><span className="text-[9px] font-black uppercase tracking-widest">{order.status}</span></div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/10">{formatDate(order.date)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-indigo-300 mt-1"><Car className="w-5 h-5" /></div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-indigo-300 uppercase tracking-tighter mb-0.5 truncate">
                            {customer ? (customer.companyName || `${customer.firstName} ${customer.lastName}`) : 'Neznámý'}
                          </p>
                          <p className="text-sm font-black tracking-tight truncate uppercase">
                            {vehicle ? `${vehicle.make} ${vehicle.model}` : 'Neznámý vůz'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-indigo-500/50 shrink-0 mt-3" />
                    </div>
                  </div>
                );
              }) : (
                <div className="h-full bg-white/5 p-8 rounded-[2rem] border border-white/10 text-center flex flex-col items-center justify-center">
                  <ClipboardList className="w-10 h-10 text-slate-600 mb-3" /><p className="text-slate-400 font-bold italic text-sm">Žádné aktivní zakázky.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col min-h-[400px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="bg-slate-100 p-2 rounded-xl text-slate-600">
                <ListTodo className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight">Úkoly a upomínky</h3>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Seznam interních poznámek</p>
              </div>
            </div>
            
            <form onSubmit={handleCreateTask} className="flex-1 max-w-lg flex gap-2">
              <input 
                type="text" 
                placeholder="Co je potřeba udělat? (např. zavolat panu Novákovi)"
                className="flex-1 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-xl px-4 py-2.5 outline-none font-bold text-sm transition-all"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
              />
              <button 
                type="submit"
                disabled={!newTaskText.trim()}
                className="bg-slate-900 text-white px-4 rounded-xl font-black text-xs uppercase hover:bg-slate-800 disabled:opacity-30 transition-all"
              >
                PŘIDAT
              </button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
            {tasks.length > 0 ? tasks.map((task) => (
              <div 
                key={task.id} 
                className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  task.completed ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-md'
                }`}
              >
                <button 
                  onClick={() => toggleTask(task)}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    task.completed ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white hover:border-blue-400'
                  }`}
                >
                  {task.completed && <Check className="w-4 h-4 stroke-[4]" />}
                </button>

                <div className="flex-1 min-w-0">
                  {editingTaskId === task.id ? (
                    <div className="flex items-center gap-2">
                      <input 
                        autoFocus
                        type="text"
                        className="flex-1 bg-blue-50 border-b-2 border-blue-600 outline-none font-bold text-sm py-0.5"
                        value={editTaskText}
                        onChange={(e) => setEditTaskText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditTask()}
                        onBlur={saveEditTask}
                      />
                      <button onClick={saveEditTask} className="text-blue-600"><Check className="w-5 h-5" /></button>
                    </div>
                  ) : (
                    <p 
                      onClick={() => !task.completed && startEditTask(task)}
                      className={`text-sm font-bold truncate cursor-pointer ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 hover:text-blue-600'}`}
                    >
                      {task.text}
                    </p>
                  )}
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">
                    Vytvořeno: {formatDate(task.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {!task.completed && (
                    <button 
                      onClick={() => startEditTask(task)}
                      className="p-2 text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {task.completed && (
                    <button 
                      onClick={() => setTaskToDelete(task.id)}
                      className="p-2 text-slate-300 hover:text-red-600 transition-all"
                      title="Smazat vyřízené"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )) : (
              <div className="h-full py-12 flex flex-col items-center justify-center text-center">
                <ListTodo className="w-12 h-12 text-slate-100 mb-3" />
                <p className="text-slate-400 font-bold italic text-sm">Žádné úkoly k vyřízení.</p>
              </div>
            )}
          </div>
        </div>

        <KanasChatWidget 
          customers={customers}
          vehicles={vehicles}
          services={services}
          onNavigate={onNavigate}
          smsMessages={smsMessages}
          setSmsMessages={setSmsMessages}
          onCreateOrderKanas={onCreateOrderKanas}
          onCreateCalendarEventKanas={onCreateCalendarEventKanas}
        />
      </div>

      {taskToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight mb-6">Opravdu vyřízeno?</h3>
              <div className="flex gap-3">
                <button 
                  onClick={handleCloseModals}
                  className="flex-1 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-xs uppercase"
                >
                  Zrušit
                </button>
                <button 
                  onClick={() => { onDeleteTask(taskToDelete); setTaskToDelete(null); }}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg"
                >
                  Smazat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {alertToDismiss && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={handleCloseModals}></div>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Skrýt upozornění?</h3>
              <p className="text-slate-500 text-sm font-medium mb-6">Upozornění pro toto vozidlo bude trvale skryto, dokud nenastane nový termín.</p>
              <div className="flex gap-3">
                <button 
                  onClick={handleCloseModals}
                  className="flex-1 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-xs uppercase"
                >
                  Zrušit
                </button>
                <button 
                  onClick={() => {
                    setDismissedAlerts(prev => [...prev, alertToDismiss]);
                    setAlertToDismiss(null);
                  }}
                  className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg"
                >
                  Skrýt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.02); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); border-radius: 10px; border: 1px solid rgba(0, 0, 0, 0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.2); }
      `}</style>
    </div>
  );
};

export default Dashboard;