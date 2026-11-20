// /src/lib/errorsList.js
// The retailer's error list for the Errors page: newest first, each with the supplier it concerns (when known).
// Server-side only.
import { supabase } from '@/lib/supabaseClient';

export async function loadErrors(tenantId, limit = 200) {
  const { data } = await supabase.from('error_log').select('id, source, message, stack, context, user_name, created_at')
    .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit);
  const rows = data ?? [];

  // The supplier is in the context directly (ship file pickup) or through the PO (release)
  const poIds = [...new Set(rows.map((r) => r.context?.poId).filter(Boolean))];
  const { data: pos } = poIds.length ? await supabase.from('purchase_orders').select('id, supplier_id').in('id', poIds) : { data: [] };
  const supplierOfPo = new Map((pos ?? []).map((p) => [p.id, p.supplier_id]));
  const supplierIds = [...new Set(rows.map((r) => r.context?.supplierId ?? supplierOfPo.get(r.context?.poId)).filter(Boolean))];
  const { data: sups } = supplierIds.length ? await supabase.from('suppliers').select('id, supplier_name, supplier_number').eq('tenant_id', tenantId).in('id', supplierIds) : { data: [] };
  const byId = new Map((sups ?? []).map((s) => [s.id, s]));

  return rows.map((r) => {
    const s = byId.get(r.context?.supplierId ?? supplierOfPo.get(r.context?.poId));
    return { ...r, supplier: s ? `${s.supplier_name}${s.supplier_number ? ` (${s.supplier_number})` : ''}` : '' };
  });
}
