import "server-only";

import { cache, TTL } from "@/lib/server/cache";
import { fetchJson, UpstreamError, WindowLimiter } from "@/lib/server/http";
import type { Anime, AnimeCharacter, AnimeFormat, AnimeRelation, RandomFilters, RelationType } from "@/types/anime";
import { normalizeAniList } from "./animeNormalizer";
import type { AniListMedia } from "./rawTypes";

const ENDPOINT = "https://graphql.anilist.co";

// AniList allows 30 requests/minute at the moment (90 when not degraded).
// Keep a small margin so bursts from several users don't trip a 429.
const globalForLimiter = globalThis as unknown as { __anilistLimiter?: WindowLimiter };
const limiter = (globalForLimiter.__anilistLimiter ??= new WindowLimiter(27, 60_000, 150));

export function anilistQueueWait() {
  return limiter.estimatedWait();
}

interface GraphQLResponse<T> {
  data: T | null;
  errors?: { message: string; status?: number }[];
}

async function query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
  const body = await fetchJson<GraphQLResponse<T>>(ENDPOINT, {
    source: "AniList",
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: document, variables }),
    limiter,
    retries: 2,
    onResponse(response) {
      const remaining = Number(response.headers.get("x-ratelimit-remaining"));
      const reset = Number(response.headers.get("x-ratelimit-reset"));
      if (response.headers.has("x-ratelimit-remaining") && remaining <= 1) {
        const waitMs = reset ? reset * 1000 - Date.now() : 20_000;
        limiter.pause(Math.min(Math.max(waitMs, 1_000), 60_000));
      }
    },
  });
  if (!body.data) {
    const message = body.errors?.map((e) => e.message).join("; ") ?? "Empty response";
    throw new UpstreamError(`AniList: ${message}`, "AniList", body.errors?.[0]?.status ?? 502);
  }
  return body.data;
}

const CARD_FIELDS = `
  id idMal
  title { romaji english native }
  coverImage { extraLarge large medium color }
  bannerImage
  description(asHtml: false)
  genres
  tags { name rank category isMediaSpoiler isGeneralSpoiler }
  averageScore meanScore popularity favourites
  episodes duration season seasonYear
  startDate { year month day }
  endDate { year month day }
  studios(isMain: true) { nodes { name isAnimationStudio } }
  format status isAdult siteUrl
  trailer { id site thumbnail }
`;

const SEARCH_FIELDS = `
  id idMal
  title { romaji english native }
  coverImage { large medium color }
  genres averageScore popularity episodes
  seasonYear startDate { year month day }
  format status isAdult siteUrl
`;

const RELATION_FIELDS = `relations { edges { relationType(version: 2) node { id type } } }`;

type PageResult = { Page: { pageInfo?: { hasNextPage: boolean }; media: AniListMedia[] } };

