"use client";

import { Loader2Icon, SparklesIcon, Trash2Icon } from "lucide-react";
import { PickSlot } from "@/components/SelectedAnime";
import { Switch } from "@/components/ui/switch";
import { REQUIRED_PICKS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

interface SelectionBoardProps {
  selections: (Anime | null)[];
  onPick: (index: number, anime: Anime) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onSubmit: () => void;
  submitting: boolean;
  hiddenGems: boolean;
  onHiddenGemsChange: (value: boolean) => void;
}

export function SelectionBoard({
  selections,
  onPick,
  onRemove,
  onClear,
  onSubmit,
  submitting,
  hiddenGems,
  onHiddenGemsChange,
}: SelectionBoardProps) {
  const count = selections.filter(Boolean).length;
  const ready = count === REQUIRED_PICKS;
  const firstEmpty = selections.findIndex((s) => s === null);

  return (
    <div id="pick" className="scroll-mt-24">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            Your picks <span className="text-muted-foreground tabular-nums">· {count}/{REQUIRED_PICKS}</span>
          </p>
          <div className="mt-2 flex gap-1" aria-hidden>
            {selections.map((s, i) => (
              <span
                key={i}
                className={cn("h-1 w-8 rounded-full transition-colors duration-500", s ? "bg-primary" : "bg-white/10")}
              />
            ))}
          </div>
        </div>
        {count > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
          >
            <Trash2Icon className="size-3.5" /> Clear all
          </button>
        )}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
        {selections.map((anime, index) => (
          <PickSlot
            key={anime?.id ?? `empty-${index}`}
            index={index}
            anime={anime}
            selections={selections}
            onPick={(a) => {
              onPick(index, a);
              const next = selections.findIndex((s, i) => s === null && i !== index);
              if (next >= 0) {
                requestAnimationFrame(() =>
                  document.querySelector<HTMLInputElement>(`[data-slot-index="${next}"] input`)?.focus(),
                );
              }
            }}
            onRemove={() => onRemove(index)}
            autoFocus={false}
          />
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!ready || submitting}
          className={cn(
            "group relative inline-flex h-14 items-center gap-2.5 rounded-full px-8 font-heading text-base font-bold transition-all sm:h-16 sm:px-10 sm:text-lg",
            ready
              ? "bg-primary text-primary-foreground shadow-[0_18px_50px_-12px] shadow-primary/70 hover:scale-[1.03] hover:bg-sky-300"
              : "cursor-not-allowed bg-white/8 text-muted-foreground",
          )}
        >
          {submitting ? <Loader2Icon className="size-5 animate-spin" /> : <SparklesIcon className="size-5" />}
          {submitting ? "Finding your anime…" : "Recommend me anime"}
        </button>
        <p className="h-4 text-xs text-muted-foreground">
          {ready
            ? "Ready when you are."
            : `Pick ${REQUIRED_PICKS - count} more anime${firstEmpty >= 0 && count > 0 ? " to unlock recommendations" : ""}.`}
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-xs text-muted-foreground transition hover:text-foreground">
          <Switch size="sm" checked={hiddenGems} onCheckedChange={onHiddenGemsChange} />
          Favor hidden gems over popular hits
        </label>
      </div>
    </div>
  );
}
