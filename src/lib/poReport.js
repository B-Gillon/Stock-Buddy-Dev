// The Purchase Order Report (donut) numbers, shared by the retailer and supplier dashboards.
// With a supplierId the report covers only that supplier's POs, and drafts are left out (suppliers never see drafts).
import { supabase } from '@/lib/supabaseClient';
import { OPEN_STATUSES, NOT_FULLY_SHIPPED_STATUSES } from '@/lib/poStatus';

export async function buildPOReport({ tenantId, supplierId = null, today }) {
  const statuses = [...OPEN_STATUSES, 'received'].filter((st) => supplierId == null || st !== 'draft');
  let q = supabase.from('purchase_orders').select('id, status, expected_date, expected_ship_date')
    .eq('tenant_id', tenantId).in('status', statuses).limit(5000);
  if (supplierId) q = q.eq('supplier_id', supplierId);
  const { data: reportPOs } = await q;

  const costByPO = {};
  const readyByPO = {}; // received but not yet put away (units)
  if ((reportPOs ?? []).length) {
    let lq = supabase.from('purchase_order_lines')
      .select('purchase_order_id, order_qty_units, unit_cost, received_qty_units, putaway_qty_units, purchase_orders!inner(status, supplier_id)')
      .eq('tenant_id', tenantId).in('purchase_orders.status', statuses).range(0, 19999);
    if (supplierId) lq = lq.eq('purchase_orders.supplier_id', supplierId);
    const { data: reportLines } = await lq;
    for (const l of reportLines ?? []) {
      costByPO[l.purchase_order_id] = (costByPO[l.purchase_order_id] ?? 0) + (l.order_qty_units ?? 0) * Number(l.unit_cost ?? 0);
      readyByPO[l.purchase_order_id] = (readyByPO[l.purchase_order_id] ?? 0) + Math.max(0, (l.received_qty_units ?? 0) - (l.putaway_qty_units ?? 0));
    }
  }

  // Week = Monday to Sunday
  const dow = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7; // Monday = 0
  const weekEnd = new Date(new Date(today + 'T00:00:00Z').getTime() + (6 - dow) * 864e5).toISOString().slice(0, 10);

  const report = {
    overdue: { count: 0, cost: 0 }, thisWeek: { count: 0, cost: 0 },
    later: { count: 0, cost: 0 }, transit: { count: 0, cost: 0 }, putaway: { count: 0, cost: 0 }, drafts: { count: 0, cost: 0 },
  };
  const add = (k, po) => { report[k].count += 1; report[k].cost += costByPO[po.id] ?? 0; };
  for (const po of reportPOs ?? []) {
    if (po.status === 'draft') { add('drafts', po); continue; }
    if (po.status !== 'received' && po.expected_date && po.expected_date < today) { add('overdue', po); continue; } // same rule as the Overdue card
    if ((readyByPO[po.id] ?? 0) > 0) { add('putaway', po); continue; } // received, not yet put away
    if (po.status === 'shipped') { add('transit', po); continue; } // shipped, not yet received
    if (!NOT_FULLY_SHIPPED_STATUSES.includes(po.status)) continue; // already shipped: nothing left to ship
    const ship = po.expected_ship_date || po.expected_date;
    if (ship && ship <= weekEnd) add('thisWeek', po); else add('later', po);
  }
  return report;
}
