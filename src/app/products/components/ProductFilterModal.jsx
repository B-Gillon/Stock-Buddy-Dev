"use client";

export default function ProductFilterModal({
  isOpen,
  onClose,
  filters,
  setFilters,
  options,
  onApply,
  onClear,
}) {
  if (!isOpen) return null;

  function toggle(listName, value) {
    setFilters((prev) => {
      const list = prev[listName];
      return {
        ...prev,
        [listName]: list.includes(value)
          ? list.filter((v) => v !== value)
          : [...list, value],
      };
    });
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
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body — two columns on wide, one on small */}
        <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">

          {/* Vendors */}
          {options.vendors?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Vendors</p>
              <div className="flex flex-wrap gap-2">
                {options.vendors.map((v) => (
                  <button key={v} onClick={() => toggle("vendors", v)}
                    className={pillClass(filters.vendors.includes(v))}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          {options.categories?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Categories</p>
              <div className="flex flex-wrap gap-2">
                {options.categories.map((c) => (
                  <button key={c} onClick={() => toggle("categories", c)}
                    className={pillClass(filters.categories.includes(c))}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Collections */}
          {options.collections?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Collections</p>
              <div className="flex flex-wrap gap-2">
                {options.collections.map((c) => (
                  <button key={c} onClick={() => toggle("collections", c)}
                    className={pillClass(filters.collections.includes(c))}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {options.tags?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {options.tags.map((t) => (
                  <button key={t} onClick={() => toggle("tags", t)}
                    className={pillClass(filters.tags.includes(t))}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {["Active", "Draft", "Archived"].map((s) => (
                <button key={s} onClick={() => toggle("status", s)}
                  className={pillClass(filters.status.includes(s))}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Taxable */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Taxable</p>
            <div className="flex gap-2">
              {[["yes", "Yes"], ["no", "No"], [null, "Any"]].map(([val, label]) => (
                <button key={label}
                  onClick={() => setFilters((prev) => ({ ...prev, taxable: val }))}
                  className={pillClass(filters.taxable === val)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end items-center px-6 py-4 border-t border-gray-200 gap-2">
          <button
            onClick={onClear}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
          >
            Clear All
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}