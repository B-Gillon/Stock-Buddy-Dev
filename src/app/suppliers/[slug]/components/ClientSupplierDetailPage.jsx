"use client";

// /src/app/suppliers/[slug]/components/ClientSupplierDetailPage.jsx

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import Button from "@/shared/components/ui/Button";
import { useToast } from "@/shared/components/ui/Toast";

// ─── Product column definitions ───────────────────────────────────────────────

const PRODUCT_COLUMNS = [
  { key: "image",            label: "",                 hideable: false, defaultVisible: true  },
  { key: "title",            label: "Product Title",    hideable: true,  defaultVisible: true  },
  { key: "sku",              label: "SKU",              hideable: true,  defaultVisible: true  },
  { key: "price",            label: "Price",            hideable: true,  defaultVisible: true  },
  { key: "compare_at_price", label: "Compare At",       hideable: true,  defaultVisible: false },
  { key: "inventory_qty",    label: "Inventory",        hideable: true,  defaultVisible: true  },
  { key: "vendor",           label: "Vendor",           hideable: true,  defaultVisible: true  },
  { key: "product_type",     label: "Type",             hideable: true,  defaultVisible: true  },
  { key: "category",         label: "Category",         hideable: true,  defaultVisible: false },
  { key: "status",           label: "Status",           hideable: true,  defaultVisible: true  },
  { key: "barcode",          label: "Barcode",          hideable: true,  defaultVisible: false },
  { key: "taxable",          label: "Taxable",          hideable: true,  defaultVisible: false },
  { key: "inventory_policy", label: "Backorders",       hideable: true,  defaultVisible: false },
];

const COL_VIS_KEY = "supplier_detail_product_columns";
function loadColVis() {
  try { const s = localStorage.getItem(COL_VIS_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
function saveColVis(vis) {
  try { localStorage.setItem(COL_VIS_KEY, JSON.stringify(vis)); } catch {}
}

// ─── CSV field definitions ────────────────────────────────────────────────────

const CSV_COLUMNS = [
  {
    label: 'Header Fields',
    fields: [
      { key: 'csv_export.po_number',       label: 'PO Number',                   editable: false, default: true  },
      { key: 'csv_export.supplier_name',   label: 'Supplier Name',               editable: true,  default: true  },
      { key: 'csv_export.ship_to_name',    label: 'Ship To Name',                editable: false, default: true  },
      { key: 'csv_export.ship_to_address', label: 'Ship To Address',             editable: false, default: true  },
      { key: 'csv_export.po_date',         label: 'PO Date',                     editable: true,  default: true  },
      { key: 'csv_export.expected_date',   label: 'Expected Date',               editable: true,  default: true  },
      { key: 'csv_export.notes_supplier',  label: 'Notes for Supplier',          editable: true,  default: true  },
    ],
  },
  {
    label: 'Line Item Fields',
    fields: [
      { key: 'csv_export.line_no',         label: 'Line No',                     editable: false, default: true  },
      { key: 'csv_export.sku',             label: 'SKU',                         editable: false, default: true  },
      { key: 'csv_export.title',           label: 'Title',                       editable: true,  default: true  },
      { key: 'csv_export.quantity',        label: 'Quantity',                    editable: false, default: true  },
      { key: 'csv_export.unit_cost',       label: 'Unit Cost',                   editable: true,  default: true  },
      { key: 'csv_export.supplier_sku',    label: 'Supplier SKU',                editable: true,  default: false },
      { key: 'csv_export.barcode',         label: 'Barcode',                     editable: true,  default: true  },
      { key: 'csv_export.extended_cost',   label: 'Extended Cost',               editable: true,  default: false },
    ],
  },
  {
    label: 'Optional Internal Fields',
    fields: [
      { key: 'csv_export.bin_location',              label: 'Bin/Shelf Location',          editable: true, default: false },
      { key: 'csv_export.product_tags',              label: 'Product Tags',                editable: true, default: false },
      { key: 'csv_export.weight_value',              label: 'Weight',                      editable: true, default: false },
      { key: 'csv_export.total_weight',              label: 'Total Weight',                editable: true, default: false },
      { key: 'csv_export.weight_unit',               label: 'Weight Units',                editable: true, default: false },
      { key: 'csv_export.retail_price',              label: 'Retail Price',                editable: true, default: false },
      { key: 'csv_export.current_stock',             label: 'Current Stock',               editable: true, default: false },
      { key: 'csv_export.total_stock_all_locations', label: 'Total Stock (All Locations)', editable: true, default: false },
    ],
  },
];

const CSV_ALL_KEYS     = CSV_COLUMNS.flatMap(c => c.fields.map(f => f.key));
const CSV_DEFAULT_STATE = Object.fromEntries(CSV_COLUMNS.flatMap(c => c.fields.map(f => [f.key, f.default])));

// ─── Shared small components ──────────────────────────────────────────────────

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded shadow-lg z-[100] pointer-events-none">
      {message}
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

function Detail({ label, value }) {
  return (
    <div className="flex text-sm">
      <div className="font-semibold w-32 shrink-0 text-gray-500">{label}:</div>
      <div className="text-gray-900 whitespace-nowrap">{value ?? "—"}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const s = status?.toLowerCase() || "unknown";
  const color =
    s === "active"   ? "bg-green-100 text-green-700 border-green-200"   :
    s === "draft"    ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
    s === "archived" ? "bg-red-100 text-red-700 border-red-200"          :
                       "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

function formatPhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1") return `${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7)}`;
  return raw;
}

// ─── CSV Toggle ───────────────────────────────────────────────────────────────

function CsvToggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center',
        width: '36px', height: '20px', borderRadius: '9999px', border: 'none',
        padding: '2px', flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        backgroundColor: checked ? '#2563eb' : '#d1d5db',
        transition: 'background-color 0.2s', outline: 'none',
      }}
    >
      <span style={{
        display: 'block', width: '16px', height: '16px', borderRadius: '9999px',
        backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transform: checked ? 'translateX(16px)' : 'translateX(0)',
        transition: 'transform 0.2s',
      }} />
    </button>
  );
}

