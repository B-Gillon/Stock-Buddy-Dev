"use client";

import { useState, useMemo } from "react";

import Image from "next/image";
import AppLayout from "@/shared/components/layout/AppLayout";
import Button from "@/shared/components/ui/Button";

export default function ClientSupplierSetupPage({
  supplier,
  products,
  vendors,
  categories,
  associatedProductIds = [],
}) {
  

  const [selectedVendor, setSelectedVendor]     = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch]                     = useState("");
  const [selected, setSelected] = useState(() => new Set(associatedProductIds));
  const [submitting, setSubmitting]             = useState(false);
  const [error, setError]                       = useState(null);

  // ── filtered products ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...products];
    if (selectedVendor)   result = result.filter((p) => p.vendor === selectedVendor);
    if (selectedCategory) result = result.filter((p) => p.category === selectedCategory);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter((p) =>
        p.title?.toLowerCase().includes(term) ||
        p.display_title?.toLowerCase().includes(term)
      );
    }
    return result;
  }, [products, selectedVendor, selectedCategory, search]);

  // ── selection ──────────────────────────────────────────────────────────
  const allOnPageSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggleAll() {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── submit ─────────────────────────────────────────────────────────────
  async function handleAssociate() {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}/associate-products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: [...selected] }),
      });
      if (!res.ok) throw new Error("Failed to associate products");
      window.location.replace(`/suppliers/${supplier.supplier_number}`);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  function handleSkip() {
    window.location.replace(`/suppliers/${supplier.supplier_number}`);
  }

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <AppLayout title="Set Up Supplier">

      {/* Page heading */}
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-800">Associate Products</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select the products <span className="font-medium text-gray-700">{supplier.supplier_name}</span> provides.
          You can filter by vendor or category.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        {/* Vendor */}
        <select
          value={selectedVendor}
          onChange={(e) => {
            setSelectedVendor(e.target.value);
            setSelectedCategory("");
          }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Vendors</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.name}>{v.name}</option>
          ))}
        </select>

        {/* Category */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          disabled={!selectedVendor}
          className={`border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            !selectedVendor ? "opacity-40 cursor-not-allowed" : ""
          }`}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </div>

        {/* Selected count badge */}
        {selected.size > 0 && (
          <span className="text-sm text-indigo-700 font-medium bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-md">
            {selected.size} selected
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Product table */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-200 border-b border-gray-300">
            <th className="px-2 py-2 w-8">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={toggleAll}
                className="rounded"
              />
            </th>
            <th className="px-2 py-2 w-12"></th>
            <th className="text-left px-2 py-2 font-medium">Product Title</th>
            <th className="text-left px-2 py-2 font-medium">SKUs</th>
            <th className="text-left px-2 py-2 font-medium">Vendor</th>
            <th className="text-left px-2 py-2 font-medium">Category</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-2 py-8 text-center text-gray-400">
                No products match the current filters.
              </td>
            </tr>
          ) : (
            filtered.map((product) => (
              <tr
                key={product.id}
                onClick={() => toggleOne(product.id)}
                className={`border-b border-gray-200 cursor-pointer transition-colors ${
                  selected.has(product.id) ? "bg-indigo-50" : "hover:bg-gray-50"
                }`}
              >
                <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(product.id)}
                    onChange={() => toggleOne(product.id)}
                    className="rounded"
                  />
                </td>
                <td className="px-2 py-2">
                  <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                    {product.image_src ? (
                      <Image
                        src={product.image_src}
                        alt={product.title}
                        width={40}
                        height={40}
                        className="object-cover"
                      />
                    ) : (
                      <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 font-medium text-gray-900">
                  {product.display_title || product.title}
                </td>
                <td className="px-2 py-2 text-gray-600">
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
                    {product.sku_count} SKU{product.sku_count !== 1 ? "s" : ""}
                  </span>
                </td>
                <td className="px-2 py-2 text-gray-600">{product.vendor || "—"}</td>
                <td className="px-2 py-2 text-gray-600">{product.category || "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Action bar */}
      <div className="flex items-center justify-between pt-4 pb-2 mt-2 border-t border-gray-200">
        <Button variant="secondary" onClick={handleSkip}>Skip for Now</Button>
        <Button onClick={handleAssociate} disabled={selected.size === 0 || submitting}>
          {submitting ? "Associating..." : `Associate Selected Products${selected.size > 0 ? ` (${selected.size})` : ""}`}
        </Button>
      </div>

    </AppLayout>
  );
}
