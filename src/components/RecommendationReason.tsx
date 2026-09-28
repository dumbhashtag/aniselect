import { SparklesIcon } from "lucide-react";
import { AnimeImage } from "@/components/AnimeImage";
import type { Recommendation } from "@/types/anime";

export function RecommendationReason({ recommendation }: { recommendation: Recommendation }) {
  const { reasons, relatedTo } = recommendation;
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-primary uppercase">
          <SparklesIcon className="size-3.5" /> Why this pick
        </p>
        <div className="flex -space-x-2" aria-label={`Related to ${relatedTo.map((a) => a.title).join(", ")}`}>
          {relatedTo.slice(0, 5).map((anime) => (
            <AnimeImage
              key={anime.id}
              src={anime.coverImage}
              alt={anime.title}
              color={anime.coverColor}
              sizes="28px"
              className="h-9 w-6 rounded-[5px] ring-2 ring-card"
            />
          ))}
        </div>
      </div>
      <ul className="space-y-2 text-[13px] leading-relaxed text-foreground/85">
        {reasons.map((reason, i) => (
          <li key={i} className={i === 0 ? "text-foreground" : "flex gap-2 text-muted-foreground"}>
            {i > 0 && <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/60" />}
            <span>{reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
