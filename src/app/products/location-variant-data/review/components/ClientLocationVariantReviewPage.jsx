"use client";

// /src/app/products/location-variant-data/import/review/components/ClientLocationVariantReviewPage.jsx

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import { getImportData, clearImportData } from "../../import/importLocationStore";
import { validateLocationImportRows, canSubmit } from "../../import/validateLocationImportRows";
import { DELETE_MARKER, SUPPORTED_FIELDS, REQUIRED_FIELD, FIELD_MAP } from "../../import/parseLocationImportCSV";

// ─── Cell display ─────────────────────────────────────────────────────────────

/**
 * Renders a cell with colour coding:
 *   - undefined       → grey dash, no change
 *   - DELETE_MARKER   → red "Will Delete" badge
 *   - value === existing → plain black, no change
 *   - value !== existing → green badge, this field is changing
 */
function CellValue({ value, existingValue }) {
  if (value === undefined) {
    return <span className="text-gray-300 text-xs">—</span>;
  }
  if (value === DELETE_MARKER) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-200">
        Will Delete
      </span>
    );
  }

  const normalize = (v) => (v == null ? "" : String(v).trim());
  const isChanged = normalize(value) !== normalize(existingValue);

  return isChanged ? (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
      {value}
    </span>
  ) : (
    <span className="text-gray-800 text-xs">{value}</span>
  );
}

function RowStatusBadge({ status }) {
  if (status === "valid")   return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">Valid</span>;
  if (status === "unknown") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">Unknown</span>;
  if (status === "skipped") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">Skipped</span>;
  if (status === "error")   return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">Error</span>;
  return null;
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded shadow-lg z-[100] pointer-events-none">
      {message}
    </div>
  );
}

