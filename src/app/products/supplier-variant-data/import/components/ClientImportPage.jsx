"use client";

// /src/app/products/supplier-variant-data/import/components/ClientImportPage.jsx

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import { parseImportCSV } from "../parseImportCSV";
import { setImportData } from "../importSupplierStore";

// ─── Field definitions — order matches the edit page columns ─────────────────

const FIELD_DEFINITIONS = [
  {
    field:       "Variant ID",
    status:      "required",
    description: "Shopify Variant ID",
    purpose:     "Identifies which variant to update",
    notes:       "Must match shopify_variant_id exactly. Required on every row.",
  },
  {
    field:       "SKU (Supplier)",
    status:      "display",
    description: "Variant's SKU",
    purpose:     "Include in your CSV to help identify the correct variant — not imported",
    notes:       "",
  },
  {
    field:       "Barcode (Supplier)",
    status:      "display",
    description: "Variant's barcode",
    purpose:     "Include in your CSV to help identify the correct variant — not imported",
    notes:       "",
  },
  {
    field:       "Item Code (Supplier)",
    status:      "optional",
    description: "Supplier's item code for this variant",
    purpose:     "Alternate item reference used by the supplier",
    notes:       'Use "/" to clear existing value.',
  },
  {
    field:       "Supplier Cost",
    status:      "optional",
    description: "Cost from supplier (numeric)",
    purpose:     "Used in margin calculations and PO costing",
    notes:       'Numeric only. Use "/" to clear.',
  },
  {
    field:       "Initial Average Cost",
    status:      "optional",
    description: "Initial average cost",
    purpose:     "Baseline cost for new inventory",
    notes:       'Numeric. Use "/" to clear.',
  },
  {
    field:       "Min Order Qty",
    status:      "optional",
    description: "Minimum Order Quantity",
    purpose:     "Minimum units required per order",
    notes:       'Integer. Use "/" to clear.',
  },
  {
    field:       "Order in Multiples Of",
    status:      "optional",
    description: "Reorder quantity multiple",
    purpose:     "Order quantities must be multiples of this value",
    notes:       'Integer. Use "/" to clear.',
  },
  {
    field:       "Case Pack Qty",
    status:      "optional",
    description: "Units per case pack",
    purpose:     "Used for order quantity rounding",
    notes:       'Integer. Use "/" to clear.',
  },
  {
    field:       "Inner Pack",
    status:      "optional",
    description: "Units per inner pack",
    purpose:     "Inner pack quantity within a case",
    notes:       'Integer. Use "/" to clear.',
  },
  {
    field:       "Lead Days",
    status:      "optional",
    description: "Lead time in days (override)",
    purpose:     "Used for reorder forecasting",
    notes:       'Integer. Use "/" to clear.',
  },
  {
    field:       "Notes",
    status:      "optional",
    description: "Internal notes for this supplier-variant relationship",
    purpose:     "Anything the supplier wants to add, used for internal reference only",
    notes:       'Use "/" to clear existing value.',
  },
];

// ─── Example CSV ──────────────────────────────────────────────────────────────

const EXAMPLE_CSV = [
  "Variant ID,SKU (Supplier),Barcode (Supplier),Item Code (Supplier),Supplier Cost,Initial Average Cost,Min Order Qty,Order in Multiples Of,Case Pack Qty,Inner Pack,Lead Days,Notes",
  '"46417160601818",SUP-SKU-001,"1234567890123",IC-001,4.99,5.50,100,6,12,3,14,""',
].join("\n");

function downloadExampleCSV() {
  const blob = new Blob([EXAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "supplier_variant_import_example.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Status pills ─────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  if (status === "required") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
        Required
      </span>
    );
  }
  if (status === "display") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
        Display Only
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
      Optional
    </span>
  );
}

// ─── Dropzone ─────────────────────────────────────────────────────────────────

