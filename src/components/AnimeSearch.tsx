"use client";

import { useId, useRef, useState } from "react";
import { AlertCircleIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { AnimeSearchResult } from "@/components/AnimeSearchResult";
import { SearchResultSkeleton } from "@/components/LoadingSkeleton";
import { useAnimeSearch } from "@/hooks/useAnimeSearch";
import { containsAnime } from "@/lib/anime-utils";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

interface AnimeSearchProps {
  selections: (Anime | null)[];
  onSelect: (anime: Anime) => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Which edge the results panel anchors to (useful for right-hand columns). */
  align?: "left" | "right";
  className?: string;
}

export function AnimeSearch({
  selections,
  onSelect,
  onCancel,
  placeholder = "Search anime…",
  autoFocus,
  align = "left",
  className,
}: AnimeSearchProps) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { results, loading, error } = useAnimeSearch(term);

  const showPanel = open && term.trim().length >= 2;
  const clampedActive = Math.min(activeIndex, Math.max(results.length - 1, 0));

  const choose = (anime: Anime) => {
    if (containsAnime(selections, anime)) return;
    onSelect(anime);
    setTerm("");
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      const anime = results[clampedActive];
      if (anime) {
        event.preventDefault();
        choose(anime);
      }
    } else if (event.key === "Escape") {
      if (term) setTerm("");
      else onCancel?.();
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="group relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <input
          ref={inputRef}
          value={term}
          autoFocus={autoFocus}
          onChange={(e) => {
            setTerm(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && results[clampedActive] ? `${listId}-${clampedActive}` : undefined}
          autoComplete="off"
          spellCheck={false}
          className="h-11 w-full rounded-xl border border-white/10 bg-black/25 pr-9 pl-9 text-sm text-foreground shadow-inner shadow-black/20 transition outline-none placeholder:text-muted-foreground/80 focus:border-primary/60 focus:bg-black/35 focus:ring-3 focus:ring-primary/20"
        />
        {loading && term.trim().length >= 2 ? (
          <Loader2Icon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : term ? (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setTerm("");
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/10 hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>

      {showPanel && (
        <div
          className={cn(
            "glass-strong absolute top-[calc(100%+0.5rem)] z-40 w-[min(24rem,calc(100vw-2rem))] min-w-full overflow-hidden rounded-2xl p-1.5 shadow-2xl shadow-black/50 animate-in fade-in-0 slide-in-from-top-1",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {error ? (
            <p className="flex items-center gap-2 px-3 py-4 text-sm text-destructive">
              <AlertCircleIcon className="size-4 shrink-0" /> {error}
            </p>
          ) : loading && results.length === 0 ? (
            <SearchResultSkeleton />
          ) : results.length === 0 ? (
            <div className="px-3 py-5 text-center">
              <p className="text-sm text-foreground">No anime found for “{term.trim()}”.</p>
              <p className="mt-1 text-xs text-muted-foreground">Try the Japanese title or a shorter search.</p>
            </div>
          ) : (
            <ul id={listId} role="listbox" className="scrollbar-thin max-h-[22rem] overflow-y-auto">
              {results.map((anime, index) => (
                <AnimeSearchResult
                  key={anime.id}
                  id={`${listId}-${index}`}
                  anime={anime}
                  active={index === clampedActive}
                  disabled={containsAnime(selections, anime)}
                  onHover={() => setActiveIndex(index)}
                  onSelect={() => choose(anime)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
