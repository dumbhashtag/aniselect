"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircleIcon, ArrowLeftIcon, EyeIcon, HeartIcon, PlayIcon, StarIcon, UsersIcon } from "lucide-react";
import { AnimeImage } from "@/components/AnimeImage";
import { GenreChips } from "@/components/AnimeMeta";
import { ExternalLinks } from "@/components/ExternalLinks";
import { ModalSkeleton } from "@/components/LoadingSkeleton";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ApiError, getAnimeDetails } from "@/lib/api-client";
import {
  altTitle,
  compactNumber,
  dateLabel,
  durationLabel,
  episodesLabel,
  formatLabel,
  seasonLabel,
  statusLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Anime, AnimeDetails } from "@/types/anime";

interface ModalContextValue {
  open: (anime: Anime) => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useAnimeModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useAnimeModal must be used inside <AnimeModalProvider>");
  return ctx;
}

export function AnimeModalProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<Anime[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((anime: Anime) => {
    if (!anime.anilistId) {
      if (anime.malUrl) window.open(anime.malUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setStack([anime]);
    setIsOpen(true);
  }, []);

  const value = useMemo(() => ({ open }), [open]);
  const current = stack[stack.length - 1] ?? null;

  return (
    <ModalContext.Provider value={value}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen} onOpenChangeComplete={(o) => !o && setStack([])}>
        <DialogContent
          className="glass-strong scrollbar-thin block max-h-[calc(100dvh-1.5rem)] overflow-x-hidden overflow-y-auto rounded-3xl p-0 sm:max-w-4xl"
        >
          {current && (
            <AnimeModalBody
              key={current.id}
              preview={current}
              canGoBack={stack.length > 1}
              onBack={() => setStack((s) => s.slice(0, -1))}
              onNavigate={(anime) => anime.anilistId && setStack((s) => [...s, anime])}
            />
          )}
        </DialogContent>
      </Dialog>
    </ModalContext.Provider>
  );
}

interface BodyProps {
  preview: Anime;
  canGoBack: boolean;
  onBack: () => void;
  onNavigate: (anime: Anime) => void;
}

function AnimeModalBody({ preview, canGoBack, onBack, onNavigate }: BodyProps) {
  const [details, setDetails] = useState<AnimeDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    getAnimeDetails(preview.anilistId!, controller.signal)
      .then((d) => {
        setDetails(d);
        setError(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load details.");
      });
    topRef.current?.scrollIntoView({ block: "start" });
    return () => controller.abort();
  }, [preview.anilistId, attempt]);

  const anime: Anime = details ?? preview;

  return (
    <div ref={topRef} className="min-w-0">
      <DialogTitle className="sr-only">{anime.title}</DialogTitle>
      <DialogDescription className="sr-only">Details, trailer and related titles for {anime.title}.</DialogDescription>

      <div className="relative h-44 overflow-hidden sm:h-64">
        {anime.bannerImage ? (
          <AnimeImage src={anime.bannerImage} alt="" sizes="(min-width: 896px) 896px, 100vw" priority className="absolute inset-0" />
        ) : (
          <div className="absolute inset-0 scale-125 opacity-60 blur-2xl">
            <AnimeImage src={anime.coverImage} alt="" sizes="300px" className="absolute inset-0" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-popover via-popover/50 to-transparent" />
        {canGoBack && (
          <button
            type="button"
            onClick={onBack}
            className="absolute top-3 left-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/55 px-3 text-xs font-medium text-white backdrop-blur-md hover:bg-black/75"
          >
            <ArrowLeftIcon className="size-3.5" /> Back
          </button>
        )}
      </div>

      <div className="relative -mt-24 flex flex-col gap-5 px-5 sm:-mt-28 sm:flex-row sm:px-8">
        <AnimeImage
          src={anime.coverImageLarge ?? anime.coverImage}
          alt={`${anime.title} poster`}
          color={anime.coverColor}
          sizes="176px"
          className="aspect-[2/3] w-32 shrink-0 rounded-2xl shadow-2xl shadow-black/70 ring-1 ring-white/10 sm:w-44"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-end gap-3 sm:pb-2">
          <div>
            <h2 className="font-heading text-2xl leading-tight font-bold text-balance text-white sm:text-3xl">{anime.title}</h2>
            {altTitle(anime) && <p className="mt-1 text-sm text-muted-foreground">{altTitle(anime)}</p>}
            {anime.titleNative && <p className="text-xs text-muted-foreground/70">{anime.titleNative}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Stat icon={<StarIcon className="size-3.5 fill-amber-300 text-amber-300" />} label="AniList score" value={anime.score ? `${anime.score}%` : "—"} />
            {details?.malScore ? (
              <Stat icon={<StarIcon className="size-3.5 fill-indigo-300 text-indigo-300" />} label="MAL score" value={(details.malScore / 10).toFixed(2)} />
            ) : null}
            <Stat icon={<UsersIcon className="size-3.5 text-sky-300" />} label="Popularity" value={compactNumber(anime.popularity) ?? "—"} />
            {anime.favourites ? (
              <Stat icon={<HeartIcon className="size-3.5 fill-pink-400 text-pink-400" />} label="Favourites" value={compactNumber(anime.favourites)!} />
            ) : null}
          </div>
          <ExternalLinks anime={anime} size="md" />
        </div>
      </div>

      {error && !details ? (
        <div className="m-5 flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center sm:m-8">
          <AlertCircleIcon className="size-6 text-destructive" />
          <p className="text-sm">{error}</p>
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="text-sm font-medium text-primary hover:underline">
            Retry
          </button>
        </div>
      ) : !details ? (
        <div className="-mt-16">
          <ModalSkeleton />
        </div>
      ) : (
        <DetailsContent details={details} onNavigate={onNavigate} />
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <span title={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-xs font-semibold">
      {icon}
      <span className="sr-only">{label}:</span>
      {value}
    </span>
  );
}

function DetailsContent({ details, onNavigate }: { details: AnimeDetails; onNavigate: (anime: Anime) => void }) {
  const [showSpoilers, setShowSpoilers] = useState(false);
  const [playTrailer, setPlayTrailer] = useState(false);

  const facts: [string, string | null][] = [
    ["Format", formatLabel(details.format)],
    ["Episodes", episodesLabel(details) ?? (details.format === "MOVIE" ? "1" : null)],
    ["Duration", durationLabel(details.duration)],
    ["Status", statusLabel(details.status)],
    ["Season", seasonLabel(details)],
    ["Start date", dateLabel(details.startDate)],
    ["End date", dateLabel(details.endDate)],
    ["Studio", details.studios.join(", ") || null],
  ];
  const tags = details.tags.filter((t) => showSpoilers || !t.isSpoiler).slice(0, 18);
  const spoilerCount = details.tags.filter((t) => t.isSpoiler).length;

  return (
    <div className="space-y-8 p-5 sm:p-8">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white/[0.04] px-3 py-2.5">
            <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</dt>
            <dd className="mt-0.5 truncate text-sm font-medium" title={value ?? undefined}>
              {value ?? "—"}
            </dd>
          </div>
        ))}
      </dl>

      <section>
        <h3 className="mb-2 font-heading text-lg font-semibold">Synopsis</h3>
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/80">
          {details.description ?? "No synopsis has been written for this anime yet."}
        </p>
      </section>

      <section className="space-y-3">
        <GenreChips genres={details.genres} max={10} />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag.name}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px]",
                  tag.isSpoiler ? "border-destructive/30 text-destructive/90" : "border-white/8 text-muted-foreground",
                )}
              >
                {tag.name} <span className="text-primary/80">{tag.rank}%</span>
              </span>
            ))}
            {spoilerCount > 0 && (
              <button type="button" onClick={() => setShowSpoilers((s) => !s)} className="inline-flex items-center gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground">
                <EyeIcon className="size-3" /> {showSpoilers ? "Hide" : "Show"} {spoilerCount} spoiler tag{spoilerCount === 1 ? "" : "s"}
              </button>
            )}
          </div>
        )}
      </section>

      {details.trailer && (
        <section>
          <h3 className="mb-3 font-heading text-lg font-semibold">Trailer</h3>
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
            {playTrailer ? (
              <iframe
                src={`${details.trailer.embedUrl}?autoplay=1`}
                title={`${details.title} trailer`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 size-full"
              />
            ) : (
              <button type="button" onClick={() => setPlayTrailer(true)} className="group absolute inset-0" aria-label="Play trailer">
                <AnimeImage src={details.trailer.thumbnail} alt="" sizes="896px" className="absolute inset-0 opacity-80 transition-opacity group-hover:opacity-100" />
                <span className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-white/90 text-black shadow-2xl transition-transform group-hover:scale-110">
                  <PlayIcon className="ml-1 size-7 fill-current" />
                </span>
              </button>
            )}
          </div>
        </section>
      )}

      {details.relations.length > 0 && (
        <AnimeRow
          title="Related anime"
          items={details.relations.map((r) => ({ anime: r.anime, label: r.relationType.replace(/_/g, " ").toLowerCase() }))}
          onSelect={onNavigate}
        />
      )}

      {details.similar.length > 0 && (
        <AnimeRow
          title="Similar anime"
          items={details.similar.map((s) => ({
            anime: s.anime,
            label: `${s.votes.toLocaleString("en-US")} ${s.source === "mal" ? "MAL" : "AniList"} votes`,
          }))}
          onSelect={onNavigate}
        />
      )}

      {details.characters.length > 0 && (
        <section>
          <h3 className="mb-3 font-heading text-lg font-semibold">Main characters</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {details.characters.map((c) => (
              <div key={c.name} className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-1.5">
                <AnimeImage src={c.image} alt={c.name} sizes="40px" className="size-10 shrink-0 rounded-lg" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{c.role.toLowerCase()}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AnimeRow({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: { anime: Anime; label: string }[];
  onSelect: (anime: Anime) => void;
}) {
  return (
    <section className="min-w-0">
      <h3 className="mb-3 font-heading text-lg font-semibold">{title}</h3>
      <div className="scrollbar-thin -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8">
        {items.map(({ anime, label }) => (
          <button
            key={`${anime.id}-${label}`}
            type="button"
            onClick={() => onSelect(anime)}
            className="group w-28 shrink-0 snap-start text-left outline-none sm:w-32"
          >
            <AnimeImage
              src={anime.coverImage}
              alt={`${anime.title} poster`}
              color={anime.coverColor}
              sizes="128px"
              className="aspect-[2/3] w-full rounded-xl ring-1 ring-white/10 transition-transform duration-300 group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-primary"
            />
            <p className="mt-1.5 text-[10px] font-semibold tracking-wide text-primary/90 uppercase">{label}</p>
            <p className="line-clamp-2 text-xs leading-snug font-medium">{anime.title}</p>
            <p className="text-[11px] text-muted-foreground">{[formatLabel(anime.format), anime.year].filter(Boolean).join(" · ")}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
