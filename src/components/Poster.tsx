import { useState } from "react";
import { posterUrl } from "@/lib/api";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function Poster({
  title,
  size = "w200",
  variant = "regular",
  className,
}: {
  title: Pick<Title, "posterPath" | "name">;
  size?: "w92" | "w200" | "w342" | "w500";
  variant?: "regular" | "small";
  className?: string;
}) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const url = posterUrl(title, variant === "small" ? "w92" : size);
  const base = cn(
    "aspect-[2/3] shrink-0 rounded-lg object-cover",
    variant === "small" ? "w-11" : "w-24 rounded-[10px]",
    className,
  );

  if (url && url !== brokenUrl) {
    return (
      <img
        className={base}
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        crossOrigin="anonymous"
        onError={() => setBrokenUrl(url)}
      />
    );
  }
  return (
    <div
      className={cn(
        base,
        "text-muted flex items-center justify-center bg-gradient-to-br from-[#232838] to-[#15171e] text-sm font-semibold",
      )}
      aria-hidden="true"
    >
      {initials(title.name)}
    </div>
  );
}
