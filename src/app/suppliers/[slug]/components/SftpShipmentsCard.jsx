"use client";

// /src/app/suppliers/[slug]/components/SftpShipmentsCard.jsx
// Suppliers -> Shipping tab: SFTP connection used for this supplier's shipments.
// Same layout as the SFTP Delivery card (Print/Export tab), with one shipment folder.

import { useState, useEffect, useCallback } from "react";
import Button from "@/shared/components/ui/Button";
import { useToast } from "@/shared/components/ui/Toast";

const inputCls =
  "w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

const EMPTY = { sftp_enabled: false, sftp_host: "", sftp_port: 22, sftp_username: "", sftp_folder: "" };
const FIELDS = Object.keys(EMPTY);

export default function SftpShipmentsCard({ supplierId }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saved, setSaved] = useState(EMPTY);
  const [meta, setMeta] = useState({ has_password: false, has_private_key: false, host_fingerprint: null });
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [edit, setEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/sftp-shipments`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load SFTP settings");
      const { has_password, has_private_key, host_fingerprint, ...s } = json.settings;
      setForm(s); setSaved(s);
      setMeta({ has_password, has_private_key, host_fingerprint });
      setPassword(""); setPrivateKey("");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [supplierId, showToast]);

  useEffect(() => { load(); }, [load]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const dirty = FIELDS.some((k) => String(form[k] ?? "") !== String(saved[k] ?? "")) || password !== "" || privateKey !== "";
  const folderMissing = form.sftp_enabled && !String(form.sftp_folder ?? "").trim();

  async function save(extra = {}) {
    if (!extra.reset_host_key && folderMissing) { showToast("Enter the SFTP folder for shipment files.", "error"); return; }
    setSaving(true);
    try {
      const body = extra.reset_host_key
        ? { ...saved, sftp_password: "", sftp_private_key: "", ...extra }
        : { ...form, sftp_password: password, sftp_private_key: privateKey };
      const res = await fetch(`/api/suppliers/${supplierId}/sftp-shipments`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      showToast(extra.reset_host_key ? "Host key reset." : "SFTP settings saved.", "success");
      setTestResult(null);
      if (!extra.reset_host_key) setEdit(false);
      await load();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/sftp-shipments/test`, { method: "POST" });
      const json = await res.json();
      setTestResult(json);
      if (json.fingerprint && !meta.host_fingerprint) load();
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  }

  function cancel() {
    setForm(saved); setPassword(""); setPrivateKey(""); setTestResult(null); setEdit(false);
  }

  if (loading) return null;
  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between px-4 pt-3 pb-1">
        <h3 className="text-sm font-semibold text-gray-800">SFTP Configuration</h3>
        <div className="ml-4 flex shrink-0 items-center gap-3">
          <label className={`flex items-center gap-2 text-xs font-medium text-gray-600 ${edit ? "" : "opacity-60"}`}>
            <input type="checkbox" checked={form.sftp_enabled} disabled={!edit}
              onChange={(e) => set("sftp_enabled", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600" />
            Enabled
          </label>
          <Button variant="secondary" size="sm" onClick={edit ? cancel : () => setEdit(true)}>{edit ? "Cancel" : "Edit"}</Button>
        </div>
      </div>

      {form.sftp_enabled && (
        <fieldset disabled={!edit} className={`flex-1 space-y-3 px-4 pb-3 pt-2 ${edit ? "" : "opacity-60"}`}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
            <div className="space-y-2.5">
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <label className={labelCls}>Host</label>
                  <input type="text" className={inputCls} value={form.sftp_host}
                    onChange={(e) => set("sftp_host", e.target.value)} placeholder="sftp.supplier.com" />
                </div>
                <div className="w-14 shrink-0">
                  <label className={labelCls}>Port</label>
                  <input type="number" className={inputCls} value={form.sftp_port}
                    onChange={(e) => set("sftp_port", e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Username</label>
                <input type="text" className={inputCls} value={form.sftp_username} autoComplete="off"
                  onChange={(e) => set("sftp_username", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>
                  Password {meta.has_password && <span className="font-normal text-green-600">(saved)</span>}
                </label>
                <input type="password" className={inputCls} value={password} autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={meta.has_password ? "leave blank to keep" : ""} />
              </div>
            </div>

            <div className="space-y-2.5 self-start rounded border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-600">Shipment Folder</p>
              <input type="text" className={folderMissing ? inputCls.replace("border-gray-200", "border-red-400") : inputCls}
                value={form.sftp_folder} onChange={(e) => set("sftp_folder", e.target.value)} placeholder="/outbound/shipments" />
            </div>

            <div>
              <label className={labelCls}>
                Private key <span className="font-normal text-gray-400">(optional)</span>{" "}
                {meta.has_private_key && <span className="font-normal text-green-600">(saved)</span>}
              </label>
              <textarea rows={2} className={`${inputCls} font-mono text-xs`} value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder={meta.has_private_key ? "leave blank to keep" : "-----BEGIN OPENSSH PRIVATE KEY-----"} />
            </div>
            <p className="self-center text-xs text-gray-400">Credentials are encrypted and never shown again.</p>
          </div>
        </fieldset>
      )}

      {form.sftp_enabled && testResult && (
        <div className="px-4 pb-3">
          <div className={`rounded border px-3 py-2 text-xs ${testResult.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            {testResult.error && <p>{testResult.error}</p>}
            {(testResult.checks ?? []).map((c) => (
              <p key={c.label}>{c.ok ? "✓" : "✗"} {c.label} ({c.path}): {c.message}</p>
            ))}
            {testResult.ok && !testResult.checks?.length && <p>✓ Connected.</p>}
          </div>
        </div>
      )}

      {(form.sftp_enabled || edit) && (
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-2.5">
          {form.sftp_enabled && meta.host_fingerprint && (
            <button type="button" className="mr-auto text-xs text-blue-600 hover:underline"
              title="Only needed if the supplier changed their SFTP server or its security key"
              onClick={() => save({ reset_host_key: true })} disabled={saving}>
              Reset host key
            </button>
          )}
          {form.sftp_enabled && (
            <Button variant="secondary" size="sm" onClick={testConnection} disabled={testing || dirty}>
              {testing ? "Testing…" : dirty ? "Save to test" : "Test connection"}
            </Button>
          )}
          {edit && <Button size="sm" onClick={() => save()} disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</Button>}
        </div>
      )}
    </div>
  );
}
