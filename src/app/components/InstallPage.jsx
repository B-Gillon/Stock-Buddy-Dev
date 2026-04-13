"use client";

// src/app/components/InstallPage.jsx
// Shown when the app is accessed outside of Shopify Admin.
// Collects the merchant's myshopify.com domain and kicks off OAuth.

import { useState } from "react";

export default function InstallPage() {
  const [shop, setShop]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  function validate(value) {
    const trimmed = value.trim().toLowerCase();
    // Accept either "store" or "store.myshopify.com"
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
    <div style={{
      minHeight: "100vh",
      background: "#0f1117",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
      padding: "24px",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse-ring {
          0%   { transform: scale(0.95); opacity: 0.6; }
          50%  { transform: scale(1.05); opacity: 0.2; }
          100% { transform: scale(0.95); opacity: 0.6; }
        }

        .install-input {
          width: 100%;
          background: rgba(255,255,255,0.06);
          border: 1.5px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: 14px 16px;
          color: #fff;
          font-size: 15px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
          box-sizing: border-box;
        }

        .install-input::placeholder { color: rgba(255,255,255,0.3); }

        .install-input:focus {
          border-color: #11E0FC;
          background: rgba(17, 224, 252, 0.06);
        }

        .install-btn {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          background: linear-gradient(135deg, #11E0FC, #0099FF);
          color: #0f1117;
          transition: opacity 0.2s, transform 0.15s;
          letter-spacing: 0.01em;
        }

        .install-btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .install-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .card {
          animation: fadeUp 0.6s ease both;
        }

        .logo-wrap {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>

      {/* Background glow */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "600px",
        height: "600px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(17,224,252,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Card */}
      <div className="card" style={{
        width: "100%",
        maxWidth: "420px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: "20px",
        padding: "48px 40px",
        backdropFilter: "blur(12px)",
        position: "relative",
        zIndex: 1,
      }}>

        {/* Logo */}
        <div className="logo-wrap" style={{ textAlign: "center", marginBottom: "32px" }}>
          <img
            src="/STOCK_BUDDY_LOGO__1_.png"
            alt="Stock Buddy"
            style={{ height: "80px", width: "auto", objectFit: "contain" }}
          />
        </div>

        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: "28px",
            fontWeight: "800",
            color: "#fff",
            margin: "0 0 8px 0",
            background: "linear-gradient(to right, #11E0FC, #0099FF)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Stock Buddy
          </h1>
          <p style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: "14px",
            margin: 0,
            lineHeight: 1.5,
          }}>
            Inventory & purchase order management<br />for Shopify merchants
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleInstall}>
          <div style={{ marginBottom: "12px" }}>
            <label style={{
              display: "block",
              color: "rgba(255,255,255,0.6)",
              fontSize: "13px",
              fontWeight: "500",
              marginBottom: "8px",
              letterSpacing: "0.02em",
            }}>
              YOUR SHOPIFY STORE DOMAIN
            </label>
            <input
              className="install-input"
              type="text"
              placeholder="my-store.myshopify.com"
              value={shop}
              onChange={(e) => { setShop(e.target.value); setError(""); }}
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />
          </div>

          {error && (
            <p style={{
              color: "#FC6D6D",
              fontSize: "13px",
              margin: "0 0 12px 0",
              lineHeight: 1.4,
            }}>
              {error}
            </p>
          )}

          <div style={{ marginTop: "20px" }}>
            <button
              className="install-btn"
              type="submit"
              disabled={loading || !shop.trim()}
            >
              {loading ? "Redirecting to Shopify..." : "Install Stock Buddy →"}
            </button>
          </div>
        </form>

        {/* Footer note */}
        <p style={{
          textAlign: "center",
          color: "rgba(255,255,255,0.25)",
          fontSize: "12px",
          marginTop: "24px",
          marginBottom: 0,
          lineHeight: 1.5,
        }}>
          You'll be redirected to Shopify to approve the installation.
        </p>
      </div>

      {/* Bottom brand */}
      <p style={{
        marginTop: "32px",
        color: "rgba(255,255,255,0.2)",
        fontSize: "12px",
        fontFamily: "'DM Sans', sans-serif",
        zIndex: 1,
      }}>
        A Buddy System app by Brandon Gillon
      </p>
    </div>
  );
}
