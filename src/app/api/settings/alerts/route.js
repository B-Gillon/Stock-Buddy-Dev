// Email Alerts templates (Settings -> Email Alerts): the subject and message of each alert, per tenant.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';
import { ALERT_TYPES, loadTemplates, unknownPlaceholders, parseEmailList } from '@/lib/alerts';

const forbidden = (request) => request.headers.get('x-auth-role') === 'supplier';

async function view(tenantId) {
  const saved = await loadTemplates(tenantId);
  return Object.entries(ALERT_TYPES).map(([type, d]) => ({
    type, title: d.title, description: d.description, tags: d.tags,
    subject: saved[type].subject, body: saved[type].body, cc: saved[type].cc, bcc: saved[type].bcc, defaultSubject: d.subject, defaultBody: d.body,
  }));
}

export async function GET(request) {
  if (forbidden(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    return NextResponse.json({ alerts: await view(tenantId) });
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
    const rows = [];
    for (const [type, d] of Object.entries(ALERT_TYPES)) {
      const t = b.templates?.[type];
      if (!t) continue;
      const subject = String(t.subject ?? '').trim(), body = String(t.body ?? '').trim();
      if (!subject || !body) return NextResponse.json({ error: `"${d.title}": the subject and message can't be empty.` }, { status: 422 });
      if (subject.length > 200 || body.length > 5000) return NextResponse.json({ error: `"${d.title}": the subject is limited to 200 characters and the message to 5,000.` }, { status: 422 });
      const bad = [...unknownPlaceholders(subject, type), ...unknownPlaceholders(body, type)];
      if (bad.length) return NextResponse.json({ error: `"${d.title}": unknown placeholder ${[...new Set(bad)].map((x) => `{{${x}}}`).join(', ')}. Use only ${d.tags.map((x) => `{{${x.tag}}}`).join(', ')}.` }, { status: 422 });
      const cc = parseEmailList(t.cc), bcc = parseEmailList(t.bcc);
      const badAddr = [...cc.invalid, ...bcc.invalid];
      if (badAddr.length) return NextResponse.json({ error: `"${d.title}": these don't look like email addresses: ${badAddr.join(', ')}` }, { status: 422 });
      if (cc.valid.length > 10 || bcc.valid.length > 10) return NextResponse.json({ error: `"${d.title}": up to 10 CC and 10 BCC addresses.` }, { status: 422 });
      rows.push({ tenant_id: tenantId, alert_type: type, subject, body, cc_emails: cc.valid.join(', '), bcc_emails: bcc.valid.join(', '), updated_at: new Date().toISOString() });
    }
    if (rows.length) {
      const { error } = await supabase.from('alert_templates').upsert(rows, { onConflict: 'tenant_id,alert_type' });
      if (error) throw error;
    }
    return NextResponse.json({ success: true, alerts: await view(tenantId) });
  } catch (err) {
    await logError({ source: 'api/settings/alerts/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
