// Retailer-side API for purchase order settings (currently: Mixed Locations Allowed)
import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenants';
import { supabase } from '@/lib/supabaseClient';
import { logError } from '@/lib/logError';

const forbidden = (request) => request.headers.get('x-auth-role') === 'supplier';

export async function GET(request) {
  if (forbidden(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { data } = await supabase.from('po_settings').select('mixed_locations_allowed').eq('tenant_id', tenantId).maybeSingle();
    return NextResponse.json({ mixedLocationsAllowed: data?.mixed_locations_allowed ?? true });
  } catch (err) {
    await logError({ source: 'api/po-settings/GET', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  if (forbidden(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const body = await request.json();
    const value = body?.mixedLocationsAllowed !== false;
    const { error } = await supabase.from('po_settings')
      .upsert({ tenant_id: tenantId, mixed_locations_allowed: value, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' });
    if (error) throw error;
    return NextResponse.json({ mixedLocationsAllowed: value });
  } catch (err) {
    await logError({ source: 'api/po-settings/PUT', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
