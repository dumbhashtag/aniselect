import "server-only";

import type { Anime, AnimeDetails, RandomFilters, SimilarAnime } from "@/types/anime";
import * as anilist from "./anilist";
import { dedupeAnime, mergeAnime } from "./animeNormalizer";
import { getMalSource, malCircuitOpen, safeMal } from "./mal";

export interface SearchResponse {
  results: Anime[];
  source: "anilist" | "mal" | "mixed";
}

/**
 * AniList is the primary search index. If it's failing or its rate-limit
 * queue is long, MyAnimeList (Jikan) answers instead so typing stays snappy.
 */
export async function searchAnime(term: string, limit = 8, allowAdult = false): Promise<SearchResponse> {
  const preferMal = anilist.anilistQueueWait() > 2_500 && !malCircuitOpen();
  if (!preferMal) {
    try {
      return { results: await anilist.searchAnime(term, limit, allowAdult), source: "anilist" };
    } catch (error) {
      const fallback = await safeMal(`search:${term}`, null as Anime[] | null, (mal) => mal.search(term, limit, allowAdult));
      if (fallback) return { results: dedupeAnime(fallback).slice(0, limit), source: "mal" };
      throw error;
    }
  }
  try {
    const results = await getMalSource().search(term, limit, allowAdult);
    return { results: dedupeAnime(results).slice(0, limit), source: "mal" };
  } catch {
    return { results: await anilist.searchAnime(term, limit, allowAdult), source: "anilist" };
  }
}

export async function getAnimeByIds(ids: number[]): Promise<Anime[]> {
  return anilist.getAnimeByIds(ids);
}

export async function getAnimeDetails(anilistId: number): Promise<AnimeDetails | null> {
  const base = await anilist.getAnimeDetails(anilistId);
  if (!base) return null;
  const malId = base.anime.malId;

  const [malAnime, malRecs] = malId
    ? await Promise.all([
        safeMal(`anime:${malId}`, null as Anime | null, (mal) => mal.getAnime(malId)),
        safeMal(`recs:${malId}`, [], (mal) => mal.getRecommendations(malId)),
      ])
    : [null, []];

  const anime = malAnime ? mergeAnime(base.anime, malAnime) : base.anime;

  const similar: SimilarAnime[] = base.recommendations
    .filter((r) => r.rating > 0)
    .map((r) => ({ anime: r.anime, votes: r.rating, source: "anilist" as const }));

  const knownMal = new Set(similar.map((s) => s.anime.malId).filter(Boolean));
  const extraMal = malRecs.filter((r) => !knownMal.has(r.malId)).slice(0, 6);
  if (extraMal.length) {
    try {
      const resolved = await anilist.getAnimeByMalIds(extraMal.map((r) => r.malId));
      for (const rec of extraMal) {
        const match = resolved.find((a) => a.malId === rec.malId);
        if (match) similar.push({ anime: match, votes: rec.votes, source: "mal" });
      }
    } catch {
      /* MAL-only similar titles are a bonus */
    }
  }

  const seen = new Set<string>();
  const uniqueSimilar = similar.filter((s) => {
    if (seen.has(s.anime.id) || s.anime.anilistId === anilistId) return false;
    seen.add(s.anime.id);
    return true;
  });

  return {
    ...anime,
    relations: base.relations,
    similar: uniqueSimilar.slice(0, 12),
    characters: base.characters,
    malScore: malAnime?.score ?? null,
  };
}

export async function getRandomAnime(filters: RandomFilters, exclude: number[] = []): Promise<Anime | null> {
  return anilist.getRandomAnime(filters, exclude);
}

export async function getGenres(): Promise<string[]> {
  return anilist.getGenres();
}

export async function getTrending(limit = 12): Promise<Anime[]> {
  return anilist.getTrending(limit);
}
