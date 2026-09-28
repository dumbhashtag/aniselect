"use client";

import { CheckIcon, StarIcon } from "lucide-react";
import { AnimeImage } from "@/components/AnimeImage";
import { formatLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

interface AnimeSearchResultProps {
  anime: Anime;
  active: boolean;
  disabled: boolean;
  id: string;
  onSelect: () => void;
  onHover: () => void;
}

export function AnimeSearchResult({ anime, active, disabled, id, onSelect, onHover }: AnimeSearchResultProps) {
  const meta = [formatLabel(anime.format), anime.year ?? "TBA"].join(" • ");
  const subtitle = anime.titleRomaji && anime.titleRomaji !== anime.title ? anime.titleRomaji : null;

  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      aria-disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => !disabled && onSelect()}
      onMouseEnter={onHover}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl p-2 transition-colors",
        active && !disabled && "bg-white/8",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <AnimeImage
        src={anime.coverImage}
        alt=""
        color={anime.coverColor}
        sizes="48px"
        className="h-16 w-11 shrink-0 rounded-md"
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm leading-snug font-medium text-foreground">{anime.title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{meta}</span>
          {anime.score ? (
            <span className="inline-flex items-center gap-0.5 text-amber-300/90">
              <StarIcon className="size-3 fill-current" />
              {anime.score}%
            </span>
          ) : null}
        </p>
      </div>
      {disabled && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-muted-foreground">
          <CheckIcon className="size-3" /> Picked
        </span>
      )}
    </li>
  );
}
