"use client";

// /src/app/suppliers/[id]/components/ClientSupplierDetailPage.jsx

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";

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

// ─── CSV field definitions (mirrors CSVTab.jsx) ───────────────────────────────

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

const CSV_ALL_KEYS    = CSV_COLUMNS.flatMap(c => c.fields.map(f => f.key));
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
          <button onClick={() => router.push(`/suppliers/${supplier.id}/edit`)}
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

function ProductDataTab({ supplier, products, router, copyToClipboard }) {
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
          <button onClick={() => router.push(`/suppliers/${supplier.id}/setup`)}
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
                <button onClick={() => router.push(`/suppliers/${supplier.id}/setup`)}
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
                <a href={`https://brandongtest.myshopify.com/admin/products/${p.shopify_product_id}`}
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
  const [saving,       setSaving]       = useState(null); // field key being saved, or 'mode'
  const [toast,        setToast]        = useState(null);

  // Load global settings + supplier-specific settings
  useEffect(() => {
    async function load() {
      try {
        // Load global CSV settings
        const globalRes  = await fetch(`/api/settings?keys=${CSV_ALL_KEYS.join(',')}`);
        const globalData = await globalRes.json();
        const merged = { ...CSV_DEFAULT_STATE };
        for (const key of CSV_ALL_KEYS) {
          if (key in globalData && globalData[key] !== '') {
            merged[key] = globalData[key] === 'true';
          }
        }
        setGlobalValues(merged);

        // Load supplier-specific settings
        const supplierRes  = await fetch(`/api/suppliers/${supplierId}/csv-settings`);
        const supplierData = await supplierRes.json();

        if (supplierData.settings) {
          // Supplier has saved settings — use them
          setLocalValues({ ...CSV_DEFAULT_STATE, ...supplierData.settings });
          setUseGlobal(supplierData.use_global);
        } else {
          // No saved settings yet — initialize local values from global
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
    // Switch to supplier-specific mode automatically
    const wasGlobal = useGlobal;
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

        {/* Mode toggle */}
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
            <CsvToggle
              checked={!useGlobal}
              onChange={handleModeToggle}
              disabled={saving === 'mode'}
            />
            <span className={`text-xs font-medium ${!useGlobal ? 'text-blue-600' : 'text-gray-400'}`}>Supplier-Specific</span>
            {saving === 'mode' && (
              <svg className="animate-spin h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
          </div>
        </div>

        {/* Toast */}
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

        {/* Three-column grid */}
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
            <button
              type="button"
              onClick={handleResetToGlobal}
              disabled={saving === 'mode'}
              className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
            >
              Reset to global settings
            </button>
          </div>
        )}

      </div>
    </Card>
  );
}

// ─── Tab: Transmission ────────────────────────────────────────────────────────

const EMPTY_RECIPIENT = { id: null, label: '', email: '', role: 'Primary', pdf: true, csv: true };

function TransmissionTab({ supplierId }) {
  const [recipients, setRecipients] = useState([]);
  const [nextId,     setNextId]     = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState(null);
  const [dirty,      setDirty]      = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/suppliers/${supplierId}/transmission`);
        const data = await res.json();
        if (data.recipients && data.recipients.length > 0) {
          const loaded = data.recipients.map((r, idx) => ({ ...r, _localId: idx + 1 }));
          setRecipients(loaded);
          setNextId(loaded.length + 1);
        } else {
          // Default first row
          setRecipients([{ _localId: 1, label: '', email: '', role: 'Primary', send_pdf: true, send_csv: true }]);
          setNextId(2);
        }
      } catch (e) {
        console.error('Failed to load transmission recipients:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supplierId]);

  function showToast(type) { setToast(type); setTimeout(() => setToast(null), 2500); }

  function addRow() {
    setRecipients((prev) => [...prev, { _localId: nextId, label: '', email: '', role: 'Primary', send_pdf: true, send_csv: true }]);
    setNextId((n) => n + 1);
    setDirty(true);
  }

  function removeRow(localId) {
    setRecipients((prev) => prev.filter((r) => r._localId !== localId));
    setDirty(true);
  }

  function updateRow(localId, field, value) {
    setRecipients((prev) => prev.map((r) => r._localId === localId ? { ...r, [field]: value } : r));
    setDirty(true);
  }

  async function handleSave() {
    // Validate — at least one Primary with an email
    const hasPrimary = recipients.some((r) => r.role === 'Primary' && r.email?.trim());
    if (!hasPrimary) {
      showToast('error_primary');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/transmission`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ recipients }),
      });
      if (!res.ok) throw new Error('Save failed');
      setDirty(false);
      showToast('saved');
    } catch {
      showToast('error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="ml-2 text-sm text-gray-500">Loading…</span>
      </div>
    );
  }

  return (
    <Card>
      <div className="space-y-4">

        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Purchase Order Recipients</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Define who receives Purchase Order emails for this supplier, and which documents each recipient gets.
            </p>
          </div>
          <div className="flex items-center gap-3 ml-6 shrink-0">
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
            {toast === 'error_primary' && (
              <span className="inline-flex items-center gap-1.5 text-xs text-red-600 font-medium">
                At least one Primary recipient with an email is required
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-40">Name / Label</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Email Address</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-32">Role</th>
                <th className="text-center px-3 py-2 font-medium text-gray-600 w-16">PDF</th>
                <th className="text-center px-3 py-2 font-medium text-gray-600 w-16">CSV</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-400 text-sm">
                    No recipients added yet.
                  </td>
                </tr>
              ) : recipients.map((r) => (
                <tr key={r._localId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={r.label}
                      onChange={(e) => updateRow(r._localId, 'label', e.target.value)}
                      placeholder="e.g. Main Orders"
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="email"
                      value={r.email}
                      onChange={(e) => updateRow(r._localId, 'email', e.target.value)}
                      placeholder="email@example.com"
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={r.role}
                      onChange={(e) => updateRow(r._localId, 'role', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="Primary">Primary</option>
                      <option value="CC">CC</option>
                      <option value="BCC">BCC</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={r.send_pdf}
                      onChange={(e) => updateRow(r._localId, 'send_pdf', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={r.send_csv}
                      onChange={(e) => updateRow(r._localId, 'send_csv', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(r._localId)}
                      className="text-gray-300 hover:text-red-400 transition"
                      title="Remove"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600 transition"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Recipient
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-md px-4 py-3">
          <p className="text-xs text-blue-700">
            <span className="font-medium">Note:</span> At least one Primary recipient with PDF checked is required to send Purchase Orders.
            These settings override the global PO email address on the supplier record.
          </p>
        </div>

      </div>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DETAIL_TABS = ['General Info', 'Product Data', 'CSV Overrides', 'Transmission'];

export default function ClientSupplierDetailPage({ supplier, products }) {
  const router = useRouter();
  const [toast,      setToast]      = useState(null);
  const [activeTab,  setActiveTab]  = useState('General Info');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2000); }

  function copyToClipboard(e, value) {
    e.stopPropagation();
    navigator.clipboard.writeText(String(value));
    showToast("Copied");
  }

  return (
    <AppLayout title={supplier.supplier_name} showActionBar={false}>

      {/* ── Back + Title + Tabs ── */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => router.push("/suppliers")}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 transition shrink-0"
          >
            ←
          </button>
          <h1 className="text-lg font-semibold leading-tight">{supplier.supplier_name}</h1>
          {supplier.supplier_number && (
            <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">
              #{supplier.supplier_number}
            </span>
          )}

          {/* Tabs inline with title row */}
          <div className="ml-4 flex border-b-0 gap-0">
            {DETAIL_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-sm font-medium rounded-t border transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-white border-gray-200 border-b-white text-blue-600 shadow-sm'
                    : 'bg-transparent border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'General Info' && (
        <GeneralInfoTab supplier={supplier} router={router} copyToClipboard={copyToClipboard} />
      )}
      {activeTab === 'Product Data' && (
        <ProductDataTab supplier={supplier} products={products} router={router} copyToClipboard={copyToClipboard} />
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
