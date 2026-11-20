'use client';
// Settings -> Email Alerts: what each alert email says. Which suppliers use an alert, and who receives it,
// is set on each supplier (Suppliers -> Email Alerts tab).
import { useState, useEffect } from 'react';

const field = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

export default function EmailAlertsTab() {
  const [alerts, setAlerts] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { ok, text }

  useEffect(() => {
    fetch('/api/settings/alerts').then((r) => r.json()).then((d) => setAlerts(d.alerts ?? [])).catch(() => setAlerts([]));
  }, []);

  const edit = (type, k, v) => setAlerts((list) => list.map((a) => (a.type === type ? { ...a, [k]: v } : a)));

  async function save() {
    setSaving(true); setStatus(null);
    try {
      const templates = Object.fromEntries(alerts.map((a) => [a.type, { subject: a.subject, body: a.body }]));
      const res = await fetch('/api/settings/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templates }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setAlerts(d.alerts);
      setStatus({ ok: true, text: 'Saved.' });
    } catch (e) { setStatus({ ok: false, text: e.message }); }
    finally { setSaving(false); setTimeout(() => setStatus(null), 5000); }
  }

  if (!alerts) return <p className="py-10 text-center text-sm text-gray-500">Loading…</p>;
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Email Alerts</h2>
        <p className="mt-1 text-sm text-gray-500">
          The subject and message of each alert email. To turn an alert on for a supplier and choose who receives it, open the supplier and go to its <span className="font-medium">Email Alerts</span> tab.
        </p>
      </div>
      {alerts.map((a) => (
        <div key={a.type} className="rounded-lg border border-gray-200 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{a.title}</h3>
            <p className="text-xs text-gray-500">{a.description}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
            <input type="text" className={field} value={a.subject} maxLength={200} onChange={(e) => edit(a.type, 'subject', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Message</label>
            <textarea rows={9} className={`${field} font-mono text-xs`} value={a.body} onChange={(e) => edit(a.type, 'body', e.target.value)} />
          </div>
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs text-gray-400">Placeholders: {a.placeholders.map((p) => <code key={p} className="mr-1.5 rounded bg-gray-100 px-1 py-0.5">{`{{${p}}}`}</code>)}</p>
            <button type="button" className="shrink-0 text-xs text-blue-600 hover:underline"
              onClick={() => { edit(a.type, 'subject', a.defaultSubject); edit(a.type, 'body', a.defaultBody); }}>Reset to default</button>
          </div>
        </div>
      ))}
      <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
        {status && <span className={`text-sm ${status.ok ? 'text-green-600' : 'text-red-600'}`}>{status.text}</span>}
        <button type="button" onClick={save} disabled={saving} className="inline-flex items-center px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
      </div>
    </div>
  );
}
