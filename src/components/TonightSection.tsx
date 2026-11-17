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
import { useStore } from "@/hooks/useStore";
import type { Title } from "@/lib/types";

export function TonightSection({ onOpen }: { onOpen: (title: Title) => void }) {
  const { entries, people, household, userId, requestTonightPicks } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-accent/10 p-2.5 text-accent">
          <Sparkles size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-[17px] font-semibold">Discover your next watch</h2>
          <p className="mt-1 text-sm text-muted">
            New movies and shows, inspired by everything you’ve watched and rated.
          </p>
        </div>
      </div>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="outline" className="self-start">
            Find something new
          </Button>
        </DrawerTrigger>
        {open ? (
          <DrawerContent aria-describedby="tonight-description">
            <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 bg-surface px-4 pb-3">
              <DrawerTitle className="text-xl font-semibold">Find something new</DrawerTitle>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </header>
            <DrawerDescription id="tonight-description" className="sr-only">
              Discover unseen movies and shows using your full watch history, ratings, and optional
              mood.
            </DrawerDescription>
            <TonightPicker
              key={`${household?.id}:${userId}`}
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
