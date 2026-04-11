"use client";

// /src/app/products/location-variant-data/import/components/ClientLocationVariantImportPage.jsx

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import { parseLocationImportCSV } from "../parseLocationImportCSV";
import { setImportData } from "../importLocationStore";

// ─── Field definitions ────────────────────────────────────────────────────────

const FIELD_DEFINITIONS = [
  {
    field:       "Variant ID",
    status:      "required",
    description: "Shopify Variant ID",
    purpose:     "Identifies which variant to update",
    notes:       "Must match shopify_variant_id exactly. Required on every row.",
  },
  {
    field:       "SKU",
    status:      "display",
    description: "Variant's SKU",
    purpose:     "Include in your CSV to help identify the correct variant — not imported",
    notes:       "",
  },
  {
    field:       "Bin Location",
    status:      "optional",
    description: "Physical bin or shelf location for this variant at the selected location",
    purpose:     "Used for warehouse picking and receiving workflows",
    notes:       'Text. Use "/" to clear existing value.',
  },
];

// ─── Example CSV ──────────────────────────────────────────────────────────────

const EXAMPLE_CSV = [
  "Variant ID,SKU,Bin Location",
  '"46417160601818",SUP-SKU-001,Aisle 3 / Bay 2',
].join("\n");

function downloadExampleCSV() {
  const blob = new Blob([EXAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "location_variant_import_example.csv");
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

export default function ClientLocationVariantImportPage({ locations }) {
  const router = useRouter();
  const [file,            setFile]            = useState(null);
  const [locationId,      setLocationId]      = useState("");
  const [unknownHandling, setUnknownHandling] = useState("error");
  const [error,           setError]           = useState(null);
  const [processing,      setProcessing]      = useState(false);

  const selectedLocation = locations.find((l) => l.id === locationId) ?? null;

  async function handleContinue() {
    if (!file)       { setError("Please select a CSV file."); return; }
    if (!locationId) { setError("Please select a location."); return; }
    setProcessing(true);
    setError(null);
    try {
      const text   = await file.text();
      const parsed = parseLocationImportCSV(text);
      if (parsed.rows.length === 0) throw new Error("The CSV file contains no data rows.");
      setImportData(parsed, unknownHandling, locationId, selectedLocation?.name ?? "");
      router.push("/products/location-variant-data/import/review");
    } catch (err) {
      setError(err.message);
      setProcessing(false);
    }
  }

  return (
    <AppLayout
      title="Import Location Variant Data"
      showActionBar={false}
    >
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

        {/* MIDDLE — Location + Unknown Items */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-5 py-4 flex flex-col gap-4" style={{ flex: "1" }}>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a location…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
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
              onClick={() => router.push("/products/location-variant-data")}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleContinue}
              disabled={!file || !locationId || processing}
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
                  <td className="px-3 py-2 font-mono text-xs text-gray-800 whitespace-nowrap">{def.field}</td>
                  <td className="px-3 py-2"><StatusPill status={def.status} /></td>
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
