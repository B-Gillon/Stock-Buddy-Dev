"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/shared/components/Button";
import { Toast, useToast } from "@/shared/components/Toast";

function ReleaseConfirmModal({ isOpen, onClose, onConfirm, po, isReleasing }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Release Purchase Order</h2>
          <p className="mt-1 text-sm text-gray-500">
            This will mark <span className="font-medium text-gray-800">{po.po_number}</span> as
            released and push incoming inventory quantities to Shopify.
          </p>
        </div>
        <div className="px-6 py-4">
          <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <p className="font-medium">What happens when you release:</p>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-blue-700">
              <li>PO status changes from Draft → Released</li>
              <li>Incoming quantities are sent to Shopify for each line item</li>
              <li>Expected arrival date is synced to Shopify (if set)</li>
              <li>PO metadata is written to Shopify inventory items</li>
            </ul>
          </div>
          {po.expected_date && (
            <p className="mt-3 text-sm text-gray-500">
              Expected arrival:{" "}
              <span className="font-medium text-gray-800">
                {new Date(po.expected_date).toLocaleDateString()}
              </span>
            </p>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={isReleasing}>Cancel</Button>
          <Button onClick={onConfirm} disabled={isReleasing}>
            {isReleasing ? "Releasing…" : "Release PO"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PODetailActions({ po, slug }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  const handleRelease = async () => {
    setIsReleasing(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/release`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Release failed.");
      setShowReleaseModal(false);
      showToast("PO released and synced to Shopify.");
      setTimeout(() => router.refresh(), 1000);
    } catch (err) {
      setShowReleaseModal(false);
      showToast(err.message, "error");
    } finally {
      setIsReleasing(false);
    }
  };

  const canRelease = po.status === "draft";
  const canReceive = ["released", "partially_received"].includes(po.status);
  const canEdit    = po.status !== "cancelled";
  const canCancel  = po.status !== "cancelled";

  return (
    <>
      <Toast message={toast.message} type={toast.type} />
      <ReleaseConfirmModal
        isOpen={showReleaseModal}
        onClose={() => setShowReleaseModal(false)}
        onConfirm={handleRelease}
        po={po}
        isReleasing={isReleasing}
      />
      <div className="flex items-center gap-2">
        {canCancel  && <Button onClick={() => router.push(`/purchase-orders/${slug}/cancel`)}>Cancel PO</Button>}
        {canEdit    && <Button onClick={() => router.push(`/purchase-orders/${slug}/edit`)}>Edit</Button>}
        {canRelease && <Button onClick={() => setShowReleaseModal(true)}>Release PO</Button>}
        {canReceive && <Button onClick={() => router.push(`/purchase-orders/${slug}/receive`)}>Receive Items</Button>}
      </div>
    </>
  );
}
