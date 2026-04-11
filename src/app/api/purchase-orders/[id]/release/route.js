/**
 * POST /api/purchase-orders/[id]/release
 *
 * Releases a draft PO:
 *   1. Validates status === 'draft'
 *   2. Updates status → 'released', sets released_at
 *   3. Pushes incoming quantities via pushIncomingToShopify
 *   4. Rolls back DB status if push fails
 *   5. Sends PO email to supplier (non-blocking)
 *
 * Returns: { success, error? }
 */

import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";
import { pushIncomingToShopify } from "@/lib/sync/po/pushIncoming";
import { sendPOEmail } from "@/lib/sendPOEmail";
import { logPOActivity } from "@/lib/logPOActivity";

export async function POST(request, { params }) {
  try {
    const tenantId = await getTenantId(request);
    const { id: poId } = await params;

    const { data: po, error: poFetchError } = await supabase
      .from("purchase_orders")
      .select("id, status")
      .eq("id", poId)
      .eq("tenant_id", tenantId)
      .single();

    if (poFetchError || !po) {
      return NextResponse.json({ success: false, error: "PO not found" }, { status: 404 });
    }

    if (po.status !== "draft") {
      return NextResponse.json(
        { success: false, error: `Cannot release a PO with status '${po.status}'` },
        { status: 422 }
      );
    }

    const releasedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("purchase_orders")
      .update({ status: "released", released_at: releasedAt, updated_at: releasedAt })
      .eq("id", poId)
      .eq("tenant_id", tenantId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: `DB update failed: ${updateError.message}` },
        { status: 500 }
      );
    }

    const pushResult = await pushIncomingToShopify(poId, tenantId);

    if (!pushResult.success) {
      await supabase
        .from("purchase_orders")
        .update({ status: "draft", released_at: null, updated_at: new Date().toISOString() })
        .eq("id", poId)
        .eq("tenant_id", tenantId);

      return NextResponse.json(
        { success: false, error: `Release failed — rolled back: ${pushResult.error}`, rolledBack: true },
        { status: 500 }
      );
    }

    await logPOActivity({ poId, tenantId, action: 'released' });

    // Send email — non-blocking
    const emailResult = await sendPOEmail(poId, { isResend: false });
    if (!emailResult.success) {
      console.warn(`[release] Email failed for PO ${poId}: ${emailResult.error}`);
    }

    return NextResponse.json({
      success: true,
      linesProcessed: pushResult.linesProcessed,
      emailSent: emailResult.success,
    });
  } catch (err) {
    console.error("[POST /api/purchase-orders/[id]/release]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
