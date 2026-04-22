"use client";

// src/app/mobile/pos/components/MobilePOList.jsx
// Displays receivable POs as tap-friendly cards.
// Supports text search and camera barcode scan.

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function datePillStyle(dateStr) {
  if (!dateStr) return { label: "No Date", bg: "#374151", color: "#9ca3af" };
  const today = new Date(new Date().toDateString());
  const due = new Date(dateStr);
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  const label = `Expected: ${formatDate(dateStr)}`;
  if (diffDays <= 0) return { label, bg: "#dc2626", color: "#ffffff" };       // red — due or overdue
  if (diffDays <= 2) return { label, bg: "#d97706", color: "#ffffff" };       // yellow — within 2 days
  return { label, bg: "#0099FF", color: "#ffffff" };                          // blue — not due yet
}

function ProgressBar({ received, total }) {
  const pct = total > 0 ? Math.min((received / total) * 100, 100) : 0;
  return (
      <div className="mt-4 pb-2">
      <div className="flex justify-between items-center mb-1.5">
        <span style={{ fontSize: "15px" }} className="text-gray-300">
          {received} / {total} units received
        </span>
        <span style={{ fontSize: "15px" }} className="font-semibold text-gray-200">{Math.round(pct)}%</span>
      </div>
      <div className="w-full rounded-full h-2" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: "#0099FF" }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    released: { label: "Released", classes: "bg-blue-100 text-blue-700" },
    partially_received: { label: "In Progress", classes: "bg-amber-100 text-amber-700" },
  };
  const { label, classes } = map[status] ?? { label: status, classes: "bg-gray-100 text-gray-600" };
  return (
    <span style={{ fontSize: "13px" }} className={`font-semibold uppercase tracking-wide px-3 py-1 rounded-full ${classes}`}>
      {label}
    </span>
  );
}

// Full-screen ZXing camera scanner (reused from receive screen pattern)
function ScannerView({ onDetected, onClose }) {
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useState(null);
  const vidRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/library");
        const reader = new BrowserMultiFormatReader();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        vidRef.current.srcObject = stream;
        await vidRef.current.play();
        reader.decodeFromStream(stream, vidRef.current, (result) => {
          if (result && active) {
            onDetected(result.getText());
            active = false;
          }
        });
      } catch (err) {
        if (active) setCameraError(err.message || "Camera unavailable");
      }
    }
    start();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 px-8 text-center">
            <p className="text-sm opacity-70">Camera unavailable</p>
            <p className="text-xs opacity-50">{cameraError}</p>
          </div>
        ) : (
          <>
            <video ref={vidRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-72 h-44">
                {["top-0 left-0 border-t-2 border-l-2 rounded-tl-md",
                  "top-0 right-0 border-t-2 border-r-2 rounded-tr-md",
                  "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-md",
                  "bottom-0 right-0 border-b-2 border-r-2 rounded-br-md"
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-8 h-8 border-white border-opacity-80 ${cls}`} />
                ))}
              </div>
            </div>
            <div className="absolute inset-0 bg-black/40 pointer-events-none"
              style={{
                maskImage: "radial-gradient(ellipse 300px 190px at center, transparent 0%, black 100%)",
                WebkitMaskImage: "radial-gradient(ellipse 300px 190px at center, transparent 0%, black 100%)",
              }}
            />
          </>
        )}
      </div>
      <div className="bg-black px-5 py-6 flex items-center justify-between safe-area-bottom">
        <button onClick={onClose} className="text-white font-medium opacity-70 active:opacity-100">
          Cancel
        </button>
        <p className="text-white text-xs opacity-50">Point camera at PO barcode</p>
        <div className="w-16" />
      </div>
    </div>
  );
}

export default function MobilePOList({ pos }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pos;
    const results = pos.filter(
      (po) =>
        po.poNumber.toLowerCase().includes(q) ||
        po.supplierName.toLowerCase().includes(q)
    );
    // Exact match → auto-navigate (barcode scan)
    if (results.length === 1 && results[0].poNumber.toLowerCase() === q) {
      router.push(`/mobile/pos/${results[0].poNumber}`);
    }
    return results;
  }, [pos, search]);

  function handleScan(value) {
    setShowScanner(false);
    const match = pos.find(p => p.poNumber.toLowerCase() === value.toLowerCase());
    if (match) {
      router.push(`/mobile/pos/${match.poNumber}`);
    } else {
      setSearch(value);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#e5e7eb" }}>
      {showScanner && (
        <ScannerView onDetected={handleScan} onClose={() => setShowScanner(false)} />
      )}

      {/* Header */}
      <div className="px-4 pt-5">
        <div style={{ backgroundColor: "#1f2937", borderRadius: "16px", position: "relative" }} className="text-white px-5 pt-4 pb-5">

          {/* Top row: Dashboard left, Stock Buddy v1.0 right */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push("/mobile")}
              className="flex items-center gap-1.5 text-gray-400 text-sm active:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Dashboard
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

          {/* Centered title */}
          <p className="text-center text-white font-bold text-2xl mb-4">POs Ready to be Received</p>

          {/* Bottom row: X Open Orders pill on right */}
          <div className="flex justify-end">
            <span
              className="text-xs font-bold"
              style={{
                backgroundColor: "#ffffff",
                color: "#000000",
                borderRadius: "999px",
                padding: "5px 12px",
                letterSpacing: "0.03em",
              }}
            >
              {pos.length} Open {pos.length === 1 ? "Order" : "Orders"}
            </span>
          </div>

        </div>
      </div>

      {/* Search bar + Scan button */}
      <div className="px-4 pt-4 pb-2 flex gap-2">
        <input
          type="search"
          placeholder="Search or scan a PO number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
        <button
          onClick={() => setShowScanner(true)}
          className="text-white rounded-xl px-4 py-3 font-semibold text-base active:scale-95 transition-all shadow-sm flex-shrink-0"
          style={{ backgroundColor: "#0099FF" }}
        >
          Scan
        </button>
      </div>

      {/* PO cards */}
      <div className="flex-1 px-4 pt-3 pb-8 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mx-auto mb-3 opacity-40">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
            </svg>
            <p className="text-base font-medium">
              {search ? "No POs match your search" : "No open purchase orders"}
            </p>
            {search && (
              <button onClick={() => setSearch("")} className="mt-2 text-blue-500 text-sm underline">
                Clear search
              </button>
            )}
          </div>
        ) : (
          filtered.map((po) => {
            const pill = datePillStyle(po.expectedDate);
            return (
              <button
                key={po.id}
                onClick={() => router.push(`/mobile/pos/${po.poNumber}`)}
                className="w-full rounded-2xl text-left active:scale-98 active:brightness-90 transition-all"
                style={{
                  backgroundColor: "#4b5563",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  borderRadius: "16px",
                  padding: "12px 20px 12px 20px",
                }}
              >
                {/* Top row: date pill left, status badge right */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className="text-xs font-semibold"
                    style={{
                      backgroundColor: pill.bg,
                      color: pill.color,
                      borderRadius: "999px",
                      padding: "4px 10px",
                    }}
                  >
                    {pill.label}
                  </span>
                  <StatusBadge status={po.status} />
                </div>

                {/* PO number — large, full width below */}
                <p style={{ fontSize: "30px", fontWeight: "800", lineHeight: "1.1" }} className="text-white mt-1">
                  {po.poNumber}
                </p>

                {/* Supplier */}
                <p style={{ fontSize: "17px" }} className="text-gray-300 mt-1">{po.supplierName}</p>

                {/* Progress bar */}
                <ProgressBar received={po.receivedUnits} total={po.totalUnits} />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
