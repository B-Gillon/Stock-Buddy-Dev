// /src/app/api/settings/route.js
import { supabase, setTenantContext } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { NextResponse } from 'next/server';
import { logError } from '@/lib/logError';

export async function GET(request) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);
    const { searchParams } = new URL(request.url);
    const keysParam = searchParams.get('keys');
    let query = supabase.from('settings').select('key, value');
    if (keysParam) query = query.in('key', keysParam.split(',').map(k => k.trim()));
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(Object.fromEntries((data || []).map(r => [r.key, r.value ?? ''])));
  } catch (err) {
    await logError({ source: 'api/settings/GET', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);
    const body = await request.json();
    const rows = Object.entries(body).map(([key, value]) => ({
      tenant_id: tenantId, key, value: value ?? '', updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    await logError({ source: 'api/settings/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
