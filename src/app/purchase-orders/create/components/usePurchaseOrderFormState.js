'use client';

import { useState, useCallback } from 'react';

let _rowCounter = 1;
function nextRowId() {
  return _rowCounter++;
}

function buildEmptyRow(id) {
  return {
    _rowId: id,
    variant_id: null,
    supplier_variant_id: null,
    display_title: '',
    sku: '',
    barcode: '',
    supplier_sku: '',
    current_available: null,
    on_order: null,
    order_qty: '',
    unit_cost: '',
    unit_cost_overridden: false,
    case_pack: null,
    order_increment: null,
    moq: null,
    lead_days: null,
    extended_cost: null,
    esd: null,
    error: null,
  };
}

function addBusinessDays(dateStr, days) {
  if (!dateStr || !days) return null;
  const date = new Date(dateStr);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return date.toISOString().split('T')[0];
}

function validateRow(row) {
  if (!row.variant_id) return null;
  if (!row.order_qty && row.order_qty !== 0) return null;
  const qty = parseInt(row.order_qty, 10);
  if (isNaN(qty) || qty <= 0) return 'Quantity must be greater than 0';
  return null;
}

export function usePurchaseOrderFormState(initialHeader = null, initialRows = null) {
  const today = new Date().toISOString().split('T')[0];

  const [header, setHeaderRaw] = useState(() => initialHeader ?? {
    supplier_id: '',
    ship_to_location_id: '',
    po_date: today,
    expected_date: '',
    notes_internal: '',
    notes_supplier: '',
    status: 'draft',
  });

  const [rows, setRows] = useState(() => {
    if (initialRows && initialRows.length > 0) {
      return [...initialRows.map((r) => ({ ...r, _rowId: nextRowId(), error: null })), buildEmptyRow(nextRowId())];
    }
    return [buildEmptyRow(nextRowId())];
  });
  const [headerErrors, setHeaderErrors] = useState({});

  const setHeader = useCallback((field, value) => {
    setHeaderRaw((prev) => {
      const next = { ...prev, [field]: value };
      return next;
    });
    // Recalculate ESDs when po_date changes
    if (field === 'po_date') {
      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          esd: addBusinessDays(value, row.lead_days),
        }))
      );
    }
  }, []);

  const updateRow = useCallback((rowId, changes) => {
    setRows((prev) => {
      const updated = prev.map((row) => {
        if (row._rowId !== rowId) return row;
        const next = { ...row, ...changes };
        // Recalculate extended cost
        const qty = parseFloat(next.order_qty);
        const cost = next.unit_cost !== '' && next.unit_cost != null ? parseFloat(next.unit_cost) : 0;
        next.extended_cost = qty > 0 ? +(qty * cost).toFixed(4) : null;
        // Recalculate ESD
        next.esd = addBusinessDays(header.po_date, next.lead_days);
        // Only re-validate if the row already had an error (clears when fixed)
        if (next.error) next.error = validateRow(next);
        return next;
      });

      // Auto-append a new empty row when a variant is set and this is the last row
      const changedRow = updated.find((r) => r._rowId === rowId);
      const isLast = updated[updated.length - 1]._rowId === rowId;
      if (changedRow?.variant_id && isLast) {
        return [...updated, buildEmptyRow(nextRowId())];
      }
      return updated;
    });
  }, [header.po_date]);

  const fillRowFromVariant = useCallback((rowId, variant, supplierVariant, inventoryLevel) => {
    updateRow(rowId, {
      variant_id: variant.id,
      display_title: variant.display_title ?? '',
      sku: variant.sku ?? '',
      barcode: variant.barcode ?? '',
      supplier_sku: supplierVariant?.supplier_sku ?? '',
      supplier_variant_id: supplierVariant?.id ?? null,
      unit_cost: supplierVariant?.cost != null ? String(supplierVariant.cost) : '',
      unit_cost_overridden: false,
      case_pack: supplierVariant?.case_pack ?? null,
      order_increment: supplierVariant?.order_increment ?? null,
      moq: supplierVariant?.moq ?? null,
      lead_days: supplierVariant?.lead_days ?? null,
      current_available: inventoryLevel?.available ?? null,
      on_order: inventoryLevel?.incoming ?? null,
    });
  }, [updateRow]);

  const clearRow = useCallback((rowId) => {
    setRows((prev) =>
      prev.map((row) =>
        row._rowId === rowId ? buildEmptyRow(rowId) : row
      )
    );
  }, []);

  const addRows = useCallback((count = 10) => {
    const newRows = Array.from({ length: count }, () => buildEmptyRow(nextRowId()));
    setRows((prev) => [...prev, ...newRows]);
  }, []);

  const blurRow = useCallback((rowId) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row._rowId !== rowId) return row;
        const validated = { ...row, error: validateRow(row) };
        // Warn (non-blocking) if qty doesn't match order_increment
        if (
          validated.variant_id &&
          validated.order_qty &&
          validated.order_increment &&
          validated.order_increment > 1
        ) {
          const qty = parseInt(validated.order_qty, 10);
          if (!isNaN(qty) && qty > 0 && qty % validated.order_increment !== 0) {
            window.alert(
              `Note: The quantity ${qty} is not a multiple of the "Order In Multiples Of" value (${validated.order_increment}) for this item. You can still proceed.`
            );
          }
        }
        return validated;
      })
    );
  }, []);

  const activeRows = rows.filter((r) => r.variant_id);

  const validateAll = useCallback(() => {
    const errors = {};
    if (!header.supplier_id) errors.supplier_id = 'Supplier is required';
    if (!header.ship_to_location_id) errors.ship_to_location_id = 'Ship-To Location is required';
    if (!header.po_date) errors.po_date = 'PO Date is required';
    setHeaderErrors(errors);

    const rowsValid = activeRows.every((r) => !r.error);
    return Object.keys(errors).length === 0 && rowsValid;
  }, [header, activeRows]);

  return {
    header,
    setHeader,
    rows,
    activeRows,
    updateRow,
    blurRow,
    fillRowFromVariant,
    clearRow,
    addRows,
    headerErrors,
    validateAll,
  };
}

export { addBusinessDays };
