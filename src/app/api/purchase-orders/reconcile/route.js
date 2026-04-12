// /src/app/api/purchase-orders/reconcile/route.js
import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { reconcileShopifyDeltas } from "@/lib/sync/po/reconcileShopifyDeltas";
import { logError } from "@/lib/logError";

export async function POST(request) {
  let tenantId = null;
  try {
    try {
      tenantId = await getTenantId(request);
    } catch {
      const cronSecret = request.headers.get("x-cron-secret");
      if (cronSecret !== process.env.CRON_SECRET) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const report = await reconcileShopifyDeltas(tenantId);
    return NextResponse.json({ success: true, report });
  } catch (err) {
    await logError({ source: 'api/purchase-orders/reconcile/POST', error: err, tenantId });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
