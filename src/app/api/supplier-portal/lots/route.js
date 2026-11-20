// Supplier asks which of these lot numbers have already been used (so the form can say so before saving).
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { findUsedLots } from '@/lib/lotCheck';

export async function POST(request) {
  const supplierId = request.headers.get('x-auth-supplier');
  if (request.headers.get('x-auth-role') !== 'supplier' || !supplierId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let body; try { body = await request.json(); } catch { body = {}; }
  const lots = Array.isArray(body.lots) ? body.lots.slice(0, 500).map((l) => String(l ?? '').slice(0, 40)) : [];
  const { data: sup } = await supabase.from('suppliers').select('tenant_id').eq('id', supplierId).maybeSingle();
  if (!sup) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const used = await findUsedLots({ tenantId: sup.tenant_id, supplierId, lots, excludeShipmentId: body.excludeShipmentId || null });
    return NextResponse.json({ ok: true, used });
  } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
}
