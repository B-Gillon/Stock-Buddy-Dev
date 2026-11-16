'use client';
// Black header (logo + links, same look as the retailer header) shared by every supplier page
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOutButton from '@/app/components/SignOutButton';

const gradientStyle = {
  background: 'linear-gradient(to right, #11E0FC, #0099FF)',
  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
};
const TABS = [
  { key: 'dashboard', href: '/supplier-portal', label: 'Dashboard', exact: true },
  { key: 'orders', href: '/supplier-portal/orders', label: 'New POs' },
  { key: 'shipping', href: '/supplier-portal/shipping', label: 'Shipping' },
  { key: 'invoicing', href: '/supplier-portal/invoicing', label: 'Invoicing' },
  { key: 'inventory', href: '/supplier-portal/inventory', label: 'Inventory' },
  { key: 'settings', href: '/supplier-portal/settings', label: 'Settings' },
];

export default function PortalFrame({ supplierName, email, active: activeKey, children }) {
  const pathname = usePathname();
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <header className="w-full rounded-lg bg-gray-800 px-4 py-3 text-white shadow">
          <div className="flex min-w-0 items-end justify-between gap-4">
            <Link href="/supplier-portal" className="flex shrink-0 items-center gap-3 self-end pb-0.5 hover:opacity-90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/STOCK_BUDDY_LOGO__1_.png" alt="Stock Buddy logo" className="h-16 w-auto object-contain" />
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold" style={gradientStyle}>Stock Buddy</h1>
                <p className="mt-0.5 text-xs" style={gradientStyle}>Inventory Management for the Modern Age</p>
              </div>
            </Link>
            <div className="flex min-w-0 flex-col items-end justify-end gap-1.5">
              <span className="text-xs text-gray-400">{supplierName}{email ? ` · ${email}` : ''}</span>
              <nav className="flex items-center gap-0.5">
                {TABS.map((t) => {
                  const active = activeKey ? activeKey === t.key : t.exact ? pathname === t.href : pathname?.startsWith(t.href);
                  return (
                    <Link key={t.href} href={t.href}
                      className={`whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium transition ${active ? 'bg-white/20 text-white' : 'text-gray-200 hover:bg-white/10 hover:text-white'}`}>
                      {t.label}
                    </Link>
                  );
                })}
                <SignOutButton className="ml-2 rounded-md border border-white/30 px-2.5 py-1 text-xs text-gray-200 transition hover:bg-white/10" />
              </nav>
            </div>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
