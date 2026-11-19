"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/shared/components/ui/Button";
import Badge from "@/shared/components/ui/Badge";
import Card from "@/shared/components/ui/Card";
import PageHeader from "@/shared/components/ui/PageHeader";
import { Toast, useToast } from "@/shared/components/ui/Toast";

const inputCls = "w-24 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-left text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100";
const blank = () => ({ bin: "", qty: "" });

export default function ClientPutawayPage({ po, lines, slug }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [sets, setSets] = useState(() => Object.fromEntries(lines.map((l) => [l.id, [blank()]])));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const digits = (v) => v === "" || /^\d+$/.test(v);
  const setField = (lineId, i, field, value) => {
    if (!digits(value)) return;
    setSets((prev) => ({ ...prev, [lineId]: prev[lineId].map((s, j) => (j === i ? { ...s, [field]: value } : s)) }));
  };
  const addLocation = (lineId) => setSets((prev) => ({ ...prev, [lineId]: [...prev[lineId], blank()] }));
  const removeLocation = (lineId, i) => setSets((prev) => ({ ...prev, [lineId]: prev[lineId].filter((_, j) => j !== i) }));

  const entered = (l) => sets[l.id].reduce((t, s) => t + (parseInt(s.qty, 10) || 0), 0);
  const overLine = (l) => entered(l) > l.ready_qty;
  const incomplete = lines.some((l) => sets[l.id].some((s) => (s.bin !== "") !== (s.qty !== "")));
  const anyOver = lines.some(overLine);
  const payload = lines
    .map((l) => ({ lineId: l.id, locations: sets[l.id].filter((s) => s.bin !== "" && parseInt(s.qty, 10) > 0).map((s) => ({ bin: s.bin, qty: parseInt(s.qty, 10) })) }))
    .filter((l) => l.locations.length);
  const canSubmit = payload.length > 0 && !anyOver && !incomplete && !isSubmitting;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/putaway`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines: payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Unknown error");
      showToast("Putaway submitted successfully.", "info");
      setTimeout(() => router.push(`/purchase-orders/${slug}`), 1200);
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

        <div className="grid grid-cols-4 gap-4">
          <Card title="Supplier"><p className="text-sm font-medium text-gray-800">{po.supplier_name || "—"}</p></Card>
          <Card title="Ship To"><p className="text-sm font-medium text-gray-800">{po.location_name || "—"}</p></Card>
          <Card title="Expected"><p className="text-sm font-medium text-gray-800">{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : "—"}</p></Card>
          <Card title="Summary">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Lines</span><span className="font-medium text-gray-800">{lines.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Units ready for putaway</span><span className="font-medium text-gray-800">{lines.reduce((t, l) => t + l.ready_qty, 0).toLocaleString()}</span></div>
            </div>
          </Card>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left font-medium">#</th>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Ordered</th>
                <th className="px-4 py-3 text-left font-medium">Received</th>
                <th className="px-4 py-3 text-left font-medium">Put Away</th>
                <th className="px-4 py-3 text-left font-medium">Ready for Putaway</th>
                <th className="px-4 py-3 text-left font-medium">Bin Location</th>
                <th className="px-4 py-3 text-left font-medium">Putaway</th>
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
                    <td className="px-4 py-3 text-gray-600">{line.sku}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{line.display_title}</td>
                    <td className="px-4 py-3 text-gray-700">{line.order_qty_units}</td>
                    <td className="px-4 py-3 text-gray-700">{line.received_qty_units}</td>
                    <td className="px-4 py-3 text-gray-500">{line.putaway_qty_units}</td>
                    <td className="px-4 py-3"><span className={canPut ? "font-medium text-gray-800" : "text-gray-400"}>{canPut ? line.ready_qty : "—"}</span></td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        {sets[line.id].map((s, i) => (
                          <input key={i} type="text" inputMode="numeric" value={s.bin} disabled={!canPut}
                            onChange={(e) => setField(line.id, i, "bin", e.target.value)} className={inputCls} aria-label="Bin Location" />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        {sets[line.id].map((s, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <input type="text" inputMode="numeric" value={s.qty} disabled={!canPut}
                              onChange={(e) => setField(line.id, i, "qty", e.target.value)}
                              className={`${inputCls} ${over ? "border-amber-400 bg-amber-50 text-amber-800" : ""}`} aria-label="Putaway" />
                            {i > 0 && (
                              <button type="button" onClick={() => removeLocation(line.id, i)} className="text-gray-400 hover:text-red-600" aria-label="Remove location">×</button>
                            )}
                          </div>
                        ))}
                      </div>
                      {over && <p className="mt-1 text-xs text-amber-700">More than the {line.ready_qty} ready.</p>}
                    </td>
                    <td className="px-4 py-3">
                      {canPut && <Button variant="secondary" onClick={() => addLocation(line.id)}>Add Location</Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {incomplete && <p className="text-sm text-red-600">Each location needs both a Bin Location and a Putaway quantity.</p>}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => router.push(`/purchase-orders/${slug}`)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>{isSubmitting ? "Submitting…" : "Submit"}</Button>
        </div>
      </div>
    </>
  );
}
