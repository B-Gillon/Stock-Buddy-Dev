'use client';
// Settings -> Email Alerts: who gets an email when something goes wrong behind the scenes.
import { useState, useEffect } from 'react';

const ALERTS = [
  { key: 'alert_po_release_failed', title: 'A PO could not be sent to its supplier', text: 'After you release a PO, the email / SFTP delivery to the supplier runs in the background. If it fails, you are told here.' },
  { key: 'alert_ship_file_failed', title: 'A ship file could not be processed', text: 'A shipment file picked up from a supplier\'s SFTP site had problems, so no shipments were created from it.' },
];

export default function EmailAlertsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { ok, text }
  const [emails, setEmails] = useState('');
  const [on, setOn] = useState({ alert_po_release_failed: true, alert_ship_file_failed: true });

  useEffect(() => {
    fetch('/api/settings/alerts').then((r) => r.json()).then((d) => {
      setEmails(d.alert_emails ?? '');
      setOn({ alert_po_release_failed: d.alert_po_release_failed !== false, alert_ship_file_failed: d.alert_ship_file_failed !== false });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true); setStatus(null);
    try {
      const res = await fetch('/api/settings/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alert_emails: emails, ...on }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setEmails(d.alert_emails ?? emails);
      setStatus({ ok: true, text: 'Saved.' });
    } catch (e) { setStatus({ ok: false, text: e.message }); }
    finally { setSaving(false); setTimeout(() => setStatus(null), 4000); }
  }

  if (loading) return <p className="py-10 text-center text-sm text-gray-500">Loading…</p>;
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Email Alerts</h2>
        <p className="mt-1 text-sm text-gray-500">Get an email when something fails in the background, so you don't have to watch for it.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Send alerts to</label>
        <textarea rows={2} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="you@company.com, team@company.com"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" />
        <p className="mt-1 text-xs text-gray-400">Separate addresses with commas. Up to 10. No alerts are sent until you enter at least one.</p>
      </div>
      <div className="space-y-3">
        {ALERTS.map((a) => (
          <label key={a.key} className="flex items-start gap-3 rounded-md border border-gray-200 p-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600" checked={on[a.key]} onChange={(e) => setOn((o) => ({ ...o, [a.key]: e.target.checked }))} />
            <span><span className="block text-sm font-medium text-gray-800">{a.title}</span><span className="block text-xs text-gray-500">{a.text}</span></span>
          </label>
        ))}
      </div>
      <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
        {status && <span className={`text-sm ${status.ok ? 'text-green-600' : 'text-red-600'}`}>{status.text}</span>}
        <button type="button" onClick={save} disabled={saving} className="inline-flex items-center px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
      </div>
    </div>
  );
}
