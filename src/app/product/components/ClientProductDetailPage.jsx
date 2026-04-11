"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import { Toast, useToast } from "@/shared/components/ui/Toast";
import { stripHtml, formatCategory } from "@/shared/utils/formatters";



// ─── Variant column definitions ──────────────────────────────────────────────

const VARIANT_COLUMNS = [
  { key: "title",            label: "Title",            hideable: true,  defaultVisible: true  },
  { key: "options",          label: "Options",          hideable: true,  defaultVisible: true  },
  { key: "sku",              label: "SKU",              hideable: true,  defaultVisible: true  },
  { key: "barcode",          label: "Barcode",          hideable: true,  defaultVisible: true  },
  { key: "price",            label: "Price",            hideable: true,  defaultVisible: true  },
  { key: "compare_at_price", label: "Compare At Price", hideable: true,  defaultVisible: false },
  { key: "inventory_qty",    label: "Inventory Qty",    hideable: true,  defaultVisible: false },
  { key: "taxable",          label: "Taxable",          hideable: true,  defaultVisible: false },
  { key: "inventory_policy", label: "Backorders Allowed", hideable: true,  defaultVisible: false },
  { key: "created_at", label: "Created", hideable: true, defaultVisible: false },
  { key: "updated_at", label: "Updated", hideable: true, defaultVisible: false },
];

const VARIANT_COL_KEY = "product_detail_variant_columns";

