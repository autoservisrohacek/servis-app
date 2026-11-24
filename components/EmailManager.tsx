
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Mail, 
  Search, 
  RefreshCcw, 
  Paperclip, 
  User, 
  Calendar, 
  ChevronRight, 
  Loader2, 
  AlertCircle,
  Clock,
  ArrowLeft,
  ExternalLink,
  ShieldAlert,
  Inbox,
  Send,
  FileText,
  AlertOctagon,
  Trash2,
  Sparkles,
  SearchX,
  ClipboardPlus,
  FileSpreadsheet,
  CheckCircle2,
  Files,
  Car,
  X,
  ClipboardList
} from 'lucide-react';
import { GmailMessage, GmailAttachment, ServiceRecord, Vehicle, Customer, PartItem } from '../types';
import * as XLSX from 'xlsx';
import { processExcelLocally } from '../services/fileParser';
import { analyzePdfParts } from '../services/geminiService';

interface EmailManagerProps {
  isVisible: boolean;
  services: ServiceRecord[];
  vehicles: Vehicle[];
  customers: Customer[];
  onUpdateServices: (records: ServiceRecord[]) => void;
  onImportToOrder: (orderId: string, fileData: string, fileName: string, fileType: string) => void;
}

type GmailFolder = 'INBOX' | 'SENT' | 'DRAFT' | 'SPAM' | 'TRASH';

interface FolderItem {
  id: GmailFolder;
  label: string;
  icon: React.ElementType;
}

const GMAIL_FOLDERS: FolderItem[] = [
  { id: 'INBOX', label: 'Doručené', icon: Inbox },
  { id: 'SENT', label: 'Odeslané', icon: Send },
  { id: 'DRAFT', label: 'Rozepsané', icon: FileText },
  { id: 'SPAM', label: 'Spam', icon: AlertOctagon },
  { id: 'TRASH', label: 'Koš', icon: Trash2 },
];

