"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimeModalProvider } from "@/components/AnimeModal";
import { RandomizerSection } from "@/components/RandomizerSection";
import { RecommendationsSection, type RecommendationStatus } from "@/components/RecommendationsSection";
import { SelectionBoard } from "@/components/SelectionBoard";
import { ApiError, getAnimeByIds, getRecommendations } from "@/lib/api-client";
import { containsAnime } from "@/lib/anime-utils";
import { REQUIRED_PICKS } from "@/lib/constants";
import type { Anime, Recommendation } from "@/types/anime";

const EMPTY: (Anime | null)[] = Array.from({ length: REQUIRED_PICKS }, () => null);

const picksKey = (list: (Anime | null)[]) =>
  list
    .filter((a): a is Anime => Boolean(a))
    .map((a) => a.id)
    .sort()
    .join(",");

function writePicksToUrl(picks: Anime[]) {
  const ids = picks.map((a) => a.anilistId).filter(Boolean);
  const url = new URL(window.location.href);
  if (ids.length === REQUIRED_PICKS) url.searchParams.set("picks", ids.join(","));
  else url.searchParams.delete("picks");
  window.history.replaceState(null, "", url);
}

export function HomeClient({ hero }: { hero: React.ReactNode }) {
  const [selections, setSelections] = useState<(Anime | null)[]>(EMPTY);
  const [status, setStatus] = useState<RecommendationStatus>("idle");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [basedOn, setBasedOn] = useState<Anime[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hiddenGems, setHiddenGems] = useState(false);
  const [submittedKey, setSubmittedKey] = useState<string | null>(null);
  const requestId = useRef(0);

  const run = useCallback(async (picks: Anime[], gems: boolean) => {
    const id = ++requestId.current;
    setStatus("loading");
    setError(null);
    setBasedOn(picks);
    setSubmittedKey(`${picksKey(picks)}|${gems}`);
    requestAnimationFrame(() => document.getElementById("recommendations")?.scrollIntoView({ behavior: "smooth" }));
    try {
      const recs = await getRecommendations(picks, { hiddenGems: gems });
      if (id !== requestId.current) return;
      setRecommendations(recs);
      setStatus("ready");
      writePicksToUrl(picks);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }, []);

  // Restore picks from a shared link (?picks=1,2,3,4,5) and run them.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("picks");
    const ids = (param ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, REQUIRED_PICKS);
    if (!ids.length) return;
    getAnimeByIds(ids)
      .then((found) => {
        const ordered = ids.map((id) => found.find((a) => a.anilistId === id) ?? null);
        setSelections([...ordered, ...EMPTY].slice(0, REQUIRED_PICKS));
        const complete = ordered.filter((a): a is Anime => Boolean(a));
        if (complete.length === REQUIRED_PICKS) run(complete, false);
      })
      .catch(() => undefined);
  }, [run]);

  const pick = (index: number, anime: Anime) => {
    setSelections((current) => {
      if (containsAnime(current.filter((_, i) => i !== index), anime)) return current;
      const next = [...current];
      next[index] = anime;
      return next;
    });
  };

  const remove = (index: number) => {
    setSelections((current) => current.map((a, i) => (i === index ? null : a)));
  };

  const clear = () => {
    setSelections(EMPTY);
  };

  const complete = selections.filter((a): a is Anime => Boolean(a));
  const submit = () => {
    if (complete.length === REQUIRED_PICKS) run(complete, hiddenGems);
  };
  const stale = status === "ready" && submittedKey !== `${picksKey(selections)}|${hiddenGems}`;

  return (
    <AnimeModalProvider>
      <section id="top" className="relative isolate px-4 pt-14 pb-16 sm:px-6 sm:pt-20 lg:pt-24">
        {hero}
        <div className="relative mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-3xl text-center animate-fade-up">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="size-1.5 rounded-full bg-match" /> Live data from AniList & MyAnimeList
            </p>
            <h1 className="font-heading text-5xl leading-[0.95] font-extrabold tracking-tight text-balance sm:text-7xl">
              Find your <span className="text-gradient">next anime</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
              Pick 5 anime you love and we’ll find 3 you should watch next.
            </p>
          </div>
          <div className="glass rounded-[2rem] p-4 shadow-2xl shadow-black/30 sm:p-6 lg:p-8">
            <SelectionBoard
              selections={selections}
              onPick={pick}
              onRemove={remove}
              onClear={clear}
              onSubmit={submit}
              submitting={status === "loading"}
              hiddenGems={hiddenGems}
              onHiddenGemsChange={setHiddenGems}
            />
          </div>
        </div>
      </section>

      <RecommendationsSection
        status={status}
        recommendations={recommendations}
        basedOn={basedOn}
        error={error}
        stale={stale}
        onRetry={() => (complete.length === REQUIRED_PICKS ? submit() : basedOn.length && run(basedOn, hiddenGems))}
      />

      <RandomizerSection />
    </AnimeModalProvider>
  );
}