function loadVariantVis() {
  try {
    const s = localStorage.getItem(VARIANT_COL_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function saveVariantVis(vis) {
  try { localStorage.setItem(VARIANT_COL_KEY, JSON.stringify(vis)); } catch {}
}

// ─── Small shared components ─────────────────────────────────────────────────


function StatusPill({ status }) {
  const s = status?.toLowerCase() || "unknown";
  const color =
    s === "active"   ? "bg-green-100 text-green-700 border-green-200"    :
    s === "draft"    ? "bg-yellow-100 text-yellow-700 border-yellow-200"  :
    s === "archived" ? "bg-red-100 text-red-700 border-red-200"           :
                       "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0 ${color}`}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex text-sm">
      <div className="font-semibold w-36 shrink-0 text-gray-500">{label}:</div>
      <div className="text-gray-900">{value ?? "—"}</div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm p-4 ${className}`}>
      {children}
    </div>
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
        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[170px] py-1 max-h-72 overflow-y-auto">
          {columns.filter((c) => c.hideable).map((col) => {
            const isChecked = visibility[col.key] !== false;
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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ClientProductDetailPage({ product, variants, shopDomain = "" }) {
  const router = useRouter();
  const { toast, showToast: _showToast } = useToast();

  // Image gallery
  const allImages = Array.from(
    new Set([product.image_src, ...variants.map((v) => v.image_src)].filter(Boolean))
  );
  const [activeImage, setActiveImage] = useState(allImages[0] || null);

  // Variant column visibility
  const defaultVariantVis = useMemo(() => {
    const def = {};
    VARIANT_COLUMNS.forEach((c) => { def[c.key] = c.defaultVisible !== false; });
    return def;
  }, []);

  const [variantVis, setVariantVis] = useState(defaultVariantVis);

  useEffect(() => {
    const stored = loadVariantVis();
    if (stored) setVariantVis(stored);
  }, []);

  function toggleVariantCol(key) {
    setVariantVis((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveVariantVis(next);
      return next;
    });
  }

  function showToast(msg) { _showToast(msg); }

  function copyToClipboard(e, value) {
    e.stopPropagation();
    navigator.clipboard.writeText(String(value));
    showToast("Copied");
  }

  function formatDate(val) {
    if (!val) return "—";
    try { return new Date(val).toLocaleDateString(); } catch { return val; }
  }

  // Tags
  const tags =
    Array.isArray(product.tags) ? product.tags.join(", ") :
    typeof product.tags === "string" ? product.tags : null;

  // Active option columns — skip empty and "Title"
  const optionCols = [
    { name: product.option1_name, val: "option1" },
    { name: product.option2_name, val: "option2" },
    { name: product.option3_name, val: "option3" },
  ].filter(({ name }) =>
    name &&
    name.toLowerCase() !== "title" &&
    variants.some((v) =>
      v[name === product.option1_name ? "option1" : name === product.option2_name ? "option2" : "option3"]
    )
  );

  const visibleVariantCols = VARIANT_COLUMNS.filter((c) => variantVis[c.key] !== false);
  // Options col expands to one td per optionCol, so adjust span accordingly
  const optionsVisible = variantVis["options"] !== false;
  const totalColSpan = visibleVariantCols.filter((c) => c.key !== "options").length
    + (optionsVisible ? optionCols.length : 0)
    + 1; // action col

  return (
    <AppLayout title={product.display_title || product.title} showActionBar={false}>

      {/* BACK + TITLE + STATUS */}
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/products")}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 transition shrink-0"
        >
          ←
        </button>
        <h1 className="text-lg font-semibold leading-tight">
          {product.display_title || product.title}
        </h1>
        <StatusPill status={product.status} />
      </div>

      {/* ── TOP: two cards ── */}
      <div className="grid grid-cols-2 gap-4 mb-4 items-start">

        {/* LEFT — product fields */}
        <Card>
          {product.description && (
            <div className="mb-3 text-sm text-gray-800 leading-relaxed border-b border-gray-100 pb-3">
              {stripHtml(product.description)}
            </div>
          )}
          <div className="space-y-1.5">
            <Detail label="Vendor"     value={product.vendor} />
            <Detail label="Type"       value={product.product_type} />
            <Detail label="Category"   value={formatCategory(product.category)} />
            <Detail label="Collection" value={product.collection} />
            {tags && <Detail label="Tags" value={tags} />}
            <Detail
              label="Shopify ID"
              value={
                <span
                  title="Click to copy"
                  onClick={(e) => copyToClipboard(e, product.shopify_product_id)}
                  className="cursor-pointer hover:text-blue-600 hover:underline"
                >
                  {product.shopify_product_id}
                </span>
              }
            />
          </div>
        </Card>

        {/* RIGHT — image + thumbnails */}
        <Card className="flex flex-col items-center gap-3">
          <div className="w-48 h-48 border border-black rounded overflow-hidden flex items-center justify-center bg-gray-50 shrink-0">
            <Image
              src={activeImage || "/placeholder.png"}
              alt={product.display_title || product.title || "Product"}
              width={192}
              height={192}
              className="object-cover w-full h-full"
            />
          </div>
          {allImages.length > 1 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {allImages.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(src)}
                  className={`w-12 h-12 rounded border-2 overflow-hidden flex-shrink-0 transition ${
                    activeImage === src ? "border-black" : "border-gray-300 hover:border-gray-500"
                  }`}
                >
                  <Image src={src} alt={`Image ${i + 1}`} width={48} height={48} className="object-cover w-full h-full" />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── BOTTOM: variants table ── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">Variants</h2>
          <ColumnToggleMenu
            columns={VARIANT_COLUMNS}
            visibility={variantVis}
            onChange={toggleVariantCol}
          />
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-200 border-b border-gray-300">
              {visibleVariantCols.map((col) => {
                if (col.key === "options") {
                  // Render one th per active option
                  return optionCols.map(({ name }) => (
                    <th key={name} className="text-left px-2 py-2 font-medium whitespace-nowrap">{name}</th>
                  ));
                }
                return (
                  <th key={col.key} className="text-left px-2 py-2 font-medium whitespace-nowrap">
                    {col.label}
                  </th>
                );
              })}
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {variants.length === 0 ? (
              <tr>
                <td colSpan={totalColSpan} className="px-2 py-8 text-center text-gray-400">
                  No variants found.
                </td>
              </tr>
            ) : (
              variants.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-gray-300 hover:bg-gray-50"
                  style={{ height: "44px" }}
                >
                  {visibleVariantCols.map((col) => {
                    if (col.key === "title") return (
                      <td key="title" className="px-2 py-1">
                        <span
                          title="Click to copy Variant ID"
                          onClick={(e) => copyToClipboard(e, v.shopify_variant_id)}
                          className="cursor-pointer hover:text-blue-600 hover:underline"
                        >
                          {v.display_title}
                        </span>
                      </td>
                    );
                    if (col.key === "options") return optionCols.map(({ name, val }) => (
                      <td key={name} className="px-2 py-1">{v[val] || "—"}</td>
                    ));
                    if (col.key === "sku") return (
                      <td key="sku" className="px-2 py-1">
                        <span
                          title="Click to copy SKU"
                          onClick={(e) => copyToClipboard(e, v.sku)}
                          className="cursor-pointer hover:text-blue-600 hover:underline"
                        >
                          {v.sku || "—"}
                        </span>
                      </td>
                    );
                    if (col.key === "barcode")          return <td key="barcode"          className="px-2 py-1">{v.barcode || "—"}</td>;
                    if (col.key === "price")            return <td key="price"            className="px-2 py-1">{v.price ? `$${v.price}` : "—"}</td>;
                    if (col.key === "compare_at_price") return <td key="compare_at_price" className="px-2 py-1">{v.compare_at_price ? `$${v.compare_at_price}` : "—"}</td>;
                    if (col.key === "inventory_qty")    return <td key="inventory_qty"    className="px-2 py-1">{v.inventory_quantity ?? "—"}</td>;
                    if (col.key === "taxable")          return <td key="taxable"          className="px-2 py-1">{v.taxable ? "Yes" : "No"}</td>;
                    if (col.key === "inventory_policy") {
                      const val = v.inventory_policy?.toUpperCase();
                      return <td key="inventory_policy" className="px-2 py-1">{val === "CONTINUE" ? "Yes" : val === "DENY" ? "No" : "—"}</td>;
                    }
                    if (col.key === "created_at")       return <td key="created_at"       className="px-2 py-1">{formatDate(v.created_at)}</td>;
                    if (col.key === "updated_at")       return <td key="updated_at"       className="px-2 py-1">{formatDate(v.updated_at)}</td>;
                    return null;
                  })}
                  <td className="px-2 py-1 w-8 text-center">
                    <a
                      href={`${shopDomain}/admin/products/${product.shopify_product_id}/variants/${v.shopify_variant_id}`}
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
      </Card>

      <Toast message={toast.message} type={toast.type} />

    </AppLayout>
  );
}
