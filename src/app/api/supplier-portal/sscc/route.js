// Reserves an SSCC for a carton (supplier must have label generation turned on).
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { reserveSscc } from '@/lib/sscc';

export async function POST(request) {
  const supplierId = request.headers.get('x-auth-supplier');
  if (request.headers.get('x-auth-role') !== 'supplier' || !supplierId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let body; try { body = await request.json(); } catch { body = {}; }
  const { data: sup } = await supabase.from('suppliers').select('tenant_id').eq('id', supplierId).maybeSingle();
  if (!sup) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data: po } = await supabase.from('purchase_orders').select('id')
    .eq('id', body.poId).eq('tenant_id', sup.tenant_id).eq('supplier_id', supplierId).maybeSingle();
  if (!po) return NextResponse.json({ error: 'Purchase order not found.' }, { status: 404 });
  const cartonNo = Math.max(1, Math.trunc(Number(body.cartonNo)) || 1);
  try {
    const sscc = await reserveSscc({ tenantId: sup.tenant_id, supplierId, poId: po.id, cartonNo });
    return NextResponse.json({ ok: true, sscc });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
