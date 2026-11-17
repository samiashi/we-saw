import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FilterChip({
  active,
  small,
  className,
  children,
  ...props
}: {
  active?: boolean;
  small?: boolean;
  children: ReactNode;
} & ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-full border border-line text-muted transition-colors",
        small ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-[13px]",
        active &&
          (small ? "border-accent bg-accent/8 text-ink" : "border-accent bg-surface-2 text-ink"),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
