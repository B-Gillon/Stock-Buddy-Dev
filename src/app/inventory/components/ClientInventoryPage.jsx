"use client";

// /src/app/inventory/components/ClientInventoryPage.jsx

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import AppLayout from "@/shared/components/layout/AppLayout";
import SearchModal from "@/shared/components/modals/SearchModal";
import InventoryFilterModal from "@/app/inventory/components/InventoryFilterModal";
import SortIcon from "@/shared/components/icons/SortIcon";
import usePagination from "@/shared/utils/usePagination";

const SYNC_STEPS = [
  { label: "Syncing locations...",        endpoint: "/api/sync_Locations"       },
  { label: "Syncing inventory items...",  endpoint: "/api/sync_InventoryItems"  },
  { label: "Syncing inventory levels...", endpoint: "/api/sync_InventoryLevels" },
];

const initialFilters = {
  vendors:          [],
  categories:       [],
  collections:      [],
  tags:             [],
  status:           [],
  locations:        [],
  availability:     null,
  incoming:         null,
  total_value:      null,
  inventory_policy: null,
};

// Columns that can be toggled. "chevron" is always visible and excluded from the menu.
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

function formatCurrency(value) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency:              "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function StatusPill({ status }) {
  const normalized = status?.toLowerCase();
  const styles =
    normalized === "active"   ? "bg-green-100 text-green-700"   :
    normalized === "draft"    ? "bg-yellow-100 text-yellow-700" :
    normalized === "archived" ? "bg-gray-100 text-gray-500"     :
                                "bg-gray-100 text-gray-400";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      {status ?? "—"}
    </span>
  );
}