const ALLOWED_TYPES = new Set(["ANIME"]);

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchAnime(term: string, limit = 8, allowAdult = false): Promise<Anime[]> {
  const normalized = term.trim().toLowerCase();
  if (normalized.length < 2) return [];
  return cache.wrap(`al:search:${normalized}:${limit}:${allowAdult}`, TTL.hour * 6, async () => {
    const data = await query<PageResult>(
      `query ($search: String, $perPage: Int, $isAdult: Boolean) {
        Page(perPage: $perPage) {
          media(type: ANIME, search: $search, isAdult: $isAdult, sort: [SEARCH_MATCH, POPULARITY_DESC]) { ${SEARCH_FIELDS} }
        }
      }`,
      { search: term.trim(), perPage: limit, isAdult: allowAdult ? undefined : false },
    );
    return data.Page.media.map(normalizeAniList);
  });
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** Fetch full cards for many AniList IDs in as few requests as possible. */
export async function getAnimeByIds(ids: number[]): Promise<Anime[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const found = new Map<number, Anime>();
  const missing: number[] = [];
  for (const id of unique) {
    const hit = cache.get<Anime>(`al:card:${id}`);
    if (hit) found.set(id, hit);
    else missing.push(id);
  }

  for (let i = 0; i < missing.length; i += 50) {
    const chunk = missing.slice(i, i + 50);
    const data = await query<PageResult>(
      `query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { ${CARD_FIELDS} } } }`,
      { ids: chunk },
    );
    for (const media of data.Page.media) {
      const anime = normalizeAniList(media);
      cache.set(`al:card:${media.id}`, anime, TTL.hour * 12);
      found.set(media.id, anime);
    }
  }
  return unique.map((id) => found.get(id)).filter((a): a is Anime => Boolean(a));
}

/** Resolve MAL IDs to AniList cards (AniList stores the MAL cross-reference). */
export async function getAnimeByMalIds(malIds: number[]): Promise<Anime[]> {
  const unique = Array.from(new Set(malIds.filter(Boolean)));
  const found = new Map<number, Anime>();
  const missing: number[] = [];
  for (const id of unique) {
    const hit = cache.get<Anime | null>(`al:mal:${id}`);
    if (hit !== undefined) {
      if (hit) found.set(id, hit);
    } else missing.push(id);
  }

  for (let i = 0; i < missing.length; i += 50) {
    const chunk = missing.slice(i, i + 50);
    const data = await query<PageResult>(
      `query ($ids: [Int]) { Page(perPage: 50) { media(idMal_in: $ids, type: ANIME) { ${CARD_FIELDS} } } }`,
      { ids: chunk },
    );
    for (const media of data.Page.media) {
      const anime = normalizeAniList(media);
      cache.set(`al:card:${media.id}`, anime, TTL.hour * 12);
      if (media.idMal) {
        cache.set(`al:mal:${media.idMal}`, anime, TTL.hour * 12);
        found.set(media.idMal, anime);
      }
    }
    for (const id of chunk) if (!found.has(id)) cache.set(`al:mal:${id}`, null, TTL.hour * 12);
  }
  return unique.map((id) => found.get(id)).filter((a): a is Anime => Boolean(a));
}

// ---------------------------------------------------------------------------
// Recommendation seeds
// ---------------------------------------------------------------------------

export interface RelationRef {
  relationType: RelationType;
  anilistId: number;
}

export interface AniListSeed {
  anime: Anime;
  relations: RelationRef[];
  recommendations: { anime: Anime; rating: number }[];
}

function relationRefs(media: AniListMedia): RelationRef[] {
  return (media.relations?.edges ?? [])
    .filter((edge) => edge.node && ALLOWED_TYPES.has((edge.node as AniListMedia & { type?: string }).type ?? "ANIME"))
    .map((edge) => ({ relationType: edge.relationType as RelationType, anilistId: edge.node!.id }));
}

/**
 * For each selected anime: its full card, franchise relations, and the
 * AniList community's top recommendations (with full candidate cards).
 */
export async function getSeeds(ids: number[]): Promise<AniListSeed[]> {
  const unique = Array.from(new Set(ids));
  const found = new Map<number, AniListSeed>();
  const missing = unique.filter((id) => {
    const hit = cache.get<AniListSeed>(`al:seed:${id}`);
    if (hit) found.set(id, hit);
    return !hit;
  });

  if (missing.length) {
    const data = await query<PageResult>(
      `query ($ids: [Int]) {
        Page(perPage: 10) {
          media(id_in: $ids, type: ANIME) {
            ${CARD_FIELDS}
            ${RELATION_FIELDS}
            recommendations(perPage: 25, sort: [RATING_DESC, ID]) {
              nodes { rating mediaRecommendation { ${CARD_FIELDS} } }
            }
          }
        }
      }`,
      { ids: missing },
    );
    for (const media of data.Page.media) {
      const seed: AniListSeed = {
        anime: normalizeAniList(media),
        relations: relationRefs(media),
        recommendations: (media.recommendations?.nodes ?? [])
          .filter((node) => node.mediaRecommendation && (node.rating ?? 0) > 0)
          .map((node) => ({ anime: normalizeAniList(node.mediaRecommendation!), rating: node.rating ?? 0 })),
      };
      for (const rec of seed.recommendations) {
        if (rec.anime.anilistId) cache.set(`al:card:${rec.anime.anilistId}`, rec.anime, TTL.hour * 12);
      }
      cache.set(`al:seed:${media.id}`, seed, TTL.hour * 12);
      found.set(media.id, seed);
    }
  }
  return unique.map((id) => found.get(id)).filter((s): s is AniListSeed => Boolean(s));
}

/**
 * Franchise relations (1 hop) for a set of candidates. Prequel cards are
 * fetched in the same request so later seasons can be swapped for the
 * entry a newcomer should actually start with.
 */
export async function getRelations(ids: number[]): Promise<Map<number, RelationRef[]>> {
  const result = new Map<number, RelationRef[]>();
  const missing: number[] = [];
  for (const id of new Set(ids)) {
    const hit = cache.get<RelationRef[]>(`al:rel:${id}`);
    if (hit) result.set(id, hit);
    else missing.push(id);
  }
  for (let i = 0; i < missing.length; i += 25) {
    const chunk = missing.slice(i, i + 25);
    const data = await query<PageResult>(
      `query ($ids: [Int]) {
        Page(perPage: 25) {
          media(id_in: $ids, type: ANIME) {
            id
            relations { edges { relationType(version: 2) node { type ${CARD_FIELDS} } } }
          }
        }
      }`,
      { ids: chunk },
    );
    for (const media of data.Page.media) {
      const refs = relationRefs(media);
      cache.set(`al:rel:${media.id}`, refs, TTL.hour * 12);
      result.set(media.id, refs);
      for (const edge of media.relations?.edges ?? []) {
        if (edge.relationType === "PREQUEL" && edge.node && (edge.node as AniListMedia & { type?: string }).type === "ANIME") {
          cache.set(`al:card:${edge.node.id}`, normalizeAniList(edge.node), TTL.hour * 12);
        }
      }
    }
  }
  return result;
}

export interface DiscoveryQuery {
  key: string;
  tags?: string[];
  genres?: string[];
  sort?: "POPULARITY_DESC" | "SCORE_DESC" | "TRENDING_DESC";
  popularityLesser?: number;
  perPage?: number;
}

/**
 * Tag/genre driven discovery. Several queries are sent as aliases of a
 * single GraphQL request so they cost one unit of rate limit.
 */
export async function discover(queries: DiscoveryQuery[], allowAdult = false): Promise<Record<string, Anime[]>> {
  const out: Record<string, Anime[]> = {};
  const pending = queries.filter((q) => {
    const hit = cache.get<Anime[]>(`al:discover:${q.key}:${allowAdult}`);
    if (hit) out[q.key] = hit;
    return !hit;
  });
  if (!pending.length) return out;

  const variableDefs: string[] = [];
  const variables: Record<string, unknown> = {};
  const aliases = pending.map((q, index) => {
    const args: string[] = ["type: ANIME", "status_not_in: [NOT_YET_RELEASED]", "format_not_in: [MUSIC]"];
    if (!allowAdult) args.push("isAdult: false");
    if (q.tags?.length) {
      variableDefs.push(`$t${index}: [String]`);
      variables[`t${index}`] = q.tags;
      args.push(`tag_in: $t${index}`, "minimumTagRank: 55");
    }
    if (q.genres?.length) {
      variableDefs.push(`$g${index}: [String]`);
      variables[`g${index}`] = q.genres;
      args.push(`genre_in: $g${index}`);
    }
    if (q.popularityLesser) args.push(`popularity_lesser: ${Math.round(q.popularityLesser)}`);
    args.push("popularity_greater: 2500");
    args.push(`sort: [${q.sort ?? "POPULARITY_DESC"}]`);
    return `q${index}: Page(perPage: ${q.perPage ?? 25}) { media(${args.join(", ")}) { ${CARD_FIELDS} } }`;
  });

  const document = `query${variableDefs.length ? `(${variableDefs.join(", ")})` : ""} { ${aliases.join("\n")} }`;
  const data = await query<Record<string, PageResult["Page"]>>(document, variables);
  pending.forEach((q, index) => {
    const list = (data[`q${index}`]?.media ?? []).map(normalizeAniList);
    cache.set(`al:discover:${q.key}:${allowAdult}`, list, TTL.hour * 6);
    out[q.key] = list;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

export interface AniListDetails {
  anime: Anime;
  relations: AnimeRelation[];
  recommendations: { anime: Anime; rating: number }[];
  characters: AnimeCharacter[];
}

export async function getAnimeDetails(id: number): Promise<AniListDetails | null> {
  return cache.wrap(`al:details:${id}`, TTL.hour * 6, async () => {
    try {
      const data = await query<{ Media: AniListMedia }>(
        `query ($id: Int) {
          Media(id: $id, type: ANIME) {
            ${CARD_FIELDS}
            relations { edges { relationType(version: 2) node { ${SEARCH_FIELDS} type bannerImage } } }
            recommendations(perPage: 12, sort: [RATING_DESC, ID]) {
              nodes { rating mediaRecommendation { ${SEARCH_FIELDS} bannerImage } }
            }
            characters(perPage: 8, sort: [ROLE, RELEVANCE, ID]) {
              edges { role node { name { full } image { medium } } }
            }
          }
        }`,
        { id },
      );
      const media = data.Media;
      return {
        anime: normalizeAniList(media),
        relations: (media.relations?.edges ?? [])
          .filter((edge) => edge.node && (edge.node as AniListMedia & { type?: string }).type === "ANIME")
          .map((edge) => ({ relationType: edge.relationType as RelationType, anime: normalizeAniList(edge.node!) })),
        recommendations: (media.recommendations?.nodes ?? [])
          .filter((node) => node.mediaRecommendation)
          .map((node) => ({ anime: normalizeAniList(node.mediaRecommendation!), rating: node.rating ?? 0 })),
        characters: (media.characters?.edges ?? [])
          .filter((edge) => edge.node?.name.full)
          .map((edge) => ({ name: edge.node!.name.full!, image: edge.node!.image?.medium ?? null, role: edge.role })),
      };
    } catch (error) {
      if (error instanceof UpstreamError && error.status === 404) return null;
      throw error;
    }
  });
}

// ---------------------------------------------------------------------------
// Browse helpers
// ---------------------------------------------------------------------------

export async function getTrending(limit = 12): Promise<Anime[]> {
  return cache.wrap(`al:trending:${limit}`, TTL.hour * 3, async () => {
    const data = await query<PageResult>(
      `query ($perPage: Int) {
        Page(perPage: $perPage) {
          media(type: ANIME, sort: [TRENDING_DESC], isAdult: false) { ${SEARCH_FIELDS} bannerImage }
        }
      }`,
      { perPage: limit },
    );
    return data.Page.media.map(normalizeAniList);
  });
}

export async function getGenres(): Promise<string[]> {
  return cache.wrap("al:genres", TTL.day, async () => {
    const data = await query<{ GenreCollection: string[] }>(`{ GenreCollection }`);
    return data.GenreCollection.filter((g) => g !== "Hentai");
  });
}

// ---------------------------------------------------------------------------
// Random
// ---------------------------------------------------------------------------

async function getMaxMediaId(): Promise<number> {
  return cache.wrap("al:maxId", TTL.day, async () => {
    const data = await query<PageResult>(`{ Page(perPage: 1) { media(type: ANIME, sort: [ID_DESC]) { id } } }`);
    return data.Page.media[0]?.id ?? 200_000;
  });
}

const RANDOM_FORMATS: AnimeFormat[] = ["TV", "TV_SHORT", "MOVIE", "OVA", "ONA", "SPECIAL"];

function randomFilterArgs(filters: RandomFilters, allowAdult: boolean) {
  const args: string[] = ["type: ANIME", "status_not_in: [NOT_YET_RELEASED, CANCELLED]"];
  const variables: Record<string, unknown> = {};
  const defs: string[] = [];
  if (!allowAdult) args.push("isAdult: false");
  const formats = filters.formats?.length ? filters.formats : RANDOM_FORMATS;
  args.push(`format_in: [${formats.join(", ")}]`);
  if (filters.genre) {
    defs.push("$genre: String");
    variables.genre = filters.genre;
    args.push("genre: $genre");
  }
  if (filters.minScore) args.push(`averageScore_greater: ${Math.max(0, Math.round(filters.minScore) - 1)}`);
  if (filters.finishedOnly) args.push("status: FINISHED");
  if (filters.yearFrom) args.push(`startDate_greater: ${(filters.yearFrom - 1) * 10000 + 9999}`);
  if (filters.yearTo) args.push(`startDate_lesser: ${(filters.yearTo + 1) * 10000}`);
  // A light floor keeps the pool to titles with real metadata (art,
  // synopsis, score) while still including thousands of obscure shows.
  args.push("popularity_greater: 400");
  return { args, variables, defs };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Uniform sampling over the whole AniList catalogue. AniList caps
 * pagination at 5,000 entries and no longer reports totals, so a random
 * page would only ever reach the first slice of results. Instead we
 * sample random ID batches across the full ID space and let AniList
 * apply the filters — every matching anime has the same chance of being
 * in a batch. Tight filters with a low hit rate fall back to a random
 * page inside the (then necessarily small) filtered result set.
 */
export async function getRandomAnime(filters: RandomFilters, excludeIds: number[] = [], allowAdult = false): Promise<Anime | null> {
  const maxId = await getMaxMediaId();
  const { args, variables, defs } = randomFilterArgs(filters, allowAdult);
  const exclude = new Set(excludeIds);

  const aliasCount = 3;
  const idsPerAlias = 500;
  const aliasDefs = [...defs];
  const aliases: string[] = [];
  for (let a = 0; a < aliasCount; a++) {
    const ids = new Set<number>();
    while (ids.size < idsPerAlias) ids.add(1 + Math.floor(Math.random() * maxId));
    aliasDefs.push(`$ids${a}: [Int]`);
    variables[`ids${a}`] = Array.from(ids);
    aliases.push(`s${a}: Page(perPage: 50) { media(${[...args, `id_in: $ids${a}`].join(", ")}) { ${CARD_FIELDS} } }`);
  }

  const sampled = await query<Record<string, PageResult["Page"]>>(
    `query (${aliasDefs.join(", ")}) { ${aliases.join("\n")} }`,
    variables,
  );
  const hits = Object.values(sampled)
    .flatMap((page) => page?.media ?? [])
    .filter((media) => !exclude.has(media.id) && matchesFilters(media, filters));
  if (hits.length) return normalizeAniList(shuffle(hits)[0]);

  return randomFromSmallPool(args, defs, filters, exclude);
}

/** AniList's filter index can lag its displayed values slightly; re-check what the user will see. */
function matchesFilters(media: AniListMedia, filters: RandomFilters): boolean {
  const score = media.averageScore ?? media.meanScore ?? null;
  if (filters.minScore && (score === null || score < filters.minScore)) return false;
  const year = media.seasonYear ?? media.startDate?.year ?? null;
  if (filters.yearFrom && year !== null && year < filters.yearFrom) return false;
  if (filters.yearTo && year !== null && year > filters.yearTo) return false;
  return true;
}

async function randomFromSmallPool(
  args: string[],
  defs: string[],
  filters: RandomFilters,
  exclude: Set<number>,
): Promise<Anime | null> {
  const variables: Record<string, unknown> = filters.genre ? { genre: filters.genre } : {};
  const probeKey = `al:randomProbe:${args.join("|")}:${filters.genre ?? ""}`;
  const probePages = [1, 2, 3, 5, 8, 13, 21, 34, 55, 100];

  const lastPage = await cache.wrap(probeKey, TTL.hour * 6, async () => {
    const aliases = probePages.map(
      (page) => `p${page}: Page(page: ${page}, perPage: 50) { media(${[...args, "sort: [ID]"].join(", ")}) { id } }`,
    );
    const data = await query<Record<string, PageResult["Page"]>>(
      `query${defs.length ? `(${defs.join(", ")})` : ""} { ${aliases.join("\n")} }`,
      variables,
    );
    let last = 0;
    let firstEmpty = probePages[probePages.length - 1] + 1;
    for (const page of probePages) {
      if ((data[`p${page}`]?.media.length ?? 0) > 0) last = page;
      else {
        firstEmpty = page;
        break;
      }
    }
    // The true last page lies in [last, firstEmpty); take the midpoint.
    return last === 0 ? 0 : Math.max(last, Math.floor((last + firstEmpty - 1) / 2));
  });
  if (lastPage === 0) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const page = attempt === 0 ? 1 + Math.floor(Math.random() * lastPage) : 1;
    const data = await query<PageResult>(
      `query${defs.length ? `(${defs.join(", ")})` : ""} {
        Page(page: ${page}, perPage: 50) { media(${[...args, "sort: [ID]"].join(", ")}) { ${CARD_FIELDS} } }
      }`,
      variables,
    );
    const pool = data.Page.media.filter((m) => !exclude.has(m.id) && matchesFilters(m, filters));
    if (pool.length) return normalizeAniList(shuffle(pool)[0]);
  }
  return null;
}
