"use client";

// /src/app/purchase-orders/[slug]/components/CollapsibleCards.jsx
// Wraps the top row of PO info cards so it can be collapsed to a one-line summary.
// The open/closed choice is remembered in this browser only.

import { useState, useEffect } from "react";

const STORAGE_KEY = "po_detail_cards_collapsed";

export default function CollapsibleCards({ summary, children }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch { /* storage unavailable: stay expanded */ }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 px-1 py-1 text-xs font-medium text-gray-500">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          className="inline-flex items-center gap-2 rounded-md text-left hover:text-gray-800 transition"
        >
          <svg
            className={`h-3 w-3 shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
          <span>{collapsed ? "Show PO details" : "Hide PO details"}</span>
        </button>
        {collapsed && summary && (
          <span className="ml-2 truncate font-normal text-gray-400">{summary}</span>
        )}
      </div>

      {!collapsed && <div className="mt-2">{children}</div>}
    </div>
  );
}
