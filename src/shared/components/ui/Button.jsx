"use client";

/**
 * Button
 *
 * Props:
 *   variant  — "primary" | "secondary" | "danger"  (default: "primary")
 *   size     — "sm" | "md"                          (default: "md")
 *   onClick  — click handler
 *   href     — if provided, renders as a router.push call wrapped in a button
 *   disabled — boolean
 *   children — label
 *   type     — button type (default: "button")
 */

const variants = {
  primary:   "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40",
  secondary: "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40",
  danger:    "bg-red-600 text-white hover:bg-red-700 disabled:opacity-40",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  onClick,
  href,
  disabled = false,
  children,
  type = "button",
}) {
  const cls = [
    "inline-flex items-center justify-center rounded-lg font-medium transition",
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
    "disabled:cursor-not-allowed",
    variants[variant] ?? variants.primary,
    sizes[size] ?? sizes.md,
  ].join(" ");

  const handleClick = href
    ? (e) => { e.preventDefault(); window.location.href = href; }
    : onClick;

  return (
    <button type={type} className={cls} onClick={handleClick} disabled={disabled}>
      {children}
    </button>
  );
}
