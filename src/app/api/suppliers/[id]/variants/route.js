// /src/app/api/suppliers/[id]/variants/route.js
import { supabase } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { NextResponse } from "next/server";

/**
 * GET /api/suppliers/[id]/variants
 * Returns existing supplier_variants for a given supplier,
 * keyed by shopify_variant_id (string) for CSV diff comparison.
 *
 * Response shape:
 * {
 *   byVariantId: {
 *     "1234567890": {
 *       item_code, cost, initial_average_cost,
 *       moq, order_increment, case_pack, inner_pack, lead_days, notes
 *     }
 *   }
 * }
 */
export async function GET(request, { params }) {
  let tenantId;
  try {
    tenantId = await getTenantId(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: supplierId } = await params;

  const { data, error } = await supabase
    .from("supplier_variants")
    .select(`
      item_code,
      cost,
      initial_average_cost,
      moq,
      order_increment,
      case_pack,
      inner_pack,
      lead_days,
      notes,
      variants ( shopify_variant_id )
    `)
    .eq("supplier_id", supplierId)
    .eq("tenant_id", tenantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Key by shopify_variant_id string — matches what the CSV contains
  const byVariantId = {};
  for (const row of data ?? []) {
    const shopifyId = row.variants?.shopify_variant_id;
    if (!shopifyId) continue;
    // Stringify all numeric fields so comparison with CSV strings works cleanly
    byVariantId[String(shopifyId)] = {
      item_code:            row.item_code            ?? null,
      cost:                 row.cost                 != null ? String(row.cost)                 : null,
      initial_average_cost: row.initial_average_cost != null ? String(row.initial_average_cost) : null,
      moq:                  row.moq                  != null ? String(row.moq)                  : null,
      order_increment:      row.order_increment       != null ? String(row.order_increment)       : null,
      case_pack:            row.case_pack             != null ? String(row.case_pack)             : null,
      inner_pack:           row.inner_pack            != null ? String(row.inner_pack)            : null,
      lead_days:            row.lead_days             != null ? String(row.lead_days)             : null,
      notes:                row.notes                ?? null,
    };
  }

  return NextResponse.json({ byVariantId });
}
