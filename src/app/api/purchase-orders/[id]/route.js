// /src/app/api/purchase-orders/[id]/route.js
import { NextResponse } from 'next/server';
import { supabase, setTenantContext } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logPOActivity } from '@/lib/logPOActivity';
import { logError } from '@/lib/logError';

const MAX_CHANGE_NOTES = 8;

function fmtDay(v) {
  if (!v) return '—';
  const [y, m, d] = String(v).substring(0, 10).split('-');
  return `${m}/${d}/${y}`;
}

const norm = (v) => (v == null ? '' : String(v).trim());
const num  = (v) => (v == null || v === '' ? null : Number(v));

/**
 * Builds a short, readable list of what changed on a PO edit, for the History notes.
 */
function describeChanges({ beforeHeader, header, beforeLines, afterLines }) {
  const changes = [];

  if (norm(beforeHeader?.po_date).substring(0, 10) !== norm(header.po_date).substring(0, 10)) {
    changes.push(`PO Date: ${fmtDay(beforeHeader?.po_date)} → ${fmtDay(header.po_date)}`);
  }
  if (norm(beforeHeader?.expected_date).substring(0, 10) !== norm(header.expected_date).substring(0, 10)) {
    changes.push(`Expected Date: ${fmtDay(beforeHeader?.expected_date)} → ${fmtDay(header.expected_date)}`);
  }
  if (norm(beforeHeader?.notes_internal) !== norm(header.notes_internal)) changes.push('Internal notes updated');
  if (norm(beforeHeader?.notes_supplier) !== norm(header.notes_supplier)) changes.push('Supplier notes updated');

  if (afterLines) {
    const before = new Map((beforeLines ?? []).map((l) => [l.variant_id, l]));
    const after  = new Map(afterLines.map((l) => [l.variant_id, l]));
    const label  = (l) => l.sku || l.title || 'line';

    for (const [vid, l] of after) {
      const old = before.get(vid);
      if (!old) {
        changes.push(`Added ${label(l)} (qty ${l.order_qty_units ?? 0})`);
        continue;
      }
      if (num(old.order_qty_units) !== num(l.order_qty_units)) {
        changes.push(`${label(l)}: qty ${old.order_qty_units ?? 0} → ${l.order_qty_units ?? 0}`);
      }
      if (num(old.unit_cost) !== num(l.unit_cost)) {
        changes.push(`${label(l)}: unit cost ${old.unit_cost ?? '—'} → ${l.unit_cost ?? '—'}`);
      }
    }
    for (const [vid, l] of before) {
      if (!after.has(vid)) changes.push(`Removed ${label(l)}`);
    }
  }

  if (changes.length === 0) return 'No changes detected';
  if (changes.length > MAX_CHANGE_NOTES) {
    return [...changes.slice(0, MAX_CHANGE_NOTES), `+${changes.length - MAX_CHANGE_NOTES} more changes`].join('; ');
  }
  return changes.join('; ');
}

export async function PATCH(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);
    const { id } = await params;
    const body = await request.json();
    const { header, lines } = body;

    // Snapshot the PO before editing so History can say what changed
    const { data: beforeHeader } = await supabase
      .from('purchase_orders')
      .select('po_date, expected_date, notes_internal, notes_supplier')
      .eq('id', id)
      .single();
    const { data: beforeLines } = await supabase
      .from('purchase_order_lines')
      .select('variant_id, sku, title, order_qty_units, unit_cost')
      .eq('purchase_order_id', id);

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

    await logPOActivity({
      poId: id, tenantId, action: 'edited', request,
      comments: describeChanges({ beforeHeader, header, beforeLines, afterLines: lines }),
    });
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
