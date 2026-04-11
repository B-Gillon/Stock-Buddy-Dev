"use client";

// /src/shared/components/layout/Header.jsx

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";


const NAV_ITEMS = [
  { label: "Inventory",       href: "/inventory"       },
  { label: "Locations",       href: "/locations"       },
  { label: "Suppliers",       href: "/suppliers"       },
  { label: "Vendors",         href: "/vendors"         },
  { label: "Purchase Orders", href: "/purchase-orders" },
];

const PRODUCTS_DROPDOWN = [
  { label: "All Products",          href: "/products" },
  { label: "Supplier Product Data", href: "/products/supplier-variant-data" },
  { label: "Location Product Data", href: "/products/location-variant-data" },
];

const gradientStyle = {
  background: "linear-gradient(to right, #11E0FC, #0099FF)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

function ProductsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const pathname = usePathname();

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isProductsActive = pathname?.startsWith("/products");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md transition ${
          isProductsActive
            ? "text-white bg-white/20"
            : "text-gray-200 hover:text-white hover:bg-white/10"
        }`}
      >
        Products
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 overflow-hidden">
          {PRODUCTS_DROPDOWN.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2 text-sm transition ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Header({
  pageName,
  syncLabel,
  onSync,
  syncing,
  lastSyncedAt,
  formatTimestamp,
}) {
  const pathname = usePathname();

  return (
    <header className="w-full bg-gray-800 text-white px-6 rounded-lg shadow" style={{ height: "88px" }}>
      <div className="h-full flex items-center justify-between gap-6">

        {/* Left: Mascot + Brand */}
        <Link href="/dashboard" className="shrink-0 flex items-center gap-3 hover:opacity-90 transition-opacity">
          <Image
            src="/STOCK_BUDDY_LOGO__1_.png"
            alt="Stock Buddy logo"
            width={88}
            height={88}
            className="h-16 w-auto object-contain"
          />
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-semibold" style={gradientStyle}>Stock Buddy</h1>
              <span className="text-xs text-gray-400">v1.0</span>
            </div>
            <p className="text-xs mt-0.5" style={gradientStyle}>
              Inventory Management for the Modern Age
            </p>
          </div>
        </Link>

        {/* Right: sync row + nav */}
        <div className="shrink-0 flex flex-col items-end justify-center gap-1.5 h-full">

          {/* Sync row — always occupies space to keep nav position stable */}
          <div className="flex items-center gap-3 h-7">
            {onSync && (
              <>
                <span className="text-xs text-gray-400">
                  {lastSyncedAt
                    ? `Last Sync: ${formatTimestamp(lastSyncedAt)}`
                    : "Last Sync: —"}
                </span>
                <button
                  onClick={onSync}
                  disabled={syncing}
                  className={`px-4 py-1 rounded-md text-sm font-medium transition ${
                    syncing ? "bg-gray-600 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {syncing ? "Syncing..." : syncLabel}
                </button>
              </>
            )}
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            <ProductsDropdown />

            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                    isActive
                      ? "text-white bg-white/20"
                      : "text-gray-200 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <Link
              href="/settings"
              className="ml-1 p-1.5 text-gray-200 hover:text-white hover:bg-white/10 rounded-md transition"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </nav>
        </div>

      </div>
    </header>
  );
}
