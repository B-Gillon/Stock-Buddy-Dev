// /src/lib/lotCheck.js
// A lot number can be used only once, ever, per supplier: if it is already on any shipment this supplier
// has saved, it can't be used again on another shipment. Server-side only.
import { supabase } from '@/lib/supabaseClient';

const key = (v) => String(v ?? '').trim().toLowerCase();

/**
 * @param lots  lot numbers to check (any case; blanks ignored)
 * @param excludeShipmentId  when editing a carton, the lots on its own shipment don't count as "used"
 * @returns {Promise<string[]>} the lots (as the caller typed them) that are already used
 */
export async function findUsedLots({ tenantId, supplierId, lots, excludeShipmentId = null }) {
  const keys = [...new Set((lots ?? []).map(key).filter(Boolean))];
  if (!keys.length) return [];
  let q = supabase.from('shipment_lines')
    .select('lot_key, shipment:shipments!shipment_id!inner ( supplier_id )')
    .eq('tenant_id', tenantId).in('lot_key', keys).eq('shipment.supplier_id', supplierId);
  if (excludeShipmentId) q = q.neq('shipment_id', excludeShipmentId);
  const { data, error } = await q;
  if (error) throw new Error('Could not check lot numbers.');
  const used = new Set((data ?? []).map((r) => r.lot_key));
  const seen = new Set(); const out = [];
  for (const l of lots) { const k = key(l); if (k && used.has(k) && !seen.has(k)) { seen.add(k); out.push(String(l).trim()); } }
  return out;
}

export const usedLotsMessage = (used) =>
  `Lot Number ${used.join(', ')} ${used.length === 1 ? 'was' : 'were'} already used on an earlier shipment. A lot number can only be used once.`;