// ─── Column toggle ────────────────────────────────────────────────────────────

function ColumnToggleMenu({ columns, visibility, onChange }) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleOpen() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropdownStyle({ position: "fixed", top: rect.bottom + 4, right: window.innerWidth - rect.right, zIndex: 9999 });
    }
    setOpen((o) => !o);
  }

  const visibleCount = columns.filter((c) => c.hideable && visibility[c.key] !== false).length;

  return (
    <>
      <button ref={btnRef} onClick={handleOpen}
        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600">
        Columns ▾
      </button>
      {open && (
        <div ref={menuRef} style={dropdownStyle}
          className="bg-white border border-gray-200 rounded shadow-lg min-w-[180px] py-1 max-h-72 overflow-y-auto">
          {columns.filter((c) => c.hideable).map((col) => {
            const isChecked     = visibility[col.key] !== false;
            const isLastVisible = isChecked && visibleCount === 1;
            return (
              <label key={col.key}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm ${isLastVisible ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"}`}>
                <input type="checkbox" checked={isChecked} disabled={isLastVisible}
                  onChange={() => !isLastVisible && onChange(col.key)} className="rounded" />
                {col.label}
              </label>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Tab: General Info ────────────────────────────────────────────────────────

function GeneralInfoTab({ supplier, router, copyToClipboard }) {
  const addresses = supplier.supplier_addresses ?? [];

  return (
    <div className="flex gap-4 items-stretch">

      {/* Card 1 — Supplier Info */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Supplier Info</h2>
          <button onClick={() => router.push(`/suppliers/${supplier.supplier_number}/edit`)}
            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600 transition">
            Edit
          </button>
        </div>
        <div className="space-y-1">
          <Detail label="Supplier Name"   value={supplier.supplier_name} />
          <Detail label="Company Name"    value={supplier.company_name} />
          <Detail label="Supplier #"      value={supplier.supplier_number ? (
            <span title="Click to copy" onClick={(e) => copyToClipboard(e, supplier.supplier_number)}
              className="cursor-pointer hover:text-blue-600 hover:underline">{supplier.supplier_number}</span>
          ) : null} />
          <Detail label="AP#"             value={supplier.ap_number ? (
            <span title="Click to copy" onClick={(e) => copyToClipboard(e, supplier.ap_number)}
              className="cursor-pointer hover:text-blue-600 hover:underline">{supplier.ap_number}</span>
          ) : null} />
          <Detail label="Currency"        value={supplier.currency} />
          <Detail label="Lead Days"       value={supplier.lead_days != null ? `${supplier.lead_days} days` : null} />
          <Detail label="Forecast Period" value={supplier.forecast_suggestion_period != null ? `${supplier.forecast_suggestion_period} days` : null} />
          <Detail label="Tax Type"        value={supplier.supplier_tax_type} />
          <Detail label="Payment Terms"   value={supplier.payment_terms} />
          <Detail label="Payment Method"  value={supplier.payment_method} />
        </div>
      </div>

      {/* Card 2 — Contact */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 shrink-0">
        <div className="mb-3"><h2 className="text-sm font-semibold text-gray-700">Contact</h2></div>
        <div className="space-y-1">
          <Detail label="Contact Name"  value={supplier.contact_name} />
          <Detail label="Contact Email" value={supplier.contact_email ? (
            <a href={`mailto:${supplier.contact_email}`} className="text-blue-600 hover:underline">{supplier.contact_email}</a>
          ) : null} />
          <Detail label="PO Email" value={supplier.po_email ? (
            <a href={`mailto:${supplier.po_email}`} className="text-blue-600 hover:underline">{supplier.po_email}</a>
          ) : null} />
          <Detail label="Phone"      value={formatPhone(supplier.phone)} />
          <Detail label="Toll-Free"  value={formatPhone(supplier.phone_toll_free)} />
          <Detail label="Fax"        value={formatPhone(supplier.fax)} />
          <Detail label="Website" value={supplier.website ? (
            <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{supplier.website}</a>
          ) : null} />
          <Detail label="Order Form" value={supplier.online_order_form ? (
            <a href={supplier.online_order_form} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{supplier.online_order_form}</a>
          ) : null} />
          <Detail label="Username" value={supplier.username ? (
            <span title="Click to copy" onClick={(e) => copyToClipboard(e, supplier.username)}
              className="cursor-pointer hover:text-blue-600 hover:underline">{supplier.username}</span>
          ) : null} />
        </div>
      </div>

      {/* Card 3 — Addresses */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex-1 min-w-0">
        <div className="mb-3"><h2 className="text-sm font-semibold text-gray-700">Addresses</h2></div>
        <div className="space-y-3">
          {addresses.length === 0 ? (
            <p className="text-sm text-gray-400">No addresses on file.</p>
          ) : addresses.map((addr) => (
            <div key={addr.id} className="text-sm">
              <div className="font-semibold text-gray-500 capitalize mb-0.5">{addr.address_type || "Address"}:</div>
              <div className="text-gray-900 leading-snug">
                {addr.address1}{addr.address2 ? `, ${addr.address2}` : ""}<br />
                {[addr.city, addr.state_province, addr.postal_code].filter(Boolean).join(", ")}<br />
                {addr.country}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card 4 — Notes */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex-1 min-w-0">
        <div className="mb-3"><h2 className="text-sm font-semibold text-gray-700">Notes</h2></div>
        <div className="space-y-3">
          {!supplier.supplier_notes && !supplier.po_notes_template ? (
            <p className="text-sm text-gray-400">No notes on file.</p>
          ) : (
            <>
              {supplier.supplier_notes && (
                <div className="text-sm">
                  <div className="font-semibold text-gray-500 mb-0.5">Supplier Notes:</div>
                  <div className="text-gray-900 whitespace-pre-wrap">{supplier.supplier_notes}</div>
                </div>
              )}
              {supplier.po_notes_template && (
                <div className="text-sm">
                  <div className="font-semibold text-gray-500 mb-0.5">PO Notes Template:</div>
                  <div className="text-gray-900 whitespace-pre-wrap">{supplier.po_notes_template}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Tab: Product Data ────────────────────────────────────────────────────────

function ProductDataTab({ supplier, products, router, copyToClipboard, shopDomain }) {
  const defaultColVis = useMemo(() => {
    const def = {};
    PRODUCT_COLUMNS.forEach((c) => { def[c.key] = c.defaultVisible !== false; });
    return def;
  }, []);

  const [colVis, setColVis] = useState(defaultColVis);

  useEffect(() => {
    const stored = loadColVis();
    if (stored) setColVis(stored);
  }, []);

  function toggleCol(key) {
    setColVis((prev) => { const next = { ...prev, [key]: !prev[key] }; saveColVis(next); return next; });
  }

  const visibleCols  = PRODUCT_COLUMNS.filter((c) => colVis[c.key] !== false);
  const totalColSpan = visibleCols.length + 1;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-800">
          Associated Products
          {products.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">({products.length})</span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <ColumnToggleMenu columns={PRODUCT_COLUMNS} visibility={colVis} onChange={toggleCol} />
          <button
            onClick={() => router.push(`/suppliers/${supplier.supplier_number}/setup`)}
            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600 transition">
            Edit
          </button>
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-200 border-b border-gray-300">
            {visibleCols.map((col) => (
              <th key={col.key} className="text-left px-2 py-2 font-medium whitespace-nowrap">{col.label}</th>
            ))}
            <th className="w-8 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr>
              <td colSpan={totalColSpan} className="px-2 py-8 text-center text-gray-400">
                No products associated yet.{" "}
                <button onClick={() => router.push(`/suppliers/${supplier.supplier_number}/setup`)}
                  className="text-indigo-600 hover:underline">Associate products →</button>
              </td>
            </tr>
          ) : products.map((p) => (
            <tr key={p.id} onClick={() => router.push(`/products/${p.id}`)}
              className="border-b border-gray-300 hover:bg-gray-50 cursor-pointer" style={{ height: "44px" }}>
              {visibleCols.map((col) => {
                if (col.key === "image") return (
                  <td key="image" className="px-2 py-1">
                    <div className="w-8 h-8 bg-gray-100 rounded border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                      {p.image_src
                        ? <img src={p.image_src} alt={p.title} className="object-cover w-full h-full" />
                        : <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      }
                    </div>
                  </td>
                );
                if (col.key === "title")            return <td key="title"            className="px-2 py-1 font-medium text-gray-900">{p.display_title || p.title}</td>;
                if (col.key === "sku")              return <td key="sku"              className="px-2 py-1"><span title="Click to copy SKU" onClick={(e) => copyToClipboard(e, p.sku)} className="cursor-pointer hover:text-blue-600 hover:underline">{p.sku || "—"}</span></td>;
                if (col.key === "price")            return <td key="price"            className="px-2 py-1">{p.price ? `$${p.price}` : "—"}</td>;
                if (col.key === "compare_at_price") return <td key="compare_at_price" className="px-2 py-1">{p.compare_at_price ? `$${p.compare_at_price}` : "—"}</td>;
                if (col.key === "inventory_qty")    return <td key="inventory_qty"    className="px-2 py-1">{p.inventory_quantity ?? "—"}</td>;
                if (col.key === "vendor")           return <td key="vendor"           className="px-2 py-1 text-gray-600">{p.vendor || "—"}</td>;
                if (col.key === "product_type")     return <td key="product_type"     className="px-2 py-1 text-gray-600">{p.product_type || "—"}</td>;
                if (col.key === "category")         return <td key="category"         className="px-2 py-1 text-gray-600">{p.category || "—"}</td>;
                if (col.key === "status")           return <td key="status"           className="px-2 py-1"><StatusPill status={p.status} /></td>;
                if (col.key === "barcode")          return <td key="barcode"          className="px-2 py-1 text-gray-600">{p.barcode || "—"}</td>;
                if (col.key === "taxable")          return <td key="taxable"          className="px-2 py-1">{p.taxable ? "Yes" : "No"}</td>;
                if (col.key === "inventory_policy") {
                  const val = p.inventory_policy?.toUpperCase();
                  return <td key="inventory_policy" className="px-2 py-1">{val === "CONTINUE" ? "Yes" : val === "DENY" ? "No" : "—"}</td>;
                }
                return null;
              })}
              <td className="px-2 py-1 w-8 text-center" onClick={(e) => e.stopPropagation()}>
                <a href={`${shopDomain}/admin/products/${p.shopify_product_id}`}
                  target="_blank" rel="noopener noreferrer" title="Open in Shopify Admin"
                  className="inline-flex items-center px-2 py-0.5 rounded border border-gray-200 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
                  →
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ─── Tab: CSV Overrides ───────────────────────────────────────────────────────

function CsvOverridesTab({ supplierId }) {
  const [useGlobal,    setUseGlobal]    = useState(true);
  const [globalValues, setGlobalValues] = useState(CSV_DEFAULT_STATE);
  const [localValues,  setLocalValues]  = useState(CSV_DEFAULT_STATE);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(null);
  const [toast,        setToast]        = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const globalRes  = await fetch(`/api/settings?keys=${CSV_ALL_KEYS.join(',')}`);
        const globalData = await globalRes.json();
        const merged = { ...CSV_DEFAULT_STATE };
        for (const key of CSV_ALL_KEYS) {
          if (key in globalData && globalData[key] !== '') {
            merged[key] = globalData[key] === 'true';
          }
        }
        setGlobalValues(merged);

        const supplierRes  = await fetch(`/api/suppliers/${supplierId}/csv-settings`);
        const supplierData = await supplierRes.json();

        if (supplierData.settings) {
          setLocalValues({ ...CSV_DEFAULT_STATE, ...supplierData.settings });
          setUseGlobal(supplierData.use_global);
        } else {
          setLocalValues({ ...merged });
          setUseGlobal(true);
        }
      } catch (e) {
        console.error('Failed to load CSV settings:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supplierId]);

  function showToast(type) { setToast(type); setTimeout(() => setToast(null), 2500); }

  async function saveToApi(newUseGlobal, newValues) {
    const res = await fetch(`/api/suppliers/${supplierId}/csv-settings`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ use_global: newUseGlobal, settings: newValues }),
    });
    if (!res.ok) throw new Error('Save failed');
  }

  async function handleModeToggle() {
    const next = !useGlobal;
    setUseGlobal(next);
    setSaving('mode');
    try {
      await saveToApi(next, localValues);
      showToast('saved');
    } catch {
      setUseGlobal(!next);
      showToast('error');
    } finally {
      setSaving(null);
    }
  }

  async function handleToggle(key, newValue) {
    const wasGlobal  = useGlobal;
    const nextValues = { ...localValues, [key]: newValue };
    setLocalValues(nextValues);
    if (wasGlobal) setUseGlobal(false);
    setSaving(key);
    try {
      await saveToApi(false, nextValues);
      showToast('saved');
    } catch {
      setLocalValues(localValues);
      if (wasGlobal) setUseGlobal(true);
      showToast('error');
    } finally {
      setSaving(null);
    }
  }

  async function handleResetToGlobal() {
    setUseGlobal(true);
    setSaving('mode');
    try {
      await saveToApi(true, localValues);
      showToast('saved');
    } catch {
      setUseGlobal(false);
      showToast('error');
    } finally {
      setSaving(null);
    }
  }

  const displayValues = useGlobal ? globalValues : localValues;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="ml-2 text-sm text-gray-500">Loading settings…</span>
      </div>
    );
  }

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {useGlobal ? 'Using Global CSV Settings' : 'Using Supplier-Specific CSV Settings'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {useGlobal
                ? 'This supplier uses the global CSV export settings. Toggle to override per-supplier.'
                : 'This supplier has custom CSV export settings. Changes apply only to this supplier.'}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-6 shrink-0">
            <span className={`text-xs font-medium ${useGlobal ? 'text-blue-600' : 'text-gray-400'}`}>Global</span>
            <CsvToggle checked={!useGlobal} onChange={handleModeToggle} disabled={saving === 'mode'} />
            <span className={`text-xs font-medium ${!useGlobal ? 'text-blue-600' : 'text-gray-400'}`}>Supplier-Specific</span>
            {saving === 'mode' && (
              <svg className="animate-spin h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
          </div>
        </div>

        <div className="flex justify-end h-4">
          {toast === 'saved' && (
            <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          {toast === 'error' && (
            <span className="inline-flex items-center gap-1.5 text-xs text-red-600 font-medium">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Save failed
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 items-start">
          {CSV_COLUMNS.map((col) => (
            <div key={col.label}>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{col.label}</h4>
              <div className={`bg-gray-50 rounded-lg border border-gray-200 overflow-hidden ${useGlobal ? 'opacity-60 pointer-events-none' : ''}`}>
                {col.fields.map((field, idx) => (
                  <div key={field.key}
                    className={`flex items-center justify-between px-3 py-2.5 ${idx < col.fields.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CsvToggle
                        checked={displayValues[field.key]}
                        onChange={(val) => handleToggle(field.key, val)}
                        disabled={!field.editable || saving === field.key || useGlobal}
                      />
                      <span className={`text-sm truncate ${field.editable ? 'text-gray-800' : 'text-gray-500'}`}>
                        {field.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                      {saving === field.key && (
                        <svg className="animate-spin h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      )}
                      {!field.editable && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">Req</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {!useGlobal && (
          <div className="pt-2">
            <button type="button" onClick={handleResetToGlobal} disabled={saving === 'mode'}
              className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50">
              Reset to global settings
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Tab: Transmission ────────────────────────────────────────────────────────

const newRecord = () => ({
  _key:       crypto.randomUUID(),
  label:      "",
  to_emails:  "",
  cc_emails:  "",
  bcc_emails: "",
  send_pdf:   true,
  send_csv:   true,
  showCc:     false,
  showBcc:    false,
});

function snapshot(records) {
  return records.map((r) => ({
    label:      r.label,
    to_emails:  r.to_emails,
    cc_emails:  r.cc_emails,
    bcc_emails: r.bcc_emails,
    send_pdf:   r.send_pdf,
    send_csv:   r.send_csv,
  }));
}

function isDirtyCheck(current, saved) {
  return JSON.stringify(snapshot(current)) !== JSON.stringify(snapshot(saved));
}

function TransmissionTab({ supplierId }) {
  const { showToast } = useToast();
  const [records, setRecords] = useState([]);
  const [saved,   setSaved]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/suppliers/${supplierId}/transmission`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      const loaded = (json.recipients ?? []).map((r) => ({
        ...newRecord(),
        ...r,
        _key:       crypto.randomUUID(),
        cc_emails:  r.cc_emails  ?? "",
        bcc_emails: r.bcc_emails ?? "",
        showCc:     !!r.cc_emails,
        showBcc:    !!r.bcc_emails,
      }));
      setRecords(loaded);
      setSaved(loaded);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [supplierId, showToast]);

  useEffect(() => { load(); }, [load]);

  const dirty = isDirtyCheck(records, saved);

  const addRecord    = () => setRecords((prev) => [...prev, newRecord()]);
  const removeRecord = (key) => setRecords((prev) => prev.filter((r) => r._key !== key));
  const update       = (key, field, value) =>
    setRecords((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)));

  const handleSave = async () => {
    const hasPrimary = records.some((r) => r.to_emails.trim() !== "");
    if (!hasPrimary) { showToast("At least one record must have a To email address.", "error"); return; }
    setSaving(true);
    try {
      const payload = records.map((r) => ({
        label:      r.label,
        to_emails:  r.to_emails,
        cc_emails:  r.showCc  ? r.cc_emails  : "",
        bcc_emails: r.showBcc ? r.bcc_emails : "",
        send_pdf:   r.send_pdf,
        send_csv:   r.send_csv,
      }));
      const res  = await fetch(`/api/suppliers/${supplierId}/transmission`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ recipients: payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setSaved(records.map((r) => ({ ...r })));
      showToast("Transmission recipients saved.", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-500 max-w-lg">
          Each record below represents one separate email send. Add multiple addresses per field using commas.
        </p>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <Button variant="secondary" size="sm" onClick={addRecord}>+ Add Recipient</Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {records.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400">
          No recipients yet.{" "}
          <button className="text-blue-600 underline hover:text-blue-700" onClick={addRecord}>Add one</button>.
        </div>
      )}

      <div className="space-y-3">
        {records.map((r) => (
          <RecipientCard
            key={r._key}
            record={r}
            onUpdate={(field, value) => update(r._key, field, value)}
            onRemove={() => removeRecord(r._key)}
          />
        ))}
      </div>

      {records.length > 0 && !records.some((r) => r.to_emails.trim() !== "") && (
        <p className="text-xs text-amber-600">⚠ At least one record needs a To email address before saving.</p>
      )}
    </div>
  );
}

function RecipientCard({ record, onUpdate, onRemove }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Name / Label</label>
          <input type="text" value={record.label} onChange={(e) => onUpdate("label", e.target.value)}
            placeholder="e.g. Purchasing Team"
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300" />
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <span className="text-xs font-medium text-gray-500">PDF</span>
          <input type="checkbox" checked={record.send_pdf} onChange={(e) => onUpdate("send_pdf", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <span className="text-xs font-medium text-gray-500">CSV</span>
          <input type="checkbox" checked={record.send_csv} onChange={(e) => onUpdate("send_csv", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
        </div>
        <button onClick={onRemove} className="shrink-0 text-gray-300 hover:text-red-500 transition-colors mt-4" title="Remove">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="px-4 pb-2">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Email Addresses <span className="font-normal text-gray-400">(add multiples with comma separator)</span>
        </label>
        <input type="text" value={record.to_emails} onChange={(e) => onUpdate("to_emails", e.target.value)}
          placeholder="orders@supplier.com, purchasing@supplier.com"
          className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300" />
      </div>

      {record.showCc && (
        <div className="px-4 pb-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            CC Addresses <span className="font-normal text-gray-400">(comma separated)</span>
          </label>
          <input type="text" value={record.cc_emails} onChange={(e) => onUpdate("cc_emails", e.target.value)}
            placeholder="manager@supplier.com"
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300" />
        </div>
      )}

      {record.showBcc && (
        <div className="px-4 pb-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            BCC Addresses <span className="font-normal text-gray-400">(comma separated)</span>
          </label>
          <input type="text" value={record.bcc_emails} onChange={(e) => onUpdate("bcc_emails", e.target.value)}
            placeholder="archive@mycompany.com"
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300" />
        </div>
      )}

      <div className="flex items-center gap-3 px-4 pb-3 pt-1">
        <button type="button"
          onClick={() => { onUpdate("showCc", !record.showCc); if (record.showCc) onUpdate("cc_emails", ""); }}
          className={`inline-flex items-center gap-1 text-xs font-medium transition ${record.showCc ? "text-blue-600 hover:text-blue-800" : "text-gray-400 hover:text-gray-600"}`}>
          {record.showCc ? "− Remove CC" : "+ Add CC"}
        </button>
        <button type="button"
          onClick={() => { onUpdate("showBcc", !record.showBcc); if (record.showBcc) onUpdate("bcc_emails", ""); }}
          className={`inline-flex items-center gap-1 text-xs font-medium transition ${record.showBcc ? "text-blue-600 hover:text-blue-800" : "text-gray-400 hover:text-gray-600"}`}>
          {record.showBcc ? "− Remove BCC" : "+ Add BCC"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DETAIL_TABS = ['General Info', 'Product Data', 'CSV Overrides', 'Transmission'];

export default function ClientSupplierDetailPage({ supplier, products, shopDomain = "" }) {
  const router = useRouter();
  const [toast, setToast] = useState(null);

  // Read active tab from URL param so it persists across navigation
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      return DETAIL_TABS.includes(tab) ? tab : "General Info";
    }
    return "General Info";
  });

  function handleTabClick(tab) {
    setActiveTab(tab);
    // Update URL so the active tab is preserved on back navigation
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2000); }

  function copyToClipboard(e, value) {
    e.stopPropagation();
    navigator.clipboard.writeText(String(value));
    showToast("Copied");
  }

  return (
    <AppLayout title={supplier.supplier_name} showActionBar={false}>

      <div className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.push("/suppliers")}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 transition shrink-0">
            ←
          </button>
          <h1 className="text-lg font-semibold leading-tight">{supplier.supplier_name}</h1>
          {supplier.supplier_number && (
            <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">
              #{supplier.supplier_number}
            </span>
          )}
          <div className="ml-4 flex border-b-0 gap-0">
            {DETAIL_TABS.map((tab) => (
              <button key={tab} type="button" onClick={() => handleTabClick(tab)}
                className={`px-4 py-1.5 text-sm font-medium rounded-t border transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-white border-gray-200 border-b-white text-blue-600 shadow-sm'
                    : 'bg-transparent border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'General Info' && (
        <GeneralInfoTab supplier={supplier} router={router} copyToClipboard={copyToClipboard} />
      )}
      {activeTab === 'Product Data' && (
        <ProductDataTab
          supplier={supplier}
          products={products}
          router={router}
          copyToClipboard={copyToClipboard}
          shopDomain={shopDomain}
        />
      )}
      {activeTab === 'CSV Overrides' && (
        <CsvOverridesTab supplierId={supplier.id} />
      )}
      {activeTab === 'Transmission' && (
        <TransmissionTab supplierId={supplier.id} />
      )}

      <Toast message={toast} />
    </AppLayout>
  );
}
