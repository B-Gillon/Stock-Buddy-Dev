// /src/app/api/purchase-orders/[id]/resend/route.js
import { supabase, setTenantContext } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { generatePOPdf, generatePOCsv } from '@/lib/generatePO';

export async function POST(request, { params }) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { id } = await params;

  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .select(`
      id, po_number, po_date, expected_date, status, notes_supplier,
      supplier:suppliers ( supplier_name, po_email ),
      location:locations ( name, address1, address2, city, province, zip, country )
    `)
    .eq('id', id)
    .single();

  if (poError || !po) {
    return NextResponse.json({ error: 'PO not found' }, { status: 404 });
  }

  const { data: lineRows, error: linesError } = await supabase
    .from('purchase_order_lines')
    .select(`
      line_no, sku, title, order_qty_units, unit_cost, extended_cost,
      supplier_variant:supplier_variants!purchase_order_lines_supplier_variant_id_fkey ( supplier_sku ),
      variant:variants!purchase_order_lines_variant_id_fkey ( barcode )
    `)
    .eq('purchase_order_id', id)
    .order('line_no', { ascending: true });

  if (linesError) {
    return NextResponse.json({ error: 'Failed to fetch lines' }, { status: 500 });
  }

  const lines = (lineRows || []).map(l => {
    const sv = Array.isArray(l.supplier_variant) ? l.supplier_variant[0] : l.supplier_variant;
    const v  = Array.isArray(l.variant)          ? l.variant[0]          : l.variant;
    return { ...l, supplier_sku: sv?.supplier_sku || '', supplier_barcode: v?.barcode || '' };
  });

  let csvBuffer, pdfBuffer;
  try {
    csvBuffer = generatePOCsv(po, lines);
    pdfBuffer = await generatePOPdf(po, lines, false);
  } catch (err) {
    console.error('Document generation error:', err);
    return NextResponse.json({ error: 'Failed to generate documents' }, { status: 500 });
  }

  const supplierEmail = po.supplier?.po_email;
  if (!supplierEmail) {
    return NextResponse.json({ error: 'No supplier PO email configured' }, { status: 400 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const filename = `PO-${po.po_number}`;
    await transporter.sendMail({
      from:    `"Stock Buddy" <${process.env.SMTP_USER}>`,
      to:      supplierEmail,
      subject: `Purchase Order ${po.po_number} (Resent)`,
      text: [
        `Dear ${po.supplier.supplier_name},`,
        '',
        `Please find attached a resent copy of Purchase Order ${po.po_number}.`,
        '',
        `PO Date: ${po.po_date ? new Date(po.po_date).toLocaleDateString('en-US') : ''}`,
        `Expected Date: ${po.expected_date ? new Date(po.expected_date).toLocaleDateString('en-US') : 'TBD'}`,
        '',
        'Please confirm receipt of this order.',
        '',
        'Thank you,',
        'Stock Buddy',
      ].join('\n'),
      attachments: [
        { filename: `${filename}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
        { filename: `${filename}.csv`, content: csvBuffer, contentType: 'text/csv' },
      ],
    });
  } catch (err) {
    console.error('Resend email error:', err);
    return NextResponse.json({ error: `Email failed: ${err.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
