import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full appearance-none rounded-xl border border-line bg-surface px-3.5 text-base text-ink transition-colors focus-visible:border-accent focus-visible:outline-none disabled:opacity-55",
        className,
      )}
      {...props}
    />
  );
}
