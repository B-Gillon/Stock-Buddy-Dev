"use client";

// /src/shared/components/SortIcon.jsx
// Shared sort indicator used across all table pages.
// Renders nothing when direction is null (column is not the active sort).
// Renders ▲ for asc, ▼ for desc — matching the style in ClientProductsPage.

export default function SortIcon({ direction }) {
  if (!direction) return null;
  return (
    <span className="ml-1.5 text-black text-base leading-none">
      {direction === "asc" ? "▲" : "▼"}
    </span>
  );
}
