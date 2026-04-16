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

function n(val) {
  return typeof val === 'number' ? val.toLocaleString() : '—';
}

// ── Add Tester Modal ──────────────────────────────────────────────────────────

function AddTesterModal({ adminKey, onClose, onAdded }) {
  const [form, setForm]     = useState({ contact_name: '', contact_email: '', contact_phone: '', shopify_domain: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    if (!form.contact_name.trim()) { setError('Contact name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const normalized = {
        ...form,
        shopify_domain: form.shopify_domain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, ''),
      };
      const res = await fetch(`/api/admin/beta-testers?key=${adminKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalized),
      });
      if (!res.ok) throw new Error('Failed to add tester');
      onAdded(await res.json());
      onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Add Beta Tester</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {[
            { name: 'contact_name', label: 'Contact Name', required: true, placeholder: 'Jane Smith' },
            { name: 'contact_email', label: 'Contact Email', placeholder: 'jane@company.com' },
            { name: 'contact_phone', label: 'Contact Phone', placeholder: '704-555-1234' },
            { name: 'shopify_domain', label: 'Expected Shopify Domain', placeholder: 'their-store.myshopify.com' },
          ].map(({ name, label, required, placeholder }) => (
            <div key={name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
              <input name={name} value={form[name]} onChange={handleChange} placeholder={placeholder} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Any notes about this tester..." />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">{saving ? 'Adding…' : 'Add Tester'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Combined Stats Table ──────────────────────────────────────────────────────

const STAT_COLS = [
  { key: 'productCount',         label: 'Products' },
  { key: 'variantCount',         label: 'Variants' },
  { key: 'vendorCount',          label: 'Vendors' },
  { key: 'supplierCount',        label: 'Suppliers' },
  { key: 'supplierVariantCount', label: 'Supplier-Product Data' },
  { key: 'locationVariantCount', label: 'Location-Product Data' },
  { key: 'poTotal',              label: 'Total POs' },
];

function CombinedStatsTable({ testers, tenantStats, globalTotals }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tester</th>
            {STAT_COLS.map(col => (
              <th key={col.key} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{col.label}</th>
            ))}
            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Errors</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {testers.map((t) => {
            const stats = t.tenant_id ? tenantStats[t.tenant_id] : null;
            const hasErrors = (stats?.errorCount ?? 0) > 0;
            return (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-1.5">
                  <span className="text-xs font-medium text-gray-800">{t.contact_name}</span>
                  {!stats && <span className="ml-2 text-xs text-gray-400 italic">not connected</span>}
                </td>
                {STAT_COLS.map(col => (
                  <td key={col.key} className="px-4 py-1.5 text-xs text-gray-700">
                    {stats ? n(stats[col.key]) : '—'}
                  </td>
                ))}
                <td className="px-4 py-1.5">
                  {stats
                    ? hasErrors
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{stats.errorCount}</span>
                      : <span className="text-xs text-green-600">✓</span>
                    : <span className="text-xs text-gray-400">—</span>
                  }
                </td>
              </tr>
            );
          })}

          {/* Totals row */}
          <tr className="bg-gray-50 border-t-2 border-gray-300">
            <td className="px-4 py-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wide">Totals</td>
            {STAT_COLS.map(col => (
              <td key={col.key} className="px-4 py-1.5 text-xs font-semibold text-gray-900">
                {n(globalTotals[col.key])}
              </td>
            ))}
            <td className="px-4 py-1.5 text-xs text-gray-400">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminActivityClient({
  adminKey, betaTesters, lastSessionMap, tenantStats, globalTotals,
  errors: initialErrors, errorCount: initialErrorCount,
  tenantNameMap,
}) {
  const [testers, setTesters]                 = useState(betaTesters);
  const [showAddModal, setShowAddModal]        = useState(false);
  const [expandedError, setExpandedError]     = useState(null);
  const [errors, setErrors]                   = useState(initialErrors);
  const [errorCount, setErrorCount]           = useState(initialErrorCount);
  const [deletingId, setDeletingId]           = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  async function handleDeleteError(id) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/errors/${id}?key=${adminKey}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setErrors(prev => prev.filter(e => e.id !== id));
      setErrorCount(prev => Math.max(0, prev - 1));
      if (expandedError === id) setExpandedError(null);
    } catch (err) {
      console.error('Failed to delete error:', err);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
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

        {errorCount > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-5 py-4 flex items-center gap-3">
            <svg className="h-5 w-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            <p className="text-sm text-red-700 font-medium">{errorCount} error{errorCount !== 1 ? 's' : ''} recorded — see Error Log below</p>
          </div>
        )}

        {/* Beta Tester Registry */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">Beta Tester Registry</h2>
          <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">+ Add Tester</button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-8">
          {testers.length === 0 ? (
            <div className="px-6 py-8 text-center"><p className="text-sm text-gray-400 italic">No beta testers added yet. Click "Add Tester" to invite someone.</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Contact', 'Shopify Domain', 'Invited', 'Installed', 'Connected', 'Last Accessed', 'Active'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
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

        {/* Combined Stats Table */}
        {testers.length > 0 && (
          <>
            <SectionHeader>Tester Activity</SectionHeader>
            <CombinedStatsTable
              testers={testers}
              tenantStats={tenantStats}
              globalTotals={globalTotals}
            />
          </>
        )}

        {/* Error Log */}
        <SectionHeader>
          Error Log{errorCount > 0 && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{errorCount}</span>}
        </SectionHeader>
        {errors.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg px-5 py-4">
            <p className="text-sm text-green-700 font-medium">No errors recorded</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Account', 'When', 'Source', 'Message', 'Context', ''].map((h, i) => (
                    <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {errors.map((e) => (
                  <tr key={e.id} className="hover:bg-red-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {e.tenant_id && tenantNameMap?.[e.tenant_id]
                        ? <span className="text-xs font-medium text-gray-700">{tenantNameMap[e.tenant_id]}</span>
                        : <span className="text-xs text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{formatDate(e.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{e.source}</span>
                    </td>
                    <td className="px-4 py-3 text-red-700 cursor-pointer" onClick={() => setExpandedError(expandedError === e.id ? null : e.id)}>
                      <div>{e.message}</div>
                      {expandedError === e.id && e.context && (
                        <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded p-2 text-gray-600 whitespace-pre-wrap">{JSON.stringify(e.context, null, 2)}</pre>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs cursor-pointer" onClick={() => setExpandedError(expandedError === e.id ? null : e.id)}>
                      {e.context ? (expandedError === e.id ? 'Collapse' : 'Click to expand') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {confirmDeleteId === e.id ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleDeleteError(e.id)} disabled={deletingId === e.id} className="text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 px-2 py-1 rounded">
                            {deletingId === e.id ? '…' : 'Confirm'}
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(e.id)} className="text-xs text-gray-400 hover:text-red-600 transition-colors" title="Delete this error">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1m-4 0H5" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {showAddModal && <AddTesterModal adminKey={adminKey} onClose={() => setShowAddModal(false)} onAdded={(t) => setTesters(prev => [t, ...prev])} />}
    </div>
  );
}
