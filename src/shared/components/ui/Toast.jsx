"use client";

import { useState, useCallback } from "react";

/**
 * Toast
 * Renders a fixed toast notification.
 *
 * Props:
 *   message — string (empty = hidden)
 *   type    — "success" | "error" | "info"
 */
export function Toast({ message, type = "success" }) {
  if (!message) return null;
  const bg =
    type === "error"   ? "bg-red-600"  :
    type === "info"    ? "bg-blue-600" :
                         "bg-green-600";
  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${bg}`}>
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

  const showToast = useCallback((message, type = "success", duration = 3500) => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "success" }), duration);
  }, []);

  return { toast, showToast };
}
