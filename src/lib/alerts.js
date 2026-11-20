// /src/lib/alerts.js
// Email alerts to the retailer's own team (Settings -> Email Alerts). Never throws: an alert that can't be
// sent must not break the work that triggered it. Server-side only.
import nodemailer from 'nodemailer';
import { supabase } from '@/lib/supabaseClient';
import { logError } from '@/lib/logError';

export const ALERT_KINDS = { po_release_failed: 'alert_po_release_failed', ship_file_failed: 'alert_ship_file_failed' };
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Splits a typed list (commas, semicolons, spaces, new lines) into valid addresses and rejects. */
export function parseEmailList(text) {
  const parts = String(text ?? '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  return { valid: [...new Set(parts.filter((p) => EMAIL_RE.test(p)))], invalid: parts.filter((p) => !EMAIL_RE.test(p)) };
}

/** @param {'po_release_failed'|'ship_file_failed'} kind */
export async function sendAlert({ tenantId, kind, subject, lines }) {
  try {
    const col = ALERT_KINDS[kind];
    if (!col) return { sent: false, reason: 'unknown kind' };
    const { data: s } = await supabase.from('tenant_alert_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
    // Alerts default to on; they only go out once someone has entered an address
    if (!s || s[col] === false) return { sent: false, reason: 'off' };
    const { valid } = parseEmailList(s.alert_emails);
    if (!valid.length) return { sent: false, reason: 'no recipients' };
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"Stock Buddy" <${process.env.SMTP_USER}>`, to: valid.join(', '),
      subject: `[Stock Buddy alert] ${subject}`,
      text: [...lines, '', 'You get this because Email Alerts is turned on in Stock Buddy (Settings → Email Alerts).'].join('\n'),
    });
    return { sent: true };
  } catch (err) {
    await logError({ source: 'alerts/sendAlert', error: err, tenantId, context: { kind } }).catch(() => {});
    return { sent: false, reason: err.message };
  }
}
