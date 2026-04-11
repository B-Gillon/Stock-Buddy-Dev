"use client";

// /src/app/products/components/ClientProductsPage.jsx

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import SortIcon from "@/shared/components/icons/SortIcon";
import { Toast, useToast } from "@/shared/components/ui/Toast";
import SearchModal from "@/shared/components/modals/SearchModal";
import ProductFilterModal from "@/app/products/components/ProductFilterModal";
import { formatCategory } from "@/shared/utils/formatters";

const ALL_COLUMNS = [
  { key: "image",         label: "Image",      hideable: false, defaultVisible: true  },
  { key: "title",         label: "Title",      hideable: true,  defaultVisible: true  },
  { key: "category",      label: "Category",   hideable: true,  defaultVisible: true  },
  { key: "collection",    label: "Collection", hideable: true,  defaultVisible: true  },
  { key: "vendor",        label: "Vendor",     hideable: true,  defaultVisible: true  },
  { key: "status",        label: "Status",     hideable: true,  defaultVisible: true  },
  { key: "variant_count", label: "# Variants", hideable: true,  defaultVisible: true  },
  { key: "handle",        label: "Handle",     hideable: true,  defaultVisible: false },
  { key: "tags",          label: "Tags",       hideable: true,  defaultVisible: false },
];

const SORT_COLUMNS = ["title", "category", "collection", "vendor", "status", "handle"];
const STORAGE_KEY  = "products_column_visibility";

function loadVisibility() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

function saveVisibility(vis) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(vis)); } catch {}
}

