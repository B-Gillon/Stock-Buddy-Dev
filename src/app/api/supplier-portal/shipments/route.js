// Signed-in supplier creates a shipment (with cartons) against one of their POs.
// The retailer's Shipment Settings (visible / required fields) are enforced in createShipment.
import { userLabel } from '@/lib/userLabel';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { createShipment } from '@/lib/createShipment';

export async function POST(request) {
  const supplierId = request.headers.get('x-auth-supplier');
  const userId = request.headers.get('x-auth-user');
  if (request.headers.get('x-auth-role') !== 'supplier' || !supplierId || !userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  let body;
  try { body = await request.json(); } catch { body = {}; }

  const [{ data: sup }, { data: user }] = await Promise.all([
    supabase.from('suppliers').select('tenant_id').eq('id', supplierId).maybeSingle(),
    supabase.from('app_users').select('email, username').eq('id', userId).maybeSingle(),
  ]);
  if (!sup || !user) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  const result = await createShipment({
    tenantId: sup.tenant_id, supplierId, userName: userLabel(user),
    poId: body.poId, shipment: body.shipment, cartons: body.cartons,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, shipmentNumber: result.shipmentNumber, shipmentId: result.shipmentId });
}
