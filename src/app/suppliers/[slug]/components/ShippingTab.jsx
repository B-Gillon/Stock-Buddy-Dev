"use client";
// Suppliers -> Shipping tab: which manual shipping fields this supplier sees when creating a shipment.
import { useEffect, useState } from "react";
import { useToast } from "@/shared/components/ui/Toast";
import Button from "@/shared/components/ui/Button";
import SftpShipmentsCard from "./SftpShipmentsCard";
import ShipmentMapCard from "./ShipmentMapCard";

export default function ShippingTab({ supplierId }) {
  const { showToast } = useToast();
  const [fields, setFields] = useState(null);
  const [enforce, setEnforce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/suppliers/${supplierId}/shipping-fields`).then((r) => r.json()).then((j) => { if (live && j.fields) { setFields(j.fields); setEnforce(!!j.enforceValidSscc); } }).catch(() => {});
    return () => { live = false; };
  }, [supplierId]);

  function toggle(id) {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, visible: !f.visible } : f)));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const visible = Object.fromEntries(fields.map((f) => [f.id, f.visible]));
      const res = await fetch(`/api/suppliers/${supplierId}/shipping-fields`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visible, enforceValidSscc: enforce }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setFields(j.fields); setEnforce(!!j.enforceValidSscc); setDirty(false);
      showToast("Shipping settings saved.", "success");
    } catch (err) { showToast(err.message, "error"); } finally { setSaving(false); }
  }

  if (!fields) return null;
  const controls = (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Shipping Controls</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Choose which of these fields this supplier sees when they create a shipment. Unchecked fields are hidden from the supplier and are not required.
          </p>
        </div>
        <Button onClick={save} disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
      <div className="mt-3 space-y-0.5">
        {fields.map((f) => (
          <label key={f.id} className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={f.visible} onChange={() => toggle(f.id)} />
            {f.label}
          </label>
        ))}
      </div>
      <label className="mt-0.5 flex items-center gap-2 text-sm text-gray-800">
        <input type="checkbox" checked={enforce} onChange={() => { setEnforce((v) => !v); setDirty(true); }} />
        Enforce Valid SSCC#s
      </label>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {controls}
        <SftpShipmentsCard supplierId={supplierId} />
      </div>
      <ShipmentMapCard supplierId={supplierId} />
    </div>
  );
}
