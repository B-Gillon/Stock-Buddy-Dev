"use client";

// /src/app/inventory/components/ClientInventoryPage.jsx

import React, { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import SearchModal from "@/shared/components/modals/SearchModal";
import InventoryFilterModal from "@/app/inventory/components/InventoryFilterModal";
import SortIcon from "@/shared/components/icons/SortIcon";

const ALL_COLUMNS = [
  { key: "display_title",   label: "Variant Title", sortable: true,  hideable: false },
  { key: "vendor_name",     label: "Vendor",        sortable: true,  hideable: true  },
  { key: "sku",             label: "SKU",           sortable: true,  hideable: true  },
  { key: "barcode",         label: "Barcode",       sortable: false, hideable: true  },
  { key: "status",          label: "Status",        sortable: true,  hideable: true  },
  { key: "location",        label: "Location",      sortable: false, hideable: true  },
  { key: "available_total", label: "Available",     sortable: true,  hideable: true  },
  { key: "incoming_total",  label: "Incoming",      sortable: true,  hideable: true  },
  { key: "total_value",     label: "Total Value",   sortable: true,  hideable: true  },
];

const STORAGE_KEY = "inventory_column_visibility";
const DEFAULT_VISIBILITY = Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, true]));

function loadVisibility() {
  if (typeof window === "undefined") return DEFAULT_VISIBILITY;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_VISIBILITY;
    return { ...DEFAULT_VISIBILITY, ...JSON.parse(stored) };
  } catch { return DEFAULT_VISIBILITY; }
}

function formatCurrency(value) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
}

function StatusPill({ status }) {
  const normalized = status?.toLowerCase();
  const styles =
    normalized === "active"   ? "bg-green-100 text-green-700"   :
    normalized === "draft"    ? "bg-yellow-100 text-yellow-700" :
    normalized === "archived" ? "bg-gray-100 text-gray-500"     :
                                "bg-gray-100 text-gray-400";
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>{status ?? "—"}</span>;
}

