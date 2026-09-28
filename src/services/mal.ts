import "server-only";

import { cache, TTL } from "@/lib/server/cache";
import { fetchJson, UpstreamError, WindowLimiter } from "@/lib/server/http";
import type { Anime } from "@/types/anime";
import { normalizeJikan, normalizeMalOfficial } from "./animeNormalizer";
import type { JikanAnime, JikanRecommendation, MalOfficialAnime } from "./rawTypes";

export interface MalRecommendation {
  malId: number;
  title: string;
  image: string | null;
  votes: number;
}

/**
 * Anything that can answer MyAnimeList questions. The official MAL API is
 * used when `MAL_CLIENT_ID` is configured; otherwise Jikan (an unofficial,
 * keyless MAL mirror) provides the same data.
 */
export interface MalSource {
  readonly name: "mal-official" | "jikan";
  search(term: string, limit: number, allowAdult: boolean): Promise<Anime[]>;
  getAnime(malId: number): Promise<Anime | null>;
  getRecommendations(malId: number): Promise<MalRecommendation[]>;
}

const globalForMal = globalThis as unknown as { __jikanLimiter?: WindowLimiter; __malLimiter?: WindowLimiter };
// Jikan: 3 requests/second and 60/minute.
const jikanLimiter = (globalForMal.__jikanLimiter ??= new WindowLimiter(50, 60_000, 700));
const malLimiter = (globalForMal.__malLimiter ??= new WindowLimiter(120, 60_000, 150));

class JikanSource implements MalSource {
  readonly name = "jikan" as const;
  private base = "https://api.jikan.moe/v4";

  private get<T>(path: string) {
    return fetchJson<T>(`${this.base}${path}`, {
      source: "Jikan",
      limiter: jikanLimiter,
      retries: 1,
      timeoutMs: 8_000,
      maxRetryWaitMs: 3_000,
      headers: { Accept: "application/json" },
    });
  }

  search(term: string, limit: number, allowAdult: boolean) {
    const q = term.trim().toLowerCase();
    return cache.wrap(`jikan:search:${q}:${limit}:${allowAdult}`, TTL.hour * 6, async () => {
      const params = new URLSearchParams({ q: term.trim(), limit: String(limit), order_by: "members", sort: "desc" });
      if (!allowAdult) params.set("sfw", "true");
      const body = await this.get<{ data: JikanAnime[] }>(`/anime?${params}`);
      return body.data.map(normalizeJikan);
    });
  }

  getAnime(malId: number) {
    return cache.wrap(`jikan:anime:${malId}`, TTL.hour * 12, async () => {
      const body = await this.get<{ data: JikanAnime | null }>(`/anime/${malId}`);
      return body.data ? normalizeJikan(body.data) : null;
    });
  }

  getRecommendations(malId: number) {
    return cache.wrap(`jikan:recs:${malId}`, TTL.hour * 12, async () => {
      const body = await this.get<{ data: JikanRecommendation[] }>(`/anime/${malId}/recommendations`);
      return body.data.map((rec) => ({
        malId: rec.entry.mal_id,
        title: rec.entry.title,
        image: rec.entry.images?.webp?.large_image_url ?? rec.entry.images?.jpg?.large_image_url ?? null,
        votes: rec.votes,
      }));
    });
  }
}

const MAL_FIELDS = [
  "id",
  "title",
  "main_picture",
  "alternative_titles",
  "start_date",
  "end_date",
  "synopsis",
  "mean",
  "num_list_users",
  "media_type",
  "status",
  "genres",
  "num_episodes",
  "start_season",
  "average_episode_duration",
  "studios",
  "rating",
  "nsfw",
].join(",");

class OfficialMalSource implements MalSource {
  readonly name = "mal-official" as const;
  private base = "https://api.myanimelist.net/v2";

  constructor(private clientId: string) {}

  private get<T>(path: string) {
    return fetchJson<T>(`${this.base}${path}`, {
      source: "MyAnimeList",
      limiter: malLimiter,
      retries: 1,
      timeoutMs: 8_000,
      headers: { "X-MAL-CLIENT-ID": this.clientId, Accept: "application/json" },
    });
  }

  search(term: string, limit: number, allowAdult: boolean) {
    const q = term.trim().toLowerCase();
    return cache.wrap(`mal:search:${q}:${limit}:${allowAdult}`, TTL.hour * 6, async () => {
      const params = new URLSearchParams({ q: term.trim(), limit: String(limit), fields: MAL_FIELDS });
      if (allowAdult) params.set("nsfw", "true");
      const body = await this.get<{ data: { node: MalOfficialAnime }[] }>(`/anime?${params}`);
      return body.data.map((entry) => normalizeMalOfficial(entry.node));
    });
  }

  getAnime(malId: number) {
    return cache.wrap(`mal:anime:${malId}`, TTL.hour * 12, async () => {
      const body = await this.get<MalOfficialAnime>(`/anime/${malId}?fields=${MAL_FIELDS}`);
      return normalizeMalOfficial(body);
    });
  }

  getRecommendations(malId: number) {
    return cache.wrap(`mal:recs:${malId}`, TTL.hour * 12, async () => {
      const body = await this.get<MalOfficialAnime>(`/anime/${malId}?fields=recommendations`);
      return (body.recommendations ?? []).map((rec) => ({
        malId: rec.node.id,
        title: rec.node.title,
        image: rec.node.main_picture?.large ?? rec.node.main_picture?.medium ?? null,
        votes: rec.num_recommendations,
      }));
    });
  }
}

let source: MalSource | null = null;

export function getMalSource(): MalSource {
  if (!source) {
    const clientId = process.env.MAL_CLIENT_ID?.trim();
    source = clientId ? new OfficialMalSource(clientId) : new JikanSource();
  }
  return source;
}

/**
 * MAL data is a secondary signal: callers should never fail because MAL
 * (or Jikan) is down. Failures are remembered briefly so a dead upstream
 * isn't retried on every request.
 */
export async function safeMal<T>(key: string, fallback: T, task: (mal: MalSource) => Promise<T>, timeoutMs = 4_500): Promise<T> {
  const failKey = `mal:fail:${key}`;
  if (cache.get<boolean>(failKey) || malCircuitOpen()) return fallback;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      task(getMalSource()),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("MAL timeout")), timeoutMs);
      }),
    ]);
    breaker.failures = 0;
    return result;
  } catch (error) {
    cache.set(failKey, true, TTL.minute * 5);
    const outage = !(error instanceof UpstreamError) || error.status === 0 || error.status >= 500;
    if (outage && ++breaker.failures >= 2) breaker.openUntil = Date.now() + 3 * TTL.minute;
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[mal] ${key} unavailable:`, error instanceof Error ? error.message : error);
    }
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * When MAL itself is down, Jikan answers every request with a slow 504.
 * After two consecutive outage-style failures we stop asking for a while.
 */
const breaker = ((globalThis as unknown as { __malBreaker?: { failures: number; openUntil: number } }).__malBreaker ??= {
  failures: 0,
  openUntil: 0,
});

export function malCircuitOpen() {
  return breaker.openUntil > Date.now();
}
