// Signed-in supplier uploads a shipment file. commit:false returns the recap (and any problems);
// commit:true re-checks the file and creates the shipments. All-or-nothing: a file with problems creates nothing.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { userLabel } from '@/lib/userLabel';
import { buildImportPlan, commitImportPlan } from '@/lib/shipmentImport';

export async function POST(request) {
  const supplierId = request.headers.get('x-auth-supplier');
  const userId = request.headers.get('x-auth-user');
  if (request.headers.get('x-auth-role') !== 'supplier' || !supplierId || !userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const text = typeof body.fileText === 'string' ? body.fileText : '';
  if (!text.trim()) return NextResponse.json({ ok: false, fatal: 'The file is empty.' });
  if (text.length > 2 * 1024 * 1024) return NextResponse.json({ ok: false, fatal: 'The file is too large (2 MB maximum).' });

  const [{ data: sup }, { data: user }] = await Promise.all([
    supabase.from('suppliers').select('tenant_id').eq('id', supplierId).maybeSingle(),
    supabase.from('app_users').select('email, username').eq('id', userId).maybeSingle(),
  ]);
  if (!sup || !user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const plan = await buildImportPlan({ tenantId: sup.tenant_id, supplierId, fileText: text });
    const { payloads, ...view } = plan;
    if (!body.commit) return NextResponse.json(view);
    if (!plan.ok) return NextResponse.json({ ...view, committed: false });
    const result = await commitImportPlan({ tenantId: sup.tenant_id, supplierId, userName: userLabel(user), plan });
    return NextResponse.json({ ...view, committed: result.ok, created: result.created, commitError: result.error ?? null });
  } catch (err) {
    console.error('[shipment-import] failed:', err);
    return NextResponse.json({ ok: false, fatal: 'Something went wrong reading the file. Please try again.' }, { status: 500 });
  }
}
