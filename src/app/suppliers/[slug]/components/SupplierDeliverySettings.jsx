"use client";

// /src/app/suppliers/[slug]/components/SupplierDeliverySettings.jsx
// Supplier-level file naming + SFTP delivery settings (Transmission tab).

import { useState, useEffect, useCallback } from "react";
import Button from "@/shared/components/ui/Button";
import { useToast } from "@/shared/components/ui/Toast";
import { buildPOFileBase, FILE_NAME_TOKENS, DEFAULT_FILE_NAME_PATTERN } from "@/lib/poFileName";

const inputCls =
  "w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

const EMPTY = {
  file_name_pattern: DEFAULT_FILE_NAME_PATTERN,
  sftp_enabled: false,
  sftp_host: "",
  sftp_port: 22,
  sftp_username: "",
  sftp_send_pdf: true,
  sftp_send_csv: true,
  sftp_pdf_path: "",
  sftp_csv_path: "",
};

export default function SupplierDeliverySettings({ supplierId }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saved, setSaved] = useState(EMPTY);
  const [meta, setMeta] = useState({ has_password: false, has_private_key: false, host_fingerprint: null });
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [sameFolder, setSameFolder] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/transmission-settings`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load delivery settings");
      const { has_password, has_private_key, host_fingerprint, ...s } = json.settings;
      setForm(s);
      setSaved(s);
      setMeta({ has_password, has_private_key, host_fingerprint });
      setSameFolder((s.sftp_pdf_path ?? "") === (s.sftp_csv_path ?? ""));
      setPassword("");
      setPrivateKey("");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [supplierId, showToast]);

  useEffect(() => { load(); }, [load]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved) || password !== "" || privateKey !== "";

  const effectiveCsvPath = sameFolder ? form.sftp_pdf_path : form.sftp_csv_path;

  async function save(extra = {}) {
    setSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/transmission-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sftp_csv_path: effectiveCsvPath,
          sftp_password: password,
          sftp_private_key: privateKey,
          ...extra,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      showToast("Delivery settings saved.", "success");
      setTestResult(null);
      await load();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/sftp-test`, { method: "POST" });
      const json = await res.json();
      setTestResult(json);
      if (json.fingerprint && !meta.host_fingerprint) load();
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <div className="py-6 text-center text-sm text-gray-400">Loading…</div>;

  const sample = {
    poNumber: "PO-20261113-0001",
    supplierNumber: "SUP-100",
    poDate: "2026-11-13",
    now: new Date(Date.UTC(2026, 10, 13, 14, 5, 9)),
  };
  const preview = buildPOFileBase(form.file_name_pattern, sample);

  return (
    <div className="space-y-4">
      {/* ── File naming ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="px-4 pt-3 pb-1">
          <h3 className="text-sm font-semibold text-gray-800">File names</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            One naming rule for the PDF and CSV sent to this supplier (email attachments, SFTP files and the
            Export buttons). The extension is added automatically.
          </p>
        </div>
        <div className="px-4 pb-3 pt-2 space-y-2">
          <label className={labelCls}>Pattern</label>
          <input
            type="text"
            value={form.file_name_pattern}
            onChange={(e) => set("file_name_pattern", e.target.value)}
            className={inputCls}
            placeholder="{po_number}"
          />
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(FILE_NAME_TOKENS).map(([token, help]) => (
              <button
                key={token}
                type="button"
                title={help}
                onClick={() => set("file_name_pattern", `${form.file_name_pattern}{${token}}`)}
                className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
              >
                {`{${token}}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Example: <span className="font-mono text-gray-700">{preview}.pdf</span>{" "}
            and <span className="font-mono text-gray-700">{preview}.csv</span>
          </p>
          <p className="text-xs text-gray-400">
            {`{po_number}`} is required. Date and time placeholders use UTC, e.g. {`{po_number}_{datetime}`}.
          </p>
        </div>
      </div>

      {/* ── SFTP ───────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-start justify-between px-4 pt-3 pb-1">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">SFTP delivery</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Also drop the PO files on the supplier&apos;s SFTP site when a PO is released or resent.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600 shrink-0 ml-4">
            <input
              type="checkbox"
              checked={form.sftp_enabled}
              onChange={(e) => set("sftp_enabled", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            Enabled
          </label>
        </div>

        {form.sftp_enabled && (
          <div className="px-4 pb-3 pt-2 space-y-3">
            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-4">
                <label className={labelCls}>Host</label>
                <input type="text" className={inputCls} value={form.sftp_host}
                  onChange={(e) => set("sftp_host", e.target.value)} placeholder="sftp.supplier.com" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Port</label>
                <input type="number" className={inputCls} value={form.sftp_port}
                  onChange={(e) => set("sftp_port", e.target.value)} />
              </div>
              <div className="col-span-3">
                <label className={labelCls}>Username</label>
                <input type="text" className={inputCls} value={form.sftp_username} autoComplete="off"
                  onChange={(e) => set("sftp_username", e.target.value)} />
              </div>
              <div className="col-span-3">
                <label className={labelCls}>
                  Password {meta.has_password && <span className="font-normal text-green-600">(saved, leave blank to keep)</span>}
                </label>
                <input type="password" className={inputCls} value={password} autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={meta.has_password ? "••••••••" : ""} />
              </div>
              <div className="col-span-6">
                <label className={labelCls}>
                  Private key <span className="font-normal text-gray-400">(optional, instead of or with a password)</span>{" "}
                  {meta.has_private_key && <span className="font-normal text-green-600">(saved, leave blank to keep)</span>}
                </label>
                <textarea rows={3} className={`${inputCls} font-mono text-xs`} value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder={meta.has_private_key ? "••••••••" : "-----BEGIN OPENSSH PRIVATE KEY-----"} />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Credentials are encrypted before they are stored and are never shown again.
            </p>

            {/* Drop folders */}
            <div className="rounded border border-gray-100 bg-gray-50 p-3 space-y-3">
              <p className="text-xs font-medium text-gray-600">Drop folders</p>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 w-20 shrink-0 text-xs font-medium text-gray-600">
                  <input type="checkbox" checked={form.sftp_send_pdf}
                    onChange={(e) => set("sftp_send_pdf", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  PDF
                </label>
                <input type="text" className={inputCls} value={form.sftp_pdf_path}
                  disabled={!form.sftp_send_pdf}
                  onChange={(e) => set("sftp_pdf_path", e.target.value)}
                  placeholder="/outbound/po  (blank = login folder)" />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 w-20 shrink-0 text-xs font-medium text-gray-600">
                  <input type="checkbox" checked={form.sftp_send_csv}
                    onChange={(e) => set("sftp_send_csv", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  CSV
                </label>
                <input type="text" className={inputCls}
                  value={sameFolder ? form.sftp_pdf_path : form.sftp_csv_path}
                  disabled={!form.sftp_send_csv || sameFolder}
                  onChange={(e) => set("sftp_csv_path", e.target.value)}
                  placeholder="/outbound/po-csv  (blank = login folder)" />
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={sameFolder}
                  onChange={(e) => setSameFolder(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                Put both files in the same folder
              </label>
            </div>

            {/* Host key */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                Server identity:{" "}
                {meta.host_fingerprint
                  ? <span className="font-mono text-gray-600" title={meta.host_fingerprint}>trusted ({meta.host_fingerprint.slice(0, 16)}…)</span>
                  : "will be trusted on the first successful connection"}
              </span>
              {meta.host_fingerprint && (
                <button type="button" className="text-blue-600 hover:underline"
                  onClick={() => save({ reset_host_key: true })} disabled={saving}>
                  Reset host key
                </button>
              )}
            </div>

            {testResult && (
              <div className={`rounded border px-3 py-2 text-xs ${testResult.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                {testResult.error && <p>{testResult.error}</p>}
                {(testResult.checks ?? []).map((c) => (
                  <p key={c.label}>{c.ok ? "✓" : "✗"} {c.label} ({c.path}): {c.message}</p>
                ))}
                {testResult.ok && !testResult.checks?.length && <p>✓ Connected.</p>}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-2.5">
          {form.sftp_enabled && (
            <Button variant="secondary" size="sm" onClick={testConnection} disabled={testing || dirty}>
              {testing ? "Testing…" : dirty ? "Save to test" : "Test connection"}
            </Button>
          )}
          <Button size="sm" onClick={() => save()} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
