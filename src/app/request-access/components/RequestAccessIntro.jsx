"use client";

// src/app/request-access/components/RequestAccessIntro.jsx

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
    items: ['Assign suppliers', 'Set case packs', 'Set MOQs & lead times', 'Configure workflows'],
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
        <div className="flex flex-col items-end justify-end pb-0.5">
          <span className="text-xs text-gray-400">A Buddy System app by Brandon Gillon</span>
        </div>
      </div>
    </header>
  );
}

export default function RequestAccessIntro() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      <div className="w-full max-w-6xl mx-auto px-4 pt-4">
        <InstallHeader />
      </div>

      <div className="flex-1 flex items-center justify-center py-6">
        <div className="w-full max-w-6xl px-4 flex flex-col lg:flex-row gap-6 items-stretch">

          {/* ── Left card ───────────────────────────────────────── */}
          <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm px-10 pt-5 pb-5 flex flex-col">
            <div className="space-y-4 text-sm text-gray-700 flex-1">
              <p>
                <strong className="text-gray-900">Stock Buddy</strong> is a Shopify-embedded inventory and purchase order management app built for merchants who need more than Shopify's built-in tools. It lets you create and manage purchase orders, track incoming inventory, sync stock levels to Shopify in real time, and coordinate with suppliers — all from inside your Shopify Admin.
              </p>
              <p>
                Stock Buddy is designed for <strong className="text-gray-900">independent Shopify merchants</strong> who manage physical inventory, work with one or more suppliers, and need a structured process for purchasing and receiving goods.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-amber-800 font-medium text-sm">Private Beta — Limited Access</p>
                <p className="text-amber-700 text-sm mt-1">
                  Stock Buddy is currently in private beta. Access is limited and granted on a case-by-case basis. Submitting a request does not guarantee approval. If approved, you will receive an install link directly.
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => router.push('/request-access/form')}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition-colors"
              >
                Request Access
              </button>
              <a
                href="mailto:hello@brandongillon.com"
                className="flex-1 py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-md border border-gray-300 transition-colors text-center"
              >
                Have Questions?
              </a>
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

    </div>
  );
}
