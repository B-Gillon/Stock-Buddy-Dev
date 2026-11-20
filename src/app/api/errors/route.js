// The signed-in retailer's own error list (GET, newest first) and bulk delete (DELETE with { ids }).
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { loadErrors } from '@/lib/errorsList';

export async function GET(request) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    return NextResponse.json({ errors: await loadErrors(await getTenantId(request)) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const tenantId = await getTenantId(request);
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string').slice(0, 500) : [];
    if (!ids.length) return NextResponse.json({ error: 'Nothing selected.' }, { status: 400 });
    const { error } = await supabase.from('error_log').delete().in('id', ids).eq('tenant_id', tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
