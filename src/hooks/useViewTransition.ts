import { flushSync } from "react-dom";

type StartViewTransition = (update: () => void) => void;

export function useViewTransition(): StartViewTransition {
  return (update) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduced) {
      update();
      return;
    }
    document.startViewTransition(() => {
      flushSync(update);
    });
  };
}
