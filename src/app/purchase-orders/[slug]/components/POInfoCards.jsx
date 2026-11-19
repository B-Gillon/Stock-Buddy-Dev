"use client";

// The top row of PO cards, shared by the PO, Receive Items and Putaway pages.
import Card from "@/shared/components/ui/Card";
import { formatCurrency } from "@/shared/utils/formatCurrency";
import CollapsibleCards from "./CollapsibleCards";

function fmtDate(val) {
  if (!val) return "—";
  const [yyyy, mm, dd] = String(val).substring(0, 10).split("-");
  return `${mm}/${dd}/${yyyy}`;
}

export default function POInfoCards({ po, lineCount, totalUnits, totalCost, currencyCode, defaultCollapsed = false, storageKey }) {
  return (
    <CollapsibleCards
      summary={`Supplier: ${po.supplier_name || "—"} · Deliver to: ${po.location_name || "—"}`}
      defaultCollapsed={defaultCollapsed}
      storageKey={storageKey}
    >
      <div className="grid grid-cols-4 gap-4">
        <Card title="PO Info">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">PO Create Date</span><span className="font-medium text-gray-800">{fmtDate(po.po_date)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Requested Ship Date</span><span className="font-medium text-gray-800">{fmtDate(po.expected_date)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Expected Ship Date</span><span className="font-medium text-gray-800">{po.expected_ship_date ? fmtDate(po.expected_ship_date) : "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Currency</span><span className="font-medium text-gray-800">{currencyCode}</span></div>
            {po.released_at && <div className="flex justify-between"><span className="text-gray-500">Released</span><span className="font-medium text-gray-800">{fmtDate(po.released_at)}</span></div>}
          </div>
        </Card>
        <Card title="Supplier">
          <div className="text-sm">
            <p className="font-medium text-gray-800">{po.supplier_name || "—"}</p>
            {po.supplier_number && <p className="text-gray-400 text-xs">#{po.supplier_number}</p>}
          </div>
        </Card>
        <Card title="Ship To">
          <div className="text-sm space-y-0.5">
            <p className="font-medium text-gray-800">{po.location_name || "—"}</p>
            {po.location_address1 && <p className="text-gray-500">{po.location_address1}</p>}
            {po.location_address2 && <p className="text-gray-500">{po.location_address2}</p>}
            {(po.location_city || po.location_province || po.location_zip) && <p className="text-gray-500">{[po.location_city, po.location_province, po.location_zip].filter(Boolean).join(", ")}</p>}
            {po.location_country && <p className="text-gray-500">{po.location_country}</p>}
          </div>
        </Card>
        <Card title="Summary">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Lines</span><span className="font-medium text-gray-800">{lineCount}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Total Units</span><span className="font-medium text-gray-800">{totalUnits.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Total Cost</span><span className="font-medium text-gray-800">{formatCurrency(totalCost, currencyCode)}</span></div>
          </div>
        </Card>
      </div>
    </CollapsibleCards>
  );
}
