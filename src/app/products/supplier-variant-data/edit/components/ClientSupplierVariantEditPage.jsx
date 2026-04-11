"use client";

// /src/app/products/supplier-variant-data/edit/components/ClientSupplierVariantEditPage.jsx

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

// ─── Currency helpers ─────────────────────────────────────────────────────────

function getCurrencySymbol(currency) {
  if (!currency) return "$";
  try {
    return (0)
      .toLocaleString("en", { style: "currency", currency, minimumFractionDigits: 0 })
      .replace(/[\d,. ]/g, "").trim() || "$";
  } catch { return "$"; }
}

function formatCurrency(value, symbol) {
  if (value == null) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return `${symbol}${num.toFixed(2)}`;
}

// ─── Cell ─────────────────────────────────────────────────────────────────────

function CellValue({ value }) {
  if (value == null || value === "") return <span className="text-gray-300 text-xs">—</span>;
  return <span className="text-gray-800 text-xs">{value}</span>;
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS = [
  { key: "variant_display_title", label: "Product",                            readOnly: true,  sortable: true  },
  { key: "variant_sku",           label: "Supplier SKU",                       readOnly: true,  sortable: true  },
  { key: "variant_barcode",       label: "Barcode",                            readOnly: true,  sortable: false },
  { key: "item_code",             label: "Item Code",                          readOnly: false, sortable: false },
  { key: "cost",                  label: "Cost",            currency: true,    readOnly: false, sortable: true  },
  { key: "initial_average_cost",  label: ["Initial", "Avg Cost"], currency: true, readOnly: false, sortable: false },
  { key: "moq",                   label: "Min Order Qty",                      readOnly: false, sortable: false },
  { key: "order_increment",       label: ["Order In", "Multiples Of"],         readOnly: false, sortable: false },
  { key: "case_pack",             label: "Case Pack",                          readOnly: false, sortable: false },
  { key: "inner_pack",            label: "Inner Pack",                         readOnly: false, sortable: false },
  { key: "lead_days",             label: "Lead Days",                          readOnly: false, sortable: false },
  { key: "notes",                 label: "Notes",                              readOnly: false, sortable: false },
];

const NUMERIC_FIELDS = new Set([
  "cost", "moq", "case_pack", "inner_pack",
  "order_increment", "lead_days", "initial_average_cost",
]);

// ─── Editable cell ────────────────────────────────────────────────────────────

function EditableCell({ colKey, value, onChange, currencySymbol }) {
  const isNumeric  = NUMERIC_FIELDS.has(colKey);
  const isCurrency = colKey === "cost" || colKey === "initial_average_cost";
  return (
    <div className="relative flex items-center">
      {isCurrency && (
        <span className="absolute left-2 text-xs text-gray-500 pointer-events-none select-none">
          {currencySymbol}
        </span>
      )}
      <input
        type={isNumeric ? "number" : "text"}
        autoComplete="off"
        value={value ?? ""}
        onChange={(e) => onChange(colKey, e.target.value)}
        className={`w-full border border-indigo-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white ${isCurrency ? "pl-5" : ""}`}
        style={{ minWidth: "70px" }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function ClientSupplierVariantEditPage({
  suppliers    = [],
  initialRows  = [],
  categories   = [],
  collections  = [],
  lastSyncedAt = null,
}) {
  // ── Draft filter state — what the controls show ───────────────────────────
  const [selectedSupplier,   setSelectedSupplier]   = useState("");
  const [selectedCategory,   setSelectedCategory]   = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [search,             setSearch]             = useState("");

  // ── Applied filter state — what actually filters the table ────────────────
  const [appliedSupplier,   setAppliedSupplier]   = useState("");
  const [appliedCategory,   setAppliedCategory]   = useState("");
  const [appliedCollection, setAppliedCollection] = useState("");
  const [appliedSearch,     setAppliedSearch]     = useState("");

  // ── Table state ───────────────────────────────────────────────────────────
  const [submitted,   setSubmitted]   = useState(false);
  const [sortKey,     setSortKey]     = useState("variant_display_title");
  const [sortDir,     setSortDir]     = useState("asc");
  const [page,        setPage]        = useState(1);
  const [editingRows, setEditingRows] = useState({});
  const [savedRows,   setSavedRows]   = useState({});

  // ── Sync state ────────────────────────────────────────────────────────────
  const [syncing,    setSyncing]    = useState(false);
  const [lastSynced, setLastSynced] = useState(lastSyncedAt);
  const [banner,     setBanner]     = useState(null);
  const [toast,      setToast]      = useState(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  // ── Currency symbol for applied supplier ──────────────────────────────────
  const currencySymbol = useMemo(() => {
    const sup = suppliers.find((s) => s.id === appliedSupplier);
    return getCurrencySymbol(sup?.currency);
  }, [appliedSupplier, suppliers]);

  // ── Sync ──────────────────────────────────────────────────────────────────
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

  // ── Submit — copies draft → applied and shows table ───────────────────────
  function handleSubmit() {
    if (!selectedSupplier) return;
    setAppliedSupplier(selectedSupplier);
    setAppliedCategory(selectedCategory);
    setAppliedCollection(selectedCollection);
    setAppliedSearch(search);
    setEditingRows({});
    setPage(1);
    setSubmitted(true);
  }

  // ── Supplier change resets everything ─────────────────────────────────────
  function handleSupplierChange(e) {
    setSelectedSupplier(e.target.value);
    setSubmitted(false);
    setEditingRows({});
    setPage(1);
  }

  // ── Other filter controls update draft only — no table effect ─────────────
  function handleCategoryChange(e)   { setSelectedCategory(e.target.value);   }
  function handleCollectionChange(e) { setSelectedCollection(e.target.value); }
  function handleSearchChange(e)     { setSearch(e.target.value);             }

  // ── Filtering uses applied state ──────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!submitted || !appliedSupplier) return [];
    const q = appliedSearch.trim().toLowerCase();
    return initialRows.filter((r) => {
      if (r.supplier_id !== appliedSupplier)                                   return false;
      if (appliedCategory   && r.product_category   !== appliedCategory)       return false;
      if (appliedCollection && r.product_collection !== appliedCollection)     return false;
      if (q) {
        const hay = [r.variant_display_title, r.variant_sku, r.variant_barcode, r.item_code, r.notes]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [submitted, appliedSupplier, appliedCategory, appliedCollection, appliedSearch, initialRows]);

  // ── Sorting ───────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return dir * (av - bv);
      return dir * String(av).localeCompare(String(bv));
    });
  }, [filtered, sortKey, sortDir]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSort(key) {
    const col = COLUMNS.find((c) => c.key === key);
    if (!col?.sortable) return;
    if (sortKey === key) { setSortDir((d) => d === "asc" ? "desc" : "asc"); }
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  }

  // ── Row editing ───────────────────────────────────────────────────────────
  function startEditing(row) {
    const base  = savedRows[row.id] ?? {};
    const draft = {};
    COLUMNS.forEach(({ key, readOnly }) => {
      if (readOnly) return;
      draft[key] = base[key] !== undefined ? base[key] : (row[key] ?? "");
    });
    setEditingRows((prev) => ({ ...prev, [row.id]: draft }));
  }

  function cancelEditing(rowId) {
    setEditingRows((prev) => { const n = { ...prev }; delete n[rowId]; return n; });
  }

  function handleFieldChange(rowId, fieldKey, value) {
    setEditingRows((prev) => ({ ...prev, [rowId]: { ...prev[rowId], [fieldKey]: value } }));
  }

  async function saveRow(row) {
    const draft = editingRows[row.id];
    if (!draft) return;
    try {
      const res = await fetch(`/api/supplier-variants/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_code:            draft.item_code            || null,
          cost:                 draft.cost                 !== "" ? draft.cost                  : null,
          moq:                  draft.moq                  !== "" ? draft.moq                   : null,
          case_pack:            draft.case_pack            !== "" ? draft.case_pack              : null,
          inner_pack:           draft.inner_pack           !== "" ? draft.inner_pack             : null,
          order_increment:      draft.order_increment      !== "" ? draft.order_increment        : null,
          lead_days:            draft.lead_days            !== "" ? draft.lead_days              : null,
          initial_average_cost: draft.initial_average_cost !== "" ? draft.initial_average_cost   : null,
          notes:                draft.notes                || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed.");
      }
      setSavedRows((prev) => ({ ...prev, [row.id]: draft }));
      cancelEditing(row.id);
      showToast("Saved");
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  }

  function cellValue(row, key) {
    const saved = savedRows[row.id];
    if (saved && saved[key] !== undefined) return saved[key];
    return row[key];
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout
      title="Add/Edit Supplier Product Info"
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

      {/* ── Filter card ── */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">

          {/* Supplier */}
          <div className="flex flex-col gap-1 min-w-[180px] flex-1">
            <label className="text-xs font-medium text-gray-500">Supplier</label>
            <select value={selectedSupplier} onChange={handleSupplierChange}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition">
              <option value="" disabled hidden>Select a Supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
            </select>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1 min-w-[160px] flex-1">
            <label className="text-xs font-medium text-gray-500">Category</label>
            <select value={selectedCategory} onChange={handleCategoryChange}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Collection */}
          <div className="flex flex-col gap-1 min-w-[160px] flex-1">
            <label className="text-xs font-medium text-gray-500">Collection</label>
            <select value={selectedCollection} onChange={handleCollectionChange}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition">
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
              style={{ WebkitAppearance: "none", appearance: "none" }}
            />
          </div>

          {/* Submit */}
          <div className="flex flex-col justify-end">
            <button
              onClick={handleSubmit}
              disabled={!selectedSupplier}
              className="px-5 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition whitespace-nowrap"
            >
              Submit
            </button>
          </div>

        </div>
      </div>

      {/* ── Empty state / Table ── */}
      {!submitted ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-10 text-center text-gray-400 text-sm">
          Select a supplier and click{" "}
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
                    {COLUMNS.map((col) => {
                      const labelLines = Array.isArray(col.label) ? col.label : null;
                      const labelText  = labelLines ? labelLines.join(" ") : col.label;
                      return (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className={`text-left px-2 py-2 text-xs font-medium text-gray-700 whitespace-normal break-words max-w-[110px] select-none transition ${
                            col.sortable ? "cursor-pointer hover:bg-gray-300" : "cursor-default"
                          }`}
                          title={col.sortable ? `Sort by ${labelText}` : undefined}
                        >
                          {labelLines ? <>{labelLines[0]}<br />{labelLines[1]}</> : col.label}
                          {col.sortable && <SortIcon direction={sortKey === col.key ? sortDir : null} />}
                        </th>
                      );
                    })}
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
                      const draft     = editingRows[row.id] ?? {};
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
                                <button onClick={() => saveRow(row)}
                                  className="px-2 py-0.5 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">
                                  Save
                                </button>
                                <button onClick={() => cancelEditing(row.id)}
                                  className="px-2 py-0.5 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition">
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => startEditing(row)}
                                className="px-2 py-0.5 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition">
                                Edit
                              </button>
                            )}
                          </td>
                          {COLUMNS.map((col) => {
                            const val        = cellValue(row, col.key);
                            const displayVal = col.currency ? formatCurrency(val, currencySymbol) : val;
                            if (col.readOnly) {
                              return (
                                <td key={col.key} className="px-2 py-2 whitespace-nowrap">
                                  <CellValue value={displayVal} />
                                </td>
                              );
                            }
                            return (
                              <td key={col.key} className="px-2 py-2 whitespace-nowrap">
                                {isEditing ? (
                                  <EditableCell
                                    colKey={col.key}
                                    value={draft[col.key]}
                                    onChange={(k, v) => handleFieldChange(row.id, k, v)}
                                    currencySymbol={currencySymbol}
                                  />
                                ) : (
                                  <CellValue value={displayVal} />
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
