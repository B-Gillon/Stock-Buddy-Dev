// /src/lib/alerts.js
// Email alerts to the retailer's own team about a supplier. What each email says (subject and message) is
// set once in Settings -> Email Alerts; which alerts a supplier uses, and who gets them, is set on the
// supplier (Suppliers -> Email Alerts tab). Never throws: an alert that can't be sent must not break the
// work that triggered it. Server-side only.
import nodemailer from 'nodemailer';
import { supabase } from '@/lib/supabaseClient';
import { logError } from '@/lib/logError';

export const ALERT_TYPES = {
  po_release_failed: {
    title: 'A PO could not be sent to the supplier',
    description: 'After a PO is released, the email / SFTP delivery to the supplier runs in the background. This is sent if that delivery fails.',
    tags: [
      { tag: 'supplier_name', text: 'The supplier\'s name' },
      { tag: 'po_number', text: 'The PO number' },
      { tag: 'skus', text: 'The SKUs on the PO, comma-separated' },
      { tag: 'problem', text: 'What went wrong' },
    ],
    subject: '{{po_number}} was released but {{supplier_name}} did not receive it',
    body: `The purchase order {{po_number}} is released in Stock Buddy, but it could not be delivered to {{supplier_name}}.

What went wrong:
{{problem}}

Open the PO and use Resend once the problem is fixed.`,
  },
  ship_file_failed: {
    title: 'A ship file could not be processed',
    description: 'A shipment file picked up from the supplier\'s SFTP site had problems (or the SFTP site could not be reached). No shipments are created from a file with problems.',
    tags: [
      { tag: 'supplier_name', text: 'The supplier\'s name' },
      { tag: 'file_name', text: 'The ship file\'s name' },
      { tag: 'po_numbers', text: 'The PO numbers in the file, comma-separated' },
      { tag: 'skus', text: 'The SKUs in the file, comma-separated' },
      { tag: 'problem', text: 'What went wrong, row by row' },
    ],
    subject: 'Ship file {{file_name}} from {{supplier_name}} could not be processed',
    body: `The ship file {{file_name}} from {{supplier_name}} could not be processed. No shipments were created from it.

POs in the file: {{po_numbers}}

What went wrong:
{{problem}}

The file is attached. Ask the supplier to correct it and upload it again.`,
  },
};

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Splits a typed list (commas, semicolons, spaces, new lines) into valid addresses and rejects. */
export function parseEmailList(text) {
  const parts = String(text ?? '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  return { valid: [...new Set(parts.filter((p) => EMAIL_RE.test(p)))], invalid: parts.filter((p) => !EMAIL_RE.test(p)) };
}

export const renderTemplate = (text, vars) => String(text ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null && vars[k] !== '' ? String(vars[k]) : ''));

/** Placeholders in a text that this alert type doesn't offer (typos such as {{po_numbr}}). */
export function unknownPlaceholders(text, type) {
  const allowed = new Set((ALERT_TYPES[type]?.tags ?? []).map((t) => t.tag));
  return [...new Set([...String(text ?? '').matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))].filter((k) => !allowed.has(k));
}

/** The retailer's saved templates merged over the built-in ones. */
export async function loadTemplates(tenantId) {
  const { data } = await supabase.from('alert_templates').select('alert_type, subject, body, cc_emails, bcc_emails').eq('tenant_id', tenantId);
  const saved = new Map((data ?? []).map((r) => [r.alert_type, r]));
  return Object.fromEntries(Object.entries(ALERT_TYPES).map(([type, d]) => [type, { subject: saved.get(type)?.subject ?? d.subject, body: saved.get(type)?.body ?? d.body, cc: saved.get(type)?.cc_emails ?? '', bcc: saved.get(type)?.bcc_emails ?? '', isDefault: !saved.has(type) }]));
}

/**
 * @param {'po_release_failed'|'ship_file_failed'} kind
 * @param {object} vars  values for the template placeholders
 * @param {{filename:string, content:string|Buffer, contentType?:string}[]} [attachments]
 */
export async function sendAlert({ tenantId, supplierId, kind, vars, attachments }) {
  try {
    if (!ALERT_TYPES[kind] || !supplierId) return { sent: false, reason: 'unknown alert' };
    const { data: s } = await supabase.from('supplier_alert_settings').select('enabled, emails, cc_emails, bcc_emails')
      .eq('tenant_id', tenantId).eq('supplier_id', supplierId).eq('alert_type', kind).maybeSingle();
    if (!s?.enabled) return { sent: false, reason: 'off for this supplier' };
    const { valid } = parseEmailList(s.emails);
    if (!valid.length) return { sent: false, reason: 'no recipients' };
    const t = (await loadTemplates(tenantId))[kind];
    // The retailer-wide CC / BCC for this alert (Settings) plus this supplier's own, without repeats
    const merge = (...lists) => [...new Set(lists.flatMap((l) => parseEmailList(l).valid))];
    const cc = merge(t.cc, s.cc_emails), bcc = merge(t.bcc, s.bcc_emails).filter((e) => !cc.includes(e));
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"Stock Buddy" <${process.env.SMTP_USER}>`, to: valid.join(', '), cc: cc.length ? cc.join(', ') : undefined, bcc: bcc.length ? bcc.join(', ') : undefined,
      subject: renderTemplate(t.subject, vars).replace(/\s+/g, ' ').trim(),
      text: renderTemplate(t.body, vars),
      attachments: attachments?.length ? attachments : undefined,
    });
    return { sent: true };
  } catch (err) {
    await logError({ source: 'alerts/sendAlert', error: err, tenantId, context: { kind, supplierId } }).catch(() => {});
    return { sent: false, reason: err.message };
  }
}
