"use client";

// src/app/mobile/pos/[slug]/receive/components/MobileReceiveScreen.jsx

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type = "info", onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);
  const colors = { success: "bg-green-600", error: "bg-red-600", info: "bg-gray-800", blue: "bg-blue-600", warning: "bg-amber-500" };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none`}>
      <div className={`rounded-2xl px-8 py-5 text-white text-xl font-semibold shadow-lg flex items-center gap-2 ${colors[type] ?? colors.info}`}>
        {type === "success" && (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
          </svg>
        )}
        {type === "error" && (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
        )}
        <span>{message}</span>
      </div>
    </div>
  );
}

// ─── Scanner overlay ──────────────────────────────────────────────────────────

function ScannerView({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [cameraError, setCameraError] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const streamRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function startScanner() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/library");
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } });
        streamRef.current = stream;
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        reader.decodeFromStream(stream, videoRef.current, (result) => { if (result && active) onDetected(result.getText()); });
      } catch (err) { if (active) setCameraError(err.message || "Camera unavailable"); }
    }
    startScanner();
    return () => { active = false; readerRef.current?.reset(); streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [onDetected]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try { await track.applyConstraints({ advanced: [{ torch: !torchOn }] }); setTorchOn((v) => !v); } catch {}
  }

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-4 px-8 text-center">
            <p className="text-sm opacity-70">Camera unavailable</p>
            <p className="text-xs opacity-50">{cameraError}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-64 h-40">
                {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos, i) => (
                  <div key={i} className={`absolute w-8 h-8 border-white border-opacity-80 ${pos} ${i===0?"border-t-2 border-l-2 rounded-tl-md":i===1?"border-t-2 border-r-2 rounded-tr-md":i===2?"border-b-2 border-l-2 rounded-bl-md":"border-b-2 border-r-2 rounded-br-md"}`} />
                ))}
              </div>
            </div>
            <div className="absolute inset-0 bg-black/40 pointer-events-none" style={{ maskImage: "radial-gradient(ellipse 280px 180px at center, transparent 0%, black 100%)", WebkitMaskImage: "radial-gradient(ellipse 280px 180px at center, transparent 0%, black 100%)" }} />
          </>
        )}
      </div>
      <div className="bg-black px-5 py-5 flex items-center justify-between safe-area-bottom">
        <button onClick={onClose} className="text-white text-sm font-medium opacity-70 active:opacity-100">Cancel</button>
        <p className="text-white text-xs opacity-50">Point camera at barcode</p>
        <button onClick={toggleTorch} className="text-white opacity-70 active:opacity-100">
          <svg xmlns="http://www.w3.org/2000/svg" fill={torchOn ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Receive form (full-screen when expanded) ─────────────────────────────────

function ReceiveForm({ line, onSave, onScan }) {
  const remaining = line.orderQtyUnits - line.receivedQtyUnits;
  const alreadyDone = remaining <= 0;
  const [qty, setQty] = useState(remaining === 1 ? "1" : "");
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Auto-focus removed — user must tap the field to trigger the number pad
  }, [alreadyDone]);

  const parsedQty = parseInt(qty, 10);
  const isValid = !isNaN(parsedQty) && parsedQty > 0;

  function validate(value) {
    const n = parseInt(value, 10);
    if (isNaN(n) || n <= 0) { setError("Enter a quantity greater than 0"); return false; }
    if (n > remaining) { setError(`Cannot exceed remaining qty (${remaining})`); return false; }
    setError(null);
    return true;
  }

  function handleQtyChange(e) {
    const val = e.target.value.replace(/[^0-9]/g, "");
    setQty(val);
    if (val) validate(val);
    else setError(null);
  }

  function handleQuickAdd(amount) {
    const current = parseInt(qty, 10) || 0;
    setQty(String(Math.min(current + amount, remaining)));
    setError(null);
  }

  function handleSave() {
    if (!validate(qty)) return;
    onSave({ line, qty: parsedQty, notes: "", andNext: false });
    setQty("");
    setError(null);
  }

  function handleScan() {
    if (isValid) {
      onSave({ line, qty: parsedQty, notes: "", andNext: false, thenScan: true });
    } else {
      onScan();
    }
  }

  if (alreadyDone) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: "96px", height: "96px" }} className="text-green-500">
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
        </svg>
        <p className="font-bold text-gray-800" style={{ fontSize: "36px" }}>Fully received</p>
        <p className="text-gray-500" style={{ fontSize: "20px" }}>All {line.orderQtyUnits} units received.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-2 px-4 py-3">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Received", value: line.receivedQtyUnits },
          { label: "Remaining", value: remaining },
        ].map(({ label, value }) => (
          <div key={label} className="text-center rounded-xl py-2 flex flex-col justify-center" style={{ backgroundColor: "#e5e7eb", minHeight: "64px" }}>
            <p className="font-bold leading-none text-gray-800" style={{ fontSize: "32px" }}>{value}</p>
            <p className="font-semibold text-gray-600 mt-0.5" style={{ fontSize: "13px" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Qty input */}
      <style>{`#qty-input::placeholder { font-size: 18px; }`}</style>
      <input
        id="qty-input"
        ref={inputRef}
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min="1"
        max={remaining}
        value={qty}
        onChange={handleQtyChange}
        placeholder="Enter Quantity"
        className={`w-full text-center font-bold focus:outline-none transition-colors ${error ? "border-red-400 text-red-500 bg-red-50" : "border-gray-300 text-gray-800 bg-gray-50 focus:border-blue-400"}`}
        style={{ fontSize: "52px", lineHeight: "1", paddingTop: "20px", paddingBottom: "22px", borderRadius: "16px", border: "2px solid" }}
      />
      {error && <p className="text-sm text-red-500 text-center -mt-1">{error}</p>}

      {/* +1 / +5 */}
      <div className="flex gap-2">
        <button onClick={() => handleQuickAdd(1)} className="flex-1 font-bold active:opacity-70 text-gray-700" style={{ backgroundColor: "#e5e7eb", fontSize: "28px", padding: "12px 0", borderRadius: "14px" }}>+1</button>
        {remaining >= 5 && (
          <button onClick={() => handleQuickAdd(5)} className="flex-1 font-bold active:opacity-70 text-gray-700" style={{ backgroundColor: "#e5e7eb", fontSize: "28px", padding: "12px 0", borderRadius: "14px" }}>+5</button>
        )}
      </div>

      {/* All — own row */}
      {remaining > 1 && (
        <button onClick={() => { setQty(String(remaining)); setError(null); }} className="w-full font-bold active:opacity-70" style={{ backgroundColor: "#dbeafe", color: "#1d4ed8", fontSize: "28px", padding: "12px 0", borderRadius: "14px" }}>
          All ({remaining})
        </button>
      )}

      {/* Save / Scan */}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={!isValid}
          className={`flex-1 font-bold transition-all ${isValid ? "active:opacity-80" : "opacity-40 cursor-not-allowed"}`}
          style={{ backgroundColor: "#e5e7eb", color: "#1f2937", fontSize: "24px", padding: "14px 0", borderRadius: "14px" }}>
          Save
        </button>
        <button onClick={handleScan}
          className="flex-1 font-bold transition-all active:opacity-80"
          style={{ backgroundColor: "#e5e7eb", color: "#1f2937", fontSize: "24px", padding: "14px 0", borderRadius: "14px" }}>
          Scan
        </button>
      </div>
    </div>
  );
}

