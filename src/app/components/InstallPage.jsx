"use client";

// src/app/components/InstallPage.jsx
// Shown when the app is accessed outside of Shopify Admin.
// Collects the merchant's myshopify.com domain and kicks off OAuth.

import { useState } from "react";
import Image from "next/image";

const gradientStyle = {
  background: "linear-gradient(to right, #11E0FC, #0099FF)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

function InstallHeader() {
  return (
    <header className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg shadow">
      <div className="flex items-end justify-between gap-4 min-w-0">
        {/* Left: logo + brand */}
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
        {/* Right: tagline */}
        <div className="flex flex-col items-end justify-end pb-0.5">
          <span className="text-xs text-gray-400">A Buddy System app by Brandon Gillon</span>
        </div>
      </div>
    </header>
  );
}

export default function InstallPage() {
  const [shop, setShop]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  function validate(value) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;
    const domain = trimmed.includes(".myshopify.com")
      ? trimmed
      : `${trimmed}.myshopify.com`;
    const valid = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(domain);
    return valid ? domain : null;
  }

  function handleInstall(e) {
    e.preventDefault();
    setError("");
    const domain = validate(shop);
    if (!domain) {
      setError("Please enter a valid Shopify store domain (e.g. my-store.myshopify.com)");
      return;
    }
    setLoading(true);
    window.location.href = `/api/shopify/install?shop=${domain}`;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <div className="px-4 pt-4 max-w-6xl mx-auto w-full">
        <InstallHeader />
      </div>

      {/* Centered install card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl bg-white border border-gray-200 rounded-xl shadow-sm p-10">

          {/* Card header: logo + title side by side */}
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

          {/* Form */}
          <form onSubmit={handleInstall} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Shopify store domain
              </label>
              <input
                type="text"
                placeholder="my-store.myshopify.com"
                value={shop}
                onChange={(e) => { setShop(e.target.value); setError(""); }}
                autoComplete="off"
                spellCheck={false}
                disabled={loading}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !shop.trim()}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-md transition-colors"
            >
              {loading ? "Redirecting to Shopify…" : "Install Stock Buddy →"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            You'll be redirected to Shopify to approve the installation.
          </p>
        </div>
      </div>

    </div>
  );
}
