// /src/lib/acknowledgements.js
// PO acknowledgement: request creation (when a PO is emailed), the public recap + submit,
// cancellation, and the reminder sweep.
import nodemailer from 'nodemailer';
import { supabase } from '@/lib/supabaseClient';
import { logPOActivity } from '@/lib/logPOActivity';
import { addBusinessDays } from '@/lib/businessDays';
import { buildAckUrl, verifyAckToken, checkRenderStamp } from '@/lib/ackLink';

const splitEmails = (s) => String(s ?? '').split(',').map((e) => e.trim()).filter(Boolean);
const fmtDate = (d) => {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return y && m && day ? `${m}/${day}/${y.slice(2)}` : '';
};

/**
 * Called when a PO email goes out. Creates the acknowledgement request, or reuses the open one
 * (so a resend never creates a second pending request). Returns the row, or null on failure.
 */
export async function ensureAckRequest({ poId, tenantId, supplierId, recipientEmails, settings }) {
  try {
    const days = settings?.ack_reminder_days ?? null;
    const dueAt = days ? addBusinessDays(new Date(), days).toISOString() : null;
    const recipients = [...new Set(recipientEmails.map((e) => e.trim()).filter(Boolean))].join(', ');

    const { data: open } = await supabase
      .from('po_acknowledgements')
      .select('*')
      .eq('po_id', poId)
      .eq('status', 'pending')
      .maybeSingle();

    if (open) {
      // Resend: keep the same link and the original reminder clock, refresh who it went to.
      const { data } = await supabase
        .from('po_acknowledgements')
        .update({ recipient_emails: recipients, reminder_cc: settings?.ack_reminder_cc || null })
        .eq('id', open.id)
        .select('*')
        .single();
      return { ...(data ?? open), created: false };
    }

    const { data, error } = await supabase
      .from('po_acknowledgements')
      .insert({
        tenant_id: tenantId,
        po_id: poId,
        supplier_id: supplierId,
        status: 'pending',
        recipient_emails: recipients,
        reminder_due_at: dueAt,
        reminder_cc: settings?.ack_reminder_cc || null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return { ...data, created: true };
  } catch (err) {
    console.error('[ensureAckRequest] failed:', err);
    return null;
  }
}

/** Marks any open request for the PO as cancelled (PO cancelled). */
export async function cancelAckForPO(poId) {
  const { error } = await supabase
    .from('po_acknowledgements')
    .update({ status: 'cancelled', reminder_due_at: null })
    .eq('po_id', poId)
    .eq('status', 'pending');
  if (error) console.error('[cancelAckForPO] failed:', error);
}

/**
 * Everything the public page needs for a token: the request state plus a recap of the PO.
 * Returns { state: 'invalid' } for a bad token.
 */
export async function loadAckForToken(token) {
  const ackId = verifyAckToken(token);
  if (!ackId) return { state: 'invalid' };

  const { data: ack } = await supabase.from('po_acknowledgements').select('*').eq('id', ackId).maybeSingle();
  if (!ack) return { state: 'invalid' };

  const { data: po } = await supabase
    .from('purchase_orders')
    .select(`
      id, tenant_id, po_number, po_date, expected_date, status, currency_code, notes_supplier,
      supplier:suppliers ( supplier_name ),
      location:locations ( name, address1, address2, city, province, zip, country )
    `)
    .eq('id', ack.po_id)
    .single();
  if (!po) return { state: 'invalid' };

  const { data: tenant } = await supabase.from('tenants').select('shop_name').eq('id', po.tenant_id).maybeSingle();
  const { data: lines } = await supabase
    .from('purchase_order_lines')
    .select('line_no, sku, title, order_qty_units, unit_cost, extended_cost')
    .eq('purchase_order_id', po.id)
    .order('line_no', { ascending: true });

  const supplier = Array.isArray(po.supplier) ? po.supplier[0] : po.supplier;
  const loc = Array.isArray(po.location) ? po.location[0] : po.location;
  const lineList = (lines ?? []).map((l) => ({
    lineNo: l.line_no, sku: l.sku || '', title: l.title || '',
    qty: Number(l.order_qty_units ?? 0),
    unitCost: l.unit_cost == null ? null : Number(l.unit_cost),
    extended: l.extended_cost == null ? null : Number(l.extended_cost),
  }));
  const total = lineList.reduce((s, l) => s + (l.extended ?? (l.unitCost ?? 0) * l.qty), 0);

  const cancelledPO = po.status === 'cancelled';
  const state = ack.status === 'acknowledged' ? 'acknowledged'
    : (ack.status === 'cancelled' || cancelledPO) ? 'cancelled'
    : 'pending';

  return {
    state,
    ackId,
    acknowledgedBy: ack.acknowledged_by || null,
    acknowledgedAt: ack.acknowledged_at || null,
    expectedShipDate: ack.expected_ship_date || null,
    po: {
      number: po.po_number,
      date: po.po_date || null,
      requestedDate: po.expected_date || null,
      currency: po.currency_code || 'USD',
      notes: po.notes_supplier || '',
      retailer: tenant?.shop_name || '',
      supplierName: supplier?.supplier_name || '',
      shipTo: loc ? {
        name: loc.name || '',
        lines: [loc.address1, loc.address2, [loc.city, loc.province, loc.zip].filter(Boolean).join(', '), loc.country].filter(Boolean),
      } : null,
      lines: lineList,
      total,
    },
  };
}

/**
 * Supplier clicked Acknowledge. Only the first submission wins (conditional update on 'pending').
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export async function submitAck({ token, name, shipDate, stamp, website, ip, userAgent }) {
  // Honeypot: a hidden field real people never fill in. Pretend success so bots learn nothing.
  if (website) return { ok: true };

  const ackId = verifyAckToken(token);
  if (!ackId) return { ok: false, code: 'invalid', error: 'This link is not valid.' };
  if (!checkRenderStamp(ackId, stamp)) {
    return { ok: false, code: 'retry', error: 'Please wait a moment and try again.' };
  }

  const cleanName = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (cleanName.length < 2 || cleanName.length > 100) {
    return { ok: false, code: 'name', error: 'Please enter your name (2 to 100 characters).' };
  }

  let ship = null;
  if (shipDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(shipDate) || Number.isNaN(Date.parse(`${shipDate}T00:00:00Z`))) {
      return { ok: false, code: 'date', error: 'The expected shipping date is not a valid date.' };
    }
    ship = shipDate;
  }

  const { data: ack } = await supabase.from('po_acknowledgements').select('*').eq('id', ackId).maybeSingle();
  if (!ack) return { ok: false, code: 'invalid', error: 'This link is not valid.' };
  if (ack.status === 'acknowledged') return { ok: false, code: 'already', error: 'This order has already been acknowledged.' };

  const { data: po } = await supabase.from('purchase_orders').select('status').eq('id', ack.po_id).single();
  if (ack.status === 'cancelled' || po?.status === 'cancelled') {
    return { ok: false, code: 'cancelled', error: 'This purchase order has been cancelled.' };
  }

  const { data: updated, error } = await supabase
    .from('po_acknowledgements')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: cleanName,
      expected_ship_date: ship,
      ack_ip: ip || null,
      ack_user_agent: String(userAgent ?? '').slice(0, 300) || null,
      reminder_due_at: null,
    })
    .eq('id', ackId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[submitAck] update failed:', error);
    return { ok: false, code: 'error', error: 'Something went wrong. Please try again.' };
  }
  if (!updated) return { ok: false, code: 'already', error: 'This order has already been acknowledged.' };

  await logPOActivity({
    poId: ack.po_id,
    tenantId: ack.tenant_id,
    action: 'acknowledged',
    userName: cleanName,
    comments: `Acknowledged by ${cleanName} via emailed link${ship ? `; expected ship date ${fmtDate(ship)}` : ''}`,
  });
  return { ok: true };
}

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

/** Email body shared by the first email's HTML part and the reminder. */
export function ackButtonHtml(url) {
  return `<p style="margin:24px 0"><a href="${url}" style="background:#1a1a1a;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-family:Arial,sans-serif">Acknowledge this order</a></p>`
    + `<p style="font-size:12px;color:#666;font-family:Arial,sans-serif">Or copy this link into your browser:<br>${url}</p>`;
}

/**
 * Sends reminders for requests whose business-day deadline has passed. Each request is claimed
 * atomically (reminder_sent_at) so overlapping runs can't double-send; a failed send releases the claim.
 */
export async function sendDueReminders() {
  const result = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  const { data: due, error } = await supabase
    .from('po_acknowledgements')
    .select('id')
    .eq('status', 'pending')
    .is('reminder_sent_at', null)
    .not('reminder_due_at', 'is', null)
    .lte('reminder_due_at', new Date().toISOString())
    .limit(100);
  if (error) { console.error('[sendDueReminders] query failed:', error); return { ...result, error: error.message }; }

  for (const { id } of due ?? []) {
    result.checked += 1;
    const claimedAt = new Date().toISOString();
    const { data: ack } = await supabase
      .from('po_acknowledgements')
      .update({ reminder_sent_at: claimedAt })
      .eq('id', id).eq('status', 'pending').is('reminder_sent_at', null)
      .select('*')
      .maybeSingle();
    if (!ack) { result.skipped += 1; continue; }

    try {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('po_number, status, supplier:suppliers ( supplier_name )')
        .eq('id', ack.po_id).single();

      if (!po || po.status === 'cancelled' || po.status === 'received' || po.status === 'closed') {
        await supabase.from('po_acknowledgements')
          .update({ status: 'cancelled', reminder_due_at: null }).eq('id', id);
        result.skipped += 1;
        continue;
      }

      const to = splitEmails(ack.recipient_emails);
      if (to.length === 0) throw new Error('No recipients stored for this request');
      const cc = splitEmails(ack.reminder_cc);
      const supplier = Array.isArray(po.supplier) ? po.supplier[0] : po.supplier;
      const url = buildAckUrl(ack.id);

      const text = [
        `Dear ${supplier?.supplier_name || 'Supplier'},`,
        '',
        `This is a reminder that Purchase Order ${po.po_number} has not been acknowledged yet.`,
        'Please confirm you have received it using the link below:',
        '',
        url,
        '',
        'Thank you,',
        'Stock Buddy',
      ].join('\n');
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">`
        + `<p>Dear ${escapeHtml(supplier?.supplier_name || 'Supplier')},</p>`
        + `<p>This is a reminder that Purchase Order <strong>${escapeHtml(po.po_number)}</strong> has not been acknowledged yet.</p>`
        + ackButtonHtml(url)
        + `<p>Thank you,<br>Stock Buddy</p></div>`;

      await transporter().sendMail({
        from: `"Stock Buddy" <${process.env.SMTP_USER}>`,
        to: to.join(', '),
        cc: cc.length ? cc.join(', ') : undefined,
        subject: `Reminder: please acknowledge Purchase Order ${po.po_number}`,
        text, html,
      });

      await logPOActivity({
        poId: ack.po_id, tenantId: ack.tenant_id, action: 'reminder_sent', userName: 'System',
        comments: `Acknowledgement reminder emailed to ${to.join(', ')}${cc.length ? `; cc: ${cc.join(', ')}` : ''}`,
      });
      result.sent += 1;
    } catch (err) {
      console.error('[sendDueReminders] send failed:', err);
      await supabase.from('po_acknowledgements').update({ reminder_sent_at: null }).eq('id', id);
      result.failed += 1;
    }
  }
  return result;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
