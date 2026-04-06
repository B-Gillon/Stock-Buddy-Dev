/**
 * Card
 * White rounded bordered box.
 *
 * Props:
 *   title    — optional header string
 *   children
 *   className — extra classes on the outer div
 *   padding  — "sm" | "md" (default: "md")
 */

const paddings = {
  sm: "p-3",
  md: "p-4",
};

export default function Card({ title, children, className = "", padding = "md" }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${paddings[padding]} ${className}`}>
      {title && (
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
