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

function StatusPill({ value, trueLabel = 'Yes', falseLabel = 'No' }) {
  return value
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{trueLabel}</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{falseLabel}</span>;
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

// ── Add Tester Modal ──────────────────────────────────────────────────────────

function AddTesterModal({ adminKey, onClose, onAdded }) {
  const [form, setForm]     = useState({ contact_name: '', contact_email: '', contact_phone: '', shopify_domain: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    if (!form.contact_name.trim()) {
      setError('Contact name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/beta-testers?key=${adminKey}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to add tester');
      const newTester = await res.json();
      onAdded(newTester);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Add Beta Tester</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name <span className="text-red-500">*</span></label>
            <input name="contact_name" value={form.contact_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Jane Smith" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
            <input name="contact_email" value={form.contact_email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="jane@company.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
            <input name="contact_phone" value={form.contact_phone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="704-555-1234" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Shopify Domain</label>
            <input name="shopify_domain" value={form.shopify_domain} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="their-store.myshopify.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Any notes about this tester..." />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Adding…' : 'Add Tester'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Per-Tester Activity Card ──────────────────────────────────────────────────

function TesterActivityCard({ tester, stats, lastAccessed }) {
  const rows = [
    { label: 'Products',              total: stats?.productCount ?? '—',          date: stats?.productLastSync ?? null },
    { label: 'Variants',              total: stats?.variantCount ?? '—',           date: null },
    { label: 'Vendors',               total: stats?.vendorCount ?? '—',            date: null },
    { label: 'Inventory',             total: '—',                                   date: stats?.inventoryLastSync ?? null },
    { label: 'Suppliers',             total: stats?.supplierCount ?? '—',          date: null },
    { label: 'Supplier Product Data', total: stats?.supplierVariantCount ?? '—',   date: null },
    { label: 'POs – Created',         total: stats?.poCreated ?? '—',              date: null },
    { label: 'POs – Released',        total: stats?.poReleased ?? '—',             date: null },
    { label: 'POs – Received',        total: stats?.poReceived ?? '—',             date: null },
  ];

  const hasErrors = (stats?.errorCount ?? 0) > 0;

  return (
    <div className={`bg-white rounded-lg border shadow-sm overflow-hidden ${hasErrors ? 'border-red-300' : 'border-gray-200'}`}>
      {/* Card header — name + view as tester button */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-gray-900">{tester.contact_name}</p>
          {hasErrors && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              {stats.errorCount} error{stats.errorCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          disabled
          className="px-3 py-1.5 text-xs font-medium text-gray-400 border border-gray-200 rounded-md cursor-not-allowed opacity-50"
          title="Available after OAuth is built"
        >
          View as Tester (available after OAuth)
        </button>
      </div>

      {/* Stats table or not-connected state */}
      {stats ? (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Function</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total #</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Most Recent Date</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Errors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="px-4 py-2 text-gray-700">{row.label}</td>
                <td className="px-4 py-2 text-gray-900 font-medium">{typeof row.total === 'number' ? row.total.toLocaleString() : row.total}</td>
                <td className="px-4 py-2 text-gray-500">{row.date ? formatDate(row.date) : '—'}</td>
                <td className="px-4 py-2">
                  {row.label.startsWith('POs') || row.label === 'Products' || row.label === 'Inventory'
                    ? (hasErrors ? <span className="text-red-600 text-xs font-medium">See error log</span> : <span className="text-green-600 text-xs">✓</span>)
                    : '—'
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="px-5 py-6 text-center">
          <p className="text-sm text-gray-400 italic">Not yet connected to Shopify</p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminActivityClient({
  adminKey,
  betaTesters, lastSessionMap, tenantStats,
  productCount, variantCount, productLastSync, variantLastSync,
  vendorCount, vendorLastSync,
  inventoryLastSync,
  supplierCount, supplierLastCreated,
  supplierVariantCount, supplierVariantLastCreated,
  poTotal, poDraft, poReleased, poPartiallyReceived, poReceived, poCancelled, poLastCreated,
  poActivity,
  errors, errorCount,
}) {
  const [testers, setTesters]           = useState(betaTesters);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedError, setExpandedError] = useState(null);

  function handleTesterAdded(newTester) {
    setTesters(t => [newTester, ...t]);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Stock Buddy — Admin</h1>
            <p className="text-gray-400 text-sm mt-0.5">Activity & System Health</p>
          </div>
          <span className="text-xs text-gray-400">Loaded: {formatDate(new Date().toISOString())}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">

        {/* Error banner */}
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

        {/* ── Beta Tester Registry ── */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">Beta Tester Registry</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            + Add Tester
          </button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-8">
          {testers.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-gray-400 italic">No beta testers added yet. Click "Add Tester" to invite someone.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Shopify Domain</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invited</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Installed</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Connected</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Accessed</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {testers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{t.contact_name}</p>
                      {t.contact_email && <p className="text-xs text-gray-500">{t.contact_email}</p>}
                      {t.contact_phone && <p className="text-xs text-gray-500">{t.contact_phone}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{t.shopify_domain ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(t.invited_at)}</td>
                    <td className="px-4 py-3"><StatusPill value={!!t.installed_at} /></td>
                    <td className="px-4 py-3"><StatusPill value={!!t.connected_at} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {t.tenant_id ? formatDate(lastSessionMap[t.tenant_id]) : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusPill value={t.is_active} trueLabel="Active" falseLabel="Inactive" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Per-Tester Activity Cards ── */}
        {testers.length > 0 && (
          <>
            <SectionHeader>Tester Activity</SectionHeader>
            <div className="space-y-4">
              {testers.map((t) => (
                <TesterActivityCard
                  key={t.id}
                  tester={t}
                  stats={t.tenant_id ? tenantStats[t.tenant_id] : null}
                  lastAccessed={t.tenant_id ? lastSessionMap[t.tenant_id] : null}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Global Stats — two side-by-side cards ── */}
        <SectionHeader>Global Stats</SectionHeader>
        <div className="grid grid-cols-2 gap-4">

          {/* Left — Sync Stats */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Shopify Sync</h3>
            {[
              { label: 'Products',        value: productCount.toLocaleString() },
              { label: 'Products – Last Sync',  value: formatDate(productLastSync) },
              { label: 'Variants',        value: variantCount.toLocaleString() },
              { label: 'Variants – Last Sync',  value: formatDate(variantLastSync) },
              { label: 'Vendors',         value: vendorCount.toLocaleString() },
              { label: 'Vendors – Last Sync',   value: formatDate(vendorLastSync) },
              { label: 'Inventory – Last Sync', value: formatDate(inventoryLastSync) },
              { label: 'Suppliers',       value: supplierCount.toLocaleString() },
              { label: 'Most Recent Supplier',  value: formatDate(supplierLastCreated) },
              { label: 'Supplier Product Data', value: supplierVariantCount.toLocaleString() },
              { label: 'Most Recent SVD',       value: formatDate(supplierVariantLastCreated) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-sm font-medium text-gray-900">{value}</span>
              </div>
            ))}
          </div>

          {/* Right — PO Stats */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Purchase Orders</h3>
            {[
              { label: 'Total POs',           value: poTotal.toLocaleString() },
              { label: 'Most Recent PO',       value: formatDate(poLastCreated) },
              { label: 'Draft',                value: poDraft.toLocaleString() },
              { label: 'Released',             value: poReleased.toLocaleString() },
              { label: 'Partially Received',   value: poPartiallyReceived.toLocaleString() },
              { label: 'Received',             value: poReceived.toLocaleString() },
              { label: 'Cancelled',            value: poCancelled.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-sm font-medium text-gray-900">{value}</span>
              </div>
            ))}
          </div>
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
                  <tr key={e.id} className="hover:bg-red-50 cursor-pointer" onClick={() => setExpandedError(expandedError === e.id ? null : e.id)}>
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
                    <td className="px-4 py-3 text-gray-400 text-xs">{e.context ? 'Click to expand' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Add Tester Modal */}
      {showAddModal && (
        <AddTesterModal
          adminKey={adminKey}
          onClose={() => setShowAddModal(false)}
          onAdded={handleTesterAdded}
        />
      )}
    </div>
  );
}
