'use client';
// Settings → Shipment Settings: choose which optional shipment/carton fields suppliers see, and which are required.
import { useEffect, useState } from 'react';
import { Toast, useToast } from '@/shared/components/ui/Toast';
import { CARTON_FIELDS, SHIPMENT_FIELDS, normalizeConfig } from '@/lib/shipmentFields';

function Section({ title, defs, cfg, onChange }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <h3 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
            <th className="px-4 py-2 font-medium">Field</th>
            <th className="w-24 px-4 py-2 font-medium">Visible</th>
            <th className="w-24 px-4 py-2 font-medium">Required</th>
          </tr>
        </thead>
        <tbody>
          {defs.map((d) => {
            const c = cfg[d.id];
            return (
              <tr key={d.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2 text-gray-800">{d.label}</td>
                <td className="px-4 py-2">
                  <input type="checkbox" checked={c.visible} onChange={(e) => onChange(d.id, { visible: e.target.checked, required: e.target.checked ? c.required : false })} />
                </td>
                <td className="px-4 py-2">
                  <input type="checkbox" checked={c.required} disabled={!c.visible} onChange={(e) => onChange(d.id, { required: e.target.checked })} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ShipmentSettingsTab() {
  const { toast, showToast } = useToast();
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/shipment-settings').then((r) => r.json())
      .then((j) => setConfig(normalizeConfig(j.config)))
      .catch(() => showToast('Could not load shipment settings', 'error'));
  }, [showToast]);

  const change = (section) => (id, patch) =>
    setConfig((c) => normalizeConfig({ ...c, [section]: { ...c[section], [id]: { ...c[section][id], ...patch } } }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/shipment-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Save failed');
      setConfig(normalizeConfig(j.config));
      showToast('Shipment settings saved');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  if (!config) return <p className="text-sm text-gray-500">Loading…</p>;
  return (
    <div className="space-y-4">
      <Toast message={toast.message} type={toast.type} />
      <p className="text-sm text-gray-600">
        Choose which extra fields suppliers see when they create a shipment, and which they must fill in. A hidden field can’t be required.
        Always required: the automatic carton number, at least one item with a quantity in every carton, and the ship date.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Shipment fields" defs={SHIPMENT_FIELDS} cfg={config.shipment} onChange={change('shipment')} />
        <Section title="Carton fields" defs={CARTON_FIELDS} cfg={config.carton} onChange={change('carton')} />
      </div>
      <button onClick={save} disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
