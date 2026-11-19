"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Button from "@/shared/components/ui/Button";
import Badge from "@/shared/components/ui/Badge";
import Card from "@/shared/components/ui/Card";
import POInfoCards from "./POInfoCards";
import PageHeader from "@/shared/components/ui/PageHeader";
import { Toast, useToast } from "@/shared/components/ui/Toast";

function ConfirmReceiveModal({ isOpen, onClose, onConfirm, receipts, lines, isSubmitting }) {
  if (!isOpen) return null;
  const totalUnits = receipts.reduce((sum, r) => sum + r.receivedQty, 0);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Confirm Receipt</h2>
          <p className="mt-1 text-sm text-gray-500">
            The following quantities will be marked as received and held as Ready for Putaway. They are added to Shopify available after putaway.
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400">
                <th className="pb-2 text-left font-medium">SKU</th>
                <th className="pb-2 text-left font-medium">Qty</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => {
                const line = lines.find((l) => l.id === r.lineId);
                return (
                  <tr key={r.lineId} className="border-b border-gray-50">
                    <td className="py-2 text-gray-700">{line?.sku ?? "—"}</td>
                    <td className="py-2 font-medium text-gray-900">{r.receivedQty}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 px-6 py-4">
          <p className="text-sm text-gray-500">
            Total: <span className="font-semibold text-gray-900">{totalUnits} units</span>
          </p>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Confirm Receipt"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ClientReceivePOPage({ po, lines, slug }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [qtyInputs, setQtyInputs] = useState(() =>
    Object.fromEntries(lines.map((l) => [l.id, ""]))
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanText, setScanText] = useState("");
  const [scanMsg, setScanMsg] = useState(null);     // { ok, text }
  const [scanned, setScanned] = useState([]);       // cartons received by scan
  const scanRef = useRef(null);

  async function handleScan() {
    const raw = scanText.trim();
    if (!raw) return;
    setScanText("");
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/scan?sscc=${encodeURIComponent(raw)}`);
      const j = await res.json();
      if (j.result !== "ok") { setScanMsg({ ok: false, text: j.message ?? "Could not read that label." }); }
      else if (scanned.some((c) => c.id === j.carton.id)) { setScanMsg({ ok: false, text: "That carton is already scanned." }); }
      else {
        setScanned((cs) => [...cs, { id: j.carton.id, sscc: j.sscc, cartonNo: j.carton.cartonNo, shipmentNumber: j.carton.shipmentNumber, lines: j.carton.lines }]);
        setQtyInputs((prev) => {
          const next = { ...prev };
          for (const l of j.carton.lines) if (l.lineId in next) next[l.lineId] = String((parseInt(next[l.lineId], 10) || 0) + l.qty);
          return next;
        });
        setScanMsg({ ok: true, text: `Carton ${j.carton.cartonNo} of ${j.carton.shipmentNumber} added.` });
      }
    } catch { setScanMsg({ ok: false, text: "Could not look up that label." }); }
    scanRef.current?.focus();
  }

  function removeScanned(c) {
    setScanned((cs) => cs.filter((x) => x.id !== c.id));
    setQtyInputs((prev) => {
      const next = { ...prev };
      for (const l of c.lines) if (l.lineId in next) { const v = (parseInt(next[l.lineId], 10) || 0) - l.qty; next[l.lineId] = v > 0 ? String(v) : ""; }
      return next;
    });
  }

  const handleFillAll = useCallback(() => {
    setQtyInputs(Object.fromEntries(lines.map((l) => [l.id, l.receivable_qty > 0 ? String(l.receivable_qty) : ""])));
  }, [lines]);

  const handleQtyChange = (lineId, value) => {
    if (value === "" || /^\d+$/.test(value)) {
      // Can't enter more than what is shipped and not yet received
      const max = lines.find((l) => l.id === lineId)?.receivable_qty ?? 0;
      const capped = value !== "" && parseInt(value, 10) > max ? (max > 0 ? String(max) : "") : value;
      setQtyInputs((prev) => ({ ...prev, [lineId]: capped }));
    }
  };

  const buildReceipts = () =>
    lines
      .map((l) => ({ lineId: l.id, receivedQty: parseInt(qtyInputs[l.id] ?? "", 10) }))
      .filter((r) => !isNaN(r.receivedQty) && r.receivedQty > 0);

  const receipts = buildReceipts();
  const overShipped = receipts.some((r) => r.receivedQty > (lines.find((l) => l.id === r.lineId)?.receivable_qty ?? 0));
  const nothingShipped = lines.every((l) => (l.shipped_qty ?? 0) === 0);
  const hasAnyQty = receipts.length > 0 && !overShipped;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: receipts.map((r) => ({ lineId: r.lineId, qtyToReceive: r.receivedQty })), cartonIds: scanned.map((c) => c.id) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Unknown error");
      setShowConfirm(false);
      showToast("Receipt submitted successfully.", "info");
      setTimeout(() => router.push(`/purchase-orders/${slug}`), 1200);
    } catch (err) {
      setShowConfirm(false);
      showToast(err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Toast message={toast.message} type={toast.type} />
      <ConfirmReceiveModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        receipts={receipts}
        lines={lines}
        isSubmitting={isSubmitting}
      />
      <div className="space-y-4">
        <PageHeader backHref={`/purchase-orders/${slug}`} badge={<Badge status={po.status} />} />

        <POInfoCards
          po={po}
          lineCount={lines.length}
          totalUnits={lines.reduce((t, l) => t + (l.order_qty_units ?? 0), 0)}
          totalCost={lines.reduce((t, l) => t + (parseFloat(l.extended_cost) || 0), 0)}
          currencyCode={po.currency_code ?? "USD"}
          defaultCollapsed
          storageKey="po_action_cards_collapsed"
        />

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Scan carton label</label>
          <input
            ref={scanRef} autoFocus type="text" inputMode="numeric" value={scanText}
            onChange={(e) => setScanText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScan(); } }}
            placeholder="Scan the SSCC barcode (or type it and press Enter)"
            className="mt-2 h-9 w-full max-w-md rounded border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {scanMsg && <p className={`mt-2 text-xs ${scanMsg.ok ? "text-green-700" : "text-red-600"}`}>{scanMsg.text}</p>}
          {scanned.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {scanned.map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  Carton {c.cartonNo} · {c.shipmentNumber}
                  <button type="button" onClick={() => removeScanned(c)} className="text-gray-400 hover:text-red-600" aria-label="Remove">×</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left font-medium">#</th>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Ordered</th>
                <th className="px-4 py-3 text-left font-medium">Shipped</th>
                <th className="px-4 py-3 text-left font-medium">Received</th>
                <th className="px-4 py-3 text-left font-medium">Remaining</th>
                <th
                  className="cursor-pointer px-4 py-3 text-left font-medium text-blue-600 hover:text-blue-800 select-none"
                  onClick={handleFillAll}
                  title="Click to fill all inputs with remaining quantity"
                >
                  Receive Quantity ↓
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const isOverReceiving = parseInt(qtyInputs[line.id] ?? "", 10) > line.receivable_qty;
                return (
                  <tr key={line.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-400">{line.line_no ?? idx + 1}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{line.sku}</td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{line.display_title || line.title}</td>
                    <td className="px-4 py-3 text-gray-700">{line.order_qty_units}</td>
                    <td className="px-4 py-3 text-gray-700">{line.shipped_qty ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500">{line.received_qty_units ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={line.remaining_qty <= 0 ? "text-gray-400" : "font-medium text-gray-800"}>
                        {line.remaining_qty <= 0 ? "—" : line.remaining_qty}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={qtyInputs[line.id]}
                          onChange={(e) => handleQtyChange(line.id, e.target.value)}
                          placeholder=""
                          disabled={line.receivable_qty <= 0}
                          title={line.receivable_qty <= 0 ? "Nothing shipped and not yet received on this line" : `Up to ${line.receivable_qty}`}
                          className={`w-20 disabled:cursor-not-allowed disabled:bg-gray-100 rounded-lg border px-3 py-1.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            isOverReceiving
                              ? "border-amber-400 bg-amber-50 text-amber-800"
                              : "border-gray-200 bg-white text-gray-900"
                          }`}
                        />
                        {isOverReceiving && (
                          <span className="text-xs text-amber-500" title={`Only ${line.receivable_qty} shipped and not yet received`}>⚠</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {nothingShipped && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Nothing on this purchase order has been shipped yet. Items can only be received after the supplier ships them.
          </div>
        )}
        {overShipped && <p className="text-sm text-red-600">A quantity is more than what has been shipped and not yet received.</p>}

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Click <span className="font-medium text-blue-600">Receive Quantity ↓</span> in the column header to fill all remaining quantities.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => router.push(`/purchase-orders/${slug}`)}>Cancel</Button>
            <Button onClick={() => hasAnyQty && setShowConfirm(true)} disabled={!hasAnyQty}>Submit</Button>
          </div>
        </div>
      </div>
    </>
  );
}
