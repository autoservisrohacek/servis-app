
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X, 
  Clock, 
  Car, 
  User, 
  Phone, 
  Search,
  Trash2,
  CheckCircle2,
  Info,
  RefreshCw,
  LogOut,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { CalendarEvent, Vehicle, Customer } from '../types';
import { googleCalendarService } from '../services/googleCalendarService';

interface CalendarManagerProps {
  events: CalendarEvent[];
  vehicles: Vehicle[];
  customers: Customer[];
  onAddEvent: (event: CalendarEvent) => void;
  onUpdateEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
  onSyncEvents?: (events: CalendarEvent[]) => void;
}

const PRESET_COLORS = [
  { name: 'Modrá', value: '#2563eb' },
  { name: 'Zelená', value: '#059669' },
  { name: 'Červená', value: '#dc2626' },
  { name: 'Fialová', value: '#7c3aed' },
  { name: 'Oranžová', value: '#ea580c' },
  { name: 'Růžová', value: '#db2777' },
];

const CalendarManager: React.FC<CalendarManagerProps> = ({ 
  events, 
  vehicles, 
  customers,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onSyncEvents
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(googleCalendarService.isAuthenticated());

  useEffect(() => {
    if (isConnected) {
      loadGoogleEvents();
    }
  }, [isConnected]);

  const loadGoogleEvents = async () => {
    setIsLoading(true);
    try {
      const gEvents = await googleCalendarService.getEvents();
      if (onSyncEvents) {
        onSyncEvents(gEvents);
      }
    } catch (error) {
      console.error('Failed to load Google events', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    const clientId = localStorage.getItem('google_client_id');
    const clientSecret = localStorage.getItem('google_client_secret');

    if (!clientId || !clientSecret) {
      alert('Chybí konfigurace Google API v nastavení. Prosím, doplňte Client ID a Client Secret v sekci Nastavení -> Integrace.');
      return;
    }

    try {
      await googleCalendarService.authenticate();
      setIsConnected(true);
    } catch (error: any) {
      alert(`Chyba při propojování s Googlem: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    await googleCalendarService.logout();
    setIsConnected(false);
  };
  
  // State for new or editing event
  const [eventForm, setEventForm] = useState<Partial<CalendarEvent>>({
    title: '',
    startDate: '',
    endDate: '',
    color: PRESET_COLORS[0].value,
    vehicleId: undefined
  });

  // Date Helpers
  const formatDateTimeForInput = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      // To get local YYYY-MM-DDTHH:mm for datetime-local input
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (e) {
      return '';
    }
  };

  const formatDateLocal = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust to start from Monday (0-6: Mon-Sun)
  };

  const monthName = currentDate.toLocaleString('cs-CZ', { month: 'long' });
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation
  const next = () => {
    const nextDate = new Date(currentDate);
    if (viewMode === 'month') nextDate.setMonth(month + 1);
    else nextDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(nextDate);
  };

  const prev = () => {
    const prevDate = new Date(currentDate);
    if (viewMode === 'month') prevDate.setMonth(month - 1);
    else prevDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(prevDate);
  };

  const handleOpenNewEvent = (date?: Date) => {
    const start = date || new Date();
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(10, 0, 0, 0);

    setEventForm({
      title: '',
      startDate: formatDateTimeForInput(start.toISOString()),
      endDate: formatDateTimeForInput(end.toISOString()),
      color: PRESET_COLORS[0].value,
      vehicleId: undefined
    });
    setDeleteConfirm(false);
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const handleOpenEventDetail = (event: CalendarEvent) => {
    setDeleteConfirm(false);
    setSelectedEvent(event);
    setEventForm({ 
      ...event,
      startDate: formatDateTimeForInput(event.startDate),
      endDate: formatDateTimeForInput(event.endDate)
    });
    setIsModalOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!eventForm.title || !eventForm.startDate || !eventForm.endDate) return;

    setIsLoading(true);
    const vehicle = vehicles.find(v => v.id === eventForm.vehicleId);
    const customer = vehicle ? customers.find(c => c.id === vehicle.customerId) : undefined;

    try {
      if (selectedEvent) {
        const updatedEvent = { ...selectedEvent, ...eventForm } as CalendarEvent;
        if (isConnected && selectedEvent.id.startsWith('gcal-')) {
          onUpdateEvent(updatedEvent); // Instant local update
          await googleCalendarService.updateEvent(updatedEvent, vehicle, customer);
          await loadGoogleEvents(); // Full sync to catch any server-side changes
        } else {
          onUpdateEvent(updatedEvent);
        }
      } else {
        let newEvent = {
          ...eventForm,
          id: `ev-${Date.now()}`
        } as CalendarEvent;
        
        if (isConnected) {
          const googleId = await googleCalendarService.createEvent(newEvent, vehicle, customer);
          if (googleId) {
            newEvent = { ...newEvent, id: googleId };
          }
          // Add it locally immediately with the correct Google ID
          onAddEvent(newEvent);
          // Then sync to ensure full consistency (onSyncEvents will deduplicate via gcal- prefix)
          await loadGoogleEvents();
        } else {
          onAddEvent(newEvent);
        }
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving event:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch) return [];
    const s = vehicleSearch.toLowerCase();
    return vehicles.filter(v => {
      const customer = customers.find(c => c.id === v.customerId);
      return (v.licensePlate || '').toLowerCase().includes(s) || 
             (v.make || '').toLowerCase().includes(s) || 
             (v.model || '').toLowerCase().includes(s) ||
             (customer?.lastName || '').toLowerCase().includes(s) ||
             (customer?.companyName || '').toLowerCase().includes(s) ||
             (customer?.phone || '').toLowerCase().includes(s);
    }).slice(0, 5);
  }, [vehicles, vehicleSearch, customers]);

  const filteredEventsForView = useMemo(() => {
    if (!globalSearch) return events;
    const s = globalSearch.toLowerCase();
    return events.filter(e => {
        const v = vehicles.find(veh => veh.id === e.vehicleId);
        const c = v ? customers.find(cust => cust.id === v.customerId) : null;
        return (e.title || '').toLowerCase().includes(s) ||
               (v?.licensePlate || '').toLowerCase().includes(s) ||
               (v?.make || '').toLowerCase().includes(s) ||
               (v?.model || '').toLowerCase().includes(s) ||
               (c?.lastName || '').toLowerCase().includes(s) ||
               (c?.companyName || '').toLowerCase().includes(s);
    });
  }, [events, globalSearch, vehicles, customers]);

  // Monthly Grid Data
  const calendarDays = useMemo(() => {
    const totalDays = daysInMonth(year, month);
    const startOffset = firstDayOfMonth(year, month);
    const days = [];

    // Empty slots for start offset
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }

    // Days of the month
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  }, [year, month]);

  // Weekly View Data
  const weeklyDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = (day === 0 ? -6 : 1 - day); // Mon-Sun adjust
    startOfWeek.setDate(startOfWeek.getDate() + diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const getEventsForDate = (date: Date) => {
    const dStr = formatDateLocal(date);
    
    const filtered = filteredEventsForView.filter(e => {
      const startStr = e.startDate.slice(0, 10);
      const endStr = e.endDate.slice(0, 10);
      return dStr >= startStr && dStr <= endStr;
    });

    return filtered.sort((a, b) => {
      const aStartStr = a.startDate.slice(0, 10);
      const aEndStr = a.endDate.slice(0, 10);
      const bStartStr = b.startDate.slice(0, 10);
      const bEndStr = b.endDate.slice(0, 10);
      
      const aIsMulti = aStartStr !== aEndStr;
      const bIsMulti = bStartStr !== bEndStr;
      
      if (aIsMulti && !bIsMulti) return -1;
      if (!aIsMulti && bIsMulti) return 1;
      
      // Secondary sort by start time
      return a.startDate.localeCompare(b.startDate);
    });
  };

  const selectedVehicle = vehicles.find(v => v.id === eventForm.vehicleId);
  const selectedCustomer = selectedVehicle ? customers.find(c => c.id === selectedVehicle.customerId) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-blue-600" />
            Kalendář Rezervací
          </h2>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-slate-500 font-medium capitalize">{monthName} {year}</p>
            {isConnected ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  GOOGLE PROPOJENO
                </span>
                <button 
                  onClick={loadGoogleEvents}
                  disabled={isLoading}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-all disabled:opacity-50"
                  title="Synchronizovat"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-1 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-all"
                  title="Odpojit Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleConnect}
                className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-full uppercase tracking-widest transition-all"
              >
                <ExternalLink className="w-3 h-3" />
                PROPOJIT S GOOGLE KALENDÁŘEM
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 max-w-md items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-500/20">
          <Search className="w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Hledat v rezervacích (SPZ, Jméno, Info)..." 
            className="flex-1 outline-none text-xs font-bold bg-transparent"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
          />
          {globalSearch && (
            <button onClick={() => setGlobalSearch('')} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X className="w-3 h-3" /></button>
          )}
        </div>

        <div className="flex items-center gap-4 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('month')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              MĚSÍČNÍ
            </button>
            <button 
              onClick={() => setViewMode('week')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              TÝDENNÍ
            </button>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-1">
            <button onClick={prev} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-600"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-[10px] font-black uppercase text-blue-600 hover:bg-blue-50 rounded-lg transition-all">DNES</button>
            <button onClick={next} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-600"><ChevronRight className="w-5 h-5" /></button>
          </div>
          <button 
            onClick={() => handleOpenNewEvent()}
            className="ml-2 bg-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-200 hover:scale-105 transition-all"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {viewMode === 'month' ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
            {['PO', 'ÚT', 'ST', 'ČT', 'PÁ', 'SO', 'NE'].map(day => (
              <div key={day} className="py-4 text-center text-[10px] font-black text-slate-400 tracking-[0.2em]">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-slate-200">
            {calendarDays.map((date, idx) => {
              if (!date) return <div key={idx} className="bg-slate-50/50 min-h-[140px]" />;
              const isToday = date.toDateString() === new Date().toDateString();
              const dayEvents = getEventsForDate(date);
              
              return (
                <div key={idx} className="bg-white min-h-[140px] p-2 hover:bg-slate-50 transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-xl text-sm font-black ${isToday ? 'bg-blue-600 text-white' : 'text-slate-400 group-hover:text-slate-900 transition-colors'}`}>
                      {date.getDate()}
                    </span>
                    <button 
                      onClick={() => handleOpenNewEvent(date)}
                      className="p-1 text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.map(event => {
                      const isMulti = event.startDate.slice(0, 10) !== event.endDate.slice(0, 10);
                      return (
                        <button 
                          key={event.id}
                          onClick={() => handleOpenEventDetail(event)}
                          className={`w-full text-left px-2 py-1 rounded-md text-[9px] font-bold border-l-4 truncate transition-all hover:brightness-95 flex items-center justify-between ${isMulti ? 'shadow-sm ring-1 ring-slate-100/50' : ''}`}
                          style={{ backgroundColor: `${event.color}15`, borderColor: event.color, color: event.color }}
                        >
                          <span className="truncate">
                            {isMulti && <span className="mr-1 opacity-60">↔</span>}
                            {event.title}
                          </span>
                          {!event.vehicleId && event.id.startsWith('gcal-') && (
                            <AlertCircle className="w-2.5 h-2.5 ml-1 shrink-0 text-red-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 divide-x divide-slate-200">
            {weeklyDays.map((date, idx) => {
              const isToday = date.toDateString() === new Date().toDateString();
              const dayEvents = getEventsForDate(date);
              
              return (
                <div key={idx} className="min-h-[500px] flex flex-col">
                  <div className={`p-4 text-center border-b border-slate-100 ${isToday ? 'bg-blue-50/50' : 'bg-slate-50/30'}`}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      {date.toLocaleDateString('cs-CZ', { weekday: 'short' })}
                    </p>
                    <p className={`text-xl font-black ${isToday ? 'text-blue-600' : 'text-slate-900'}`}>{date.getDate()}.</p>
                  </div>
                  <div className="flex-1 p-2 space-y-2 bg-white hover:bg-slate-50 transition-colors">
                    {dayEvents.map(event => {
                      const isMulti = event.startDate.slice(0, 10) !== event.endDate.slice(0, 10);
                      return (
                        <button 
                          key={event.id}
                          onClick={() => handleOpenEventDetail(event)}
                          className={`w-full text-left p-3 rounded-2xl border-l-4 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${isMulti ? 'ring-1 ring-slate-100 ring-inset' : ''}`}
                          style={{ backgroundColor: `${event.color}15`, borderColor: event.color }}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-[10px] font-black uppercase truncate" style={{ color: event.color }}>
                              {isMulti && <span className="mr-1 opacity-60">↔</span>}
                              {event.title}
                            </p>
                            {!event.vehicleId && event.id.startsWith('gcal-') && (
                              <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Clock className="w-3 h-3" />
                            <span className="text-[9px] font-bold">
                              {isMulti ? (
                                `${new Date(event.startDate).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })} - ${new Date(event.endDate).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}`
                              ) : (
                                new Date(event.startDate).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
                              )}
                            </span>
                          </div>
                          {event.vehicleId && (
                            <div className="mt-2 flex items-center gap-1.5 text-slate-500">
                              <Car className="w-3 h-3" />
                              <span className="text-[9px] font-black uppercase font-mono tracking-wider">
                                {vehicles.find(v => v.id === event.vehicleId)?.licensePlate || '---'}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                    <button 
                      onClick={() => handleOpenNewEvent(date)}
                      className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-slate-300 hover:border-blue-100 hover:text-blue-200 transition-all flex items-center justify-center translate-y-2 opacity-0 hover:translate-y-0 hover:opacity-100"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
                  <CalendarIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {selectedEvent ? 'Detail rezervace' : 'Nová rezervace'}
                  </h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Plánování termínu</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all"><X className="w-6 h-6 text-slate-400" /></button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {!eventForm.vehicleId && selectedEvent?.id.startsWith('gcal-') && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 animate-pulse">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black text-red-700 uppercase tracking-widest">Nepárovaná událost</p>
                    <p className="text-[11px] font-medium text-red-600 mt-1">Tato událost z Google Kalendáře není propojena s žádným vozidlem v databázi. Vyberte vozidlo níže pro spárování.</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Název události</label>
                  <input 
                    type="text" 
                    placeholder="Např. Výměna brzd - p. Novák"
                    className="w-full bg-slate-100 rounded-2xl px-6 py-4 text-base font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={eventForm.title}
                    onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Začátek</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="datetime-local" 
                        className="w-full bg-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        value={eventForm.startDate}
                        onChange={e => setEventForm({ ...eventForm, startDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Konec</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="datetime-local" 
                        className="w-full bg-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        value={eventForm.endDate}
                        onChange={e => setEventForm({ ...eventForm, endDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Barva označení</label>
                  <div className="flex flex-wrap gap-3">
                    {PRESET_COLORS.map(color => (
                      <button 
                        key={color.value}
                        onClick={() => setEventForm({ ...eventForm, color: color.value })}
                        className={`w-12 h-12 rounded-xl transition-all border-4 ${eventForm.color === color.value ? 'border-white ring-2 ring-blue-500 scale-110 shadow-lg' : 'border-transparent'}`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Přiřazené vozidlo a zákazník</label>
                  {eventForm.vehicleId ? (
                    <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-200 shadow-sm">
                      <div className="space-y-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-5">
                            <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-100">
                              <Car className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <p className="text-xl font-black text-blue-600 font-mono tracking-wider mb-0.5">{selectedVehicle?.licensePlate}</p>
                              <p className="text-lg font-black text-slate-900 leading-tight">{selectedVehicle?.make} {selectedVehicle?.model}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setEventForm({ ...eventForm, vehicleId: undefined })}
                            className="p-3 bg-white hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-2xl transition-all shadow-sm"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-5 rounded-2xl border border-slate-100">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              <User className="w-3 h-3" /> Zákazník
                            </div>
                            <p className="text-sm font-black text-slate-900">
                              {selectedCustomer?.firstName} {selectedCustomer?.lastName || selectedCustomer?.companyName}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              <Phone className="w-3 h-3" /> Telefon
                            </div>
                            <p className="text-sm font-black text-slate-900">{selectedCustomer?.phone}</p>
                          </div>
                          {selectedCustomer?.contactPerson && (
                            <div className="col-span-2 space-y-1 pt-2 border-t border-slate-50">
                              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <Info className="w-3 h-3" /> Kontaktní osoba
                              </div>
                              <p className="text-sm font-black text-emerald-600">{selectedCustomer.contactPerson}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Zadejte SPZ, značku nebo jméno majitele..."
                        className="w-full bg-slate-50 rounded-[1.5rem] pl-16 pr-6 py-5 text-sm font-bold border-2 border-dashed border-slate-200 outline-none focus:border-blue-300 focus:bg-white transition-all shadow-inner"
                        value={vehicleSearch}
                        onChange={e => setVehicleSearch(e.target.value)}
                      />
                      {filteredVehicles.length > 0 && (
                        <div className="absolute top-full left-0 w-full mt-4 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-3 z-50 overflow-hidden ring-4 ring-slate-900/5">
                          {filteredVehicles.map(v => {
                            const c = customers.find(cust => cust.id === v.customerId);
                            return (
                              <button 
                                key={v.id}
                                onClick={() => {
                                  setEventForm({ ...eventForm, vehicleId: v.id });
                                  setVehicleSearch('');
                                }}
                                className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-blue-50 text-left transition-all group"
                              >
                                <div>
                                  <p className="text-[10px] font-black text-blue-600 uppercase font-mono tracking-widest group-hover:scale-105 origin-left transition-transform">{v.licensePlate}</p>
                                  <p className="text-sm font-black text-slate-900">{v.make} {v.model}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-slate-400 uppercase">{c?.lastName || c?.companyName}</p>
                                  <p className="text-[9px] font-bold text-slate-300 tracking-tighter">{c?.phone}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-8 border-t bg-slate-50/50 flex justify-between gap-4">
              {selectedEvent ? (
                <button 
                  onClick={() => {
                    if (!deleteConfirm) {
                      setDeleteConfirm(true);
                      setTimeout(() => setDeleteConfirm(false), 3000);
                    } else {
                      if (isConnected && selectedEvent.id.startsWith('gcal-')) {
                        googleCalendarService.deleteEvent(selectedEvent.id).then(() => {
                          loadGoogleEvents();
                        });
                      }
                      onDeleteEvent(selectedEvent.id);
                      setIsModalOpen(false);
                      setDeleteConfirm(false);
                    }
                  }}
                  className={`px-6 py-4 rounded-2xl font-black text-xs uppercase transition-all flex items-center gap-2 shadow-sm border ${
                    deleteConfirm 
                      ? 'bg-red-600 text-white border-red-700 animate-pulse' 
                      : 'bg-white border-red-100 text-red-600 hover:bg-red-50'
                  }`}
                >
                  <Trash2 className="w-4 h-4" /> 
                  {deleteConfirm ? 'OPRAVDU SMAZAT?' : 'Smazat'}
                </button>
              ) : <div />}
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-8 py-4 rounded-2xl bg-white border border-slate-200 text-slate-500 font-black text-xs uppercase hover:bg-slate-50 transition-all"
                >
                  Zrušit
                </button>
                <button 
                  onClick={handleSaveEvent}
                  className="px-8 py-4 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> {selectedEvent ? 'Uložit změny' : 'Vytvořit rezervaci'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarManager;
