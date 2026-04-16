"use client";

// src/app/request-access/components/RequestAccessIntro.jsx
// Page 1 of the request-access flow.
// Describes Stock Buddy and the private beta, then routes to the form.

import { useRouter } from 'next/navigation';
import Image from 'next/image';

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

      <div className="px-4 pt-4 max-w-6xl mx-auto w-full">
        <InstallHeader />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl bg-white border border-gray-200 rounded-xl shadow-sm p-10">

          {/* Card header */}
          <div className="flex items-center gap-5 mb-8">
            <Image
              src="/STOCK_BUDDY_LOGO__1_.png"
              alt="Stock Buddy"
              width={72}
              height={72}
              className="h-16 w-auto object-contain shrink-0"
            />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Stock Buddy</h2>
              <p className="text-sm text-gray-500 mt-1">
                Inventory &amp; purchase order management<br />for Shopify merchants
              </p>
            </div>
          </div>

          {/* Body copy */}
          <div className="space-y-4 text-sm text-gray-700 mb-8">
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

          <button
            onClick={() => router.push('/request-access/form')}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition-colors"
          >
            Request Access →
          </button>

        </div>
      </div>

    </div>
  );
}
