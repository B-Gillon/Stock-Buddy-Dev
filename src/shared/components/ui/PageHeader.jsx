"use client";

/**
 * PageHeader
 * Consistent page header with back link, title, optional badge, and actions slot.
 *
 * Props:
 *   backHref  — href for the back button
 *   backLabel — label for back button (default: "Back")
 *   title     — page title string
 *   badge     — optional ReactNode (e.g. <Badge status="released" />)
 *   actions   — optional ReactNode (buttons rendered on the right)
 */
export default function PageHeader({ backHref, backLabel = "Back", title, badge, actions }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <a
          href={backHref}
          className="flex items-center gap-1 px-2 py-1 rounded border border-gray-300 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition"
        >
          ←
        </a>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {badge && badge}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
