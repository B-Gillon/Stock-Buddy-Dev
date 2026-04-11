"use client";

// /src/app/products/location-variant-data/edit/components/ClientLocationVariantEditPage.jsx

import { useState, useMemo } from "react";
import AppLayout from "@/shared/components/layout/AppLayout";
import SortIcon from "@/shared/components/icons/SortIcon";

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded shadow-lg z-[100] pointer-events-none">
      {message}
    </div>
  );
}

// ─── Cell ─────────────────────────────────────────────────────────────────────

function CellValue({ value }) {
  if (value == null || value === "") return <span className="text-gray-300 text-xs">—</span>;
  return <span className="text-gray-800 text-xs">{value}</span>;
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS = [
  { key: "variant_title",   label: "Product",      readOnly: true,  sortable: true  },
  { key: "variant_sku",     label: "SKU",          readOnly: true,  sortable: true  },
  { key: "variant_barcode", label: "Barcode",      readOnly: true,  sortable: true  },
  { key: "location_name",   label: "Location",     readOnly: true,  sortable: true  },
  { key: "bin_location",    label: "Bin Location", readOnly: false, sortable: true  },
];

// ─── Editable cell ────────────────────────────────────────────────────────────

function EditableCell({ colKey, value, onChange }) {
  return (
    <input
      type="text"
      autoComplete="off"
      value={value ?? ""}
      onChange={(e) => onChange(colKey, e.target.value)}
      className="w-full border border-indigo-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
      style={{ minWidth: "120px" }}
      placeholder="Enter bin location…"
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function ClientLocationVariantEditPage({
  locations   = [],
  initialRows = [],
  categories  = [],
  collections = [],
}) {
  // ── Location name lookup ──────────────────────────────────────────────────
  const locationMap = useMemo(() => {
    const map = {};
    locations.forEach((l) => { map[l.id] = l.name; });
    return map;
  }, [locations]);

  // Enrich rows with location_name for display/sorting
  const enrichedInitialRows = useMemo(() =>
    initialRows.map((r) => ({
      ...r,
      location_name: locationMap[r.location_id] ?? r.location_id,
    })),
  [initialRows, locationMap]);

  // ── Draft filter state ────────────────────────────────────────────────────
  const [selectedLocation,   setSelectedLocation]   = useState("");
  const [selectedCategory,   setSelectedCategory]   = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [search,             setSearch]             = useState("");

  // ── Applied filter state ──────────────────────────────────────────────────
  const [appliedLocation,   setAppliedLocation]   = useState("");
  const [appliedCategory,   setAppliedCategory]   = useState("");
  const [appliedCollection, setAppliedCollection] = useState("");
  const [appliedSearch,     setAppliedSearch]     = useState("");

  // ── Table state ───────────────────────────────────────────────────────────
  const [submitted,   setSubmitted]   = useState(false);
  const [sortKey,     setSortKey]     = useState("variant_title");
  const [sortDir,     setSortDir]     = useState("asc");
  const [page,        setPage]        = useState(1);
  const [editingRows, setEditingRows] = useState({});
  const [savedValues, setSavedValues] = useState({});

  // ── UI state ──────────────────────────────────────────────────────────────
  const [banner, setBanner] = useState(null);
  const [toast,  setToast]  = useState(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function handleSubmit() {
    if (!selectedLocation) return;
    setAppliedLocation(selectedLocation);
    setAppliedCategory(selectedCategory);
    setAppliedCollection(selectedCollection);
    setAppliedSearch(search);
    setEditingRows({});
    setPage(1);
    setSubmitted(true);
  }

  function handleLocationChange(e) {
    setSelectedLocation(e.target.value);
    setSubmitted(false);
    setEditingRows({});
    setPage(1);
  }

  function handleCategoryChange(e)   { setSelectedCategory(e.target.value); }
  function handleCollectionChange(e) { setSelectedCollection(e.target.value); }
  function handleSearchChange(e)     { setSearch(e.target.value); }

  // ── Sort ──────────────────────────────────────────────────────────────────
  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  function startEditing(row) {
    setEditingRows((prev) => ({
      ...prev,
      [row.id]: { bin_location: row.bin_location ?? "" },
    }));
  }

  function cancelEditing(id) {
    setEditingRows((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleFieldChange(id, key, value) {
    setEditingRows((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  }

  async function saveRow(row) {
    const draft = editingRows[row.id];
    if (!draft) return;

    try {
      const res = await fetch("/api/products/location-variant-data/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId:   row.variant_id,
          locationId:  row.location_id,
          binLocation: draft.bin_location ?? "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Save failed.");

      cancelEditing(row.id);
      setSavedValues((prev) => ({
        ...prev,
        [row.id]: { bin_location: draft.bin_location ?? "" },
      }));
      showToast("Saved");
    } catch (err) {
      setBanner({ type: "error", message: err.message });
    }
  }

  // ── Filter + sort + paginate ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = enrichedInitialRows;

    if (appliedLocation)
      result = result.filter((r) => r.location_id === appliedLocation);
    if (appliedCategory)
      result = result.filter((r) => r.product_category === appliedCategory);
    if (appliedCollection)
      result = result.filter((r) => r.product_collection === appliedCollection);
    if (appliedSearch) {
      const s = appliedSearch.toLowerCase();
      result = result.filter((r) =>
        (r.variant_title    ?? "").toLowerCase().includes(s) ||
        (r.variant_sku      ?? "").toLowerCase().includes(s) ||
        (r.variant_barcode  ?? "").toLowerCase().includes(s) ||
        (r.product_title    ?? "").toLowerCase().includes(s)
      );
    }

    return [...result].sort((a, b) => {
      let av = a[sortKey] ?? "";
      let bv = b[sortKey] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [enrichedInitialRows, appliedLocation, appliedCategory, appliedCollection, appliedSearch, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function cellValue(row, key) {
    if (editingRows[row.id] && key in editingRows[row.id]) return editingRows[row.id][key];
    if (savedValues[row.id] && key in savedValues[row.id]) return savedValues[row.id][key];
    return row[key];
  }

  return (
    <AppLayout title="Location Variant Data — Editor" showActionBar={false}>

      {banner && (
        <div className={`mb-4 px-4 py-3 rounded-md text-sm font-medium ${
          banner.type === "success"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {banner.message}
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-5 py-4 mb-4 flex flex-wrap items-end gap-3">

        {/* Location */}
        <div className="flex flex-col gap-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-500">Location</label>
          <select
            value={selectedLocation}
            onChange={handleLocationChange}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition"
          >
            <option value="">Select a location…</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1 min-w-[140px] flex-1">
          <label className="text-xs font-medium text-gray-500">Category</label>
          <select
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition"
          >
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Collection */}
        <div className="flex flex-col gap-1 min-w-[160px] flex-1">
          <label className="text-xs font-medium text-gray-500">Collection</label>
          <select
            value={selectedCollection}
            onChange={handleCollectionChange}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition"
          >
            <option value="">All Collections</option>
            {collections.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Search */}
        <div className="flex flex-col gap-1 min-w-[200px] flex-[2]">
          <label className="text-xs font-medium text-gray-500">Search</label>
          <input
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search product, SKU, barcode…"
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition"
          />
        </div>

        {/* Submit */}
        <div className="flex flex-col justify-end">
          <button
            onClick={handleSubmit}
            disabled={!selectedLocation}
            className="px-5 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition whitespace-nowrap"
          >
            Submit
          </button>
        </div>

      </div>

      {/* ── Empty state / Table ── */}
      {!submitted ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-10 text-center text-gray-400 text-sm">
          Select a location and click{" "}
          <span className="font-medium text-gray-600">Submit</span> to load variants.
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-2">
            {filtered.length} variant{filtered.length !== 1 ? "s" : ""}
          </p>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-200 border-b border-gray-300 divide-x divide-gray-300">
                    <th className="px-2 py-2 text-xs font-medium text-gray-700 w-20 text-left">Action</th>
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => col.sortable && handleSort(col.key)}
                        className={`text-left px-2 py-2 text-xs font-medium text-gray-700 whitespace-nowrap select-none transition ${
                          col.sortable ? "cursor-pointer hover:bg-gray-300" : "cursor-default"
                        }`}
                      >
                        {col.label}
                        {col.sortable && (
                          <SortIcon direction={sortKey === col.key ? sortDir : null} />
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} className="px-4 py-10 text-center text-gray-400 text-sm">
                        No variants match the current filters.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => {
                      const isEditing = !!editingRows[row.id];
                      return (
                        <tr
                          key={row.id}
                          className={`border-b border-gray-100 divide-x divide-gray-100 transition-colors ${
                            isEditing ? "bg-indigo-50" : "bg-white hover:bg-gray-50"
                          }`}
                        >
                          <td className="px-2 py-2 whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => saveRow(row)}
                                  className="px-2 py-0.5 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => cancelEditing(row.id)}
                                  className="px-2 py-0.5 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEditing(row)}
                                className="px-2 py-0.5 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition"
                              >
                                Edit
                              </button>
                            )}
                          </td>
                          {COLUMNS.map((col) => {
                            const val = cellValue(row, col.key);
                            if (col.readOnly) {
                              return (
                                <td key={col.key} className="px-2 py-2 whitespace-nowrap">
                                  <CellValue value={val} />
                                </td>
                              );
                            }
                            return (
                              <td key={col.key} className="px-2 py-2 whitespace-nowrap">
                                {isEditing ? (
                                  <EditableCell
                                    colKey={col.key}
                                    value={editingRows[row.id]?.[col.key]}
                                    onChange={(k, v) => handleFieldChange(row.id, k, v)}
                                  />
                                ) : (
                                  <CellValue value={val} />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                ← Previous
              </button>
              <span className="text-xs text-gray-500">Page {safePage} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      <Toast message={toast} />
    </AppLayout>
  );
}
