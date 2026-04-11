// src/app/mobile/pos/[slug]/page.jsx
// Server component — fetches PO detail by po_number (slug).
// Flattens all joined data before passing to client.

import { headers } from "next/headers";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";
import { notFound } from "next/navigation";
import MobilePODetail from "./components/MobilePODetail";

export const metadata = {
  title: "PO Detail — Stock Buddy",
};

export default async function MobilePODetailPage({ params }) {
  const { slug } = await params;
  const poNumber = decodeURIComponent(slug);

  const headersList = await headers();
  const tenantId = await getTenantIdFromHeaders(headersList);

  // Fetch PO with supplier and ship-to location
  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select(`
      id,
      po_number,
      status,
      expected_date,
      po_date,
      notes_supplier,
      notes_internal,
      supplier_id,
      suppliers ( supplier_name, company_name ),
      ship_to_location_id,
      locations ( name )
    `)
    .eq("tenant_id", tenantId)
    .eq("po_number", poNumber)
    .single();

  if (poError || !po) return notFound();

  // Fetch PO lines with variant and product info
  const { data: lines, error: linesError } = await supabase
    .from("purchase_order_lines")
    .select(`
      id,
      line_no,
      sku,
      title,
      order_qty_units,
      received_qty_units,
      incoming_qty,
      unit_cost,
      variant_id,
      variants (
        id,
        barcode,
        sku,
        title,
        display_title,
        option1,
        option2,
        option3,
        image_src,
        product_id,
        products ( title, image_src, vendor, product_type )
      )
    `)
    .eq("purchase_order_id", po.id)
    .eq("tenant_id", tenantId)
    .order("line_no", { ascending: true });

  if (linesError) {
    console.error("MobilePODetailPage lines fetch error:", linesError.message);
  }

  // Flatten lines
  const flatLines = (lines || []).map((line) => ({
    id: line.id,
    lineNo: line.line_no,
    sku: line.variants?.sku ?? line.sku ?? "—",
    barcode: line.variants?.barcode ?? null,
    displayTitle: line.variants?.display_title ?? line.variants?.title ?? line.title ?? "—",
    variantTitle: line.variants?.title ?? line.title ?? "—",
    option1: line.variants?.option1 ?? null,
    option2: line.variants?.option2 ?? null,
    option3: line.variants?.option3 ?? null,
    variantImageSrc: line.variants?.image_src ?? null,
    productTitle: line.variants?.products?.title ?? "—",
    productImageSrc: line.variants?.products?.image_src ?? null,
    vendor: line.variants?.products?.vendor ?? null,
    productType: line.variants?.products?.product_type ?? null,
    orderQtyUnits: line.order_qty_units ?? 0,
    receivedQtyUnits: line.received_qty_units ?? 0,
    unitCost: line.unit_cost ?? null,
    variantId: line.variant_id,
  }));

  const totalUnits = flatLines.reduce((sum, l) => sum + l.orderQtyUnits, 0);
  const receivedUnits = flatLines.reduce((sum, l) => sum + l.receivedQtyUnits, 0);

  const flatPO = {
    id: po.id,
    poNumber: po.po_number,
    status: po.status,
    expectedDate: po.expected_date,
    poDate: po.po_date,
    supplierName: po.suppliers?.supplier_name ?? "—",
    companyName: po.suppliers?.company_name ?? "—",
    locationName: po.locations?.name ?? "—",
    notesSupplier: po.notes_supplier ?? null,
    notesInternal: po.notes_internal ?? null,
    totalUnits,
    receivedUnits,
  };

  return <MobilePODetail po={flatPO} lines={flatLines} />;
}
