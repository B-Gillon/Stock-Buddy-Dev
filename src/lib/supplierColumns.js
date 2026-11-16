// Which columns a supplier user wants to see in the line-item table on their PO / shipping screen.
export const LINE_COLUMN_DEFS = [
  { id: 'line_no',      label: '#',             def: true },
  { id: 'image',        label: 'Image',         def: true },
  { id: 'sku',          label: 'SKU',           def: true },
  { id: 'supplier_sku', label: 'Supplier SKU',  def: false },
  { id: 'barcode',      label: 'Barcode (UPC)', def: false },
  { id: 'description',  label: 'Description',   def: true },
  { id: 'ordered',      label: 'Ordered',       def: true },
  { id: 'shipped',      label: 'Shipped',       def: true },
  { id: 'received',     label: 'Received',      def: true },
  { id: 'unit_cost',    label: 'Unit Cost',     def: true },
  { id: 'extended',     label: 'Extended Cost', def: true },
];

/** Defaults per column; at least one column always stays on. */
export function normalizeLineColumns(raw) {
  const out = {};
  for (const c of LINE_COLUMN_DEFS) {
    out[c.id] = raw && typeof raw === 'object' && typeof raw[c.id] === 'boolean' ? raw[c.id] : c.def;
  }
  if (!Object.values(out).some(Boolean)) out.sku = true;
  return out;
}
