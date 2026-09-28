import type { Anime, AnimeDetails, AnimeRef, ApiErrorBody, RandomFilters, Recommendation, RecommendOptions } from "@/types/anime";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("You appear to be offline. Check your connection and try again.", 0, "network");
  }
  if (!response.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(body?.error ?? `Request failed (${response.status}).`, response.status, body?.code);
  }
  return (await response.json()) as T;
}

const searchCache = new Map<string, Anime[]>();

export async function searchAnime(term: string, signal?: AbortSignal): Promise<Anime[]> {
  const key = term.trim().toLowerCase();
  const hit = searchCache.get(key);
  if (hit) return hit;
  const data = await request<{ results: Anime[] }>(`/api/search?q=${encodeURIComponent(term.trim())}`, { signal });
  searchCache.set(key, data.results);
  if (searchCache.size > 200) searchCache.delete(searchCache.keys().next().value!);
  return data.results;
}

export async function getRecommendations(selections: Anime[], options: RecommendOptions = {}): Promise<Recommendation[]> {
  const refs: AnimeRef[] = selections.map((a) => ({ anilistId: a.anilistId, malId: a.malId }));
  const data = await request<{ recommendations: Recommendation[] }>("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selections: refs, options }),
  });
  return data.recommendations;
}

export async function getRandomAnime(filters: RandomFilters | "surprise", exclude: number[] = []): Promise<Anime> {
  const params = new URLSearchParams();
  if (filters === "surprise") {
    params.set("mode", "surprise");
  } else {
    if (filters.genre) params.set("genre", filters.genre);
    if (filters.minScore) params.set("minScore", String(filters.minScore));
    if (filters.formats?.length) params.set("formats", filters.formats.join(","));
    if (filters.finishedOnly) params.set("finished", "1");
    if (filters.yearFrom) params.set("yearFrom", String(filters.yearFrom));
    if (filters.yearTo) params.set("yearTo", String(filters.yearTo));
  }
  if (exclude.length) params.set("exclude", exclude.slice(-30).join(","));
  const data = await request<{ anime: Anime }>(`/api/random?${params}`, { cache: "no-store" });
  return data.anime;
}

const detailsCache = new Map<number, AnimeDetails>();

export async function getAnimeDetails(anilistId: number, signal?: AbortSignal): Promise<AnimeDetails> {
  const hit = detailsCache.get(anilistId);
  if (hit) return hit;
  const data = await request<{ anime: AnimeDetails }>(`/api/anime/${anilistId}`, { signal });
  detailsCache.set(anilistId, data.anime);
  return data.anime;
}

export async function getAnimeByIds(ids: number[]): Promise<Anime[]> {
  const data = await request<{ results: Anime[] }>(`/api/anime?ids=${ids.join(",")}`);
  return data.results;
}

export async function getGenres(): Promise<string[]> {
  const data = await request<{ genres: string[] }>("/api/genres");
  return data.genres;
}
