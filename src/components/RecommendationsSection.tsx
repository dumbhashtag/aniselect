"use client";

import { useEffect, useState } from "react";
import { AlertCircleIcon, CheckIcon, LinkIcon, RotateCcwIcon } from "lucide-react";
import { useAnimeModal } from "@/components/AnimeModal";
import { RecommendationSkeleton } from "@/components/LoadingSkeleton";
import { RecommendationCard } from "@/components/RecommendationCard";
import { RECOMMENDATION_COUNT } from "@/lib/constants";
import type { Anime, Recommendation } from "@/types/anime";

const ANALYSIS_STEPS = [
  "Reading tags and genres from your picks…",
  "Collecting AniList community recommendations…",
  "Checking MyAnimeList user pairings…",
  "Scoring candidates against all five picks…",
  "Filtering out sequels and duplicates…",
];

export type RecommendationStatus = "idle" | "loading" | "ready" | "error";

interface RecommendationsSectionProps {
  status: RecommendationStatus;
  recommendations: Recommendation[];
  basedOn: Anime[];
  error: string | null;
  stale: boolean;
  onRetry: () => void;
}

function AnalysisTicker() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1)), 1400);
    return () => clearInterval(timer);
  }, []);
  return (
    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground" aria-live="polite">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
      {ANALYSIS_STEPS[step]}
    </p>
  );
}

export function RecommendationsSection({ status, recommendations, basedOn, error, stale, onRetry }: RecommendationsSectionProps) {
  const { open } = useAnimeModal();
  const [copied, setCopied] = useState(false);

  if (status === "idle") return null;

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the URL bar already has the link */
    }
  };

  return (
    <section id="recommendations" className="scroll-mt-20 px-4 pt-16 pb-8 sm:px-6 lg:pt-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Made for you</p>
          <h2 className="font-heading text-3xl font-bold sm:text-5xl">Your Recommendations</h2>
          {basedOn.length > 0 && (
            <p className="max-w-2xl text-sm text-muted-foreground">
              Based on {basedOn.map((a) => a.title).join(", ")}.
            </p>
          )}
          {status === "ready" && (
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={share}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 px-3 text-xs text-muted-foreground transition hover:border-white/25 hover:text-foreground"
              >
                {copied ? <CheckIcon className="size-3.5 text-match" /> : <LinkIcon className="size-3.5" />}
                {copied ? "Link copied" : "Share these picks"}
              </button>
              {stale && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary/15 px-3 text-xs font-medium text-primary transition hover:bg-primary/25"
                >
                  <RotateCcwIcon className="size-3.5" /> Your picks changed — refresh
                </button>
              )}
            </div>
          )}
        </div>

        {status === "loading" && (
          <div className="space-y-6">
            <AnalysisTicker />
            <div className="mx-auto grid max-w-2xl gap-6 lg:max-w-none lg:grid-cols-3">
              {Array.from({ length: RECOMMENDATION_COUNT }, (_, i) => (
                <RecommendationSkeleton key={i} index={i} />
              ))}
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="glass mx-auto flex max-w-lg flex-col items-center gap-3 rounded-3xl px-6 py-12 text-center">
            <AlertCircleIcon className="size-8 text-destructive" />
            <p className="font-medium">We couldn’t build your recommendations.</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-sky-300"
            >
              <RotateCcwIcon className="size-4" /> Try again
            </button>
          </div>
        )}

        {status === "ready" && (
          <div className="mx-auto grid max-w-2xl gap-6 lg:max-w-none lg:grid-cols-3">
            {recommendations.map((rec, index) => (
              <RecommendationCard key={rec.anime.id} recommendation={rec} rank={index} onOpen={() => open(rec.anime)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
