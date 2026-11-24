
import React from 'react';
// Add missing 'Car' import
import { Calendar, CheckCircle, Clock, Wrench, User, CreditCard, Car } from 'lucide-react';
import { ServiceRecord, Vehicle } from '../types';

interface ServiceProps {
  services: ServiceRecord[];
  vehicles: Vehicle[];
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '---';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

const ServiceHistory: React.FC<ServiceProps> = ({ services, vehicles }) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Servisní historie</h2>
          <p className="text-slate-500 font-medium">Přehled všech provedených úkonů.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-left">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Datum / ID</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vozidlo</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Úkon</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Stav</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Cena</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map(s => {
                const vehicle = vehicles.find(v => v.id === s.vehicleId);
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <p className="text-sm font-black text-slate-900 mb-0.5">{formatDate(s.date)}</p>
                      <p className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter uppercase">#SR-{s.id}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-white transition-colors">
                          <Car className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{vehicle?.make} {vehicle?.model}</p>
                          <p className="text-[10px] font-bold text-blue-600 font-mono">{vehicle?.licensePlate}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 max-w-xs">
                      <p className="text-sm font-medium text-slate-600 line-clamp-2">{s.description}</p>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight ${
                        s.status === 'hotovo' ? 'bg-emerald-50 text-emerald-600' : 
                        s.status === 'naplánováno' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {s.status === 'hotovo' ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {s.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <p className="text-base font-black text-slate-900">{s.cost.toLocaleString()} Kč</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ServiceHistory;