function Dropzone({ file, onFile }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.name.endsWith(".csv")) onFile(dropped);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`h-full border-2 border-dashed rounded-lg p-3 text-center transition-colors flex flex-col items-center justify-center ${
        dragging ? "border-indigo-400 bg-indigo-50" : "border-gray-300 bg-gray-50"
      }`}
    >
      {file ? (
        <div className="space-y-1">
          <div className="text-base">📄</div>
          <p className="text-xs font-medium text-gray-800">{file.name}</p>
          <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
          <button onClick={() => onFile(null)} className="text-xs text-red-500 hover:underline">
            Remove file
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500">Drag and drop a CSV file here, or</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 transition"
          >
            Choose File
          </button>
          <p className="text-xs text-gray-400">CSV files only</p>
        </div>
      )}
      <input ref={inputRef} type="file" accept=".csv" className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] || null)} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientImportPage({ suppliers, lastSyncedAt }) {
  const router = useRouter();
  const [file,            setFile]            = useState(null);
  const [supplierId,      setSupplierId]      = useState("");
  const [unknownHandling, setUnknownHandling] = useState("error");
  const [error,           setError]           = useState(null);
  const [processing,      setProcessing]      = useState(false);
  const [syncing,         setSyncing]         = useState(false);
  const [lastSynced,      setLastSynced]      = useState(lastSyncedAt);
  const [banner,          setBanner]          = useState(null);
  const [downloading,     setDownloading]     = useState(false);

  const selectedSupplier = suppliers.find((s) => s.id === supplierId) ?? null;

  async function handleSync() {
    setSyncing(true);
    setBanner(null);
    try {
      const res  = await fetch("/api/sync/products", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      setLastSynced(data.last_synced_at ?? new Date().toISOString());
      setBanner({ type: "success", message: "Products sync complete." });
    } catch (err) {
      setBanner({ type: "error", message: err.message });
    } finally {
      setSyncing(false);
    }
  }

  async function handleContinue() {
    if (!file)       { setError("Please select a CSV file."); return; }
    if (!supplierId) { setError("Please select a supplier."); return; }
    setProcessing(true);
    setError(null);
    try {
      const text   = await file.text();
      const parsed = parseImportCSV(text);
      if (parsed.rows.length === 0) throw new Error("The CSV file contains no data rows.");
      setImportData(parsed, unknownHandling, supplierId, selectedSupplier?.supplier_name ?? "");
      router.push("/products/supplier-variant-data/import/review");
    } catch (err) {
      setError(err.message);
      setProcessing(false);
    }
  }

  async function handleDownloadCSV() {
    if (!supplierId) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/export-csv`);
      if (!res.ok) throw new Error("Download failed.");
      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const link     = document.createElement("a");
      link.href      = url;
      // Use Content-Disposition filename from server if available, else fallback
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match       = disposition.match(/filename="([^"]+)"/);
      link.setAttribute("download", match?.[1] ?? "supplier-variants.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setBanner({ type: "error", message: err.message });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AppLayout
      title="Import Supplier Variant Info"
      showActionBar={false}
      actions={{
        onSync:       handleSync,
        syncing:      syncing,
        lastSyncedAt: lastSynced,
        syncLabel:    "Sync Products",
      }}
    >
      {banner && (
        <div className={`mb-4 px-4 py-3 rounded-md text-sm font-medium ${
          banner.type === "success"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {banner.message}
        </div>
      )}

      {/* ── TOP ROW ── */}
      <div className="flex gap-4 mb-6 items-stretch">

        {/* LEFT — Instructions */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex flex-col" style={{ flex: "2" }}>
          <h2 className="text-sm font-semibold text-gray-800 mb-3">How to Prepare Your CSV</h2>
          <ul className="space-y-2 flex-1">
            {[
              "Create a CSV file and upload it using the steps below",
              "Include only the variants you want to add or edit",
              "Include only the columns you want to add or edit",
              "Variants not included in your file will remain unchanged",
              <>Enter a single slash <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">/</code> in a field to delete the existing value</>,
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-gray-400 shrink-0 leading-5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* MIDDLE — Supplier + Unknown Items stacked, wider to prevent clipping */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-5 py-4 flex flex-col gap-4" style={{ flex: "1.4" }}>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Supplier</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.supplier_name}{s.supplier_number ? ` (#${s.supplier_number})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unknown Items</label>
            <select
              value={unknownHandling}
              onChange={(e) => setUnknownHandling(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="error">Treat Unknown Items as Errors</option>
              <option value="ignore">Ignore Unknown Items</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {unknownHandling === "error"
                ? "Unrecognized variant IDs will block the import."
                : "Unrecognized variant IDs will be silently skipped."}
            </p>
          </div>

          {/* Download CSV button — only active when a supplier is selected */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500 mb-2">
              Download a CSV of all products for the selected supplier, pre-filled with existing data.
            </p>
            <button
              onClick={handleDownloadCSV}
              disabled={!supplierId || downloading}
              className="w-full px-3 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloading ? "Downloading…" : "Download Supplier CSV"}
            </button>
          </div>
        </div>

        {/* RIGHT — Dropzone + buttons */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3 flex flex-col gap-2" style={{ flex: "1" }}>
          <div className="flex-1">
            <Dropzone file={file} onFile={setFile} />
          </div>
          {error && (
            <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/products/supplier-variant-data")}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleContinue}
              disabled={!file || !supplierId || processing}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {processing ? "Processing…" : "Continue →"}
            </button>
          </div>
        </div>

      </div>

      {/* ── BOTTOM: Field reference table ── */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Supported Import Fields</h2>
          <button
            onClick={downloadExampleCSV}
            className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-md hover:bg-gray-50 transition whitespace-nowrap"
          >
            Download Sample CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-600 whitespace-nowrap">Column Header</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-600 whitespace-nowrap" style={{ minWidth: "110px" }}>Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Description</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Purpose / Usage</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Notes</th>
              </tr>
            </thead>
            <tbody>
              {FIELD_DEFINITIONS.map((def, i) => (
                <tr
                  key={def.field}
                  className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                >
                  <td className="px-3 py-2 font-mono text-xs text-gray-800 whitespace-nowrap">
                    {def.field}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={def.status} />
                  </td>
                  <td className="px-3 py-2 text-gray-700 text-xs">{def.description}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{def.purpose}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{def.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          * Column headers must match exactly. Columns may appear in any order. Missing or blank columns will not overwrite existing data.
        </p>
      </div>

    </AppLayout>
  );
}
