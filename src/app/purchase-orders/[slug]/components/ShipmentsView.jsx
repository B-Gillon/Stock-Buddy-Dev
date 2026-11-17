// /src/app/purchase-orders/[slug]/components/ShipmentsView.jsx
// SERVER COMPONENT — every shipment on this PO, with its details and cartons.
import { supabase } from "@/lib/supabaseClient";
import Card from "@/shared/components/ui/Card";

const fmtDate = (v) => {
  if (!v) return "—";
  const [y, m, d] = String(v).substring(0, 10).split("-");
  return `${m}/${d}/${y}`;
};
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString("en-US", { timeZone: "America/New_York", month: "2-digit", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const dash = (v) => (v == null || v === "" ? "—" : v);

function Item({ label, children }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-800 break-words">{children}</p>
    </div>
  );
}

export default async function ShipmentsView({ poId, lines }) {
  const { data: shipments } = await supabase.from("shipments").select("*").eq("po_id", poId).order("created_at", { ascending: true });
  const ids = (shipments ?? []).map((s) => s.id);
  const [{ data: cartons }, { data: items }] = ids.length
    ? await Promise.all([
        supabase.from("shipment_cartons").select("*").in("shipment_id", ids).order("carton_no", { ascending: true }),
        supabase.from("shipment_lines").select("shipment_id, carton_id, po_line_id, shipped_qty").in("shipment_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  const lineById = new Map(lines.map((l) => [l.id, l]));
  const label = (lineId) => {
    const l = lineById.get(lineId);
    return l ? `${l.sku || `Line ${l.line_no}`}` : "—";
  };

  if (!shipments?.length) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-10 text-center text-sm text-gray-400">
        No shipments have been created for this purchase order yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {shipments.map((s) => {
        const cs = (cartons ?? []).filter((c) => c.shipment_id === s.id);
        const its = (items ?? []).filter((i) => i.shipment_id === s.id);
        const units = its.reduce((t, i) => t + (i.shipped_qty ?? 0), 0);
        const weight = s.total_weight != null ? `${Number(s.total_weight)} ${s.weight_unit ?? ""}` : "—";
        // Show only the carton columns someone actually filled in
        const has = (k) => cs.some((c) => c[k] != null && c[k] !== "");
        const cols = [
          has("supplier_carton_id") && { key: "supplier_carton_id", head: "Supplier Carton ID", get: (c) => c.supplier_carton_id },
          has("sscc") && { key: "sscc", head: "SSCC", get: (c) => c.sscc },
          has("tracking_number") && { key: "tracking_number", head: "Tracking Number", get: (c) => c.tracking_number },
          has("weight") && { key: "weight", head: "Weight", get: (c) => (c.weight != null ? `${Number(c.weight)} ${c.weight_unit ?? ""}` : null) },
          has("length") && { key: "dims", head: "Dimensions", get: (c) => (c.length != null ? `${Number(c.length)} × ${Number(c.width)} × ${Number(c.height)} ${c.dim_unit ?? ""}` : null) },
          has("pallet_id") && { key: "pallet_id", head: "Pallet ID", get: (c) => c.pallet_id },
          has("lot_number") && { key: "lot_number", head: "Lot Number", get: (c) => c.lot_number },
          has("expiration_date") && { key: "expiration_date", head: "Expires", get: (c) => (c.expiration_date ? fmtDate(c.expiration_date) : null) },
        ].filter(Boolean);

        return (
          <Card key={s.id} title={`${s.shipment_number} · ${units.toLocaleString()} unit${units === 1 ? "" : "s"}${cs.length ? ` · ${cs.filter((c) => c.received_at).length} of ${cs.length} cartons received` : ""}`}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                <Item label="Ship Date">{fmtDate(s.ship_date)}</Item>
                <Item label="Ship Method">{dash(s.ship_method || [s.carrier, s.service].filter(Boolean).join(" - "))}</Item>
                <Item label="PRO/Tracking Number">{dash(s.tracking_number)}</Item>
                <Item label="BOL Number">{dash(s.bol_number)}</Item>
                <Item label="Estimated Delivery Date">{fmtDate(s.est_delivery_date)}</Item>
                <Item label="Supplier Shipment Reference">{dash(s.supplier_reference)}</Item>
                <Item label="Packing Slip Number">{dash(s.packing_slip_number)}</Item>
                <Item label="Total Cartons">{s.total_cartons ?? cs.length}</Item>
                <Item label="Total Pallets">{dash(s.total_pallets)}</Item>
                <Item label="Total Weight">{weight}</Item>
                <Item label="Created By">{dash(s.created_by)}</Item>
                <Item label="Created">{fmtDateTime(s.created_at)}</Item>
              </div>
              {s.notes && <Item label="Shipment Notes"><span className="whitespace-pre-wrap font-normal">{s.notes}</span></Item>}

              {cs.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-600">
                      <th className="px-3 py-2 font-medium">Carton</th>
                      {cols.map((c) => <th key={c.key} className="px-3 py-2 font-medium">{c.head}</th>)}
                      <th className="px-3 py-2 font-medium">SKU</th>
                      <th className="px-3 py-2 font-medium">Quantity</th>
                      <th className="px-3 py-2 font-medium">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cs.map((c) => {
                      const ci = its.filter((i) => i.carton_id === c.id);
                      return (
                        <tr key={c.id} className="border-b border-gray-100 align-top">
                          <td className="px-3 py-2 font-medium text-gray-800">Carton {c.carton_no}</td>
                          {cols.map((col) => <td key={col.key} className="px-3 py-2 text-gray-700">{dash(col.get(c))}</td>)}
                          <td className="px-3 py-2 text-gray-700">
                            {ci.map((i) => <div key={i.po_line_id}>{label(i.po_line_id)}</div>)}
                          </td>
                          <td className="px-3 py-2 text-gray-800">
                            {ci.map((i) => <div key={i.po_line_id}>{i.shipped_qty}</div>)}
                          </td>
                          <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                            {c.received_at ? <span className="text-green-700">{fmtDateTime(c.received_at)}</span> : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-600">
                      <th className="px-3 py-2 font-medium">SKU</th><th className="px-3 py-2 font-medium">Description</th><th className="px-3 py-2 font-medium">Shipped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {its.map((i) => (
                      <tr key={i.po_line_id} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-gray-700">{label(i.po_line_id)}</td>
                        <td className="px-3 py-2 text-gray-800">{lineById.get(i.po_line_id)?.display_title ?? lineById.get(i.po_line_id)?.title ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-800">{i.shipped_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
