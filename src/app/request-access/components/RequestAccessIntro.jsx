"use client";

// src/app/request-access/components/RequestAccessIntro.jsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const gradientStyle = {
  background: 'linear-gradient(to right, #11E0FC, #0099FF)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const MINI_CARDS = [
  {
    title: 'Setup',
    icon: '⚙️',
    items: [
      'Easy migration from Stocky',
      'Assign suppliers',
      'Set case packs',
      'Set MOQs & lead times',
      'Configure workflows',
    ],
  },
  {
    title: 'Purchase Orders',
    icon: '📋',
    items: ['Create POs in Shopify', 'Manage & update POs', 'Export CSV/PDF', 'Track arrival dates'],
  },
  {
    title: 'Receiving',
    icon: '📦',
    items: ['Record received items', 'Track in-transit qty', 'Update stock on receipt', 'Reconcile PO totals'],
  },
  {
    title: 'Inventory',
    icon: '📊',
    items: ['Sync stock in real time', 'Monitor incoming stock', 'View supplier activity', 'Centralize purchasing'],
  },
];

// ── Contact Modal ─────────────────────────────────────────────────────────────

function ContactModal({ onClose }) {
  const [form, setForm]             = useState({ name: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const [submitted, setSubmitted]   = useState(false);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed.');
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Ask a Question</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {submitted ? (
          <div className="px-6 py-8 text-center">
            <div className="text-3xl mb-3">✅</div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Message sent!</p>
            <p className="text-sm text-gray-500">We'll get back to you at {form.email}.</p>
            <button onClick={onClose} className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                disabled={submitting}
                required
                placeholder="Jane Smith"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                disabled={submitting}
                required
                placeholder="jane@mystore.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message <span className="text-red-500">*</span></label>
              <textarea
                value={form.message}
                onChange={e => set('message', e.target.value)}
                disabled={submitting}
                required
                rows={4}
                placeholder="What would you like to know?"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !form.name.trim() || !form.email.trim() || !form.message.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors"
              >
                {submitting ? 'Sending…' : 'Send Message'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

// ── Stocky Migration Bar ──────────────────────────────────────────────────────

function MigrationBar({ onJoinBeta }) {
  return (
    <div
      className="w-full text-white text-sm font-medium text-center px-4 py-2.5"
      style={{ backgroundColor: '#2563eb' }}
    >
      ⚡ Planning your Stocky migration?{' '}
      <span className="font-semibold">Stock Buddy is your drop-in replacement.</span>{' '}
      <button
        onClick={onJoinBeta}
        className="underline underline-offset-2 font-bold hover:opacity-80 transition-opacity"
      >
        Apply for the Beta →
      </button>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

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
            <p className="text-xs mt-0.5 text-gray-300">
              The reliable inventory and PO replacement for Shopify merchants.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end justify-end pb-0.5">
          <span className="text-xs text-gray-400">A Buddy System app by Brandon Gillon</span>
        </div>
      </div>
    </header>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function RequestAccessIntro() {
  const router = useRouter();
  const [showContact, setShowContact] = useState(false);

  function goToForm() {
    router.push('/request-access/form');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Migration bar — flush to very top, full width */}
      <MigrationBar onJoinBeta={goToForm} />

      <div className="w-full max-w-6xl mx-auto px-4 pt-4">
        <InstallHeader />
      </div>

      <div className="flex-1 flex items-start justify-center pt-3 pb-6">
        <div className="w-full max-w-6xl px-4 flex flex-col lg:flex-row gap-6 items-stretch">

          {/* ── Left card ───────────────────────────────────────── */}
          <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm px-10 pt-5 pb-5 flex flex-col">
            <div className="space-y-4 text-sm text-gray-700 flex-1">
              <p>
                <strong className="text-gray-900">Stock Buddy</strong> is a Shopify-embedded inventory and purchase order management app built for merchants who need more than Shopify's built-in tools. It lets you create and manage <strong className="text-gray-900">Purchase Orders</strong>, track incoming inventory through <strong className="text-gray-900">Receiving</strong>, perform <strong className="text-gray-900">Reconciliation</strong> against what was ordered, sync stock levels to Shopify in real time, and coordinate with suppliers — all within Shopify Admin.
              </p>
              <p>
                Stock Buddy is designed for <strong className="text-gray-900">independent Shopify merchants</strong> who manage physical inventory, work with one or more suppliers, and need a structured process for purchasing and receiving goods.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-amber-800 font-medium text-sm">Private Beta — Limited Access</p>
                <p className="text-amber-700 text-sm mt-1">
                  Stock Buddy is currently in private beta. We are onboarding a limited group of merchants to ensure the tool perfectly fits your specific inventory workflow. If approved, you'll receive an invite link directly.
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={goToForm}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition-colors"
              >
                Join the Beta
              </button>
              <button
                onClick={() => setShowContact(true)}
                className="flex-1 py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-md border border-gray-300 transition-colors"
              >
                Ask a Question
              </button>
            </div>
          </div>

          {/* ── Right side — 2x2 mini cards ─────────────────────── */}
          <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4">
            {MINI_CARDS.map((card) => (
              <div key={card.title} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">{card.icon}</span>
                  <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
                </div>
                <ul className="space-y-1.5">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

        </div>
      </div>

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}

    </div>
  );
}
