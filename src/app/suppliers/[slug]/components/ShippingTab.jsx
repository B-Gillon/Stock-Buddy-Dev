"use client";
// Suppliers -> Shipping tab: which manual shipping fields this supplier sees when creating a shipment.
import { useEffect, useState } from "react";
import { useToast } from "@/shared/components/ui/Toast";
import Button from "@/shared/components/ui/Button";

export default function ShippingTab({ supplierId }) {
  const { showToast } = useToast();
  const [fields, setFields] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/suppliers/${supplierId}/shipping-fields`).then((r) => r.json()).then((j) => { if (live && j.fields) setFields(j.fields); }).catch(() => {});
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
      const res = await fetch(`/api/suppliers/${supplierId}/shipping-fields`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visible }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setFields(j.fields); setDirty(false);
      showToast("Shipping settings saved.", "success");
    } catch (err) { showToast(err.message, "error"); } finally { setSaving(false); }
  }

  if (!fields) return null;
  return (
    <div className="max-w-2xl rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800">Manual Shipping Controls</h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Choose which of these fields this supplier sees when they create a shipment. Unchecked fields are hidden from the supplier and are not required.
      </p>
      <div className="mt-4 space-y-2">
        {fields.map((f) => (
          <label key={f.id} className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={f.visible} onChange={() => toggle(f.id)} />
            {f.label}
          </label>
        ))}
      </div>
      <div className="mt-4">
        <Button onClick={save} disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}
