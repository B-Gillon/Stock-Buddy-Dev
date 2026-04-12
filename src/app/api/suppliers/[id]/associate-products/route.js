// /src/app/api/suppliers/[id]/associate-products/route.js
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";

export async function POST(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);
    const { id: supplier_id } = await params;
    const body = await request.json();
    const { product_ids } = body;

    if (!Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json({ error: "No products provided" }, { status: 400 });
    }

    const { data: variants, error: variantError } = await supabase
      .from("variants")
      .select("id")
      .in("product_id", product_ids);

    if (variantError) throw variantError;
    if (!variants || variants.length === 0) {
      return NextResponse.json({ error: "No variants found for selected products" }, { status: 400 });
    }

    const rows = variants.map((v) => ({ tenant_id: tenantId, supplier_id, variant_id: v.id }));
    const { error } = await supabase.from("supplier_variants").upsert(rows, { onConflict: "supplier_id,variant_id" });
    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/associate-products/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