// ─── Collapsed item row ───────────────────────────────────────────────────────

function ItemRow({ line, onSelect }) {
  const remaining = line.orderQtyUnits - line.receivedQtyUnits;
  const done = remaining <= 0;

  return (
    <button
      className="flex items-center gap-4 w-full text-left"
      style={{ backgroundColor: "#4b5563", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", borderRadius: "12px", padding: "12px 16px" }}
      onClick={() => onSelect(line)}
    >
      <div className="rounded-lg flex-shrink-0 overflow-hidden" style={{ width: "48px", height: "48px", backgroundColor: "rgba(255,255,255,0.1)" }}>
        {(line.variantImageSrc || line.productImageSrc) ? (
          <img src={line.variantImageSrc || line.productImageSrc} alt={line.displayTitle || line.productTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-medium text-white">{line.displayTitle || line.productTitle}</p>
        {line.sku && <p className="text-xl text-white mt-0.5">{line.sku}</p>}
      </div>
      {done && (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="flex-shrink-0" style={{ width: "44px", height: "44px", color: "#4ade80" }}>
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MobileReceiveScreen({ po, initialLines }) {
  const router = useRouter();
  const [lines, setLines] = useState(initialLines);
  const [selectedLine, setSelectedLine] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const lastScanRef = useRef({ barcode: null, lineId: null, at: 0 });

  function showToast(message, type = "info") {
    setToast({ message, type, key: Date.now() });
  }

  const handleBarcode = useCallback((barcode) => {
    const match = lines.find((l) => l.barcode && l.barcode.toLowerCase() === barcode.toLowerCase());
    if (!match) { showToast(`No item found for barcode: ${barcode}`, "error"); return; }
    const remaining = match.orderQtyUnits - match.receivedQtyUnits;
    const now = Date.now();
    const last = lastScanRef.current;
    if (last.barcode === barcode && last.lineId === match.id && now - last.at < 3000 && remaining > 0) {
      lastScanRef.current = { barcode, lineId: match.id, at: now };
      doSave({ line: match, qty: 1, notes: "", andNext: false, autoIncrement: true });
      return;
    }
    lastScanRef.current = { barcode, lineId: match.id, at: now };
    if (remaining <= 0) { showToast(`${match.productTitle} — already fully received`, "warning"); return; }
    setShowScanner(false);
    setSelectedLine(match);
  }, [lines]);

  const filteredLines = search.trim()
    ? lines.filter((l) =>
        (l.displayTitle || l.productTitle).toLowerCase().includes(search.toLowerCase()) ||
        l.sku.toLowerCase().includes(search.toLowerCase()) ||
        (l.barcode && l.barcode.toLowerCase().includes(search.toLowerCase()))
      )
    : lines;

  async function doSave({ line, qty, notes, andNext, autoIncrement = false, thenScan = false }) {
    setSaving(true);
    const newReceived = line.receivedQtyUnits + qty;
    const newRemaining = line.orderQtyUnits - newReceived;
    // Optimistic UI updates
    setLines((prev) => prev.map((l) => l.id === line.id ? { ...l, receivedQtyUnits: newReceived } : l));
    setSelectedLine((prev) => prev && prev.id === line.id ? { ...prev, receivedQtyUnits: newReceived } : prev);
    if (newRemaining > 0) showToast("Saved", "blue");
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: [{ lineId: line.id, qtyToReceive: qty }] }),
      });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || "Save failed"); }
      const data = await res.json().catch(() => ({}));
      const lineResult = (data.results ?? []).find((r) => r.lineId === line.id);
      const confirmedReceived = lineResult?.received_qty_units ?? newReceived;
      // Reconcile with server value if different
      setLines((prev) => {
        const updatedLines = prev.map((l) => l.id === line.id ? { ...l, receivedQtyUnits: confirmedReceived } : l);
        if (updatedLines.every((l) => l.receivedQtyUnits >= l.orderQtyUnits)) {
          setTimeout(() => router.push(`/mobile/pos/${po.poNumber}/finalize`), 1200);
        }
        return updatedLines;
      });
      setSelectedLine((prev) => prev && prev.id === line.id ? { ...prev, receivedQtyUnits: confirmedReceived } : prev);
      if (thenScan) setShowScanner(true);
      if (andNext) setSelectedLine(null);
    } catch (err) {
      showToast(err.message || "Could not save — try again", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Expanded item view ────────────────────────────────────────────────────
  if (selectedLine) {
    return (
      <>
        {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
        {showScanner && <ScannerView onDetected={handleBarcode} onClose={() => setShowScanner(false)} />}

        <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: "#e5e7eb" }}>

          {/* Slim header — PO# same size as normal header */}
          <div className="px-4 pt-2">
            <div className="flex items-center justify-center" style={{ backgroundColor: "#1f2937", borderRadius: "12px", padding: "8px 20px" }}>
              <span className="font-bold" style={{
                fontSize: "22px",
                background: "linear-gradient(to right, #11E0FC, #0099FF)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                {po.poNumber}
              </span>
            </div>
          </div>

          {/* White card — item title + form — takes all space between header and footer */}
          <div className="flex-1 flex flex-col overflow-hidden px-4 py-3">
            <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-2xl px-4 py-3 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
              {/* Item title bar */}
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-xl flex-shrink-0 overflow-hidden" style={{ width: "64px", height: "64px", backgroundColor: "#e5e7eb" }}>
                  {(selectedLine.variantImageSrc || selectedLine.productImageSrc) ? (
                    <img src={selectedLine.variantImageSrc || selectedLine.productImageSrc} alt={selectedLine.displayTitle || selectedLine.productTitle} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-gray-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-semibold text-gray-800">{selectedLine.displayTitle || selectedLine.productTitle}</p>
                  {selectedLine.sku && <p className="text-lg text-gray-500">{selectedLine.sku}</p>}
                </div>
              </div>
              <ReceiveForm
                line={selectedLine}
                onSave={(args) => doSave(args)}
                onScan={() => setShowScanner(true)}
              />
            </div>
          </div>

          {/* Bottom card — Return to Item List */}
          <div className="px-4 pb-4">
            <button
              onClick={() => setSelectedLine(null)}
              className="w-full flex items-center justify-center font-bold text-white active:opacity-80 transition-all"
              style={{ backgroundColor: "#1f2937", borderRadius: "12px", padding: "12px 20px", fontSize: "20px" }}
            >
              ← Return to Item List
            </button>
          </div>

        </div>
      </>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <>
      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
      {showScanner && <ScannerView onDetected={handleBarcode} onClose={() => setShowScanner(false)} />}

      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#e5e7eb" }}>

        {/* Full header */}
        <div className="px-4 pt-5">
          <div style={{ backgroundColor: "#1f2937", borderRadius: "16px" }} className="text-white px-5 pt-4 pb-5">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => router.push(`/mobile/pos/${po.poNumber}`)} className="flex items-center gap-1.5 text-gray-400 text-sm active:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
                {po.poNumber}
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold" style={{ background: "linear-gradient(to right, #11E0FC, #0099FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Stock Buddy</span>
                <span className="text-xs text-gray-400">v1.0</span>
              </div>
            </div>
            <div className="flex justify-center mb-4">
              <div className="flex flex-col items-start">
                <h1 className="text-4xl font-bold" style={{ background: "linear-gradient(to right, #11E0FC, #0099FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{po.poNumber}</h1>
                <p className="text-sm text-gray-400 mt-1">{po.supplierName}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button onClick={() => router.push(`/mobile/pos/${po.poNumber}`)} className="text-xs font-semibold border rounded-full px-3 py-1 active:opacity-70 transition-all" style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.4)" }}>Pause</button>
              <span className="text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">Receiving</span>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 pt-4 pb-2 flex gap-2">
          <input
            type="search"
            placeholder="Search by SKU or product name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          <button onClick={() => setShowScanner(true)} disabled={saving} className="text-white rounded-xl px-4 py-3 font-semibold text-base active:opacity-80 transition-all shadow-sm flex-shrink-0" style={{ backgroundColor: "#0099FF" }}>
            Scan
          </button>
        </div>

        {/* Item cards */}
        <div className="px-4 pt-2 pb-8 space-y-2">
          {filteredLines.map((line) => (
            <ItemRow key={line.id} line={line} onSelect={setSelectedLine} />
          ))}
        </div>

      </div>
    </>
  );
}
