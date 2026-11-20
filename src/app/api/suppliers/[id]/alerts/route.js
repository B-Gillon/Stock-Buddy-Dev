// Which email alerts a supplier uses, and who gets them (Suppliers -> Email Alerts tab).
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';
import { ALERT_TYPES, parseEmailList } from '@/lib/alerts';

const forbidden = (request) => request.headers.get('x-auth-role') === 'supplier';

async function view(supplierId) {
  const { data } = await supabase.from('supplier_alert_settings').select('alert_type, enabled, emails').eq('supplier_id', supplierId);
  const by = new Map((data ?? []).map((r) => [r.alert_type, r]));
  return Object.entries(ALERT_TYPES).map(([type, d]) => ({ type, title: d.title, description: d.description, enabled: !!by.get(type)?.enabled, emails: by.get(type)?.emails ?? '' }));
}

async function ownSupplier(id, tenantId) {
  const { data } = await supabase.from('suppliers').select('id').eq('id', id).eq('tenant_id', tenantId).maybeSingle();
  return !!data;
}

export async function GET(request, { params }) {
  if (forbidden(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    if (!(await ownSupplier(id, tenantId))) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    return NextResponse.json({ alerts: await view(id) });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/alerts/GET', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  if (forbidden(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    if (!(await ownSupplier(id, tenantId))) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    const b = await request.json();
    const rows = [];
    for (const [type, d] of Object.entries(ALERT_TYPES)) {
      const a = b.alerts?.[type];
      if (!a) continue;
      const { valid, invalid } = parseEmailList(a.emails);
      if (invalid.length) return NextResponse.json({ error: `"${d.title}": these don't look like email addresses: ${invalid.join(', ')}` }, { status: 422 });
      if (valid.length > 10) return NextResponse.json({ error: `"${d.title}": up to 10 email addresses.` }, { status: 422 });
      if (a.enabled && !valid.length) return NextResponse.json({ error: `"${d.title}": enter at least one email address, or turn it off.` }, { status: 422 });
      rows.push({ tenant_id: tenantId, supplier_id: id, alert_type: type, enabled: !!a.enabled, emails: valid.join(', '), updated_at: new Date().toISOString() });
    }
    if (rows.length) {
      const { error } = await supabase.from('supplier_alert_settings').upsert(rows, { onConflict: 'supplier_id,alert_type' });
      if (error) throw error;
    }
    return NextResponse.json({ success: true, alerts: await view(id) });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/alerts/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
