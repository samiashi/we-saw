import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number | null, durationMs = 600): number | null {
  const [value, setValue] = useState(target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (target == null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const timer = setTimeout(() => setValue(target), 0);
      return () => clearTimeout(timer);
    }

    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setValue(from + (target - from) * eased);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [target, durationMs]);

  return value;
}
