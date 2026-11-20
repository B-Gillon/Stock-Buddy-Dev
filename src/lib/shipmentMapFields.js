// /src/lib/shipmentMapFields.js
// The Stock Buddy fields a supplier's shipment file can supply, plus CSV parsing and column auto-matching.
// Used by the Mapping Configuration card (and, later, the shipment import).

export const DELIMITERS = [
  { id: 'comma', label: 'Comma ( , )', char: ',' },
  { id: 'tab', label: 'Tab', char: '\t' },
  { id: 'semicolon', label: 'Semicolon ( ; )', char: ';' },
  { id: 'pipe', label: 'Pipe ( | )', char: '|' },
];

// group, id, label, required, aliases (header names we recognise)
export const MAP_GROUPS = [
  { id: 'shipment', label: 'Shipment', fields: [
    { id: 'po_number', label: 'PO Number', explain: 'The purchase order being shipped.', required: true, aliases: ['ponumber', 'po', 'pono', 'purchaseorder', 'purchaseordernumber', 'ponum'] },
    { id: 'ship_date', label: 'Ship Date', explain: 'The date the shipment actually left the supplier. Rows in the same carton must all have the same date.', required: true, aliases: ['shipdate', 'dateshipped', 'shippeddate', 'shipmentdate', 'actualshipdate'] },
    { id: 'tracking_number', label: 'PRO / Tracking #', explain: 'Freight (PRO) or master tracking number for the whole shipment. Optional. Must be the same on every row of a shipment.', aliases: ['pro', 'protracking', 'protrackingnumber', 'protrackingno', 'pronumber', 'trackingnumber', 'tracking', 'trackingno', 'trackingnum'] },
    { id: 'supplier_reference', label: 'Supplier Shipment Reference', explain: 'The supplier\'s own ID for the shipment. Optional. Must be the same on every row of a shipment.', aliases: ['shipmentreference', 'shipmentref', 'supplierreference', 'shipmentid', 'shipmentnumber', 'asnnumber'] },
    { id: 'packing_slip_number', label: 'Packing Slip Number', explain: 'Optional. Must be the same on every row of a shipment.', aliases: ['packingslip', 'packingslipnumber', 'packslip', 'packslipnumber'] },
  ] },
  { id: 'carton', label: 'Carton', fields: [
    { id: 'supplier_carton_id', label: 'SSCC Case Number (Carton ID)', explain: 'Identifies one carton and prints on its case label. Must be unique, never used on any other carton. Rows sharing a number are items in the same carton. When "Enforce Valid SSCC#s" is on, it must be 20 digits, start with 00, and have a valid check digit. When mixed cases are blocked, a carton can hold only one item.', aliases: ['sscc', 'sscccasenumber', 'ssccartonid', 'ssccnumber', 'casenumber', 'cartonid', 'cartonnumber', 'caseid', 'sscc18'] },
    { id: 'carton_tracking', label: 'Carton Tracking Number', explain: 'Optional. Parcel tracking number for the carton. Must be the same on every row of a carton.', aliases: ['cartontracking', 'cartontrackingnumber', 'parceltracking'] },
  ] },
  { id: 'item', label: 'Item', fields: [
    { id: 'sku', label: 'SKU', explain: 'Identifies the item on the PO by our SKU. Include at least one of SKU, Supplier SKU and Barcode. If more than one is included, all must point to the same item.', identifier: true, aliases: ['sku', 'itemsku', 'itemnumber', 'item', 'itemno', 'productsku'] },
    { id: 'supplier_sku', label: 'Supplier SKU', explain: 'Identifies the item by the supplier\'s own item number, as saved on the product. Same rule as SKU.', identifier: true, aliases: ['suppliersku', 'vendorsku', 'vendoritem', 'vendoritemnumber', 'vendorpart', 'supplieritem'] },
    { id: 'barcode', label: 'Barcode', explain: 'Identifies the item by its UPC/EAN, as saved on the product. Same rule as SKU.', identifier: true, aliases: ['barcode', 'upc', 'ean', 'gtin', 'upccode'] },
    { id: 'ship_qty', label: 'Ship Qty (units)', explain: 'Units of this item in this carton. Must be a whole number above 0. Total shipped for an item can\'t exceed what\'s still unshipped on the PO.', required: true, aliases: ['shipqty', 'qtyshipped', 'quantityshipped', 'shippedqty', 'shippedquantity', 'qty', 'quantity'] },
    { id: 'lot_number', label: 'Lot Number', explain: 'Optional. The lot for this item in this carton. An item can have only one lot per carton. A second lot needs a separate carton. A lot number can only be used once, ever.', aliases: ['lot', 'lotnumber', 'lotno', 'batch', 'batchnumber'] },
    { id: 'expiration_date', label: 'Expire Date', explain: 'Optional. The expiry for this item\'s lot. Must be a valid date.', aliases: ['expiration', 'expirationdate', 'expiry', 'expirydate', 'expdate', 'expires', 'bestby'] },
  ] },
];

export const MAP_FIELDS = MAP_GROUPS.flatMap((g) => g.fields.map((f) => ({ ...f, group: g.id })));
export const MAP_FIELD_IDS = MAP_FIELDS.map((f) => f.id);

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Parses delimited text (quotes supported). Returns rows of strings, at most maxRows. */
export function parseDelimited(text, delimiterChar, maxRows = 50) {
  const rows = [];
  let row = [], cell = '', inQ = false;
  const src = String(text ?? '').replace(/^﻿/, '');
  for (let i = 0; i < src.length && rows.length < maxRows; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delimiterChar) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (rows.length < maxRows && (cell !== '' || row.length)) { row.push(cell); if (row.some((c) => c.trim() !== '')) rows.push(row); }
  return rows;
}

/** Guesses which file column feeds each field, by header name. Returns { fieldId: columnIndex }. */
export function autoMatch(headers) {
  const out = {}, used = new Set();
  const normHeaders = headers.map(norm);
  for (const f of MAP_FIELDS) {
    const idx = normHeaders.findIndex((h, i) => !used.has(i) && h && f.aliases.includes(h));
    if (idx >= 0) { out[f.id] = idx; used.add(idx); }
  }
  return out;
}
