'use client';
// /src/app/admin/activity/components/AdminActivityClient.jsx

import { useState } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function StatCard({ title, children }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <h2 className="text-base font-semibold text-gray-800 mt-8 mb-3 pb-2 border-b border-gray-200">
      {children}
    </h2>
  );
}

const ACTION_COLORS = {
  created:   'bg-blue-100 text-blue-700',
  released:  'bg-green-100 text-green-700',
  resent:    'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700',
  edited:    'bg-yellow-100 text-yellow-700',
  received:  'bg-teal-100 text-teal-700',
  error:     'bg-red-100 text-red-700',
  closed:    'bg-gray-100 text-gray-600',
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminActivityClient({
  productCount, variantCount, productLastSync, variantLastSync,
  vendorCount, vendorLastSync,
  inventoryLastSync,
  supplierCount, supplierLastCreated,
  supplierVariantCount, supplierVariantLastCreated,
  poTotal, poDraft, poReleased, poPartiallyReceived, poReceived, poCancelled, poLastCreated,
  poActivity,
  errors, errorCount,
}) {
  const [expandedError, setExpandedError] = useState(null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Stock Buddy — Admin</h1>
            <p className="text-gray-400 text-sm mt-0.5">Activity & System Health</p>
          </div>
          <span className="text-xs text-gray-400">Last loaded: {formatDate(new Date().toISOString())}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">

        {/* Error banner if errors exist */}
        {errorCount > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-5 py-4 flex items-center gap-3">
            <svg className="h-5 w-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-sm text-red-700 font-medium">
              {errorCount} error{errorCount !== 1 ? 's' : ''} recorded — see Error Log below
            </p>
          </div>
        )}

        {/* ── Sync Stats ── */}
        <SectionHeader>Shopify Sync</SectionHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Products">
            <StatRow label="Total" value={productCount.toLocaleString()} />
            <StatRow label="Last Sync" value={formatDate(productLastSync)} />
          </StatCard>
          <StatCard title="Variants">
            <StatRow label="Total" value={variantCount.toLocaleString()} />
            <StatRow label="Last Sync" value={formatDate(variantLastSync)} />
          </StatCard>
          <StatCard title="Vendors">
            <StatRow label="Total" value={vendorCount.toLocaleString()} />
            <StatRow label="Last Sync" value={formatDate(vendorLastSync)} />
          </StatCard>
          <StatCard title="Inventory">
            <StatRow label="Last Full Sync" value={formatDate(inventoryLastSync)} />
          </StatCard>
        </div>

        {/* ── Supplier Stats ── */}
        <SectionHeader>Suppliers</SectionHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard title="Suppliers">
            <StatRow label="Total Created" value={supplierCount.toLocaleString()} />
            <StatRow label="Most Recent" value={formatDate(supplierLastCreated)} />
          </StatCard>
          <StatCard title="Supplier Product Data">
            <StatRow label="Total Records" value={supplierVariantCount.toLocaleString()} />
            <StatRow label="Most Recent" value={formatDate(supplierVariantLastCreated)} />
          </StatCard>
        </div>

        {/* ── PO Stats ── */}
        <SectionHeader>Purchase Orders</SectionHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard title="All POs">
            <StatRow label="Total" value={poTotal.toLocaleString()} />
            <StatRow label="Most Recent" value={formatDate(poLastCreated)} />
          </StatCard>
          <StatCard title="By Status">
            <StatRow label="Draft" value={poDraft.toLocaleString()} />
            <StatRow label="Released" value={poReleased.toLocaleString()} />
            <StatRow label="Partially Received" value={poPartiallyReceived.toLocaleString()} />
            <StatRow label="Received" value={poReceived.toLocaleString()} />
            <StatRow label="Cancelled" value={poCancelled.toLocaleString()} />
          </StatCard>
        </div>

        {/* ── PO Activity Feed ── */}
        <SectionHeader>Recent PO Activity</SectionHeader>
        {poActivity.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No activity recorded yet.</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">PO Number</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Comments</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {poActivity.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.po_number}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[a.action] ?? 'bg-gray-100 text-gray-600'}`}>
                        {a.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{a.comments ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Error Log ── */}
        <SectionHeader>
          Error Log{errorCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              {errorCount}
            </span>
          )}
        </SectionHeader>
        {errors.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg px-5 py-4">
            <p className="text-sm text-green-700 font-medium">✓ No errors recorded</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">When</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Message</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {errors.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-red-50 cursor-pointer"
                    onClick={() => setExpandedError(expandedError === e.id ? null : e.id)}
                  >
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(e.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{e.source}</span>
                    </td>
                    <td className="px-4 py-3 text-red-700">
                      <div>{e.message}</div>
                      {expandedError === e.id && e.context && (
                        <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded p-2 text-gray-600 whitespace-pre-wrap">
                          {JSON.stringify(e.context, null, 2)}
                        </pre>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {e.context ? 'Click to expand' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
