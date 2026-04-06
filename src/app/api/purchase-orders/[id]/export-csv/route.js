// /src/app/api/purchase-orders/[id]/export-csv/route.js
import { supabase, setTenantContext } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { id } = await params;

  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .select(`
      id, po_number, po_date, expected_date, notes_supplier,
      supplier:suppliers ( supplier_name ),
      location:locations ( name, address1, address2, city, province, zip, country )
    `)
    .eq('id', id)
    .single();

  if (poError || !po) {
    return NextResponse.json({ error: 'PO not found' }, { status: 404 });
  }

  const { data: lines, error: linesError } = await supabase
    .from('purchase_order_lines')
    .select(`
      line_no, sku, title, order_qty_units, unit_cost, extended_cost,
      supplier_variant:supplier_variants ( supplier_sku, supplier_barcode )
    `)
    .eq('purchase_order_id', id)
    .order('line_no', { ascending: true });

  if (linesError) {
    return NextResponse.json({ error: 'Failed to fetch lines' }, { status: 500 });
  }

  const fmt     = (val) => (val == null ? '' : String(val));
  const fmtNum  = (val) => {
    if (val == null) return '';
    const str = String(val);
    if (/^\d/.test(str) && str.startsWith('0')) return `"${str}"`;
    return str;
  };
  const fmtZip  = (val) => (val == null ? '' : `"${String(val)}"`);
  const fmtDate = (val) => {
    if (!val) return '';
    const d = new Date(val.includes('T') ? val : `${val}T00:00:00`);
    return isNaN(d) ? '' : d.toLocaleDateString('en-US');
  };
  const fmtCost = (val) => (val == null ? '' : Number(val).toFixed(2));
  const extended = (line) => {
    if (line.extended_cost != null) return fmtCost(line.extended_cost);
    if (line.unit_cost != null && line.order_qty_units != null) {
      return fmtCost(Number(line.unit_cost) * Number(line.order_qty_units));
    }
    return '';
  };

  const loc  = po.location ?? {};
  const rows = [];
  const BOM  = '\uFEFF';

  rows.push(['PO Number','PO Date','Expected Date','Supplier Name','Ship To Name','Ship To Address1','Ship To Address2','Ship To City','Ship To Province','Ship To Zip','Ship To Country','Notes'].join(','));
  rows.push([fmt(po.po_number),fmtDate(po.po_date),fmtDate(po.expected_date),fmt(po.supplier?.supplier_name),fmt(loc.name),fmt(loc.address1),fmt(loc.address2),fmt(loc.city),fmt(loc.province),fmtZip(loc.zip),fmt(loc.country),fmt(po.notes_supplier)].join(','));
  rows.push(['Line No','SKU','Supplier SKU','Supplier Barcode','Title','Order Qty Units','Unit Cost','Extended Cost'].join(','));

  for (const line of lines ?? []) {
    const sv = line.supplier_variant ?? {};
    rows.push([
      fmt(line.line_no),
      fmtNum(line.sku),
      fmtNum(sv.supplier_sku),
      fmtNum(sv.supplier_barcode),
      `"${(line.title ?? '').replace(/"/g, '""')}"`,
      fmt(line.order_qty_units),
      fmtCost(line.unit_cost),
      extended(line),
    ].join(','));
  }

  const csv      = BOM + rows.join('\r\n');
  const filename = `PO-${po.po_number}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
