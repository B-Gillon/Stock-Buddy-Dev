"use client";

// /src/app/vendors/components/ClientVendorsPage.jsx

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import SortIcon from "@/shared/components/icons/SortIcon";

const ALL_COLUMNS = [
  { key: "name",              label: "Vendor",           hideable: false },
  { key: "product_types",     label: "Product Types",    hideable: true  },
  { key: "product_count",     label: "Products",         hideable: true  },
  { key: "variant_count",     label: "Variants",         hideable: true  },
  { key: "active_count",      label: "Active / Inactive",hideable: true  },
  { key: "latest_updated_at", label: "Last Updated",     hideable: true  },
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

export default function ClientVendorsPage({ vendors, lastSyncedAt }) {
  const router      = useRouter();
  const vendors_raw = vendors ?? [];

  const [syncing,    setSyncing]    = useState(false);
  const [lastSynced, setLastSynced] = useState(lastSyncedAt);
  const [banner,     setBanner]     = useState(null);
  const [sortKey,    setSortKey]    = useState("name");
  const [sortDir,    setSortDir]    = useState("asc");

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

  const sortedRows    = sortRows(vendors_raw, sortKey, sortDir);
  const visibleColumns = ALL_COLUMNS.filter((c) => !c.hideable || visibility[c.key]);

  function renderCell(col, vendor) {
    switch (col.key) {
      case "name":
        return <span className="font-medium text-gray-900">{vendor.name ?? "—"}</span>;
      case "product_types":
        return <span className="text-gray-600">{vendor.product_types}</span>;
      case "product_count":
        return <span className="text-gray-700">{vendor.product_count.toLocaleString()}</span>;
      case "variant_count":
        return <span className="text-gray-700">{vendor.variant_count.toLocaleString()}</span>;
      case "active_count":
        return (
          <>
            <span className="text-green-700 font-medium">{vendor.active_count}</span>
            <span className="text-gray-400 mx-1">/</span>
            <span className="text-gray-500">{vendor.inactive_count}</span>
          </>
        );
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
    <AppLayout
      title="Vendors"
      actions={{
        onSync:       handleSync,
        syncing:      syncing,
        lastSyncedAt: lastSynced,
        syncLabel:    "Sync Vendors",
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
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={visibleColumns.length} className="px-2 py-8 text-center text-gray-400">
                No vendors found. Run a sync to populate this table.
              </td>
            </tr>
          ) : (
            sortedRows.map((vendor) => (
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
  );
}
