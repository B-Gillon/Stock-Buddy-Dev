'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function POFiltersRow({ suppliers, currentFilters }) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [search,     setSearch]     = useState(currentFilters.search ?? '');
  const [supplierId, setSupplierId] = useState(currentFilters.supplier_id ?? '');
  const [dateFrom,   setDateFrom]   = useState(currentFilters.date_from ?? '');
  const [dateTo,     setDateTo]     = useState(currentFilters.date_to ?? '');

  function applyFilters(overrides = {}) {
    const params = new URLSearchParams(searchParams.toString());
    const values = { search, supplier_id: supplierId, date_from: dateFrom, date_to: dateTo, ...overrides };

    Object.entries(values).forEach(([key, val]) => {
      if (val) { params.set(key, val); } else { params.delete(key); }
    });
    params.delete('page');
    router.push(`/purchase-orders?${params.toString()}`);
  }

  function clearFilters() {
    setSearch('');
    setSupplierId('');
    setDateFrom('');
    setDateTo('');
    const params = new URLSearchParams(searchParams.toString());
    ['search', 'supplier_id', 'date_from', 'date_to', 'page'].forEach((k) => params.delete(k));
    router.push(`/purchase-orders?${params.toString()}`);
  }

  const hasFilters = search || supplierId || dateFrom || dateTo;

  return (
    <div className="flex items-center gap-3 flex-wrap">

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters({ search: e.target.value })}
          placeholder=""
          className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
        />
      </div>

      {/* Supplier */}
      <select
        value={supplierId}
        onChange={(e) => { setSupplierId(e.target.value); applyFilters({ supplier_id: e.target.value }); }}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">All Suppliers</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>{s.supplier_name}</option>
        ))}
      </select>

      {/* Date From */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 whitespace-nowrap">From</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); applyFilters({ date_from: e.target.value }); }}
          className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Date To */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 whitespace-nowrap">To</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); applyFilters({ date_to: e.target.value }); }}
          className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Clear */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="text-xs text-gray-400 hover:text-gray-700 underline transition-colors"
        >
          Clear filters
        </button>
      )}

    </div>
  );
}
