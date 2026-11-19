"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/shared/components/ui/Button";
import Badge from "@/shared/components/ui/Badge";
import POInfoCards from "./POInfoCards";
import PageHeader from "@/shared/components/ui/PageHeader";
import { Toast, useToast } from "@/shared/components/ui/Toast";

const inputCls = "block rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-left text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100";
const BIN_W = "w-[6.5rem]", QTY_W = "w-[4rem]";
const blank = () => ({ bin: "", qty: "" });

export default function ClientPutawayPage({ po, lines, slug }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [sets, setSets] = useState(() => Object.fromEntries(lines.map((l) => [l.id, [blank()]])));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const digits = (v) => v === "" || /^\d+$/.test(v);
  const setField = (lineId, i, field, value) => {
    if (!digits(value)) return;
    setSets((prev) => ({ ...prev, [lineId]: prev[lineId].map((s, j) => (j === i ? { ...s, [field]: value } : s)) }));
  };
  const addLocation = (lineId) => setSets((prev) => ({ ...prev, [lineId]: [...prev[lineId], blank()] }));
  const removeLocation = (lineId, i) => setSets((prev) => ({ ...prev, [lineId]: prev[lineId].filter((_, j) => j !== i) }));

  // Tab goes Bin Location -> its Putaway -> the next Bin Location (Shift+Tab goes back the same way)
  const focusId = (id) => { const el = document.getElementById(id); if (el) { el.focus(); return true; } return false; };
  const onKey = (lineId, i, kind) => (e) => {
    if (e.key !== "Tab") return;
    const id = kind === "bin" ? (e.shiftKey ? `bin-${lineId}-${i - 1}-qty` : `qty-${lineId}-${i}`)
      : (e.shiftKey ? `bin-${lineId}-${i}` : `bin-${lineId}-${i + 1}`);
    const target = kind === "bin" && e.shiftKey ? `qty-${lineId}-${i - 1}` : kind === "qty" && !e.shiftKey ? `bin-${lineId}-${i + 1}` : id;
    if (document.getElementById(target)) { e.preventDefault(); focusId(target); }
  };

  const entered = (l) => sets[l.id].reduce((t, s) => t + (parseInt(s.qty, 10) || 0), 0);
  const overLine = (l) => entered(l) > l.ready_qty;
  const incomplete = lines.some((l) => sets[l.id].some((s) => (s.bin !== "") !== (s.qty !== "")));
  const anyOver = lines.some(overLine);
  const payload = lines
    .map((l) => ({ lineId: l.id, locations: sets[l.id].filter((s) => s.bin !== "" && parseInt(s.qty, 10) > 0).map((s) => ({ bin: s.bin, qty: parseInt(s.qty, 10) })) }))
    .filter((l) => l.locations.length);
  const canSubmit = !anyOver && !isSubmitting;

  const handleSubmit = async () => {
    setAttempted(true);
    if (incomplete || payload.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/putaway`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines: payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Unknown error");
      if (data.warning) showToast(data.warning, "error"); else showToast("Putaway submitted successfully.", "info");
      setTimeout(() => router.push(`/purchase-orders/${slug}`), data.warning ? 4000 : 1200);
    } catch (err) {
      showToast(err.message, "error");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Toast message={toast.message} type={toast.type} />
      <div className="space-y-4">
        <PageHeader backHref={`/purchase-orders/${slug}`} badge={<Badge status={po.status} />} />

        <POInfoCards
          po={po}
          lineCount={lines.length}
          totalUnits={lines.reduce((t, l) => t + (l.order_qty_units ?? 0), 0)}
          totalCost={lines.reduce((t, l) => t + (parseFloat(l.extended_cost) || 0), 0)}
          currencyCode={po.currency_code ?? "USD"}
          defaultCollapsed
          storageKey="po_action_cards_collapsed"
        />

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left font-medium">#</th>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Ordered</th>
                <th className="px-4 py-3 text-left font-medium">Received</th>
                <th className="px-4 py-3 text-left font-medium">Put Away</th>
                <th className="py-3 pl-4 pr-2 text-left font-medium">Ready for Putaway</th>
                <th className="px-2 py-3 text-left font-medium">Bin Location</th>
                <th className="px-2 py-3 text-left font-medium">Putaway</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const canPut = line.ready_qty > 0;
                const over = overLine(line);
                return (
                  <tr key={line.id} className="border-b border-gray-50 align-top last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-400">{line.line_no ?? idx + 1}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{line.sku}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{line.display_title}</td>
                    <td className="px-4 py-3 text-gray-700">{line.order_qty_units}</td>
                    <td className="px-4 py-3 text-gray-700">{line.received_qty_units}</td>
                    <td className="px-4 py-3 text-gray-500">{line.putaway_qty_units}</td>
                    <td className="py-3 pl-4 pr-2"><span className={canPut ? "font-medium text-gray-800" : "text-gray-400"}>{canPut ? line.ready_qty : "—"}</span></td>
                    <td className="px-2 py-3">
                      <div className="space-y-2">
                        {sets[line.id].map((s, i) => (
                          <input key={i} id={`bin-${line.id}-${i}`} onKeyDown={onKey(line.id, i, "bin")} type="text" inputMode="numeric" maxLength={10} value={s.bin} disabled={!canPut}
                            onChange={(e) => setField(line.id, i, "bin", e.target.value)} className={`${inputCls} ${BIN_W}`} aria-label="Bin Location" />
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="space-y-2">
                        {sets[line.id].map((s, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <input id={`qty-${line.id}-${i}`} onKeyDown={onKey(line.id, i, "qty")} type="text" inputMode="numeric" maxLength={5} value={s.qty} disabled={!canPut}
                              onChange={(e) => setField(line.id, i, "qty", e.target.value)}
                              className={`${inputCls} ${QTY_W} ${over ? "border-amber-400 bg-amber-50 text-amber-800" : ""}`} aria-label="Putaway" />
                            {i > 0 && (
                              <button type="button" onClick={() => removeLocation(line.id, i)} className="p-1 text-gray-400 hover:text-red-600" aria-label="Remove location" title="Remove location">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.35 9m-4.78 0L9.26 9m9.97-3.21c.34.05.68.11 1.02.17m-1.02-.17L18.16 19.67a2.25 2.25 0 01-2.24 2.08H8.08a2.25 2.25 0 01-2.24-2.08L4.77 5.79m14.46 0a48.1 48.1 0 00-3.48-.4m-12 .57c.34-.06.68-.12 1.02-.17m0 0a48.11 48.11 0 013.48-.4m7.5 0v-.92c0-1.18-.91-2.16-2.09-2.2a51.96 51.96 0 00-3.32 0c-1.18.04-2.09 1.02-2.09 2.2v.92m7.5 0a48.67 48.67 0 00-7.5 0" /></svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {over && <p className="mt-1 text-xs text-amber-700">More than the {line.ready_qty} ready.</p>}
                    </td>
                    <td className="px-4 py-3">
                      {canPut && <Button variant="secondary" onClick={() => addLocation(line.id)}><span aria-label="Add Location" title="Add Location" className="px-0.5 font-bold">+</span></Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {attempted && (incomplete || payload.length === 0) && <p className="text-sm text-red-600">Each location needs both a Bin Location and a Putaway quantity.</p>}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => router.push(`/purchase-orders/${slug}`)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>{isSubmitting ? "Submitting…" : "Submit"}</Button>
        </div>
      </div>
    </>
  );
}
