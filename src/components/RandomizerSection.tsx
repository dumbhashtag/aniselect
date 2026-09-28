"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircleIcon, DicesIcon, ShuffleIcon, SlidersHorizontalIcon } from "lucide-react";
import { useAnimeModal } from "@/components/AnimeModal";
import { activeFilterCount, DEFAULT_RANDOM_FILTERS, FilterMenu } from "@/components/FilterMenu";
import { RandomAnimeSkeleton } from "@/components/LoadingSkeleton";
import { RandomAnimeCard } from "@/components/RandomAnimeCard";
import { ApiError, getGenres, getRandomAnime } from "@/lib/api-client";
import { MAX_YEAR, MIN_YEAR } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Anime, RandomFilters } from "@/types/anime";

function toRequestFilters(filters: RandomFilters): RandomFilters {
  return {
    ...filters,
    yearFrom: filters.yearFrom && filters.yearFrom > MIN_YEAR ? filters.yearFrom : null,
    yearTo: filters.yearTo && filters.yearTo < MAX_YEAR ? filters.yearTo : null,
  };
}

export function RandomizerSection() {
  const [filters, setFilters] = useState<RandomFilters>(DEFAULT_RANDOM_FILTERS);
  const [genres, setGenres] = useState<string[]>([]);
  const [anime, setAnime] = useState<Anime | null>(null);
  const [loading, setLoading] = useState<"filtered" | "surprise" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const history = useRef<number[]>([]);
  const { open } = useAnimeModal();
  const filterCount = activeFilterCount(filters);

  useEffect(() => {
    getGenres().then(setGenres).catch(() => setGenres([]));
  }, []);

  const roll = async (mode: "filtered" | "surprise") => {
    setLoading(mode);
    setError(null);
    try {
      const next = await getRandomAnime(mode === "surprise" ? "surprise" : toRequestFilters(filters), history.current);
      if (next.anilistId) history.current = [...history.current, next.anilistId].slice(-30);
      setAnime(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't roll an anime. Try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <section id="random" className="scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-glow uppercase">Feeling lucky?</p>
          <h2 className="font-heading text-3xl font-bold text-balance sm:text-5xl">Don’t know what you’re looking for?</h2>
          <p className="mt-4 text-muted-foreground">
            Roll a random anime from AniList’s full catalogue — tens of thousands of titles, not a curated shortlist.
          </p>
        </div>

        <div className="mt-10 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => roll("filtered")}
            disabled={loading !== null}
            className="group relative inline-flex h-16 items-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-sky-400 via-primary to-pink-400 px-9 font-heading text-lg font-bold tracking-wide text-primary-foreground uppercase shadow-[0_20px_60px_-15px] shadow-primary/60 transition-all hover:scale-[1.03] hover:shadow-primary/80 active:scale-100 disabled:opacity-80 sm:h-[4.5rem] sm:px-12 sm:text-xl"
          >
            <span className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.45)_50%,transparent_75%)] bg-[length:250%_100%] opacity-0 transition-opacity group-hover:animate-shimmer group-hover:opacity-100" />
            <DicesIcon className={cn("relative size-6", loading === "filtered" && "animate-spin")} />
            <span className="relative">{loading === "filtered" ? "Rolling…" : "Randomize anime"}</span>
          </button>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => roll("surprise")}
              disabled={loading !== null}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 text-sm font-medium transition hover:border-glow/50 hover:bg-glow/10 hover:text-glow disabled:opacity-60"
            >
              <ShuffleIcon className={cn("size-4", loading === "surprise" && "animate-spin")} />
              Surprise me <span className="text-muted-foreground">(no filters)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
                showFilters ? "border-primary/50 bg-primary/10 text-primary" : "border-white/12 bg-white/[0.04] hover:border-white/25",
              )}
            >
              <SlidersHorizontalIcon className="size-4" />
              Filters
              {filterCount > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {filterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className={cn("mt-10 grid gap-6", showFilters && "lg:grid-cols-[20rem_1fr]")}>
          {showFilters && (
            <div className="animate-in fade-in-0 slide-in-from-left-2">
              <FilterMenu filters={filters} genres={genres} onChange={setFilters} />
            </div>
          )}
          <div className="min-w-0" aria-live="polite">
            {loading ? (
              <RandomAnimeSkeleton />
            ) : error ? (
              <div className="glass flex flex-col items-center gap-3 rounded-3xl px-6 py-14 text-center">
                <AlertCircleIcon className="size-8 text-destructive" />
                <p className="max-w-md text-sm text-foreground">{error}</p>
                <button type="button" onClick={() => roll("filtered")} className="text-sm font-medium text-primary hover:underline">
                  Try again
                </button>
              </div>
            ) : anime ? (
              <RandomAnimeCard key={anime.id} anime={anime} onOpen={() => open(anime)} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
                <DicesIcon className="size-10 text-white/15" />
                <p className="text-sm text-muted-foreground">
                  Hit <span className="font-semibold text-foreground">Randomize</span> and let fate pick your next watch.
                  {filterCount > 0 && ` ${filterCount} filter${filterCount === 1 ? "" : "s"} active.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
