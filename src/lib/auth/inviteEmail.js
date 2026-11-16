// /src/lib/auth/inviteEmail.js
import nodemailer from 'nodemailer';
import { buildEmailHtml } from '@/lib/email/buildEmailHtml';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function appUrl(path) {
  return `${String(process.env.SHOPIFY_APP_URL || '').replace(/\/+$/, '')}${path}`;
}

/**
 * kind: 'invite' (new user) or 'reset' (forgot password).
 * @returns {Promise<void>} throws if the email can't be sent
 */
export async function sendPasswordLinkEmail({ to, link, kind, retailerName, supplierName }) {
  const isInvite = kind === 'invite';
  const who = supplierName
    ? `as a user for ${esc(supplierName)} with ${esc(retailerName || 'your customer')}`
    : `for ${esc(retailerName || 'Stock Buddy')}`;
  const subject = isInvite ? 'You have been invited to Stock Buddy' : 'Reset your Stock Buddy password';
  const lead = isInvite
    ? `You have been invited to Stock Buddy ${who}. Create your password to get started.`
    : 'We received a request to reset your Stock Buddy password. If this was you, choose a new password below. If not, you can ignore this email.';
  const expires = isInvite ? '7 days' : '1 hour';

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">${lead}</p>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr>
      <td style="border-radius:6px;background-color:#2563eb;">
        <a href="${link}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">
          ${isInvite ? 'Create your password' : 'Choose a new password'}
        </a>
      </td></tr></table>
    <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;">This link works once and expires in ${expires}.</p>
    <p style="margin:0;font-size:12px;color:#6b7280;">Or copy this link: <a href="${link}" style="color:#2563eb;">${link}</a></p>`;

  const text = `${lead.replace(/<[^>]+>/g, '')}\n\n${link}\n\nThis link works once and expires in ${expires}.`;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: `"Stock Buddy" <${process.env.SMTP_USER}>`,
    to, subject, text, html: buildEmailHtml({ bodyHtml }),
  });
}
