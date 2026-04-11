'use client';

import { useState, useEffect } from 'react';

// ── Field definitions ──────────────────────────────────────────────────────
const COLUMNS = [
  {
    label: 'Header Fields',
    fields: [
      { key: 'csv_export.po_number',      label: 'PO Number',                   editable: false, default: true  },
      { key: 'csv_export.supplier_name',  label: 'Supplier Name',               editable: true,  default: true  },
      { key: 'csv_export.ship_to_name',   label: 'Ship To Name',                editable: false, default: true  },
      { key: 'csv_export.ship_to_address',label: 'Ship To Address',             editable: false, default: true  },
      { key: 'csv_export.po_date',        label: 'PO Date',                     editable: true,  default: true  },
      { key: 'csv_export.expected_date',  label: 'Expected Date',               editable: true,  default: true  },
      { key: 'csv_export.notes_supplier', label: 'Notes for Supplier',          editable: true,  default: true  },
    ],
  },
  {
    label: 'Line Item Fields',
    fields: [
      { key: 'csv_export.line_no',        label: 'Line No',                     editable: false, default: true  },
      { key: 'csv_export.sku',            label: 'SKU',                         editable: false, default: true  },
      { key: 'csv_export.title',          label: 'Title',                       editable: true,  default: true  },
      { key: 'csv_export.quantity',       label: 'Quantity',                    editable: false, default: true  },
      { key: 'csv_export.unit_cost',      label: 'Unit Cost',                   editable: true,  default: true  },
      { key: 'csv_export.supplier_sku',   label: 'Supplier SKU',                editable: true,  default: false },
      { key: 'csv_export.barcode',        label: 'Barcode',                     editable: true,  default: true  },
      { key: 'csv_export.extended_cost',  label: 'Extended Cost',               editable: true,  default: false },
    ],
  },
  {
    label: 'Optional Internal Fields',
    fields: [
      { key: 'csv_export.bin_location',             label: 'Bin/Shelf Location',          editable: true, default: false },
      { key: 'csv_export.product_tags',             label: 'Product Tags',                editable: true, default: false },
      { key: 'csv_export.weight_value',             label: 'Weight',                      editable: true, default: false },
      { key: 'csv_export.total_weight',             label: 'Total Weight',                editable: true, default: false },
      { key: 'csv_export.weight_unit',              label: 'Weight Units',                editable: true, default: false },
      { key: 'csv_export.retail_price',             label: 'Retail Price',                editable: true, default: false },
      { key: 'csv_export.current_stock',            label: 'Current Stock',               editable: true, default: false },
      { key: 'csv_export.total_stock_all_locations',label: 'Total Stock (All Locations)', editable: true, default: false },
    ],
  },
];

const ALL_KEYS     = COLUMNS.flatMap(c => c.fields.map(f => f.key));
const DEFAULT_STATE = Object.fromEntries(COLUMNS.flatMap(c => c.fields.map(f => [f.key, f.default])));

// ── Toggle ─────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        position:        'relative',
        display:         'inline-flex',
        alignItems:      'center',
        width:           '36px',
        height:          '20px',
        borderRadius:    '9999px',
        border:          'none',
        padding:         '2px',
        flexShrink:      0,
        cursor:          disabled ? 'not-allowed' : 'pointer',
        opacity:         disabled ? 0.5 : 1,
        backgroundColor: checked ? '#2563eb' : '#d1d5db',
        transition:      'background-color 0.2s',
        outline:         'none',
      }}
    >
      <span
        style={{
          display:         'block',
          width:           '16px',
          height:          '16px',
          borderRadius:    '9999px',
          backgroundColor: '#ffffff',
          boxShadow:       '0 1px 3px rgba(0,0,0,0.2)',
          transform:       checked ? 'translateX(16px)' : 'translateX(0)',
          transition:      'transform 0.2s',
        }}
      />
    </button>
  );
}

// ── CSV Tab ────────────────────────────────────────────────────────────────
export default function CSVTab() {
  const [values,  setValues]  = useState(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(null);
  const [toast,   setToast]   = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/settings?keys=${ALL_KEYS.join(',')}`);
        const data = await res.json();
        setValues(prev => {
          const merged = { ...prev };
          for (const key of ALL_KEYS) {
            if (key in data && data[key] !== '') {
              merged[key] = data[key] === 'true';
            }
          }
          return merged;
        });
      } catch (e) {
        console.error('Failed to load CSV settings:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function showToast(type) {
    setToast(type);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleToggle(key, newValue) {
    setValues(prev => ({ ...prev, [key]: newValue }));
    setSaving(key);
    try {
      const res = await fetch('/api/settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [key]: String(newValue) }),
      });
      if (!res.ok) throw new Error('Save failed');
      showToast('saved');
    } catch {
      setValues(prev => ({ ...prev, [key]: !newValue }));
      showToast('error');
    } finally {
      setSaving(null);
    }
  }

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
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">CSV Export Fields</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Control which fields are included in Purchase Order CSV exports. Required fields cannot be disabled.
          </p>
        </div>
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

      {/* Three-column layout */}
      <div className="grid grid-cols-3 gap-4 items-start">
        {COLUMNS.map((col) => (
          <div key={col.label}>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {col.label}
            </h4>
            <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              {col.fields.map((field, idx) => (
                <div
                  key={field.key}
                  className={`flex items-center justify-between px-3 py-2.5 ${
                    idx < col.fields.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Toggle
                      checked={values[field.key]}
                      onChange={(val) => handleToggle(field.key, val)}
                      disabled={!field.editable || saving === field.key}
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

    </div>
  );
}
