'use client';

const STATUS_STYLES = {
  draft:     'bg-yellow-100 text-yellow-700 border-yellow-200',
  released:  'bg-green-100 text-green-700 border-green-200',
  held:      'bg-orange-100 text-orange-700 border-orange-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

export default function POStatusBadge({ status }) {
  const s = status?.toLowerCase() ?? 'draft';
  const style = STATUS_STYLES[s] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}
