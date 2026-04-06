"use client";

import { useEffect, useRef } from "react";

export default function SearchModal({
  isOpen,
  title = "Search",
  searchTerm,
  setSearchTerm,
  onSearch,
  onClear,
  onClose,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-5 w-80">

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSearch(); }}
          placeholder="Search..."
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Buttons — all on one line */}
        <div className="flex gap-2">
          <button
            onClick={onSearch}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-1.5 rounded"
          >
            Search
          </button>
          <button
            onClick={onClear}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm py-1.5 rounded"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm py-1.5 rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}