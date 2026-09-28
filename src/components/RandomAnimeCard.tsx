"use client";

import { AnimeImage } from "@/components/AnimeImage";
import { AnimeMeta, GenreChips } from "@/components/AnimeMeta";
import { ExternalLinks } from "@/components/ExternalLinks";
import { Button } from "@/components/ui/button";
import { altTitle, seasonLabel, shortDescription, statusLabel } from "@/lib/format";
import type { Anime } from "@/types/anime";

export function RandomAnimeCard({ anime, onOpen }: { anime: Anime; onOpen: () => void }) {
  const subtitle = altTitle(anime);
  const when = seasonLabel(anime);

  return (
    <article
      key={anime.id}
      className="glass relative isolate overflow-hidden rounded-3xl animate-fade-up"
      style={anime.coverColor ? { boxShadow: `0 40px 100px -50px ${anime.coverColor}` } : undefined}
    >
      <div className="absolute inset-0 -z-10 opacity-35">
        <AnimeImage src={anime.bannerImage ?? anime.coverImage} alt="" sizes="100vw" className="absolute inset-0 scale-110 blur-2xl" />
        <div className="absolute inset-0 bg-gradient-to-r from-card via-card/85 to-card/60" />
      </div>

      <div className="flex flex-col gap-6 p-5 sm:flex-row sm:p-7">
        <button
          type="button"
          onClick={onOpen}
          className="group mx-auto shrink-0 outline-none sm:mx-0"
          aria-label={`Open details for ${anime.title}`}
        >
          <AnimeImage
            src={anime.coverImageLarge ?? anime.coverImage}
            alt={`${anime.title} poster`}
            color={anime.coverColor}
            priority
            sizes="224px"
            className="aspect-[2/3] w-44 rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-white/10 transition-transform duration-500 group-hover:scale-[1.03] group-focus-visible:ring-3 group-focus-visible:ring-primary sm:w-52"
          />
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {[when, statusLabel(anime.status), anime.studios[0]].filter(Boolean).join(" · ")}
            </p>
            <h3 className="font-heading text-2xl leading-tight font-bold text-balance text-white sm:text-3xl">{anime.title}</h3>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <AnimeMeta anime={anime} className="text-sm" />
          <GenreChips genres={anime.genres} max={6} />
          <p className="line-clamp-5 max-w-3xl text-sm leading-relaxed text-foreground/75">
            {shortDescription(anime.description, 520) ?? "No synopsis available for this one yet — a true mystery pick."}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
            <Button onClick={onOpen} className="h-9 rounded-full px-4">
              View details
            </Button>
            <ExternalLinks anime={anime} size="md" />
          </div>
        </div>
      </div>
    </article>
  );
}
