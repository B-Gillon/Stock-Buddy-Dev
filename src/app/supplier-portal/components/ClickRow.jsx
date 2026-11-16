'use client';
// A table row that opens a page when clicked anywhere (links inside still work)
import { useRouter } from 'next/navigation';

export default function ClickRow({ href, className = '', children }) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => { if (!e.target.closest('a,button')) router.push(href); }}
      className={`cursor-pointer hover:bg-gray-50 ${className}`}
    >
      {children}
    </tr>
  );
}
