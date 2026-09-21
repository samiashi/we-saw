import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Chip({
  active,
  className,
  ...props
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "border-line text-muted inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
        active && "border-accent bg-accent/8 text-ink",
        className,
      )}
      {...props}
    />
  );
}
