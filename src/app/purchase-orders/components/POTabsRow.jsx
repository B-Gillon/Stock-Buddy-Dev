'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const TABS = [
  { label: 'All Open',           value: ''                   },
  { label: 'Drafts',             value: 'draft'              },
  { label: 'Released',           value: 'released'           },
  { label: 'Partially Received', value: 'partially_received' },
  { label: 'Overdue',            value: 'overdue'            },
  { label: 'Cancelled',          value: 'cancelled'          },
];

export default function POTabsRow({ currentStatus }) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  function handleTab(value) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) { params.set('status', value); } else { params.delete('status'); }
    params.delete('page');
    router.push(`/purchase-orders?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 border-b border-gray-200 -mb-px">
      {TABS.map((tab) => {
        const isActive = (currentStatus ?? '') === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleTab(tab.value)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              isActive
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
