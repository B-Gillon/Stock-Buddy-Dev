"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Button from "@/shared/components/Button";
import Badge from "@/shared/components/Badge";
import { Toast, useToast } from "@/shared/components/Toast";

function ConfirmReceiveModal({ isOpen, onClose, onConfirm, receipts, lines, isSubmitting }) {
  if (!isOpen) return null;
  const totalUnits = receipts.reduce((sum, r) => sum + r.receivedQty, 0);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Confirm Receipt</h2>
          <p className="mt-1 text-sm text-gray-500">
            The following quantities will be marked as received and synced to Shopify.
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

  const handleFillAll = useCallback(() => {
    setQtyInputs(Object.fromEntries(lines.map((l) => [l.id, String(l.remaining_qty)])));
  }, [lines]);

  const handleQtyChange = (lineId, value) => {
    if (value === "" || /^\d+$/.test(value)) {
      setQtyInputs((prev) => ({ ...prev, [lineId]: value }));
    }
  };

  const buildReceipts = () =>
    lines
      .map((l) => ({ lineId: l.id, receivedQty: parseInt(qtyInputs[l.id] ?? "", 10) }))
      .filter((r) => !isNaN(r.receivedQty) && r.receivedQty > 0);

  const receipts = buildReceipts();
  const hasAnyQty = receipts.length > 0;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipts }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Unknown error");
      setShowConfirm(false);
      showToast("Receipt submitted successfully.");
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
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => router.push(`/purchase-orders/${slug}`)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <span className="text-gray-300">/</span>
          <h1 className="text-base font-semibold text-gray-900">Receive Items — {po.po_number}</h1>
        </div>

        <div className="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-xs text-gray-400">Supplier</p>
              <p className="font-medium text-gray-800">{po.supplier_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Ship To</p>
              <p className="font-medium text-gray-800">{po.location_name || "—"}</p>
            </div>
            {po.expected_date && (
              <div>
                <p className="text-xs text-gray-400">Expected</p>
                <p className="font-medium text-gray-800">{new Date(po.expected_date).toLocaleDateString()}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400">Status</p>
              <Badge status={po.status} />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left font-medium">#</th>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Ordered</th>
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
                const isOverReceiving = parseInt(qtyInputs[line.id] ?? "", 10) > line.remaining_qty;
                return (
                  <tr key={line.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-400">{line.line_no ?? idx + 1}</td>
                    <td className="px-4 py-3 text-gray-600">{line.sku}</td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{line.display_title || line.title}</td>
                    <td className="px-4 py-3 text-gray-700">{line.order_qty_units}</td>
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
                          className={`w-20 rounded-lg border px-3 py-1.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            isOverReceiving
                              ? "border-amber-400 bg-amber-50 text-amber-800"
                              : "border-gray-200 bg-white text-gray-900"
                          }`}
                        />
                        {isOverReceiving && (
                          <span className="text-xs text-amber-500" title="Over-receiving">⚠</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
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
