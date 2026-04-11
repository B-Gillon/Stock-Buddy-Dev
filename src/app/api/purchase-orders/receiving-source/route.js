/**
 * GET /api/purchase-orders/receiving-source
 *
 * Returns the default receiving_source for a supplier + location combination.
 * Used on the PO create form to pre-populate the receiving_source field.
 *
 * Query params:
 *   supplierId - UUID of the supplier (required)
 *   locationId - UUID of the location (optional)
 *
 * Returns: { receivingSource: 'stock_buddy' | 'external' }
 */

import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { determineDefaultReceivingSource } from "@/lib/sync/po/determineReceivingSource";

export async function GET(request) {
  try {
    const tenantId = await getTenantId(request);
    const { searchParams } = new URL(request.url);

    const supplierId = searchParams.get("supplierId");
    const locationId = searchParams.get("locationId") || null;

    if (!supplierId) {
      return NextResponse.json(
        { success: false, error: "supplierId is required" },
        { status: 400 }
      );
    }

    const receivingSource = await determineDefaultReceivingSource(
      supplierId,
      locationId,
      tenantId
    );

    return NextResponse.json({ success: true, receivingSource });
  } catch (err) {
    console.error("[GET /api/purchase-orders/receiving-source]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
