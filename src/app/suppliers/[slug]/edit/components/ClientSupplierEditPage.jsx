"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import Button from "@/shared/components/ui/Button";

// ── Field helpers defined OUTSIDE the page component to prevent remount on every keystroke ──

function Field({ label, name, type = "text", disabled = false, placeholder = "", value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value ?? ""}
        onChange={onChange}
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

function TextArea({ label, name, rows = 3, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <textarea
        name={name}
        value={value ?? ""}
        onChange={onChange}
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

export default function ClientSupplierEditPage({ supplier }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    supplier_name:              supplier.supplier_name              ?? "",
    ap_number:                  supplier.ap_number                  ?? "",
    company_name:               supplier.company_name               ?? "",
    contact_name:               supplier.contact_name               ?? "",
    contact_email:              supplier.contact_email              ?? "",
    lead_days:                  supplier.lead_days                  ?? "",
    currency:                   supplier.currency                   ?? "",
    supplier_tax_type:          supplier.supplier_tax_type          ?? "",
    payment_terms:              supplier.payment_terms              ?? "",
    payment_method:             supplier.payment_method             ?? "",
    phone:                      supplier.phone                      ?? "",
    phone_toll_free:            supplier.phone_toll_free            ?? "",
    fax:                        supplier.fax                        ?? "",
    forecast_suggestion_period: supplier.forecast_suggestion_period ?? "",
    website:                    supplier.website                    ?? "",
    online_order_form:          supplier.online_order_form          ?? "",
    username:                   supplier.username                   ?? "",
    supplier_notes:             supplier.supplier_notes             ?? "",
    po_notes_template:          supplier.po_notes_template          ?? "",
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
      router.push(`/suppliers/${supplier.supplier_number}`);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <AppLayout title="Edit Supplier">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/suppliers/${supplier.supplier_number}`)}
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
          <Field label="Supplier Name"         name="supplier_name"              value={form.supplier_name}              onChange={handleChange} />
          <Field label="Supplier Number"        name="supplier_number"            value={supplier.supplier_number}        onChange={handleChange} disabled />
          <Field label="AP Number"              name="ap_number"                  value={form.ap_number}                  onChange={handleChange} />
          <Field label="Company Name"           name="company_name"               value={form.company_name}               onChange={handleChange} />
          <Field label="Currency"               name="currency"                   value={form.currency}                   onChange={handleChange} placeholder="e.g. CAD" />
          <Field label="Lead Days"              name="lead_days"                  value={form.lead_days}                  onChange={handleChange} type="number" />
          <Field label="Forecast Period (days)" name="forecast_suggestion_period" value={form.forecast_suggestion_period} onChange={handleChange} type="number" />

          <SectionHeading title="Contact" />
          <Field label="Contact Name"      name="contact_name"     value={form.contact_name}     onChange={handleChange} />
          <Field label="Contact Email"     name="contact_email"    value={form.contact_email}    onChange={handleChange} type="email" />
          <Field label="Phone"             name="phone"            value={form.phone}            onChange={handleChange} />
          <Field label="Toll-Free"         name="phone_toll_free"  value={form.phone_toll_free}  onChange={handleChange} />
          <Field label="Fax"               name="fax"              value={form.fax}              onChange={handleChange} />
          <Field label="Website"           name="website"          value={form.website}          onChange={handleChange} type="url" />
          <Field label="Online Order Form" name="online_order_form" value={form.online_order_form} onChange={handleChange} type="url" />
          <Field label="Username"          name="username"         value={form.username}         onChange={handleChange} />

          <SectionHeading title="Payment & Tax" />
          <Field label="Payment Terms"  name="payment_terms"     value={form.payment_terms}     onChange={handleChange} />
          <Field label="Payment Method" name="payment_method"    value={form.payment_method}    onChange={handleChange} />
          <Field label="Tax Type"       name="supplier_tax_type" value={form.supplier_tax_type} onChange={handleChange} />

          <SectionHeading title="Notes" />
          <div className="col-span-full">
            <TextArea label="Supplier Notes"    name="supplier_notes"    value={form.supplier_notes}    onChange={handleChange} rows={3} />
          </div>
          <div className="col-span-full">
            <TextArea label="PO Notes Template" name="po_notes_template" value={form.po_notes_template} onChange={handleChange} rows={3} />
          </div>

        </div>

        {/* ── Actions ── */}
        <div className="flex items-center justify-between pt-6 mt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={() => router.push(`/suppliers/${supplier.supplier_number}`)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</Button>
        </div>
      </div>

    </AppLayout>
  );
}
