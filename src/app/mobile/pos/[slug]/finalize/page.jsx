// src/app/mobile/pos/[slug]/finalize/page.jsx
// Server component — fetches PO and lines for the finalization screen.
// Redirects back to detail if PO is not ready to finalize.

import { headers } from "next/headers";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";
import { notFound, redirect } from "next/navigation";
import MobileFinalize from "./components/MobileFinalize";

export const metadata = {
  title: "Finalize PO — Stock Buddy",
};

export default async function MobileFinalizePage({ params }) {
  const { slug } = await params;
  const poNumber = decodeURIComponent(slug);

  const headersList = await headers();
  const tenantId = await getTenantIdFromHeaders(headersList);

  // Fetch PO
  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select(`
      id,
      po_number,
      status,
      expected_date,
      released_at,
      supplier_id,
      suppliers ( supplier_name, company_name ),
      locations ( name )
    `)
    .eq("tenant_id", tenantId)
    .eq("po_number", poNumber)
    .single();

  if (poError || !po) return notFound();

  // Only receivable or already-received POs reach this screen
  const validStatuses = ["released", "partially_received", "received"];
  if (!validStatuses.includes(po.status)) {
    redirect(`/mobile/pos/${encodeURIComponent(poNumber)}`);
  }

  // Fetch lines
  const { data: lines, error: linesError } = await supabase
    .from("purchase_order_lines")
    .select(`
      id,
      line_no,
      sku,
      title,
      order_qty_units,
      received_qty_units,
      unit_cost,
      variant_id,
      variants (
        sku,
        title,
        option1,
        option2,
        option3,
        image_src,
        products ( title, image_src )
      )
    `)
    .eq("purchase_order_id", po.id)
    .eq("tenant_id", tenantId)
    .order("line_no", { ascending: true });

  if (linesError) {
    console.error("MobileFinalizePage lines error:", linesError.message);
  }

  // Flatten lines
  const flatLines = (lines || []).map((line) => ({
    id: line.id,
    lineNo: line.line_no,
    sku: line.variants?.sku ?? line.sku ?? "—",
    variantTitle: line.variants?.title ?? line.title ?? "—",
    option1: line.variants?.option1 ?? null,
    option2: line.variants?.option2 ?? null,
    option3: line.variants?.option3 ?? null,
    variantImageSrc: line.variants?.image_src ?? null,
    productTitle: line.variants?.products?.title ?? "—",
    productImageSrc: line.variants?.products?.image_src ?? null,
    orderQtyUnits: line.order_qty_units ?? 0,
    receivedQtyUnits: line.received_qty_units ?? 0,
    unitCost: line.unit_cost ?? null,
  }));

  const totalOrdered = flatLines.reduce((s, l) => s + l.orderQtyUnits, 0);
  const totalReceived = flatLines.reduce((s, l) => s + l.receivedQtyUnits, 0);
  const allFullyReceived = flatLines.every((l) => l.receivedQtyUnits >= l.orderQtyUnits);

  const flatPO = {
    id: po.id,
    poNumber: po.po_number,
    status: po.status,
    supplierName: po.suppliers?.supplier_name ?? "—",
    companyName: po.suppliers?.company_name ?? "—",
    locationName: po.locations?.name ?? "—",
    expectedDate: po.expected_date,
    releasedAt: po.released_at,
    totalOrdered,
    totalReceived,
    allFullyReceived,
  };

  return <MobileFinalize po={flatPO} lines={flatLines} />;
}
