"use client";

// /src/app/purchase-orders/create/components/PurchaseOrderCreatePage.jsx

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import Button from "@/shared/components/ui/Button";
import Badge from "@/shared/components/ui/Badge";
import { Toast, useToast } from "@/shared/components/ui/Toast";
import { usePurchaseOrderFormState } from "./usePurchaseOrderFormState";
import { formatCurrency } from "@/shared/utils/formatCurrency";

// ---------------------------------------------------------------------------
// VariantSearch — inline typeahead used in each row
// ---------------------------------------------------------------------------
function VariantSearch({ value, variants, supplierVariants, supplierId, onSelect, placeholder }) {
  const [query, setQuery] = useState(value || "");
  const [open,  setOpen]  = useState(false);
  const ref = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.length < 1 ? [] : variants.filter((v) => {
    const q  = query.toLowerCase();
    const sv = supplierVariants.find((sv) => sv.variant_id === v.id && sv.supplier_id === supplierId);
    return (
      v.display_title?.toLowerCase().includes(q) ||
      v.product_title?.toLowerCase().includes(q) ||
      v.sku?.toLowerCase().includes(q) ||
      v.barcode?.toLowerCase().includes(q) ||
      sv?.supplier_sku?.toLowerCase().includes(q)
    );
  }).slice(0, 20);

  return (
    <div ref={ref} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => query.length >= 1 && setOpen(true)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 bg-white hover:border-gray-300 placeholder-gray-300"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 mt-0.5 w-96 bg-white border border-gray-200 rounded-md shadow-xl max-h-96 overflow-y-auto">
          {filtered.map((v) => {
            const sv = supplierVariants.find((sv) => sv.variant_id === v.id && sv.supplier_id === supplierId);
            return (
              <button
                key={v.id}
                type="button"
                onMouseDown={() => { onSelect(v, sv); setOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  {v.image_src ? (
                    <img src={v.image_src} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0 border border-gray-100" />
                  ) : (
                    <div className="h-8 w-8 rounded bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-900 truncate">{v.display_title || v.product_title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {v.sku && (
                        <span className="text-xs text-gray-400 truncate">SKU: {v.sku}</span>
                      )}
                      {v.sku && v.barcode && (
                        <span className="text-gray-200 text-xs">·</span>
                      )}
                      {v.barcode && (
                        <span className="text-xs text-gray-400 truncate">UPC: {v.barcode}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LineItemRow
// ---------------------------------------------------------------------------
const cellClass     = "px-2 py-1 align-middle border-r border-gray-100 last:border-r-0";
const readOnlyClass = `${cellClass} text-xs text-gray-500`;

function LineItemRow({ row, rowIndex, variants, supplierVariants, supplierId, currencyCode, onUpdate, onClear, onBlur, getInventoryLevel }) {
  const isEmpty = !row.variant_id;
  const rowBg   = isEmpty
    ? rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/50"
    : rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50";

  const handleSelect = useCallback((variant, sv) => {
    const { available, incoming } = getInventoryLevel(variant.id);
    const supplierCost = sv?.cost != null && parseFloat(sv.cost) !== 0 ? sv.cost : null;
    const resolvedCost = supplierCost ?? (variant.cost != null ? variant.cost : null);
    onUpdate(row._rowId, {
      variant_id:           variant.id,
      display_title:        variant.display_title ?? "",
      sku:                  variant.sku ?? "",
      barcode:              variant.barcode ?? "",
      supplier_sku:         sv?.supplier_sku ?? "",
      supplier_variant_id:  sv?.id ?? null,
      unit_cost:            resolvedCost != null ? String(resolvedCost) : "",
      unit_cost_overridden: false,
      case_pack:            sv?.case_pack ?? null,
      order_increment:      sv?.order_increment ?? null,
      moq:                  sv?.moq ?? null,
      lead_days:            sv?.lead_days ?? null,
      current_available:    available,
      on_order:             incoming,
    });
  }, [row._rowId, onUpdate, getInventoryLevel]);

  return (
    <tr className={`${rowBg} border-b border-gray-100 group`} style={{ height: "36px" }}>

      {/* # */}
      <td className={`${cellClass} w-8 text-center`}>
        <span className="text-xs text-gray-400">{rowIndex + 1}</span>
      </td>

      {/* Display Title */}
      <td className={`${cellClass} min-w-0`} style={{ width: "220px" }}>
        <VariantSearch value={row.display_title} variants={variants} supplierVariants={supplierVariants} supplierId={supplierId} onSelect={handleSelect} placeholder="" />
      </td>

      {/* SKU */}
      <td className={cellClass} style={{ width: "120px" }}>
        <VariantSearch value={row.sku} variants={variants} supplierVariants={supplierVariants} supplierId={supplierId} onSelect={handleSelect} placeholder="" />
      </td>

      {/* Barcode */}
      <td className={cellClass} style={{ width: "160px" }}>
        <VariantSearch value={row.barcode} variants={variants} supplierVariants={supplierVariants} supplierId={supplierId} onSelect={handleSelect} placeholder="" />
      </td>

      {/* Quantity */}
      <td className={cellClass} style={{ width: "80px" }}>
        <div className="relative">
          <input
            type="number" min="0"
            value={row.order_qty}
            onChange={(e) => onUpdate(row._rowId, { order_qty: e.target.value })}
            onBlur={() => onBlur(row._rowId)}
            placeholder=""
            disabled={isEmpty}
            title={row.error ?? undefined}
            className={`w-full px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 bg-transparent ${
              row.error ? "border-red-400 ring-red-400 bg-red-50"
              : isEmpty ? "border-transparent cursor-default"
                        : "border-transparent hover:border-gray-300 focus:border-gray-300 focus:ring-gray-300"
            }`}
          />
          {row.error && (
            <span className="absolute -top-5 right-0 text-xs text-red-500 whitespace-nowrap bg-white px-1 shadow rounded border border-red-100 z-10 hidden group-hover:block">
              {row.error}
            </span>
          )}
        </div>
      </td>

      {/* Available */}
      <td className={`${cellClass} text-xs text-gray-600`} style={{ width: "70px" }}>
        {isEmpty ? <span className="text-gray-200">—</span> : row.current_available ?? 0}
      </td>

      {/* On Order — wider to prevent wrapping */}
      <td className={`${cellClass} text-xs text-gray-600 whitespace-nowrap`} style={{ width: "90px" }}>
        {isEmpty ? <span className="text-gray-200">—</span> : (row.on_order ?? 0)}
      </td>

      {/* Unit Cost — read-only */}
      <td className={`${cellClass} text-xs text-gray-600`} style={{ width: "90px" }}>
        {row.unit_cost != null && row.unit_cost !== ""
          ? formatCurrency(row.unit_cost, currencyCode)
          : <span className="text-gray-200">—</span>}
      </td>

      {/* Extended Cost */}
      <td className={`${cellClass} text-xs text-gray-600`} style={{ width: "90px" }}>
        {row.extended_cost != null
          ? <span className="font-medium">{formatCurrency(row.extended_cost, currencyCode)}</span>
          : <span className="text-gray-200">—</span>}
      </td>

    </tr>
  );
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------
const LINE_ITEMS_COLUMNS = [
  { key: "_num",              label: "",                  width: "32px"  },
  { key: "display_title",     label: "Product / Variant", width: "220px" },
  { key: "sku",               label: "SKU",               width: "120px" },
  { key: "barcode",           label: "Barcode",           width: "160px" },
  { key: "order_qty",         label: "Quantity",          width: "80px"  },
  { key: "current_available", label: "Available",         width: "70px"  },
  { key: "on_order",          label: "On Order",          width: "90px"  },
  { key: "unit_cost",         label: "Unit Cost",         width: "90px"  },
  { key: "extended_cost",     label: "Ext. Cost",         width: "90px"  },
];

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function PurchaseOrderCreatePage({
  suppliers,
  locations,
  variants,
  supplierVariants,
  inventoryLevels,
  editMode = false,
  existingPO = null,
  initialHeader = null,
  initialRows = null,
  poNextNumber = null,
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { toast, showToast } = useToast();
  const [isDirty, setIsDirty] = useState(false);

  const isDirtyRef = useRef(false);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    function handleBeforeUnload(e) {
      if (isDirtyRef.current) { e.preventDefault(); e.returnValue = ''; }
    }
    function handleClick(e) {
      if (!isDirtyRef.current) return;
      const anchor = e.target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      e.preventDefault();
      if (window.confirm("Please save your Purchase Order before leaving the page. Any unsaved changes will be lost.\n\nLeave without saving?")) {
        router.push(href);
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleClick, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClick, true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierOpen,   setSupplierOpen]   = useState(false);
  const supplierRef = useRef(null);

  const { header, setHeader, rows, activeRows, updateRow, blurRow, clearRow, addRows, headerErrors, validateAll } =
    usePurchaseOrderFormState(initialHeader, initialRows);

  const fieldsLocked = editMode || activeRows.length > 0;

  const selectedSupplier  = suppliers.find((s) => s.id === header.supplier_id);
  const filteredSuppliers = suppliers.filter((s) => {
    const q = supplierSearch.toLowerCase();
    return s.supplier_name.toLowerCase().includes(q) || s.supplier_number.toLowerCase().includes(q);
  });

  // Only show variants associated with the selected supplier
  const supplierVariantIds = header.supplier_id
    ? new Set(supplierVariants.filter((sv) => sv.supplier_id === header.supplier_id).map((sv) => sv.variant_id))
    : new Set();
  const supplierFilteredVariants = header.supplier_id
    ? variants.filter((v) => supplierVariantIds.has(v.id))
    : [];

  useEffect(() => {
    function handler(e) {
      if (supplierRef.current && !supplierRef.current.contains(e.target)) setSupplierOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleCancel() {
    if (isDirty && !window.confirm("Please save your Purchase Order before leaving the page. Any unsaved changes will be lost.\n\nLeave without saving?")) return;
    router.back();
  }

  function markDirty(field, value) {
    setIsDirty(true);
    setHeader(field, value, { suppliersData: suppliers });
  }

  function handleExpectedDateChange(e) {
    const value = e.target.value;
    markDirty("expected_date", value);

    if (value && selectedSupplier?.lead_days) {
      const chosen = new Date(value);
      const minDate = new Date();
      minDate.setDate(minDate.getDate() + selectedSupplier.lead_days);
      chosen.setHours(0, 0, 0, 0);
      minDate.setHours(0, 0, 0, 0);
      if (chosen < minDate) {
        showToast(
          `Warning: based on this supplier's ${selectedSupplier.lead_days}-day lead time, a PO released today would arrive around ${minDate.toLocaleDateString()}. Your selected date is earlier than that.`,
          "warning",
          6000
        );
      }
    }
  }

  function getInventoryLevel(variantId) {
    if (!header.ship_to_location_id || !variantId) return { available: 0, incoming: 0 };
    const level = inventoryLevels.find(
      (il) => il.variant_id === variantId && il.location_id === header.ship_to_location_id
    );
    return { available: level?.available ?? 0, incoming: level?.incoming ?? 0 };
  }

  async function handleSaveDraft() {
    if (!validateAll()) { showToast("Please fix the highlighted fields before saving.", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        header,
        lines: activeRows.map((r) => ({
          variant_id:          r.variant_id,
          supplier_variant_id: r.supplier_variant_id ?? null,
          sku:                 r.sku ?? null,
          title:               r.display_title ?? null,
          order_qty_units:     parseInt(r.order_qty, 10),
          unit_cost:           r.unit_cost ? parseFloat(r.unit_cost) : null,
          extended_cost:       r.extended_cost ?? null,
          case_pack_qty:       r.case_pack ?? null,
        })),
      };

      let slug;
      if (editMode && existingPO) {
        const res = await fetch(`/api/purchase-orders/${existingPO.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Save failed'); }
        slug = existingPO.po_number;
      } else {
        const res = await fetch('/api/purchase-orders', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Save failed'); }
        const data = await res.json();
        slug = data.slug;
      }

      if (editMode && existingPO && header.status === 'released') {
        try {
          await fetch(`/api/purchase-orders/${existingPO.id}/resend`, { method: 'POST' });
        } catch {
          // Non-fatal
        }
      }

      isDirtyRef.current = false;
      setIsDirty(false);
      showToast(editMode && header.status === 'released' ? 'Changes saved and PO resent to supplier.' : 'Saved successfully.');
      setTimeout(() => router.push(`/purchase-orders/${encodeURIComponent(slug)}`), 100);
    } catch (err) {
      showToast(err.message || 'Failed to save.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const totalExtended = activeRows.reduce((sum, r) => sum + (r.extended_cost ?? 0), 0);
  const totalUnits    = activeRows.reduce((sum, r) => sum + (parseInt(r.order_qty, 10) || 0), 0);

  // Line items unlocked in edit mode (supplier already set), or once supplier chosen in create mode
  const lineItemsActive = editMode ? true : !!header.supplier_id;

  if (!editMode && !poNextNumber) {
    return (
      <AppLayout title="New Purchase Order" showActionBar={false} bareLayout={true}>
        <div className="bg-white rounded-lg border border-amber-200 shadow-sm p-8 text-center max-w-lg mx-auto mt-8">
          <svg className="mx-auto h-10 w-10 text-amber-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <h2 className="text-base font-semibold text-gray-800 mb-2">PO Numbering Not Configured</h2>
          <p className="text-sm text-gray-500 mb-6">
            You must set a starting PO number in Settings before creating purchase orders.
          </p>
          <Button onClick={() => router.push('/settings')}>Go to Settings</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={editMode ? "Edit Purchase Order" : "New Purchase Order"} showActionBar={false} bareLayout={true}>

      <div className="space-y-4">

        {/* ── HEADER CARD ─────────────────────────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">

          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-800">Purchase Order Details</h2>
            <div className="flex items-center gap-3">
              <Badge status={editMode ? header.status ?? "draft" : "draft"} />
              <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
              <Button onClick={handleSaveDraft} disabled={saving}>{saving ? "Saving…" : editMode ? "Save Changes" : "Save Draft"}</Button>
            </div>
          </div>

          <div className="px-6 py-5 pb-6 flex gap-6">

            {/* Col 1 — fields (~25%) */}
            <div className="flex flex-col gap-4" style={{ width: "25%" }}>

              {/* Supplier */}
              {fieldsLocked ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Supplier</p>
                  <p className="text-sm text-gray-900 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">{selectedSupplier?.supplier_name ?? '—'}</p>
                </div>
              ) : (
                <div ref={supplierRef} className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setSupplierOpen((v) => !v)}
                    className={`w-full flex items-center justify-between px-3 py-2 border rounded-md text-sm bg-white text-left transition-colors ${
                      headerErrors.supplier_id ? "border-red-400 ring-1 ring-red-400" : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <span className={`truncate ${selectedSupplier ? "text-gray-900" : "text-gray-400"}`}>
                      {selectedSupplier ? selectedSupplier.supplier_name : "Select supplier…"}
                    </span>
                    <svg className="h-4 w-4 text-gray-400 flex-shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {supplierOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 flex flex-col">
                      <div className="p-2 border-b border-gray-100">
                        <input
                          autoFocus
                          type="text"
                          value={supplierSearch}
                          onChange={(e) => setSupplierSearch(e.target.value)}
                          placeholder="Search suppliers…"
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {filteredSuppliers.length === 0
                          ? <p className="px-3 py-3 text-sm text-gray-400">No results</p>
                          : filteredSuppliers.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => { markDirty("supplier_id", s.id); setSupplierOpen(false); setSupplierSearch(""); }}
                                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 ${
                                  s.id === header.supplier_id ? "bg-gray-50 font-medium" : ""
                                }`}
                              >
                                <span className="text-gray-900">{s.supplier_name}</span>
                              </button>
                            ))
                        }
                      </div>
                    </div>
                  )}
                  {headerErrors.supplier_id && <p className="mt-1 text-xs text-red-500">{headerErrors.supplier_id}</p>}
                </div>
              )}

              {/* Ship-To Location */}
              {editMode ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Ship-To Location</p>
                  <p className="text-sm text-gray-900 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                    {locations.find((l) => l.id === header.ship_to_location_id)?.name ?? '—'}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ship-To Location <span className="text-red-500">*</span></label>
                  <select
                    value={header.ship_to_location_id}
                    onChange={(e) => markDirty("ship_to_location_id", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 hover:border-gray-400 ${
                      headerErrors.ship_to_location_id ? "border-red-400 ring-1 ring-red-400" : "border-gray-300"
                    }`}
                  >
                    <option value="">Select location…</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  {headerErrors.ship_to_location_id && <p className="mt-1 text-xs text-red-500">{headerErrors.ship_to_location_id}</p>}
                </div>
              )}

              {/* PO Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  PO Date <span className="text-red-500">*</span>
                </label>
                {header.status === 'released' ? (
                  <p className="text-sm text-gray-900 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">{header.po_date || '—'}</p>
                ) : (
                  <input
                    type="date"
                    value={header.po_date}
                    onChange={(e) => markDirty("po_date", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 ${
                      headerErrors.po_date ? "border-red-400 ring-1 ring-red-400" : "border-gray-300 hover:border-gray-400"
                    }`}
                  />
                )}
                {headerErrors.po_date && <p className="mt-1 text-xs text-red-500">{headerErrors.po_date}</p>}
              </div>

              {/* Expected Date — auto-populated from supplier lead days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Expected Date
                  {selectedSupplier?.lead_days && (
                    <span className="ml-1.5 text-xs text-gray-400 font-normal">
                      ({selectedSupplier.lead_days}-day lead)
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={header.expected_date}
                  onChange={handleExpectedDateChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

            </div>

            {/* Col 2 — Notes to Supplier */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes to Supplier</label>
              <textarea
                value={header.notes_supplier}
                onChange={(e) => markDirty("notes_supplier", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                style={{ height: "220px" }}
              />
            </div>

            {/* Col 3 — Internal Notes */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Internal Notes</label>
              <textarea
                value={header.notes_internal}
                onChange={(e) => markDirty("notes_internal", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                style={{ height: "220px" }}
              />
            </div>

          </div>
        </div>

        {/* ── LINE ITEMS CARD ──────────────────────────────────────── */}
        <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${!lineItemsActive ? "opacity-50 pointer-events-none select-none" : ""}`}>

          <div className="px-6 py-3 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-800">Line Items</h2>
          </div>

          <div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-200">
                  {LINE_ITEMS_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500 border-r border-gray-300 last:border-r-0 whitespace-nowrap"
                      style={{ width: col.width }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <LineItemRow
                    key={row._rowId}
                    row={row}
                    rowIndex={idx}
                    variants={supplierFilteredVariants}
                    supplierVariants={supplierVariants}
                    supplierId={header.supplier_id || null}
                    currencyCode={selectedSupplier?.currency ?? 'USD'}
                    onUpdate={(rowId, changes) => { setIsDirty(true); updateRow(rowId, changes); }}
                    onClear={clearRow}
                    onBlur={blurRow}
                    getInventoryLevel={getInventoryLevel}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <div>
              {activeRows.some((r) => r.error) && (
                <p className="text-xs text-red-500">
                  {activeRows.filter((r) => r.error).length} line item{activeRows.filter((r) => r.error).length !== 1 ? "s have" : " has"} validation errors
                </p>
              )}
            </div>
            {totalExtended > 0 && (
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Total</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(totalExtended, selectedSupplier?.currency ?? 'USD')}
                </p>
              </div>
            )}
          </div>

          <div style={{ height: "144px" }} />

        </div>

        {/* ── BOTTOM SAVE ─────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 py-2">
          <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSaveDraft} disabled={saving}>{saving ? "Saving…" : editMode ? "Save Changes" : "Save Draft"}</Button>
        </div>

      </div>

      <Toast message={toast.message} type={toast.type} />

    </AppLayout>
  );
}
