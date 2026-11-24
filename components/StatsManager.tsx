import React, { useState, useMemo } from 'react';
import { 
  BarChart3, TrendingUp, Coins, Users, Car, CheckCircle2, 
  ArrowUpRight, ArrowDownRight, Wallet, Calculator,
  AlertCircle, PieChart as PieChartIcon, History, X, Clock, AlertTriangle, Calendar,
  User, Phone, Fuel, CalendarDays, Gauge,
  Disc, Zap, Wind, Droplets, ShieldCheck, Settings2, Sparkles, Activity, Box, Wrench
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { ServiceRecord, Invoice, Vehicle, Customer, StatsSettings, CompanyInfo } from '../types';

interface StatsManagerProps {
  services: ServiceRecord[];
  invoices: Invoice[];
  vehicles: Vehicle[];
  customers: Customer[];
  statsSettings: StatsSettings;
  companyInfo: CompanyInfo;
}

type Period = 'week' | 'month' | 'all';
type Tab = 'finance' | 'orders' | 'customers' | 'vehicles' | 'charts' | 'profit' | 'team';

const StatsManager: React.FC<StatsManagerProps> = ({ services, invoices, vehicles, customers, statsSettings, companyInfo }) => {
  const [period, setPeriod] = useState<Period>('all');
  const [activeTab, setActiveTab] = useState<Tab>('finance');
  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);

  const selectedCustomerStats = useMemo(() => {
    if (!selectedCustId) return null;
    const customer = customers.find(c => c.id === selectedCustId);
    if (!customer) return null;

    const customerVehicles = vehicles.filter(v => v.customerId === selectedCustId);
    const vehicleIds = new Set(customerVehicles.map(v => v.id));
    
    const customerServices = services
      .filter(s => vehicleIds.has(s.vehicleId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const closedOrders = customerServices.filter(s => s.status === 'hotovo').length;

    // Četnost návštěv
    let avgInterval = 0;
    if (customerServices.length > 1) {
      const diffs = [];
      for (let i = 1; i < customerServices.length; i++) {
        const d1 = new Date(customerServices[i-1].date).getTime();
        const d2 = new Date(customerServices[i].date).getTime();
        diffs.push((d2 - d1) / (1000 * 3600 * 24));
      }
      avgInterval = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
    }

    // Platební morálka (logika z InvoiceManager)
    const customerInvoices = invoices.filter(inv => inv.customerId === selectedCustId);
    const unpaidInvoices = customerInvoices.filter(inv => inv.status === 'neuhrazeno' && !inv.excludeFromStats);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let maxDelay = 0;
    let totalDelay = 0;
    let delayedCount = 0;

    unpaidInvoices.forEach(inv => {
      const due = new Date(inv.dueDate);
      if (now > due) {
        const delay = Math.round((now.getTime() - due.getTime()) / (1000 * 3600 * 24));
        if (delay > 0) {
          totalDelay += delay;
          delayedCount++;
          if (delay > maxDelay) maxDelay = delay;
        }
      }
    });

    const avgDelay = delayedCount > 0 ? Math.round(totalDelay / delayedCount) : 0;

    return {
      customer,
      vehicleCount: customerVehicles.length,
      closedOrders,
      avgInterval,
      avgDelay,
      delayedCount
    };
  }, [selectedCustId, customers, vehicles, services, invoices]);

  const stats = useMemo(() => {
    const now = new Date();
    
    const filterByPeriod = (dateStr: string) => {
      if (period === 'all') return true;
      const date = new Date(dateStr);
      if (period === 'month') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
      if (period === 'week') {
        const startOfWeek = new Date(now);
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        return date >= startOfWeek;
      }
      return true;
    };

    const periodServices = services.filter(s => filterByPeriod(s.date));
    const periodInvoices = invoices.filter(inv => filterByPeriod(inv.issueDate));

    const completedOrders = periodServices.filter(s => s.status === 'hotovo').length;
    const cancelledOrders = periodServices.filter(s => s.status === 'zrušeno').length;
    
    // Základem pro statistiky je obrat bez DPH (sumujeme základ)
    const turnoverExclDph = periodInvoices.reduce((sum, inv) => sum + (Number(inv.totalExclDph) || 0), 0);
    
    // Náklady na materiál (z faktur) - nyní vstupují vč. DPH, převádíme na základ pokud je plátce
    const materialCostsExclDph = periodInvoices.reduce((sum, inv) => {
      const rawCost = Number(inv.costs) || 0;
      const costBase = companyInfo.isVatPayer ? (rawCost / 1.21) : rawCost;
      return sum + costBase;
    }, 0);

    // Režijní náklady (z nastavení) - předpokládáme vstup vč. DPH
    let rawOverheadCosts = 0;
    const costItems = statsSettings.costItems || [];
    const recurringSum = costItems.filter(item => item.isRecurring).reduce((sum, item) => sum + item.amount, 0);
    const oneTimeSum = costItems.filter(item => !item.isRecurring).reduce((sum, item) => sum + item.amount, 0);

    if (period === 'month') {
      rawOverheadCosts = recurringSum + oneTimeSum;
    } else if (period === 'week') {
      rawOverheadCosts = (recurringSum / 4) + oneTimeSum;
    } else {
      // Pro období "vše" odhadneme počet měsíců z faktur
      const uniqueMonths = new Set(invoices.map(inv => inv.issueDate.substring(0, 7)));
      const monthsCount = Math.max(1, uniqueMonths.size);
      rawOverheadCosts = (monthsCount * recurringSum) + oneTimeSum;
    }

    const overheadCostsExclDph = companyInfo.isVatPayer ? (rawOverheadCosts / 1.21) : rawOverheadCosts;
    const totalCostsExclDph = materialCostsExclDph + overheadCostsExclDph;
    
    // Konzistentní přepočet s DPH pro zobrazení z vypočteného základu
    const turnoverInclDph = companyInfo.isVatPayer ? turnoverExclDph * 1.21 : turnoverExclDph;
    const totalCostsInclDph = companyInfo.isVatPayer ? totalCostsExclDph * 1.21 : totalCostsExclDph;
    
    const netProfit = turnoverExclDph - totalCostsExclDph;
    const avgOrderValue = completedOrders > 0 ? turnoverInclDph / completedOrders : 0;

    // Data pro grafy - trendy za posledních 6 měsíců
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return d.toISOString().substring(0, 7);
    });

    const chartData = last6Months.map(monthStr => {
      const monthInvoices = invoices.filter(inv => inv.issueDate.startsWith(monthStr));
      const monthTurnover = monthInvoices.reduce((sum, inv) => sum + (Number(inv.totalExclDph) || 0), 0);
      
      const monthMaterialCosts = monthInvoices.reduce((sum, inv) => {
        const rawC = Number(inv.costs) || 0;
        return sum + (companyInfo.isVatPayer ? rawC / 1.21 : rawC);
      }, 0);
      
      const monthOverheadCosts = companyInfo.isVatPayer ? (recurringSum / 1.21) : recurringSum;
      const monthCosts = monthMaterialCosts + monthOverheadCosts;
      
      return {
        name: new Date(monthStr).toLocaleDateString('cs-CZ', { month: 'short' }),
        obrat: Math.round(monthTurnover),
        naklady: Math.round(monthCosts),
        zisk: Math.round(monthTurnover - monthCosts)
      };
    });

    const realCustomers = customers.filter(c => !(c.firstName.toLowerCase() === 'zákazník' && c.lastName.toLowerCase() === 'neznámý'));

    return {
      completedOrders,
      cancelledOrders,
      turnoverExclDph: Math.round(turnoverExclDph),
      turnoverInclDph: Math.round(turnoverInclDph),
      netProfit: Math.round(netProfit),
      totalCostsExclDph: Math.round(totalCostsExclDph),
      totalCostsInclDph: Math.round(totalCostsInclDph),
      overheadCosts: Math.round(overheadCostsExclDph),
      materialCosts: Math.round(materialCostsExclDph),
      invoiceCount: periodInvoices.length,
      avgOrderValue: Math.round(avgOrderValue),
      chartData,
      totalRealCustomers: realCustomers.length,
      privateRealCustomers: realCustomers.filter(c => c.customerType === 'soukromý').length,
      companyRealCustomers: realCustomers.filter(c => c.customerType === 'firemní').length,
      customerRanking: realCustomers.map(c => {
        const customerInvoices = invoices.filter(inv => inv.customerId === c.id);
        const revenue = customerInvoices.reduce((sum, inv) => sum + (Number(inv.totalExclDph) || 0), 0);
        const costs = customerInvoices.reduce((sum, inv) => {
          const rawCost = Number(inv.costs) || 0;
          return sum + (companyInfo.isVatPayer ? rawCost / 1.21 : rawCost);
        }, 0);
        return {
          id: c.id,
          name: c.customerType === 'firemní' ? (c.companyName || `${c.firstName} ${c.lastName}`) : `${c.firstName} ${c.lastName}`,
          revenue: Math.round(revenue),
          profit: Math.round(revenue - costs)
        };
      }).sort((a, b) => b.revenue - a.revenue),
      // Statistiky pro vozidla
      vehicleMakes: (() => {
        const counts: Record<string, { count: number; displayName: string }> = {};
        
        vehicles.forEach(v => {
          const raw = (v.make || '').trim();
          if (!raw) return;
          
          // Normalizace pro sloučení (bez diakritiky, velká písmena, ořezáno)
          const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
          
          if (!counts[normalized]) {
            // Prvotní nastavení s "hezkým" formátem (První velké, ostatní malé)
            // Pokud má původní text diakritiku, zkusíme ji zachovat v hezkém formátu
            const niceName = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
            counts[normalized] = { count: 1, displayName: niceName };
          } else {
            counts[normalized].count += 1;
            // Pokud stávající displayName nemá diakritiku a nový raw ano, nahodíme ten s diakritikou
            const currentHasNoDiacritics = counts[normalized].displayName === counts[normalized].displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const newHasDiacritics = raw !== raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            if (currentHasNoDiacritics && newHasDiacritics) {
              const niceName = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
              counts[normalized].displayName = niceName;
            }
          }
        });
        
        return Object.values(counts)
          .map(item => ({ name: item.displayName, count: item.count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
      })(),
      avgVehicleAge: (() => {
        const currentYear = new Date().getFullYear();
        const totalAge = vehicles.reduce((sum, v) => sum + (currentYear - (Number(v.year) || currentYear)), 0);
        return vehicles.length > 0 ? (totalAge / vehicles.length).toFixed(1) : '---';
      })(),
      avgMileage: (() => {
        const totalMileage = vehicles.reduce((sum, v) => sum + (Number(v.mileage) || 0), 0);
        return vehicles.length > 0 ? Math.round(totalMileage / vehicles.length) : 0;
      })(),
      stkNext30Days: (() => {
        const now = new Date();
        const next30Days = new Date();
        next30Days.setDate(now.getDate() + 30);
        return vehicles.filter(v => {
          if (!v.stkExpirationDate) return false;
          const expDate = new Date(v.stkExpirationDate);
          return expDate >= now && expDate <= next30Days;
        }).length;
      })(),
      fuelRatio: (() => {
        const stats = { diesel: 0, gasoline: 0, gasoline95: 0, gasoline98: 0, other: 0 };
        vehicles.forEach(v => {
          if (v.fuelType === 'Nafta') {
            stats.diesel++;
          } else if (v.fuelType === 'Benzín 95' || v.fuelType === 'Benzín 98') {
            stats.gasoline++;
            if (v.fuelType === 'Benzín 95') stats.gasoline95++;
            else stats.gasoline98++;
          } else {
            stats.other++;
          }
        });
        return stats;
      })(),
      // Analýza zisku - Práce vs Materiál
      ...(() => {
        let workProfitExclDph = 0;
        periodInvoices.forEach(inv => {
          const workSum = inv.items.reduce((sum, item) => {
            const descMatch = (item.description || '').toLowerCase().includes('práce');
            const unitMatch = (item.unit || '').toLowerCase() === 'h';
            if (descMatch || unitMatch) {
              return sum + (Number(item.unitPrice) * Number(item.quantity));
            }
            return sum;
          }, 0);
          workProfitExclDph += workSum;
        });

        const materialProfitExclDph = turnoverExclDph - workProfitExclDph - materialCostsExclDph;

        return {
          workProfitExclDph: Math.round(workProfitExclDph),
          materialProfitExclDph: Math.round(materialProfitExclDph),
          workProfitInclDph: Math.round(companyInfo.isVatPayer ? workProfitExclDph * 1.21 : workProfitExclDph),
          materialProfitInclDph: Math.round(companyInfo.isVatPayer ? materialProfitExclDph * 1.21 : materialProfitExclDph),
        };
      })(),
      // Výtěžnost úkonů
      categoryStats: (() => {
        const categories = [
          { id: 'oil', label: 'Olejový servis', keywords: ['olej', 'filtr', 'proplach', 'maziv'], icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-50', chartColor: '#3b82f6' },
          { id: 'brakes', label: 'Brzdový servis', keywords: ['brzd', 'kotouč', 'destičk', 'abs', 'brzdová kapalina', 'brzd. kapalina'], icon: ShieldCheck, color: 'text-red-500', bg: 'bg-red-50', chartColor: '#ef4444' },
          { id: 'axle', label: 'Servis náprav', keywords: ['čep', 'rameno', 'tlumič', 'geometrie', 'náprav', 'ložisko', 'tyč', 'pruzina', 'horni ulozeni', 'homokyneticky', 'poloos', 'silentblok ramene', 'řizeni', 'stabiliizator'], icon: Settings2, color: 'text-amber-600', bg: 'bg-amber-50', chartColor: '#d97706' },
          { id: 'body', label: 'Servis karoserie', keywords: ['lak', 'plech', 'blatník', 'nárazník', 'zrcátko', 'sklo', 'okno'], icon: Box, color: 'text-slate-600', bg: 'bg-slate-50', chartColor: '#475569' },
          { id: 'electric', label: 'Servis elektroinstalace', keywords: ['diagnostika', 'baterie', 'svíčk', 'žárovka', 'kabel', 'senzor', 'snímač'], icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-50', chartColor: '#eab308' },
          { id: 'ac', label: 'Servis klimatizace', keywords: ['klimatiz', 'chladivo', 'r134a', 'r1234yf', 'dezinfekce', 'výparník'], icon: Wind, color: 'text-cyan-500', bg: 'bg-cyan-50', chartColor: '#06b6d4' },
          { id: 'tires', label: 'Pneuservis', keywords: ['pneu', 'přezutí', 'vyvážení', 'disk', 'ventil', 'defekt'], icon: Disc, color: 'text-slate-900', bg: 'bg-slate-100', chartColor: '#0f172a' }
        ];

        return categories.map(cat => {
          const records = periodServices.filter(s => {
            if (s.status !== 'hotovo') return false;
            const text = (s.description || '').toLowerCase();
            return cat.keywords.some(k => text.includes(k));
          });
          
          const categoryTurnover = records.reduce((sum, s) => {
            const inv = invoices.find(i => i.orderId === s.id);
            if (!inv) return sum;
            return sum + (Number(inv.totalExclDph) || 0);
          }, 0);

          return {
            ...cat,
            count: records.length,
            totalRevenue: Math.round(categoryTurnover),
            avgPrice: records.length > 0 ? Math.round(categoryTurnover / records.length) : 0
          };
        }).sort((a, b) => b.totalRevenue - a.totalRevenue);
      })(),
      // Data pro nové grafy
      profitTrend6m: last6Months.map(monthStr => {
        const monthInvoices = invoices.filter(inv => inv.issueDate.startsWith(monthStr));
        let workProfit = 0;
        let materialProfit = 0;
        monthInvoices.forEach(inv => {
          const workSum = inv.items.reduce((sum, item) => {
            const descMatch = (item.description || '').toLowerCase().includes('práce');
            const unitMatch = (item.unit || '').toLowerCase() === 'h';
            if (descMatch || unitMatch) return sum + (Number(item.unitPrice) * Number(item.quantity));
            return sum;
          }, 0);
          workProfit += workSum;
          const rawCost = Number(inv.costs) || 0;
          const costBase = companyInfo.isVatPayer ? (rawCost / 1.21) : rawCost;
          materialProfit += (Number(inv.totalExclDph) || 0) - workSum - costBase;
        });
        return {
          name: new Date(monthStr).toLocaleDateString('cs-CZ', { month: 'short' }),
          workProfit: Math.round(workProfit),
          materialProfit: Math.round(materialProfit)
        };
      }),
      paymentDisciplineTrend: last6Months.map(monthStr => {
        const monthInvoices = invoices.filter(inv => inv.issueDate.startsWith(monthStr));
        const paid = monthInvoices.filter(inv => inv.status === 'uhrazeno' || (inv.status === 'neuhrazeno' && inv.excludeFromStats)).reduce((sum, inv) => sum + (Number(inv.totalExclDph) || 0), 0);
        const unpaid = monthInvoices.filter(inv => (inv.status === 'neuhrazeno' && !inv.excludeFromStats) || inv.status === 'storno').reduce((sum, inv) => sum + (Number(inv.totalExclDph) || 0), 0);
        return {
          name: new Date(monthStr).toLocaleDateString('cs-CZ', { month: 'short' }),
          paid: Math.round(paid),
          unpaid: Math.round(unpaid)
        };
      }),
      workloadByDay: (() => {
        const days = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
        const counts = [0, 0, 0, 0, 0, 0, 0];
        periodServices.forEach(s => {
          if (s.date) {
            const d = new Date(s.date).getDay();
            const index = d === 0 ? 6 : d - 1;
            counts[index]++;
          }
        });
        return days.map((name, i) => ({ name, count: counts[i] })).filter(d => d.name !== 'Neděle' || d.count > 0);
      })()
    };
  }, [services, invoices, period, statsSettings, companyInfo, customers, vehicles]);

  const technicianStats = useMemo(() => {
    const statsMap: Record<string, { orderCount: number; totalExcl: number; laborExcl: number; totalHours: number }> = {};
    
    // Filtrujeme zakázky podle zvoleného období (pokud chceme statistiky platit pro aktuální filtr)
    // Zkusíme aplikovat i období
    const filterByPeriod = (dateStr: string) => {
      if (period === 'all') return true;
      const now = new Date();
      const date = new Date(dateStr);
      if (period === 'month') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
      if (period === 'week') {
        const startOfWeek = new Date(now);
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        return date >= startOfWeek;
      }
      return true;
    };

    services.filter(s => filterByPeriod(s.date)).forEach(s => {
      if (s.status === 'zrušeno') return;
      
      const techName = s.technician || (s as any).technicianId || (s as any).assignedTo;
      if (!techName) return; // ignorujeme nepřidělené zakázky

      if (!statsMap[techName]) {
        statsMap[techName] = { orderCount: 0, totalExcl: 0, laborExcl: 0, totalHours: 0 };
      }

      if (s.status === 'hotovo') {
        statsMap[techName].orderCount += 1;
      }

      const matchingInvoices = invoices.filter(inv => inv.orderId === s.id && !inv.excludeFromStats);
      
      matchingInvoices.forEach(inv => {
        statsMap[techName].totalExcl += Number(inv.totalExclDph) || 0;
        
        const discountPercent = Number(inv.discount) || 0;
        inv.items.forEach(item => {
          const isLabor = item.unit?.toLowerCase() === 'h' || item.description?.toLowerCase().includes('práce');
          if (isLabor) {
            const itemBase = (item.quantity * item.unitPrice);
            const discountedBase = itemBase * (1 - (discountPercent / 100));
            statsMap[techName].laborExcl += discountedBase;
            
            if (item.unit?.toLowerCase() === 'h') {
              statsMap[techName].totalHours += Number(item.quantity) || 0;
            }
          }
        });
      });
    });

    return Object.entries(statsMap).map(([name, data]) => ({
      name,
      ...data,
      avgHoursPerOrder: data.orderCount > 0 ? (data.totalHours / data.orderCount) : 0
    })).sort((a, b) => b.totalExcl - a.totalExcl);
  }, [services, invoices, period]);

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'finance', label: 'Finance', icon: Coins },
    { id: 'orders', label: 'Zakázky', icon: History },
    { id: 'customers', label: 'Zákazníci', icon: Users },
    { id: 'team', label: 'Tým', icon: Users },
    { id: 'vehicles', label: 'Vozidla', icon: Car },
    { id: 'profit', label: 'Analýza zisku', icon: TrendingUp },
    { id: 'charts', label: 'Grafy', icon: BarChart3 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Statistiky servisu</h2>
          <p className="text-slate-500 font-medium">Analýza výkonnosti a ekonomiky vašeho podnikání.</p>
        </div>

        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm flex gap-1">
          {[
            { id: 'week', label: 'Týden' },
            { id: 'month', label: 'Měsíc' },
            { id: 'all', label: 'Vše' }
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as Period)}
              className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${
                period === p.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {p.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-200/50 w-full sm:w-fit rounded-2xl border border-slate-100">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-blue-600 shadow-md scale-[1.02]' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'finance' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
                <Coins className="w-32 h-32 text-blue-900" />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
                  <Coins className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Obrat v období</p>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter">
                    {stats.turnoverInclDph.toLocaleString()} Kč
                  </h3>
                  <span className="text-sm font-bold text-slate-400">
                    ({stats.turnoverExclDph.toLocaleString()} Kč <span className="text-[10px] uppercase font-black">bez DPH</span>)
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-blue-600">
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">z {stats.invoiceCount} dokladů</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-6 text-red-600">
                  <Calculator className="w-6 h-6" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Celkové výdaje</p>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter">
                    {stats.totalCostsInclDph.toLocaleString()} Kč
                  </h3>
                  <span className="text-sm font-bold text-slate-400">
                    ({stats.totalCostsExclDph.toLocaleString()} Kč <span className="text-[10px] uppercase font-black">bez DPH</span>)
                  </span>
                </div>
                <div className="mt-4 flex flex-col gap-1">
                   <div className="flex items-center gap-2 text-red-500">
                      <ArrowDownRight className="w-3 h-3" />
                      <span className="text-[9px] font-bold uppercase">Materiál: {stats.materialCosts.toLocaleString()} Kč (v základu)</span>
                   </div>
                   <div className="flex items-center gap-2 text-slate-400">
                      <ArrowDownRight className="w-3 h-3" />
                      <span className="text-[9px] font-bold uppercase">Provoz: {stats.overheadCosts.toLocaleString()} Kč (v základu)</span>
                   </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group lg:col-span-1">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-32 h-32 text-emerald-400" />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-6 border border-emerald-500/30">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Čistý zisk (bez DPH)</p>
                <h3 className="text-3xl font-black text-white tracking-tighter">
                  {stats.netProfit.toLocaleString()} Kč
                </h3>
                <div className="mt-4 flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">Odhadovaný profit</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-3 bg-slate-50 rounded-[2.5rem] p-10 border border-slate-100 mt-4">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Rozdělení financí v období (v základu daně)</h4>
              <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Náklady celkem</span>
                        <span className="text-sm font-black text-slate-900">{stats.totalCostsExclDph.toLocaleString()} Kč</span>
                    </div>
                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-400 transition-all duration-1000" 
                          style={{ width: `${stats.turnoverExclDph > 0 ? (stats.totalCostsExclDph / stats.turnoverExclDph) * 100 : 0}%` }}
                        />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Marže / Zisk</span>
                        <span className="text-sm font-black text-emerald-600">{stats.netProfit.toLocaleString()} Kč</span>
                    </div>
                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-1000" 
                          style={{ width: `${stats.turnoverExclDph > 0 ? (stats.netProfit / stats.turnoverExclDph) * 100 : 0}%` }}
                        />
                    </div>
                  </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-6 h-6 text-amber-600" />
              </div>
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Dokončené zakázky</h4>
              <h3 className="text-5xl font-black text-slate-900 tracking-tighter mb-4">{stats.completedOrders}</h3>
              <div className="pt-4 border-t border-slate-50">
                <p className="text-xs font-bold text-slate-400 uppercase">Zrušené zakázky: <span className="text-red-500">{stats.cancelledOrders}</span></p>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6">
                <Wallet className="w-6 h-6 text-indigo-600" />
              </div>
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Průměrná hodnota zakázky</h4>
              <h3 className="text-5xl font-black text-slate-900 tracking-tighter mb-4">{stats.avgOrderValue.toLocaleString()} Kč</h3>
              <p className="text-xs font-bold text-slate-400 uppercase">Vypočteno z obratu včetně DPH</p>
            </div>
            
            <div className="md:col-span-2 bg-slate-900 text-white rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-10 opacity-10"><History className="w-40 h-40" /></div>
               <div className="relative z-10">
                  <h4 className="text-lg font-black uppercase mb-6 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    Efektivita servisu
                  </h4>
                  <p className="text-slate-400 font-medium mb-8 max-w-lg">V tomto období jste úspěšně odbavili {stats.completedOrders} vozidel. Váš průměrný zisk na jednu zakázku činí {stats.completedOrders > 0 ? Math.round(stats.netProfit / stats.completedOrders).toLocaleString() : 0} Kč.</p>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-xl transition-all">
              <div>
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Users className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Celkem zákazníků</span>
                </div>
                <p className="text-5xl font-black text-slate-900 tracking-tighter">{stats.totalRealCustomers}</p>
                <div className="mt-6 flex gap-3">
                   <div className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg">
                      {stats.companyRealCustomers} FIRMY ({(stats.totalRealCustomers > 0 ? (stats.companyRealCustomers / stats.totalRealCustomers * 100).toFixed(0) : 0)}%)
                   </div>
                   <div className="px-3 py-1 bg-slate-50 text-slate-500 text-[10px] font-black rounded-lg">
                      {stats.privateRealCustomers} SOUKROMÍ ({(stats.totalRealCustomers > 0 ? (stats.privateRealCustomers / stats.totalRealCustomers * 100).toFixed(0) : 0)}%)
                   </div>
                </div>
              </div>
              <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <Users className="w-10 h-10" />
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
               <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" /> TOP Zákazníci podle obratu
                  </h4>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seřazeno podle tržeb</span>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       <th className="px-8 py-4 w-16">#</th>
                       <th className="px-8 py-4">Zákazník</th>
                       <th className="px-8 py-4 text-right">Obrat / (Zisk)</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                     {stats.customerRanking.map((item, idx) => (
                       <tr 
                          key={item.id} 
                          className={`hover:bg-slate-50 transition-colors ${idx === 9 ? 'border-b-4 border-slate-900' : ''}`}
                        >
                         <td className="px-8 py-5">
                            <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-black ${idx < 3 ? 'bg-blue-600 text-white' : 'text-slate-400 bg-slate-100'}`}>
                              {idx + 1}
                            </span>
                         </td>
                         <td className="px-8 py-5">
                            <button 
                              onClick={() => setSelectedCustId(item.id)}
                              className="text-sm font-black text-slate-900 hover:text-blue-600 transition-colors text-left"
                            >
                              {item.name}
                            </button>
                         </td>
                         <td className="px-8 py-5 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-black text-slate-900">{item.revenue.toLocaleString()} Kč</span>
                              <span className="text-[10px] font-bold text-emerald-600">({item.profit.toLocaleString()} Kč)</span>
                            </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'vehicles' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm group">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-6 text-blue-600 group-hover:scale-110 transition-transform">
                  <Car className="w-6 h-6" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Celkem vozidel</p>
                <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{vehicles.length}</h3>
                <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  ~ {(vehicles.length / Math.max(1, stats.totalRealCustomers)).toFixed(1)} aut / zákazník
                </p>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm group">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-6 text-amber-600 group-hover:scale-110 transition-transform">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Průměrné stáří</p>
                <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{stats.avgVehicleAge} let</h3>
                <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">vypočteno z pole rok výroby</p>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm group">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6 text-emerald-600 group-hover:scale-110 transition-transform">
                  <Gauge className="w-6 h-6" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Průměrný nájezd</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{stats.avgMileage.toLocaleString()} km</h3>
                <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">aktuální stav tachometru</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={`rounded-[2.5rem] p-8 border shadow-sm group transition-all ${stats.stkNext30Days > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${stats.stkNext30Days > 0 ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-slate-50 text-slate-400'}`}>
                   <AlertTriangle className="w-6 h-6" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Blížící se STK (30 dní)</p>
                <div className="flex items-baseline gap-3">
                  <h3 className={`text-4xl font-black tracking-tighter ${stats.stkNext30Days > 0 ? 'text-red-600' : 'text-slate-900'}`}>{stats.stkNext30Days}</h3>
                  <span className="text-xs font-bold text-slate-400 uppercase">vozidel</span>
                </div>
                <p className="mt-4 text-xs font-medium text-slate-500 leading-relaxed">
                  {stats.stkNext30Days > 0 
                    ? `Pozor, u ${stats.stkNext30Days} vozidel vyprší technická kontrola během následujícího měsíce. Je vhodné kontaktovat zákazníky.`
                    : 'Všechna vozidla mají platnou STK na minimálně dalších 30 dní.'}
                </p>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                 <div className="space-y-6">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                             <Fuel className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 block">Zastoupení paliv</span>
                            <span className="text-xs font-bold text-slate-900 uppercase">Dle zadaných údajů v kartě</span>
                          </div>
                       </div>
                    </div>

                    {vehicles.length > 0 ? (
                      <div className="space-y-6">
                         <div className="h-6 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                            <div 
                              className="h-full bg-blue-600 transition-all relative group" 
                              style={{ width: `${(stats.fuelRatio.diesel / vehicles.length) * 100}%` }}
                            >
                               <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" title="Nafta" />
                            </div>
                            <div 
                              className="h-full bg-amber-500 transition-all relative group" 
                              style={{ width: `${(stats.fuelRatio.gasoline / vehicles.length) * 100}%` }}
                            >
                               <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" title="Benzín" />
                            </div>
                            <div 
                              className="h-full bg-slate-300 transition-all relative group" 
                              style={{ width: `${(stats.fuelRatio.other / vehicles.length) * 100}%` }}
                            >
                               <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" title="Ostatní / Nevyplněno" />
                            </div>
                         </div>

                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div className="space-y-1">
                               <div className="flex items-center gap-2">
                                 <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                                 <span className="text-[10px] font-black uppercase text-slate-700">Nafta</span>
                               </div>
                               <p className="text-xl font-black text-slate-900">{stats.fuelRatio.diesel} <span className="text-[10px] text-slate-400 font-bold">ks</span></p>
                            </div>
                            
                            <div className="space-y-1">
                               <div className="flex items-center gap-2">
                                 <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                 <span className="text-[10px] font-black uppercase text-slate-700">Benzín</span>
                               </div>
                               <div className="flex items-baseline gap-2">
                                  <p className="text-xl font-black text-slate-900">{stats.fuelRatio.gasoline} <span className="text-[10px] text-slate-400 font-bold">ks</span></p>
                                  {stats.fuelRatio.gasoline > 0 && (
                                    <span className="text-[9px] font-bold text-slate-400">
                                      ({stats.fuelRatio.gasoline95}x B95, {stats.fuelRatio.gasoline98}x B98)
                                    </span>
                                  )}
                               </div>
                            </div>

                            <div className="space-y-1">
                               <div className="flex items-center gap-2">
                                 <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                                 <span className="text-[10px] font-black uppercase text-slate-700">Ostatní</span>
                               </div>
                               <p className="text-xl font-black text-slate-900">{stats.fuelRatio.other} <span className="text-[10px] text-slate-400 font-bold">ks</span></p>
                            </div>
                         </div>
                      </div>
                    ) : (
                      <div className="py-10 text-center">
                        <Fuel className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-300 uppercase italic">Nenalezena žádná data o vozidlech</p>
                      </div>
                    )}
                 </div>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
               <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" /> TOP 5 Výrobců ve vašem servisu
                  </h4>
               </div>
               <div className="p-8 grid grid-cols-1 md:grid-cols-5 gap-6">
                 {stats.vehicleMakes.map((make, idx) => (
                   <div key={make.name} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col items-center text-center group hover:bg-white hover:shadow-xl transition-all">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-xl text-[10px] font-black mb-4 ${idx === 0 ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 shadow-sm'}`}>
                        {idx + 1}
                      </span>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">{make.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{make.count} kusů</p>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'profit' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                  <Activity className="w-32 h-32 text-blue-600" />
                </div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-6 text-blue-600">
                    <History className="w-6 h-6" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Zisk z odpracovaných hodin</p>
                  <h3 className="text-4xl font-black text-slate-900 tracking-tighter">
                    {stats.workProfitExclDph.toLocaleString()} Kč
                  </h3>
                  <div className="mt-4 flex items-center gap-2 text-blue-600">
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {stats.workProfitInclDph.toLocaleString()} Kč s DPH
                    </span>
                  </div>
                  <p className="mt-4 text-xs font-medium text-slate-400">Tato částka představuje čistý profit z vaší práce a práce vašich techniků.</p>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-32 h-32 text-emerald-600" />
                </div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6 text-emerald-600">
                    <Coins className="w-6 h-6" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Čistý zisk z materiálu</p>
                  <h3 className="text-4xl font-black text-slate-900 tracking-tighter">
                    {stats.materialProfitExclDph.toLocaleString()} Kč
                  </h3>
                   <div className="mt-4 flex items-center gap-2 text-emerald-600">
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {stats.materialProfitInclDph.toLocaleString()} Kč s DPH
                    </span>
                  </div>
                  <p className="mt-4 text-xs font-medium text-slate-400">Profit generovaný marží na dílech po odečtení nákupních nákladů.</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
               <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                       <Zap className="w-4 h-4 text-yellow-500" /> Výtěžnost servisních úkonů
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Analýza obratu podle kategorií prací</p>
                  </div>
               </div>
               <div className="divide-y divide-slate-50">
                 {stats.categoryStats.map((item) => (
                   <div key={item.id} className="p-8 hover:bg-slate-50 transition-all group">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                         <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                               <item.icon className="w-7 h-7" />
                            </div>
                            <div>
                               <h5 className="text-base font-black text-slate-900 uppercase tracking-tight">{item.label}</h5>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.count} realizací v období</p>
                            </div>
                         </div>
                         <div className="flex gap-12 md:text-right">
                            <div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Celkový obrat</p>
                               <p className="text-xl font-black text-slate-900">{item.totalRevenue.toLocaleString()} Kč</p>
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Průměr / úkon</p>
                               <p className="text-xl font-black text-blue-600">{item.avgPrice.toLocaleString()} Kč</p>
                            </div>
                         </div>
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-xl transition-all">
                <div>
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Users className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Aktivní technici</span>
                  </div>
                  <p className="text-5xl font-black text-slate-900 tracking-tighter">
                    {technicianStats.length}
                  </p>
                </div>
                <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                  <Wrench className="w-10 h-10" />
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-xl transition-all">
                <div>
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Průměrný výnos (Základ daně) na technika</span>
                  </div>
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">
                    {technicianStats.length > 0 
                      ? Math.round(technicianStats.reduce((sum, t) => sum + t.totalExcl, 0) / technicianStats.length).toLocaleString() 
                      : 0} Kč
                  </p>
                </div>
                <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                  <Calculator className="w-10 h-10" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" /> Analýza výkonu techniků
              </h3>
              
              <div className="space-y-4">
                {technicianStats.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 font-bold">Zatím žádná data o mechanicích. Zkuste vyplnit pole Technik v detailu zakázky.</div>
                ) : (
                  technicianStats.map((tech) => {
                    const workPercent = tech.totalExcl > 0 ? (tech.laborExcl / tech.totalExcl) * 100 : 0;
                    const materialPercent = tech.totalExcl > 0 ? 100 - workPercent : 0;
                    
                    return (
                      <div key={tech.name} className="p-6 bg-slate-50 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-slate-100 transition-colors border border-slate-100 group">
                        <div className="flex items-center gap-6 w-full md:w-auto">
                          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-2xl font-black text-slate-400 group-hover:text-blue-600 transition-colors shrink-0">
                            {tech.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-slate-900">{tech.name}</h4>
                            <div className="flex flex-col gap-1 mt-1">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Dokončeno: <span className="text-slate-600">{tech.orderCount} zakázek</span>
                              </p>
                              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {tech.totalHours.toFixed(1)} h celkem 
                                <span className="text-slate-400 font-bold lowercase mx-1">•</span> 
                                <span className="text-slate-500 font-bold lowercase">{tech.avgHoursPerOrder.toFixed(1)} h / zakázka</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 w-full md:mx-8">
                          <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                            <span className="text-blue-600">Práce ({workPercent.toFixed(0)}%)</span>
                            <span className="text-slate-500">Materiál ({materialPercent.toFixed(0)}%)</span>
                          </div>
                          <div className="h-4 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                            <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${workPercent}%` }} />
                            <div className="h-full bg-slate-300 transition-all duration-1000" style={{ width: `${materialPercent}%` }} />
                          </div>
                        </div>

                        <div className="text-right shrink-0 w-full md:w-auto flex flex-col md:items-end justify-between items-center md:block">
                          <div className="flex flex-col items-center md:items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Čistý výnos prací (ZD)
                            </span>
                            <p className="text-xl font-black text-blue-600">
                              {Math.round(tech.laborExcl).toLocaleString()} Kč
                            </p>
                          </div>
                          <div className="flex flex-col items-center md:items-end mt-2 pt-2 border-t border-slate-200/50 md:border-none md:p-0 md:mt-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Celkový obrat</span>
                            <p className="text-sm font-bold text-slate-900">
                              {Math.round(tech.totalExcl).toLocaleString()} Kč
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {technicianStats.length > 0 && (
                <div className="mt-12 pt-12 border-t border-slate-100">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" /> Vyfakturované hodiny (porovnání)
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={technicianStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }} />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', padding: '12px 20px', fontWeight: 'bold', fontSize: '12px' }} 
                        />
                        <Bar dataKey="totalHours" name="Vyfakturované hodiny" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'charts' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 1. Graf: Skladba zisku */}
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="flex flex-col gap-1 mb-8">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-blue-600" /> Skladba zisku (6 měsíců)
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Trend čistého zisku z práce vs. materiálu</p>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.profitTrend6m} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorWork" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorMat" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} tickFormatter={(val) => `${val / 1000}k`} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px' }}
                        itemStyle={{ fontWeight: 900, fontSize: '12px' }}
                        formatter={(value) => [`${value.toLocaleString()} Kč`]}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                      <Area type="monotone" dataKey="workProfit" stackId="1" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorWork)" name="Zisk z práce" />
                      <Area type="monotone" dataKey="materialProfit" stackId="1" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorMat)" name="Zisk z materiálu" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 2. Graf: Specializace servisu */}
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm flex flex-col">
                <div className="flex flex-col gap-1 mb-8">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                    <Activity className="w-5 h-5 text-indigo-600" /> Specializace servisu
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Podíl kategorií na celkovém počtu zakázek</p>
                </div>
                <div className="h-[300px] w-full relative flex items-center justify-center">
                  <div className="absolute flex flex-col items-center justify-center">
                    <Wrench className="w-8 h-8 text-slate-200 mb-1" />
                    <span className="text-xl font-black text-slate-900 leading-none">{stats.completedOrders}</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Zakázek</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.categoryStats}
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="label"
                        animationBegin={0}
                        animationDuration={1500}
                      >
                        {stats.categoryStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.chartColor} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip 
                         contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                         itemStyle={{ fontWeight: 900, fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
                  {stats.categoryStats.slice(0, 6).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.chartColor }} />
                      <span className="text-[9px] font-black uppercase text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Graf: Platební disciplína */}
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
                <div className="flex flex-col gap-1 mb-8">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" /> Platební disciplína
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Porovnání uhrazených a neuhrazených faktur</p>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.paymentDisciplineTrend} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} tickFormatter={(val) => `${val / 1000}k`} />
                      <Tooltip 
                         contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px' }}
                         itemStyle={{ fontWeight: 900, fontSize: '12px' }}
                         formatter={(value) => [`${value.toLocaleString()} Kč`]}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                      <Bar dataKey="paid" fill="#10b981" radius={[4, 4, 0, 0]} name="Uhrazeno" barSize={12} />
                      <Bar dataKey="unpaid" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Neuhrazeno / Splatné" barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 4. Graf: Vytíženost dnů */}
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
                <div className="flex flex-col gap-1 mb-8">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-500" /> Vytíženost dnů v týdnu
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Počet zakázek realizovaných v jednotlivých dnech</p>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.workloadByDay}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} dy={10} />
                      <YAxis hide />
                      <Tooltip 
                         contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                         itemStyle={{ fontWeight: 900, fontSize: '12px' }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Počet zakázek" barSize={34}>
                        {stats.workloadByDay.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.count === Math.max(...stats.workloadByDay.map(d => d.count)) ? '#2563eb' : '#cbd5e1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-12 opacity-5 scale-150"><PieChartIcon className="w-64 h-64" /></div>
               <div className="relative z-10 max-w-2xl">
                  <h4 className="text-2xl font-black uppercase mb-4 leading-tight">Strategický přehled dokončen</h4>
                  <p className="text-slate-400 font-medium leading-relaxed">Nové vizualizace vám umožňují sledovat efektivitu práce oproti marži z dílů a hlídat platební disciplínu vašich zákazníků v reálném čase. Poměr specializací vám napoví, kterou část servisu byste měli dále rozvíjet.</p>
               </div>
            </div>
          </div>
        )}
      </div>

      {stats.invoiceCount === 0 && period !== 'all' && (
        <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex items-center gap-4 text-amber-700">
          <AlertCircle className="w-6 h-6" />
          <div>
            <p className="font-black text-sm uppercase">Žádná data pro toto období</p>
            <p className="text-xs font-medium">Zkuste přepnout na období "Vše" pro ověření funkčnosti výpočtů.</p>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {selectedCustId && selectedCustomerStats && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedCustId(null)} />
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Detailní statistiky zákazníka</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Analýza obchodního vztahu</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCustId(null)} 
                className="p-3 hover:bg-slate-200 rounded-2xl transition-all"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="p-10 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                <div>
                  <h4 className="text-2xl font-black text-slate-900 leading-tight">
                    {selectedCustomerStats.customer.customerType === 'firemní' 
                      ? selectedCustomerStats.customer.companyName 
                      : `${selectedCustomerStats.customer.firstName} ${selectedCustomerStats.customer.lastName}`}
                  </h4>
                  <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mt-1">
                    {selectedCustomerStats.customer.customerType} zákazník
                  </p>
                </div>
                <div className="flex items-center gap-3">
                   <a 
                    href={`tel:${selectedCustomerStats.customer.phone}`}
                    className="p-4 bg-white text-blue-600 rounded-2xl shadow-sm hover:scale-105 transition-transform"
                   >
                     <Phone className="w-6 h-6" />
                   </a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 group">
                   <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center mb-4 text-slate-400 group-hover:text-amber-500 transition-colors shadow-sm">
                      <Car className="w-5 h-5" />
                   </div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Počet vozidel</p>
                   <p className="text-2xl font-black text-slate-900 tracking-tighter">{selectedCustomerStats.vehicleCount}</p>
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 group">
                   <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center mb-4 text-slate-400 group-hover:text-emerald-500 transition-colors shadow-sm">
                      <CheckCircle2 className="w-5 h-5" />
                   </div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Uzavřené zakázky</p>
                   <p className="text-2xl font-black text-slate-900 tracking-tighter">{selectedCustomerStats.closedOrders}</p>
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 group">
                   <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center mb-4 text-slate-400 group-hover:text-blue-500 transition-colors shadow-sm">
                      <Calendar className="w-5 h-5" />
                   </div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Četnost návštěv</p>
                   <p className="text-xl font-black text-slate-900 tracking-tighter">
                     {selectedCustomerStats.avgInterval > 0 ? `Každých ${selectedCustomerStats.avgInterval} dní` : '---'}
                   </p>
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 group">
                   <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center mb-4 shadow-sm ${selectedCustomerStats.avgDelay > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      <AlertTriangle className="w-5 h-5" />
                   </div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Platební morálka</p>
                   {selectedCustomerStats.avgDelay > 0 ? (
                     <p className="text-base font-black text-red-600 leading-tight">
                        PRŮMĚRNĚ {selectedCustomerStats.avgDelay} DNÍ PO SPLATNOSTI
                        <span className="block text-[8px] mt-0.5 text-red-400 font-bold uppercase tracking-widest">
                          ({selectedCustomerStats.delayedCount}x prodlení)
                        </span>
                     </p>
                   ) : (
                     <p className="text-2xl font-black text-emerald-600 italic tracking-widest">V POŘÁDKU</p>
                   )}
                </div>
              </div>
            </div>

            <div className="p-8 border-t bg-slate-50/50">
              <button 
                onClick={() => setSelectedCustId(null)}
                className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                Zavřít přehled
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsManager;