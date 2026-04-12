// /src/app/api/purchase-orders/[id]/route.js
import { NextResponse } from 'next/server';
import { supabase, setTenantContext } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logPOActivity } from '@/lib/logPOActivity';
import { logError } from '@/lib/logError';

export async function PATCH(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
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
    if (header.status === 'released' && header.released_at) headerUpdate.released_at = header.released_at;
    if (header.status === 'cancelled' && header.cancelled_at) headerUpdate.cancelled_at = header.cancelled_at;

    const { error: poError } = await supabase.from('purchase_orders').update(headerUpdate).eq('id', id);
    if (poError) throw poError;

    if (lines !== undefined) {
      const { data: currentLines } = await supabase.from('purchase_order_lines').select('id, variant_id, received_qty_units').eq('purchase_order_id', id);
      const existingByVariant = new Map((currentLines ?? []).map((l) => [l.variant_id, l.id]));
      const incomingVariantIds = new Set((lines ?? []).map((l) => l.variant_id));

      const toDelete = (currentLines ?? []).filter((l) => !incomingVariantIds.has(l.variant_id));
      for (const line of toDelete) {
        const { error } = await supabase.from('purchase_order_lines').delete().eq('id', line.id);
        if (error) throw error;
      }

      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const existingId = existingByVariant.get(line.variant_id);
        const lineData = {
          tenant_id: tenantId, purchase_order_id: id, line_no: index + 1,
          variant_id: line.variant_id, supplier_variant_id: line.supplier_variant_id ?? null,
          sku: line.sku ?? null, title: line.title ?? null,
          order_qty_units: Number.isFinite(line.order_qty_units) ? line.order_qty_units : 0,
          order_qty_cases: line.order_qty_cases ?? null, case_pack_qty: line.case_pack_qty ?? null,
          unit_cost: line.unit_cost ?? null, extended_cost: line.extended_cost ?? null,
          updated_at: new Date().toISOString(),
        };

        if (existingId) {
          const existingLine = (currentLines ?? []).find((l) => l.id === existingId);
          const receivedQty = existingLine?.received_qty_units ?? 0;
          if (lineData.order_qty_units < receivedQty) lineData.order_qty_units = receivedQty;
          const { error } = await supabase.from('purchase_order_lines').update(lineData).eq('id', existingId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('purchase_order_lines').insert(lineData);
          if (error) throw error;
        }
      }
    }

    await logPOActivity({ poId: id, tenantId, action: 'edited' });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    await logError({ source: 'api/purchase-orders/[id]/PATCH', error: err, tenantId });
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);
    const { id } = await params;

    const { data: po, error: fetchError } = await supabase.from('purchase_orders').select('id, status').eq('id', id).single();
    if (fetchError || !po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });
    if (po.status !== 'draft') return NextResponse.json({ error: 'Only draft POs can be deleted' }, { status: 400 });

    const { error: linesError } = await supabase.from('purchase_order_lines').delete().eq('purchase_order_id', id);
    if (linesError) throw linesError;

    const { error: poError } = await supabase.from('purchase_orders').delete().eq('id', id);
    if (poError) throw poError;

    return NextResponse.json({ success: true });
  } catch (err) {
    await logError({ source: 'api/purchase-orders/[id]/DELETE', error: err, tenantId });
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
  }
}
