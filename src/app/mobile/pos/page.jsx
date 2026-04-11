// src/app/mobile/pos/page.jsx
// Server component — fetches released/partially_received POs for the tenant.
// Flattens supplier name and line totals before passing to client.

import { headers } from "next/headers";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";
import MobilePOList from "./components/MobilePOList";

export const metadata = {
  title: "Receive a PO — Stock Buddy",
};

export default async function MobilePOListPage() {
  const headersList = await headers();
  const tenantId = await getTenantIdFromHeaders(headersList);

  // Fetch POs that are receivable
  const { data: pos, error } = await supabase
    .from("purchase_orders")
    .select(`
      id,
      po_number,
      status,
      expected_date,
      supplier_id,
      suppliers ( supplier_name ),
      purchase_order_lines ( order_qty_units, received_qty_units )
    `)
    .eq("tenant_id", tenantId)
    .in("status", ["released", "partially_received"])
    .order("expected_date", { ascending: true });

  if (error) {
    console.error("MobilePOListPage fetch error:", error.message);
  }

  // Flatten data — no nested objects passed to client
  const flatPOs = (pos || []).map((po) => {
    const totalUnits = (po.purchase_order_lines || []).reduce(
      (sum, line) => sum + (line.order_qty_units || 0),
      0
    );
    const receivedUnits = (po.purchase_order_lines || []).reduce(
      (sum, line) => sum + (line.received_qty_units || 0),
      0
    );

    return {
      id: po.id,
      poNumber: po.po_number,
      status: po.status,
      expectedDate: po.expected_date,
      supplierName: po.suppliers?.supplier_name ?? "Unknown Supplier",
      totalUnits,
      receivedUnits,
    };
  });

  return <MobilePOList pos={flatPOs} />;
}
