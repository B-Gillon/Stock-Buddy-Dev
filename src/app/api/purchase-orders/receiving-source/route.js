// /src/app/api/purchase-orders/receiving-source/route.js
import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { determineDefaultReceivingSource } from "@/lib/sync/po/determineReceivingSource";
import { logError } from "@/lib/logError";

export async function GET(request) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplierId");
    const locationId = searchParams.get("locationId") || null;

    if (!supplierId) return NextResponse.json({ success: false, error: "supplierId is required" }, { status: 400 });

    const receivingSource = await determineDefaultReceivingSource(supplierId, locationId, tenantId);
    return NextResponse.json({ success: true, receivingSource });
  } catch (err) {
    await logError({ source: 'api/purchase-orders/receiving-source/GET', error: err, tenantId });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
