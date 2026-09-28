import { ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

export function ExternalLinks({ anime, className, size = "sm" }: { anime: Anime; className?: string; size?: "sm" | "md" }) {
  const base = cn(
    "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors",
    size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm",
  );
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {anime.siteUrl && (
        <a
          href={anime.siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(base, "border-sky-400/25 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20")}
        >
          AniList <ExternalLinkIcon className="size-3" />
        </a>
      )}
      {anime.malUrl && (
        <a
          href={anime.malUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(base, "border-indigo-400/25 bg-indigo-400/10 text-indigo-200 hover:bg-indigo-400/20")}
        >
          MyAnimeList <ExternalLinkIcon className="size-3" />
        </a>
      )}
    </div>
  );
}
