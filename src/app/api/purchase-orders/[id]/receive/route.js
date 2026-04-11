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
import { logError } from "@/lib/logError";

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
      try {
        const result = await receiveInStockBuddy({ poId, lineId, qtyToReceive, tenantId });
        results.push({ lineId, success: true, ...result });
      } catch (lineErr) {
        await logError({
          source: "receivePO/line",
          error: lineErr,
          tenantId,
          context: { poId, lineId, qtyToReceive },
        });
        results.push({ lineId, success: false, error: lineErr.message });
      }
    }

    await logPOActivity({ poId, tenantId, action: "edited" });

    const allFailed = results.every((r) => !r.success);
    if (allFailed) {
      return NextResponse.json({ success: false, results }, { status: 500 });
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    const tenantId = null;
    await logError({ source: "receivePO", error: err, tenantId });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
