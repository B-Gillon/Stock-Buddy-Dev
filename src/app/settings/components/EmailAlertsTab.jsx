'use client';
// Settings -> Email Alerts: pick an alert on the left, edit what it says on the right. Tags are pulled into
// the email when it is sent. CC / BCC added here go on every supplier's copy of the alert automatically.
// Which suppliers use an alert, and who gets it, is set on each supplier (Suppliers -> Email Alerts tab).
import { useState, useEffect, useRef } from 'react';

const field = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const lbl = 'block text-xs font-medium text-gray-500 mb-1';

export default function EmailAlertsTab() {
  const [alerts, setAlerts] = useState(null);
  const [saved, setSaved] = useState('');
  const [sel, setSel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { ok, text }
  const subjectRef = useRef(null);
  const bodyRef = useRef(null);
  const lastField = useRef('body');

  useEffect(() => {
    fetch('/api/settings/alerts').then((r) => r.json()).then((d) => {
      setAlerts(d.alerts ?? []); setSaved(JSON.stringify(d.alerts ?? [])); setSel(d.alerts?.[0]?.type ?? null);
    }).catch(() => setAlerts([]));
  }, []);

  const edit = (type, k, v) => setAlerts((list) => list.map((a) => (a.type === type ? { ...a, [k]: v } : a)));
  const dirtyTypes = new Set((alerts ?? []).filter((a) => JSON.stringify(a) !== JSON.stringify(JSON.parse(saved || '[]').find((s) => s.type === a.type))).map((a) => a.type));

  // Puts the tag where the cursor was in the subject or message
  function insertTag(tag) {
    const key = lastField.current === 'subject' ? 'subject' : 'body';
    const el = key === 'subject' ? subjectRef.current : bodyRef.current;
    const text = `{{${tag}}}`;
    const cur = alerts.find((a) => a.type === sel)[key];
    const start = el?.selectionStart ?? cur.length, end = el?.selectionEnd ?? cur.length;
    edit(sel, key, cur.slice(0, start) + text + cur.slice(end));
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(start + text.length, start + text.length); } });
  }

  async function save() {
    setSaving(true); setStatus(null);
    try {
      const templates = Object.fromEntries(alerts.map((a) => [a.type, { subject: a.subject, body: a.body, cc: a.cc, bcc: a.bcc }]));
      const res = await fetch('/api/settings/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templates }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setAlerts(d.alerts); setSaved(JSON.stringify(d.alerts));
      setStatus({ ok: true, text: 'Saved.' });
    } catch (e) { setStatus({ ok: false, text: e.message }); }
    finally { setSaving(false); setTimeout(() => setStatus(null), 5000); }
  }

  if (!alerts) return <p className="py-10 text-center text-sm text-gray-500">Loading…</p>;
  const a = alerts.find((x) => x.type === sel);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Email Alerts</h2>
        <p className="mt-1 text-sm text-gray-500">
          What each alert email says. To turn an alert on for a supplier and choose who receives it, open the supplier and go to its <span className="font-medium">Email Alerts</span> tab.
        </p>
      </div>
      <div className="flex gap-5">
        {/* Alert list */}
        <nav className="w-60 shrink-0 space-y-1">
          {alerts.map((x) => (
            <button key={x.type} type="button" onClick={() => setSel(x.type)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${x.type === sel ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}>
              {x.title}{dirtyTypes.has(x.type) && <span className="ml-1 text-amber-500" title="Unsaved changes">●</span>}
            </button>
          ))}
        </nav>

        {/* Editor */}
        {a && (
          <div className="min-w-0 flex-1 space-y-4">
            <p className="text-xs text-gray-500">{a.description}</p>
            <div>
              <label className={lbl}>Subject</label>
              <input ref={subjectRef} type="text" className={field} value={a.subject} maxLength={200}
                onFocus={() => { lastField.current = 'subject'; }} onChange={(e) => edit(a.type, 'subject', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Message</label>
              <textarea ref={bodyRef} rows={11} className={`${field} font-mono text-xs`} value={a.body}
                onFocus={() => { lastField.current = 'body'; }} onChange={(e) => edit(a.type, 'body', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={lbl}>CC <span className="font-normal text-gray-400">(every supplier)</span></label>
                <textarea rows={2} className={field} value={a.cc} placeholder="name@company.com" onChange={(e) => edit(a.type, 'cc', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>BCC <span className="font-normal text-gray-400">(every supplier)</span></label>
                <textarea rows={2} className={field} value={a.bcc} placeholder="name@company.com" onChange={(e) => edit(a.type, 'bcc', e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-gray-400">CC and BCC here are added to this alert for every supplier that uses it, on top of any CC / BCC set on the supplier. Separate addresses with commas.</p>
            <button type="button" className="text-xs text-blue-600 hover:underline"
              onClick={() => { edit(a.type, 'subject', a.defaultSubject); edit(a.type, 'body', a.defaultBody); }}>Reset subject and message to default</button>
          </div>
        )}

        {/* Tags */}
        {a && (
          <aside className="w-64 shrink-0 self-start rounded-lg border border-gray-200 bg-gray-50 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tags</h3>
            <p className="mt-1 text-xs text-gray-500">Click a tag to put it in the subject or message. Each one is replaced with the real value when the email is sent.</p>
            <ul className="mt-2 space-y-2">
              {a.tags.map((t) => (
                <li key={t.tag}>
                  <button type="button" onClick={() => insertTag(t.tag)} className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-blue-700 ring-1 ring-gray-200 hover:bg-blue-50">{`{{${t.tag}}}`}</button>
                  <p className="mt-0.5 text-xs text-gray-500">{t.text}</p>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
      <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
        {status && <span className={`text-sm ${status.ok ? 'text-green-600' : 'text-red-600'}`}>{status.text}</span>}
        <button type="button" onClick={save} disabled={saving || dirtyTypes.size === 0} className="inline-flex items-center px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
      </div>
    </div>
  );
}
