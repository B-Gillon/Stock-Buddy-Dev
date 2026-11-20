// Email Alerts settings (Settings -> Email Alerts), one row per tenant.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';
import { parseEmailList } from '@/lib/alerts';

const forbidden = (request) => request.headers.get('x-auth-role') === 'supplier';

export async function GET(request) {
  if (forbidden(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { data } = await supabase.from('tenant_alert_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
    return NextResponse.json({
      alert_emails: data?.alert_emails ?? '',
      alert_po_release_failed: data?.alert_po_release_failed ?? true,
      alert_ship_file_failed: data?.alert_ship_file_failed ?? true,
    });
  } catch (err) {
    await logError({ source: 'api/settings/alerts/GET', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (forbidden(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const b = await request.json();
    const { valid, invalid } = parseEmailList(b.alert_emails);
    if (invalid.length) return NextResponse.json({ error: `These don't look like email addresses: ${invalid.join(', ')}` }, { status: 422 });
    if (valid.length > 10) return NextResponse.json({ error: 'Up to 10 email addresses.' }, { status: 422 });
    const { error } = await supabase.from('tenant_alert_settings').upsert({
      tenant_id: tenantId, alert_emails: valid.join(', '),
      alert_po_release_failed: !!b.alert_po_release_failed, alert_ship_file_failed: !!b.alert_ship_file_failed,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });
    if (error) throw error;
    return NextResponse.json({ success: true, alert_emails: valid.join(', ') });
  } catch (err) {
    await logError({ source: 'api/settings/alerts/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
