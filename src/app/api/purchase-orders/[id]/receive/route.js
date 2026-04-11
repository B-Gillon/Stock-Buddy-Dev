/**
 * POST /api/purchase-orders/[id]/receive
 *
 * Records receiving for one or more lines on a purchase order.
 *
 * Body: { lines: [{ lineId: string, qtyToReceive: number }] }
 *
 * Returns: { success, results: [{ lineId, success, newPOStatus?, error? }] }
 */

import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { receiveInStockBuddy } from "@/lib/sync/po/receivePO";
import { logPOActivity } from "@/lib/logPOActivity";

export async function POST(request, { params }) {
  try {
    const tenantId = await getTenantId(request);
    const { id: poId } = await params;

    const body = await request.json();
    const { lines } = body;

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { success: false, error: "lines array is required" },
        { status: 400 }
      );
    }

    const results = [];

    for (const { lineId, qtyToReceive } of lines) {
      if (!lineId || typeof qtyToReceive !== "number") {
        results.push({ lineId, success: false, error: "Invalid lineId or qtyToReceive" });
        continue;
      }

      const result = await receiveInStockBuddy(poId, lineId, qtyToReceive, tenantId);
      results.push({ lineId, ...result });
    }

    const allSuccess = results.every((r) => r.success);
    const newPOStatus = results.find((r) => r.newPOStatus)?.newPOStatus;

    if (newPOStatus === "received") {
      await logPOActivity({ poId, tenantId, action: "closed" });
    }

    return NextResponse.json({ success: allSuccess, newPOStatus, results });
  } catch (err) {
    console.error("[POST /api/purchase-orders/[id]/receive]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
