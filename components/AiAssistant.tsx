
import React, { useState } from 'react';
import { BrainCircuit, Sparkles, Send, Loader2, History, MessageSquare, Car, ShieldCheck } from 'lucide-react';
import { Vehicle, ServiceRecord } from '../types';
import { diagnoseProblem, getMaintenanceAdvice } from '../services/geminiService';

interface AiAssistantProps {
  vehicles: Vehicle[];
  services: ServiceRecord[];
}

const AiAssistant: React.FC<AiAssistantProps> = ({ vehicles, services }) => {
  const [selectedVid, setSelectedVid] = useState(vehicles[0]?.id || '');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [mode, setMode] = useState<'diag' | 'plan'>('diag');

  const handleAction = async () => {
    setLoading(true);
    setResult(null);
    const vehicle = vehicles.find(v => v.id === selectedVid);
    if (!vehicle) return;

    if (mode === 'diag') {
      const res = await diagnoseProblem(description, `${vehicle.make} ${vehicle.model} (${vehicle.year})`);
      setResult(res || "Chyba při diagnostice.");
    } else {
      const history = services.filter(s => s.vehicleId === vehicle.id);
      const res = await getMaintenanceAdvice(vehicle, history);
      setResult(res || "Chyba při generování plánu.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full -mr-48 -mt-48 blur-3xl"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 px-4 py-2 rounded-full backdrop-blur-md mb-6 border border-white/10">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">Gemini 3 Pro Engine</span>
            </div>
            <h2 className="text-4xl font-black mb-4 tracking-tighter leading-tight">Chytrý asistent mechanika</h2>
            <p className="text-blue-100/70 text-lg font-medium leading-relaxed">
              Využijte sílu AI pro přesnější diagnostiku a prediktivní údržbu. Ušetřete čas sobě i svým zákazníkům.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={() => { setMode('diag'); setResult(null); }}
              className={`px-8 py-4 rounded-2xl font-bold transition-all ${mode === 'diag' ? 'bg-white text-slate-900 shadow-xl scale-105' : 'bg-white/5 text-white hover:bg-white/10'}`}
            >
              Diagnostika závad
            </button>
            <button 
              onClick={() => { setMode('plan'); setResult(null); }}
              className={`px-8 py-4 rounded-2xl font-bold transition-all ${mode === 'plan' ? 'bg-white text-slate-900 shadow-xl scale-105' : 'bg-white/5 text-white hover:bg-white/10'}`}
            >
              Plán údržby
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Vyberte vozidlo</label>
                <div className="relative">
                   <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                   <select 
                    value={selectedVid}
                    onChange={(e) => setSelectedVid(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900 appearance-none"
                  >
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.make} {v.model} ({v.licensePlate})</option>
                    ))}
                  </select>
                </div>
              </div>

              {mode === 'diag' && (
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Symptomy a hlášení</label>
                  <div className="relative">
                    <MessageSquare className="absolute left-4 top-4 w-5 h-5 text-slate-300" />
                    <textarea 
                      rows={5}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900 resize-none placeholder:text-slate-300"
                      placeholder="Popište chování vozu, divné zvuky nebo chybové kódy..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <button 
                onClick={handleAction}
                disabled={loading || (mode === 'diag' && !description)}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (mode === 'diag' ? <BrainCircuit className="w-6 h-6" /> : <History className="w-6 h-6" />)}
                {loading ? "Analyzuji..." : (mode === 'diag' ? "ANALYZOVAT ZÁVADU" : "GENEROVAT PLÁN")}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {result ? (
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-10 animate-in zoom-in-95 duration-500 h-full relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                  <ShieldCheck className="w-64 h-64 text-slate-900" />
               </div>
               <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-50">
                  <div className="p-3 bg-blue-50 rounded-2xl">
                    <Sparkles className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    {mode === 'diag' ? 'Výsledek analýzy' : 'Doporučená údržba'}
                  </h3>
                </div>
                <div className="prose prose-slate max-w-none">
                  <p className="text-slate-600 font-medium text-lg leading-relaxed whitespace-pre-wrap">
                    {result}
                  </p>
                </div>
                <div className="mt-12 flex items-center justify-between p-6 bg-slate-50 rounded-3xl">
                   <p className="text-xs font-bold text-slate-400 max-w-md">Výstup generovaný AI slouží jako podpora rozhodování. Finální diagnózu provádí technik.</p>
                   <button className="text-blue-600 font-black text-xs hover:underline">TISK PROTOKOLU</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/40 backdrop-blur-sm rounded-[2rem] border-4 border-dashed border-slate-200 h-full min-h-[400px] flex flex-col items-center justify-center p-12 text-center">
              <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mb-8">
                <BrainCircuit className="w-12 h-12 text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3">Připraven k analýze</h3>
              <p className="text-slate-400 font-bold max-w-xs leading-relaxed">Vyberte vozidlo a akci v levém panelu pro spuštění asistence.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiAssistant;
