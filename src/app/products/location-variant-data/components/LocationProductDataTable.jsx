"use client";

import { useState, useRef, useEffect } from "react";
import SortIcon from "@/shared/components/icons/SortIcon";

const COLUMNS = [
  { key: "image",         label: "",               hideable: false, sortable: false },
  { key: "product_title", label: "PRODUCT TITLE",  hideable: false, sortable: true  },
  { key: "variant_title", label: "VARIANT TITLE",  hideable: true,  sortable: true  },
  { key: "sku",           label: "SKU",            hideable: false, sortable: true  },
  { key: "location_name", label: "LOCATION",       hideable: true,  sortable: true  },
  { key: "bin_location",  label: "BIN LOCATION",   hideable: false, sortable: true  },
  { key: "bin_updated_at",label: "UPDATED AT",     hideable: true,  sortable: true  },
];

const LS_KEY = "locationProductData_columns_v1";

function loadColumnVisibility() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveColumnVisibility(vis) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(vis));
  } catch {}
}

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getShopifyAdminUrl(shopifyVariantId) {
  return `https://admin.shopify.com/store/brandongtest/products?query=${shopifyVariantId}`;
}

// ── Inline editable cell ────────────────────────────────────────────────────
function EditableBinCell({ value, variantId, locationId, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleCommit = async () => {
    const trimmed = draft.trim();
    if (trimmed === (value || "").trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(variantId, locationId, trimmed);
    } catch (err) {
      // parent shows toast
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleCommit();
    if (e.key === "Escape") {
      setDraft(value || "");
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className="border border-blue-400 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Enter bin location..."
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value || ""); setEditing(true); }}
      className="w-full text-left text-sm px-2 py-1 rounded hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors min-h-[28px]"
      title="Click to edit bin location"
    >
      {value || <span className="text-gray-400 italic">—</span>}
    </button>
  );
}

// ── Main table ───────────────────────────────────────────────────────────────
export default function LocationProductDataTable({
  rows,
  loading,
  hasFetched,
  selectedLocationId,
  onBinSave,
  showToast,
}) {
  const [sortKey, setSortKey] = useState("product_title");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const defaults = Object.fromEntries(COLUMNS.map((c) => [c.key, true]));
    return defaults;
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Sync column visibility from localStorage after mount
  useEffect(() => {
    const saved = loadColumnVisibility();
    if (saved) {
      const merged = { ...Object.fromEntries(COLUMNS.map((c) => [c.key, true])), ...saved };
      // Always-visible columns forced on
      COLUMNS.filter((c) => !c.hideable).forEach((c) => { merged[c.key] = true; });
      setVisibleColumns(merged);
    }
  }, []);

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => {
      const col = COLUMNS.find((c) => c.key === key);
      if (!col?.hideable) return prev;
      // Enforce minimum: at least one hideable column visible
      const nextVisible = { ...prev, [key]: !prev[key] };
      const hideableVisible = COLUMNS.filter((c) => c.hideable).filter(
        (c) => nextVisible[c.key]
      );
      if (hideableVisible.length === 0) return prev;
      saveColumnVisibility(nextVisible);
      return nextVisible;
    });
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const handleCopy = (e, text, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      showToast("Copied", "success");
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  // Sort
  const sorted = [...rows].sort((a, b) => {
    let av = a[sortKey] ?? "";
    let bv = b[sortKey] ?? "";
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const visibleCols = COLUMNS.filter((c) => visibleColumns[c.key]);

  if (!hasFetched) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
        Select a location and click <strong>Load</strong> to view data.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Table header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="text-sm text-gray-500">
          {rows.length} variant{rows.length !== 1 ? "s" : ""}
        </span>
        <div className="relative">
          <button
            onClick={() => setColMenuOpen((o) => !o)}
            className="text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1"
          >
            Columns
          </button>
          {colMenuOpen && (
            <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px] py-1">
              {COLUMNS.filter((c) => c.hideable).map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[col.key]}
                    onChange={() => toggleColumn(col.key)}
                    className="rounded"
                  />
                  {col.label || col.key}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500">
          No variants found for this location.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {visibleCols.map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {col.sortable ? (
                        <button
                          className="flex items-center gap-1 hover:text-gray-800"
                          onClick={() => handleSort(col.key)}
                        >
                          {col.label}
                          <SortIcon
                            active={sortKey === col.key}
                            direction={sortDir}
                          />
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map((row) => (
                  <tr
                    key={`${row.variant_id}-${row.location_id}`}
                    className="hover:bg-gray-50 group"
                  >
                    {visibleCols.map((col) => {
                      if (col.key === "image") {
                        return (
                          <td key="image" className="px-4 py-2 w-12">
                            {row.image_src ? (
                              <img
                                src={row.image_src}
                                alt={row.product_title}
                                className="w-10 h-10 object-cover rounded border border-gray-200"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-300 text-xs">
                                —
                              </div>
                            )}
                          </td>
                        );
                      }

                      if (col.key === "product_title") {
                        return (
                          <td key="product_title" className="px-4 py-2 max-w-[220px]">
                            <div className="font-medium text-gray-900 truncate">
                              {row.product_title}
                            </div>
                          </td>
                        );
                      }

                      if (col.key === "variant_title") {
                        return (
                          <td key="variant_title" className="px-4 py-2 max-w-[180px]">
                            <span className="text-gray-700 truncate block">
                              {row.variant_title || "—"}
                            </span>
                          </td>
                        );
                      }

                      if (col.key === "sku") {
                        return (
                          <td key="sku" className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => handleCopy(e, row.sku, `sku-${row.variant_id}`)}
                                className="text-gray-700 hover:text-blue-600 cursor-pointer"
                                title="Click to copy SKU"
                              >
                                {row.sku || "—"}
                              </button>
                              {row.shopify_variant_id && (
                                <a
                                  href={getShopifyAdminUrl(row.shopify_variant_id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-500 transition-opacity ml-1"
                                  title="Open in Shopify Admin"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </td>
                        );
                      }

                      if (col.key === "location_name") {
                        return (
                          <td key="location_name" className="px-4 py-2 text-gray-700">
                            {row.location_name}
                          </td>
                        );
                      }

                      if (col.key === "bin_location") {
                        return (
                          <td key="bin_location" className="px-4 py-2 min-w-[160px]">
                            <EditableBinCell
                              value={row.bin_location}
                              variantId={row.variant_id}
                              locationId={row.location_id}
                              onSave={onBinSave}
                            />
                          </td>
                        );
                      }

                      if (col.key === "bin_updated_at") {
                        return (
                          <td key="bin_updated_at" className="px-4 py-2 text-gray-500 whitespace-nowrap">
                            {formatDate(row.bin_updated_at)}
                          </td>
                        );
                      }

                      return null;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages} &mdash; {rows.length} total
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
