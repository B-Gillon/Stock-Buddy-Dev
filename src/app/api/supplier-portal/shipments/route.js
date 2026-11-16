// Signed-in supplier creates a shipment (with cartons) against one of their POs.
// The retailer's Shipment Settings (visible / required fields) are enforced here.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { logPOActivity } from '@/lib/logPOActivity';
import { shippedByLine } from '@/lib/shipments';
import { markRetrieved } from '@/lib/supplierPortal';
import { loadShipmentConfig } from '@/lib/shipmentSettings';
import { validateShipment } from '@/lib/shipmentFields';

const clean = (v) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t === '' ? null : t; };
const numOrNull = (v) => { if (v == null || String(v).trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

export async function POST(request) {
  const supplierId = request.headers.get('x-auth-supplier');
  const userId = request.headers.get('x-auth-user');
  if (request.headers.get('x-auth-role') !== 'supplier' || !supplierId || !userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const bad = (error, status = 400) => NextResponse.json({ ok: false, error }, { status });

  const [{ data: sup }, { data: user }] = await Promise.all([
    supabase.from('suppliers').select('tenant_id').eq('id', supplierId).maybeSingle(),
    supabase.from('app_users').select('email').eq('id', userId).maybeSingle(),
  ]);
  if (!sup || !user) return bad('Forbidden', 403);
  const tenantId = sup.tenant_id;

  const { data: po } = await supabase.from('purchase_orders').select('id, po_number, status')
    .eq('id', body.poId).eq('tenant_id', tenantId).eq('supplier_id', supplierId).maybeSingle();
  if (!po) return bad('Purchase order not found.', 404);
  if (!['waiting_to_ship', 'partially_shipped', 'partially_received'].includes(po.status)) {
    return bad(po.status === 'pending_acknowledgement' ? 'Acknowledge this purchase order before shipping.' : 'This purchase order can’t be shipped.');
  }

  // Field rules from the retailer's settings
  const config = await loadShipmentConfig(tenantId);
  const sh = body.shipment ?? {};
  const cartonsIn = Array.isArray(body.cartons) ? body.cartons : [];
  const errors = validateShipment(config, sh, cartonsIn);
  if (errors.length) return bad(errors[0] + (errors.length > 1 ? ` (and ${errors.length - 1} more)` : ''));

  // Quantities against what is left to ship
  const { data: lines } = await supabase.from('purchase_order_lines').select('id, order_qty_units').eq('purchase_order_id', po.id);
  const lineMap = new Map((lines ?? []).map((l) => [l.id, l]));
  const shipped = await shippedByLine([...lineMap.keys()]);
  const used = {};
  for (const c of cartonsIn) {
    for (const r of c.lines ?? []) {
      const q = Number(r.qty) || 0;
      if (!q) continue;
      if (!lineMap.has(r.lineId)) return bad('A line does not belong to this purchase order.');
      used[r.lineId] = (used[r.lineId] ?? 0) + q;
    }
  }
  for (const [lineId, q] of Object.entries(used)) {
    const l = lineMap.get(lineId);
    if (q > (l.order_qty_units ?? 0) - (shipped[lineId] ?? 0)) return bad('A shipped quantity is more than the remaining unshipped quantity.');
  }

  // Keep only the fields the retailer shows; hidden fields are dropped
  const vs = config.shipment; const vc = config.carton;
  const shipmentRow = {
    tenant_id: tenantId, po_id: po.id, supplier_id: supplierId, created_by: user.email,
    ship_date: String(sh.ship_date).slice(0, 10),
    ship_method: vs.ship_method.visible ? clean(sh.ship_method) : null,
    tracking_number: vs.tracking_number.visible ? clean(sh.tracking_number) : null,
    bol_number: vs.bol_number.visible ? clean(sh.bol_number) : null,
    est_delivery_date: vs.est_delivery_date.visible ? clean(sh.est_delivery_date) : null,
    supplier_reference: vs.supplier_reference.visible ? clean(sh.supplier_reference) : null,
    packing_slip_number: vs.packing_slip_number.visible ? clean(sh.packing_slip_number) : null,
    total_pallets: vs.total_pallets.visible && numOrNull(sh.total_pallets) != null ? Math.trunc(numOrNull(sh.total_pallets)) : null,
    total_weight: vs.total_weight.visible ? numOrNull(sh.total_weight) : null,
    weight_unit: vs.total_weight.visible && numOrNull(sh.total_weight) != null ? sh.weight_unit : null,
    notes: vs.shipment_notes.visible ? clean(sh.notes) : null,
    total_cartons: cartonsIn.length,
  };

  const { count } = await supabase.from('shipments').select('id', { count: 'exact', head: true }).eq('po_id', po.id);
  const number = `${po.po_number}-S${(count ?? 0) + 1}`;
  const { data: created, error } = await supabase.from('shipments').insert({ ...shipmentRow, shipment_number: number }).select('id').single();
  if (error) {
    console.error('[shipments] insert failed:', error);
    return bad('Could not create the shipment. Please try again.', 500);
  }
  const rollback = () => supabase.from('shipments').delete().eq('id', created.id);

  const cartonRows = cartonsIn.map((c, i) => {
    const hasW = vc.weight.visible && numOrNull(c.weight) != null;
    const hasD = vc.dimensions.visible && numOrNull(c.length) != null;
    return {
      tenant_id: tenantId, shipment_id: created.id, carton_no: i + 1,
      supplier_carton_id: vc.supplier_carton_id.visible ? clean(c.supplier_carton_id) : null,
      sscc: vc.sscc.visible && clean(c.sscc) ? String(c.sscc).replace(/\s+/g, '') : null,
      tracking_number: vc.carton_tracking.visible ? clean(c.tracking_number) : null,
      weight: hasW ? numOrNull(c.weight) : null, weight_unit: hasW ? c.weight_unit : null,
      length: hasD ? numOrNull(c.length) : null, width: hasD ? numOrNull(c.width) : null, height: hasD ? numOrNull(c.height) : null,
      dim_unit: hasD ? c.dim_unit : null,
      pallet_id: vc.pallet_id.visible ? clean(c.pallet_id) : null,
    };
  });
  const { data: cartonIds, error: cErr } = await supabase.from('shipment_cartons').insert(cartonRows).select('id, carton_no');
  if (cErr) { console.error('[shipments] cartons failed:', cErr); await rollback(); return bad('Could not create the shipment. Please try again.', 500); }
  const idByNo = new Map(cartonIds.map((r) => [r.carton_no, r.id]));

  const lineRows = [];
  cartonsIn.forEach((c, i) => {
    for (const r of c.lines ?? []) {
      const q = Number(r.qty) || 0;
      if (q > 0) lineRows.push({ tenant_id: tenantId, shipment_id: created.id, carton_id: idByNo.get(i + 1), po_line_id: r.lineId, shipped_qty: q });
    }
  });
  const { error: lErr } = await supabase.from('shipment_lines').insert(lineRows);
  if (lErr) { console.error('[shipments] lines failed:', lErr); await rollback(); return bad('Could not create the shipment. Please try again.', 500); }

  // Status follows the shipments: every line fully shipped -> Shipped, otherwise Partially Shipped.
  // (A PO the retailer has already started receiving keeps its receiving status.)
  const after = await shippedByLine([...lineMap.keys()]);
  const fullyShipped = [...lineMap.values()].every((l) => (after[l.id] ?? 0) >= (l.order_qty_units ?? 0));
  await supabase.from('purchase_orders')
    .update({ status: fullyShipped ? 'shipped' : 'partially_shipped' })
    .eq('id', po.id).in('status', ['waiting_to_ship', 'partially_shipped']);
  await markRetrieved({ poId: po.id, tenantId, supplierId, by: user.email, method: 'shipment' });

  const units = lineRows.reduce((t, r) => t + r.shipped_qty, 0);
  await logPOActivity({ poId: po.id, tenantId, action: 'shipped', userName: user.email,
    comments: `Shipment ${number}` });
  return NextResponse.json({ ok: true, shipmentNumber: number });
}
