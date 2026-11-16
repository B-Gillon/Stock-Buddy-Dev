// Shared frame for the public sign-in pages: Stock Buddy header bar plus a centered card.
const gradientStyle = {
  background: 'linear-gradient(to right, #11E0FC, #0099FF)',
  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
};

export default function AuthShell({ title, children }) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-4">
        <header className="flex items-center gap-3 rounded-lg bg-gray-800 px-4 py-3 shadow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/STOCK_BUDDY_LOGO__1_.png" alt="Stock Buddy logo" className="h-14 w-auto object-contain" />
          <div>
            <p className="text-2xl font-semibold" style={gradientStyle}>Stock Buddy</p>
            <p className="mt-0.5 text-xs" style={gradientStyle}>Inventory Management for the Modern Age</p>
          </div>
        </header>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h1 className="mb-4 text-lg font-semibold text-gray-900">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}

export const inputClass = 'mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm';
export const buttonClass = 'w-full rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60';
