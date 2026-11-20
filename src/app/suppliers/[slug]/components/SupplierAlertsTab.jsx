"use client";
// Suppliers -> Email Alerts tab: which alert emails this supplier uses, and who receives them.
// The subject and message of each alert are set in Settings -> Email Alerts.
import { useEffect, useState } from "react";
import Button from "@/shared/components/ui/Button";
import { useToast } from "@/shared/components/ui/Toast";

const inputCls = "w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500";

export default function SupplierAlertsTab({ supplierId }) {
  const { showToast } = useToast();
  const [alerts, setAlerts] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/suppliers/${supplierId}/alerts`).then((r) => r.json()).then((j) => { if (live && j.alerts) { setAlerts(j.alerts); setSaved(JSON.stringify(j.alerts)); } }).catch(() => {});
    return () => { live = false; };
  }, [supplierId]);

  const edit = (type, k, v) => setAlerts((list) => list.map((a) => (a.type === type ? { ...a, [k]: v } : a)));
  const dirty = alerts && JSON.stringify(alerts) !== saved;

  async function save() {
    setSaving(true);
    try {
      const body = { alerts: Object.fromEntries(alerts.map((a) => [a.type, { enabled: a.enabled, emails: a.emails, cc: a.cc, bcc: a.bcc }])) };
      const res = await fetch(`/api/suppliers/${supplierId}/alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setAlerts(j.alerts); setSaved(JSON.stringify(j.alerts));
      showToast("Email alerts saved.", "success");
    } catch (err) { showToast(err.message, "error"); } finally { setSaving(false); }
  }

  if (!alerts) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Email Alerts</h3>
          <p className="mt-0.5 text-xs text-gray-500">Choose which alerts are used for this supplier and who gets them. What each email says is set in Settings → Email Alerts.</p>
        </div>
        <Button onClick={save} disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
      <div className="mt-4 space-y-3">
        {alerts.map((a) => (
          <div key={a.type} className="rounded border border-gray-200 p-3">
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600" checked={a.enabled} onChange={(e) => edit(a.type, "enabled", e.target.checked)} />
              <span><span className="block text-sm font-medium text-gray-800">{a.title}</span><span className="block text-xs text-gray-500">{a.description}</span></span>
            </label>
            <div className="mt-2 pl-7">
              <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
              <textarea rows={2} className={inputCls} disabled={!a.enabled} value={a.emails} placeholder="you@company.com, team@company.com"
                onChange={(e) => edit(a.type, "emails", e.target.value)} />
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">CC</label>
                  <textarea rows={2} className={inputCls} disabled={!a.enabled} value={a.cc} onChange={(e) => edit(a.type, "cc", e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">BCC</label>
                  <textarea rows={2} className={inputCls} disabled={!a.enabled} value={a.bcc} onChange={(e) => edit(a.type, "bcc", e.target.value)} />
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-400">Separate addresses with commas. Up to 10 each. Any CC / BCC set for this alert in Settings → Email Alerts is added automatically.</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
