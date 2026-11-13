/**
 * POST /api/purchase-orders/[id]/release
 *
 * Releases a draft PO:
 *   1. Validates status === 'draft'
 *   2. Updates status → 'released', sets released_at
 *   3. Pushes incoming quantities via pushIncomingToShopify
 *   4. Rolls back DB status if push fails
 *   5. Sends PO email to supplier
 *
 * Returns: { success, error? }
 */
import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";
import { pushIncomingToShopify } from "@/lib/sync/po/pushIncoming";
import { sendPOEmail } from "@/lib/sendPOEmail";
import { logPOActivity } from "@/lib/logPOActivity";
import { logSftpUpload } from "@/lib/sftp";
import { logError } from "@/lib/logError";

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
        { success: false, error: `PO cannot be released from status: ${po.status}` },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("purchase_orders")
      .update({ status: "released", released_at: new Date().toISOString() })
      .eq("id", poId);

    if (updateError) {
      await logError({ source: "releasePO/dbUpdate", error: updateError, tenantId, context: { poId } });
      return NextResponse.json({ success: false, error: "Failed to update PO status" }, { status: 500 });
    }

    try {
      await pushIncomingToShopify({ poId, tenantId });
    } catch (shopifyErr) {
      await logError({ source: "releasePO/pushIncoming", error: shopifyErr, tenantId, context: { poId } });
      // Roll back DB status
      await supabase
        .from("purchase_orders")
        .update({ status: "draft", released_at: null })
        .eq("id", poId);
      return NextResponse.json({ success: false, error: "Shopify sync failed — PO rolled back to draft" }, { status: 500 });
    }

    // Send email — must be awaited before returning or Vercel will
    // terminate the function before the email is sent
    const emailResult = await sendPOEmail(poId, { isResend: false });

    await logPOActivity({
      poId, tenantId, action: "released", request,
      comments: emailResult.notes || (emailResult.success ? null : "PO was not sent to the supplier"),
    });

    if (emailResult.sftp) await logSftpUpload({ poId, tenantId, request, sftp: emailResult.sftp });

    // SFTP problems are already in History as "SFTP Failed"; log an error row only for email/other failures
    const sendError = emailResult.success ? null : (emailResult.emailError ?? (emailResult.sftp ? null : emailResult.error));
    if (sendError) {
      await logError({
        source: "releasePO/sendEmail",
        error: new Error(sendError),
        tenantId,
        context: { poId },
      });
      await logPOActivity({
        poId, tenantId, action: "error", request,
        comments: `Send failed: ${sendError}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    await logError({ source: "releasePO", error: err, tenantId: null });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
