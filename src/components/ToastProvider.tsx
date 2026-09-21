import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Toast } from "@/components/ui/toast";
import { ToastContext, type ToastApi } from "@/lib/toast";

const DURATION_MS = 2500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(""), DURATION_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast message={message} />
    </ToastContext.Provider>
  );
}
