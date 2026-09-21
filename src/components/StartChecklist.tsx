import { useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasRegionChoice } from "@/lib/region";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "wesaw.checklist-dismissed";

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  tab: "log" | "settings";
}

export function StartChecklist({ onNavigate }: { onNavigate: (tab: "log" | "settings") => void }) {
  const { mode, people, entries } = useStore();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const items: ChecklistItem[] = [
    { id: "log", label: "Log your first watch", done: entries.length > 0, tab: "log" },
    mode === "cloud"
      ? { id: "invite", label: "Invite your partner", done: people.length >= 2, tab: "settings" }
      : {
          id: "names",
          label: "Name you two",
          done: people.some((person) => person.name !== "You" && person.name !== "Partner"),
          tab: "settings",
        },
    { id: "region", label: "Pick where you watch from", done: hasRegionChoice(), tab: "settings" },
  ];
  const pending = items.filter((item) => !item.done);

  if (dismissed || !pending.length) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      console.warn("Could not remember the checklist dismissal.");
    }
    setDismissed(true);
  }

  return (
    <section className="border-line bg-surface mb-4 flex flex-col gap-1 rounded-2xl border p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-semibold">Get started</span>
        <span className="flex items-center gap-1">
          <span className="text-muted text-xs">
            {items.length - pending.length} of {items.length}
          </span>
          <Button variant="ghost" size="icon" aria-label="Dismiss checklist" onClick={dismiss}>
            <X size={16} />
          </Button>
        </span>
      </div>
      {pending.map((item) => (
        <button
          key={item.id}
          type="button"
          className="hover:bg-surface-2 flex items-center gap-2.5 rounded-xl px-2 py-2 text-left text-[14px] transition-colors"
          onClick={() => onNavigate(item.tab)}
        >
          <span
            className={cn(
              "border-line flex size-5 shrink-0 items-center justify-center rounded-full border",
              item.done && "border-good bg-good/20",
            )}
          >
            {item.done ? <Check size={12} className="text-good" /> : null}
          </span>
          <span className="flex-1">{item.label}</span>
          <ChevronRight size={15} className="text-muted" />
        </button>
      ))}
    </section>
  );
}
