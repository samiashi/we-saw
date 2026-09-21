import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "border-line bg-surface text-ink placeholder:text-muted/70 focus-visible:border-accent h-11 w-full rounded-xl border px-3.5 text-[15px] transition-colors focus-visible:outline-none disabled:opacity-55",
        className,
      )}
      {...props}
    />
  );
}
