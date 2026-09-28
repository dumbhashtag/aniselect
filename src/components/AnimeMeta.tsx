import { StarIcon } from "lucide-react";
import { episodesLabel, formatLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

export function AnimeMeta({ anime, className }: { anime: Anime; className?: string }) {
  const items = [anime.year ? String(anime.year) : null, formatLabel(anime.format), episodesLabel(anime)].filter(
    (x): x is string => Boolean(x),
  );
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      {anime.score ? (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
          <StarIcon className="size-3.5 fill-current" />
          {anime.score}%
        </span>
      ) : (
        <span className="text-muted-foreground/70">No score yet</span>
      )}
      {items.map((item) => (
        <span key={item} className="flex items-center gap-3 before:size-1 before:rounded-full before:bg-white/20">
          {item}
        </span>
      ))}
    </div>
  );
}

export function GenreChips({ genres, max = 4, className }: { genres: string[]; max?: number; className?: string }) {
  if (!genres.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {genres.slice(0, max).map((genre) => (
        <span key={genre} className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-medium text-foreground/85">
          {genre}
        </span>
      ))}
    </div>
  );
}

export function TagList({ tags, max = 5, className }: { tags: string[]; max?: number; className?: string }) {
  if (!tags.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-x-2.5 gap-y-1", className)}>
      {tags.slice(0, max).map((tag) => (
        <span key={tag} className="text-[11px] text-primary/85">
          #{tag.replace(/\s+/g, "")}
        </span>
      ))}
    </div>
  );
}
