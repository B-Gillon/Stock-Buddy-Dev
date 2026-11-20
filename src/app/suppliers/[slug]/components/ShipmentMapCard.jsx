"use client";

// /src/app/suppliers/[slug]/components/ShipmentMapCard.jsx
// Suppliers -> Shipping tab: maps the columns of this supplier's shipment file to Stock Buddy's fields.

import { Fragment, useState, useEffect, useMemo, useRef } from "react";
import Button from "@/shared/components/ui/Button";
import { useToast } from "@/shared/components/ui/Toast";
import { MAP_GROUPS, MAP_FIELDS, DELIMITERS, parseDelimited, autoMatch } from "@/lib/shipmentMapFields";

const selectCls = "w-full rounded border border-gray-300 bg-gray-100 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300";
const emptyMap = () => Object.fromEntries(MAP_FIELDS.map((f) => [f.id, { col: null, fixed: null }]));
const delimChar = (id) => (DELIMITERS.find((d) => d.id === id) ?? DELIMITERS[0]).char;

// Cut to whole lines so a stored sample never ends mid-row
const trimSample = (text) => {
  const t = String(text ?? "").slice(0, 20000);
  return t.length === 20000 ? t.slice(0, t.lastIndexOf("\n") + 1 || 20000) : t;
};

export default function ShipmentMapCard({ supplierId }) {
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [cfg, setCfg] = useState(null);      // current (edited) config
  const [saved, setSaved] = useState(null);  // last saved config
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false); // after a Save click, unmapped required fields turn red

  useEffect(() => {
    let live = true;
    fetch(`/api/suppliers/${supplierId}/shipment-map`).then((r) => r.json()).then((j) => {
      if (!live) return;
      const c = {
        hasHeader: true, delimiter: "comma", sampleName: "", sampleText: "", ...(j.config ?? {}),
        map: { ...emptyMap(), ...(j.config?.map ?? {}) },
      };
      setCfg(c); setSaved(c);
    }).catch(() => {});
    return () => { live = false; };
  }, [supplierId]);

  const rows = useMemo(() => (cfg ? parseDelimited(cfg.sampleText, delimChar(cfg.delimiter), 50) : []), [cfg]);
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const headers = useMemo(() => Array.from({ length: width }, (_, i) => (cfg?.hasHeader ? (rows[0]?.[i] ?? "").trim() : "") || `Column ${i + 1}`), [rows, width, cfg?.hasHeader]);
  const dataRows = cfg?.hasHeader ? rows.slice(1) : rows;

  if (!cfg) return null;
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);
  const setMap = (id, patch) => setCfg((c) => ({ ...c, map: { ...c.map, [id]: { ...c.map[id], ...patch } } }));

  const has = (id) => cfg.map[id]?.col != null || !!cfg.map[id]?.fixed;
  const missing = MAP_FIELDS.filter((f) => f.required && !has(f.id)).map((f) => f.label);
  const noIdentifier = !["sku", "supplier_sku", "barcode"].some(has);
  const problems = [...missing, ...(noIdentifier ? ["at least one of SKU, Supplier SKU or Barcode"] : [])];
  const isMissing = (f) => (f.required && !has(f.id)) || (f.identifier && noIdentifier);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("Sample file is too large (5 MB max).", "error"); return; }
    const text = trimSample(await file.text());
    const first = text.split(/\r?\n/)[0] ?? "";
    const best = DELIMITERS.map((d) => ({ id: d.id, n: first.split(d.char).length - 1 })).sort((a, b) => b.n - a.n)[0];
    const delimiter = best.n > 0 ? best.id : cfg.delimiter;
    const parsed = parseDelimited(text, delimChar(delimiter), 50);
    // A first row that names at least two known fields is a header record
    const guess = parsed[0] ? autoMatch(parsed[0]) : {};
    const hasHeader = Object.keys(guess).length >= 2;
    if (!hasHeader) for (const k of Object.keys(guess)) delete guess[k];
    const map = emptyMap();
    for (const f of MAP_FIELDS) map[f.id] = { col: guess[f.id] ?? null, fixed: cfg.map[f.id]?.fixed ?? null };
    setCfg((c) => ({ ...c, sampleName: file.name, sampleText: text, delimiter, hasHeader, map }));
    setShowErrors(false);
    showToast(hasHeader ? `Loaded ${file.name}. Header record found; matched ${Object.keys(guess).length} columns by name.` : `Loaded ${file.name}. No header record found.`, "success");
  }

  async function save() {
    if (problems.length) { setShowErrors(true); showToast("Map the fields highlighted in red.", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/shipment-map`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setSaved(cfg);
      showToast("Mapping saved.", "success");
    } catch (err) { showToast(err.message, "error"); } finally { setSaving(false); }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="px-4 pt-3 pb-2">
        <h3 className="text-sm font-semibold text-gray-800">Mapping Configuration</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Tell Stock Buddy which column of this supplier&apos;s shipment file holds each piece of information. Every row of the file is one item in one carton.
        </p>
      </div>

      {/* File settings */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-gray-100 bg-gray-50 px-4 py-2.5">
        <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={onFile} />
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>{cfg.sampleText ? "Replace sample file" : "Upload sample file"}</Button>
        {cfg.sampleName && <span className="text-xs text-gray-500">{cfg.sampleName}</span>}
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <input type="checkbox" checked={cfg.hasHeader} onChange={(e) => setCfg((c) => ({ ...c, hasHeader: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-blue-600" />
          File has a header record
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
          Delimiter
          <select value={cfg.delimiter} onChange={(e) => setCfg((c) => ({ ...c, delimiter: e.target.value }))}
            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs">
            {DELIMITERS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-3">
          {problems.length === 0 && <span className="text-xs font-medium text-green-700">✓ Ready: all required fields are mapped</span>}
          <Button size="sm" onClick={save} disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>

      <div className="space-y-5 p-4">
        {/* Sample file: header and first 3 rows */}
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Sample file</h4>
          {width === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-400">
              Upload a sample shipment file (CSV) to see its columns here and pick them in the list below.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="whitespace-nowrap border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.slice(0, 3).map((r, ri) => (
                    <tr key={ri} className="border-b border-gray-50 last:border-0">
                      {headers.map((_, i) => <td key={i} className="whitespace-nowrap px-3 py-1 text-gray-700">{r[i] ?? ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mapping: Stock Buddy fields (left) -> fields in the file (right). Nothing here wraps. */}
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="whitespace-nowrap border-b border-gray-300 pb-1.5 pr-14 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Stock Buddy Fields</th>
              <th className="whitespace-nowrap border-b border-gray-300 pb-1.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Fields in File</th>
            </tr>
          </thead>
          <tbody>
            {MAP_GROUPS.map((g) => (
              <Fragment key={g.id}>
                <tr><td colSpan={2} className="whitespace-nowrap pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">{g.label}</td></tr>
                {g.fields.map((f) => {
                  const m = cfg.map[f.id];
                  return (
                    <tr key={f.id}>
                      <td className="whitespace-nowrap border-b border-gray-100 py-1.5 pr-14 text-gray-800">
                        {f.label}
                        {f.required && <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">Req</span>}
                        {f.identifier && <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">1+ req</span>}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 py-1.5">
                        <div className="flex items-center gap-2">
                          <select className={(showErrors && isMissing(f) ? selectCls.replace("w-full ", "").replace("border-gray-300 bg-gray-100", "border-red-500 bg-red-50") : selectCls.replace("w-full ", ""))} style={{ width: "11rem" }} value={m.col ?? ""} disabled={headers.length === 0}
                            onChange={(e) => setMap(f.id, { col: e.target.value === "" ? null : Number(e.target.value) })}>
                            <option value=""></option>
                            {headers.map((h, ci) => <option key={ci} value={ci}>{h}</option>)}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
