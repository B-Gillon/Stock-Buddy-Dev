"use client";
// "Acknowledgement required" options for the supplier's emailed POs (Transmission tab).
import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import { useToast } from "@/shared/components/ui/Toast";

export default function AcknowledgementSettings({ supplierId, saved, onSaved }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [draft, setDraft]     = useState(saved);

  const startEdit = () => { setDraft(saved); setEditing(true); };
  const cancel    = () => { setDraft(saved); setEditing(false); };
  const set       = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const remind = draft.ack_reminder_days != null && draft.ack_reminder_days !== "";
  const dirty  = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/acknowledgement-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      onSaved(json.settings);
      setEditing(false);
      showToast("Acknowledgement settings saved.", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const view = editing ? draft : saved;
  const viewRemind = view.ack_reminder_days != null && view.ack_reminder_days !== "";
  const off = !editing;

  return (
    <div className={`mx-4 mb-3 rounded border border-gray-200 p-3 ${off ? "bg-gray-50" : "bg-white"}`}>
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">Acknowledgement</h4>
          <p className="mt-0.5 text-xs text-gray-500">
            The email includes a link where the supplier enters their name and acknowledges the PO.
          </p>
        </div>
        {off ? (
          <Button variant="secondary" size="sm" onClick={startEdit}>Edit</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={cancel} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        )}
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-gray-800">
        <input type="checkbox" disabled={off} checked={!!view.ack_required}
          onChange={(e) => set({ ack_required: e.target.checked, ...(e.target.checked ? {} : { ack_reminder_days: null, ack_reminder_cc: "" }) })} />
        Acknowledgement required
      </label>

      {view.ack_required && (
        <div className="mt-3 space-y-3 pl-6">
          <label className="flex flex-wrap items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" disabled={off} checked={viewRemind}
              onChange={(e) => set(e.target.checked ? { ack_reminder_days: 3 } : { ack_reminder_days: null, ack_reminder_cc: "" })} />
            Send a reminder if not acknowledged within
            <input type="number" min={1} max={30} disabled={off || !viewRemind}
              value={viewRemind ? view.ack_reminder_days : ""}
              onChange={(e) => set({ ack_reminder_days: e.target.value === "" ? "" : Number(e.target.value) })}
              className="w-16 rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100" />
            business days
          </label>
          {viewRemind && (
            <div>
              <label className="block text-xs font-medium text-gray-600">Copy on the reminder (leave blank for no copy)</label>
              <input type="text" disabled={off} placeholder="you@yourcompany.com"
                value={view.ack_reminder_cc ?? ""}
                onChange={(e) => set({ ack_reminder_cc: e.target.value })}
                className="mt-1 w-full max-w-sm rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100" />
            </div>
          )}
          <p className="text-xs text-gray-400">Weekends and major U.S. holidays are not counted (Eastern Time).</p>
        </div>
      )}
    </div>
  );
}
