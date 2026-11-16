// Signed-in supplier creates a shipment against one of their POs.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { logPOActivity } from '@/lib/logPOActivity';
import { shippedByLine } from '@/lib/shipments';

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

  const { data: po } = await supabase.from('purchase_orders').select('id, po_number, status')
    .eq('id', body.poId).eq('tenant_id', sup.tenant_id).eq('supplier_id', supplierId).maybeSingle();
  if (!po) return bad('Purchase order not found.', 404);
  if (!['waiting_to_ship', 'partially_received'].includes(po.status)) {
    return bad(po.status === 'pending_acknowledgement' ? 'Acknowledge this purchase order before shipping.' : 'This purchase order can’t be shipped.');
  }

  const { data: lines } = await supabase.from('purchase_order_lines')
    .select('id, order_qty_units').eq('purchase_order_id', po.id);
  const lineMap = new Map((lines ?? []).map((l) => [l.id, l]));
  const shipped = await shippedByLine([...lineMap.keys()]);

  const wanted = [];
  for (const r of Array.isArray(body.lines) ? body.lines : []) {
    const qty = Number(r.qty);
    if (!qty) continue;
    const line = lineMap.get(r.lineId);
    if (!line) return bad('A line does not belong to this purchase order.');
    if (!Number.isInteger(qty) || qty < 0) return bad('Shipped quantities must be whole numbers.');
    const remaining = (line.order_qty_units ?? 0) - (shipped[line.id] ?? 0);
    if (qty > remaining) return bad('A shipped quantity is more than the remaining unshipped quantity.');
    wanted.push({ line_id: line.id, qty });
  }
  if (wanted.length === 0) return bad('Enter a shipped quantity for at least one line.');

  const { count } = await supabase.from('shipments').select('id', { count: 'exact', head: true }).eq('po_id', po.id);
  const number = `${po.po_number}-S${(count ?? 0) + 1}`;
  const { data: sh, error } = await supabase.from('shipments')
    .insert({ tenant_id: sup.tenant_id, po_id: po.id, supplier_id: supplierId, shipment_number: number, created_by: user.email })
    .select('id').single();
  if (error) {
    console.error('[shipments] insert failed:', error);
    return bad('Could not create the shipment. Please try again.', 500);
  }
  const { error: lineErr } = await supabase.from('shipment_lines').insert(
    wanted.map((w) => ({ tenant_id: sup.tenant_id, shipment_id: sh.id, po_line_id: w.line_id, shipped_qty: w.qty })),
  );
  if (lineErr) {
    console.error('[shipments] lines failed:', lineErr);
    await supabase.from('shipments').delete().eq('id', sh.id);
    return bad('Could not create the shipment. Please try again.', 500);
  }

  const units = wanted.reduce((t, w) => t + w.qty, 0);
  await logPOActivity({ poId: po.id, tenantId: sup.tenant_id, action: 'shipped', userName: user.email,
    comments: `Shipment ${number} created: ${units} unit${units === 1 ? '' : 's'} across ${wanted.length} line${wanted.length === 1 ? '' : 's'}` });
  return NextResponse.json({ ok: true, shipmentNumber: number });
}
