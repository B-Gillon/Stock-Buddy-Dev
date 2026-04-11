"use client";

// src/app/mobile/pos/[slug]/components/MobilePODetail.jsx
// PO summary screen shown before entering the receive flow.
// Shows progress, line item count, and key PO metadata.

import { useRouter } from "next/navigation";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ProgressRing({ received, total }) {
  const pct = total > 0 ? Math.min((received / total) * 100, 100) : 0;
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-36 h-36">
        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="ringGradient" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#11E0FC" />
              <stop offset="100%" stopColor="#0099FF" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="8"
          />
          {/* Progress */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={pct === 100 ? "#16a34a" : "#ffffff"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{Math.round(pct)}%</span>
          <span className="text-base font-semibold text-white uppercase tracking-wide">received</span>
        </div>
      </div>
      <p className="text-lg text-white mt-2">
        {received} of {total} units
      </p>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    released: { label: "Released", classes: "bg-blue-100 text-blue-700" },
    partially_received: { label: "In Progress", classes: "bg-amber-100 text-amber-700" },
    received: { label: "Received", classes: "bg-green-100 text-green-700" },
  };
  const { label, classes } = map[status] ?? { label: status, classes: "bg-gray-100 text-gray-600" };
  return (
    <span className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${classes}`}>
      {label}
    </span>
  );
}

function MetaRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export default function MobilePODetail({ po, lines }) {
  const router = useRouter();

  const isReceivable = ["released", "partially_received"].includes(po.status);
  const isFullyReceived = po.receivedUnits >= po.totalUnits && po.totalUnits > 0;

  const fullyReceivedLines = lines.filter(
    (l) => l.receivedQtyUnits >= l.orderQtyUnits
  ).length;

  return (
    <div className="min-h-screen flex flex-col pb-32" style={{ backgroundColor: "#e5e7eb" }}>
      {/* Header — floating dark card matching /pos */}
      <div className="px-4 pt-5">
        <div style={{ backgroundColor: "#1f2937", borderRadius: "16px" }} className="text-white px-5 pt-4 pb-5">

          {/* Top row: back link left, Stock Buddy v1.0 right */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push("/mobile/pos")}
              className="flex items-center gap-1.5 text-gray-400 text-sm active:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              All POs
            </button>
            <div className="flex items-center gap-1.5">
              <span
                className="text-sm font-semibold"
                style={{
                  background: "linear-gradient(to right, #11E0FC, #0099FF)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Stock Buddy
              </span>
              <span className="text-xs text-gray-400">v1.0</span>
            </div>
          </div>

          {/* Centered PO number */}
          <div className="flex justify-center mb-4">
            <div className="flex flex-col items-start">
              <h1
                className="text-4xl font-bold"
                style={{
                  background: "linear-gradient(to right, #11E0FC, #0099FF)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {po.poNumber}
              </h1>
              <p className="text-sm text-gray-400 mt-1">{po.supplierName}</p>
            </div>
          </div>

          {/* Bottom row: status pill on right */}
          <div className="flex justify-end">
            <StatusBadge status={po.status} />
          </div>

        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Progress ring — lighter card */}
        <div className="flex flex-col items-center p-6"
          style={{
            backgroundColor: "#6b7280",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            borderRadius: "16px",
          }}
        >
          <ProgressRing received={po.receivedUnits} total={po.totalUnits} />
        </div>

        {/* Notes */}
        {po.notesInternal && (
          <div className="px-5 py-4" style={{
            backgroundColor: "#4b5563",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            borderRadius: "16px",
          }}>
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1">
              Internal Note
            </p>
            <p className="text-sm text-gray-200">{po.notesInternal}</p>
          </div>
        )}

        {/* Line items — one card per item */}
        {lines.length > 0 && (
          <div className="space-y-2">
            {lines.map((line) => {
              const remaining = line.orderQtyUnits - line.receivedQtyUnits;
              const done = remaining <= 0;
              return (
                <div
                  key={line.id}
                  className="flex items-center gap-4"
                  style={{
                    backgroundColor: "#4b5563",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    borderRadius: "12px",
                    padding: "12px 16px",
                  }}
                >
                  {/* Image */}
                  <div className="rounded-lg flex-shrink-0 overflow-hidden" style={{ width: "48px", height: "48px", backgroundColor: "rgba(255,255,255,0.1)" }}>
                    {(line.variantImageSrc || line.productImageSrc) ? (
                      <img
                        src={line.variantImageSrc || line.productImageSrc}
                        alt={line.displayTitle || line.productTitle}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Display title + SKU */}
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-medium text-white">{line.displayTitle || line.productTitle}</p>
                    {line.sku && <p className="text-xl text-white mt-0.5">{line.sku}</p>}
                  </div>

                  {/* Status */}
                  {done ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="flex-shrink-0" style={{ width: "22px", height: "22px", color: "#4ade80" }}>
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span className="text-sm text-white flex-shrink-0">
                      {line.receivedQtyUnits}/{line.orderQtyUnits}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky footer CTA */}
      {isReceivable && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 safe-area-bottom">
          <button
            onClick={() => router.push(`/mobile/pos/${po.poNumber}/receive`)}
            className="w-full text-white font-semibold text-base rounded-2xl py-4 active:scale-98 transition-all shadow-sm"
            style={{ background: "#1f2937" }}
          >
            {po.status === "partially_received" ? "Continue Receiving" : "Start Receiving"}
          </button>
        </div>
      )}

      {isFullyReceived && po.status !== "received" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4">
          <button
            onClick={() => router.push(`/mobile/pos/${po.poNumber}/finalize`)}
            className="w-full bg-green-600 text-white font-semibold text-base rounded-2xl py-4 active:bg-green-700 active:scale-98 transition-all shadow-sm"
          >
            Finalize PO
          </button>
        </div>
      )}
    </div>
  );
}
