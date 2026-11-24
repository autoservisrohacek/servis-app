export interface FormattedInvoiceItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface PohodaExportData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  supplierIco: string;
  customerIco: string;
  customerName: string;
  customerCity: string;
  customerStreet: string;
  customerZip: string;
  isVatPayer: boolean;
  paymentType: string;
  items: FormattedInvoiceItem[];
  vehicleInfo?: string;
}

const escapeXml = (unsafe: string) => {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

export const generatePohodaInvoiceXml = (data: PohodaExportData, exportId: string = "export001"): string => {
  const { isVatPayer, items } = data;
  
  // Map payment type to Pohoda format
  const pohodaPaymentType = data.paymentType === 'Hotově' ? 'cash' : 'account';

  let itemsXml = '';
  items.forEach(item => {
    itemsXml += `
        <inv:invoiceItem>
          <inv:text>${escapeXml(item.description)}</inv:text>
          <inv:quantity>${item.quantity}</inv:quantity>
          <inv:unit>${escapeXml(item.unit)}</inv:unit>
          <inv:payVAT>${isVatPayer ? 'true' : 'false'}</inv:payVAT>
          <inv:rateVAT>${isVatPayer ? 'high' : 'none'}</inv:rateVAT>
          <inv:homeCurrency>
            <typ:unitPrice>${Math.round(item.unitPrice)}</typ:unitPrice>
          </inv:homeCurrency>
        </inv:invoiceItem>`;
  });

  // Strict order: invoiceType, number, symVar, date, dateTax, dateDue, text, partnerIdentity, paymentType
  // We use the exact namespaces required by Pohoda XML 2.0
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<dat:dataPack id="${escapeXml(exportId)}" ico="${escapeXml(data.supplierIco)}" application="AutoService Pro" version="2.0" note="Export faktury" xmlns:dat="http://www.stormware.cz/schema/version_2/data.xsd" xmlns:inv="http://www.stormware.cz/schema/version_2/invoice.xsd" xmlns:typ="http://www.stormware.cz/schema/version_2/type.xsd">
  <dat:dataPackItem id="${escapeXml(data.invoiceNumber)}" version="2.0">
    <inv:invoice version="2.0">
      <inv:invoiceHeader>
        <inv:invoiceType>issuedInvoice</inv:invoiceType>
        <inv:number>
          <typ:numberRequested>${escapeXml(data.invoiceNumber)}</typ:numberRequested>
        </inv:number>
        <inv:symVar>${escapeXml(data.invoiceNumber.replace(/\\D/g, ''))}</inv:symVar>
        <inv:date>${data.issueDate}</inv:date>
        ${isVatPayer ? `<inv:dateTax>${data.issueDate}</inv:dateTax>` : ''}
        <inv:dateDue>${data.dueDate}</inv:dateDue>
        <inv:text>Faktura za služby${data.vehicleInfo ? ` - ${escapeXml(data.vehicleInfo)}` : ''}</inv:text>
        <inv:partnerIdentity>
          <typ:address>
            <typ:company>${escapeXml(data.customerName)}</typ:company>
            <typ:city>${escapeXml(data.customerCity)}</typ:city>
            <typ:street>${escapeXml(data.customerStreet)}</typ:street>
            <typ:zip>${escapeXml(data.customerZip)}</typ:zip>
            ${data.customerIco ? `<typ:ico>${escapeXml(data.customerIco)}</typ:ico>` : ''}
          </typ:address>
        </inv:partnerIdentity>
        <inv:paymentType>
          <typ:ids>${pohodaPaymentType}</typ:ids>
        </inv:paymentType>
      </inv:invoiceHeader>
      <inv:invoiceDetail>${itemsXml}
      </inv:invoiceDetail>
    </inv:invoice>
  </dat:dataPackItem>
</dat:dataPack>`;

  return xml.trim();
};
