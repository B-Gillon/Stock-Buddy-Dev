// src/app/mobile/layout.jsx
// Mobile shell layout — intentionally excludes desktop AppLayout and Header.
// All mobile routes inherit this layout.

export const metadata = {
  title: "Stock Buddy Mobile",
  description: "Stock Buddy mobile receiving and inventory tools",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function MobileLayout({ children }) {
  return (
    <div className="mobile-shell">
      {children}
    </div>
  );
}