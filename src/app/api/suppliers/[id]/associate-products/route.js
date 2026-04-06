// /src/app/api/suppliers/[id]/associate-products/route.js
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { NextResponse } from "next/server";

export async function POST(request, { params }) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { id: supplier_id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { product_ids } = body;

  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return NextResponse.json({ error: "No products provided" }, { status: 400 });
  }

  const { data: variants, error: variantError } = await supabase
    .from("variants")
    .select("id")
    .in("product_id", product_ids);

  if (variantError) {
    console.error("Associate products — variant lookup error:", variantError);
    return NextResponse.json({ error: variantError.message }, { status: 500 });
  }

  if (!variants || variants.length === 0) {
    return NextResponse.json({ error: "No variants found for selected products" }, { status: 400 });
  }

  const rows = variants.map((v) => ({
    tenant_id:  tenantId,
    supplier_id,
    variant_id: v.id,
  }));

  const { error } = await supabase
    .from("supplier_variants")
    .upsert(rows, { onConflict: "supplier_id,variant_id" });

  if (error) {
    console.error("Associate products error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
