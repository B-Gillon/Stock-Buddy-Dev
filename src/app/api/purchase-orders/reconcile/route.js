/**
 * POST /api/purchase-orders/reconcile
 *
 * Triggers Shopify inventory delta reconciliation for all active POs.
 * Intended for cron or webhook use.
 *
 * Optional body: { tenantId?: string } to scope to a single tenant.
 *
 * Returns: ReconcileReport
 */

import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { reconcileShopifyDeltas } from "@/lib/sync/po/reconcileShopifyDeltas";

export async function POST(request) {
  try {
    // Resolve tenant (or allow null for all-tenant reconcile from a trusted cron)
    let tenantId = null;
    try {
      tenantId = await getTenantId(request);
    } catch {
      // Allow unauthenticated cron calls to reconcile all tenants
      // In production, protect this route with a secret header
      const cronSecret = request.headers.get("x-cron-secret");
      if (cronSecret !== process.env.CRON_SECRET) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const report = await reconcileShopifyDeltas(tenantId);

    return NextResponse.json({ success: true, report });
  } catch (err) {
    console.error("[POST /api/purchase-orders/reconcile]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
