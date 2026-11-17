import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-base text-ink transition-colors placeholder:text-muted/70 focus-visible:border-accent focus-visible:outline-none disabled:opacity-55",
        className,
      )}
      {...props}
    />
  );
}
