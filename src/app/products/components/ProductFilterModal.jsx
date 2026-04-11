"use client";

import { useState, useEffect } from "react";

export default function ProductFilterModal({
  isOpen,
  onClose,
  filters,
  options,
  onApply,
  onClear,
}) {
  const [local, setLocal] = useState(filters);

  useEffect(() => {
    if (isOpen) setLocal(filters);
  }, [isOpen, filters]);

  if (!isOpen) return null;

  function toggle(listName, value) {
    setLocal((prev) => {
      const list = prev[listName];
      return {
        ...prev,
        [listName]: list.includes(value)
          ? list.filter((v) => v !== value)
          : [...list, value],
      };
    });
  }

  function handleApply() {
    onApply(local);
  }

  function handleClear() {
    const cleared = { vendors: [], categories: [], collections: [], tags: [], status: [] };
    setLocal(cleared);
    onClear();
  }

  const pillClass = (active) =>
    `px-3 py-1 rounded border text-sm transition ${
      active
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200"
    }`;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] max-w-4xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Filter Products</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">

          {options.vendors?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Vendors</p>
              <div className="flex flex-wrap gap-2">
                {options.vendors.map((v) => (
                  <button key={v} onClick={() => toggle("vendors", v)}
                    className={pillClass(local.vendors.includes(v))}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {options.categories?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Categories</p>
              <div className="flex flex-wrap gap-2">
                {options.categories.map((c) => (
                  <button key={c} onClick={() => toggle("categories", c)}
                    className={pillClass(local.categories.includes(c))}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {options.collections?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Collections</p>
              <div className="flex flex-wrap gap-2">
                {options.collections.map((c) => (
                  <button key={c} onClick={() => toggle("collections", c)}
                    className={pillClass(local.collections.includes(c))}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {options.tags?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {options.tags.map((t) => (
                  <button key={t} onClick={() => toggle("tags", t)}
                    className={pillClass(local.tags.includes(t))}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {["active", "draft", "archived"].map((s) => (
                <button key={s} onClick={() => toggle("status", s)}
                  className={pillClass(local.status.includes(s))}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

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
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
