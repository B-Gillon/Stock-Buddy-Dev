// /src/app/api/purchase-orders/[id]/cancel/route.js

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { sendPOEmail } from '@/lib/sendPOEmail';
import { logPOActivity } from '@/lib/logPOActivity';
import { cancelAckForPO } from '@/lib/acknowledgements';

export async function POST(request, { params }) {
  const { id } = await params;

  let tenantId;
  try {
    tenantId = await getTenantId(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // ── Fetch current PO ───────────────────────────────────────────────────────
  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .select('id, po_number, status, supplier_id, ship_to_location_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (poError || !po) {
    return NextResponse.json({ success: false, error: 'PO not found' }, { status: 404 });
  }

  if (!['draft', 'released', 'partially_received'].includes(po.status)) {
    return NextResponse.json(
      { success: false, error: `Cannot cancel a PO with status "${po.status}"` },
      { status: 400 }
    );
  }

  // ── Update PO status ───────────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from('purchase_orders')
    .update({
      status:       'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (updateError) {
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  }

  // An open acknowledgement request no longer applies (the link will show "cancelled")
  await cancelAckForPO(id);

  // ── Zero out any remaining incoming qty in po_shopify_incoming ─────────────
  // Mark all un-reversed rows for this PO as reversed so downstream sync knows
  const { error: incomingError } = await supabase
    .from('po_shopify_incoming')
    .update({
      reversed_at:     new Date().toISOString(),
      reversal_reason: 'cancelled',
    })
    .eq('purchase_order_id', id)
    .eq('tenant_id', tenantId)
    .is('reversed_at', null);

  if (incomingError) {
    console.error('Failed to reverse po_shopify_incoming rows:', incomingError.message);
    // Non-fatal — PO is cancelled in DB, log and continue
  }

  // ── Send cancellation email (non-blocking — don't fail the cancel if email fails) ──
  // Skip for drafts: the supplier never received the PO, so there is nothing to cancel.
  let cancelNotes = 'Draft PO: supplier was not notified';
  try {
    if (po.status !== 'draft') {
      const emailResult = await sendPOEmail(id, { isCancellation: true });
      cancelNotes = emailResult.success
        ? (emailResult.notes ?? 'Supplier notified by email')
        : `Supplier was not notified: ${emailResult.error}`;
    }
  } catch (emailErr) {
    cancelNotes = `Supplier was not notified: ${emailErr.message}`;
    console.error('Cancellation email error (non-fatal):', emailErr.message);
    // Log to error_log but do not return an error to the client
    await supabase.from('error_log').insert({
      tenant_id: tenantId,
      source:    'cancel_po_email',
      message:   emailErr.message,
      context:   { po_id: id, po_number: po.po_number },
    });
  }

  // ── Log to po_activity_log ─────────────────────────────────────────────────
  await logPOActivity({ poId: id, tenantId, action: 'cancelled', comments: cancelNotes, request });

  return NextResponse.json({ success: true });
}
