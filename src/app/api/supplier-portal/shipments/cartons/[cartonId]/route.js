// Supplier deletes a saved carton. Its items go back to unshipped (the PO status follows), its SSCC is voided,
// the remaining cartons of the shipment are renumbered (their labels must be reprinted), and a shipment left
// with no cartons is deleted. A carton with receiving activity against it can never be deleted.
import { userLabel } from '@/lib/userLabel';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { logPOActivity } from '@/lib/logPOActivity';
import { shippedByLine } from '@/lib/shipments';

export async function DELETE(request, { params }) {
  const supplierId = request.headers.get('x-auth-supplier');
  const userId = request.headers.get('x-auth-user');
  if (request.headers.get('x-auth-role') !== 'supplier' || !supplierId || !userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { cartonId } = await params;
  const bad = (error, status = 400) => NextResponse.json({ ok: false, error }, { status });

  const [{ data: sup }, { data: user }] = await Promise.all([
    supabase.from('suppliers').select('tenant_id').eq('id', supplierId).maybeSingle(),
    supabase.from('app_users').select('email, username').eq('id', userId).maybeSingle(),
  ]);
  if (!sup || !user) return bad('Forbidden', 403);
  const tenantId = sup.tenant_id;

  const { data: carton } = await supabase.from('shipment_cartons')
    .select('id, carton_no, sscc, received_at, shipment_id').eq('id', cartonId).eq('tenant_id', tenantId).maybeSingle();
  if (!carton) return bad('Carton not found.', 404);
  const { data: shipment } = await supabase.from('shipments').select('id, po_id, shipment_number')
    .eq('id', carton.shipment_id).eq('tenant_id', tenantId).eq('supplier_id', supplierId).maybeSingle();
  if (!shipment) return bad('Carton not found.', 404);
  const { data: po } = await supabase.from('purchase_orders').select('id, status')
    .eq('id', shipment.po_id).eq('tenant_id', tenantId).eq('supplier_id', supplierId).maybeSingle();
  if (!po) return bad('Carton not found.', 404);
  if (!['shipped', 'partially_shipped', 'partially_received'].includes(po.status)) return bad('Cartons can’t be deleted on this purchase order.', 409);

  // Receiving activity: never delete
  if (carton.received_at) return bad('This carton has been received and can’t be deleted.', 409);
  const { data: cartonLines } = await supabase.from('shipment_lines').select('po_line_id, shipped_qty').eq('carton_id', carton.id);
  const { data: poLines } = await supabase.from('purchase_order_lines').select('id, sku, order_qty_units, received_qty_units').eq('purchase_order_id', po.id);
  const lineMap = new Map((poLines ?? []).map((l) => [l.id, l]));
  const shippedBefore = await shippedByLine([...lineMap.keys()]);
  const removed = {};
  for (const r of cartonLines ?? []) removed[r.po_line_id] = (removed[r.po_line_id] ?? 0) + r.shipped_qty;
  for (const [lineId, q] of Object.entries(removed)) {
    const l = lineMap.get(lineId);
    if (l && (shippedBefore[lineId] ?? 0) - q < (l.received_qty_units ?? 0)) {
      return bad(`${l.sku || 'An item'} on this carton already has received quantity, so the carton can’t be deleted.`, 409);
    }
  }

  // Delete the carton (its item rows go with it) and void its SSCC
  const { error: delErr } = await supabase.from('shipment_cartons').delete().eq('id', carton.id).eq('tenant_id', tenantId).is('received_at', null);
  if (delErr) { console.error('[carton delete] failed:', delErr); return bad('Could not delete the carton. Please try again.', 500); }
  if (carton.sscc) await supabase.from('supplier_ssccs').update({ voided_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('sscc', carton.sscc);

  // Renumber what is left (or remove the shipment if nothing is left)
  const { data: left } = await supabase.from('shipment_cartons').select('id, carton_no').eq('shipment_id', shipment.id).order('carton_no', { ascending: true });
  let shipmentDeleted = false;
  if (!(left ?? []).length) {
    await supabase.from('shipments').delete().eq('id', shipment.id).eq('tenant_id', tenantId);
    shipmentDeleted = true;
  } else {
    for (let i = 0; i < left.length; i++) {
      if (left[i].carton_no !== i + 1) await supabase.from('shipment_cartons').update({ carton_no: i + 1 }).eq('id', left[i].id);
    }
    await supabase.from('shipments').update({ total_cartons: left.length }).eq('id', shipment.id);
  }

  // PO status follows what is still shipped (a PO the retailer has started receiving keeps its receiving status)
  const after = await shippedByLine([...lineMap.keys()]);
  const all = [...lineMap.values()];
  const fully = all.length > 0 && all.every((l) => (after[l.id] ?? 0) >= (l.order_qty_units ?? 0));
  const any = all.some((l) => (after[l.id] ?? 0) > 0);
  await supabase.from('purchase_orders').update({ status: fully ? 'shipped' : any ? 'partially_shipped' : 'waiting_to_ship' })
    .eq('id', po.id).in('status', ['shipped', 'partially_shipped']);

  await logPOActivity({ poId: po.id, tenantId, action: 'edited', userName: userLabel(user),
    comments: `Shipment ${shipment.shipment_number} carton ${carton.carton_no} deleted${shipmentDeleted ? ' (shipment removed, no cartons left)' : '; remaining cartons renumbered'}` });
  return NextResponse.json({ ok: true, shipmentDeleted });
}
