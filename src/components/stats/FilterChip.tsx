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
        "border-line text-muted rounded-full border transition-colors",
        small ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-[13px]",
        active &&
          (small ? "border-accent bg-accent/8 text-ink" : "bg-surface-2 border-accent text-ink"),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
