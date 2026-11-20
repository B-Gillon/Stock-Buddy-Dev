"use client";

import { useState, useCallback, useRef } from "react";

/**
 * Toast
 * Renders a fixed toast notification.
 *
 * Props:
 *   message — string (empty = hidden)
 *   type    — "success" | "error" | "info" | "warning"
 */
export function Toast({ message, type = "success" }) {
  if (!message) return null;
  const bg =
    type === "error"   ? "bg-red-600"    :
    type === "warning" ? "bg-amber-500"  :
    type === "info"    ? "bg-blue-600"   :
                         "bg-blue-600";  // success → blue (brand color)
  return (
    <div className={`fixed top-4 right-4 z-50 flex max-w-md items-center gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${bg}`}>
      {message}
    </div>
  );
}

/**
 * useToast
 * Hook that manages toast state.
 *
 * Returns { toast, showToast }
 *   showToast(message, type?, durationMs?)
 */
export function useToast() {
  const [toast, setToast] = useState({ message: "", type: "success" });
  const timer = useRef(null);

  const showToast = useCallback((message, type = "success", duration) => {
    const ms = duration ?? (type === "error" || type === "warning" ? 8000 : 3500);
    setToast({ message, type });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast({ message: "", type: "success" }), duration);
  }, []);

  return { toast, showToast };
}
