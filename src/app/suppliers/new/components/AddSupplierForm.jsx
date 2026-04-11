"use client";

// /src/app/suppliers/new/components/AddSupplierForm.jsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import Button from "@/shared/components/ui/Button";

// ─── helpers ─────────────────────────────────────────────────────────────────

const EMPTY_ADDRESS = {
  address_type:   "primary",
  address1:       "",
  address2:       "",
  city:           "",
  state_province: "",
  postal_code:    "",
  country:        "",
};

const REQUIRED_TOP     = ["supplier_name", "supplier_number", "company_name", "currency"];
const REQUIRED_ADDRESS = ["address1", "city", "state_province", "postal_code", "country"];

// Format 10- or 11-digit phone strings as ###-###-####
function formatPhone(raw) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7)}`;
  }
  return raw; // return as-is if not a recognisable format
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children, required }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function Input({ error, ...props }) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
        error ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"
      }`}
    />
  );
}

function Textarea({ error, ...props }) {
  return (
    <textarea
      {...props}
      rows={4}
      className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors resize-y ${
        error ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"
      }`}
    />
  );
}

function Select({ error, children, ...props }) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-colors ${
        error ? "border-red-400 bg-red-50" : "border-gray-300"
      }`}
    >
      {children}
    </select>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AddSupplierForm() {
  const router     = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors,     setErrors]     = useState({});

  const [form, setForm] = useState({
    supplier_name:              "",
    supplier_number:            "",
    company_name:               "",
    contact_name:               "",
    contact_email:              "",
    phone:                      "",
    phone_toll_free:            "",
    fax:                        "",
    website:                    "",
    ap_number:                  "",
    payment_terms:              "",
    payment_method:             "",
    currency:                   "",
    lead_days:                  "",
    shipping_method:            "",
    freight_scheduler:          "",
    shipping_notes:             "",
    po_email:                   "",
    online_order_form:          "",
    username:                   "",
    supplier_tax_type:          "",
    supplier_notes:             "",
    po_notes_template:          "",
  });

  const [addresses,           setAddresses]           = useState([]);
  const [showAddressModal,    setShowAddressModal]    = useState(false);
  const [editingAddressIndex, setEditingAddressIndex] = useState(null);
  const [addressDraft,        setAddressDraft]        = useState(EMPTY_ADDRESS);
  const [addressDraftErrors,  setAddressDraftErrors]  = useState({});

  function set(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      if (errors[field]) setErrors((err) => ({ ...err, [field]: null }));
    };
  }

  // Format phone fields on blur
  function handlePhoneBlur(field) {
    return () => {
      setForm((f) => ({ ...f, [field]: formatPhone(f[field]) }));
    };
  }

  function openAddAddress() {
    setAddressDraft(EMPTY_ADDRESS);
    setAddressDraftErrors({});
    setEditingAddressIndex(null);
    setShowAddressModal(true);
  }

  function openEditAddress(idx) {
    setAddressDraft({ ...addresses[idx] });
    setAddressDraftErrors({});
    setEditingAddressIndex(idx);
    setShowAddressModal(true);
  }

  function removeAddress(idx) {
    setAddresses((a) => a.filter((_, i) => i !== idx));
  }

  function validateAddressDraft() {
    const errs = {};
    for (const f of REQUIRED_ADDRESS) {
      if (!addressDraft[f]?.trim()) errs[f] = "This field is required";
    }
    return errs;
  }

  function saveAddress() {
    const errs = validateAddressDraft();
    if (Object.keys(errs).length > 0) { setAddressDraftErrors(errs); return; }
    if (editingAddressIndex !== null) {
      setAddresses((a) => a.map((addr, i) => (i === editingAddressIndex ? { ...addressDraft } : addr)));
    } else {
      setAddresses((a) => [...a, { ...addressDraft }]);
    }
    setShowAddressModal(false);
  }

  function setDraftField(field) {
    return (e) => {
      setAddressDraft((d) => ({ ...d, [field]: e.target.value }));
      if (addressDraftErrors[field]) setAddressDraftErrors((e) => ({ ...e, [field]: null }));
    };
  }

  function validate() {
    const errs = {};
    for (const f of REQUIRED_TOP) {
      if (!form[f]?.trim()) errs[f] = "This field is required";
    }
    if (addresses.length === 0) errs._addresses = "At least one address is required";
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/suppliers", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ form, addresses }),
      });
      if (!res.ok) throw new Error("Failed to create supplier");
      const { id } = await res.json();
      router.push(`/suppliers/${data.supplier_number}`);
    } catch (err) {
      console.error(err);
      setErrors({ _global: "Something went wrong. Please try again." });
      setSubmitting(false);
    }
  }

  return (
    <AppLayout title="Add Supplier" showActionBar={false}>

      {/* Back link + page title */}
      <div className="mb-4">
        <button
          onClick={() => router.push("/suppliers")}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Suppliers
        </button>
        <h1 className="text-lg font-semibold text-gray-800">Add Supplier</h1>
      </div>

      {errors._global && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {errors._global}
        </div>
      )}

      {/* SECTION 1 — General Info */}
      <SectionCard title="General Info">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Field label="Supplier Name" required error={errors.supplier_name}>
            <Input value={form.supplier_name} onChange={set("supplier_name")} error={errors.supplier_name} placeholder="e.g. Acme Co." />
          </Field>
          <Field label="Supplier Number" required error={errors.supplier_number}>
            <Input value={form.supplier_number} onChange={set("supplier_number")} error={errors.supplier_number} placeholder="e.g. SUP-001" />
          </Field>
          <Field label="Company Name" required error={errors.company_name}>
            <Input value={form.company_name} onChange={set("company_name")} error={errors.company_name} placeholder="Legal company name" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Field label="Contact Name">
            <Input value={form.contact_name} onChange={set("contact_name")} placeholder="Primary contact" />
          </Field>
          <Field label="Contact Email">
            <Input type="email" value={form.contact_email} onChange={set("contact_email")} placeholder="contact@supplier.com" />
          </Field>
          <Field label="Website">
            <Input type="url" value={form.website} onChange={set("website")} placeholder="https://supplier.com" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Phone">
            <Input
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              onBlur={handlePhoneBlur("phone")}
              placeholder="555-000-0000"
            />
          </Field>
          <Field label="Phone Toll Free">
            <Input
              type="tel"
              value={form.phone_toll_free}
              onChange={set("phone_toll_free")}
              onBlur={handlePhoneBlur("phone_toll_free")}
              placeholder="800-000-0000"
            />
          </Field>
          <Field label="Fax">
            <Input
              type="tel"
              value={form.fax}
              onChange={set("fax")}
              onBlur={handlePhoneBlur("fax")}
              placeholder="555-000-0001"
            />
          </Field>
        </div>
      </SectionCard>

      {/* SECTION 2 — Address Info */}
      <SectionCard title="Address Info">
        {errors._addresses && (
          <p className="text-xs text-red-500 mb-3">{errors._addresses}</p>
        )}
        {addresses.length > 0 && (
          <div className="space-y-2 mb-4">
            {addresses.map((addr, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-md border border-gray-200 text-sm">
                <div>
                  <span className="inline-block text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded mr-2 capitalize">
                    {addr.address_type}
                  </span>
                  <span className="text-gray-700">
                    {addr.address1}{addr.address2 ? `, ${addr.address2}` : ""},{" "}
                    {addr.city}, {addr.state_province} {addr.postal_code},{" "}
                    {addr.country}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button onClick={() => openEditAddress(idx)} className="text-gray-400 hover:text-indigo-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a4 4 0 01-1.414.943l-3.414.943.943-3.414A4 4 0 019 13z" />
                    </svg>
                  </button>
                  <button onClick={() => removeAddress(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={openAddAddress}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-md hover:bg-indigo-50 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Address
        </button>
      </SectionCard>

      {/* SECTION 3 — Payments / Billing */}
      <SectionCard title="Payments / Billing Info">
        <div className="grid grid-cols-4 gap-4">
          <Field label="AP Number">
            <Input value={form.ap_number} onChange={set("ap_number")} placeholder="AP #" />
          </Field>
          <Field label="Currency" required error={errors.currency}>
            <Select value={form.currency} onChange={set("currency")} error={errors.currency}>
              <option value="">Select</option>
              <option value="USD">USD</option>
              <option value="CAD">CAD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="AUD">AUD</option>
              <option value="MXN">MXN</option>
            </Select>
          </Field>
          <Field label="Payment Terms">
            <Select value={form.payment_terms} onChange={set("payment_terms")}>
              <option value="">Select</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
              <option value="Net 90">Net 90</option>
              <option value="Due on Receipt">Due on Receipt</option>
              <option value="Prepaid">Prepaid</option>
            </Select>
          </Field>
          <Field label="Payment Method">
            <Select value={form.payment_method} onChange={set("payment_method")}>
              <option value="">Select</option>
              <option value="ACH">ACH</option>
              <option value="Check">Check</option>
              <option value="Wire">Wire Transfer</option>
              <option value="Credit Card">Credit Card</option>
            </Select>
          </Field>
        </div>
      </SectionCard>

      {/* SECTION 4 — Shipping Info */}
      <SectionCard title="Shipping Info">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Field label="Lead Days">
            <Input type="number" min="0" value={form.lead_days} onChange={set("lead_days")} placeholder="e.g. 14" />
          </Field>
          <Field label="Preferred Shipping Method">
            <Select value={form.shipping_method} onChange={set("shipping_method")}>
              <option value="">Select</option>
              <option value="LTL">LTL</option>
              <option value="Small Parcel">Small Parcel</option>
            </Select>
          </Field>
          <Field label="Who Schedules Freight">
            <Select value={form.freight_scheduler} onChange={set("freight_scheduler")}>
              <option value="">Select</option>
              <option value="Supplier">Supplier</option>
              <option value="Merchant">Merchant</option>
              <option value="3rd Party">3rd Party</option>
            </Select>
          </Field>
        </div>
        <Field label="Shipping Notes">
          <Textarea value={form.shipping_notes} onChange={set("shipping_notes")} placeholder="Optional shipping notes or special instructions..." />
        </Field>
      </SectionCard>

      {/* SECTION 5 — PO Transmission */}
      <SectionCard title="PO Transmission Info">
        <div className="grid grid-cols-4 gap-4">
          <Field label="PO Email">
            <Input type="email" value={form.po_email} onChange={set("po_email")} placeholder="orders@supplier.com" />
          </Field>
          <Field label="Online Order Form / Portal">
            <Input type="url" value={form.online_order_form} onChange={set("online_order_form")} placeholder="https://portal.supplier.com" />
          </Field>
          <Field label="Username">
            <Input value={form.username} onChange={set("username")} placeholder="Portal username" />
          </Field>
          <Field label="Supplier Tax Type">
            <Select value={form.supplier_tax_type} onChange={set("supplier_tax_type")}>
              <option value="">Select</option>
              <option value="Tax Included">Tax Included</option>
              <option value="Tax Excluded">Tax Excluded</option>
            </Select>
          </Field>
        </div>
      </SectionCard>

      {/* SECTION 6 — Notes */}
      <SectionCard title="Notes">
        <div className="space-y-4">
          <Field label="Supplier Notes (private)">
            <Textarea value={form.supplier_notes} onChange={set("supplier_notes")} placeholder="Internal notes about this supplier..." />
          </Field>
          <Field label="PO Notes Template">
            <Textarea value={form.po_notes_template} onChange={set("po_notes_template")} placeholder="Default notes to include on purchase orders..." />
          </Field>
        </div>
      </SectionCard>

      {/* Submit */}
      <div className="flex justify-end py-4">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Creating...
            </>
          ) : (
            "Create Supplier"
          )}
        </button>
      </div>

      {/* Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">
                {editingAddressIndex !== null ? "Edit Address" : "Add Address"}
              </h3>
              <button onClick={() => setShowAddressModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Field label="Address Type">
                <Select value={addressDraft.address_type} onChange={setDraftField("address_type")}>
                  <option value="primary">Primary</option>
                  <option value="billing">Billing</option>
                  <option value="shipping">Shipping</option>
                  <option value="returns">Returns</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Address 1" required error={addressDraftErrors.address1}>
                <Input value={addressDraft.address1} onChange={setDraftField("address1")} error={addressDraftErrors.address1} placeholder="Street address" />
              </Field>
              <Field label="Address 2">
                <Input value={addressDraft.address2} onChange={setDraftField("address2")} placeholder="Suite, unit, etc." />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="City" required error={addressDraftErrors.city}>
                  <Input value={addressDraft.city} onChange={setDraftField("city")} error={addressDraftErrors.city} placeholder="City" />
                </Field>
                <Field label="State / Province" required error={addressDraftErrors.state_province}>
                  <Input value={addressDraft.state_province} onChange={setDraftField("state_province")} error={addressDraftErrors.state_province} placeholder="State or province" />
                </Field>
                <Field label="Postal Code" required error={addressDraftErrors.postal_code}>
                  <Input value={addressDraft.postal_code} onChange={setDraftField("postal_code")} error={addressDraftErrors.postal_code} placeholder="Postal / ZIP" />
                </Field>
                <Field label="Country" required error={addressDraftErrors.country}>
                  <Input value={addressDraft.country} onChange={setDraftField("country")} error={addressDraftErrors.country} placeholder="Country" />
                </Field>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAddressModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={saveAddress} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors">
                {editingAddressIndex !== null ? "Save Changes" : "Add Address"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
