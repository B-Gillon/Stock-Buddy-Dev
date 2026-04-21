// /src/app/api/sync/vendors/route.js
import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { logError } from "@/lib/logError";
import syncVendors from "@/lib/sync/syncVendors";

export async function POST(request) {
  const tenantId = await getTenantId(request);
  const results = {};
  const errors  = [];
  let count = 0;

  try {
    const result = await syncVendors(tenantId);
    count = result?.count ?? 0;
    results.vendors = "ok";
  } catch (err) {
    errors.push(`vendors: ${err.message}`);
    results.vendors = "failed";
    await logError({ source: 'sync/vendors/syncVendors', error: err, tenantId });
  }

  if (errors.length > 0) return NextResponse.json({ success: false, results, errors }, { status: 207 });
  return NextResponse.json({ success: true, results, count });
}