const EmailManager: React.FC<EmailManagerProps> = ({ isVisible, services, vehicles, customers, onUpdateServices, onImportToOrder }) => {
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [activeFolder, setActiveFolder] = useState<GmailFolder>('INBOX');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Order selection modal states
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [analyzingAttachment, setAnalyzingAttachment] = useState<GmailAttachment | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Partial<PartItem>[] | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const allowedEmailFilters = useMemo(() => {
    const saved = localStorage.getItem('allowed_email_filters');
    return saved ? JSON.parse(saved) as string[] : [];
  }, []);

  const isSenderFiltered = useMemo(() => {
    if (!selectedMessage) return false;
    const from = selectedMessage.from.toLowerCase();
    return allowedEmailFilters.some(filter => from.includes(filter.toLowerCase()));
  }, [selectedMessage, allowedEmailFilters]);

  const attachmentsWithAnalysableFiles = useMemo(() => {
    if (!selectedMessage || !selectedMessage.attachments) return [];
    return selectedMessage.attachments.filter(att => 
      att.filename.toLowerCase().endsWith('.pdf') || 
      att.filename.toLowerCase().endsWith('.csv') ||
      att.filename.toLowerCase().endsWith('.xlsx') ||
      att.filename.toLowerCase().endsWith('.xls')
    );
  }, [selectedMessage]);

  const showAnalysisPanel = isSenderFiltered && attachmentsWithAnalysableFiles.length > 0;

  const fetchMessages = async (folder: GmailFolder = activeFolder) => {
    setIsLoading(true);
    setError(null);
    try {
      // @ts-ignore
      if (typeof window === 'undefined' || !window.electronAPI) {
        throw new Error('NOT_ELECTRON');
      }
      
      // @ts-ignore
      const result = await window.electronAPI.gmail.listMessages({ labelId: folder, maxResults: 50 });
      setMessages(result);
    } catch (err: any) {
      console.error('Failed to fetch messages:', err);
      if (err.message === 'NOT_ELECTRON') {
        setError('NOT_ELECTRON');
      } else if (err.message === 'GMAIL_INSUFFICIENT_SCOPE' || err.message?.includes('insufficient permissions') || err.message?.includes('access_denied') || err.message?.includes('scope')) {
        setError('SCOPE_MISSING');
      } else {
        setError('Nepodařilo se načíst e-maily. Zkontrolujte připojení Google.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartAnalysis = (att: GmailAttachment) => {
    setAnalyzingAttachment(att);
    setIsOrderModalOpen(true);
    setAnalysisResult(null);
  };

  const handleSelectOrderAndAnalyze = async (orderId: string) => {
    if (!analyzingAttachment || !selectedMessage) return;

    setIsAnalyzing(true);
    try {
      // @ts-ignore
      const base64Data = await window.electronAPI.gmail.getAttachment({
        messageId: selectedMessage.id,
        attachmentId: analyzingAttachment.id
      });

      // Gmail API uses base64url encoding
      const base64 = base64Data.replace(/-/g, '+').replace(/_/g, '/');
      
      // Pass the data to the order editor for processing
      onImportToOrder(
        orderId, 
        base64, 
        analyzingAttachment.filename, 
        analyzingAttachment.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      
      setIsOrderModalOpen(false);
    } catch (err) {
      console.error('Attachment download failed:', err);
      setNotification({ message: 'Nepodařilo se stáhnout přílohu.', type: 'error' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchMessageDetail = async (id: string) => {
    setIsDetailLoading(true);
    try {
      // @ts-ignore
      if (!window.electronAPI) return;
      
      // @ts-ignore
      const result = await window.electronAPI.gmail.getMessageDetail(id);
      setSelectedMessage(result);
    } catch (err) {
      console.error('Failed to fetch message detail:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      fetchMessages();
    }
  }, [isVisible, activeFolder]);

  useEffect(() => {
    if (selectedMessageId) {
      fetchMessageDetail(selectedMessageId);
    } else {
      setSelectedMessage(null);
    }
  }, [selectedMessageId]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(m => 
      m.from.toLowerCase().includes(q) || 
      m.subject.toLowerCase().includes(q) || 
      m.snippet.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  const handleReauthorize = async () => {
    const clientId = localStorage.getItem('google_client_id');
    const clientSecret = localStorage.getItem('google_client_secret');

    if (!clientId || !clientSecret) {
      setError('PROMPT_CONFIG');
      return;
    }

    try {
      setIsLoading(true);
      // Hard reset logic
      localStorage.removeItem('google_calendar_tokens');
      localStorage.removeItem('google_tokens'); // Clean up any other potential variations
      
      // @ts-ignore
      await window.electronAPI.google.reset();

      // @ts-ignore
      const tokens = await window.electronAPI.calendar.authenticate({ clientId, clientSecret });
      if (tokens) {
        localStorage.setItem('google_calendar_tokens', JSON.stringify(tokens));
        // @ts-ignore
        await window.electronAPI.calendar.setTokens({ tokens, clientId, clientSecret });
        setError(null);
        fetchMessages();
      }
    } catch (err) {
      console.error('Re-authorization failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="flex flex-col h-full bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* State Overlays */}
      {error === 'NOT_ELECTRON' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-6 font-black text-xl">Vite</div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Prostředí prohlížeče</h2>
          <p className="text-slate-500 max-w-md mb-8">
            Gmail integrace vyžaduje spuštění v aplikaci <strong>Electron</strong>.
          </p>
        </div>
      ) : error === 'SCOPE_MISSING' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-6 font-black text-xl">
             <ShieldAlert className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Rozšíření oprávnění</h2>
          <p className="text-slate-500 max-w-md mb-8 font-medium">
            Aplikace nemá přístup k vašemu Gmailu. Je potřeba rozšířit oprávnění pro kalendář i poštu.
          </p>
          <button 
            onClick={handleReauthorize}
            disabled={isLoading}
            className="bg-blue-600 text-white px-10 py-5 rounded-[2rem] font-black shadow-xl shadow-blue-200 hover:bg-blue-700 hover:scale-105 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <RefreshCcw className="w-6 h-6" />}
            PROPOJIT GMAIL A KALENDÁŘ
          </button>
        </div>
      ) : error === 'PROMPT_CONFIG' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
          <Mail className="w-20 h-20 text-slate-200 mb-6" />
          <h2 className="text-2xl font-black text-slate-900 mb-2">Gmail není nastaven</h2>
          <p className="text-slate-500">V nastavení musíte nejprve vyplnit Google API klíče.</p>
        </div>
      ) : (
        <div className="flex h-full overflow-hidden">
          {/* COLUMN 1: Folders (Left Sidebar) */}
          <div className="w-64 border-r border-slate-100 bg-slate-50 flex flex-col p-6 shrink-0">
            <div className="flex items-center gap-3 mb-10 px-2">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <Mail className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black text-slate-900">Pošta</h2>
            </div>

            <div className="space-y-1">
              {GMAIL_FOLDERS.map((folder) => {
                const Icon = folder.icon;
                const isActive = activeFolder === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setActiveFolder(folder.id);
                      setSelectedMessageId(null);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black transition-all ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-5 h-5 opacity-80" />
                    {folder.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-auto pt-6 px-2">
              <div className="p-4 bg-slate-200/50 rounded-2xl border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Synchronizováno</span>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 2: Email List & Content (Middle) */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
            {/* List Header */}
            <div className="p-6 border-b border-slate-100 flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Hledat v poště..."
                  className="w-full bg-slate-100 border-none rounded-xl pl-12 pr-4 py-3 text-sm font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button 
                onClick={() => fetchMessages()}
                disabled={isLoading}
                className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all disabled:opacity-50 border border-slate-100 bg-white"
              >
                <RefreshCcw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-4" />
                  <p className="text-xs font-black uppercase tracking-widest">Aktualizace zpráv...</p>
                </div>
              ) : filteredMessages.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {filteredMessages.map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => setSelectedMessageId(msg.id)}
                      className={`w-full text-left p-6 transition-all hover:bg-slate-50 group relative ${selectedMessageId === msg.id ? 'bg-blue-50/50' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest truncate max-w-[70%]">
                          {msg.from.split('<')[0].trim() || msg.from}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                          {new Date(msg.timestamp).toLocaleDateString('cs-CZ')}
                        </span>
                      </div>
                      <h3 className={`text-sm font-black text-slate-900 mb-1 line-clamp-1 ${selectedMessageId === msg.id ? 'text-blue-600' : ''}`}>
                        {msg.subject || '(Bez předmětu)'}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">
                        {msg.snippet}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 px-10 text-center">
                  <SearchX className="w-12 h-12 opacity-10 mb-4" />
                  <p className="text-sm font-bold">Žádné e-maily k zobrazení</p>
                </div>
              )}
            </div>

            {/* DETAIL OVERLAY */}
            {selectedMessageId && (
              <div className="absolute inset-0 bg-white z-20 flex flex-col animate-in slide-in-from-right-full duration-300">
                {isDetailLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="w-10 h-10 animate-spin mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">Otevírání zprávy...</p>
                  </div>
                ) : selectedMessage ? (
                  <div className="flex flex-col h-full">
                    {/* Detail Header */}
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setSelectedMessageId(null)}
                          className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-xl shadow-sm border border-slate-100"
                        >
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="min-w-0">
                          <h2 className="text-lg font-black text-slate-900 truncate tracking-tight">{selectedMessage.subject || '(Bez předmětu)'}</h2>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{selectedMessage.from}</p>
                        </div>
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                        {selectedMessage.date}
                      </div>
                    </div>

                    {/* Detail Body */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                      <div className="max-w-2xl mx-auto">
                        <div className="whitespace-pre-wrap font-medium text-slate-700 leading-relaxed text-sm bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          {selectedMessage.body}
                        </div>

                        {/* Attachments Section */}
                        {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                          <div className="mt-8 pt-8 border-t border-slate-100">
                            <div className="flex items-center gap-2 mb-4 text-amber-500">
                              <Paperclip className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Přílohy ({selectedMessage.attachments.length})</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {selectedMessage.attachments.map((att) => (
                                <div key={att.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 group hover:border-blue-300 transition-all cursor-default">
                                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                                    <Paperclip className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-black text-slate-900 truncate uppercase">{att.filename}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{(att.size / 1024 / 1024).toFixed(2)} MB</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* COLUMN 3: AI Integration (Right Panel) */}
          <div className="w-72 border-l border-slate-100 bg-slate-50/50 flex flex-col p-6 shrink-0 relative">
            {notification && (
              <div className={`absolute top-4 left-4 right-4 p-4 rounded-2xl shadow-xl border animate-in slide-in-from-top-4 z-50 ${
                notification.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-red-50 border-red-100 text-red-900'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                  <span className="text-[10px] font-black uppercase tracking-widest">{notification.type === 'success' ? 'Hotovo' : 'Chyba'}</span>
                </div>
                <p className="text-[10px] font-bold leading-tight">{notification.message}</p>
              </div>
            )}

            <div className="flex items-center gap-3 mb-6">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-lg ${showAnalysisPanel ? 'bg-blue-600 shadow-blue-200' : 'bg-slate-300 shadow-none'}`}>
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Chytré propojení</h3>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              {showAnalysisPanel ? (
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mx-auto mb-4">
                    <ClipboardPlus className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-black text-slate-900 mb-2 uppercase">Analyzovat v zakázce</h4>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-4">
                    Tento e-mail je od ověřeného dodavatele a obsahuje vhodnou přílohu.
                  </p>
                  
                  <div className="space-y-2">
                    {attachmentsWithAnalysableFiles.map(att => (
                      <button 
                        key={att.id}
                        onClick={() => handleStartAnalysis(att)}
                        className="w-full bg-blue-600 text-white text-[10px] font-black uppercase py-3 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-blue-200"
                      >
                        <FileText className="w-4 h-4" />
                        {att.filename}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-widest px-2">
                    {allowedEmailFilters.length === 0 
                      ? "V nastavení definujte povolené filtry pro aktivaci chytrého propojení."
                      : "Vyberte e-mail od ověřeného dodavatele s přílohou PDF/CSV."}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex-1 flex flex-col gap-4">
               <div className="h-40 bg-slate-200/30 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">
                    Filtry dodavatelů
                  </p>
                  <div className="flex flex-wrap justify-center gap-1">
                    {allowedEmailFilters.map((f, i) => (
                      <span key={i} className="bg-white px-2 py-1 rounded-lg border border-slate-200 text-[8px] font-bold text-slate-500">
                        {f}
                      </span>
                    ))}
                    {allowedEmailFilters.length === 0 && <span className="text-[8px] text-slate-300 italic font-medium">Žádné filtry nenastaveny</span>}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Selection Modal */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isAnalyzing && setIsOrderModalOpen(false)}></div>
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                  <ClipboardPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Výběr cílové zakázky</h3>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Import položek z: {analyzingAttachment?.filename}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOrderModalOpen(false)}
                disabled={isAnalyzing}
                className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all disabled:opacity-30"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-6" />
                  <h4 className="text-xl font-black text-slate-900 mb-2 uppercase">Stahuji přílohu</h4>
                  <p className="text-slate-500 font-medium max-w-sm">
                    Příprava dokumentu pro analýzu v editoru zakázky...
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-4">Rozpracované a aktivní zakázky</p>
                  {services.filter(s => s.status === 'přijato' || s.status === 'probíhá' || s.status === 'naplánováno').length > 0 ? (
                    services
                      .filter(s => s.status === 'přijato' || s.status === 'probíhá' || s.status === 'naplánováno')
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(order => {
                        const vehicle = vehicles.find(v => v.id === order.vehicleId);
                        const customer = vehicle ? customers.find(c => c.id === vehicle.customerId) : null;
                        return (
                          <button
                            key={order.id}
                            onClick={() => handleSelectOrderAndAnalyze(order.id)}
                            className="w-full text-left p-5 bg-slate-50 rounded-[2rem] border-2 border-transparent hover:border-blue-500 hover:bg-white transition-all group relative overflow-hidden"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-slate-400 group-hover:text-blue-600 transition-colors">
                                  <Car className="w-6 h-6" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-black text-slate-900">{vehicle?.make} {vehicle?.model}</span>
                                    <span className="bg-slate-900 text-white text-[9px] px-2 py-0.5 rounded-lg font-bold">{vehicle?.licensePlate}</span>
                                  </div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">{customer?.firstName} {customer?.lastName} • {order.id}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg mb-1 ${
                                  order.status === 'probíhá' ? 'bg-amber-100 text-amber-700' : 
                                  order.status === 'přijato' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {order.status}
                                </div>
                                <span className="text-[10px] font-bold text-slate-400">{new Date(order.date).toLocaleDateString('cs-CZ')}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-[2rem]">
                      <ClipboardList className="w-12 h-12 opacity-10 mb-4" />
                      <p className="text-sm font-bold">Žádné aktivní zakázky k dispozici</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!isAnalyzing && (
              <div className="p-8 bg-slate-50/50 border-t border-slate-100">
                <p className="text-[9px] text-slate-400 font-medium italic text-center leading-relaxed">
                  Tip: Po kliknutí na zakázku se stáhne příloha a budete přesměrováni do editoru k automatické analýze.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailManager;