function Chevron({ expanded }) {
  return (
    <span className="inline-block text-gray-400 text-xs leading-none select-none" style={{ width: "14px" }}>
      {expanded ? "▼" : "▶"}
    </span>
  );
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

  const hideableColumns = ALL_COLUMNS.filter((c) => c.hideable);

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
          {hideableColumns.map((col) => (
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

export default function ClientInventoryPage({ inventory, lastSyncedAt, locationNames = [] }) {
  const rows_raw = inventory ?? [];

  const [syncing,    setSyncing]    = useState(false);
  const [syncLabel,  setSyncLabel]  = useState("Sync Inventory");
  const [lastSynced, setLastSynced] = useState(lastSyncedAt);
  const [banner,     setBanner]     = useState(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters,    setFilters]    = useState(initialFilters);

  const [sortKey, setSortKey] = useState("display_title");
  const [sortDir, setSortDir] = useState("asc");

  const [expanded, setExpanded] = useState(new Set());

  // Column visibility — default on first render, hydrate from localStorage in effect
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY);
  useEffect(() => {
    setVisibility(loadVisibility());
  }, []);

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

  function handleSort(key) {
    if (!ALL_COLUMNS.find((c) => c.key === key)?.sortable) return;
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else setSortDir("asc");
  }

  // Visible columns (chevron is always first, then filtered list)
  const visibleColumns = ALL_COLUMNS.filter((c) => !c.hideable || visibility[c.key]);
  const totalCols = visibleColumns.length + 1; // +1 for chevron

  const filteredRows = useMemo(() => {
    let result = [...rows_raw];

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter((r) =>
        r.display_title?.toLowerCase().includes(term) ||
        r.sku?.toLowerCase().includes(term) ||
        r.barcode?.toLowerCase().includes(term) ||
        r.vendor_name?.toLowerCase().includes(term) ||
        r.status?.toLowerCase().includes(term)
      );
    }

    if (filters.vendors.length > 0)
      result = result.filter((r) => filters.vendors.includes(r.vendor_name));
    if (filters.categories.length > 0)
      result = result.filter((r) => filters.categories.includes(r.category));
    if (filters.collections.length > 0)
      result = result.filter((r) => filters.collections.includes(r.collection));
    if (filters.tags.length > 0)
      result = result.filter((r) => (r.tags || []).some((t) => filters.tags.includes(t)));
    if (filters.status.length > 0)
      result = result.filter((r) => filters.status.includes(r.status?.toLowerCase()));
    if (filters.locations.length > 0)
      result = result.filter((r) =>
        r.location_rows?.some((l) => filters.locations.includes(l.location_name))
      );
    if (filters.availability === "in_stock")
      result = result.filter((r) => r.available_total > 0);
    if (filters.availability === "out_of_stock")
      result = result.filter((r) => r.available_total <= 0);
    if (filters.availability === "low_stock")
      result = result.filter((r) => r.available_total > 0 && r.available_total < 5);
    if (filters.incoming === "has_incoming")
      result = result.filter((r) => r.incoming_total > 0);
    if (filters.incoming === "no_incoming")
      result = result.filter((r) => r.incoming_total <= 0);
    if (filters.total_value === "has_value")
      result = result.filter((r) => r.total_value != null);
    if (filters.total_value === "no_value")
      result = result.filter((r) => r.total_value == null);
    if (filters.inventory_policy)
      result = result.filter((r) => r.inventory_policy === filters.inventory_policy);

    return result;
  }, [rows_raw, searchTerm, filters]);

  const sortedRows = useMemo(
    () => sortRows(filteredRows, sortKey, sortDir),
    [filteredRows, sortKey, sortDir]
  );

  const pagination = usePagination(sortedRows, 20);

  const filterOptions = useMemo(() => ({
    vendors:     [...new Set(rows_raw.map((r) => r.vendor_name).filter(Boolean))],
    categories:  [...new Set(rows_raw.map((r) => r.category).filter(Boolean))],
    collections: [...new Set(rows_raw.map((r) => r.collection).filter(Boolean))],
    tags:        [...new Set(rows_raw.flatMap((r) => r.tags || []))],
    locations:   locationNames,
  }), [rows_raw, locationNames]);

  const exportCSV = useCallback(() => {
    if (!sortedRows.length) { alert("No inventory to export."); return; }
    const exportRows = sortedRows.map(({ location_rows, ...rest }) => rest);
    const header  = Object.keys(exportRows[0]).join(",");
    const csvRows = exportRows.map((row) =>
      Object.values(row).map((value) => {
        if (value == null) return "";
        if (Array.isArray(value)) return `"${value.join(";")}"`;
        if (typeof value === "string") return `"${value.replace(/"/g, '""')}"`;
        return value;
      }).join(",")
    );
    const csv  = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "inventory_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [sortedRows]);

  async function handleSync() {
    setSyncing(true);
    setBanner(null);
    try {
      for (const step of SYNC_STEPS) {
        setSyncLabel(step.label);
        const res = await fetch(step.endpoint, { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(`${step.endpoint} failed: ${body.error ?? res.statusText}`);
        }
      }
      setLastSynced(new Date().toISOString());
      setBanner({ type: "success", message: "Inventory sync complete." });
    } catch (err) {
      setBanner({ type: "error", message: err.message ?? "Sync failed." });
    } finally {
      setSyncing(false);
      setSyncLabel("Sync Inventory");
    }
  }

  // Helper: render a cell value for a given column key
  function renderCell(col, row, displayAvailable, displayIncoming, displayValue) {
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

  // Helper: render a location sub-row cell for a given column key
  function renderLocationCell(col, loc) {
    switch (col.key) {
      case "location":        return <span className="text-xs text-gray-600 font-medium">{loc.location_name}</span>;
      case "available_total": return <span className="tabular-nums text-xs text-gray-600">{loc.available.toLocaleString()}</span>;
      case "incoming_total":  return <span className="tabular-nums text-xs text-gray-600">{loc.incoming.toLocaleString()}</span>;
      case "total_value":     return <span className="tabular-nums text-xs text-gray-600">{formatCurrency(loc.total_value)}</span>;
      default:                return null;
    }
  }

  return (
    <AppLayout
      title="Inventory"
      paginationControls={pagination}
      actions={{
        onSync:       handleSync,
        syncing:      syncing,
        syncLabel:    syncLabel,
        lastSyncedAt: lastSynced,
        onSearch:     () => setSearchOpen(true),
        onFilter:     () => setFilterOpen(true),
        onExport:     exportCSV,
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

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-200 border-b border-gray-300">
            {/* Chevron — always visible */}
            <th className="px-2 py-2 w-6" />
            {visibleColumns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`text-left px-2 py-2 font-medium whitespace-nowrap ${
                  col.sortable
                    ? "cursor-pointer select-none hover:bg-gray-300 transition-colors"
                    : ""
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
          {pagination.pageData.length === 0 ? (
            <tr>
              <td colSpan={totalCols} className="px-2 py-8 text-center text-gray-400">
                No inventory found.
              </td>
            </tr>
          ) : (
            pagination.pageData.map((row) => {
              const isExpanded = expanded.has(row.id);
              const visibleLocations = (row.location_rows ?? []).filter(
                (loc) => filters.locations.length === 0 || filters.locations.includes(loc.location_name)
              );
              const displayAvailable = visibleLocations.reduce((s, l) => s + l.available, 0);
              const displayIncoming  = visibleLocations.reduce((s, l) => s + l.incoming,  0);
              const displayValue     = visibleLocations.length > 0 && visibleLocations.every((l) => l.total_value != null)
                ? visibleLocations.reduce((s, l) => s + (l.total_value ?? 0), 0)
                : row.total_value;

              return (
                <React.Fragment key={row.id}>
                  {/* ── Main variant row ── */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td
                      className="px-2 py-3 w-6 cursor-pointer"
                      onClick={() => toggleExpanded(row.id)}
                    >
                      <Chevron expanded={isExpanded} />
                    </td>
                    {visibleColumns.map((col) => (
                      <td key={col.key} className="px-2 py-3">
                        {renderCell(col, row, displayAvailable, displayIncoming, displayValue)}
                      </td>
                    ))}
                  </tr>

                  {/* ── Expanded location rows ── */}
                  {isExpanded && visibleLocations.map((loc) => (
                    <tr
                      key={`${row.id}-${loc.location_id}`}
                      className="bg-gray-50 border-b border-gray-100"
                    >
                      <td className="px-2 py-2" />
                      {visibleColumns.map((col) => (
                        <td key={col.key} className="px-2 py-2">
                          {renderLocationCell(col, loc)}
                        </td>
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
        onSearch={() => setSearchOpen(false)}
        onClear={() => setSearchTerm("")}
        onClose={() => setSearchOpen(false)}
      />

      <InventoryFilterModal
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        options={filterOptions}
        onApply={() => setFilterOpen(false)}
        onClear={() => setFilterOpen(false)}
      />
    </AppLayout>
  );
}
