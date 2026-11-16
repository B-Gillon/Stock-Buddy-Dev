"use client";
// Retailer switch: may this supplier generate SSCC carton labels in the supplier portal?
import { useEffect, useState } from "react";
import { useToast } from "@/shared/components/ui/Toast";

export default function CartonLabelSettings({ supplierId }) {
  const { showToast } = useToast();
  const [allowed, setAllowed] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/suppliers/${supplierId}/carton-labels`).then((r) => r.json()).then((j) => { if (live) setAllowed(!!j.allowed); }).catch(() => {});
    return () => { live = false; };
  }, [supplierId]);

  async function toggle(next) {
    setSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/carton-labels`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allowed: next }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setAllowed(!!j.allowed);
      showToast(j.allowed ? "Carton labels enabled for this supplier." : "Carton labels turned off for this supplier.", "success");
    } catch (err) { showToast(err.message, "error"); } finally { setSaving(false); }
  }

  if (allowed === null) return null;
  return (
    <div className="mx-4 mb-3 rounded border border-gray-200 bg-white p-3">
      <h4 className="text-sm font-semibold text-gray-800">Carton Labels (SSCC)</h4>
      <p className="mt-0.5 text-xs text-gray-500">
        Lets this supplier generate GS1 SSCC numbers and print carton labels from the supplier portal. The supplier enters their own GS1 company prefix.
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm text-gray-800">
        <input type="checkbox" disabled={saving} checked={allowed} onChange={(e) => toggle(e.target.checked)} />
        Allow this supplier to generate carton labels
      </label>
    </div>
  );
}
