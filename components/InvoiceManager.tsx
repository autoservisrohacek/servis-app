import React, { useState, useMemo, useRef, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import { 
  Search, Receipt, Printer, Trash2, CheckCircle, XCircle, AlertCircle, 
  FileText, X, Percent, CreditCard, Wallet, CalendarDays, TrendingUp, 
  AlertOctagon, MoreHorizontal, Archive, ArrowUpRight, Calculator,
  FileSearch, Loader2, FilePlus, Sparkles, Eye, Calendar, FileDown,
  CheckSquare, Square, Filter, Plus, Tag, Table, ShieldCheck, Upload
} from 'lucide-react';
import { Invoice, CompanyInfo, Customer, PartItem, ServiceRecord } from '../types';
import * as XLSX from 'xlsx';
import { analyzeCostsFromDocument } from '../services/geminiService';
import { QRCodeSVG } from 'qrcode.react';

const convertCzechAccountToIban = (accountStr: string): string => {
  if (!accountStr) return '';
  const clean = accountStr.replace(/\s+/g, '');
  if (clean.toUpperCase().startsWith('CZ')) {
    return clean.toUpperCase();
  }
  // Format should match prefix-number/bankCode or number/bankCode
  const match = clean.match(/^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/);
  if (!match) return '';

  const prefix = match[1] || '000000';
  const number = match[2];
  const bankCode = match[3];

  const paddedPrefix = prefix.padStart(6, '0');
  const paddedNumber = number.padStart(10, '0');

  const bban = bankCode + paddedPrefix + paddedNumber;
  const numericStr = bban + '123500'; // 'CZ00' converted

  let remainder = 0;
  for (let i = 0; i < numericStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numericStr[i], 10)) % 97;
  }

  const checksum = (98 - remainder).toString().padStart(2, '0');
  return 'CZ' + checksum + bban;
};

