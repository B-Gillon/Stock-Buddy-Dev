"use client";

// /src/app/locations/[slug]/components/ClientLocationDetailPage.jsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import { Toast, useToast } from "@/shared/components/ui/Toast";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1") return `${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7)}`;
  return raw;
}

function formatPhoneOnBlur(value) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1") return `${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7)}`;
  return value;
}

// ─── Small shared components ──────────────────────────────────────────────────

function Detail({ label, value }) {
  return (
    <div className="flex text-sm">
      <div className="font-semibold w-28 shrink-0 text-gray-500">{label}:</div>
      <div className="text-gray-900">{value ?? "—"}</div>
    </div>
  );
}


// ─── Contact modal ────────────────────────────────────────────────────────────

const EMPTY_CONTACT = { name: "", phone: "", email: "", role: "", is_primary: false };

function ContactModal({ contact, onSave, onClose, saving, error }) {
  const [draft, setDraft] = useState(contact ?? EMPTY_CONTACT);

  function set(field) {
    return (e) => setDraft((d) => ({ ...d, [field]: e.target.value }));
  }

  const isNew = !contact?.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">
            {isNew ? "Add Contact" : "Edit Contact"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={draft.name}
              onChange={set("name")}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Contact name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
            <input
              type="text"
              value={draft.role}
              onChange={set("role")}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Warehouse Manager"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input
              type="tel"
              value={draft.phone}
              onChange={set("phone")}
              onBlur={(e) => setDraft((d) => ({ ...d, phone: formatPhoneOnBlur(e.target.value) }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="555-000-0000"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={draft.email}
              onChange={set("email")}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="contact@example.com"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.is_primary}
              onChange={(e) => setDraft((d) => ({ ...d, is_primary: e.target.checked }))}
              className="rounded"
            />
            Primary contact
          </label>
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            disabled={saving || !draft.name.trim()}
            className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
            {saving ? "Saving…" : isNew ? "Add Contact" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClientLocationDetailPage({ location, initialContacts, slug }) {
  const router   = useRouter();
  const [contacts,     setContacts]     = useState(initialContacts);
  const [modalContact, setModalContact] = useState(null); // null = closed, {} = new, {...} = editing
  const [saving,       setSaving]       = useState(false);
  const [modalError,   setModalError]   = useState(null);
  const { toast, showToast: _showToast } = useToast();

  function showToast(msg) { _showToast(msg); }

  async function handleSaveContact(draft) {
    setSaving(true);
    setModalError(null);
    const isNew = !draft.id;
    try {
      const res = await fetch(`/api/locations/${slug}/contacts`, {
        method:  isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");

      if (isNew) {
        // If new contact is primary, unset others locally
        setContacts((prev) => {
          const updated = draft.is_primary
            ? prev.map((c) => ({ ...c, is_primary: false }))
            : [...prev];
          return [...updated, data.contact].sort((a, b) =>
            b.is_primary - a.is_primary || a.name.localeCompare(b.name)
          );
        });
      } else {
        setContacts((prev) => {
          const updated = draft.is_primary
            ? prev.map((c) => ({ ...c, is_primary: c.id === draft.id }))
            : prev.map((c) => c.id === draft.id ? data.contact : c);
          return updated.sort((a, b) => b.is_primary - a.is_primary || a.name.localeCompare(b.name));
        });
      }

      setModalContact(null);
      showToast(isNew ? "Contact added." : "Contact saved.");
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteContact(contact) {
    if (!confirm(`Remove ${contact.name}?`)) return;
    try {
      const res = await fetch(`/api/locations/${slug}/contacts`, {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: contact.id }),
      });
      if (!res.ok) throw new Error("Delete failed.");
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      showToast("Contact removed.");
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  }

  return (
    <AppLayout title={location.name} showActionBar={false}>

      {/* ── Back + Title ── */}
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/locations")}
          className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 transition shrink-0"
        >
          ←
        </button>
        <h1 className="text-lg font-semibold leading-tight">{location.name}</h1>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
          location.active
            ? "bg-green-100 text-green-700 border-green-200"
            : "bg-gray-100 text-gray-500 border-gray-200"
        }`}>
          {location.active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* ── Cards ── */}
      <div className="flex gap-4 mb-4 items-stretch">

        {/* Card 1 — Address */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 shrink-0">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Address</h2>
          <div className="text-sm text-gray-900 space-y-0.5">
            {location.address1 && <p>{location.address1}</p>}
            {location.address2 && <p>{location.address2}</p>}
            {(location.city || location.province || location.zip) && (
              <p>{[location.city, location.province, location.zip].filter(Boolean).join(", ")}</p>
            )}
            {location.country && <p>{location.country}</p>}
            {!location.address1 && !location.city && (
              <p className="text-gray-400">No address on file.</p>
            )}
          </div>
        </div>

        {/* Card 2 — Details */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 shrink-0">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Details</h2>
          <div className="space-y-1">
            <Detail label="Type"       value={location.location_type} />
            <Detail label="Shopify ID" value={location.shopify_location_id} />
            <Detail label="Created"    value={location.created_at ? new Date(location.created_at).toLocaleDateString() : null} />
            <Detail label="Updated"    value={location.updated_at ? new Date(location.updated_at).toLocaleDateString() : null} />
          </div>
        </div>

        {/* Card 3 — Inventory Summary */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 shrink-0">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Inventory Summary</h2>
          <div className="space-y-1">
            <Detail label="Total Items"    value={location.total_item_count?.toLocaleString()} />
            <Detail label="Items In Stock" value={location.in_stock_count?.toLocaleString()} />
            <Detail label="Total Qty"      value={location.total_inventory?.toLocaleString()} />
          </div>
        </div>

        {/* Card 4 — Contacts */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Contacts</h2>
            <button
              onClick={() => { setModalContact(EMPTY_CONTACT); setModalError(null); }}
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600 transition"
            >
              + Add
            </button>
          </div>

          {contacts.length === 0 ? (
            <p className="text-sm text-gray-400">No contacts on file.</p>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-start justify-between gap-4 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="text-sm space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{contact.name}</span>
                      {contact.is_primary && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Primary
                        </span>
                      )}
                    </div>
                    {contact.role  && <p className="text-gray-500 text-xs">{contact.role}</p>}
                    {contact.phone && <p className="text-gray-700">{formatPhone(contact.phone)}</p>}
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline block truncate">
                        {contact.email}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setModalContact(contact); setModalError(null); }}
                      className="p-1 text-gray-400 hover:text-indigo-600 transition"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a4 4 0 01-1.414.943l-3.414.943.943-3.414A4 4 0 019 13z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteContact(contact)}
                      className="p-1 text-gray-400 hover:text-red-500 transition"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Contact modal */}
      {modalContact !== null && (
        <ContactModal
          contact={modalContact}
          onSave={handleSaveContact}
          onClose={() => setModalContact(null)}
          saving={saving}
          error={modalError}
        />
      )}

      <Toast message={toast.message} type={toast.type} />
    </AppLayout>
  );
}
