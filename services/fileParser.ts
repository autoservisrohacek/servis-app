
import * as XLSX from 'xlsx';
import { PartItem } from '../types';

export const cleanDescription = (text: string) => {
  if (!text) return '';
  
  // Očista pro specifické dodavatele (LKQ, SAG)
  let clean = text;

  // SAG styl: "Název - 1 234 567" -> "Název"
  if (clean.includes(' - ')) {
    clean = clean.split(' - ')[0];
  }

  // Odstranění výrobců z konců/začátků (typické pro LKQ)
  const manufacturers = ['BOSCH', 'MANN', 'VALEO', 'INA', 'FEBI', 'PURFLUX', 'SKF', 'TRW', 'ATE', 'BREMBO', 'LUK', 'SACHS', 'MONROE', 'MOOG', 'HENGST', 'MEYLE', 'FILTRON', 'KNECHT', 'MAHLE'];
  manufacturers.forEach(m => {
    const regexStart = new RegExp(`^${m}\\s+`, 'i');
    const regexEnd = new RegExp(`\\s+${m}$`, 'i');
    clean = clean.replace(regexStart, '').replace(regexEnd, '');
  });

  return clean
    // 1. Odstraň veškerý text v závorkách (včetně závorek samotných)
    .replace(/\([^)]*\)/g, '')
    // 2. Pokud text začíná řadou čísel následovanou mezerou (ID položky), odstraň tyto čísla
    .replace(/^\d+\s+/, '')
    // 3. Agresivní řezání pomlčky: Pokud text obsahuje spojovník -, vždy vezmi pouze to, co je před ním
    .split('-')[0]
    // 4. Výsledek vždy očisti o bílé znaky
    .trim();
};