const formatDate = (dateStr: any) => {
  if (typeof dateStr !== 'string' || !dateStr) return '---';
  const datePart = dateStr.split('T')[0];
  if (!datePart) return '---';
  const parts = datePart.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

interface InvoiceManagerProps {
  invoices: Invoice[];
  customers: Customer[];
  services?: ServiceRecord[]; 
  companyInfo: CompanyInfo;
  discountLevels: number[];
  onDeleteInvoice: (uid: string) => void;
  onUpdateInvoiceStatus: (uid: string, status: 'uhrazeno' | 'neuhrazeno') => void;
  onUpdateInvoice: (invoice: Invoice) => void;
  onUpdateCustomer?: (customer: Customer) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

const InvoiceManager: React.FC<InvoiceManagerProps> = ({ invoices, customers, services = [], companyInfo, discountLevels, onDeleteInvoice, onUpdateInvoiceStatus, onUpdateInvoice, onUpdateCustomer, search, onSearchChange }) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null);
  const [isAiCostLoading, setIsAiCostLoading] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [selectedExportUids, setSelectedExportUids] = useState<Set<string>>(new Set());

  // GPC Matching states
  const [isGpcModalOpen, setIsGpcModalOpen] = useState(false);
  const [gpcMatches, setGpcMatches] = useState<{
    invoiceId: string;
    uid: string;
    foundAmount: number;
    expectedAmount: number;
    match: 'exact' | 'partial';
  }[]>([]);
  const [gpcUnmatchedCount, setGpcUnmatchedCount] = useState(0);
  const gpcFileInputRef = useRef<HTMLInputElement>(null);
  
  const today = new Date().toISOString().split('T')[0];
  const costFileInputRef = useRef<HTMLInputElement>(null);

  const handlePrint = () => window.print();

  const saveInvoiceToArchive = async () => {
    if (!selectedInvoice || !invoiceRef.current) return;
    setIsArchiving(true);
    try {
      const element = invoiceRef.current;
      
      // Sanitizace názvu souboru
      const safeInvoiceId = selectedInvoice.id.replace(/\//g, '-');
      const fileName = `Faktura - ${safeInvoiceId}.pdf`;

      // Dočasné nastavení šířky pro zachycení (A4 standard ~210mm)
      const originalWidth = element.style.width;
      element.style.width = '210mm';
      
      const opt = {
        margin: [10, 10, 10, 10],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          letterRendering: true
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      const worker = (html2pdf as any)().from(element).set(opt);
      const pdfBlob = await worker.output('blob');
      
      // Vrátíme původní šířku
      element.style.width = originalWidth;

      const arrayBuffer = await pdfBlob.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      const newAttachment = await (window as any).electronAPI.attachment.upload({
        type: 'invoice',
        identifier: '', 
        fileName: fileName,
        fileData: fileData
      });

      const customer = customers.find(c => c.id === selectedInvoice.customerId);
      if (customer && onUpdateCustomer) {
        const updatedCustomer = {
          ...customer,
          attachments: [...(customer.attachments || []), newAttachment],
          updatedAt: new Date().toISOString()
        };
        onUpdateCustomer(updatedCustomer);
      }
      alert('Faktura byla uložena do archivu a k zákazníkovi.');
    } catch (err) {
      console.error(err);
      alert('Chyba při ukládání PDF.');
    } finally {
      setIsArchiving(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.archived) return false;
      const customer = customers.find(c => c.id === inv.customerId);
      const searchLower = search.toLowerCase();
      return (
        (inv.id || "").toLowerCase().includes(searchLower) ||
        (customer?.lastName || '').toLowerCase().includes(searchLower) ||
        (customer?.companyName || '').toLowerCase().includes(searchLower) ||
        (inv.vehicleInfo || "").toLowerCase().includes(searchLower)
      );
    });
  }, [invoices, customers, search]);

  const invoicesForExport = useMemo(() => {
    return invoices.filter(inv => {
      const matchesDateFrom = !exportDateFrom || inv.issueDate >= exportDateFrom;
      const matchesDateTo = !exportDateTo || inv.issueDate <= exportDateTo;
      return matchesDateFrom && matchesDateTo;
    }).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  }, [invoices, exportDateFrom, exportDateTo]);

  const { unpaidInvoices, paidInvoices, totalUnpaid, totalPaid } = useMemo(() => {
    const unpaid = filteredInvoices.filter(inv => inv.status === 'neuhrazeno');
    const paid = filteredInvoices.filter(inv => inv.status === 'uhrazeno');
    
    return {
      unpaidInvoices: unpaid,
      paidInvoices: paid,
      totalUnpaid: Math.round(unpaid.reduce((sum, inv) => sum + (Number(inv.totalInclDph) || 0), 0)),
      totalPaid: Math.round(paid.reduce((sum, inv) => sum + (Number(inv.totalInclDph) || 0), 0))
    };
  }, [filteredInvoices]);

  const toggleExportSelection = (uid: string) => {
    const next = new Set(selectedExportUids);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    setSelectedExportUids(next);
  };

  const selectAllForExport = () => {
    if (selectedExportUids.size === invoicesForExport.length) {
      setSelectedExportUids(new Set());
    } else {
      setSelectedExportUids(new Set(invoicesForExport.map(i => i.uid)));
    }
  };

  const handleGpcFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        processGpcContent(content);
      }
    };
    reader.readAsText(file, 'windows-1250');
    if (gpcFileInputRef.current) {
        gpcFileInputRef.current.value = '';
    }
  };

  const processGpcContent = (content: string) => {
    const lines = content.split('\n');
    const matches: typeof gpcMatches = [];
    let unmatched = 0;

    for (const line of lines) {
      if (line.startsWith('075')) {
        const vsStr = line.substring(61, 71).trim();
        const amountStr = line.substring(12, 24).trim();
        
        let amount = 0;
        if (amountStr && !isNaN(Number(amountStr))) {
           amount = Number(amountStr) / 100;
        }

        const bankVsNum = parseInt(vsStr, 10);

        if (!isNaN(bankVsNum) && bankVsNum > 0) {
           const matchedInvoice = unpaidInvoices.find(inv => {
               const numericId = parseInt(inv.id.replace(/\D/g, ''), 10);
               return numericId === bankVsNum;
           });

           if (matchedInvoice) {
              const expectedAmount = Number(matchedInvoice.totalInclDph);
              matches.push({
                invoiceId: matchedInvoice.id,
                uid: matchedInvoice.uid,
                foundAmount: amount,
                expectedAmount: expectedAmount,
                match: amount === expectedAmount ? 'exact' : 'partial'
              });
           } else {
              unmatched++;
           }
        } else {
           unmatched++; // Not a matchable record
        }
      }
    }
    setGpcMatches(matches);
    setGpcUnmatchedCount(unmatched);
  };

  const confirmGpcMatches = () => {
    gpcMatches.forEach(match => {
       if (match.match === 'exact') {
         onUpdateInvoiceStatus(match.uid, 'uhrazeno');
       }
    });
    setIsGpcModalOpen(false);
    setGpcMatches([]);
  };

    const handlePohodaExport = () => {
        const selectedInvoices = invoices.filter(inv => selectedExportUids.has(inv.uid));
        if (selectedInvoices.length === 0) return;

        const removeDiacritics = (str: string) => {
            return String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        };

        const win1250Dict: any = { 
            'á': '\xE1', 'č': '\xE8', 'ď': '\xEF', 'é': '\xE9', 'ě': '\xEC', 'í': '\xED', 'ň': '\xF2', 'ó': '\xF3', 'ř': '\xF8', 'š': '\xB9', 'ť': '\xBB', 'ú': '\xFA', 'ů': '\xF9', 'ý': '\xFD', 'ž': '\xBE', 
            'Á': '\xC1', 'Č': '\xC8', 'Ď': '\xCF', 'É': '\xC9', 'Ě': '\xCC', 'Í': '\xCD', 'Ň': '\xD2', 'Ó': '\xD3', 'Ř': '\xD8', 'Š': '\xA9', 'Ť': '\xAB', 'Ú': '\xDA', 'Ů': '\xD9', 'Ý': '\xDD', 'Ž': '\xAE' 
        };

        const convertToWin1250Binary = (str: string) => {
            const buf = new Uint8Array(str.length);
            for (let i = 0; i < str.length; i++) {
                const char = str[i];
                const winCharCode = win1250Dict[char];
                if (winCharCode) {
                    buf[i] = winCharCode.charCodeAt(0);
                } else {
                    const code = str.charCodeAt(i);
                    buf[i] = code < 256 ? code : 63; // 63 is '?'
                }
            }
            return buf;
        };

        let filename = 'Pohoda_export';
        const monthsInSelection = Array.from(new Set(selectedInvoices.map(inv => inv.issueDate.substring(0, 7))));
        if (monthsInSelection.length === 1) {
            filename = `Pohoda_${monthsInSelection[0]}`;
        }

        const esc = (str: any) => {
            if (!str) return '';
            const cleanStr = removeDiacritics(String(str));
            return cleanStr
                .replace(/[\x00-\x1F\x7F-\x9F\r\n\t]/g, " ")
                .replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c] || c))
                .trim();
        };

        const formatRate = (num: number) => {
            return Number(Number(num).toFixed(2));
        };

        const cleanId = (str: any) => String(str || '').replace(/\s/g, '');
        const formatDateForXml = (dateStr: string) => {
            if (!dateStr) return '';
            return dateStr.split('T')[0];
        };
    
        const parseAddress = (address: string) => {
            if (!address) return { street: '', city: '', zip: '', number: '' };
            const parts = address.split(',').map(p => p.trim());
            let streetWithNumber = parts[0] || '';
            let cityPart = parts[1] || '';
            let zipStr = '';
            
            const zipMatch = address.match(/\b\d{3}\s?\d{2}\b/);
            if (zipMatch) {
                zipStr = zipMatch[0].replace(/\s/g, '');
                if (cityPart.includes(zipMatch[0])) {
                    cityPart = cityPart.replace(zipMatch[0], '').trim();
                }
            }
            
            const streetParts = streetWithNumber.split(/\s(?=\d)/);
            const street = streetParts[0] || '';
            const number = streetParts.slice(1).join(' ') || '';

            return { street, city: cityPart, zip: zipStr, number };
        };

        const myId = parseAddress(companyInfo.address);
        const myNameParts = (companyInfo.name || "").split(' ');
        const mySurname = myNameParts[0] || '';
        const myFirstName = myNameParts.slice(1).join(' ') || '';

        // Binary clean string construction
        let xml = '<?xml version="1.0" encoding="Windows-1250"?>';
        xml += `\n<dataPack version="2.0" id="PK-${Date.now()}" ico="${esc(cleanId(companyInfo.ico))}" application="Autoservis Manager" xmlns="http://www.stormware.cz/schema/version_2/data.xsd" xmlns:inv="http://www.stormware.cz/schema/version_2/invoice.xsd" xmlns:typ="http://www.stormware.cz/schema/version_2/type.xsd">`;

        selectedInvoices.forEach((inv, idx) => {
            const customer = customers.find(c => c.id === inv.customerId);
            const isVat = companyInfo.isVatPayer;
            const cAddress = parseAddress(customer?.address || '');
            const partnerName = esc(customer?.companyName || `${customer?.lastName || ''} ${customer?.firstName || ''}`.trim()) || 'Neznamy zakaznik';
            const cleanNumber = inv.id.replace(/\D/g, ''); 

            xml += `\n  <dataPackItem version="2.0" id="${inv.uid}">`;
            xml += `\n    <inv:invoice version="2.0">`;
            xml += `\n      <inv:invoiceHeader>`;
            xml += `\n        <inv:invoiceType>issuedInvoice</inv:invoiceType>`;
            xml += `\n        <inv:number>`;
            xml += `\n          <typ:numberRequested>${esc(inv.id)}</typ:numberRequested>`;
            xml += `\n        </inv:number>`;
            xml += `\n        <inv:symVar>${esc(cleanNumber)}</inv:symVar>`;
            xml += `\n        <inv:date>${formatDateForXml(inv.issueDate)}</inv:date>`;
            xml += `\n        <inv:dateTax>${formatDateForXml(inv.issueDate)}</inv:dateTax>`;
            xml += `\n        <inv:dateDue>${formatDateForXml(inv.dueDate)}</inv:dateDue>`;
            xml += `\n        <inv:accounting>`;
            xml += `\n          <typ:ids>3Vfv</typ:ids>`;
            xml += `\n        </inv:accounting>`;
            xml += `\n        <inv:classificationVAT>`;
            xml += `\n          <typ:ids>UD</typ:ids>`;
            xml += `\n        </inv:classificationVAT>`;
            xml += `\n        <inv:text>Oprava a servis vozidla: ${esc(inv.vehicleInfo)}</inv:text>`;
            xml += `\n        <inv:partnerIdentity>`;
            xml += `\n          <typ:address>`;
            xml += `\n            <typ:company>${partnerName}</typ:company>`;
            xml += `\n            <typ:city>${esc(cAddress.city)}</typ:city>`;
            xml += `\n            <typ:street>${esc(cAddress.street)} ${esc(cAddress.number)}</typ:street>`;
            xml += `\n            <typ:zip>${esc(cAddress.zip)}</typ:zip>`;
            if (customer?.ico) xml += `\n            <typ:ico>${esc(cleanId(customer.ico))}</typ:ico>`;
            if (customer?.dic) xml += `\n            <typ:dic>${esc(cleanId(customer.dic))}</typ:dic>`;
            xml += `\n          </typ:address>`;
            xml += `\n        </inv:partnerIdentity>`;
            xml += `\n        <inv:myIdentity>`;
            xml += `\n          <typ:address>`;
            xml += `\n            <typ:company>${esc(companyInfo.name)}</typ:company>`;
            xml += `\n            <typ:city>${esc(myId.city)}</typ:city>`;
            xml += `\n            <typ:street>${esc(myId.street)} ${esc(myId.number)}</typ:street>`;
            xml += `\n            <typ:zip>${esc(myId.zip)}</typ:zip>`;
            xml += `\n            <typ:ico>${esc(cleanId(companyInfo.ico))}</typ:ico>`;
            xml += `\n            <typ:dic>${esc(cleanId(companyInfo.dic))}</typ:dic>`;
            xml += `\n          </typ:address>`;
            xml += `\n        </inv:myIdentity>`;
            xml += `\n        <inv:paymentType>`;
            xml += `\n          <typ:ids>${inv.paymentType === 'Hotově' ? 'Hotově' : 'Příkazem'}</typ:ids>`;
            xml += `\n        </inv:paymentType>`;
            xml += `\n      </inv:invoiceHeader>`;

            xml += `\n      <inv:invoiceDetail>`;
            inv.items.forEach(item => {
                const qty = item.quantity || 1;
                const up = item.unitPrice;
                const itemPriceSum = qty * up;
                
                let itemBase = itemPriceSum;
                let itemVat = 0;
                let itemUnitPrice = up;

                if (isVat) {
                    itemBase = Number((itemPriceSum / 1.21).toFixed(2));
                    itemVat = Number((itemPriceSum - itemBase).toFixed(2));
                    itemUnitPrice = Number((up / 1.21).toFixed(2));
                }

                xml += `\n        <inv:invoiceItem>`;
                xml += `\n          <inv:text>${esc(item.description)}</inv:text>`;
                xml += `\n          <inv:quantity>${formatRate(qty)}</inv:quantity>`;
                xml += `\n          <inv:unit>${esc(item.unit) || 'ks'}</inv:unit>`;
                xml += `\n          <inv:rateVAT>${isVat ? 'high' : 'none'}</inv:rateVAT>`;
                xml += `\n          <inv:homeCurrency>`;
                xml += `\n            <typ:unitPrice>${formatRate(itemUnitPrice)}</typ:unitPrice>`;
                xml += `\n            <typ:price>${formatRate(itemBase)}</typ:price>`;
                xml += `\n            <typ:priceVAT>${formatRate(itemVat)}</typ:priceVAT>`;
                xml += `\n            <typ:priceSum>${formatRate(itemPriceSum)}</typ:priceSum>`;
                xml += `\n          </inv:homeCurrency>`;
                xml += `\n        </inv:invoiceItem>`;
            });
            xml += `\n      </inv:invoiceDetail>`;

            xml += `\n      <inv:invoiceSummary>`;
            xml += `\n        <inv:homeCurrency>`;
            const totalSum = inv.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
            const totalBase = isVat ? Number((totalSum / 1.21).toFixed(2)) : totalSum;
            const totalVat = isVat ? Number((totalSum - totalBase).toFixed(2)) : 0;

            if (isVat) {
                xml += `\n          <typ:priceHigh>${formatRate(totalBase)}</typ:priceHigh>`;
                xml += `\n          <typ:priceHighVAT>${formatRate(totalVat)}</typ:priceHighVAT>`;
                xml += `\n          <typ:priceHighSum>${formatRate(totalSum)}</typ:priceHighSum>`;
            } else {
                xml += `\n          <typ:priceNone>${formatRate(totalSum)}</typ:priceNone>`;
            }
            xml += `\n        </inv:homeCurrency>`;
            xml += `\n      </inv:invoiceSummary>`;
            xml += `\n    </inv:invoice>`;
            xml += `\n  </dataPackItem>`;
        });

        xml += `\n</dataPack>`;

        const finalXml = xml.trim();
        const binaryData = convertToWin1250Binary(finalXml);
        const blob = new Blob([binaryData], { type: 'text/xml;charset=windows-1250' });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.xml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsExportModalOpen(false);
    };

  const handleUpdateActiveInvoice = (field: keyof Invoice, value: any) => {
    if (!selectedInvoice) return;
    
    let updated = { ...selectedInvoice, [field]: value };
    
    if (field === 'paymentType' || field === 'issueDate') {
      if (updated.paymentType === 'Hotově') {
        updated.dueDate = updated.issueDate;
      } else {
        const currentDiff = Math.round((new Date(selectedInvoice.dueDate).getTime() - new Date(selectedInvoice.issueDate).getTime()) / (1000 * 3600 * 24));
        const diff = isNaN(currentDiff) || currentDiff < 0 ? 14 : currentDiff;
        const date = new Date(updated.issueDate);
        date.setDate(date.getDate() + diff);
        updated.dueDate = date.toISOString().split('T')[0];
      }
    }

    if (field === 'discount' || field === 'items' || field === 'paymentType') {
      const currentItems = updated.items || [];
      const baseTotal = currentItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
      const discountedBase = baseTotal * (1 - ((Number(updated.discount) || 0) / 100));
      updated.totalExclDph = discountedBase;
      const totalRaw = companyInfo.isVatPayer ? discountedBase * 1.21 : discountedBase;
      updated.totalInclDph = updated.paymentType === 'Hotově' ? Math.round(totalRaw) : totalRaw;
    }

    setSelectedInvoice(updated);
    onUpdateInvoice(updated);
  };

  const handleUpdateDueDays = (days: number) => {
    if (!selectedInvoice) return;
    const date = new Date(selectedInvoice.issueDate);
    date.setDate(date.getDate() + days);
    const updated = { ...selectedInvoice, dueDate: date.toISOString().split('T')[0] };
    setSelectedInvoice(updated);
    onUpdateInvoice(updated);
  };

  const handleArchiveInvoice = (inv: Invoice) => {
    const updated = { ...inv, archived: true };
    onUpdateInvoice(updated);
  };

  const handleCostFileAnalyze = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedInvoice) return;

    setIsAiCostLoading(true);
    try {
      let analysisResult: { code: string; description: string; costWithDph: number }[] = [];
      const isPdf = file.type === 'application/pdf';

      if (isPdf) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const base64Data = await base64Promise;
        const splitted = base64Data.split(',');
        analysisResult = await analyzeCostsFromDocument(splitted.length > 1 ? splitted[1] : splitted[0], true);
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        analysisResult = await analyzeCostsFromDocument(jsonData, false);
      }

      let totalMatchedCost = 0;
      let matchedCount = 0;

      selectedInvoice.items.forEach(invItem => {
        const invDesc = (invItem.description || "").toLowerCase();
        const invId = (invItem.id || "").toLowerCase();

        const match = analysisResult.find(res => {
          const resCode = (res.code || "").toLowerCase();
          const resDescription = (res.description || "").toLowerCase();

          return (
            (resCode && invId === resCode) || 
            (resCode && invDesc.includes(resCode)) || 
            (resDescription && invDesc.includes(resDescription)) || 
            (resDescription && resDescription.includes(invDesc))    
          );
        });

        if (match) {
          totalMatchedCost += (match.costWithDph || 0);
          matchedCount++;
        }
      });

      if (totalMatchedCost > 0) {
        handleUpdateActiveInvoice('costs', totalMatchedCost);
        alert(`Analýza dokončena. Spárováno ${matchedCount} z ${selectedInvoice.items.length} položek. Celkové náklady: ${Math.round(totalMatchedCost).toLocaleString()} Kč.`);
      } else {
        alert("Nebyly nalezeny žádné odpovídající položky.");
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Analýza souboru selhala.");
    } finally {
      setIsAiCostLoading(false);
      if (costFileInputRef.current) costFileInputRef.current.value = '';
    }
  };

  const selectedOrder = useMemo(() => {
    if (!selectedInvoice) return null;
    return services.find(s => s.id === selectedInvoice.orderId) || null;
  }, [selectedInvoice, services]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="print:hidden space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Fakturační systém</h2>
            <p className="text-slate-500 font-medium">Správa vydaných faktur a sledování plateb.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsGpcModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 group"
            >
              <Upload className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
              SPÁROVAT PLATBY
            </button>
            <button 
              onClick={() => {
                setSelectedExportUids(new Set());
                setIsExportModalOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-slate-700 font-black text-xs hover:bg-slate-50 hover:border-blue-200 transition-all shadow-sm group"
            >
              <FileDown className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
              POHODA EXPORT (XML)
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-8 px-8">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">K úhradě celkem</span>
            <span className="text-xl font-black text-blue-600">{totalUnpaid.toLocaleString()} Kč</span>
          </div>
          <div className="w-px h-10 bg-slate-100"></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Uhrazeno celkem</span>
            <span className="text-xl font-black text-emerald-600">{totalPaid.toLocaleString()} Kč</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 print:hidden">
        <Search className="w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Hledat fakturu (ID, Zákazník, Vozidlo)..." 
          className="flex-1 text-sm font-medium outline-none bg-transparent"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {search && (
          <button onClick={() => onSearchChange('')} className="text-blue-600 font-bold text-xs px-3 py-1 hover:bg-blue-50 rounded-lg transition-all">Zrušit filtr</button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-slate-200 print:hidden pb-12">
        <div className="lg:pr-8 space-y-6">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-blue-500" />
              K úhradě ({unpaidInvoices.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {unpaidInvoices.map(inv => (
              <InvoiceCard 
                key={inv.uid} 
                inv={inv} 
                customers={customers} 
                today={today}
                onSelect={setSelectedInvoice}
                onDelete={setDeletingInvoice}
                onUpdateStatus={onUpdateInvoiceStatus}
                onArchive={handleArchiveInvoice}
                openMenuId={openMenuId}
                onOpenMenu={setOpenMenuId}
              />
            ))}
          </div>
        </div>

        <div className="lg:pl-8 space-y-6 mt-12 lg:mt-0">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Uhrazeno ({paidInvoices.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {paidInvoices.map(inv => (
              <InvoiceCard 
                key={inv.uid} 
                inv={inv} 
                customers={customers} 
                today={today}
                onSelect={setSelectedInvoice}
                onDelete={setDeletingInvoice}
                onUpdateStatus={onUpdateInvoiceStatus}
                onArchive={handleArchiveInvoice}
                openMenuId={openMenuId}
                onOpenMenu={setOpenMenuId}
              />
            ))}
          </div>
        </div>
      </div>

      {isExportModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setIsExportModalOpen(false)}></div>
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                  <FileDown className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Export do Pohody</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Vyberte doklady k přenesení do účetnictví</p>
                </div>
              </div>
              <button onClick={() => setIsExportModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 border-b bg-slate-50 flex flex-col sm:flex-row items-center gap-4 shrink-0">
               <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase">Od:</span>
                    <input 
                      type="date" 
                      className="bg-transparent border-none outline-none font-bold text-xs" 
                      value={exportDateFrom} 
                      onChange={e => setExportDateFrom(e.target.value)} 
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase">Do:</span>
                    <input 
                      type="date" 
                      className="bg-transparent border-none outline-none font-bold text-xs" 
                      value={exportDateTo} 
                      onChange={e => setExportDateTo(e.target.value)} 
                    />
                  </div>
               </div>
               <button 
                onClick={selectAllForExport}
                className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-100 transition-all"
               >
                 {selectedExportUids.size === invoicesForExport.length && invoicesForExport.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                 VYBRAT VŠE
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-2 bg-slate-50/30">
               {invoicesForExport.map(inv => {
                 const customer = customers.find(c => c.id === inv.customerId);
                 const isSelected = selectedExportUids.has(inv.uid);
                 return (
                   <div 
                    key={inv.uid} 
                    onClick={() => toggleExportSelection(inv.uid)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                   >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                         {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2">
                           <span className="font-black text-slate-900 text-sm">{inv.id}</span>
                           <span className="text-[10px] font-bold text-slate-400">{formatDate(inv.issueDate)}</span>
                         </div>
                         <p className="text-xs font-bold text-slate-500 truncate">{customer?.companyName || `${customer?.lastName} ${customer?.firstName}`}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-sm font-black text-slate-900">
                           {inv.paymentType === 'Převodem' && inv.totalInclDph % 1 !== 0 
                             ? Number(inv.totalInclDph).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                             : Math.round(Number(inv.totalInclDph) || 0).toLocaleString('cs-CZ')} Kč
                         </p>
                         <p className="text-[9px] font-bold text-slate-400 uppercase">{inv.status}</p>
                      </div>
                   </div>
                 );
               })}
            </div>

            <div className="p-8 border-t bg-white flex justify-between items-center shrink-0">
               <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vybráno k exportu</span>
                  <span className="text-xl font-black text-blue-600">{selectedExportUids.size} dokladů</span>
               </div>
               <div className="flex gap-3">
                  <button onClick={() => setIsExportModalOpen(false)} className="px-8 py-4 bg-slate-100 rounded-2xl font-black text-xs uppercase">Zrušit</button>
                  <button onClick={handlePohodaExport} disabled={selectedExportUids.size === 0} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl transition-all flex items-center gap-2">
                    <FileDown className="w-4 h-4" /> EXPORTOVAT (XML)
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* GPC Match Modal */}
      {isGpcModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => {
             setIsGpcModalOpen(false);
             setGpcMatches([]);
             setGpcUnmatchedCount(0);
          }}></div>
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Spárování plateb (GPC)</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Nahrání bankovního výpisu pro párování s fakturami</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsGpcModalOpen(false);
                  setGpcMatches([]);
                  setGpcUnmatchedCount(0);
                }} 
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto">
              {gpcMatches.length === 0 && gpcUnmatchedCount === 0 ? (
                <div className="border-4 border-dashed border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => gpcFileInputRef.current?.click()}
                >
                  <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6">
                    <FileSearch className="w-10 h-10" />
                  </div>
                  <h4 className="text-lg font-black text-slate-800 mb-2">Vybrat GPC (.gpc, .abo) soubor</h4>
                  <p className="text-sm font-bold text-slate-400">Kliknutím sem nahrajete bankovní výpis pro párování plateb.</p>
                  <input type="file" accept=".gpc,.abo" ref={gpcFileInputRef} onChange={handleGpcFileUpload} className="hidden" />
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-4 bg-slate-100 p-3 rounded-xl border border-slate-200">
                    Nalezeno {gpcMatches.length} plateb k fakturám:
                  </h4>
                  {gpcMatches.map((match, i) => (
                    <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between ${match.match === 'exact' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                      <div>
                         <div className="flex items-center gap-2 mb-1">
                            {match.match === 'exact' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertOctagon className="w-4 h-4 text-red-600" />}
                            <span className="font-black text-slate-900">Faktura {match.invoiceId}</span>
                         </div>
                         <p className="text-[10px] font-black uppercase tracking-widest">
                           {match.match === 'exact' ? (
                             <span className="text-emerald-600">SOUHLASÍ</span>
                           ) : (
                             <span className="text-red-600">NESOUHLASÍ ČÁSTKA (v bance {match.foundAmount} Kč)</span>
                           )}
                         </p>
                      </div>
                      <div className="text-right">
                         <span className="text-lg font-black">{Math.round(match.expectedAmount).toLocaleString()} Kč</span>
                      </div>
                    </div>
                  ))}
                  {gpcUnmatchedCount > 0 && (
                    <div className="p-4 rounded-2xl border bg-slate-50 border-slate-200 flex items-center gap-3">
                       <AlertCircle className="w-5 h-5 text-slate-400" />
                       <span className="font-bold text-xs text-slate-600">{gpcUnmatchedCount} plateb se nepodařilo spárovat (nenalezen variabilní symbol u neuhrazených faktur).</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {(gpcMatches.length > 0 || gpcUnmatchedCount > 0) && (
              <div className="p-8 border-t bg-slate-50 flex justify-end gap-3 shrink-0">
                <button 
                   onClick={() => {
                     setGpcMatches([]);
                     setGpcUnmatchedCount(0);
                   }} 
                   className="px-6 py-4 bg-white border border-slate-200 rounded-2xl font-black text-xs uppercase"
                >
                   Nahrát jiný
                </button>
                {gpcMatches.length > 0 && (
                  <button 
                    onClick={confirmGpcMatches} 
                    className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl transition-all hover:bg-blue-700"
                  >
                    POTVRDIT ÚHRADY
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:p-0 print:bg-white print:absolute print:inset-0 print:block">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md no-print print:hidden font-sans" onClick={() => setSelectedInvoice(null)}></div>
          <div className="bg-white w-full max-w-6xl h-[95vh] rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 print:h-auto print:static print:shadow-none print:bg-white print:rounded-none print:max-w-none print:w-full print:overflow-visible print:block">
            <div className="p-6 border-b flex flex-col gap-4 bg-slate-50 no-print print:hidden">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <h3 className="text-xl font-black uppercase">Faktura {selectedInvoice.id}</h3>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => onUpdateInvoiceStatus(selectedInvoice.uid, selectedInvoice.status === 'uhrazeno' ? 'neuhrazeno' : 'uhrazeno')} className={`px-6 py-3 rounded-xl font-black text-xs flex items-center gap-2 ${selectedInvoice.status === 'uhrazeno' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {selectedInvoice.status === 'uhrazeno' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    {selectedInvoice.status === 'uhrazeno' ? 'NEUHRAZENO' : 'UHRAZENO'}
                  </button>
                  <button 
                    onClick={saveInvoiceToArchive} 
                    disabled={isArchiving}
                    className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    {isArchiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} 
                    ARCHIVOVAT PDF
                  </button>
                  <button onClick={handlePrint} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg"><Printer className="w-4 h-4" /> TISK</button>
                  <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-6 h-6 text-slate-400" /></button>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-6 p-4 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Úhrada:</span>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => handleUpdateActiveInvoice('paymentType', 'Hotově')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${selectedInvoice.paymentType === 'Hotově' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Hotově</button>
                    <button onClick={() => handleUpdateActiveInvoice('paymentType', 'Převodem')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${selectedInvoice.paymentType === 'Převodem' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Převodem</button>
                  </div>
                </div>

                {selectedInvoice.paymentType === 'Převodem' && (
                  <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Splatnost:</span>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      {[7, 14, 31].map(days => (
                        <button 
                          key={days}
                          onClick={() => handleUpdateDueDays(days)}
                          className="px-3 py-2 rounded-lg text-[10px] font-black text-slate-500 hover:text-blue-600 hover:bg-white hover:shadow-sm transition-all"
                        >
                          {days} dní
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sleva:</span>
                  <select value={selectedInvoice.discount || 0} onChange={(e) => handleUpdateActiveInvoice('discount', parseInt(e.target.value))} className="bg-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                    {discountLevels.map(level => <option key={level} value={level}>{level}%</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nákupní náklady:</span>
                  <div className="flex gap-2 items-center">
                    <div className="relative">
                      <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                      <input 
                        type="number" 
                        placeholder="Nákupní ceny..."
                        className="pl-8 pr-4 py-2 bg-slate-100 rounded-xl text-xs font-bold w-32 outline-none focus:ring-1 focus:ring-blue-500" 
                        value={selectedInvoice.costs || ''} 
                        onChange={e => handleUpdateActiveInvoice('costs', parseFloat(e.target.value) || 0)} 
                      />
                    </div>
                    <button 
                      onClick={() => costFileInputRef.current?.click()} 
                      disabled={isAiCostLoading}
                      className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all flex items-center gap-2 group"
                    >
                      {isAiCostLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                      <span className="text-[10px] font-black uppercase">AI IMPORT</span>
                    </button>
                    <input type="file" ref={costFileInputRef} className="hidden" accept=".pdf,.xlsx,.xls" onChange={handleCostFileAnalyze} />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tachometr (km):</span>
                  <input 
                    type="number" 
                    placeholder="km..."
                    className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold w-28 outline-none focus:ring-1 focus:ring-blue-500 font-sans" 
                    value={selectedInvoice.mileageAtEntry || ''} 
                    onChange={e => handleUpdateActiveInvoice('mileageAtEntry', parseInt(e.target.value) || 0)} 
                  />
                </div>

                <div className="flex items-center gap-3 ml-auto px-4 py-2 bg-slate-100 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ochrana statistik:</span>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="hidden"
                      checked={!!selectedInvoice.excludeFromStats}
                      onChange={e => handleUpdateActiveInvoice('excludeFromStats', e.target.checked)}
                    />
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${selectedInvoice.excludeFromStats ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-300 border border-slate-200'}`}>
                      {selectedInvoice.excludeFromStats ? <ShieldCheck className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5 opacity-20" />}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-tight ${selectedInvoice.excludeFromStats ? 'text-blue-600' : 'text-slate-400'}`}>
                      {selectedInvoice.excludeFromStats ? 'Ignorováno' : 'Ignorovat prodlení'}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-12 bg-slate-100 flex flex-col items-center gap-12 custom-scrollbar print:p-0 print:bg-white print:overflow-visible print:block print:w-full">
              <div className="w-full max-w-[210mm] bg-white rounded-3xl shadow-xl p-8 border border-slate-200 no-print print:hidden">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-600" /> Editor Položek Faktury
                  </h4>
                  <button 
                    onClick={() => {
                      const newItems = [...(selectedInvoice.items || []), { id: `it-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, description: '', quantity: 1, unit: 'ks', unitPrice: 0 }];
                      handleUpdateActiveInvoice('items', newItems);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-100 transition-all"
                  >
                    <Plus className="w-3 h-3" /> Přidat položku
                  </button>
                </div>
                <div className="space-y-3">
                  {selectedInvoice.items.map((item, idx) => (
                    <div key={item.id} className="grid grid-cols-12 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 group">
                      <div className="col-span-6">
                        <input 
                          placeholder="Popis položky..."
                          className="w-full bg-white border-none rounded-xl px-4 py-2 text-xs font-bold outline-none"
                          value={item.description}
                          onChange={e => {
                            const newItems = [...selectedInvoice.items];
                            newItems[idx].description = e.target.value;
                            handleUpdateActiveInvoice('items', newItems);
                          }}
                        />
                      </div>
                      <div className="col-span-2">
                        <input 
                          type="number"
                          placeholder="Množství"
                          className="w-full bg-white border-none rounded-xl px-4 py-2 text-xs font-bold outline-none text-center"
                          value={item.quantity}
                          onChange={e => {
                            const newItems = [...selectedInvoice.items];
                            newItems[idx].quantity = parseFloat(e.target.value) || 0;
                            handleUpdateActiveInvoice('items', newItems);
                          }}
                        />
                      </div>
                      <div className="col-span-3">
                        <div className="relative">
                          <input 
                            type="number"
                            placeholder="Cena za jedn."
                            className="w-full bg-white border-none rounded-xl px-4 py-2 text-xs font-bold outline-none text-right pr-8"
                            value={item.unitPrice}
                            onChange={e => {
                              const newItems = [...selectedInvoice.items];
                              newItems[idx].unitPrice = parseFloat(e.target.value) || 0;
                              handleUpdateActiveInvoice('items', newItems);
                            }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">Kč</span>
                        </div>
                      </div>
                      <div className="col-span-1 flex items-center justify-end">
                        <button 
                          onClick={() => {
                            const newItems = selectedInvoice.items.filter((_, i) => i !== idx);
                            handleUpdateActiveInvoice('items', newItems);
                          }}
                          className="p-2 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="shrink-0 print-container" ref={invoiceRef}>
                <InvoicePrintTemplate invoice={selectedInvoice} company={companyInfo} customers={customers} order={selectedOrder} />
              </div>
            </div>
          </div>
        </div>
      )}

      {deletingInvoice && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setDeletingInvoice(null)}></div>
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 text-center relative z-10 shadow-2xl">
             <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
             <h3 className="text-xl font-black mb-2">Smazat fakturu?</h3>
             <p className="text-slate-500 mb-8">Faktura {deletingInvoice.id} bude odstraněna.</p>
             <div className="flex gap-4">
                <button onClick={() => setDeletingInvoice(null)} className="flex-1 py-4 bg-slate-100 rounded-xl font-bold">ZRUŠIT</button>
                <button onClick={() => { onDeleteInvoice(deletingInvoice.uid); setDeletingInvoice(null); }} className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold">SMAZAT</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InvoiceCard: React.FC<{
  inv: Invoice;
  customers: Customer[];
  today: string;
  onSelect: (inv: Invoice) => void;
  onDelete: (inv: Invoice) => void;
  onUpdateStatus: (uid: string, status: 'uhrazeno' | 'neuhrazeno') => void;
  onArchive: (inv: Invoice) => void;
  openMenuId: string | null;
  onOpenMenu: (uid: string | null) => void;
}> = ({ inv, customers, today, onSelect, onDelete, onUpdateStatus, onArchive, openMenuId, onOpenMenu }) => {
  const customer = customers.find(c => c.id === inv.customerId);
  const isOverdue = inv.status === 'neuhrazeno' && inv.dueDate < today;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onOpenMenu(null);
      }
    };
    if (openMenuId === inv.uid) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId, inv.uid, onOpenMenu]);

  return (
    <div className={`bg-white rounded-[2rem] border p-6 transition-all hover:shadow-xl group relative overflow-visible ${isOverdue ? 'border-red-200 bg-red-50/10' : 'border-slate-100'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${inv.status === 'uhrazeno' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-black text-slate-900">{inv.id}</h4>
              {inv.excludeFromStats && (
                <div className="flex items-center justify-center w-5 h-5 bg-blue-50 text-blue-600 rounded-md shadow-sm" title="Ignorováno ze statistik prodlení">
                  <ShieldCheck className="w-3 h-3" />
                </div>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(inv.issueDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onSelect(inv)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
            <Eye className="w-5 h-5" />
          </button>
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); onOpenMenu(openMenuId === inv.uid ? null : inv.uid); }}
              className={`p-2 rounded-xl transition-all ${openMenuId === inv.uid ? 'bg-slate-100 text-slate-900 shadow-inner' : 'text-slate-400 hover:text-slate-900'}`}
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {openMenuId === inv.uid && (
              <div 
                ref={menuRef}
                className="absolute top-10 right-0 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[60] animate-in fade-in zoom-in-95 duration-200"
              >
                <button 
                  onClick={(e) => { e.stopPropagation(); onUpdateStatus(inv.uid, inv.status === 'uhrazeno' ? 'neuhrazeno' : 'uhrazeno'); onOpenMenu(null); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors text-sm font-bold"
                >
                  {inv.status === 'uhrazeno' ? 'Neuhrazeno' : 'Uhrazeno'}
                </button>
                {inv.status === 'uhrazeno' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onArchive(inv); onOpenMenu(null); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-blue-50 text-blue-600 transition-colors text-sm font-bold"
                  >
                    <Archive className="w-4 h-4" /> Archivovat
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onDelete(inv); onOpenMenu(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-600 transition-colors text-sm font-bold">Smazat</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <p className="text-sm font-bold text-slate-700 truncate">
          {customer?.companyName || `${customer?.firstName} ${customer?.lastName}`}
        </p>
        <p className="text-[10px] font-bold text-blue-600 uppercase truncate">{inv.vehicleInfo}</p>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Splatnost</span>
          <span className={`text-[11px] font-black ${isOverdue ? 'text-red-600' : 'text-slate-600'}`}>{formatDate(inv.dueDate)}</span>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-slate-900">
            {inv.paymentType === 'Převodem' && inv.totalInclDph % 1 !== 0 
              ? Number(inv.totalInclDph).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : Math.round(Number(inv.totalInclDph) || 0).toLocaleString('cs-CZ')} Kč
          </p>
        </div>
      </div>
    </div>
  );
};

export const InvoicePrintTemplate: React.FC<{
  invoice: Invoice;
  company: CompanyInfo;
  customers: Customer[];
  order?: ServiceRecord | null;
}> = ({ invoice, company, customers, order }) => {
  const [activeTab, setActiveTab] = useState(1);
  const customer = customers.find(c => c.id === invoice.customerId);
  const totalExclDph = (invoice.items || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const discountPercent = Number(invoice.discount) || 0;
  const discountAmount = totalExclDph * (discountPercent / 100);
  const finalExclDph = totalExclDph - discountAmount;
  const isPayer = company.isVatPayer;
  const vatAmount = isPayer ? finalExclDph * 0.21 : 0;
  const totalRaw = finalExclDph + vatAmount;
  const finalInclDph = invoice.paymentType === 'Hotově' ? Math.round(totalRaw) : totalRaw;

  const iban = convertCzechAccountToIban(company.bankAccount || '');
  const vs = invoice.id.replace(/\//g, '');
  const amt = finalInclDph.toFixed(2);
  const msg = `Faktura ${invoice.id} - Autoservis Rohacek`.replace(/\*/g, ' ').substring(0, 140);
  const qrCodeString = iban ? `SPD*1.0*ACC:${iban}*AM:${amt}*CC:CZK*VS:${vs}*MSG:${msg}` : '';

  const hasAttachment = invoice.items.length > 16;
  
  // Auto-switch back if attachment removed
  useEffect(() => {
    if (!hasAttachment && activeTab === 2) {
      setActiveTab(1);
    }
  }, [hasAttachment, activeTab]);

  return (
    <>
      {/* Tab Navigation - Browser style, visible only in editor (no-print) */}
      {hasAttachment && (
        <div className="flex no-print print:hidden sticky-tabs gap-[2px] items-end h-[50px]">
          <button 
            type="button"
            onClick={() => setActiveTab(1)}
            className={`flex items-center gap-2 px-6 py-2 text-[11px] font-black uppercase tracking-widest transition-all rounded-t-xl border-x border-t relative overflow-hidden group ${
              activeTab === 1 
                ? 'bg-white border-black/20 text-blue-700 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]' 
                : 'bg-white/40 border-transparent text-black/40 hover:bg-white/60 hover:text-black/60'
            }`}
          >
            <div className={`absolute top-0 left-0 w-full h-[3px] transition-colors ${activeTab === 1 ? 'bg-blue-600' : 'bg-transparent'}`}></div>
            <FileText className={`w-3.5 h-3.5 ${activeTab === 1 ? 'text-blue-600' : 'opacity-40'}`} />
            <span>HLAVNÍ LIST</span>
            <span className="ml-1 text-[9px] opacity-30 font-bold bg-black/5 px-1.5 rounded">P1</span>
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab(2)}
            className={`flex items-center gap-2 px-6 py-2 text-[11px] font-black uppercase tracking-widest transition-all rounded-t-xl border-x border-t relative overflow-hidden group ${
              activeTab === 2 
                ? 'bg-white border-black/20 text-blue-700 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]' 
                : 'bg-white/40 border-transparent text-black/40 hover:bg-white/60 hover:text-black/60'
            }`}
          >
            <div className={`absolute top-0 left-0 w-full h-[3px] transition-colors ${activeTab === 2 ? 'bg-blue-600' : 'bg-transparent'}`}></div>
            <Table className={`w-3.5 h-3.5 ${activeTab === 2 ? 'text-blue-600' : 'opacity-40'}`} />
            <span>PŘÍLOHA FA</span>
            <span className="ml-1 text-[9px] opacity-30 font-bold bg-black/5 px-1.5 rounded">P2</span>
          </button>
          <div className="flex-1"></div>
          <div className="pb-2 text-[8px] font-black uppercase opacity-20 italic">Navigátor faktury</div>
        </div>
      )}

      <div className={`bg-white text-black font-sans print-block relative flex flex-col ${activeTab !== 1 ? 'editor-tab-hidden' : ''}`} style={{ width: '210mm', minHeight: '290mm', margin: '0 auto', border: '2px solid #000' }}>
      <div className="flex-1">
        <div className="grid grid-cols-2 border-b-2 border-black">
          <div className="p-4 border-r-2 border-black">
            <p className="text-[10px] font-bold uppercase mb-1 text-slate-500">DODAVATEL:</p>
            <div className="text-[13px] leading-snug">
              <p className="font-black text-[16px] mb-1">{company.name}</p>
              <p>{company.address}</p>
              <p className="mt-1 font-bold">IČ: {company.ico} {isPayer && <span className="ml-2">DIČ: {company.dic}</span>}</p>
              <p className="font-bold mt-1 pb-1">č.ú.: {company.bankAccount || '---'}</p>
              {!isPayer && <p className="text-[10px] font-bold mt-2 italic opacity-60">Firma není plátcem DPH.</p>}
            </div>
          </div>
          <div className="p-4 flex flex-col justify-start">
            <h1 className="text-[20px] font-black uppercase mb-2">{isPayer ? 'DAŇOVÝ DOKLAD č.' : 'FAKTURA č.'} {invoice.id}</h1>
            {invoice.paymentType === 'Převodem' && <p className="text-[11px] font-black uppercase opacity-50">Variabilní symbol: {invoice.id.replace(/\//g, '')}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 border-b-2 border-black">
          <div className="p-4 border-r-2 border-black bg-gray-50/10">
            <p className="text-[10px] font-bold uppercase mb-1 text-slate-500">ODBĚRATEL:</p>
            <div className="text-[13px] leading-snug ml-4">
              <p className="font-black text-[16px] uppercase mb-1">{customer?.companyName || `${customer?.firstName} ${customer?.lastName}`}</p>
              <p>{customer?.companyAddress || customer?.address}</p>
              <p className="mt-1 font-bold">IČ: {customer?.ico} {customer?.dic && <span className="ml-2">DIČ: {customer?.dic}</span>}</p>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase mb-1 text-slate-500">VOZIDLO:</p>
            <p className="font-black text-[16px] uppercase text-blue-600 ml-4 leading-tight">{invoice.vehicleInfo}</p>
            {invoice.mileageAtEntry !== undefined && invoice.mileageAtEntry > 0 && (
              <p className="text-[12px] font-bold ml-4 mt-1 text-slate-700 font-sans uppercase tracking-tight">Tachometr: {invoice.mileageAtEntry.toLocaleString('cs-CZ')} km</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-5 text-[10px] border-b-2 border-black font-bold uppercase bg-gray-50/50">
          <div className="p-2 border-r-2 border-black text-center">Zdanitel. plnění<br /><span className="text-[12px]">{formatDate(invoice.issueDate)}</span></div>
          <div className="p-2 border-r-2 border-black text-center">Způsob platby<br /><span className="text-[12px]">{invoice.paymentType}</span></div>
          <div className="p-2 text-center bg-yellow-50/30">Splatnost<br /><span className="text-[12px]">{formatDate(invoice.dueDate)}</span></div>
          <div className="p-2 col-span-2"></div>
        </div>

        <div className="relative" style={{ minHeight: '400px' }}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-black text-[10px] font-black uppercase bg-gray-50/30 h-10">
                <th className="px-3 w-[80px] text-center">Množství</th>
                <th className="px-4 text-left">Popis položky</th>
                <th className="px-3 text-right w-[120px]">Cena/J</th>
                <th className="px-3 text-right w-[120px]">CELKEM</th>
              </tr>
            </thead>
            <tbody className="text-[12px]">
              {invoice.items.slice(0, invoice.items.length > 16 ? 16 : 100).map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100 h-9 font-bold pdf-page-break-avoid">
                  <td className="px-3 text-center">{item.quantity} {item.unit || 'ks'}</td>
                  <td className="px-4">{item.description}</td>
                  <td className="px-3 text-right">{Number(item.unitPrice).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč</td>
                  <td className="px-3 text-right">{Number(item.quantity * item.unitPrice).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč</td>
                </tr>
              ))}
              {invoice.items.length > 16 && (
                <tr className="bg-amber-50/50 h-10 italic font-black uppercase text-blue-600">
                  <td colSpan={4} className="text-center text-[11px]">--- Pokračování v příloze (Celkem {invoice.items.length} položek) ---</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {invoice.items.length <= 16 && !hasAttachment && (
        <div className="mt-auto border-t-2 border-black p-8">
          <div className="flex justify-between items-end mb-16">
            <div className="text-[11px] font-bold space-y-1">
              {discountPercent > 0 && <p className="text-emerald-600 uppercase">Sleva: {discountPercent}% (-{Math.round(discountAmount).toLocaleString()} Kč)</p>}
              {isPayer ? (
                <div className="border border-black p-3 mb-2 flex flex-col gap-1 w-64 bg-white shadow-sm mt-2 font-black">
                  <div className="flex justify-between uppercase text-[9px]"><span className="opacity-70">Základ daně:</span> <span>{Number(finalExclDph).toLocaleString('cs-CZ', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kč</span></div>
                  <div className="flex justify-between uppercase text-[9px]"><span className="opacity-70">DPH 21%:</span> <span>{Number(vatAmount).toLocaleString('cs-CZ', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kč</span></div>
                  <div className="flex justify-between uppercase border-t border-black pt-1 mt-1 text-[11px]"><span>Celkem s DPH:</span> <span>{Number(totalRaw).toLocaleString('cs-CZ', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kč</span></div>
                </div>
              ) : null}
            </div>
            <div className="flex items-end gap-4 overflow-visible">
              {/* QR Code Container */}
              {(invoice.paymentType || '').toLowerCase() === 'převodem' && qrCodeString && (
                <div className="flex flex-col items-center justify-center p-2.5 border-2 border-black bg-white w-[130px] h-[130px] shrink-0 shadow-sm" style={{ boxSizing: 'border-box' }}>
                  <QRCodeSVG value={qrCodeString} size={102} level="M" />
                  <span className="text-[8px] font-black uppercase mt-1 tracking-widest text-black leading-none">QR PLATBA</span>
                </div>
              )}
              <div className="bg-gray-50 p-6 text-center border-2 border-black min-w-[300px] h-[130px] flex flex-col justify-center">
                <p className="text-[12px] font-black uppercase mb-1 opacity-60">CELKEM K ÚHRADĚ</p>
                <p className="text-[38px] font-black tracking-tighter leading-none">
                  {finalInclDph % 1 !== 0 
                    ? Number(finalInclDph).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : Math.round(Number(finalInclDph)).toLocaleString('cs-CZ')} Kč
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-24 px-4 overflow-visible mt-10">
            <div className="text-center">
              <div className="border-t border-dotted border-black mb-2 opacity-50"></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vystavil / Razítko a podpis</p>
            </div>
            <div className="text-center">
              <div className="border-t border-dotted border-black mb-2 opacity-50"></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Převzal (podpis odběratele)</p>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Invoice Attachment Page */}
    {invoice.items.length > 16 && (
      <div className={`bg-white text-black font-sans print-page-break flex flex-col relative ${activeTab !== 2 ? 'editor-tab-hidden' : ''}`} style={{ width: '210mm', minHeight: '290mm', margin: '0 auto', border: '2px solid #000' }}>
        <div className="flex-1">
          <div className="border-b-2 border-black p-6 flex justify-between items-end bg-gray-50/30">
            <div>
              <h2 className="text-[18px] font-black uppercase">Příloha k faktuře č. {invoice.id}</h2>
              <p className="text-[11px] font-bold opacity-50 uppercase mt-1">Rozpis položek (Pokračování ze strany 1)</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase opacity-30 tracking-widest">Strana 2 / 2</p>
            </div>
          </div>

          <table className="w-full border-collapse text-[12px] mb-8">
            <thead>
              <tr className="border-b-2 border-black text-[10px] font-black uppercase bg-gray-50/50 h-10">
                <th className="px-3 w-[80px] text-center">Množství</th>
                <th className="px-4 text-left">Popis položky</th>
                <th className="px-3 text-right w-[120px]">Cena / j</th>
                <th className="px-3 text-right w-[120px]">Celkem</th>
              </tr>
            </thead>
            <tbody className="font-bold">
              {invoice.items.slice(16).map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100 h-9 italic pdf-page-break-avoid">
                  <td className="px-3 text-center">{item.quantity} {item.unit || 'ks'}</td>
                  <td className="px-4 uppercase">{item.description}</td>
                  <td className="px-3 text-right">{Number(item.unitPrice).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč</td>
                  <td className="px-3 text-right">{Number(item.quantity * item.unitPrice).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-auto border-t-2 border-black p-8">
          <div className="flex justify-between items-end mb-16">
            <div className="text-[11px] font-bold space-y-1">
              {discountPercent > 0 && <p className="text-emerald-600 uppercase">Sleva: {discountPercent}% (-{Math.round(discountAmount).toLocaleString()} Kč)</p>}
              {isPayer ? (
                <div className="border border-black p-3 mb-2 flex flex-col gap-1 w-64 bg-white mt-2 font-black">
                  <div className="flex justify-between uppercase text-[9px]"><span className="opacity-70">Základ daně:</span> <span>{Number(finalExclDph).toLocaleString('cs-CZ', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kč</span></div>
                  <div className="flex justify-between uppercase text-[9px]"><span className="opacity-70">DPH 21%:</span> <span>{Number(vatAmount).toLocaleString('cs-CZ', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kč</span></div>
                  <div className="flex justify-between uppercase border-t border-black pt-1 mt-1 text-[11px]"><span>Celkem s DPH:</span> <span>{Number(totalRaw).toLocaleString('cs-CZ', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kč</span></div>
                </div>
              ) : null}
            </div>
            <div className="flex items-end gap-4 overflow-visible">
              {/* QR Code Container */}
              {(invoice.paymentType || '').toLowerCase() === 'převodem' && qrCodeString && (
                <div className="flex flex-col items-center justify-center p-2.5 border-2 border-black bg-white w-[130px] h-[130px] shrink-0 shadow-sm" style={{ boxSizing: 'border-box' }}>
                  <QRCodeSVG value={qrCodeString} size={102} level="M" />
                  <span className="text-[8px] font-black uppercase mt-1 tracking-widest text-black leading-none">QR PLATBA</span>
                </div>
              )}
              <div className="bg-slate-900 text-white p-8 text-center border-2 border-black min-w-[320px] h-[130px] flex flex-col justify-center rounded-3xl shadow-xl">
                <p className="text-[11px] font-black uppercase mb-1 opacity-50">CELKEM K ÚHRADĚ</p>
                <p className="text-[32px] font-black tracking-tight leading-none">
                  {finalInclDph % 1 !== 0 
                    ? Number(finalInclDph).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : Math.round(Number(finalInclDph)).toLocaleString('cs-CZ')} Kč
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-24 px-4 mt-10">
            <div className="text-center">
              <div className="border-t border-dotted border-black mb-2 opacity-50"></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vystavil / Razítko a podpis</p>
            </div>
            <div className="text-center">
              <div className="border-t border-dotted border-black mb-2 opacity-50"></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Převzal (podpis odběratele)</p>
            </div>
          </div>
        </div>
      </div>
    )}
    <style dangerouslySetInnerHTML={{ __html: `
      @media screen {
        .editor-tab-hidden { display: none !important; }
        .sticky-tabs { 
          position: sticky; 
          top: -49px; /* This compensates for the modal header padding/margin to sit better */
          z-index: 100;
          background: #f1f5f9; /* slate-100 to match background */
          margin-left: -1rem; /* compensating p-4 (invoice p is 4) */
          margin-right: -1rem;
          margin-top: -1rem;
          padding: 0.5rem 1rem;
          border-bottom: 1px solid rgba(0,0,0,0.1);
          margin-bottom: 2rem;
        }
      }
      @media print {
        @page {
          size: A4;
          margin: 0;
        }

        html, body { 
          height: auto !important; 
          overflow: visible !important; 
          background: white !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 210mm !important;
        }
        
        /* forced reset for stacking contexts in Electron */
        .fixed, .absolute, .relative {
          position: static !important;
          float: none !important;
          display: block !important;
        }

        /* Hide all UI elements marked with no-print or print:hidden */
        .no-print, [class*="print:hidden"], [class*="print\\:hidden"], .print\\:hidden { 
          display: none !important; 
        }
        
        /* Reset containers that wrap the invoice */
        .fixed.print\\:absolute, .bg-white.print\\:static {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 210mm !important;
          margin: 0 auto !important;
          display: block !important;
          overflow: visible !important;
          height: auto !important;
          background: white !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
          max-width: none !important;
          border-radius: 0 !important;
          z-index: 1000 !important;
        }

        /* ensure centering in Electron */
        .print-container {
           display: block !important;
           width: 210mm !important;
           margin: 0 auto !important;
           padding: 0 !important;
           background: white !important;
        }

        /* The actual invoice pages */
        .print-block, .print-page-break { 
          display: block !important;
          margin: 0 auto !important; 
          padding: 10mm !important; 
          border: 2px solid #000 !important; 
          box-sizing: border-box !important;
          box-shadow: none !important; 
          background: white !important;
          width: 210mm !important;
          min-height: 297mm !important;
          position: relative !important;
          transform: none !important;
        }

        /* Forced Page Breaks for Electron */
        .print-block {
          page-break-after: always !important;
          break-after: page !important;
        }
        
        .print-page-break {
          page-break-before: always !important;
          break-before: page !important;
          margin-top: 0 !important;
        }

        .editor-tab-hidden { display: block !important; }
        * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
      }
    `}} />
    </>
  );
};

export default InvoiceManager;