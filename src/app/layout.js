import "./globals.css";

export const metadata = {
  title: "Stock Buddy",
  description: "Inventory and product management for Shopify",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-100">
        <div id="app-root" className="min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}