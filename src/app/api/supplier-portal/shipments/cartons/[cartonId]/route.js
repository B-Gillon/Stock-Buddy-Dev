// Supplier edits a saved carton: its fields and item quantities. If the label is generated, the label data is recreated:
// a changed carton content gets a NEW SSCC (the old one is voided); other edits keep the SSCC and just refresh the label.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { logPOActivity } from '@/lib/logPOActivity';
import { shippedByLine } from '@/lib/shipments';
import { loadShipmentConfig } from '@/lib/shipmentSettings';
import { validateShipment } from '@/lib/shipmentFields';
import { loadLabelSettings, reserveSscc } from '@/lib/sscc';

const clean = (v) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t === '' ? null : t; };
const numOrNull = (v) => { if (v == null || String(v).trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

export async function PATCH(request, { params }) {
  const supplierId = request.headers.get('x-auth-supplier');
  const userId = request.headers.get('x-auth-user');
  if (request.headers.get('x-auth-role') !== 'supplier' || !supplierId || !userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { cartonId } = await params;
  let body; try { body = await request.json(); } catch { body = {}; }
  const bad = (error, status = 400) => NextResponse.json({ ok: false, error }, { status });

  const [{ data: sup }, { data: user }] = await Promise.all([
    supabase.from('suppliers').select('tenant_id').eq('id', supplierId).maybeSingle(),
    supabase.from('app_users').select('email').eq('id', userId).maybeSingle(),
  ]);
  if (!sup || !user) return bad('Forbidden', 403);
  const tenantId = sup.tenant_id;

  const { data: carton } = await supabase.from('shipment_cartons')
    .select('id, carton_no, sscc, received_at, shipment_id').eq('id', cartonId).eq('tenant_id', tenantId).maybeSingle();
  if (!carton) return bad('Carton not found.', 404);
  const { data: shipment } = await supabase.from('shipments').select('id, po_id, shipment_number')
    .eq('id', carton.shipment_id).eq('tenant_id', tenantId).eq('supplier_id', supplierId).maybeSingle();
  if (!shipment) return bad('Carton not found.', 404);
  if (carton.received_at) return bad('This carton has already been received and can’t be changed.', 409);
  const { data: po } = await supabase.from('purchase_orders').select('id, status').eq('id', shipment.po_id).eq('tenant_id', tenantId).eq('supplier_id', supplierId).maybeSingle();
  if (!po) return bad('Carton not found.', 404);
  if (po.status === 'cancelled') return bad('This purchase order was cancelled.');

  const labels = await loadLabelSettings(tenantId, supplierId);
  const config = await loadShipmentConfig(tenantId);
  const c = body.carton ?? {};
  const forCheck = { ...c, sscc: labels.enabled ? (carton.sscc || '000000000000000000') : c.sscc };
  const errs = validateShipment(config, { ship_date: '2000-01-01' }, [forCheck]).filter((e) => e.startsWith('Carton 1'));
  if (errs.length) return bad(errs[0].replace('Carton 1', `Carton ${carton.carton_no}`));

  // Quantities: everything shipped on other cartons + this carton's new quantities must stay within the ordered quantity
  const { data: lines } = await supabase.from('purchase_order_lines').select('id, order_qty_units').eq('purchase_order_id', po.id);
  const lineMap = new Map((lines ?? []).map((l) => [l.id, l]));
  const { data: oldRows } = await supabase.from('shipment_lines').select('po_line_id, shipped_qty').eq('carton_id', carton.id);
  const oldQ = {}; for (const r of oldRows ?? []) oldQ[r.po_line_id] = (oldQ[r.po_line_id] ?? 0) + r.shipped_qty;
  const newQ = {};
  for (const r of c.lines ?? []) {
    const q = Number(r.qty) || 0;
    if (!q) continue;
    if (!lineMap.has(r.lineId)) return bad('A line does not belong to this purchase order.');
    newQ[r.lineId] = (newQ[r.lineId] ?? 0) + q;
  }
  const shipped = await shippedByLine([...lineMap.keys()]);
  for (const [lineId, q] of Object.entries(newQ)) {
    if ((shipped[lineId] ?? 0) - (oldQ[lineId] ?? 0) + q > (lineMap.get(lineId).order_qty_units ?? 0)) return bad('A quantity is more than the remaining unshipped quantity.');
  }
  const ids = new Set([...Object.keys(oldQ), ...Object.keys(newQ)]);
  const contentChanged = [...ids].some((id) => (oldQ[id] ?? 0) !== (newQ[id] ?? 0));

  // Label data: new SSCC when contents changed (or there was none), same SSCC otherwise
  const vc = config.carton;
  let sscc = carton.sscc;
  let ssccChanged = false;
  if (labels.enabled) {
    if (!sscc || contentChanged) {
      try { sscc = await reserveSscc({ tenantId, supplierId, poId: po.id, cartonNo: carton.carton_no }); }
      catch (e) { return bad(e.message); }
      ssccChanged = true;
    }
  } else if (vc.sscc.visible) {
    sscc = clean(c.sscc) ? String(c.sscc).replace(/\s+/g, '') : null;
  }

  const hasW = vc.weight.visible && numOrNull(c.weight) != null;
  const hasD = vc.dimensions.visible && numOrNull(c.length) != null;
  const { error: upErr } = await supabase.from('shipment_cartons').update({
    supplier_carton_id: vc.supplier_carton_id.visible ? clean(c.supplier_carton_id) : null,
    sscc,
    tracking_number: vc.carton_tracking.visible ? clean(c.tracking_number) : null,
    weight: hasW ? numOrNull(c.weight) : null, weight_unit: hasW ? c.weight_unit : null,
    length: hasD ? numOrNull(c.length) : null, width: hasD ? numOrNull(c.width) : null, height: hasD ? numOrNull(c.height) : null,
    dim_unit: hasD ? c.dim_unit : null,
    pallet_id: vc.pallet_id.visible ? clean(c.pallet_id) : null,
    lot_number: vc.lot_number.visible ? clean(c.lot_number) : null,
    expiration_date: vc.expiration_date.visible ? clean(c.expiration_date) : null,
  }).eq('id', carton.id);
  if (upErr) { console.error('[carton edit] update failed:', upErr); return bad('Could not save the carton. Please try again.', 500); }

  if (ssccChanged) {
    await supabase.from('supplier_ssccs').update({ shipment_id: shipment.id }).eq('tenant_id', tenantId).eq('sscc', sscc);
    if (carton.sscc) await supabase.from('supplier_ssccs').update({ voided_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('sscc', carton.sscc);
  }

  if (contentChanged) {
    await supabase.from('shipment_lines').delete().eq('carton_id', carton.id);
    const rows = Object.entries(newQ).map(([lineId, q]) => ({ tenant_id: tenantId, shipment_id: shipment.id, carton_id: carton.id, po_line_id: lineId, shipped_qty: q }));
    const { error: lErr } = await supabase.from('shipment_lines').insert(rows);
    if (lErr) {
      console.error('[carton edit] lines failed, restoring:', lErr);
      await supabase.from('shipment_lines').insert(Object.entries(oldQ).map(([lineId, q]) => ({ tenant_id: tenantId, shipment_id: shipment.id, carton_id: carton.id, po_line_id: lineId, shipped_qty: q })));
      return bad('Could not save the carton. Please try again.', 500);
    }
    // Status follows the shipments
    const after = await shippedByLine([...lineMap.keys()]);
    const fully = [...lineMap.values()].every((l) => (after[l.id] ?? 0) >= (l.order_qty_units ?? 0));
    await supabase.from('purchase_orders').update({ status: fully ? 'shipped' : 'partially_shipped' }).eq('id', po.id).in('status', ['shipped', 'partially_shipped']);
  }

  await logPOActivity({ poId: po.id, tenantId, action: 'shipped', userName: user.email,
    comments: `Shipment ${shipment.shipment_number} carton ${carton.carton_no} edited${ssccChanged ? ' (new SSCC issued)' : ''}` });
  return NextResponse.json({ ok: true, sscc, ssccChanged });
}
