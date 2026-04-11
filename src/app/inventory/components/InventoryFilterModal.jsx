"use client";

// /src/app/inventory/components/InventoryFilterModal.jsx

import { useState, useEffect } from "react";

const AVAILABILITY_OPTIONS = [
  { value: "in_stock",     label: "In Stock (> 0)"  },
  { value: "out_of_stock", label: "Out of Stock (0)" },
  { value: "low_stock",    label: "Low Stock (1–4)"  },
];

const INCOMING_OPTIONS = [
  { value: "has_incoming", label: "Has Incoming" },
  { value: "no_incoming",  label: "No Incoming"  },
];

const TOTAL_VALUE_OPTIONS = [
  { value: "has_value", label: "Has Cost Data"    },
  { value: "no_value",  label: "No Cost Data (—)" },
];

const INVENTORY_POLICY_OPTIONS = [
  { value: "deny",     label: "Deny (stop selling when out)" },
  { value: "continue", label: "Continue (sell when out)"     },
];

export default function InventoryFilterModal({
  isOpen,
  onClose,
  filters,
  setFilters,
  options,
  onApply,
  onClear,
}) {
  const [local, setLocal] = useState(filters);

  useEffect(() => {
    if (isOpen) setLocal(filters);
  }, [isOpen, filters]);

  if (!isOpen) return null;

  function update(key, value) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function handleApply() {
    onApply(local);
  }

  function handleClear() {
    const cleared = {
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
    setLocal(cleared);
    onClear();
  }

  const pillClass = (active) =>
    `px-3 py-1 rounded border text-sm transition ${
      active
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200"
    }`;

  function MultiSelect({ label, selected, onChange, opts }) {
    function toggle(value) {
      onChange(
        selected.includes(value)
          ? selected.filter((v) => v !== value)
          : [...selected, value]
      );
    }
    return (
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
        <div className="flex flex-wrap gap-2">
          {opts.map((opt) => (
            <button
              key={opt.value ?? opt}
              onClick={() => toggle(opt.value ?? opt)}
              className={pillClass(selected.includes(opt.value ?? opt))}
            >
              {opt.label ?? opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function SingleSelect({ label, opts, selected, onChange }) {
    return (
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
        <div className="flex flex-wrap gap-2">
          {opts.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange(selected === opt.value ? null : opt.value)}
              className={pillClass(selected === opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] max-w-4xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Filter Inventory</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">

          {options.vendors?.length > 0 && (
            <MultiSelect
              label="Vendor"
              opts={options.vendors}
              selected={local.vendors}
              onChange={(v) => update("vendors", v)}
            />
          )}

          {options.categories?.length > 0 && (
            <MultiSelect
              label="Category"
              opts={options.categories}
              selected={local.categories}
              onChange={(v) => update("categories", v)}
            />
          )}

          {options.collections?.length > 0 && (
            <MultiSelect
              label="Collection"
              opts={options.collections}
              selected={local.collections}
              onChange={(v) => update("collections", v)}
            />
          )}

          {options.tags?.length > 0 && (
            <MultiSelect
              label="Tags"
              opts={options.tags}
              selected={local.tags}
              onChange={(v) => update("tags", v)}
            />
          )}

          {options.locations?.length > 0 && (
            <MultiSelect
              label="Location"
              opts={options.locations}
              selected={local.locations}
              onChange={(v) => update("locations", v)}
            />
          )}

          <MultiSelect
            label="Status"
            opts={[
              { value: "active",   label: "Active"   },
              { value: "draft",    label: "Draft"    },
              { value: "archived", label: "Archived" },
            ]}
            selected={local.status}
            onChange={(v) => update("status", v)}
          />

          <SingleSelect
            label="Availability"
            opts={AVAILABILITY_OPTIONS}
            selected={local.availability}
            onChange={(v) => update("availability", v)}
          />

          <SingleSelect
            label="Incoming"
            opts={INCOMING_OPTIONS}
            selected={local.incoming}
            onChange={(v) => update("incoming", v)}
          />

          <SingleSelect
            label="Total Value"
            opts={TOTAL_VALUE_OPTIONS}
            selected={local.total_value}
            onChange={(v) => update("total_value", v)}
          />

          <SingleSelect
            label="Inventory Policy"
            opts={INVENTORY_POLICY_OPTIONS}
            selected={local.inventory_policy}
            onChange={(v) => update("inventory_policy", v)}
          />

        </div>

        {/* Footer */}
        <div className="flex justify-end items-center px-6 py-4 border-t border-gray-200 gap-2">
          <button onClick={handleClear}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700">
            Clear All
          </button>
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleApply}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