export const parseNativeCsv = (text: string): Partial<PartItem>[] | null => {
  if (!text) return null;

  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return null;

  // DETEKCE LKQ (středník, obsahuje LKQ CZ)
  if (text.includes('LKQ CZ') || text.includes('Cislo;Kod;Nazev;Mnozstvi')) {
    const headerIndex = lines.findIndex(l => l.includes('Cislo;Kod;Nazev;Mnozstvi'));
    if (headerIndex !== -1) {
      const header = lines[headerIndex].split(';');
      const dataLines = lines.slice(headerIndex + 1);
      
      const colIndices = {
        name: header.indexOf('Nazev'),
        qty: header.indexOf('Mnozstvi'),
        cost: header.indexOf('Cena/ks'),
        price: header.indexOf('MOC bez DPH/ks')
      };

      const items: Partial<PartItem>[] = [];
      for (const line of dataLines) {
        const parts = line.split(';');
        if (parts.length < header.length) continue;
        
        // Zpracování řádku s daty
        const desc = cleanDescription(parts[colIndices.name]);
        if (!desc || desc.toUpperCase().includes('SAZBA DPH') || desc.toUpperCase().includes('CELKEM')) break;

        const qty = parseFloat(parts[colIndices.qty].replace(',', '.')) || 1;
        const rawCost = parseFloat(parts[colIndices.cost].replace(',', '.')) || 0;
        const rawPrice = parseFloat(parts[colIndices.price].replace(',', '.')) || 0;

        items.push({
          description: desc,
          quantity: qty,
          costPrice: rawCost * 1.21,
          unitPrice: rawPrice * 1.21
        });
      }
      return items.length > 0 ? items : null;
    }
  }

  // DETEKCE SAG (čárka, obsahuje ID položky,Číslo položky)
  if (text.includes('ID položky,Číslo položky') || text.includes('MOC za jednotku bez DPH')) {
    const header = lines[0].split(',');
    const colIndices = {
      name: header.indexOf('Číslo položky'),
      qty: header.indexOf('Množství'),
      cost: header.indexOf('Nákupní cena za jednotku bez DPH'),
      price: header.indexOf('MOC za jednotku bez DPH')
    };

    if (colIndices.name === -1 || colIndices.qty === -1) return null;

    const items: Partial<PartItem>[] = [];
    const dataLines = lines.slice(1);

    for (const line of dataLines) {
      // Robustní parsování CSV s uvozovkami (SAG je používá)
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        else if (line[i] === ',' && !inQuotes) {
          parts.push(current.trim());
          current = '';
        } else {
          current += line[i];
        }
      }
      parts.push(current.trim());

      const desc = cleanDescription(parts[colIndices.name]);
      if (!desc) continue;

      const qtyStr = parts[colIndices.qty].replace(',', '.').replace(/"/g, '');
      const qty = parseFloat(qtyStr) || 1;

      const costStr = parts[colIndices.cost].replace(',', '.').replace(/"/g, '').replace(/\s/g, '');
      const priceStr = parts[colIndices.price].replace(',', '.').replace(/"/g, '').replace(/\s/g, '');
      
      const rawCost = parseFloat(costStr) || 0;
      const rawPrice = parseFloat(priceStr) || 0;

      items.push({
        description: desc,
        quantity: qty,
        costPrice: rawCost * 1.21,
        unitPrice: rawPrice * 1.21
      });
    }
    return items.length > 0 ? items : null;
  }

  return null;
};

export const processExcelLocally = (data: any[], isVatPayer: boolean): Partial<PartItem>[] => {
  if (!data || data.length === 0) return [];
  
  const keys = {
    description: ['název', 'popis', 'polozka', 'item', 'description', 'zboží', 'označení'],
    code: ['kód', 'obj', 'číslo', 'code', 'id', 'objednací'],
    quantity: ['množství', 'ks', 'mnozstvi', 'qty', 'quantity', 'počet'],
    cost: ['nákup', 'cena bez', 'nákupní', 'cost', 'base', 'bez dph'],
    price: ['prodej', 'běžná', 'cena s', 'price', 'koncová', 'moc', 'moc bez', 'moc s']
  };

  const result: Partial<PartItem>[] = [];

  data.forEach(row => {
    let desc = '';
    let qty = 1;
    let cost = 0;
    let price = 0;
    let foundData = false;
    let currentDescPriority = -1;
    let currentPricePriority = -1;
    let currentCostPriority = -1;

    Object.entries(row).forEach(([k, v]) => {
      const lowerK = k.toLowerCase();
      const val = v as any;

      // Ignoruj sloupec Vozidlo (ID v názvu Vozidlo by jinak trefilo keys.code)
      if (lowerK.includes('vozidlo')) return;

      if (keys.description.some(key => lowerK.includes(key)) || keys.code.some(key => lowerK.includes(key))) {
         if (typeof val === 'string' && val.length > 2) {
           const cleanedVal = cleanDescription(val);
           if (cleanedVal) {
             const lowerVal = cleanedVal.toLowerCase();
             // Priority: Sloupce obsahující "filtr", "olej", "brzd" atd. mají přednost
             const hasKeyword = lowerVal.includes('filtr') || lowerVal.includes('olej') || lowerVal.includes('brzd') || lowerVal.includes('destič');
             const priority = hasKeyword ? 2 : 1;

             // Zákaz spojování: Pokud najdeme lepší název, přepíšeme ten starý (místo spojování)
             if (priority > currentDescPriority) {
               desc = cleanedVal;
               currentDescPriority = priority;
             }
             foundData = true;
           }
         }
      }
      if (keys.quantity.some(key => lowerK.includes(key))) {
        const n = parseFloat(val);
        if (!isNaN(n)) qty = n;
      }
      if (keys.cost.some(key => lowerK.includes(key))) {
        // Detekce, zda jde o jednotkovou nebo celkovou cenu
        const isTotal = lowerK.includes('celkem') || lowerK.includes('total') || lowerK.includes('součet');
        const isUnit = lowerK.includes('jednot') || lowerK.includes('unit') || lowerK.includes('/ks') || lowerK.includes('za ks');

        // Priorita nákupní ceny: jednotková má absolutní přednost, "celkem" má penalizaci
        let priority = lowerK.includes('nákup') ? 20 : 10;
        if (isUnit) priority += 50;
        if (isTotal) priority -= 100; // Agresivní penalizace celkových součtů

        if (priority > currentCostPriority) {
          const n = parseFloat(String(val).replace(/[^0-9.,]/g, '').replace(',', '.'));
          if (!isNaN(n)) {
            cost = n;
            currentCostPriority = priority;
          }
        }
      }
      if (keys.price.some(key => lowerK.includes(key))) {
        // Detekce, zda jde o jednotkovou nebo celkovou cenu
        const isTotal = lowerK.includes('celkem') || lowerK.includes('total') || lowerK.includes('součet');
        const isUnit = lowerK.includes('jednot') || lowerK.includes('unit') || lowerK.includes('moc/ks');

        // Priorita prodejní ceny: "moc" je absolutní priorita, jednotková má bonus, celková penalizaci
        let priority = lowerK.includes('moc') ? 30 : (lowerK.includes('prodej') ? 20 : 10);
        if (isUnit) priority += 50;
        if (isTotal) priority -= 100;
        
        // Ochrana před záměnou: Pokud název sloupce obsahuje "bez dph" a není tam "moc", 
        // pravděpodobně jde o nákupní cenu, kterou chceme ignorovat jako prodejní cenu.
        if (lowerK.includes('bez dph') && !lowerK.includes('moc') && !lowerK.includes('prodej')) {
          // Přeskočit, toto je pravděpodobně nákupní cena
        } else if (priority > currentPricePriority) {
          const n = parseFloat(String(val).replace(/[^0-9.,]/g, '').replace(',', '.'));
          if (!isNaN(n)) {
            price = n;
            currentPricePriority = priority;
          }
        }
      }
    });

    if (foundData && desc) {
      // Finální vyčištění složeného popisu (např. pokud se spojil kód a název)
      desc = cleanDescription(desc);

      if (price === 0 && cost > 0) price = cost * 1.3;
      if (cost === 0 && price > 0) cost = price / 1.3;

      // Logika importu: Vždy převádí nákupní/prodejní ceny na částky s DPH (+21 %)
      const finalPrice = price * 1.21;
      const finalCost = cost * 1.21;

      result.push({
        description: desc,
        quantity: qty,
        costPrice: finalCost,
        unitPrice: finalPrice
      });
    }
  });

  return result;
};
