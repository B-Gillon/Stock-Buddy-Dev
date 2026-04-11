// /src/lib/sendPOEmail.js
import nodemailer from 'nodemailer';
import { generatePOPdf, generatePOCsv } from '@/lib/generatePO';
import { supabase } from '@/lib/supabaseClient';

/**
 * Sends one email per transmission recipient record for the given PO.
 * Falls back to supplier.po_email (with both attachments) if no records exist.
 *
 * @param {string} poId
 * @param {{ isResend?: boolean }} options
 * @returns {{ success: boolean, error?: string }}
 */
export async function sendPOEmail(poId, { isResend = false } = {}) {

  // ── Fetch PO ───────────────────────────────────────────────────────────────
  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .select(`
      id, po_number, po_date, expected_date, status, notes_supplier,
      supplier:suppliers ( id, supplier_name, po_email ),
      location:locations ( name, address1, address2, city, province, zip, country )
    `)
    .eq('id', poId)
    .single();

  if (poError || !po) {
    return { success: false, error: 'PO not found' };
  }

  // ── Fetch transmission recipients ──────────────────────────────────────────
  const { data: recipients } = await supabase
    .from('supplier_transmission_recipients')
    .select('label, to_emails, cc_emails, bcc_emails, send_pdf, send_csv')
    .eq('supplier_id', po.supplier.id)
    .order('sort_order', { ascending: true });

  const hasRecipients = recipients && recipients.length > 0;
  const fallbackEmail = po.supplier?.po_email;

  if (!hasRecipients && !fallbackEmail) {
    return { success: false, error: 'No recipient email configured for this supplier' };
  }

  // ── Fetch lines ────────────────────────────────────────────────────────────
  const { data: lineRows, error: linesError } = await supabase
    .from('purchase_order_lines')
    .select(`
      line_no, sku, title, order_qty_units, unit_cost, extended_cost,
      supplier_variant:supplier_variants!purchase_order_lines_supplier_variant_id_fkey ( supplier_sku ),
      variant:variants!purchase_order_lines_variant_id_fkey ( barcode )
    `)
    .eq('purchase_order_id', poId)
    .order('line_no', { ascending: true });

  if (linesError) {
    return { success: false, error: 'Failed to fetch PO lines' };
  }

  const lines = (lineRows || []).map((l) => {
    const sv = Array.isArray(l.supplier_variant) ? l.supplier_variant[0] : l.supplier_variant;
    const v  = Array.isArray(l.variant)          ? l.variant[0]          : l.variant;
    return { ...l, supplier_sku: sv?.supplier_sku || '', supplier_barcode: v?.barcode || '' };
  });

  // ── Generate documents once ────────────────────────────────────────────────
  let csvBuffer, pdfBuffer;
  try {
    csvBuffer = generatePOCsv(po, lines);
    pdfBuffer = await generatePOPdf(po, lines, false);
  } catch (err) {
    console.error('Document generation error:', err);
    return { success: false, error: 'Failed to generate documents' };
  }

  // ── Email boilerplate ──────────────────────────────────────────────────────
  const filename  = `PO-${po.po_number}`;
  const subject   = isResend
    ? `Purchase Order ${po.po_number} (Resent)`
    : `Purchase Order ${po.po_number}`;
  const bodyText  = [
    `Dear ${po.supplier.supplier_name},`,
    '',
    isResend
      ? `Please find attached a resent copy of Purchase Order ${po.po_number}.`
      : `Please find attached Purchase Order ${po.po_number}.`,
    '',
    `PO Date: ${po.po_date ? new Date(po.po_date).toLocaleDateString('en-US') : ''}`,
    `Expected Date: ${po.expected_date ? new Date(po.expected_date).toLocaleDateString('en-US') : 'TBD'}`,
    '',
    'Please confirm receipt of this order.',
    '',
    'Thank you,',
    'Stock Buddy',
  ].join('\n');

  // ── Create transporter ─────────────────────────────────────────────────────
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  // ── Send emails ────────────────────────────────────────────────────────────
  try {
    if (!hasRecipients) {
      // Fallback — single email to supplier po_email with both attachments
      await transporter.sendMail({
        from:        `"Stock Buddy" <${process.env.SMTP_USER}>`,
        to:          fallbackEmail,
        subject,
        text:        bodyText,
        attachments: [
          { filename: `${filename}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
          { filename: `${filename}.csv`, content: csvBuffer, contentType: 'text/csv' },
        ],
      });
    } else {
      // One email per record
      for (const r of recipients) {
        const toList = (r.to_emails ?? '')
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);

        if (toList.length === 0) continue; // skip records with no To address

        const ccList = (r.cc_emails ?? '')
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);

        const bccList = (r.bcc_emails ?? '')
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);

        const attachments = [
          ...(r.send_pdf ? [{ filename: `${filename}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }] : []),
          ...(r.send_csv ? [{ filename: `${filename}.csv`, content: csvBuffer, contentType: 'text/csv'        }] : []),
        ];

        await transporter.sendMail({
          from:    `"Stock Buddy" <${process.env.SMTP_USER}>`,
          to:      toList.join(', '),
          cc:      ccList.length  > 0 ? ccList.join(', ')  : undefined,
          bcc:     bccList.length > 0 ? bccList.join(', ') : undefined,
          subject,
          text:    bodyText,
          attachments,
        });
      }
    }
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: `Email failed: ${err.message}` };
  }

  return { success: true };
}
