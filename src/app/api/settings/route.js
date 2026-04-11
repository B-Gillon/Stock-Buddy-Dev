// /src/app/api/settings/route.js
import { supabase, setTenantContext } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { searchParams } = new URL(request.url);
  const keysParam = searchParams.get('keys');

  let query = supabase.from('settings').select('key, value');
  if (keysParam) {
    query = query.in('key', keysParam.split(',').map(k => k.trim()));
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = Object.fromEntries((data || []).map(r => [r.key, r.value ?? '']));
  return NextResponse.json(result);
}

export async function POST(request) {
  try {
    const tenantId = await getTenantId(request);

    await setTenantContext(supabase, tenantId);

    const body = await request.json();

    const rows = Object.entries(body).map(([key, value]) => ({
      tenant_id:  tenantId,
      key,
      value:      value ?? '',
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('settings')
      .upsert(rows, { onConflict: 'key' });

    if (error) {
      console.error("Settings upsert error:", JSON.stringify(error));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/settings caught error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
