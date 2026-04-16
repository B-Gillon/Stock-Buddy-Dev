'use client';
// /src/app/admin/activity/components/AdminActivityClient.jsx

import { useState } from 'react';
import Image from 'next/image';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function n(val) {
  return typeof val === 'number' ? val.toLocaleString() : '—';
}

const gradientStyle = {
  background: 'linear-gradient(to right, #11E0FC, #0099FF)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

// ── Status pill ───────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  'Active':         'bg-green-100 text-green-700',
  'Inactive':       'bg-gray-100 text-gray-500',
  'Invited':        'bg-purple-100 text-purple-700',
  'Form Submitted': 'bg-blue-100 text-blue-700',
  'Rejected':       'bg-red-100 text-red-600',
};

function StatusPill({ status }) {
  const cls = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status ?? '—'}
    </span>
  );
}

/** Derive a display status from a beta_tester row. */
function testerStatus(t) {
  const note = t.notes ?? '';
  if (note === 'Form Submitted') return 'Form Submitted';
  if (note === 'Approved' || note === 'Rejected') return note;
  if (!t.is_active) return 'Inactive';
  if (t.invited_at && !t.installed_at) return 'Invited';
  return 'Active';
}

// ── Admin Header ──────────────────────────────────────────────────────────────

function AdminHeader({ loadedAt }) {
  return (
    <header className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg shadow">
      <div className="flex items-end justify-between gap-4 min-w-0">
        <div className="shrink-0 flex items-center gap-3 self-end pb-0.5">
          <Image src="/STOCK_BUDDY_LOGO__1_.png" alt="Stock Buddy logo" width={88} height={88} className="h-16 w-auto object-contain" />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-semibold" style={gradientStyle}>Stock Buddy</h1>
              <span className="text-xs text-gray-400">v1.0</span>
            </div>
            <p className="text-xs mt-0.5" style={gradientStyle}>Inventory Management for the Modern Age</p>
          </div>
        </div>
        <div className="flex flex-col items-end justify-end gap-1 pb-0.5">
          <span className="text-sm font-semibold text-white tracking-wide">Admin — Activity & System Health</span>
          <span className="text-xs text-gray-400">Loaded: {formatDate(loadedAt)}</span>
        </div>
      </div>
    </header>
  );
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
            { name: 'contact_name',  label: 'Contact Name',            required: true, placeholder: 'Jane Smith' },
            { name: 'contact_email', label: 'Contact Email',           placeholder: 'jane@company.com' },
            { name: 'contact_phone', label: 'Contact Phone',           placeholder: '704-555-1234' },
            { name: 'shopify_domain',label: 'Expected Shopify Domain', placeholder: 'their-store.myshopify.com' },
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

// ── Tester Detail Modal ───────────────────────────────────────────────────────

function TesterDetailModal({ tester, adminKey, onClose, onStatusChange }) {
  const [accessRequest, setAccessRequest] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [actioning, setActioning]         = useState(null); // 'approved' | 'rejected'
  const [actionError, setActionError]     = useState(null);

  const status = testerStatus(tester);

  // Fetch the matching access_request row by store domain
  useState(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/access-requests?key=${adminKey}`);
        if (!res.ok) throw new Error('Failed to load');
        const { data } = await res.json();
        const match = (data ?? []).find(r =>
          r.store_url?.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase() ===
          (tester.shopify_domain ?? '').toLowerCase()
        );
        setAccessRequest(match ?? null);
      } catch {
        setAccessRequest(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleAction(newStatus) {
    setActioning(newStatus);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/access-requests/${accessRequest.id}?key=${adminKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Action failed');
      onStatusChange(tester.id, newStatus === 'approved' ? 'Approved' : 'Rejected');
      onClose();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActioning(null);
    }
  }

  const yesNo = v => v === true ? 'Yes' : v === false ? 'No' : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 overflow-hidden flex flex-col max-h-[90vh]">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{tester.contact_name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{tester.shopify_domain ?? '—'}</p>
          </div>
          <div className="flex items-center gap-3">
            {status === 'Form Submitted' && accessRequest && (
              <>
                <button
                  onClick={() => handleAction('rejected')}
                  disabled={!!actioning}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-500 hover:bg-blue-50 disabled:opacity-50 rounded-md transition-colors"
                >
                  {actioning === 'rejected' ? 'Rejecting…' : 'Reject'}
                </button>
                <button
                  onClick={() => handleAction('approved')}
                  disabled={!!actioning}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors"
                >
                  {actioning === 'approved' ? 'Approving…' : 'Approve'}
                </button>
              </>
            )}
            <StatusPill status={status} />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-1">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto px-6 py-5 flex-1">

          {actionError && <p className="text-sm text-red-600 mb-4">{actionError}</p>}

          {loading ? (
            <p className="text-sm text-gray-400 italic">Loading form responses…</p>
          ) : (
            <div className="flex gap-0 divide-x divide-gray-200">

              {/* ── Left column ─────────────────────────────────── */}
              <div className="flex-1 pr-6 space-y-5">

                <ModalSection title="Tester Record">
                  <Row label="Email"     value={tester.contact_email ?? '—'} />
                  <Row label="Phone"     value={tester.contact_phone ?? '—'} />
                  <Row label="Invited"   value={formatDate(tester.invited_at)} />
                  <Row label="Installed" value={tester.installed_at ? formatDate(tester.installed_at) : '—'} />
                  <Row label="Connected" value={tester.connected_at ? formatDate(tester.connected_at) : '—'} />
                </ModalSection>

                {accessRequest && (
                  <>
                    <ModalSection title="Business Profile">
                      <Row label="Company Size"         value={accessRequest.company_size ?? '—'} />
                      <Row label="Monthly Order Volume" value={accessRequest.monthly_order_volume ?? '—'} />
                      <Row label="SKUs / Variants"      value={accessRequest.num_skus_variants ?? '—'} />
                      <Row label="Inventory Methods"    value={(accessRequest.current_inventory_methods ?? []).join(', ') || '—'} />
                    </ModalSection>

                    <ModalSection title="Submission">
                      <Row label="Submitted"      value={formatDate(accessRequest.created_at)} />
                      <Row label="Status"         value={accessRequest.status} />
                      {accessRequest.reviewed_at && <Row label="Reviewed" value={formatDate(accessRequest.reviewed_at)} />}
                    </ModalSection>
                  </>
                )}

                {!accessRequest && (
                  <p className="text-sm text-gray-400 italic">No form submission found for this tester.</p>
                )}

              </div>

              {/* ── Right column ─────────────────────────────────── */}
              {accessRequest && (
                <div className="flex-1 pl-6 space-y-5">

                  <ModalSection title="Current Process">
                    <LongRow label="How they create POs today"      value={accessRequest.how_create_pos_today} />
                    <LongRow label="How they send POs to suppliers"  value={accessRequest.how_send_pos_to_suppliers} />
                    <LongRow label="Biggest challenge"               value={accessRequest.biggest_challenge} />
                    <LongRow label="Why interested in Stock Buddy"   value={accessRequest.why_interested} />
                  </ModalSection>

                  <ModalSection title="Beta Participation">
                    <Row label="Willing to provide feedback" value={yesNo(accessRequest.willing_to_provide_feedback)} />
                    <Row label="Open to onboarding calls"   value={yesNo(accessRequest.open_to_onboarding_calls)} />
                    <Row label="How soon to start"          value={accessRequest.how_soon_to_start ?? '—'} />
                    {accessRequest.anything_else && (
                      <LongRow label="Anything else" value={accessRequest.anything_else} />
                    )}
                    {accessRequest.reviewer_notes && (
                      <LongRow label="Reviewer Notes" value={accessRequest.reviewer_notes} />
                    )}
                  </ModalSection>

                </div>
              )}

            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function ModalSection({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</p>
      <div className="grid grid-cols-1 gap-y-2 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 shrink-0 w-48">{label}</span>
      <span className="text-gray-900">{value ?? '—'}</span>
    </div>
  );
}

function LongRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm whitespace-pre-wrap">{value ?? '—'}</span>
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
            const stats    = t.tenant_id ? tenantStats[t.tenant_id] : null;
            const hasErrors = (stats?.errorCount ?? 0) > 0;
            return (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-1.5">
                  <span className="text-xs font-medium text-gray-800">{t.contact_name}</span>
                  {!stats && <span className="ml-2 text-xs text-gray-400 italic">not connected</span>}
                </td>
                {STAT_COLS.map(col => (
                  <td key={col.key} className="px-4 py-1.5 text-xs text-gray-700">{stats ? n(stats[col.key]) : '—'}</td>
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
          <tr className="bg-gray-50 border-t-2 border-gray-300">
            <td className="px-4 py-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wide">Totals</td>
            {STAT_COLS.map(col => (
              <td key={col.key} className="px-4 py-1.5 text-xs font-semibold text-gray-900">{n(globalTotals[col.key])}</td>
            ))}
            <td className="px-4 py-1.5 text-xs text-gray-400">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────

const ALL_TABS = ['All', 'Active', 'Inactive', 'Invited', 'Form Submitted', 'Rejected'];

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminActivityClient({
  adminKey, betaTesters, lastSessionMap, tenantStats, globalTotals,
  errors: initialErrors, errorCount: initialErrorCount, tenantNameMap,
}) {
  const [testers, setTesters]                 = useState(betaTesters);
  const [activeTab, setActiveTab]             = useState('All');
  const [selectedTester, setSelectedTester]   = useState(null);
  const [showAddModal, setShowAddModal]        = useState(false);
  const [expandedError, setExpandedError]     = useState(null);
  const [errors, setErrors]                   = useState(initialErrors);
  const [errorCount, setErrorCount]           = useState(initialErrorCount);
  const [deletingId, setDeletingId]           = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [selectedIds, setSelectedIds]         = useState(new Set());
  const [bulkDeleting, setBulkDeleting]       = useState(false);
  const [loadedAt]                            = useState(() => new Date().toISOString());

  // ── Filter testers by tab ─────────────────────────────────────────────────
  const filteredTesters = activeTab === 'All'
    ? testers
    : testers.filter(t => testerStatus(t) === activeTab);

  // ── Tab counts ────────────────────────────────────────────────────────────
  function tabCount(tab) {
    if (tab === 'All') return testers.length;
    return testers.filter(t => testerStatus(t) === tab).length;
  }

  // ── Status change callback from detail modal ──────────────────────────────
  function handleStatusChange(testerId, newNote) {
    setTesters(prev => prev.map(t =>
      t.id === testerId ? { ...t, notes: newNote, is_active: newNote === 'Approved' } : t
    ));
  }

  // ── Single error delete ───────────────────────────────────────────────────
  async function handleDeleteError(id) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/errors/${id}?key=${adminKey}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setErrors(prev => prev.filter(e => e.id !== id));
      setErrorCount(prev => Math.max(0, prev - 1));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      if (expandedError === id) setExpandedError(null);
    } catch (err) {
      console.error('Failed to delete error:', err);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  // ── Bulk delete ───────────────────────────────────────────────────────────
  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map(id => fetch(`/api/admin/errors/${id}?key=${adminKey}`, { method: 'DELETE' }))
    );
    const deleted = ids.filter((_, i) => results[i].status === 'fulfilled' && results[i].value.ok);
    setErrors(prev => prev.filter(e => !deleted.includes(e.id)));
    setErrorCount(prev => Math.max(0, prev - deleted.length));
    setSelectedIds(new Set());
    if (deleted.includes(expandedError)) setExpandedError(null);
    setBulkDeleting(false);
  }

  function toggleOne(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === errors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(errors.map(e => e.id)));
    }
  }

  const allSelected  = errors.length > 0 && selectedIds.size === errors.length;
  const someSelected = selectedIds.size > 0;

  return (
    <div className="min-h-screen bg-gray-50">

      <div className="px-4 pt-4 pb-0 max-w-6xl mx-auto">
        <AdminHeader loadedAt={loadedAt} />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">

        {errorCount > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-5 py-4 flex items-center gap-3">
            <svg className="h-5 w-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            <p className="text-sm text-red-700 font-medium">{errorCount} error{errorCount !== 1 ? 's' : ''} recorded — see Error Log below</p>
          </div>
        )}

        {/* ── Beta Tester Registry ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">Beta Tester Registry</h2>
          <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">+ Add Tester</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3 border-b border-gray-200">
          {ALL_TABS.map(tab => {
            const count   = tabCount(tab);
            const active  = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
                {count > 0 && (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-8">
          {filteredTesters.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-gray-400 italic">
                {testers.length === 0 ? 'No beta testers added yet. Click "Add Tester" to invite someone.' : `No testers with status "${activeTab}".`}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Contact', 'Shopify Domain', 'Invited', 'Installed', 'Connected', 'Last Accessed', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTesters.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedTester(t)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{t.contact_name}</p>
                      {t.contact_email && <p className="text-xs text-gray-500">{t.contact_email}</p>}
                      {t.contact_phone && <p className="text-xs text-gray-500">{t.contact_phone}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{t.shopify_domain ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(t.invited_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{t.installed_at ? formatDate(t.installed_at) : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{t.connected_at ? formatDate(t.connected_at) : '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.tenant_id ? formatDate(lastSessionMap[t.tenant_id]) : '—'}</td>
                    <td className="px-4 py-3"><StatusPill status={testerStatus(t)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Combined Stats Table — only show testers who are actually connected */}
        {testers.filter(t => t.tenant_id).length > 0 && (
          <>
            <h2 className="text-base font-semibold text-gray-800 mt-8 mb-3 pb-2 border-b border-gray-200">Tester Activity</h2>
            <CombinedStatsTable
              testers={testers.filter(t => t.tenant_id)}
              tenantStats={tenantStats}
              globalTotals={globalTotals}
            />
          </>
        )}

        {/* ── Error Log ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-8 mb-3 pb-2 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">
            Error Log
            {errorCount > 0 && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{errorCount}</span>}
          </h2>
          {someSelected && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1m-4 0H5" />
              </svg>
              {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size} selected`}
            </button>
          )}
        </div>

        {errors.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg px-5 py-4">
            <p className="text-sm text-green-700 font-medium">No errors recorded</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-3.5 w-3.5 rounded border-gray-300 text-red-600 cursor-pointer" />
                  </th>
                  {['Account', 'When', 'Source', 'Message', 'Context', ''].map((h, i) => (
                    <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {errors.map((e) => {
                  const isSelected = selectedIds.has(e.id);
                  return (
                    <tr key={e.id} className={`${isSelected ? 'bg-red-50' : 'hover:bg-red-50'}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleOne(e.id)} className="h-3.5 w-3.5 rounded border-gray-300 text-red-600 cursor-pointer" />
                      </td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {showAddModal && (
        <AddTesterModal adminKey={adminKey} onClose={() => setShowAddModal(false)} onAdded={(t) => setTesters(prev => [t, ...prev])} />
      )}

      {selectedTester && (
        <TesterDetailModal
          tester={selectedTester}
          adminKey={adminKey}
          onClose={() => setSelectedTester(null)}
          onStatusChange={handleStatusChange}
        />
      )}

    </div>
  );
}
