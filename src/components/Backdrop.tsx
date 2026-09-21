import { backdropUrl } from "@/lib/api";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Backdrop({
  title,
  className,
}: {
  title: Pick<Title, "backdropPath" | "name">;
  className?: string;
}) {
  const url = backdropUrl(title);
  if (!url) return null;

  return (
    <img
      className={cn("h-36 w-full object-cover", className)}
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      aria-hidden="true"
      onError={(event) => {
        event.currentTarget.hidden = true;
      }}
    />
  );
}
