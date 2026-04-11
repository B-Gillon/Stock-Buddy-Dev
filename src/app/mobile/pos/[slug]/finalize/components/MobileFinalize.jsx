"use client";

// src/app/mobile/pos/[slug]/finalize/components/MobileFinalize.jsx
// Final screen shown when all PO lines are received.
// Calls the existing receive API to mark the PO fully received,
// then shows a success state and offers navigation back to dashboard.

import { useState } from "react";
import { useRouter } from "next/navigation";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SuccessScreen({ poNumber, onDashboard }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center gap-8">
      {/* Checkmark */}
      <div className="w-40 h-40 rounded-full bg-green-100 flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth={2}
          stroke="#16a34a"
          className="w-20 h-20"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>

      <div>
        <h1 className="font-bold text-gray-900" style={{ fontSize: "40px" }}>PO Finalized</h1>
        <p className="text-gray-500 mt-2" style={{ fontSize: "20px" }}>{poNumber} has been marked as received.</p>
      </div>

      <div className="w-full mt-4">
        <button
          onClick={onDashboard}
          className="w-full bg-black text-white font-semibold rounded-2xl active:bg-gray-900 active:scale-98 transition-all"
          style={{ fontSize: "24px", padding: "20px 0" }}
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}

function LineRow({ line }) {
  const optionParts = [line.option1, line.option2, line.option3].filter(Boolean);
  const variantLabel = optionParts.length > 0 ? optionParts.join(" / ") : line.variantTitle;
  const isShort = line.receivedQtyUnits < line.orderQtyUnits;
  const imageSrc = line.variantImageSrc || line.productImageSrc;

  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      {/* Image */}
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={line.productTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4 text-gray-400"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{line.productTitle}</p>
        <p className="text-xs text-gray-400 truncate">{variantLabel}</p>
      </div>

      {/* Qty */}
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-semibold ${isShort ? "text-amber-600" : "text-gray-900"}`}>
          {line.receivedQtyUnits}/{line.orderQtyUnits}
        </p>
        {isShort && (
          <p className="text-xs text-amber-500">short</p>
        )}
      </div>
    </div>
  );
}

export default function MobileFinalize({ po, lines }) {
  const router = useRouter();
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(po.status === "received");

  const shortLines = lines.filter((l) => l.receivedQtyUnits < l.orderQtyUnits);
  const hasShortages = shortLines.length > 0;

  async function handleFinalize() {
    setFinalizing(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize" }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Finalization failed");
      }

      setDone(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setFinalizing(false);
    }
  }

  if (done) {
    return (
      <SuccessScreen
        poNumber={po.poNumber}
        onDashboard={() => router.push("/mobile")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-36">
      {/* Header */}
      <div className="bg-black text-white px-5 pt-12 pb-6">
        <button
          onClick={() => router.push(`/mobile/pos/${po.poNumber}`)}
          className="flex items-center gap-1.5 text-gray-400 text-sm mb-4 active:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          {po.poNumber}
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold">PO Fully Received</h1>
            <p className="text-sm text-gray-400">{po.supplierName}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Summary card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Summary</p>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="flex justify-between px-5 py-3.5">
              <span className="text-sm text-gray-500">PO Number</span>
              <span className="text-sm font-semibold text-gray-900">{po.poNumber}</span>
            </div>
            <div className="flex justify-between px-5 py-3.5">
              <span className="text-sm text-gray-500">Supplier</span>
              <span className="text-sm font-semibold text-gray-900">{po.companyName}</span>
            </div>
            <div className="flex justify-between px-5 py-3.5">
              <span className="text-sm text-gray-500">Ship to</span>
              <span className="text-sm font-semibold text-gray-900">{po.locationName}</span>
            </div>
            <div className="flex justify-between px-5 py-3.5">
              <span className="text-sm text-gray-500">Units ordered</span>
              <span className="text-sm font-semibold text-gray-900">{po.totalOrdered}</span>
            </div>
            <div className="flex justify-between px-5 py-3.5">
              <span className="text-sm text-gray-500">Units received</span>
              <span className={`text-sm font-semibold ${hasShortages ? "text-amber-600" : "text-green-600"}`}>
                {po.totalReceived}
              </span>
            </div>
          </div>
        </div>

        {/* Shortage warning */}
        {hasShortages && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {shortLines.length} item{shortLines.length > 1 ? "s" : ""} received short
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Finalizing will close this PO with the quantities shown below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Line items */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Items ({lines.length})
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {lines.map((line) => (
              <LineRow key={line.id} line={line} />
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 safe-area-bottom space-y-2.5">
        <button
          onClick={handleFinalize}
          disabled={finalizing}
          className={`
            w-full font-semibold text-base rounded-2xl py-4 transition-all
            ${finalizing
              ? "bg-green-300 text-white cursor-not-allowed"
              : "bg-green-600 text-white active:bg-green-700 active:scale-98 shadow-sm"
            }
          `}
        >
          {finalizing ? "Finalizing…" : hasShortages ? "Finalize with Shortages" : "Finalize PO"}
        </button>
        <button
          onClick={() => router.push(`/mobile/pos/${po.poNumber}/receive`)}
          disabled={finalizing}
          className="w-full bg-white text-gray-600 font-medium text-sm rounded-2xl py-3 border border-gray-200 active:bg-gray-50 transition-all"
        >
          Back to Receiving
        </button>
      </div>
    </div>
  );
}
