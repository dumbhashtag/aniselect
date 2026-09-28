"use client";

import { useState } from "react";
import { RefreshCwIcon, XIcon } from "lucide-react";
import { AnimeImage } from "@/components/AnimeImage";
import { AnimeSearch } from "@/components/AnimeSearch";
import { formatLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

interface PickSlotProps {
  index: number;
  anime: Anime | null;
  selections: (Anime | null)[];
  onPick: (anime: Anime) => void;
  onRemove: () => void;
  autoFocus?: boolean;
}

/** One of the five pick slots: an inline search when empty, a poster card when filled. */
export function PickSlot({ index, anime, selections, onPick, onRemove, autoFocus }: PickSlotProps) {
  const [replacing, setReplacing] = useState(false);
  const align = index >= 3 ? "right" : "left";

  if (!anime) {
    return (
      <div
        data-slot-index={index}
        className="relative flex items-center gap-3 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-2.5 transition-colors focus-within:border-primary/50 focus-within:bg-primary/[0.04] lg:aspect-[2/3] lg:flex-col lg:items-stretch lg:justify-end lg:p-3"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/5 font-heading text-sm font-semibold text-muted-foreground lg:pointer-events-none lg:absolute lg:inset-0 lg:m-auto lg:size-auto lg:flex-col lg:gap-1 lg:bg-transparent lg:pb-14">
          <span className="lg:text-5xl lg:font-bold lg:text-white/10">{index + 1}</span>
          <span className="hidden text-xs font-normal text-muted-foreground/80 lg:block">Pick an anime</span>
        </div>
        <AnimeSearch
          className="flex-1 lg:flex-none"
          selections={selections}
          onSelect={onPick}
          align={align}
          autoFocus={autoFocus}
          placeholder={index === 0 ? "Try “Frieren”…" : "Search anime…"}
        />
      </div>
    );
  }

  return (
    <div className="group relative">
      <SelectedAnime anime={anime} index={index} onRemove={onRemove} onReplace={() => setReplacing(true)} dimmed={replacing} />
      {replacing && (
        <div className="absolute inset-x-2 top-1/2 z-30 -translate-y-1/2 animate-in fade-in-0 zoom-in-95 lg:inset-x-3">
          <AnimeSearch
            selections={selections}
            autoFocus
            align={align}
            placeholder={`Replace ${anime.title}`}
            onCancel={() => setReplacing(false)}
            onSelect={(next) => {
              setReplacing(false);
              onPick(next);
            }}
          />
          <button
            type="button"
            onClick={() => setReplacing(false)}
            className="mt-2 w-full rounded-lg py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

interface SelectedAnimeProps {
  anime: Anime;
  index: number;
  onRemove: () => void;
  onReplace: () => void;
  dimmed?: boolean;
}

export function SelectedAnime({ anime, index, onRemove, onReplace, dimmed }: SelectedAnimeProps) {
  const meta = [formatLabel(anime.format), anime.year].filter(Boolean).join(" • ");
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-lg shadow-black/20 transition-all duration-300 animate-in fade-in-0 zoom-in-95 lg:block lg:aspect-[2/3] lg:p-0",
        "lg:hover:-translate-y-1 lg:hover:shadow-xl lg:hover:shadow-black/40",
        dimmed && "opacity-40 blur-[1px]",
      )}
      style={anime.coverColor ? { boxShadow: `0 10px 40px -18px ${anime.coverColor}` } : undefined}
    >
      <AnimeImage
        src={anime.coverImageLarge ?? anime.coverImage}
        alt={`${anime.title} poster`}
        color={anime.coverColor}
        sizes="(min-width: 1024px) 20vw, 64px"
        className="h-20 w-14 shrink-0 rounded-lg lg:absolute lg:inset-0 lg:h-full lg:w-full lg:rounded-none"
      />
      <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-black/95 via-black/30 to-transparent lg:block" />
      <div className="min-w-0 flex-1 lg:absolute lg:inset-x-0 lg:bottom-0 lg:p-3">
        <span className="mb-1 hidden size-6 items-center justify-center rounded-md bg-white/15 text-[11px] font-semibold backdrop-blur lg:flex">
          {index + 1}
        </span>
        <p className="line-clamp-2 text-sm leading-snug font-semibold text-white">{anime.title}</p>
        <p className="mt-0.5 text-xs text-white/65">{meta}</p>
      </div>
      <div className="flex shrink-0 gap-1 transition-opacity lg:absolute lg:top-2 lg:right-2 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={onReplace}
          aria-label={`Replace ${anime.title}`}
          title="Replace"
          className="flex size-8 items-center justify-center rounded-lg bg-white/8 text-white/80 backdrop-blur-md transition hover:bg-white/20 hover:text-white lg:bg-black/55"
        >
          <RefreshCwIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${anime.title}`}
          title="Remove"
          className="flex size-8 items-center justify-center rounded-lg bg-white/8 text-white/80 backdrop-blur-md transition hover:bg-destructive/80 hover:text-white lg:bg-black/55"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
