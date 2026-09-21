import { useEffect, useState } from "react";
import {
  fetchProviders,
  providerLogoUrl,
  type ProvidersByRegion,
  type WatchProvider,
} from "@/lib/api";
import { getRegion, regionName } from "@/lib/region";
import type { MediaType } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function ProviderGroup({ label, providers }: { label: string; providers: WatchProvider[] }) {
  if (!providers.length) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted text-xs tracking-[0.07em] uppercase">{label}</span>
      <div className="flex flex-wrap gap-2">
        {providers.map((provider) => {
          const logo = providerLogoUrl(provider.logoPath);
          return (
            <span
              key={provider.name}
              className="border-line bg-surface-2 flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[13px]"
            >
              {logo ? <img className="size-5 rounded" src={logo} alt="" loading="lazy" /> : null}
              {provider.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function WhereToWatch({
  type,
  tmdbId,
  className,
}: {
  type: MediaType;
  tmdbId: number | null;
  className?: string;
}) {
  const [providers, setProviders] = useState<ProvidersByRegion | null>(null);
  const [loading, setLoading] = useState(tmdbId !== null);
  const [region] = useState(getRegion);

  useEffect(() => {
    if (!tmdbId) return;
    let active = true;

    void fetchProviders(type, tmdbId).then((result) => {
      if (!active) return;
      setProviders(result);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [type, tmdbId]);

  if (!tmdbId) return null;
  if (loading) return <Skeleton className={cn("h-14 w-full", className)} />;

  const entry = providers?.[region];
  if (!entry) {
    return (
      <p className={cn("text-muted text-[13px]", className)}>
        No streaming information for {regionName(region)} yet.
      </p>
    );
  }

  const groups = [
    ["Stream", entry.flatrate],
    ["Free", entry.free],
  ] as const;

  if (!groups.some(([, list]) => list.length)) {
    return (
      <p className={cn("text-muted text-[13px]", className)}>
        Not on any service in {regionName(region)} right now.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {groups.map(([label, list]) => (
        <ProviderGroup key={label} label={label} providers={list} />
      ))}
      <p className="text-muted text-xs">
        Streaming data from{" "}
        <a href={entry.link ?? "https://www.justwatch.com"} target="_blank" rel="noreferrer">
          JustWatch
        </a>
      </p>
    </div>
  );
}
