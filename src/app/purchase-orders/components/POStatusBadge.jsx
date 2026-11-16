'use client';

const STATUS_STYLES = {
  draft:     'bg-yellow-100 text-yellow-700 border-yellow-200',
  pending_acknowledgement: 'bg-purple-100 text-purple-700 border-purple-200',
  waiting_to_ship:         'bg-blue-100 text-blue-700 border-blue-200',
  partially_shipped:       'bg-sky-100 text-sky-700 border-sky-200',
  shipped:                 'bg-teal-100 text-teal-700 border-teal-200',
  held:      'bg-orange-100 text-orange-700 border-orange-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

export default function POStatusBadge({ status }) {
  const s = status?.toLowerCase() ?? 'draft';
  const style = STATUS_STYLES[s] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
    </span>
  );
}
