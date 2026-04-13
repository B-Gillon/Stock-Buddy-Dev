"use client";

// /src/app/vendors/components/ClientVendorsPage.jsx

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import SortIcon from "@/shared/components/icons/SortIcon";

const ALL_COLUMNS = [
  { key: "name",              label: "Vendor",            hideable: false },
  { key: "product_types",     label: "Product Types",     hideable: true  },
  { key: "variant_count",     label: "Variants",          hideable: true  },
  { key: "active_count",      label: "Active Products",   hideable: true  },
  { key: "inactive_count",    label: "Inactive Products", hideable: true  },
  { key: "latest_updated_at", label: "Last Updated",      hideable: true  },
];

const STORAGE_KEY = "vendors_column_visibility";

const DEFAULT_VISIBILITY = Object.fromEntries(
  ALL_COLUMNS.map((c) => [c.key, true])
);

function loadVisibility() {
  if (typeof window === "undefined") return DEFAULT_VISIBILITY;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_VISIBILITY;
    return { ...DEFAULT_VISIBILITY, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_VISIBILITY;
  }
}

// ── Column Toggle Menu ──────────────────────────────────────────────────────
function ColumnToggleMenu({ visibility, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 transition hover:bg-gray-200"
      >
        <svg className="w-4 h-4 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 5a1 1 0 000 2h8a1 1 0 100-2H3zm0 5a1 1 0 000 2h5a1 1 0 100-2H3z" />
        </svg>
        Columns
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-2">
          <p className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Show / Hide Columns
          </p>
          {ALL_COLUMNS.filter((c) => c.hideable).map((col) => (
            <label
              key={col.key}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={visibility[col.key] ?? true}
                onChange={(e) => onChange(col.key, e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Filter Modal ─────────────────────────────────────────────────────────────
function FilterModal({ isOpen, onClose, filters, onApply, productTypes }) {
  const [local, setLocal] = useState(filters);

  useEffect(() => { setLocal(filters); }, [filters]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Filter Vendors</h2>

        <div className="space-y-4">
          {/* Product Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Product Type
            </label>
            <select
              value={local.product_type ?? ""}
              onChange={(e) => setLocal((p) => ({ ...p, product_type: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {productTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Has inactive products */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Status
            </label>
            <select
              value={local.status ?? ""}
              onChange={(e) => setLocal((p) => ({ ...p, status: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All Vendors</option>
              <option value="has_inactive">Has Inactive Products</option>
              <option value="all_active">All Products Active</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={() => { setLocal({}); onApply({}); onClose(); }}
            className="flex-1 px-4 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
          <button
            onClick={() => { onApply(local); onClose(); }}
            className="flex-1 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
// ───────────────────────────────────────────────────────────────────────────

function sortRows(rows, key, direction) {
  if (!key || !direction) return rows;
  return [...rows].sort((a, b) => {
    const aVal = a[key] ?? "";
    const bVal = b[key] ?? "";
    if (typeof aVal === "number" && typeof bVal === "number") {
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    }
    return direction === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });
}

function applyFilters(rows, filters) {
  let result = rows;
  if (filters.product_type) {
    result = result.filter((v) =>
      v.product_types?.split(", ").includes(filters.product_type)
    );
  }
  if (filters.status === "has_inactive") {
    result = result.filter((v) => v.inactive_count > 0);
  }
  if (filters.status === "all_active") {
    result = result.filter((v) => v.inactive_count === 0);
  }
  return result;
}

function exportToCSV(rows) {
  const headers = [
    "Vendor", "Product Types", "Variants",
    "Active Products", "Inactive Products", "Last Updated",
  ];
  const csvRows = rows.map((v) => [
    v.name ?? "",
    v.product_types ?? "",
    v.variant_count ?? 0,
    v.active_count ?? 0,
    v.inactive_count ?? 0,
    v.latest_updated_at ? new Date(v.latest_updated_at).toLocaleDateString() : "",
  ]);
  const csv = [headers, ...csvRows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "vendors.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClientVendorsPage({ vendors, lastSyncedAt }) {
  const router      = useRouter();
  const vendors_raw = vendors ?? [];

  const [syncing,       setSyncing]       = useState(false);
  const [lastSynced,    setLastSynced]    = useState(lastSyncedAt);
  const [banner,        setBanner]        = useState(null);
  const [sortKey,       setSortKey]       = useState("name");
  const [sortDir,       setSortDir]       = useState("asc");
  const [filterOpen,    setFilterOpen]    = useState(false);
  const [activeFilters, setActiveFilters] = useState({});

  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY);
  useEffect(() => { setVisibility(loadVisibility()); }, []);

  function handleVisibilityChange(key, checked) {
    setVisibility((prev) => {
      const next = { ...prev, [key]: checked };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function handleSort(key) {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else setSortDir("asc");
  }

  async function handleSync() {
    setSyncing(true);
    setBanner(null);
    try {
      const res  = await fetch("/api/sync/vendors", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Sync failed. Please try again.");
      setLastSynced(new Date().toISOString());
      setBanner({
        type:    "success",
        message: `Vendors sync complete. ${body.count} vendor${body.count !== 1 ? "s" : ""} processed.`,
      });
    } catch (err) {
      setBanner({ type: "error", message: err.message ?? "Sync failed. Please try again." });
    } finally {
      setSyncing(false);
    }
  }

  // Derive product types for filter dropdown
  const productTypes = [
    ...new Set(
      vendors_raw.flatMap((v) =>
        v.product_types ? v.product_types.split(", ").filter(Boolean) : []
      )
    ),
  ].sort();

  const sortedRows     = sortRows(vendors_raw, sortKey, sortDir);
  const filteredRows   = applyFilters(sortedRows, activeFilters);
  const visibleColumns = ALL_COLUMNS.filter((c) => !c.hideable || visibility[c.key]);

  const hasActiveFilters = Object.values(activeFilters).some(Boolean);

  function renderCell(col, vendor) {
    switch (col.key) {
      case "name":
        return <span className="font-medium text-gray-900">{vendor.name ?? "—"}</span>;
      case "product_types":
        return <span className="text-gray-600">{vendor.product_types || "—"}</span>;
      case "variant_count":
        return <span className="text-gray-700">{vendor.variant_count.toLocaleString()}</span>;
      case "active_count":
        return <span className="text-green-700 font-medium">{vendor.active_count}</span>;
      case "inactive_count":
        return <span className="text-gray-500">{vendor.inactive_count}</span>;
      case "latest_updated_at":
        return (
          <span className="text-gray-500 whitespace-nowrap">
            {vendor.latest_updated_at
              ? new Date(vendor.latest_updated_at).toLocaleDateString()
              : "—"}
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <>
      <FilterModal
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={activeFilters}
        onApply={setActiveFilters}
        productTypes={productTypes}
      />

      <AppLayout
        title="Vendors"
        actions={{
          onSync:       handleSync,
          syncing:      syncing,
          lastSyncedAt: lastSynced,
          syncLabel:    "Sync Vendors",
          onFilter:     () => setFilterOpen(true),
          onExport:     () => exportToCSV(filteredRows),
          columnsMenu: (
            <ColumnToggleMenu
              visibility={visibility}
              onChange={handleVisibilityChange}
            />
          ),
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

        {hasActiveFilters && (
          <div className="mb-3 flex items-center gap-2 text-sm text-blue-700">
            <span>Filters active</span>
            <button
              onClick={() => setActiveFilters({})}
              className="underline hover:no-underline"
            >
              Clear
            </button>
          </div>
        )}

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-200 border-b border-gray-300">
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="text-left px-2 py-2 font-medium cursor-pointer select-none hover:bg-gray-300 transition-colors whitespace-nowrap"
                >
                  {col.label}
                  <SortIcon direction={sortKey === col.key ? sortDir : null} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-2 py-8 text-center text-gray-400">
                  No vendors found.
                </td>
              </tr>
            ) : (
              filteredRows.map((vendor) => (
                <tr
                  key={vendor.id}
                  onClick={() => router.push(`/vendors/${vendor.slug}`)}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  {visibleColumns.map((col) => (
                    <td key={col.key} className="px-2 py-3">
                      {renderCell(col, vendor)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AppLayout>
    </>
  );
}
