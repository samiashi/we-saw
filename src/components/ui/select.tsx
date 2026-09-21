import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "border-line bg-surface text-ink focus-visible:border-accent h-11 w-full appearance-none rounded-xl border px-3.5 text-base transition-colors focus-visible:outline-none disabled:opacity-55",
        className,
      )}
      {...props}
    />
  );
}