const COLUMN_LABELS = {
  "Bin Location": "Bin Location",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientLocationVariantReviewPage({ knownVariantIds }) {
  const router = useRouter();
  const [rows,                setRows]                = useState([]);
  const [unknownHandling,     setUnknownHandling]     = useState("error");
  const [dataColumns,         setDataColumns]         = useState([]);
  const [locationId,          setLocationId]          = useState(null);
  const [locationName,        setLocationName]        = useState("");
  const [submitting,          setSubmitting]          = useState(false);
  const [submitError,         setSubmitError]         = useState(null);
  const [toast,               setToast]               = useState(null);
  const [ready,               setReady]               = useState(false);
  // Existing DB values keyed by shopify_variant_id string → { bin_location: string|null }
  const [existingByVariantId, setExistingByVariantId] = useState({});

  useEffect(() => {
    const { parsedData, unknownHandling: uh, locationId: lid, locationName: lname } = getImportData();

    if (!parsedData) {
      router.replace("/products/location-variant-data/import");
      return;
    }

    const knownSet      = new Set(knownVariantIds.map(String));
    const validated     = validateLocationImportRows(parsedData.rows, knownSet, uh);
    const presentFields = SUPPORTED_FIELDS.filter(
      (f) => f !== REQUIRED_FIELD && parsedData.headers.includes(f)
    );

    setRows(validated);
    setUnknownHandling(uh);
    setLocationId(lid);
    setLocationName(lname ?? "");
    setDataColumns(presentFields);
    setReady(true);

    // Fetch existing bin location data for diff comparison
    if (lid) {
      fetch(`/api/locations/${lid}/export-csv`)
        .then((r) => r.text())
        .then((csvText) => {
          // Parse the CSV response into a lookup map
          const lines = csvText.split(/\r?\n/).filter(Boolean);
          if (lines.length < 2) return;
          // headers: Variant ID, SKU, Bin Location
          const byId = {};
          for (let i = 1; i < lines.length; i++) {
            const cols = parseSimpleCSVLine(lines[i]);
            const variantId  = cols[0]?.replace(/^"|"$/g, "").trim();
            const binLocation = cols[2] ?? null;
            if (variantId) byId[variantId] = { bin_location: binLocation || null };
          }
          setExistingByVariantId(byId);
        })
        .catch(() => {});
    }
  }, []);

  // Minimal CSV line parser for reading back the export CSV
  function parseSimpleCSVLine(line) {
    const result = [];
    let current  = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleVariantIdChange(rowIndex, newValue) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex !== rowIndex) return r;
        const knownSet = new Set(knownVariantIds.map(String));
        const isKnown  = knownSet.has(newValue.trim());
        return {
          ...r,
          variant_id:   newValue,
          status:       !newValue.trim() ? "error" : isKnown ? "valid" : unknownHandling === "ignore" ? "skipped" : "unknown",
          errorMessage: !newValue.trim()
            ? "Missing required variant_id."
            : isKnown ? null
            : `Variant ID "${newValue.trim()}" not found in database.`,
        };
      })
    );
  }

  const submitEnabled = ready && canSubmit(rows, unknownHandling) && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    const rowsToImport = rows.filter((r) => r.status === "valid");
    try {
      const res = await fetch("/api/products/location-variant-data/import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rows: rowsToImport, location_id: locationId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Import failed. Please try again.");
      }
      clearImportData();
      showToast("Import successful!");
      setTimeout(() => { window.location.replace("/products"); }, 1200);
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  }

  const validCount    = rows.filter((r) => r.status === "valid").length;
  const unknownCount  = rows.filter((r) => r.status === "unknown").length;
  const skippedCount  = rows.filter((r) => r.status === "skipped").length;
  const errorCount    = rows.filter((r) => r.status === "error").length;
  const blockingCount = unknownCount + errorCount;

  if (!ready) {
    return (
      <AppLayout title="Review Import">
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading…</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Review Import">

      {/* ── Page header ── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/products/location-variant-data/import")}
          className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 transition shrink-0"
        >
          ←
        </button>
        <h1 className="text-lg font-semibold text-gray-800">Review Import</h1>
        {locationName && (
          <span className="text-sm text-gray-500 font-normal">
            for <span className="font-medium text-gray-700">{locationName}</span>
          </span>
        )}
      </div>

      {/* ── Summary bar ── */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          <span className="text-gray-700 font-medium">{validCount}</span>
          <span className="text-gray-500">valid</span>
        </div>
        {unknownCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            <span className="text-gray-700 font-medium">{unknownCount}</span>
            <span className="text-gray-500">unknown</span>
          </div>
        )}
        {skippedCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
            <span className="text-gray-700 font-medium">{skippedCount}</span>
            <span className="text-gray-500">skipped</span>
          </div>
        )}
        {errorCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-red-700 inline-block" />
            <span className="text-gray-700 font-medium">{errorCount}</span>
            <span className="text-gray-500">errors</span>
          </div>
        )}
        {blockingCount > 0 && unknownHandling === "error" && (
          <span className="ml-auto text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-md font-medium">
            Resolve {blockingCount} issue{blockingCount !== 1 ? "s" : ""} before submitting
          </span>
        )}
      </div>

      {submitError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {submitError}
        </div>
      )}

      {/* ── Review table ── */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-200 border-b border-gray-300 divide-x divide-gray-300">
                <th className="text-left px-2 py-2 text-xs font-medium text-gray-700">Status</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-gray-700">Row</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-gray-700">Variant ID</th>
                {dataColumns.map((col) => (
                  <th key={col} className="text-left px-2 py-2 text-xs font-medium text-gray-700 whitespace-nowrap">
                    {COLUMN_LABELS[col] || col}
                  </th>
                ))}
                <th className="text-left px-2 py-2 text-xs font-medium text-gray-700">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isProblematic = row.status === "unknown" || row.status === "error";
                const existing      = existingByVariantId[String(row.variant_id)] ?? null;

                return (
                  <tr
                    key={row.rowIndex}
                    className={`border-b border-gray-100 divide-x divide-gray-100 ${
                      row.status === "valid"   ? "bg-white" :
                      row.status === "skipped" ? "bg-gray-50 opacity-60" :
                      isProblematic            ? "bg-red-50" : "bg-white"
                    }`}
                  >
                    <td className="px-2 py-2 whitespace-nowrap"><RowStatusBadge status={row.status} /></td>
                    <td className="px-2 py-2 text-gray-400 text-xs">{row.rowIndex}</td>
                    <td className="px-2 py-2">
                      {isProblematic ? (
                        <input
                          type="text"
                          value={row.variant_id}
                          onChange={(e) => handleVariantIdChange(row.rowIndex, e.target.value)}
                          className="w-full border border-red-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                          title="Edit variant ID to fix this row"
                        />
                      ) : (
                        <span className="text-xs text-gray-700">{row.variant_id}</span>
                      )}
                    </td>
                    {dataColumns.map((col) => {
                      const dbCol      = FIELD_MAP[col]; // "Bin Location" → "bin_location"
                      const existingVal = existing ? existing[dbCol] ?? null : null;
                      return (
                        <td key={col} className="px-2 py-2 whitespace-nowrap">
                          <CellValue value={row.fields[col]} existingValue={existingVal} />
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-xs text-red-600">{row.errorMessage || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Action bar ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { clearImportData(); router.push("/products"); }}
          className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!submitEnabled}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Importing…
            </>
          ) : (
            `Submit Import (${validCount} row${validCount !== 1 ? "s" : ""})`
          )}
        </button>
      </div>

      <Toast message={toast} />
    </AppLayout>
  );
}
