import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "border-line bg-surface text-ink placeholder:text-muted/70 focus-visible:border-accent min-h-[72px] w-full rounded-xl border px-3.5 py-2.5 text-base transition-colors focus-visible:outline-none disabled:opacity-55",
        className,
      )}
      {...props}
    />
  );
}
