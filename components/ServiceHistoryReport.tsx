
import React from 'react';
import { ServiceRecord, Vehicle, CompanyInfo } from '../types';
import { Car, Wrench, Calendar, Gauge, FileText, MapPin, Phone, Mail } from 'lucide-react';

interface ServiceHistoryReportProps {
  vehicle: Vehicle;
  services: ServiceRecord[];
  companyInfo: CompanyInfo;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '---';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

const ServiceHistoryReport: React.FC<ServiceHistoryReportProps> = ({ vehicle, services, companyInfo }) => {
  const today = new Date().toLocaleDateString('cs-CZ');
  console.log("REPORT DEBUG: Vykresluji historii pro auto:", vehicle?.licensePlate, "Počet záznamů:", services?.length);

  // Filter and sort services
  const completedServices = services
    .filter(s => {
      const status = (s.status || '').toLowerCase();
      return status === 'hotovo' || status === 'předáno';
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div id="service-history-report-content" className="service-history-print bg-white text-black font-sans">
      <table className="w-full">
        <thead className="display-table-header-group">
          <tr>
            <td>
              {/* Header section (repeated on each page) */}
              <div className="pt-10 px-10">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                      <Wrench className="w-10 h-10" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">{companyInfo.name}</h1>
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Servisní historie</h2>
                  </div>
                </div>

                {/* Vehicle Header info */}
                <div className="grid grid-cols-4 gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 mb-8">
                  <div className="col-span-2">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Vozidlo</p>
                    <p className="text-sm font-black text-slate-900 uppercase">{vehicle.make} {vehicle.model}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SPZ</p>
                    <p className="text-sm font-black text-blue-700 font-mono">{vehicle.licensePlate}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">VIN</p>
                    <p className="text-sm font-black text-slate-900 font-mono text-[10px]">{vehicle.vin}</p>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>
              <div className="px-10 pb-20">
                <div className="space-y-0">
                  {completedServices.length > 0 ? (
                    completedServices.map((record, index) => (
                      <div key={record.id} className="py-6 border-b border-slate-100 break-inside-avoid page-break-inside-avoid">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1 rounded-md">
                              <Calendar className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-black">{formatDate(record.date)}</span>
                            </div>
                            {record.mileageAtEntry && (
                              <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-md border border-blue-100">
                                <Gauge className="w-3.5 h-3.5" />
                                <span className="text-[11px] font-black">{record.mileageAtEntry.toLocaleString()} KM</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pl-2">
                          <h4 className="text-sm font-black text-slate-800 uppercase mb-3 leading-tight">{record.aiTransformedDescription || record.description}</h4>
                          
                          {((record.parts && record.parts.length > 0) || (record.laborHours && record.laborHours > 0)) && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {record.laborHours && record.laborHours > 0 && (
                                <span className="text-[9px] font-bold text-blue-600 bg-blue-50/50 border border-blue-100 px-2 py-0.5 rounded uppercase">
                                  Práce: {record.laborHours}h
                                </span>
                              )}
                              {record.parts && record.parts.map((part, pIdx) => (
                                <span key={pIdx} className="text-[9px] font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                                  {part.description}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center text-slate-300 uppercase font-black tracking-widest text-sm">
                      Historie neobsahuje žádné dokončené záznamy
                    </div>
                  )}
                </div>
              </div>
            </td>
          </tr>
        </tbody>

        <tfoot className="display-table-footer-group">
          <tr>
            <td>
              <div className="h-20 px-10 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div>Generováno dne {today} | {companyInfo.name}</div>
                <div className="page-number"></div>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>

      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          #service-history-report-content {
            position: absolute !important;
            top: -9999px !important;
            left: -9999px !important;
            width: 210mm !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
        }
        @media print {
          @page {
            size: A4;
            margin: 0;
            counter-increment: page;
          }
          
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          #service-history-report-content {
            display: block !important;
            position: relative !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
          }

          .display-table-header-group { display: table-header-group; }
          .display-table-footer-group { display: table-footer-group; }

          .page-number:after {
            content: "Strana " counter(page);
          }

          .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />
    </div>
  );
};

export default ServiceHistoryReport;
