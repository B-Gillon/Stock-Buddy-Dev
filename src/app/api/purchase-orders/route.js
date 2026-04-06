// /src/app/api/purchase-orders/route.js
import { NextResponse } from 'next/server';
import { supabase, setTenantContext } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';

export async function POST(request) {
  try {
    const tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);

    const body = await request.json();
    const { header, lines } = body;

    if (!header?.supplier_id) {
      return NextResponse.json({ error: 'Supplier is required' }, { status: 400 });
    }
    if (!header?.po_date) {
      return NextResponse.json({ error: 'PO Date is required' }, { status: 400 });
    }
    if (!lines || lines.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });
    }

    const datePart = new Date(header.po_date).toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const po_number = `PO-${datePart}-${rand}`;

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        tenant_id:           tenantId,
        po_number,
        supplier_id:         header.supplier_id,
        ship_to_location_id: header.ship_to_location_id || null,
        status:              'draft',
        po_date:             header.po_date,
        expected_date:       header.expected_date || null,
        notes_internal:      header.notes_internal || null,
        notes_supplier:      header.notes_supplier || null,
        currency_code:       'USD',
      })
      .select('id, po_number')
      .single();

    if (poError) throw poError;

    const lineInserts = lines.map((line, index) => ({
      tenant_id:           tenantId,
      purchase_order_id:   po.id,
      line_no:             index + 1,
      variant_id:          line.variant_id,
      supplier_variant_id: line.supplier_variant_id ?? null,
      sku:                 line.sku ?? null,
      title:               line.title ?? null,
      order_qty_units:     Number.isFinite(line.order_qty_units) ? line.order_qty_units : 0,
      order_qty_cases:     line.order_qty_cases ?? null,
      case_pack_qty:       line.case_pack_qty ?? null,
      unit_cost:           line.unit_cost ?? null,
      extended_cost:       line.extended_cost ?? null,
    }));

    const { error: linesError } = await supabase
      .from('purchase_order_lines')
      .insert(lineInserts);

    if (linesError) {
      console.error('[POST /api/purchase-orders] lines insert error:', linesError);
      await supabase.from('purchase_orders').delete().eq('id', po.id);
      throw new Error(`Failed to save line items: ${linesError.message}`);
    }

    return NextResponse.json({ id: po.id, slug: po.po_number }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/purchase-orders]', err);
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
  }
}
