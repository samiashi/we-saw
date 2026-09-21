import { Poster } from "@/components/Poster";
import { ScoreChip } from "@/components/ScoreChip";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { seasonLabel } from "@/lib/analytics";
import { formatWatchDate } from "@/lib/dates";
import type { Entry } from "@/lib/types";

export function DrillDrawer({
  genre,
  entries,
  onClose,
}: {
  genre: string;
  entries: Entry[];
  onClose: () => void;
}) {
  return (
    <Drawer open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DrawerContent aria-label={`${genre} watches`}>
        <header className="flex items-center justify-between">
          <span className="text-muted text-xs tracking-[0.08em] uppercase">{genre}</span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        {entries.length ? (
          <div className="flex flex-col gap-2">
            {entries.map((entry) => (
              <div
                key={entry.watch.id}
                className="border-line bg-surface flex items-center gap-3 rounded-2xl border p-3"
              >
                <Poster title={entry.title} variant="small" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[14px] font-semibold">
                    {entry.title.name}
                    {seasonLabel(entry) ? ` · ${seasonLabel(entry)}` : ""}
                  </span>
                  <span className="text-muted text-xs">
                    {formatWatchDate(entry.watch.watchedOn)}
                  </span>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {entry.watch.watchers.map((watcherId) => (
                    <ScoreChip key={watcherId} score={entry.scores[watcherId]} />
                  ))}
                  {entry.watch.watchers.length > 1 ? (
                    <ScoreChip score={entry.combined} label="Avg" />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted text-[13px]">Nothing in this genre for the current filters.</p>
        )}
      </DrawerContent>
    </Drawer>
  );
}
