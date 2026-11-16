// Header + button row shared by every supplier page
import Link from 'next/link';
import SignOutButton from '@/app/components/SignOutButton';

const gradientStyle = {
  background: 'linear-gradient(to right, #11E0FC, #0099FF)',
  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
};
const TABS = [
  { href: '/supplier-portal', label: 'Dashboard', key: 'dashboard' },
  { href: '/supplier-portal/orders', label: 'New POs', key: 'orders' },
  { href: '/supplier-portal/shipping', label: 'Shipping', key: 'shipping' },
  { href: '/supplier-portal/invoicing', label: 'Invoicing', key: 'invoicing' },
  { href: '/supplier-portal/inventory', label: 'Inventory', key: 'inventory' },
];

export default function PortalFrame({ active, supplierName, email, children }) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center gap-3 rounded-lg bg-gray-800 px-4 py-3 shadow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/STOCK_BUDDY_LOGO__1_.png" alt="Stock Buddy logo" className="h-12 w-auto object-contain" />
          <div className="mr-auto">
            <p className="text-xl font-semibold" style={gradientStyle}>Stock Buddy</p>
            <p className="text-xs text-gray-300">{supplierName}</p>
          </div>
          <span className="hidden text-xs text-gray-300 sm:inline">{email}</span>
          <SignOutButton className="rounded border border-gray-500 px-3 py-1.5 text-sm text-gray-100 hover:bg-gray-700" />
        </header>
        <nav className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link key={t.key} href={t.href}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${active === t.key ? 'bg-gray-900 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'}`}>
              {t.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </main>
  );
}
