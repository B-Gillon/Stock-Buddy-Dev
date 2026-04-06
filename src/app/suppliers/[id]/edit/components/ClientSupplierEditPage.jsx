"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import Button from "@/shared/components/ui/Button";

export default function ClientSupplierEditPage({ supplier }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    supplier_name:              supplier.supplier_name             ?? "",
    ap_number:                  supplier.ap_number                 ?? "",
    company_name:               supplier.company_name              ?? "",
    contact_name:               supplier.contact_name              ?? "",
    contact_email:              supplier.contact_email             ?? "",
    po_email:                   supplier.po_email                  ?? "",
    lead_days:                  supplier.lead_days                 ?? "",
    currency:                   supplier.currency                  ?? "",
    supplier_tax_type:          supplier.supplier_tax_type         ?? "",
    payment_terms:              supplier.payment_terms             ?? "",
    payment_method:             supplier.payment_method            ?? "",
    phone:                      supplier.phone                     ?? "",
    phone_toll_free:            supplier.phone_toll_free           ?? "",
    fax:                        supplier.fax                       ?? "",
    forecast_suggestion_period: supplier.forecast_suggestion_period ?? "",
    website:                    supplier.website                   ?? "",
    online_order_form:          supplier.online_order_form         ?? "",
    username:                   supplier.username                  ?? "",
    supplier_notes:             supplier.supplier_notes            ?? "",
    po_notes_template:          supplier.po_notes_template         ?? "",
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          lead_days: form.lead_days !== "" ? Number(form.lead_days) : null,
          forecast_suggestion_period: form.forecast_suggestion_period !== "" ? Number(form.forecast_suggestion_period) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save supplier");
      router.push(`/suppliers/${supplier.id}`);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  // ── Field helpers ──────────────────────────────────────────────────────────

  function Field({ label, name, type = "text", disabled = false, placeholder = "" }) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <input
          type={type}
          name={name}
          value={form[name] ?? ""}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            disabled
              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              : "border-gray-300 bg-white"
          }`}
        />
        {disabled && (
          <p className="text-xs text-gray-400 mt-0.5">This field cannot be changed.</p>
        )}
      </div>
    );
  }

  function TextArea({ label, name, rows = 3 }) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <textarea
          name={name}
          value={form[name] ?? ""}
          onChange={handleChange}
          rows={rows}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
      </div>
    );
  }

  function SectionHeading({ title }) {
    return (
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 pt-2 pb-1 border-b border-gray-100 col-span-full">
        {title}
      </h2>
    );
  }

  return (
    <AppLayout title="Edit Supplier">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/suppliers/${supplier.id}`)}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 transition shrink-0"
          >
            ←
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Edit Supplier</h1>
          <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">
            #{supplier.supplier_number}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Form grid ── */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">

          <SectionHeading title="Supplier Info" />
          <Field label="Supplier Name"    name="supplier_name" />
          <Field label="Supplier Number"  name="supplier_number" disabled />
          <Field label="AP Number"        name="ap_number" />
          <Field label="Company Name"     name="company_name" />
          <Field label="Currency"         name="currency" placeholder="e.g. CAD" />
          <Field label="Lead Days"        name="lead_days" type="number" />
          <Field label="Forecast Period (days)" name="forecast_suggestion_period" type="number" />

          <SectionHeading title="Contact" />
          <Field label="Contact Name"     name="contact_name" />
          <Field label="Contact Email"    name="contact_email" type="email" />
          <Field label="PO Email"         name="po_email" type="email" />
          <Field label="Phone"            name="phone" />
          <Field label="Toll-Free"        name="phone_toll_free" />
          <Field label="Fax"              name="fax" />
          <Field label="Website"          name="website" type="url" />
          <Field label="Online Order Form" name="online_order_form" type="url" />
          <Field label="Username"         name="username" />

          <SectionHeading title="Payment & Tax" />
          <Field label="Payment Terms"    name="payment_terms" />
          <Field label="Payment Method"   name="payment_method" />
          <Field label="Tax Type"         name="supplier_tax_type" />

          <SectionHeading title="Notes" />
          <div className="col-span-full">
            <TextArea label="Supplier Notes"    name="supplier_notes" rows={3} />
          </div>
          <div className="col-span-full">
            <TextArea label="PO Notes Template" name="po_notes_template" rows={3} />
          </div>

        </div>

        {/* ── Actions ── */}
        <div className="flex items-center justify-between pt-6 mt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={() => router.push(`/suppliers/${supplier.id}`)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</Button>
        </div>
      </div>

    </AppLayout>
  );
}
