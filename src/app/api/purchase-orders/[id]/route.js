// /src/app/api/purchase-orders/[id]/route.js
import { NextResponse } from 'next/server';
import { supabase, setTenantContext } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';

export async function PATCH(request, { params }) {
  try {
    const tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);

    const { id } = await params;
    const body = await request.json();
    const { header, lines } = body;

    const headerUpdate = {
      po_date:        header.po_date,
      expected_date:  header.expected_date || null,
      notes_internal: header.notes_internal || null,
      notes_supplier: header.notes_supplier || null,
      updated_at:     new Date().toISOString(),
    };
    if (header.status === 'released' && header.released_at) {
      headerUpdate.released_at = header.released_at;
    }
    if (header.status === 'cancelled' && header.cancelled_at) {
      headerUpdate.cancelled_at = header.cancelled_at;
    }

    const { error: poError } = await supabase
      .from('purchase_orders')
      .update(headerUpdate)
      .eq('id', id);
    if (poError) throw poError;

    const { error: deleteError } = await supabase
      .from('purchase_order_lines')
      .delete()
      .eq('purchase_order_id', id);
    if (deleteError) throw deleteError;

    if (lines && lines.length > 0) {
      const lineInserts = lines.map((line, index) => ({
        tenant_id:           tenantId,
        purchase_order_id:   id,
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
      if (linesError) throw linesError;
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[PATCH /api/purchase-orders/[id]]', err);
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);

    const { id } = await params;

    const { data: po, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !po) {
      return NextResponse.json({ error: 'PO not found' }, { status: 404 });
    }

    if (po.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft POs can be deleted' }, { status: 400 });
    }

    const { error: linesError } = await supabase
      .from('purchase_order_lines')
      .delete()
      .eq('purchase_order_id', id);
    if (linesError) {
      return NextResponse.json({ error: 'Failed to delete PO lines' }, { status: 500 });
    }

    const { error: poError } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', id);
    if (poError) {
      return NextResponse.json({ error: 'Failed to delete PO' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/purchase-orders/[id]]', err);
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
  }
}
