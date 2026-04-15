// /src/lib/sendPOEmail.js
import nodemailer from 'nodemailer';
import { generatePOPdf, generatePOCsv } from '@/lib/generatePO';
import { supabase } from '@/lib/supabaseClient';

/**
 * Sends one email per transmission recipient record for the given PO.
 * Falls back to supplier.po_email (with both attachments) if no records exist.
 *
 * @param {string} poId
 * @param {{ isResend?: boolean, isCancellation?: boolean }} options
 * @returns {{ success: boolean, error?: string }}
 */
export async function sendPOEmail(poId, { isResend = false, isCancellation = false } = {}) {

  // ── Fetch PO ───────────────────────────────────────────────────────────────
  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .select(`
      id, po_number, po_date, expected_date, status, notes_supplier, ship_to_location_id,
      supplier:suppliers ( id, supplier_name, supplier_number, po_email ),
      location:locations ( name, address1, address2, city, province, zip, country )
    `)
    .eq('id', poId)
    .single();

  if (poError || !po) {
    return { success: false, error: 'PO not found' };
  }

  // ── Fetch CSV settings for this supplier ───────────────────────────────────
  let csvSettings = null;
  try {
    const { data: supplierCsvData } = await supabase
      .from('supplier_csv_settings')
      .select('*')
      .eq('supplier_id', po.supplier.id)
      .single();

    if (supplierCsvData && !supplierCsvData.use_global) {
      const COLUMN_MAP = {
        po_number: 'csv_export.po_number', supplier_name: 'csv_export.supplier_name',
        supplier_number: 'csv_export.supplier_number',
        ship_to_name: 'csv_export.ship_to_name', ship_to_address: 'csv_export.ship_to_address',
        po_date: 'csv_export.po_date', expected_date: 'csv_export.expected_date',
        notes_supplier: 'csv_export.notes_supplier', line_no: 'csv_export.line_no',
        sku: 'csv_export.sku', title: 'csv_export.title', quantity: 'csv_export.quantity',
        unit_cost: 'csv_export.unit_cost', supplier_sku: 'csv_export.supplier_sku',
        barcode: 'csv_export.barcode', extended_cost: 'csv_export.extended_cost',
        bin_location: 'csv_export.bin_location', product_tags: 'csv_export.product_tags',
        weight_value: 'csv_export.weight_value', total_weight: 'csv_export.total_weight',
        weight_unit: 'csv_export.weight_unit', retail_price: 'csv_export.retail_price',
        current_stock: 'csv_export.current_stock',
        total_stock_all_locations: 'csv_export.total_stock_all_locations',
      };
      csvSettings = {};
      for (const [col, key] of Object.entries(COLUMN_MAP)) {
        if (col in supplierCsvData) csvSettings[key] = supplierCsvData[col];
      }
    } else {
      const { data: globalRows } = await supabase
        .from('settings')
        .select('key, value')
        .like('key', 'csv_export.%');

      if (globalRows && globalRows.length > 0) {
        csvSettings = {};
        for (const row of globalRows) {
          csvSettings[row.key] = row.value === 'true';
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch CSV settings, using defaults:', e.message);
    csvSettings = null;
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

  // ── For cancellation emails, send a plain text notice (no attachments) ─────
  if (isCancellation) {
    const subject  = `CANCELLED: Purchase Order ${po.po_number}`;
    const bodyText = [
      `Dear ${po.supplier.supplier_name},`,
      '',
      `Please be advised that Purchase Order ${po.po_number} has been cancelled.`,
      '',
      `PO Date: ${po.po_date ? new Date(po.po_date).toLocaleDateString('en-US') : ''}`,
      '',
      'If you have any questions, please contact us.',
      '',
      'Thank you,',
      'Stock Buddy',
    ].join('\n');

    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    try {
      if (!hasRecipients) {
        await transporter.sendMail({
          from:    `"Stock Buddy" <${process.env.SMTP_USER}>`,
          to:      fallbackEmail,
          subject,
          text:    bodyText,
        });
      } else {
        for (const r of recipients) {
          const toList  = (r.to_emails  ?? '').split(',').map((e) => e.trim()).filter(Boolean);
          if (toList.length === 0) continue;
          const ccList  = (r.cc_emails  ?? '').split(',').map((e) => e.trim()).filter(Boolean);
          const bccList = (r.bcc_emails ?? '').split(',').map((e) => e.trim()).filter(Boolean);
          await transporter.sendMail({
            from:    `"Stock Buddy" <${process.env.SMTP_USER}>`,
            to:      toList.join(', '),
            cc:      ccList.length  > 0 ? ccList.join(', ')  : undefined,
            bcc:     bccList.length > 0 ? bccList.join(', ') : undefined,
            subject,
            text:    bodyText,
          });
        }
      }
    } catch (err) {
      console.error('Cancellation email send error:', err);
      return { success: false, error: `Email failed: ${err.message}` };
    }

    return { success: true };
  }

  // ── Fetch lines (for normal / resend emails) ───────────────────────────────
  const { data: lineRows, error: linesError } = await supabase
    .from('purchase_order_lines')
    .select(`
      id, line_no, sku, title, order_qty_units, unit_cost, extended_cost,
      variant_id, supplier_variant_id,
      supplier_variant:supplier_variants!purchase_order_lines_supplier_variant_id_fkey (
        supplier_sku
      ),
      variant:variants!purchase_order_lines_variant_id_fkey (
        barcode, weight_value, weight_unit, price,
        products ( tags )
      )
    `)
    .eq('purchase_order_id', poId)
    .order('line_no', { ascending: true });

  if (linesError) {
    return { success: false, error: 'Failed to fetch PO lines' };
  }

  const variantIds = (lineRows || []).map((l) => l.variant_id).filter(Boolean);

  // ── Fetch bin locations ────────────────────────────────────────────────────
  let binLocationMap = {};
  const binEnabled = csvSettings ? !!csvSettings['csv_export.bin_location'] : false;
  if (binEnabled && po.ship_to_location_id && variantIds.length > 0) {
    const { data: bins } = await supabase
      .from('variant_location_bins')
      .select('variant_id, bin_location')
      .eq('location_id', po.ship_to_location_id)
      .in('variant_id', variantIds);
    for (const b of bins ?? []) {
      binLocationMap[b.variant_id] = b.bin_location;
    }
  }

  // ── Fetch inventory levels for stock fields ────────────────────────────────
  let currentStockMap = {};
  let totalStockMap   = {};

  const stockEnabled = csvSettings
    ? (!!csvSettings['csv_export.current_stock'] || !!csvSettings['csv_export.total_stock_all_locations'])
    : false;

  if (stockEnabled && variantIds.length > 0) {
    const { data: invItems } = await supabase
      .from('inventory_items')
      .select('id, variant_id')
      .in('variant_id', variantIds);

    const invItemIds = (invItems ?? []).map((i) => i.id);
    const variantByInvItem = {};
    for (const i of invItems ?? []) variantByInvItem[i.id] = i.variant_id;

    if (invItemIds.length > 0) {
      const { data: allLevels } = await supabase
        .from('inventory_levels')
        .select('inventory_item_id, available')
        .in('inventory_item_id', invItemIds);

      for (const level of allLevels ?? []) {
        const vid = variantByInvItem[level.inventory_item_id];
        if (vid) totalStockMap[vid] = (totalStockMap[vid] ?? 0) + (level.available ?? 0);
      }

      if (po.ship_to_location_id) {
        const { data: shipToLevels } = await supabase
          .from('inventory_levels')
          .select('inventory_item_id, available')
          .eq('location_id', po.ship_to_location_id)
          .in('inventory_item_id', invItemIds);

        for (const level of shipToLevels ?? []) {
          const vid = variantByInvItem[level.inventory_item_id];
          if (vid) currentStockMap[vid] = level.available ?? 0;
        }
      }
    }
  }

  // ── Build flat lines ───────────────────────────────────────────────────────
  const lines = (lineRows || []).map((l) => {
    const sv = Array.isArray(l.supplier_variant) ? l.supplier_variant[0] : l.supplier_variant;
    const v  = Array.isArray(l.variant)          ? l.variant[0]          : l.variant;
    const weightVal   = v?.weight_value ?? null;
    const weightUnit  = v?.weight_unit  ?? null;
    const totalWeight = weightVal != null && l.order_qty_units != null
      ? Number(weightVal) * Number(l.order_qty_units)
      : null;
    return {
      ...l,
      supplier_sku:              sv?.supplier_sku                   || '',
      supplier_barcode:          v?.barcode                         || '',
      bin_location:              binLocationMap[l.variant_id]       || '',
      product_tags:              (v?.products?.tags || []).join(', '),
      weight_value:              weightVal,
      weight_unit:               weightUnit,
      total_weight:              totalWeight,
      retail_price:              v?.price                           ?? null,
      current_stock:             currentStockMap[l.variant_id]      ?? 0,
      total_stock_all_locations: totalStockMap[l.variant_id]        ?? 0,
    };
  });

  // ── Generate documents once ────────────────────────────────────────────────
  let csvBuffer, pdfBuffer;
  try {
    csvBuffer = generatePOCsv(po, lines, csvSettings);
    pdfBuffer = await generatePOPdf(po, lines, false);
  } catch (err) {
    console.error('Document generation error:', err);
    return { success: false, error: 'Failed to generate documents' };
  }

  // ── Email boilerplate ──────────────────────────────────────────────────────
  const filename = `PO-${po.po_number}`;
  const subject  = isResend
    ? `Purchase Order ${po.po_number} (Resent)`
    : `Purchase Order ${po.po_number}`;
  const bodyText = [
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
      for (const r of recipients) {
        const toList  = (r.to_emails  ?? '').split(',').map((e) => e.trim()).filter(Boolean);
        if (toList.length === 0) continue;
        const ccList  = (r.cc_emails  ?? '').split(',').map((e) => e.trim()).filter(Boolean);
        const bccList = (r.bcc_emails ?? '').split(',').map((e) => e.trim()).filter(Boolean);
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
