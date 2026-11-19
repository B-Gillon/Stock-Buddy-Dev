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
    { id: 'po_number', label: 'PO Number', required: true, aliases: ['ponumber', 'po', 'pono', 'purchaseorder', 'purchaseordernumber', 'ponum'] },
    { id: 'ship_date', label: 'Ship Date', required: true, aliases: ['shipdate', 'dateshipped', 'shippeddate', 'shipmentdate', 'actualshipdate'] },
    { id: 'tracking_number', label: 'PRO / Tracking #', aliases: ['pro', 'pronumber', 'trackingnumber', 'tracking', 'trackingno', 'trackingnum'] },
    { id: 'supplier_reference', label: 'Supplier Shipment Reference', aliases: ['shipmentreference', 'shipmentref', 'supplierreference', 'shipmentid', 'shipmentnumber', 'asnnumber'] },
    { id: 'packing_slip_number', label: 'Packing Slip Number', aliases: ['packingslip', 'packingslipnumber', 'packslip', 'packslipnumber'] },
  ] },
  { id: 'carton', label: 'Carton', fields: [
    { id: 'supplier_carton_id', label: 'SSCC Case Number (Carton ID)', aliases: ['sscc', 'ssccnumber', 'casenumber', 'cartonid', 'cartonnumber', 'caseid', 'sscc18'] },
    { id: 'carton_tracking', label: 'Carton Tracking Number', aliases: ['cartontracking', 'cartontrackingnumber', 'parceltracking'] },
    { id: 'weight', label: 'Carton Weight', aliases: ['weight', 'cartonweight', 'grossweight'] },
    { id: 'weight_unit', label: 'Weight Unit', aliases: ['weightunit', 'wtunit', 'uom'] },
    { id: 'length', label: 'Length', aliases: ['length', 'cartonlength', 'len'] },
    { id: 'width', label: 'Width', aliases: ['width', 'cartonwidth'] },
    { id: 'height', label: 'Height', aliases: ['height', 'cartonheight'] },
    { id: 'dim_unit', label: 'Dimension Unit', aliases: ['dimunit', 'dimensionunit', 'dimensionsunit'] },
    { id: 'pallet_id', label: 'Pallet ID', aliases: ['palletid', 'pallet', 'palletnumber'] },
  ] },
  { id: 'item', label: 'Item', fields: [
    { id: 'sku', label: 'SKU', identifier: true, aliases: ['sku', 'itemsku', 'itemnumber', 'item', 'itemno', 'productsku'] },
    { id: 'supplier_sku', label: 'Supplier SKU', identifier: true, aliases: ['suppliersku', 'vendorsku', 'vendoritem', 'vendoritemnumber', 'vendorpart', 'supplieritem'] },
    { id: 'barcode', label: 'Barcode', identifier: true, aliases: ['barcode', 'upc', 'ean', 'gtin', 'upccode'] },
    { id: 'line_no', label: 'PO Line #', aliases: ['line', 'lineno', 'linenumber', 'polineno', 'polinenumber'] },
    { id: 'ship_qty', label: 'Ship Qty (units)', required: true, aliases: ['shipqty', 'qtyshipped', 'quantityshipped', 'shippedqty', 'shippedquantity', 'qty', 'quantity'] },
    { id: 'lot_number', label: 'Lot Number', aliases: ['lot', 'lotnumber', 'lotno', 'batch', 'batchnumber'] },
    { id: 'expiration_date', label: 'Expiration Date', aliases: ['expiration', 'expirationdate', 'expiry', 'expirydate', 'expdate', 'expires', 'bestby'] },
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