function StatusPill({ status }) {
  const s = status?.toLowerCase() || "unknown";
  const color =
    s === "active"   ? "bg-green-100 text-green-700 border-green-200"   :
    s === "draft"    ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
    s === "archived" ? "bg-red-100 text-red-700 border-red-200"         :
                       "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

function ColumnToggleMenu({ columns, visibility, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const visibleCount = columns.filter((c) => c.hideable && visibility[c.key] !== false).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600"
      >
        Columns ▾
      </button>
      {open && (
        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[150px] py-1">
          {columns.filter((c) => c.hideable).map((col) => {
            const isChecked     = visibility[col.key] !== false;
            const isLastVisible = isChecked && visibleCount === 1;
            return (
              <label
                key={col.key}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm ${isLastVisible ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isLastVisible}
                  onChange={() => !isLastVisible && onChange(col.key)}
                  className="rounded"
                />
                {col.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ClientProductsPage({
  products = [],
  totalCount = 0,
  totalPages = 1,
  currentPage = 1,
  pageSize = 20,
  currentFilters = {},
  filterOptions = {},
  lastSyncedAt: initialLastSyncedAt,
  storeName = "My Store",
  shopDomain = "",
}) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [syncing,      setSyncing]      = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(initialLastSyncedAt);
  const [banner,       setBanner]       = useState(null);
  const { toast, showToast: _showToast } = useToast();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(currentFilters.search ?? "");
  const [filterOpen, setFilterOpen] = useState(false);

  const defaultVisibility = (() => {
    const def = {};
    ALL_COLUMNS.forEach((c) => { def[c.key] = c.defaultVisible !== false; });
    return def;
  })();

  const [visibility, setVisibility] = useState(defaultVisibility);

  useEffect(() => {
    const stored = loadVisibility();
    if (stored) setVisibility(stored);
  }, []);

  function toggleColumn(key) {
    setVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveVisibility(next);
      return next;
    });
  }

  function showToast(msg) { _showToast(msg); }

  function copyToClipboard(e, value) {
    e.stopPropagation();
    navigator.clipboard.writeText(String(value));
    showToast("Copied");
  }

  // ── URL navigation helpers ────────────────────────────────────────────────

  function buildParams(overrides = {}) {
    const params  = new URLSearchParams(searchParams.toString());
    const merged  = { ...currentFilters, ...overrides };

    // String params
    ["search", "sort", "dir", "page"].forEach((k) => {
      if (merged[k]) params.set(k, merged[k]);
      else params.delete(k);
    });

    // Array params — comma-separated
    ["vendors", "categories", "collections", "status", "tags"].forEach((k) => {
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
    if (!SORT_COLUMNS.includes(key)) return;
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
      vendors:     filters.vendors,
      categories:  filters.categories,
      collections: filters.collections,
      status:      filters.status,
      tags:        filters.tags,
      page:        "1",
    });
    setFilterOpen(false);
  }

  function handleClearFilters() {
    navigate({ vendors: [], categories: [], collections: [], status: [], tags: [], page: "1" });
    setFilterOpen(false);
  }

  function goToPage(p) {
    navigate({ page: String(p) });
  }

  // Active filters for the modal (arrays)
  const activeFilters = {
    vendors:     currentFilters.vendors     ?? [],
    categories:  currentFilters.categories  ?? [],
    collections: currentFilters.collections ?? [],
    status:      currentFilters.status      ?? [],
    tags:        currentFilters.tags        ?? [],
  };

  // ── Sync ──────────────────────────────────────────────────────────────────

  async function handleSync() {
    setSyncing(true);
    setBanner(null);
    try {
      const res  = await fetch("/api/sync/products", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      setLastSyncedAt(data.last_synced_at ?? new Date().toISOString());
      setBanner({ type: "success", message: "Products sync complete." });
    } catch (err) {
      setBanner({ type: "error", message: err.message });
    } finally {
      setSyncing(false);
    }
  }

  // ── Export (current filtered page) ───────────────────────────────────────

  function exportCSV() {
    if (!products.length) { alert("No products to export."); return; }
    const cols    = ["title", "vendor", "category", "collection", "status", "handle", "variant_count"];
    const csvRows = products.map((p) =>
      cols.map((key) => {
        const val = p[key];
        if (val == null) return "";
        if (Array.isArray(val)) return `"${val.join(";")}"`;
        if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
        return val;
      }).join(",")
    );
    const csv  = [cols.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "products_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ── Pagination controls ───────────────────────────────────────────────────

  const start     = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end       = Math.min(currentPage * pageSize, totalCount);
  const pageLabel = totalCount === 0 ? "No results" : `${start}–${end} of ${totalCount.toLocaleString()}`;

  const paginationControls = {
    pageData:    products,
    pageLabel,
    currentPage,
    totalPages,
    prevPage:    () => goToPage(currentPage - 1),
    nextPage:    () => goToPage(currentPage + 1),
    goToPage,
  };

  const visibleColumns = ALL_COLUMNS.filter((c) => visibility[c.key] !== false);
  const colSpan        = visibleColumns.length;

  return (
    <AppLayout
      title="Products"
      paginationControls={paginationControls}
      actions={{
        onSearch:     () => setSearchOpen(true),
        onFilter:     () => setFilterOpen(true),
        onExport:     exportCSV,
        onSync:       handleSync,
        syncing:      syncing,
        lastSyncedAt: lastSyncedAt,
        syncLabel:    "Sync Products",
        columnsMenu:  (
          <ColumnToggleMenu
            columns={ALL_COLUMNS}
            visibility={visibility}
            onChange={toggleColumn}
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
                className={`text-left px-2 py-2 font-medium whitespace-nowrap ${
                  SORT_COLUMNS.includes(col.key)
                    ? "cursor-pointer select-none hover:bg-gray-300 transition-colors"
                    : ""
                }`}
              >
                {col.label}
                {SORT_COLUMNS.includes(col.key) && (
                  <SortIcon direction={currentFilters.sort === col.key ? currentFilters.dir : null} />
                )}
              </th>
            ))}
            <th className="w-6 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr>
              <td colSpan={colSpan + 1} className="px-2 py-8 text-center text-gray-400">
                No products found.
              </td>
            </tr>
          ) : (
            products.map((p) => (
              <tr
                key={p.id}
                className="border-b border-gray-300 hover:bg-gray-50 cursor-pointer"
                style={{ height: "48px" }}
                onClick={() => router.push(`/product/${p.shopify_product_id}`)}
              >
                {visibleColumns.map((col) => {
                  if (col.key === "image") return (
                    <td key="image" className="px-2 py-1">
                      <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden border border-gray-300 flex items-center justify-center">
                        <Image
                          src={p.image_src || "/placeholder.png"}
                          alt={p.title}
                          width={48}
                          height={48}
                          className="object-cover"
                        />
                      </div>
                    </td>
                  );
                  if (col.key === "title") return (
                    <td key="title" className="px-2 py-1">
                      <span
                        title="Click to copy Product ID"
                        onClick={(e) => copyToClipboard(e, p.shopify_product_id)}
                        className="cursor-pointer hover:text-blue-600 hover:underline"
                      >
                        {p.title}
                      </span>
                    </td>
                  );
                  if (col.key === "category")      return <td key="category"      className="px-2 py-1">{formatCategory(p.category)}</td>;
                  if (col.key === "collection")    return <td key="collection"    className="px-2 py-1">{p.collection || "—"}</td>;
                  if (col.key === "vendor")        return <td key="vendor"        className="px-2 py-1">{p.vendor}</td>;
                  if (col.key === "status")        return <td key="status"        className="px-2 py-1"><StatusPill status={p.status} /></td>;
                  if (col.key === "variant_count") return (
                    <td key="variant_count" className="px-2 py-1">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
                        {p.variant_count ?? 0}
                      </span>
                    </td>
                  );
                  if (col.key === "handle") return <td key="handle" className="px-2 py-1 text-gray-600">{p.handle || "—"}</td>;
                  if (col.key === "tags")   return (
                    <td key="tags" className="px-2 py-1 text-gray-600">
                      {Array.isArray(p.tags) ? p.tags.join(", ") : (p.tags || "—")}
                    </td>
                  );
                  return null;
                })}
                <td className="px-2 py-1 w-8 text-center">
                  <a
                    href={`${shopDomain}/admin/products/${p.shopify_product_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Open in Shopify Admin"
                    className="inline-flex items-center px-2 py-0.5 rounded border border-gray-200 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                  >
                    →
                  </a>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <Toast message={toast.message} type={toast.type} />

      <SearchModal
        isOpen={searchOpen}
        title="Search Products"
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onSearch={handleSearch}
        onClear={handleClearSearch}
        onClose={() => setSearchOpen(false)}
      />

      <ProductFilterModal
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={activeFilters}
        options={filterOptions}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />

    </AppLayout>
  );
}
