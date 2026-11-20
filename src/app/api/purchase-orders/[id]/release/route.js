/**
 * POST /api/purchase-orders/[id]/release
 *
 * Releases a draft PO:
 *   1. Validates status === 'draft'
 *   2. Updates status → 'waiting_to_ship' (or 'pending_acknowledgement' once the email asks for
 *      an acknowledgement), sets released_at
 *   3. Pushes incoming quantities via pushIncomingToShopify
 *   4. Rolls back DB status if push fails
 *   5. Returns right away; the supplier email / SFTP delivery then runs in the background (after())
 *
 * Returns: { success, error? }
 */
import { NextResponse, after } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";
import { pushIncomingToShopify } from "@/lib/sync/po/pushIncoming";
import { sendPOEmail } from "@/lib/sendPOEmail";
import { logPOActivity } from "@/lib/logPOActivity";
import { logSftpUpload } from "@/lib/sftp";
import { logError } from "@/lib/logError";
import { sendAlert } from "@/lib/alerts";

// The supplier delivery (PDF, email, SFTP) runs after the response, so give it room to finish
export const maxDuration = 60;

export async function POST(request, { params }) {
  try {
    const tenantId = await getTenantId(request);
    const { id: poId } = await params;

    const { data: po, error: poFetchError } = await supabase
      .from("purchase_orders")
      .select("id, status, po_number, supplier_id, supplier:suppliers ( supplier_name )")
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
      .update({ status: "waiting_to_ship", released_at: new Date().toISOString() })
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

    // The supplier delivery (PDF, email, SFTP) takes ~10 seconds, so it runs after the response:
    // the PO is already released and its incoming quantities are saved. A failure is written to the
    // PO's History and sent as an email alert (Settings -> Email Alerts).
    const supplierName = (Array.isArray(po.supplier) ? po.supplier[0] : po.supplier)?.supplier_name ?? "the supplier";
    after(async () => {
      try {
        const emailResult = await sendPOEmail(poId, { isResend: false });

        // Supplier must acknowledge → hold in Pending Acknowledgement until they do
        if (emailResult.ackRequested) {
          await supabase.from("purchase_orders").update({ status: "pending_acknowledgement" }).eq("id", poId);
        }

        await logPOActivity({
          poId, tenantId, action: "released", request,
          comments: emailResult.notes || (emailResult.success ? null : "PO was not sent to the supplier"),
        });

        if (emailResult.sftp) await logSftpUpload({ poId, tenantId, request, sftp: emailResult.sftp });

        // SFTP problems are already in History as "SFTP Failed"; log an error row only for email/other failures
        const sendError = emailResult.success ? null : (emailResult.emailError ?? (emailResult.sftp ? null : emailResult.error));
        if (sendError) {
          await logError({ source: "releasePO/sendEmail", error: new Error(sendError), tenantId, context: { poId } });
          await logPOActivity({ poId, tenantId, action: "error", request, comments: `Send failed: ${sendError}` });
        }

        if (!emailResult.success) {
          const sftpFailed = emailResult.sftp?.files?.filter((f) => !f.ok).map((f) => `${f.type.toUpperCase()}: ${f.error}`) ?? [];
          await sendAlert({
            tenantId, supplierId: po.supplier_id, kind: "po_release_failed",
            vars: { supplier_name: supplierName, po_number: po.po_number, problem: sendError ?? emailResult.error ?? (sftpFailed.length ? sftpFailed.join("; ") : "Unknown error") },
          });
        }
      } catch (err) {
        await logError({ source: "releasePO/afterResponse", error: err, tenantId, context: { poId } });
        await logPOActivity({ poId, tenantId, action: "error", request, comments: `Send failed: ${err.message}` });
        await sendAlert({ tenantId, supplierId: po.supplier_id, kind: "po_release_failed",
          vars: { supplier_name: supplierName, po_number: po.po_number, problem: err.message } });
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    await logError({ source: "releasePO", error: err, tenantId: null });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
