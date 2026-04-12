// /src/app/api/products/import-supplier-info/route.js
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";
import { DELETE_MARKER, FIELD_MAP, NUMERIC_FIELDS } from "@/app/products/supplier-variant-data/import/parseImportCSV";

const READONLY_FIELDS = new Set(["supplier_sku", "supplier_barcode"]);

export async function POST(request) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { rows, supplier_id } = body;
    if (!supplier_id) return NextResponse.json({ error: "supplier_id is required." }, { status: 400 });
    if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: "No rows to import." }, { status: 400 });

    const errors = [];
    let successCount = 0;

    for (const row of rows) {
      const { variant_id, fields } = row;
      if (!variant_id) { errors.push({ variant_id, error: "Missing variant_id." }); continue; }

      const { data: variant, error: variantError } = await supabase.from("variants").select("id").eq("shopify_variant_id", String(variant_id)).single();
      if (variantError || !variant) { errors.push({ variant_id, error: "Variant not found." }); continue; }

      const updateData = {};
      for (const [csvField, value] of Object.entries(fields)) {
        if (value === undefined) continue;
        const dbColumn = FIELD_MAP[csvField];
        if (!dbColumn || READONLY_FIELDS.has(dbColumn)) continue;
        if (value === DELETE_MARKER) updateData[dbColumn] = null;
        else if (NUMERIC_FIELDS.has(csvField)) { const num = parseFloat(value); updateData[dbColumn] = isNaN(num) ? null : num; }
        else updateData[dbColumn] = value;
      }
      updateData.updated_at = new Date().toISOString();

      const { error: upsertError } = await supabase.from("supplier_variants").upsert(
        { tenant_id: tenantId, supplier_id, variant_id: variant.id, ...updateData, created_at: new Date().toISOString() },
        { onConflict: "supplier_id,variant_id" }
      );

      if (upsertError) { errors.push({ variant_id, error: upsertError.message }); }
      else successCount++;
    }

    if (errors.length > 0 && successCount === 0) {
      await logError({ source: 'api/products/import-supplier-info/POST', error: new Error('All rows failed'), tenantId, context: { errorCount: errors.length } });
      return NextResponse.json({ error: "All rows failed to import.", details: errors }, { status: 500 });
    }

    return NextResponse.json({ success: true, successCount, errorCount: errors.length, errors });
  } catch (err) {
    await logError({ source: 'api/products/import-supplier-info/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
