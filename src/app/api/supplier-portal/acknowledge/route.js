// Signed-in supplier acknowledges a PO. Identity comes only from the verified session headers.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { submitAckFromPortal } from '@/lib/acknowledgements';

export async function POST(request) {
  const supplierId = request.headers.get('x-auth-supplier');
  const userId = request.headers.get('x-auth-user');
  if (request.headers.get('x-auth-role') !== 'supplier' || !supplierId || !userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  let body;
  try { body = await request.json(); } catch { body = {}; }
  if (!body.poId) return NextResponse.json({ error: 'Missing purchase order.' }, { status: 400 });

  const [{ data: sup }, { data: user }] = await Promise.all([
    supabase.from('suppliers').select('tenant_id').eq('id', supplierId).maybeSingle(),
    supabase.from('app_users').select('email').eq('id', userId).maybeSingle(),
  ]);
  if (!sup || !user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const result = await submitAckFromPortal({
    poId: body.poId, tenantId: sup.tenant_id, supplierId,
    userName: user.email, shipDate: body.shipDate || null,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : result.code === 'error' ? 500 : 400 });
}
