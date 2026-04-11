"use client";

// src/app/mobile/components/MobileDashboard.jsx
// Mobile home screen. Large tap targets for primary workflows.

import { useRouter } from "next/navigation";

const actions = [
  {
    label: "Receive a PO",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: "32px", height: "32px" }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
    href: "/mobile/pos",
    available: true,
  },
  {
    label: "Cycle Count",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: "32px", height: "32px" }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
      </svg>
    ),
    href: "/mobile/cycle-count",
    available: false,
  },
  {
    label: "Lookup Item",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: "32px", height: "32px" }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0Z" />
      </svg>
    ),
    href: "/mobile/lookup",
    available: false,
  },
  {
    label: "Adjust Inventory",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: "32px", height: "32px" }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
      </svg>
    ),
    href: "/mobile/adjust",
    available: false,
  },
];

export default function MobileDashboard() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#e5e7eb" }}>

      {/* Header — floating dark card at top */}
      <div className="px-4 pt-5">
        <div style={{ backgroundColor: "#1f2937", borderRadius: "16px" }} className="text-white px-5 py-4 flex items-center gap-3">
          <img
            src="/STOCK_BUDDY_LOGO__1_.png"
            alt="Stock Buddy logo"
            style={{ height: "56px", width: "auto", objectFit: "contain" }}
          />
          <div className="flex items-end gap-2 ml-3">
            <h1
              className="text-2xl font-semibold"
              style={{
                background: "linear-gradient(to right, #11E0FC, #0099FF)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Stock Buddy
            </h1>
            <span className="text-xs text-gray-400 pb-0.5">v1.0</span>
          </div>
        </div>
      </div>

      {/* Action list */}
      <div className="flex-1 px-4 py-6 flex flex-col gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => {
              if (action.available) router.push(action.href);
            }}
            className={`
              relative w-full text-left
              transition-all duration-150
              ${action.available
                ? "flex items-center gap-4 active:scale-95 active:brightness-90"
                : "flex items-end gap-4 cursor-not-allowed"
              }
            `}
            style={{
              backgroundColor: "#4b5563",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "16px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              padding: "20px 20px",
              minHeight: "80px",
            }}
          >
            {/* Coming Soon pill — absolute top right */}
            {!action.available && (
              <span
                className="absolute font-bold text-black"
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "999px",
                  fontSize: "10px",
                  padding: "5px 10px",
                  letterSpacing: "0.05em",
                  top: "14px",
                  right: "14px",
                }}
              >
                COMING SOON
              </span>
            )}

            {/* Icon */}
            <div
              className="flex-shrink-0 flex items-center justify-center"
              style={{
                color: "#00BFFF",
                backgroundColor: "rgba(255,255,255,0.07)",
                borderRadius: "12px",
                width: "52px",
                height: "52px",
              }}
            >
              {action.icon}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold" style={{ fontSize: "26px" }}>
                {action.label}
              </p>
            </div>

            {/* Chevron for available actions */}
            {action.available && (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                className="text-gray-300 flex-shrink-0" style={{ width: "18px", height: "18px" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 pb-10 text-center">
        <p className="text-xs text-gray-600">Stock Buddy · Mobile</p>
      </div>

    </div>
  );
}
