// /src/app/purchase-orders/[slug]/putaway/page.jsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import AppLayout from "@/shared/components/layout/AppLayout";
import ClientPutawayPage from "../components/ClientPutawayPage";

export const dynamic = "force-dynamic";

export default async function PutawayPage({ params }) {
  const { slug } = await params;
  const poNumber = decodeURIComponent(slug);
  const tenantId = await getTenantIdFromHeaders(await headers());

  const { data: po } = await supabase.from("purchase_orders")
    .select("id, po_number, status, expected_date, supplier:suppliers!supplier_id ( supplier_name ), location:locations!ship_to_location_id ( name )")
    .eq("tenant_id", tenantId).eq("po_number", poNumber).single();
  if (!po) notFound();

  const { data: lines } = await supabase.from("purchase_order_lines")
    .select("id, line_no, sku, title, order_qty_units, received_qty_units, putaway_qty_units, variant:variants!variant_id ( display_title )")
    .eq("tenant_id", tenantId).eq("purchase_order_id", po.id).order("line_no", { ascending: true });

  const flatLines = (lines ?? []).map((l) => ({
    id: l.id,
    line_no: l.line_no,
    sku: l.sku,
    display_title: l.variant?.display_title ?? l.title,
    order_qty_units: l.order_qty_units,
    received_qty_units: l.received_qty_units ?? 0,
    putaway_qty_units: l.putaway_qty_units ?? 0,
    ready_qty: Math.max(0, (l.received_qty_units ?? 0) - (l.putaway_qty_units ?? 0)),
  }));

  const flatPO = {
    id: po.id, po_number: po.po_number, status: po.status, expected_date: po.expected_date,
    supplier_name: (Array.isArray(po.supplier) ? po.supplier[0] : po.supplier)?.supplier_name ?? "",
    location_name: (Array.isArray(po.location) ? po.location[0] : po.location)?.name ?? "",
  };

  return (
    <AppLayout title={flatPO.po_number} showActionBar={false}>
      <ClientPutawayPage po={flatPO} lines={flatLines} slug={slug} />
    </AppLayout>
  );
}
