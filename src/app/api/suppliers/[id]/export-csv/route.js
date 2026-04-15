// /src/app/api/suppliers/[id]/export-csv/route.js
import { supabase } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { NextResponse } from "next/server";

/**
 * GET /api/suppliers/[id]/export-csv
 * Exports all variants associated with a supplier as a CSV in the import format.
 * Includes every supplier_variants row for this supplier, even those with no
 * supplier-specific data filled in yet.
 *
 * CSV columns (matching the import format exactly):
 * Variant ID, SKU (Supplier), Barcode (Supplier), Item Code (Supplier),
 * Supplier Cost, Initial Average Cost, Min Order Qty, Order in Multiples Of,
 * Case Pack Qty, Inner Pack, Lead Days, Notes
 */
export async function GET(request, { params }) {
  let tenantId;
  try {
    tenantId = await getTenantId(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: supplierId } = await params;

  // Fetch supplier name for the filename
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("supplier_name, supplier_number")
    .eq("id", supplierId)
    .eq("tenant_id", tenantId)
    .single();

  // Fetch all supplier_variants for this supplier, joined to variant data
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
      variants (
        shopify_variant_id,
        sku,
        barcode
      )
    `)
    .eq("supplier_id", supplierId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  function escapeCSV(value) {
    if (value == null || value === "") return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const headers = [
    "Variant ID",
    "SKU (Supplier)",
    "Barcode (Supplier)",
    "Item Code (Supplier)",
    "Supplier Cost",
    "Initial Average Cost",
    "Min Order Qty",
    "Order in Multiples Of",
    "Case Pack Qty",
    "Inner Pack",
    "Lead Days",
    "Notes",
  ];

  const rows = (data ?? []).map((row) => {
    const v = row.variants;
    return [
      v?.shopify_variant_id ? `"${v.shopify_variant_id}"` : "",
      escapeCSV(v?.sku),
      escapeCSV(v?.barcode),
      escapeCSV(row.item_code),
      escapeCSV(row.cost),
      escapeCSV(row.initial_average_cost),
      escapeCSV(row.moq),
      escapeCSV(row.order_increment),
      escapeCSV(row.case_pack),
      escapeCSV(row.inner_pack),
      escapeCSV(row.lead_days),
      escapeCSV(row.notes),
    ].join(",");
  });

  // Prepend UTF-8 BOM so Excel on Windows correctly reads special characters
  const csv = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");

  const supplierSlug = (supplier?.supplier_name ?? "supplier")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `${supplierSlug}-variants.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type":        "text/csv;charset=utf-8;",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
