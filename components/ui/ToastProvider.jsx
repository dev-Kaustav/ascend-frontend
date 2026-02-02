"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

const TONE_STYLES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-slate-200 bg-white text-slate-700"
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timeout = timers.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (message, { tone = "success", duration = 4000 } = {}) => {
      if (!message) return;
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, tone }]);
      if (duration > 0) {
        const timeout = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timeout);
      }
    },
    [dismiss]
  );

  const value = useMemo(() => ({ notify, dismiss }), [dismiss, notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-6 top-6 z-50 flex max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const toneClass = TONE_STYLES[toast.tone] || TONE_STYLES.info;
          return (
            <div key={toast.id} className={`rounded-2xl border px-4 py-3 text-sm shadow-lg ${toneClass}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="leading-snug">{toast.message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                  aria-label="Dismiss notification"
                >
                  x
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return { notify: () => {}, dismiss: () => {} };
  }
  return context;
}
