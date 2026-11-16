// /src/lib/shipments.js
import { supabase } from '@/lib/supabaseClient';

/** { [po_line_id]: total shipped qty } across all shipments of the given PO lines. */
export async function shippedByLine(lineIds) {
  const map = {};
  if (!lineIds?.length) return map;
  const { data } = await supabase.from('shipment_lines').select('po_line_id, shipped_qty').in('po_line_id', lineIds);
  for (const r of data ?? []) map[r.po_line_id] = (map[r.po_line_id] ?? 0) + (r.shipped_qty ?? 0);
  return map;
}