function Chevron({ expanded }) {
  return (
    <span className="inline-block text-gray-400 text-xs leading-none select-none" style={{ width: "14px" }}>
      {expanded ? "▼" : "▶"}
    </span>
  );
}

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
          <p className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Show / Hide Columns</p>
          {ALL_COLUMNS.filter((c) => c.hideable).map((col) => (
            <label key={col.key} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
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

export default function ClientInventoryPage({
  inventory = [],
  totalCount = 0,
  totalPages = 1,
  currentPage = 1,
  pageSize = 20,
  currentFilters = {},
  filterOptions = {},
  lastSyncedAt: initialLastSyncedAt,
}) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [syncing,      setSyncing]      = useState(false);
  const [lastSynced,   setLastSynced]   = useState(initialLastSyncedAt);
  const [banner,       setBanner]       = useState(null);
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [searchTerm,   setSearchTerm]   = useState(currentFilters.search ?? "");
  const [filterOpen,   setFilterOpen]   = useState(false);
  const [expanded,     setExpanded]     = useState(new Set());
  const [visibility,   setVisibility]   = useState(DEFAULT_VISIBILITY);

  useEffect(() => { setVisibility(loadVisibility()); }, []);

  function handleVisibilityChange(key, checked) {
    setVisibility((prev) => {
      const next = { ...prev, [key]: checked };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function toggleExpanded(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── URL navigation ────────────────────────────────────────────────────────

  function buildParams(overrides = {}) {
    const params  = new URLSearchParams(searchParams.toString());
    const merged  = { ...currentFilters, ...overrides };

    ["search", "sort", "dir", "page", "availability", "incoming", "total_value", "inventory_policy"].forEach((k) => {
      if (merged[k]) params.set(k, merged[k]);
      else params.delete(k);
    });

    ["vendors", "categories", "collections", "status", "tags", "locations"].forEach((k) => {
      const val = merged[k];
      if (Array.isArray(val) && val.length > 0) params.set(k, val.join(","));
      else params.delete(k);
    });

    return params.toString();
  }

  function navigate(overrides) {
    router.push(`${pathname}?${buildParams(overrides)}`);
  }

  function handleSort(key) {
    if (!ALL_COLUMNS.find((c) => c.key === key)?.sortable) return;
    const newDir = currentFilters.sort === key && currentFilters.dir === "asc" ? "desc" : "asc";
    navigate({ sort: key, dir: newDir, page: "1" });
  }

  function handleSearch() {
    navigate({ search: searchTerm, page: "1" });
    setSearchOpen(false);
  }

  function handleClearSearch() {
    setSearchTerm("");
    navigate({ search: "", page: "1" });
  }

  function handleApplyFilters(filters) {
    navigate({
      vendors:          filters.vendors,
      categories:       filters.categories,
      collections:      filters.collections,
      status:           filters.status,
      tags:             filters.tags,
      locations:        filters.locations,
      availability:     filters.availability ?? "",
      incoming:         filters.incoming ?? "",
      total_value:      filters.total_value ?? "",
      inventory_policy: filters.inventory_policy ?? "",
      page:             "1",
    });
    setFilterOpen(false);
  }

  function handleClearFilters() {
    navigate({
      vendors: [], categories: [], collections: [], status: [], tags: [],
      locations: [], availability: "", incoming: "", total_value: "",
      inventory_policy: "", page: "1",
    });
    setFilterOpen(false);
  }

  function goToPage(p) { navigate({ page: String(p) }); }

  const activeFilters = {
    vendors:          currentFilters.vendors     ?? [],
    categories:       currentFilters.categories  ?? [],
    collections:      currentFilters.collections ?? [],
    status:           currentFilters.status      ?? [],
    tags:             currentFilters.tags        ?? [],
    locations:        currentFilters.locations   ?? [],
    availability:     currentFilters.availability     || null,
    incoming:         currentFilters.incoming         || null,
    total_value:      currentFilters.total_value      || null,
    inventory_policy: currentFilters.inventory_policy || null,
  };

  // ── Sync ──────────────────────────────────────────────────────────────────

  async function handleSync() {
    setSyncing(true);
    setBanner(null);
    try {
      const res = await fetch("/api/sync/inventory", { method: "POST" });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error ?? res.statusText); }
      setLastSynced(new Date().toISOString());
      setBanner({ type: "success", message: "Inventory sync complete." });
    } catch (err) {
      setBanner({ type: "error", message: err.message ?? "Sync failed." });
    } finally {
      setSyncing(false);
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function exportCSV() {
    if (!inventory.length) { alert("No inventory to export."); return; }
    const cols = ["display_title", "vendor_name", "sku", "barcode", "status", "available_total", "incoming_total", "total_value"];
    const csvRows = inventory.map((row) =>
      cols.map((key) => {
        const val = row[key];
        if (val == null) return "";
        if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
        return val;
      }).join(",")
    );
    const csv  = [cols.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "inventory_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ── Pagination controls ───────────────────────────────────────────────────

  const start     = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end       = Math.min(currentPage * pageSize, totalCount);
  const pageLabel = totalCount === 0 ? "No results" : `${start}–${end} of ${totalCount.toLocaleString()}`;

  const paginationControls = {
    pageData: inventory, pageLabel, currentPage, totalPages,
    prevPage: () => goToPage(currentPage - 1),
    nextPage: () => goToPage(currentPage + 1),
    goToPage,
  };

  const visibleColumns = ALL_COLUMNS.filter((c) => !c.hideable || visibility[c.key]);
  const totalCols = visibleColumns.length + 1;

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderCell(col, row) {
    const locationFilter = currentFilters.locations ?? [];
    const visibleLocations = locationFilter.length > 0
      ? (row.location_rows ?? []).filter((l) => locationFilter.includes(l.location_name))
      : (row.location_rows ?? []);

    const displayAvailable = visibleLocations.reduce((s, l) => s + l.available, 0);
    const displayValue     = visibleLocations.length > 0 && visibleLocations.every((l) => l.total_value != null)
      ? visibleLocations.reduce((s, l) => s + (l.total_value ?? 0), 0)
      : row.total_value;

    // Incoming comes from Stock Buddy PO data (inventory_summary.incoming_total),
    // not from inventory_levels.incoming which reflects Shopify's value (always 0).
    const displayIncoming = row.incoming_total ?? 0;

    switch (col.key) {
      case "display_title":   return <span className="font-medium text-gray-900">{row.display_title}</span>;
      case "vendor_name":     return <span className="text-gray-600">{row.vendor_name}</span>;
      case "sku":             return <span className="text-gray-600">{row.sku}</span>;
      case "barcode":         return <span className="text-gray-600">{row.barcode}</span>;
      case "status":          return <StatusPill status={row.status} />;
      case "location":        return <span className="text-gray-400 text-xs">—</span>;
      case "available_total": return <span className="tabular-nums text-gray-700">{displayAvailable.toLocaleString()}</span>;
      case "incoming_total":  return <span className="tabular-nums text-gray-700">{displayIncoming.toLocaleString()}</span>;
      case "total_value":     return <span className="tabular-nums text-gray-700">{formatCurrency(displayValue)}</span>;
      default:                return null;
    }
  }

  function renderLocationCell(col, loc) {
    switch (col.key) {
      case "location":        return <span className="text-xs text-gray-600 font-medium">{loc.location_name}</span>;
      case "available_total": return <span className="tabular-nums text-xs text-gray-600">{loc.available.toLocaleString()}</span>;
      // Incoming is tracked at the PO level, not per location — show dash on sub-rows
      case "incoming_total":  return <span className="text-gray-300 text-xs">—</span>;
      case "total_value":     return <span className="tabular-nums text-xs text-gray-600">{formatCurrency(loc.total_value)}</span>;
      default:                return null;
    }
  }

  return (
    <AppLayout
      title="Inventory"
      paginationControls={paginationControls}
      actions={{
        onSync:       handleSync,
        syncing:      syncing,
        syncLabel:    "Sync Inventory",
        lastSyncedAt: lastSynced,
        onSearch:     () => setSearchOpen(true),
        onFilter:     () => setFilterOpen(true),
        onExport:     exportCSV,
        columnsMenu: (
          <ColumnToggleMenu visibility={visibility} onChange={handleVisibilityChange} />
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

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-200 border-b border-gray-300">
            <th className="px-2 py-2 w-6" />
            {visibleColumns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`text-left px-2 py-2 font-medium whitespace-nowrap ${
                  col.sortable ? "cursor-pointer select-none hover:bg-gray-300 transition-colors" : ""
                }`}
              >
                {col.label}
                {col.sortable && (
                  <SortIcon direction={currentFilters.sort === col.key ? currentFilters.dir : null} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inventory.length === 0 ? (
            <tr>
              <td colSpan={totalCols} className="px-2 py-8 text-center text-gray-400">No inventory found.</td>
            </tr>
          ) : (
            inventory.map((row) => {
              const isExpanded = expanded.has(row.id);
              const locationFilter = currentFilters.locations ?? [];
              const visibleLocations = locationFilter.length > 0
                ? (row.location_rows ?? []).filter((l) => locationFilter.includes(l.location_name))
                : (row.location_rows ?? []);

              return (
                <React.Fragment key={row.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-2 py-3 w-6 cursor-pointer" onClick={() => toggleExpanded(row.id)}>
                      <Chevron expanded={isExpanded} />
                    </td>
                    {visibleColumns.map((col) => (
                      <td key={col.key} className="px-2 py-3">{renderCell(col, row)}</td>
                    ))}
                  </tr>
                  {isExpanded && visibleLocations.map((loc) => (
                    <tr key={`${row.id}-${loc.location_id}`} className="bg-gray-50 border-b border-gray-100">
                      <td className="px-2 py-2" />
                      {visibleColumns.map((col) => (
                        <td key={col.key} className="px-2 py-2">{renderLocationCell(col, loc)}</td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>

      <SearchModal
        isOpen={searchOpen}
        title="Search Inventory"
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onSearch={handleSearch}
        onClear={handleClearSearch}
        onClose={() => setSearchOpen(false)}
      />

      <InventoryFilterModal
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={activeFilters}
        setFilters={() => {}}
        options={filterOptions}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />
    </AppLayout>
  );
}
