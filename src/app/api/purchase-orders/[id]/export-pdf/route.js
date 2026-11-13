// /src/app/api/purchase-orders/[id]/export-pdf/route.js
import { supabase, setTenantContext } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { NextResponse } from 'next/server';
import { generatePOPdf } from '@/lib/generatePO';
import { logError } from '@/lib/logError';
import { getTransmissionSettings } from '@/lib/transmissionSettings';
import { buildPOFileBase } from '@/lib/poFileName';

export async function GET(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);
    const { id } = await params;

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select(`id, po_number, po_date, expected_date, status, notes_supplier, supplier:suppliers(id, supplier_name, supplier_number), location:locations(name, address1, address2, city, province, zip, country)`)
      .eq('id', id).single();

    if (poError || !po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });

    const { data: lineRows, error: linesError } = await supabase
      .from('purchase_order_lines')
      .select(`line_no, sku, title, order_qty_units, unit_cost, extended_cost, supplier_variant:supplier_variants!purchase_order_lines_supplier_variant_id_fkey(supplier_sku), variant:variants!purchase_order_lines_variant_id_fkey(barcode)`)
      .eq('purchase_order_id', id).order('line_no', { ascending: true });

    if (linesError) throw linesError;

    const lines = (lineRows || []).map(l => {
      const sv = Array.isArray(l.supplier_variant) ? l.supplier_variant[0] : l.supplier_variant;
      const v  = Array.isArray(l.variant) ? l.variant[0] : l.variant;
      return { ...l, supplier_sku: sv?.supplier_sku || '', supplier_barcode: v?.barcode || '' };
    });

    const { data: settingsRows } = await supabase.from('settings').select('key, value').in('key', ['pdf.contact_name', 'pdf.contact_email', 'pdf.contact_phone']);
    const settings = Object.fromEntries((settingsRows || []).map(r => [r.key, r.value || '']));

    const pdfBuffer = await generatePOPdf({
      ...po,
      contact_name:  settings['pdf.contact_name'],
      contact_email: settings['pdf.contact_email'],
      contact_phone: settings['pdf.contact_phone'],
    }, lines, po.status !== 'released');

    const naming = await getTransmissionSettings(po.supplier?.id);
    const fileBase = buildPOFileBase(naming.file_name_pattern, {
      poNumber: po.po_number, supplierNumber: po.supplier?.supplier_number, poDate: po.po_date,
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileBase}.pdf"` },
    });
  } catch (err) {
    await logError({ source: 'api/purchase-orders/[id]/export-pdf', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
