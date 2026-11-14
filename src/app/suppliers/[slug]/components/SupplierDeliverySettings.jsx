"use client";

// /src/app/suppliers/[slug]/components/SupplierDeliverySettings.jsx
// Supplier-level file naming + SFTP delivery settings (Transmission tab).

import { useState, useEffect, useCallback } from "react";
import Button from "@/shared/components/ui/Button";
import { useToast } from "@/shared/components/ui/Toast";
import { buildPOFileBase, FILE_NAME_TOKENS, DEFAULT_FILE_NAME_PATTERN } from "@/lib/poFileName";

const inputCls =
  "w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500";
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

export default function SupplierDeliverySettings({ supplierId, emailPanel = null, savedRecipients = [] }) {
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
  const [editFile, setEditFile] = useState(false);
  const [editSftp, setEditSftp] = useState(false);

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
  const effectiveCsvPath = sameFolder ? form.sftp_pdf_path : form.sftp_csv_path;

  // Each card tracks and saves only its own fields.
  const SFTP_FIELDS = ["sftp_enabled", "sftp_host", "sftp_port", "sftp_username", "sftp_send_pdf", "sftp_send_csv", "sftp_pdf_path"];
  const dirtyFile = form.file_name_pattern !== saved.file_name_pattern;
  const dirtySftp =
    SFTP_FIELDS.some((k) => String(form[k] ?? "") !== String(saved[k] ?? "")) ||
    String(effectiveCsvPath ?? "") !== String(saved.sftp_csv_path ?? "") ||
    password !== "" || privateKey !== "";

  const pdfMissing = form.sftp_enabled && form.sftp_send_pdf && !String(form.sftp_pdf_path ?? "").trim();
  const csvMissing = form.sftp_enabled && form.sftp_send_csv && !String(effectiveCsvPath ?? "").trim();

  /**
   * scope "file"  : saves only the file name pattern (everything else is sent as already saved)
   * scope "sftp"  : saves only the SFTP settings (the file name pattern is sent as already saved)
   * scope "reset" : clears the pinned server key, changing nothing else
   */
  async function save(scope, extra = {}) {
    if (scope === "sftp" && form.sftp_enabled && (pdfMissing || csvMissing)) {
      showToast(`Enter the SFTP folder for ${pdfMissing ? "PDF" : "CSV"} files.`, "error");
      return;
    }
    const pendingPattern = form.file_name_pattern;
    const body = scope === "sftp"
      ? { ...form, file_name_pattern: saved.file_name_pattern, sftp_csv_path: effectiveCsvPath,
          sftp_password: password, sftp_private_key: privateKey }
      : { ...saved, ...(scope === "file" ? { file_name_pattern: form.file_name_pattern } : {}),
          sftp_password: "", sftp_private_key: "", ...extra };

    setSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/transmission-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      showToast(scope === "file" ? "File name saved." : scope === "sftp" ? "SFTP settings saved." : "Host key reset.", "success");

      if (scope === "file") {
        setSaved((sv) => ({ ...sv, file_name_pattern: pendingPattern }));
        setEditFile(false);
      } else {
        setTestResult(null);
        if (scope === "sftp") setEditSftp(false);
        await load();
        // load() refreshes everything from the server; keep any file-name edit still in progress
        if (editFile) setForm((f) => ({ ...f, file_name_pattern: pendingPattern }));
      }
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

  const saveFileBtn = (
    <Button size="sm" onClick={() => save("file")} disabled={!dirtyFile || saving}>
      {saving ? "Saving…" : "Save"}
    </Button>
  );
  const saveSftpBtn = (
    <Button size="sm" onClick={() => save("sftp")} disabled={!dirtySftp || saving}>
      {saving ? "Saving…" : "Save"}
    </Button>
  );

  function cancelFile() {
    setForm((f) => ({ ...f, file_name_pattern: saved.file_name_pattern }));
    setEditFile(false);
  }
  function cancelSftp() {
    setForm((f) => ({ ...saved, file_name_pattern: f.file_name_pattern }));
    setPassword("");
    setPrivateKey("");
    setSameFolder((saved.sftp_pdf_path ?? "") === (saved.sftp_csv_path ?? ""));
    setTestResult(null);
    setEditSftp(false);
  }

  // ── Current Setup: a plain-language recap of what is SAVED for this supplier ──────────
  const splitList = (v) => String(v ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  const emailLines = [];
  for (const r of savedRecipients) {
    const to = splitList(r.to_emails);
    if (to.length === 0) continue;
    const extra = [
      splitList(r.cc_emails).length ? `cc: ${splitList(r.cc_emails).join(", ")}` : null,
      splitList(r.bcc_emails).length ? `bcc: ${splitList(r.bcc_emails).join(", ")}` : null,
    ].filter(Boolean);
    const suffix = extra.length ? ` (${extra.join("; ")})` : "";
    if (r.send_pdf && r.send_csv) emailLines.push(`PDF and CSV emailed to ${to.join(", ")}${suffix}`);
    else if (r.send_pdf) emailLines.push(`PDF emailed to ${to.join(", ")}${suffix}`);
    else if (r.send_csv) emailLines.push(`CSV emailed to ${to.join(", ")}${suffix}`);
    if (!r.send_pdf && !r.send_csv) emailLines.push(`Email with no attachments sent to ${to.join(", ")}${suffix}`);
  }

  const sftpConfigured = !!(saved.sftp_host && saved.sftp_username && (meta.has_password || meta.has_private_key));
  const dirText = (path) => (path ? path : "login folder");
  const sftpLines = [];
  let sftpWarning = null;
  if (saved.sftp_enabled) {
    if (!sftpConfigured) {
      sftpWarning = "SFTP is turned on but not fully set up (host, username and a password or key are needed).";
    } else {
      if (saved.sftp_send_pdf && saved.sftp_send_csv && dirText(saved.sftp_pdf_path) === dirText(saved.sftp_csv_path)) {
        sftpLines.push(`PDF and CSV sent to SFTP directory (${dirText(saved.sftp_pdf_path)}) on ${saved.sftp_host}`);
      } else {
        if (saved.sftp_send_pdf) sftpLines.push(`PDF sent to SFTP directory (${dirText(saved.sftp_pdf_path)}) on ${saved.sftp_host}`);
        if (saved.sftp_send_csv) sftpLines.push(`CSV sent to SFTP directory (${dirText(saved.sftp_csv_path)}) on ${saved.sftp_host}`);
      }
      if (!saved.sftp_send_pdf && !saved.sftp_send_csv) sftpWarning = "SFTP is on, but neither PDF nor CSV is selected.";
    }
  }

  const savedPreview = buildPOFileBase(saved.file_name_pattern, sample);
  const nothingConfigured = emailLines.length === 0 && sftpLines.length === 0;

  const summaryCard = (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="px-4 pt-3 pb-1">
        <h3 className="text-sm font-semibold text-gray-800">Current Setup</h3>
        <p className="mt-0.5 text-xs text-gray-500">How POs are delivered to this supplier, based on what is saved.</p>
      </div>
      <div className="flex-1 space-y-3 px-4 pb-3 pt-2">
        {nothingConfigured ? (
          <p className="text-sm text-amber-700">
            Nothing is set up yet. POs can&apos;t be sent to this supplier until you add an email recipient or turn on SFTP.
          </p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {emailLines.map((line, i) => (
              <li key={`e${i}`} className="flex gap-2"><span aria-hidden className="text-gray-400">•</span><span>{line}</span></li>
            ))}
            {sftpLines.map((line, i) => (
              <li key={`s${i}`} className="flex gap-2"><span aria-hidden className="text-gray-400">•</span><span>{line}</span></li>
            ))}
          </ul>
        )}
        {sftpWarning && <p className="text-xs text-amber-700">⚠ {sftpWarning}</p>}
        <p className="border-t border-gray-100 pt-2 text-xs text-gray-500">
          Files are named like{" "}
          <span className="font-mono text-gray-700">{savedPreview}.pdf</span> and{" "}
          <span className="font-mono text-gray-700">{savedPreview}.csv</span>
        </p>
      </div>
    </div>
  );

  const fileNamesCard = (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between px-4 pt-3 pb-1">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">File Names</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            One naming rule for this supplier&apos;s PDF and CSV (emails, SFTP and Export). The extension is added automatically.
          </p>
        </div>
        <div className="ml-4 shrink-0">
          <Button variant="secondary" size="sm" onClick={editFile ? cancelFile : () => setEditFile(true)}>
            {editFile ? "Cancel" : "Edit"}
          </Button>
        </div>
      </div>
      <fieldset disabled={!editFile} className={`flex-1 space-y-2 px-4 pb-3 pt-2 ${editFile ? "" : "opacity-60"}`}>
        <input
          type="text"
          value={form.file_name_pattern}
          onChange={(e) => set("file_name_pattern", e.target.value)}
          className={inputCls}
          placeholder="{po_number}"
          aria-label="File name pattern"
        />
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(FILE_NAME_TOKENS).map(([token, help]) => (
            <button
              key={token}
              type="button"
              title={help}
              onClick={() => set("file_name_pattern", `${form.file_name_pattern}{${token}}`)}
              className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600 enabled:hover:bg-gray-100 disabled:cursor-not-allowed"
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
          Date and time placeholders use UTC, e.g. {`{po_number}_{datetime}`}.
        </p>
      </fieldset>
      {editFile && (
        <div className="flex items-center justify-end border-t border-gray-100 px-4 py-2">{saveFileBtn}</div>
      )}
    </div>
  );

  const sftpCard = (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between px-4 pt-3 pb-1">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">SFTP Delivery</h3>
        </div>
        <div className="ml-4 flex shrink-0 items-center gap-3">
          <label className={`flex items-center gap-2 text-xs font-medium text-gray-600 ${editSftp ? "" : "opacity-60"}`}>
            <input
              type="checkbox"
              checked={form.sftp_enabled}
              disabled={!editSftp}
              onChange={(e) => set("sftp_enabled", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            Enabled
          </label>
          <Button variant="secondary" size="sm" onClick={editSftp ? cancelSftp : () => setEditSftp(true)}>
            {editSftp ? "Cancel" : "Edit"}
          </Button>
        </div>
      </div>

      {form.sftp_enabled && (
        <fieldset disabled={!editSftp} className={`flex-1 space-y-3 px-4 pb-3 pt-2 ${editSftp ? "" : "opacity-60"}`}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
            {/* Connection fields (left) */}
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

            {/* Drop folders (right of the connection fields) */}
            <div className="space-y-2.5 self-start rounded border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-600">Drop Folders</p>

              <div className="flex items-center gap-2">
                <label className="flex w-14 shrink-0 items-center gap-2 text-xs font-medium text-gray-600">
                  <input type="checkbox" checked={form.sftp_send_pdf}
                    onChange={(e) => set("sftp_send_pdf", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  PDF
                </label>
                <input type="text" className={pdfMissing ? inputCls.replace("border-gray-200", "border-red-400") : inputCls} value={form.sftp_pdf_path}
                  disabled={!(form.sftp_send_pdf || (sameFolder && form.sftp_send_csv))}
                  onChange={(e) => set("sftp_pdf_path", e.target.value)}
                  placeholder="/outbound/po" />
              </div>

              <div className="flex items-center gap-2">
                <label className="flex w-14 shrink-0 items-center gap-2 text-xs font-medium text-gray-600">
                  <input type="checkbox" checked={form.sftp_send_csv}
                    onChange={(e) => set("sftp_send_csv", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  CSV
                </label>
                <input type="text" className={csvMissing ? inputCls.replace("border-gray-200", "border-red-400") : inputCls}
                  value={sameFolder ? form.sftp_pdf_path : form.sftp_csv_path}
                  disabled={!form.sftp_send_csv || sameFolder}
                  onChange={(e) => set("sftp_csv_path", e.target.value)}
                  placeholder="/outbound/po-csv" />
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={sameFolder}
                  onChange={(e) => setSameFolder(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                Put both files in the same folder
              </label>
            </div>

            {/* Private key (left) + note (right of it) */}
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

      {(form.sftp_enabled || editSftp) && (
      <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-2.5">
        {form.sftp_enabled && meta.host_fingerprint && (
          <button type="button" className="mr-auto text-xs text-blue-600 hover:underline"
            title="Only needed if the supplier changed their SFTP server or its security key"
            onClick={() => save("reset", { reset_host_key: true })} disabled={saving}>
            Reset host key
          </button>
        )}
        {form.sftp_enabled && (
          <Button variant="secondary" size="sm" onClick={testConnection} disabled={testing || dirtySftp}>
            {testing ? "Testing…" : dirtySftp ? "Save to test" : "Test connection"}
          </Button>
        )}
        {editSftp && saveSftpBtn}
      </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Row 1: Current Setup (left) + Email Addresses (right) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {summaryCard}
        {emailPanel}
      </div>
      {/* Row 2: File Names (left) + SFTP Delivery (right) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {fileNamesCard}
        {sftpCard}
      </div>
    </div>
  );
}
