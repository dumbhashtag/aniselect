"use client";

import { AnimeImage } from "@/components/AnimeImage";
import { AnimeMeta, GenreChips, TagList } from "@/components/AnimeMeta";
import { ExternalLinks } from "@/components/ExternalLinks";
import { MatchRing } from "@/components/MatchRing";
import { RecommendationReason } from "@/components/RecommendationReason";
import { altTitle, shortDescription } from "@/lib/format";
import type { Recommendation } from "@/types/anime";

interface RecommendationCardProps {
  recommendation: Recommendation;
  rank: number;
  onOpen: () => void;
}

export function RecommendationCard({ recommendation, rank, onOpen }: RecommendationCardProps) {
  const { anime } = recommendation;
  const subtitle = altTitle(anime);
  const topTags = recommendation.sharedTags.length
    ? recommendation.sharedTags
    : anime.tags.filter((t) => !t.isSpoiler).map((t) => t.name);
  const accent = anime.coverColor ?? "#3db4f2";

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`${anime.title}, ${recommendation.matchPercentage}% match. Open details.`}
      className="group glass relative flex cursor-pointer flex-col overflow-hidden rounded-3xl text-left transition-all duration-300 animate-fade-up outline-none hover:-translate-y-1.5 hover:border-white/15 focus-visible:ring-3 focus-visible:ring-primary/50"
      style={{ animationDelay: `${rank * 110}ms`, boxShadow: `0 30px 80px -40px ${accent}` }}
    >
      <div className="relative h-36 overflow-hidden sm:h-40">
        {anime.bannerImage ? (
          <AnimeImage
            src={anime.bannerImage}
            alt=""
            sizes="(min-width: 1024px) 33vw, 100vw"
            className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 scale-125 opacity-70 blur-2xl">
            <AnimeImage src={anime.coverImage} alt="" sizes="200px" className="absolute inset-0" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        <span className="absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 font-heading text-xs font-bold text-white backdrop-blur-md">
          #{rank + 1} pick
        </span>
        <MatchRing value={recommendation.matchPercentage} className="absolute top-3 right-3" />
      </div>

      <div className="relative -mt-20 flex gap-4 px-5">
        <AnimeImage
          src={anime.coverImageLarge ?? anime.coverImage}
          alt={`${anime.title} poster`}
          color={anime.coverColor}
          sizes="128px"
          className="aspect-[2/3] w-28 shrink-0 rounded-xl shadow-2xl shadow-black/60 ring-1 ring-white/10 sm:w-32"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-end pb-1">
          <h3 className="line-clamp-3 font-heading text-lg leading-tight font-bold text-balance text-white sm:text-xl">
            {anime.titleEnglish ?? anime.title}
          </h3>
          {subtitle && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{subtitle}</p>}
          {recommendation.isFranchiseEntry && (
            <span className="mt-2 w-fit rounded-full bg-glow/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-glow uppercase">
              Continue the story
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <AnimeMeta anime={anime} />
        <div className="space-y-2">
          <GenreChips genres={anime.genres} />
          <TagList tags={topTags} />
        </div>
        <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
          {shortDescription(anime.description, 320) ?? "No synopsis available yet."}
        </p>
        <RecommendationReason recommendation={recommendation} />
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <ExternalLinks anime={anime} />
          <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
            Details →
          </span>
        </div>
      </div>
    </article>
  );
}
