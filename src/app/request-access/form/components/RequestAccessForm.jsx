"use client";

// src/app/request-access/form/components/RequestAccessForm.jsx

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const gradientStyle = {
  background: 'linear-gradient(to right, #11E0FC, #0099FF)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

function InstallHeader() {
  return (
    <header className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg shadow">
      <div className="flex items-end justify-between gap-4 min-w-0">
        <div className="shrink-0 flex items-center gap-3 self-end pb-0.5">
          <Image
            src="/STOCK_BUDDY_LOGO__1_.png"
            alt="Stock Buddy logo"
            width={88}
            height={88}
            className="h-16 w-auto object-contain"
          />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-semibold" style={gradientStyle}>Stock Buddy</h1>
              <span className="text-xs text-gray-400">v1.0</span>
            </div>
            <p className="text-xs mt-0.5" style={gradientStyle}>
              Inventory Management for the Modern Age
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end justify-end pb-0.5 gap-1">
          <h2 className="text-lg font-semibold text-white tracking-wide">Request Access Form</h2>
          <span className="text-xs text-gray-400">A Buddy System app by Brandon Gillon</span>
        </div>
      </div>
    </header>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, color = 'blue', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const bg = color === 'red' ? 'bg-red-600' : 'bg-blue-600';

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${bg}`}>
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-1 opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>
    </div>
  );
}

// ── Success Modal ─────────────────────────────────────────────────────────────

function SuccessModal({ email, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Request Submitted!</h2>
        <p className="text-sm text-gray-600 mb-6">
          Thanks for your interest in Stock Buddy. We'll review your application and send a response to{' '}
          <strong>{email}</strong> indicating whether your request has been approved or rejected.
        </p>
        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INVENTORY_METHOD_OPTIONS = [
  'Shopify only',
  'Spreadsheets (Excel / Google Sheets)',
  'A separate inventory management app',
  'Manual / pen and paper',
  'ERP or warehouse management system',
  'Other',
];

const INITIAL_FORM = {
  store_url: '',
  contact_name: '',
  contact_email: '',
  company_size: '',
  monthly_order_volume: '',
  num_skus_variants: '',
  current_inventory_methods: [],
  how_send_pos_to_suppliers: '',
  how_create_pos_today: '',
  biggest_challenge: '',
  why_interested: '',
  willing_to_provide_feedback: '',
  open_to_onboarding_calls: '',
  how_soon_to_start: '',
  how_soon_to_start_option: '',
  anything_else: '',
  understands_private_beta: false,
  agrees_no_share_link: false,
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function Label({ children, required }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function inputCls() {
  return 'w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50';
}

function selectCls() {
  return 'w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50';
}

function textareaCls() {
  return 'w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50';
}

function Card({ children }) {
  return (
    <div className="w-full bg-white border border-gray-200 rounded-xl shadow-sm p-8">
      {children}
    </div>
  );
}

function CardTitle({ children }) {
  return (
    <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide pb-2 border-b border-gray-200 mb-5">
      {children}
    </h3>
  );
}

function isFormComplete(form) {
  return Boolean(
    form.store_url.trim() &&
    form.contact_name.trim() &&
    form.contact_email.trim() &&
    form.company_size &&
    form.monthly_order_volume &&
    form.num_skus_variants &&
    form.current_inventory_methods.length > 0 &&
    form.how_send_pos_to_suppliers.trim() &&
    form.how_create_pos_today.trim() &&
    form.biggest_challenge.trim() &&
    form.why_interested.trim() &&
    form.willing_to_provide_feedback !== '' &&
    form.open_to_onboarding_calls !== '' &&
    form.how_soon_to_start_option &&
    (form.how_soon_to_start_option !== 'Custom' || form.how_soon_to_start) &&
    form.understands_private_beta &&
    form.agrees_no_share_link
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RequestAccessForm() {
  const router = useRouter();
  const [form, setForm]               = useState(INITIAL_FORM);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [toast, setToast]             = useState(null);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function toggleMethod(method) {
    setForm(f => {
      const current = f.current_inventory_methods;
      return {
        ...f,
        current_inventory_methods: current.includes(method)
          ? current.filter(m => m !== method)
          : [...current, method],
      };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.understands_private_beta || !form.agrees_no_share_link) {
      setError('You must check both required acknowledgement boxes to submit.');
      return;
    }

    setSubmitting(true);
    try {
      // eslint-disable-next-line no-unused-vars
      const { how_soon_to_start_option, ...payload } = form;
      const res = await fetch('/api/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Submission failed.');

      if (data.duplicate) {
        setToast({ message: 'A request for this Shopify store has already been submitted.', color: 'blue' });
        return;
      }

      setShowSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !submitting && isFormComplete(form);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      <div className="px-4 pt-4 max-w-6xl mx-auto w-full">
        <InstallHeader />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="px-4 py-8 max-w-6xl mx-auto w-full flex flex-col gap-6">

          {/* ── Card 1: Contact Info ───────────────────────────── */}
          <Card>
            <CardTitle>Contact Info</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <Label required>Shopify Store URL</Label>
                <input className={inputCls()} type="text" placeholder="my-store.myshopify.com" value={form.store_url} onChange={e => set('store_url', e.target.value)} disabled={submitting} />
              </div>
              <div>
                <Label required>Contact Name</Label>
                <input className={inputCls()} type="text" placeholder="Jane Smith" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} disabled={submitting} />
              </div>
              <div>
                <Label required>Contact Email</Label>
                <input className={inputCls()} type="email" placeholder="jane@mystore.com" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} disabled={submitting} />
              </div>
            </div>
          </Card>

          {/* ── Card 2: Business Profile ───────────────────────── */}
          <Card>
            <CardTitle>Business Profile</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              <div>
                <Label required>Company Size</Label>
                <select className={selectCls()} value={form.company_size} onChange={e => set('company_size', e.target.value)} disabled={submitting}>
                  <option value="">Select…</option>
                  <option>Just me</option>
                  <option>2–5 employees</option>
                  <option>6–20 employees</option>
                  <option>21–100 employees</option>
                  <option>100+ employees</option>
                </select>
              </div>

              <div>
                <Label required>Monthly Order Volume</Label>
                <select className={selectCls()} value={form.monthly_order_volume} onChange={e => set('monthly_order_volume', e.target.value)} disabled={submitting}>
                  <option value="">Select…</option>
                  <option>Under 100 orders/month</option>
                  <option>100–500 orders/month</option>
                  <option>500–2,000 orders/month</option>
                  <option>2,000–10,000 orders/month</option>
                  <option>10,000+ orders/month</option>
                </select>
              </div>

              <div>
                <Label required>Number of SKUs / Variants</Label>
                <select className={selectCls()} value={form.num_skus_variants} onChange={e => set('num_skus_variants', e.target.value)} disabled={submitting}>
                  <option value="">Select…</option>
                  <option>Under 100</option>
                  <option>100–500</option>
                  <option>500–2,000</option>
                  <option>2,000–10,000</option>
                  <option>10,000+</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <Label required>Current Inventory Management Method</Label>
                <p className="text-xs text-gray-500 mb-2">Select all that apply.</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {INVENTORY_METHOD_OPTIONS.map(method => (
                    <label key={method} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.current_inventory_methods.includes(method)}
                        onChange={() => toggleMethod(method)}
                        disabled={submitting}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">{method}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label required>How do you send Purchase Orders to your suppliers today?</Label>
                <textarea className={textareaCls()} rows={4} placeholder="e.g. email, fax, supplier portal, EDI…" value={form.how_send_pos_to_suppliers} onChange={e => set('how_send_pos_to_suppliers', e.target.value)} disabled={submitting} />
              </div>

            </div>
          </Card>

          {/* ── Card 3: Current Process ────────────────────────── */}
          <Card>
            <CardTitle>Current Process</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <Label required>How do you create purchase orders today?</Label>
                <textarea className={textareaCls()} rows={4} placeholder="e.g. manually in Excel, emailing suppliers directly, using a separate app…" value={form.how_create_pos_today} onChange={e => set('how_create_pos_today', e.target.value)} disabled={submitting} />
              </div>
              <div>
                <Label required>What is your biggest inventory or purchasing challenge?</Label>
                <textarea className={textareaCls()} rows={4} placeholder="e.g. tracking what's on order, reconciling received goods, stock-outs…" value={form.biggest_challenge} onChange={e => set('biggest_challenge', e.target.value)} disabled={submitting} />
              </div>
              <div>
                <Label required>Why are you interested in Stock Buddy?</Label>
                <textarea className={textareaCls()} rows={4} placeholder="What problem are you hoping it solves for you?" value={form.why_interested} onChange={e => set('why_interested', e.target.value)} disabled={submitting} />
              </div>
            </div>
          </Card>

          {/* ── Card 4: Beta Participation + Acknowledgements ─── */}
          <Card>
            <CardTitle>Beta Participation</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              <div>
                <Label required>Are you willing to provide feedback during the beta?</Label>
                <div className="flex gap-4 mt-2">
                  {['yes', 'no'].map(v => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="willing_to_provide_feedback" value={v} checked={form.willing_to_provide_feedback === v} onChange={() => set('willing_to_provide_feedback', v)} disabled={submitting} className="h-4 w-4 border-gray-300 text-blue-600" />
                      <span className="text-sm text-gray-700 capitalize">{v}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label required>Are you open to onboarding calls or periodic check-ins?</Label>
                <div className="flex gap-4 mt-2">
                  {['yes', 'no'].map(v => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="open_to_onboarding_calls" value={v} checked={form.open_to_onboarding_calls === v} onChange={() => set('open_to_onboarding_calls', v)} disabled={submitting} className="h-4 w-4 border-gray-300 text-blue-600" />
                      <span className="text-sm text-gray-700 capitalize">{v}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label required>When do you expect to start?</Label>
                <div className="flex flex-col gap-2 mt-2">
                  {['Immediately', 'Next Week', "I'm not sure"].map(v => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="how_soon_to_start"
                        value={v}
                        checked={form.how_soon_to_start_option === v}
                        onChange={() => {
                          set('how_soon_to_start_option', v);
                          set('how_soon_to_start', v);
                        }}
                        disabled={submitting}
                        className="h-4 w-4 border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">{v}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="how_soon_to_start"
                      value="Custom"
                      checked={form.how_soon_to_start_option === 'Custom'}
                      onChange={() => {
                        set('how_soon_to_start_option', 'Custom');
                        set('how_soon_to_start', '');
                      }}
                      disabled={submitting}
                      className="h-4 w-4 border-gray-300 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Custom</span>
                    <input
                      type="date"
                      disabled={submitting || form.how_soon_to_start_option !== 'Custom'}
                      value={form.how_soon_to_start_option === 'Custom' ? form.how_soon_to_start : ''}
                      onChange={e => set('how_soon_to_start', e.target.value)}
                      className={`ml-1 px-2 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-opacity ${
                        form.how_soon_to_start_option === 'Custom'
                          ? 'border-gray-300 opacity-100'
                          : 'border-gray-200 opacity-40 pointer-events-none'
                      }`}
                    />
                  </label>
                </div>
              </div>

              <div className="md:col-span-3">
                <Label>Anything else we should know? (optional)</Label>
                <textarea className={textareaCls()} rows={3} placeholder="Anything else that might help us evaluate your application…" value={form.anything_else} onChange={e => set('anything_else', e.target.value)} disabled={submitting} />
              </div>

            </div>

            {/* Acknowledgements */}
            <div className="mt-6 pt-5 border-t border-gray-200">
              <p className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-4">Acknowledgements</p>
              <div className="space-y-3 mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.understands_private_beta}
                    onChange={e => set('understands_private_beta', e.target.checked)}
                    disabled={submitting}
                    className="h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600 shrink-0"
                  />
                  <span className="text-sm text-gray-700">
                    <strong>Required:</strong> I understand this is a private beta and approval is not guaranteed.
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.agrees_no_share_link}
                    onChange={e => set('agrees_no_share_link', e.target.checked)}
                    disabled={submitting}
                    className="h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600 shrink-0"
                  />
                  <span className="text-sm text-gray-700">
                    <strong>Required:</strong> I agree not to share the install link with anyone outside my organization.
                  </span>
                </label>
              </div>

              {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/request-access')}
                  disabled={submitting}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-md transition-colors"
                >
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </div>

          </Card>

        </div>
      </form>

      {showSuccess && (
        <SuccessModal
          email={form.contact_email}
          onClose={() => router.push('/request-access')}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          color={toast.color}
          onDismiss={() => setToast(null)}
        />
      )}

    </div>
  );
}
