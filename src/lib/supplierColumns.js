// Which item-identifier columns a supplier user wants to see on their PO / shipping screen.
export const LINE_COLUMN_DEFS = [
  { id: 'sku',          label: 'SKU' },
  { id: 'supplier_sku', label: 'Supplier SKU' },
  { id: 'barcode',      label: 'Barcode (UPC)' },
];

/** Default: SKU only. At least one column always stays on. */
export function normalizeLineColumns(raw) {
  const out = { sku: true, supplier_sku: false, barcode: false };
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(out)) if (typeof raw[k] === 'boolean') out[k] = raw[k];
  }
  if (!out.sku && !out.supplier_sku && !out.barcode) out.sku = true;
  return out;
}
