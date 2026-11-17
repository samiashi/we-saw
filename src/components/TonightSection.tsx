import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { TonightPicker } from "@/components/TonightPicker";
import { useStore } from "@/lib/store";
import type { Title } from "@/lib/types";

export function TonightSection({ onOpen }: { onOpen: (title: Title) => void }) {
  const { listItems, titles, entries, people, household, userId, requestTonightPicks } = useStore();
  const [open, setOpen] = useState(false);
  const queued = listItems
    .filter((item) => item.status === "queued" || item.status === "watching")
    .map((item) => titles[item.titleKey])
    .filter((title): title is Title => Boolean(title));
  return (
    <section className="border-accent/30 bg-accent/5 flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex items-start gap-3">
        <div className="bg-accent/10 text-accent rounded-xl p-2.5">
          <Sparkles size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-[17px] font-semibold">What fits tonight?</h2>
          <p className="text-muted mt-1 text-sm">Your queue, your tastes, your kind of evening.</p>
        </div>
      </div>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="outline" className="self-start">
            Help us choose
          </Button>
        </DrawerTrigger>
        {open ? (
          <DrawerContent aria-describedby="tonight-description">
            <header className="bg-surface sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 px-4 pb-3">
              <DrawerTitle className="text-xl font-semibold">Pick for tonight</DrawerTitle>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </header>
            <DrawerDescription id="tonight-description" className="sr-only">
              Choose a mood and optional filters to get suggestions from your Up Next list.
            </DrawerDescription>
            <TonightPicker
              key={`${household?.id}:${userId}`}
              titles={queued}
              history={entries}
              people={people}
              generate={requestTonightPicks}
              onOpen={(title) => {
                setOpen(false);
                onOpen(title);
              }}
            />
          </DrawerContent>
        ) : null}
      </Drawer>
    </section>
  );
}
