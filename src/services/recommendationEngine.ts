import "server-only";

import type {
  Anime,
  AnimeFormat,
  AnimeRef,
  AnimeTag,
  Recommendation,
  RecommendationSignals,
  RecommendOptions,
  RelationType,
} from "@/types/anime";
import {
  discover,
  getAnimeByIds,
  getAnimeByMalIds,
  getRelations,
  getSeeds,
  type AniListSeed,
  type DiscoveryQuery,
  type RelationRef,
} from "./anilist";
import { safeMal, type MalRecommendation } from "./mal";

export class RecommendationError extends Error {
  constructor(message: string, public readonly status = 422) {
    super(message);
    this.name = "RecommendationError";
  }
}

/**
 * Relative weight of each signal in the final score. They sum to 1 so the
 * score is a 0-1 similarity that maps directly to the match percentage.
 */
export const WEIGHTS = {
  community: 0.3,
  tags: 0.27,
  genres: 0.1,
  coverage: 0.16,
  studio: 0.04,
  format: 0.03,
  era: 0.03,
  quality: 0.07,
} as const;

const RESULT_COUNT = 3;
const MIN_TAG_RANK = 45;
const FRANCHISE_RELATIONS = new Set<RelationType>([
  "PREQUEL",
  "SEQUEL",
  "PARENT",
  "SIDE_STORY",
  "SPIN_OFF",
  "ALTERNATIVE",
  "SUMMARY",
  "COMPILATION",
  "CONTAINS",
  "CHARACTER",
  "OTHER",
]);
/** Relations that indicate "same story" strongly enough to link two hops away. */
const STRONG_FRANCHISE = new Set<RelationType>(["PREQUEL", "SEQUEL", "PARENT", "SIDE_STORY", "ALTERNATIVE", "SUMMARY", "COMPILATION", "CONTAINS", "SPIN_OFF"]);

/** Some tags describe the cast or production rather than the story; they are weak similarity evidence. */
function tagCategoryWeight(tag: AnimeTag): number {
  const category = tag.category ?? "";
  if (category.startsWith("Cast")) return 0.35;
  if (category === "Technical") return 0.3;
  if (category.startsWith("Demographic")) return 0.6;
  if (category === "MyAnimeList") return 0.7;
  return 1;
}

type Vector = Map<string, number>;

function tagVector(anime: Anime): Vector {
  const vector: Vector = new Map();
  for (const tag of anime.tags) {
    if (tag.isSpoiler || tag.rank < MIN_TAG_RANK) continue;
    vector.set(tag.name, (tag.rank / 100) * tagCategoryWeight(tag));
  }
  return vector;
}

function genreVector(anime: Anime): Vector {
  return new Map(anime.genres.map((g) => [g, 1]));
}

function cosine(a: Vector, b: Vector): number {
  if (!a.size || !b.size) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [key, value] of a) {
    normA += value * value;
    const other = b.get(key);
    if (other) dot += value * other;
  }
  for (const value of b.values()) normB += value * value;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function addVector(target: Vector, source: Vector, scale = 1) {
  for (const [key, value] of source) target.set(key, (target.get(key) ?? 0) + value * scale);
}

function formatGroup(format: AnimeFormat): string {
  if (format === "TV" || format === "TV_SHORT" || format === "ONA") return "series";
  if (format === "OVA" || format === "SPECIAL") return "ova";
  return format.toLowerCase();
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

interface Seed {
  index: number;
  anime: Anime;
  tags: Vector;
  genres: Vector;
  relations: RelationRef[];
  alRecs: Map<number, number>;
  malRecs: Map<number, number>;
  maxRating: number;
  maxVotes: number;
}

interface Candidate {
  anime: Anime;
  alLinks: Map<number, number>;
  malLinks: Map<number, number>;
  fromDiscovery: boolean;
  /** Later franchise entries whose community signal was folded into this one. */
  absorbed: Anime[];
}

interface Scored {
  candidate: Candidate;
  /** 0-1 taste similarity; drives the match percentage. */
  similarity: number;
  /** Similarity after ranking adjustments (hidden gems, specials, sequels). */
  rankScore: number;
  signals: RecommendationSignals;
  affinity: number[];
  sharedTags: string[];
  sharedGenres: string[];
  sequelOf: Seed | null;
}

interface Profile {
  tags: Vector;
  genres: Vector;
  tagSeedCount: Map<string, number>;
  genreSeedCount: Map<string, number>;
  studios: Map<string, number[]>;
  years: number[];
  formats: string[];
}

function buildProfile(seeds: Seed[]): Profile {
  const profile: Profile = {
    tags: new Map(),
    genres: new Map(),
    tagSeedCount: new Map(),
    genreSeedCount: new Map(),
    studios: new Map(),
    years: [],
    formats: [],
  };
  for (const seed of seeds) {
    addVector(profile.tags, seed.tags);
    addVector(profile.genres, seed.genres);
    for (const tag of seed.tags.keys()) profile.tagSeedCount.set(tag, (profile.tagSeedCount.get(tag) ?? 0) + 1);
    for (const genre of seed.genres.keys()) profile.genreSeedCount.set(genre, (profile.genreSeedCount.get(genre) ?? 0) + 1);
    for (const studio of seed.anime.studios) {
      profile.studios.set(studio, [...(profile.studios.get(studio) ?? []), seed.index]);
    }
    if (seed.anime.year) profile.years.push(seed.anime.year);
    profile.formats.push(formatGroup(seed.anime.format));
  }
  // Themes shared by several picks describe the user's taste far better
  // than a tag that only one pick has, so boost them super-linearly.
  for (const [tag, weight] of profile.tags) {
    const count = profile.tagSeedCount.get(tag) ?? 1;
    profile.tags.set(tag, weight * (1 + 0.35 * (count - 1)));
  }
  for (const [genre, weight] of profile.genres) {
    const count = profile.genreSeedCount.get(genre) ?? 1;
    profile.genres.set(genre, weight * (1 + 0.25 * (count - 1)));
  }
  return profile;
}

function buildDiscoveryQueries(profile: Profile, options: RecommendOptions): DiscoveryQuery[] {
  const rankedTags = [...profile.tags.entries()]
    .filter(([tag]) => (profile.tagSeedCount.get(tag) ?? 0) >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);
  const fallbackTags = [...profile.tags.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  const tags = (rankedTags.length >= 3 ? rankedTags : [...new Set([...rankedTags, ...fallbackTags])]).slice(0, 4);
  const genres = [...profile.genres.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);

  const sort = options.hiddenGems ? "SCORE_DESC" : "POPULARITY_DESC";
  const popularityLesser = options.hiddenGems ? 80_000 : undefined;
  const pairs: [string, string][] = [];
  for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) pairs.push([tags[i], tags[j]]);

  const queries: DiscoveryQuery[] = pairs.slice(0, 4).map((pair) => ({
    key: `tags:${[...pair].sort().join("+")}:${sort}:${popularityLesser ?? ""}`,
    tags: pair,
    sort,
    popularityLesser,
    perPage: 20,
  }));
  if (genres.length >= 2 && tags[0]) {
    queries.push({
      key: `genres:${genres.slice(0, 2).sort().join("+")}:${tags[0]}:SCORE_DESC:${popularityLesser ?? ""}`,
      genres: genres.slice(0, 2),
      tags: [tags[0]],
      sort: "SCORE_DESC",
      popularityLesser,
      perPage: 20,
    });
  }
  return queries;
}

function scoreCandidate(candidate: Candidate, seeds: Seed[], profile: Profile, options: RecommendOptions): Scored {
  const anime = candidate.anime;
  const tags = tagVector(anime);
  const genres = genreVector(anime);

  const affinity: number[] = [];
  let recProduct = 1;
  let malProduct = 1;
  let studioSeeds = 0;
  let sequelOf: Seed | null = null;

  for (const seed of seeds) {
    const rating = candidate.alLinks.get(seed.index) ?? 0;
    const votes = candidate.malLinks.get(seed.index) ?? 0;
    const recNorm = rating > 0 ? 0.35 + 0.65 * (Math.log1p(rating) / Math.log1p(Math.max(seed.maxRating, 1))) : 0;
    const malNorm = votes > 0 ? 0.35 + 0.65 * (Math.log1p(votes) / Math.log1p(Math.max(seed.maxVotes, 1))) : 0;
    recProduct *= 1 - 0.6 * recNorm;
    malProduct *= 1 - 0.5 * malNorm;

    const contentSim = 0.7 * cosine(seed.tags, tags) + 0.3 * cosine(seed.genres, genres);
    const communitySim = 1 - (1 - 0.9 * recNorm) * (1 - 0.8 * malNorm);
    affinity.push(Math.max(contentSim, communitySim, 0.6 * contentSim + 0.6 * communitySim));

    if (anime.studios.some((s) => seed.anime.studios.includes(s))) studioSeeds++;
    if (seed.relations.some((r) => r.relationType === "SEQUEL" && r.anilistId === anime.anilistId)) sequelOf = seed;
  }

  const alStrength = 1 - recProduct;
  const malStrength = 1 - malProduct;
  const community = 1 - (1 - alStrength) * (1 - 0.85 * malStrength);
  const tagSimilarity = cosine(profile.tags, tags);
  const genreSimilarity = cosine(profile.genres, genres);
  const connected = affinity.filter((a) => a >= 0.4).length;
  const coverage = seeds.length ? connected / seeds.length : 0;
  const studioMatch = clamp01(studioSeeds / 2);
  const group = formatGroup(anime.format);
  const formatMatch = profile.formats.length ? profile.formats.filter((f) => f === group).length / profile.formats.length : 0;
  const eraMatch =
    anime.year && profile.years.length
      ? Math.exp(-(Math.min(...profile.years.map((y) => Math.abs(y - anime.year!))) ** 2) / (2 * 8 ** 2))
      : 0.4;
  const quality = anime.score ? clamp01((anime.score - 55) / 35) : 0.35;

  const similarity =
    WEIGHTS.community * community +
    WEIGHTS.tags * tagSimilarity +
    WEIGHTS.genres * genreSimilarity +
    WEIGHTS.coverage * coverage +
    WEIGHTS.studio * studioMatch +
    WEIGHTS.format * formatMatch +
    WEIGHTS.era * eraMatch +
    WEIGHTS.quality * quality;

  // Ranking adjustments change *what* we pick, not how similar it is, so
  // they don't feed into the displayed match percentage.
  let rankScore = similarity;
  const popularity = anime.popularity ?? 0;
  if (options.hiddenGems) {
    const popNorm = clamp01((Math.log10(Math.max(popularity, 1)) - 4) / (Math.log10(700_000) - 4));
    rankScore *= 1 - 0.55 * popNorm;
  } else if (popularity < 4_000) {
    // Very small audiences mean noisy tags and scores.
    rankScore *= 0.9;
  }
  if (anime.format === "SPECIAL" || (anime.format === "OVA" && (anime.episodes ?? 1) <= 2)) rankScore *= 0.85;
  if (sequelOf) rankScore *= 0.8;

  const sharedTags = [...tags.entries()]
    .filter(([tag]) => profile.tags.has(tag) && isThemeTag(anime, tag))
    .sort((a, b) => b[1] * (profile.tags.get(b[0]) ?? 0) - a[1] * (profile.tags.get(a[0]) ?? 0))
    .map(([tag]) => tag);
  const sharedGenres = anime.genres
    .filter((g) => profile.genres.has(g))
    .sort((a, b) => (profile.genres.get(b) ?? 0) - (profile.genres.get(a) ?? 0));

  return {
    candidate,
    similarity,
    rankScore,
    affinity,
    sharedTags,
    sharedGenres,
    sequelOf,
    signals: {
      anilistRecommendations: round(alStrength),
      malRecommendations: round(malStrength),
      tagSimilarity: round(tagSimilarity),
      genreSimilarity: round(genreSimilarity),
      coverage: round(coverage),
      studioMatch: round(studioMatch),
      formatMatch: round(formatMatch),
      eraMatch: round(eraMatch),
      quality: round(quality),
    },
  };
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Convert the 0-1 similarity score into a match percentage. The curve is
 * concave because a perfect score on every signal is practically
 * impossible; a strong multi-signal match (~0.7) reads as ~85%.
 */
export function toMatchPercentage(score: number): number {
  return Math.max(1, Math.min(99, Math.round(100 * clamp01(score / 0.9) ** 0.7)));
}

/** Cast/production tags are useful for scoring but read poorly as "themes". */
function isThemeTag(anime: Anime, name: string): boolean {
  const tag = anime.tags.find((t) => t.name === name);
  const category = tag?.category ?? "";
  return !(category.startsWith("Cast") || category.startsWith("Sexual") || category === "Technical" || category.startsWith("Demographic"));
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function buildReasons(scored: Scored, seeds: Seed[], relatedTo: Seed[]): string[] {
  const reasons: string[] = [];
  const anime = scored.candidate.anime;

  if (scored.sequelOf) {
    reasons.push(`Continues the story of ${scored.sequelOf.anime.title}, which you picked — a natural next watch.`);
  }

  const likedNames = relatedTo.slice(0, 3).map((s) => s.anime.title);
  const extra = relatedTo.length - likedNames.length;
  const themes = [...scored.sharedGenres.slice(0, 2), ...scored.sharedTags.filter((t) => !scored.sharedGenres.includes(t)).slice(0, 3)];
  const liked = `Recommended because you liked ${joinNames(likedNames)}${extra > 0 ? ` (and ${extra} more of your picks)` : ""}.`;
  reasons.push(themes.length ? `${liked} Shares ${joinNames(themes)} themes.` : liked);

  const alSeeds = seeds.filter((s) => scored.candidate.alLinks.has(s.index));
  const malSeeds = seeds.filter((s) => scored.candidate.malLinks.has(s.index));
  if (alSeeds.length) {
    const votes = alSeeds.reduce((sum, s) => sum + (scored.candidate.alLinks.get(s.index) ?? 0), 0);
    reasons.push(
      `AniList fans recommend it to people who liked ${joinNames(alSeeds.map((s) => s.anime.title))} (${votes.toLocaleString("en-US")} community votes).`,
    );
  }
  if (malSeeds.length) {
    reasons.push(`MyAnimeList users pair it with ${joinNames(malSeeds.map((s) => s.anime.title))}.`);
  }

  const studio = anime.studios.find((st) => seeds.some((s) => s.anime.studios.includes(st)));
  if (studio) {
    const from = seeds.filter((s) => s.anime.studios.includes(studio)).map((s) => s.anime.title);
    reasons.push(`Animated by ${studio}, the studio behind ${joinNames(from.slice(0, 2))}.`);
  }

  if (scored.candidate.absorbed.length) {
    reasons.push(
      `Start here: fans also recommend its follow-up ${joinNames(scored.candidate.absorbed.slice(0, 2).map((a) => a.title))}, and those votes count toward this pick.`,
    );
  }

  if ((anime.popularity ?? Infinity) < 40_000 && (anime.score ?? 0) >= 75) {
    reasons.push(`A lesser-known gem with a ${anime.score}% average score.`);
  }
  return reasons;
}

async function resolveAniListIds(selected: (Anime | AnimeRef)[]): Promise<number[]> {
  const direct = selected.map((s) => s.anilistId).filter((id): id is number => Boolean(id));
  const malOnly = selected.filter((s) => !s.anilistId && s.malId).map((s) => s.malId!);
  if (!malOnly.length) return direct;
  const mapped = await getAnimeByMalIds(malOnly);
  return [...direct, ...mapped.map((a) => a.anilistId!).filter(Boolean)];
}

/**
 * Recommend anime from a user's favourites.
 *
 * 1. Load each pick's AniList card, franchise relations and community recs,
 *    plus MyAnimeList community recs (optional — skipped if MAL is down).
 * 2. Build a taste profile (weighted tag/genre vectors, studios, era, format).
 * 3. Collect candidates: AniList recs + MAL recs + tag-driven discovery.
 * 4. Score every candidate against the profile and each individual pick.
 * 5. Remove picks, duplicates and franchise entries (allowing at most one
 *    direct sequel), then return the top results with explanations.
 */
export async function recommendAnime(
  selected: (Anime | AnimeRef)[],
  options: RecommendOptions = {},
  count = RESULT_COUNT,
): Promise<Recommendation[]> {
  const ids = await resolveAniListIds(selected);
  if (ids.length < 1) throw new RecommendationError("None of the selected anime could be found on AniList.");

  const selectedMalIds = new Set(selected.map((s) => s.malId).filter((id): id is number => Boolean(id)));
  const [rawSeeds, malRecLists] = await Promise.all([
    getSeeds(ids),
    Promise.all(
      [...selectedMalIds].map((malId) =>
        safeMal<MalRecommendation[]>(`recs:${malId}`, [], (mal) => mal.getRecommendations(malId)).then(
          (recs) => [malId, recs] as const,
        ),
      ),
    ),
  ]);
  if (!rawSeeds.length) throw new RecommendationError("Couldn't load the selected anime from AniList.", 502);

  const malRecsBySeedMal = new Map(malRecLists);
  const seeds: Seed[] = rawSeeds.map((raw: AniListSeed, index) => {
    const malRecs = new Map<number, number>();
    for (const rec of (raw.anime.malId ? malRecsBySeedMal.get(raw.anime.malId) : undefined) ?? []) {
      if (rec.votes > 0) malRecs.set(rec.malId, rec.votes);
    }
    const alRecs = new Map(raw.recommendations.map((r) => [r.anime.anilistId!, r.rating]));
    return {
      index,
      anime: raw.anime,
      tags: tagVector(raw.anime),
      genres: genreVector(raw.anime),
      relations: raw.relations,
      alRecs,
      malRecs,
      maxRating: Math.max(1, ...alRecs.values()),
      maxVotes: Math.max(1, ...malRecs.values()),
    };
  });

  const selectedIds = new Set(seeds.map((s) => s.anime.anilistId!));
  for (const seed of seeds) if (seed.anime.malId) selectedMalIds.add(seed.anime.malId);
  const profile = buildProfile(seeds);

  const candidates = new Map<number, Candidate>();
  const addCandidate = (anime: Anime) => {
    if (!anime.anilistId || selectedIds.has(anime.anilistId)) return null;
    if (anime.malId && selectedMalIds.has(anime.malId)) return null;
    let entry = candidates.get(anime.anilistId);
    if (!entry) {
      entry = { anime, alLinks: new Map(), malLinks: new Map(), fromDiscovery: false, absorbed: [] };
      candidates.set(anime.anilistId, entry);
    }
    return entry;
  };

  rawSeeds.forEach((raw, index) => {
    for (const rec of raw.recommendations) addCandidate(rec.anime)?.alLinks.set(index, rec.rating);
  });

  // MAL recommendations only carry a MAL ID; resolve them to AniList cards.
  const malToCandidate = new Map<number, Candidate>();
  for (const c of candidates.values()) if (c.anime.malId) malToCandidate.set(c.anime.malId, c);
  const unresolvedMal = new Set<number>();
  for (const seed of seeds) {
    const top = [...seed.malRecs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    for (const [malId] of top) if (!malToCandidate.has(malId) && !selectedMalIds.has(malId)) unresolvedMal.add(malId);
  }

  const [malResolved, discovered] = await Promise.all([
    unresolvedMal.size ? getAnimeByMalIds([...unresolvedMal]).catch(() => [] as Anime[]) : Promise.resolve([] as Anime[]),
    discover(buildDiscoveryQueries(profile, options), options.allowAdult).catch(() => ({}) as Record<string, Anime[]>),
  ]);
  for (const anime of malResolved) {
    const entry = addCandidate(anime);
    if (entry && anime.malId) malToCandidate.set(anime.malId, entry);
  }
  for (const seed of seeds) {
    for (const [malId, votes] of seed.malRecs) {
      const entry = malToCandidate.get(malId);
      if (entry) {
        entry.malLinks.set(seed.index, votes);
        if (!entry.anime.sources.includes("mal")) {
          entry.anime = { ...entry.anime, sources: [...entry.anime.sources, "mal"] };
        }
      }
    }
  }
  for (const list of Object.values(discovered)) {
    for (const anime of list) {
      const entry = addCandidate(anime);
      if (entry) entry.fromDiscovery = true;
    }
  }

  // Franchise map: every entry directly related to a pick.
  const directFranchise = new Map<number, { seed: Seed; type: RelationType }>();
  for (const seed of seeds) {
    for (const rel of seed.relations) {
      if (FRANCHISE_RELATIONS.has(rel.relationType) && !directFranchise.has(rel.anilistId)) {
        directFranchise.set(rel.anilistId, { seed, type: rel.relationType });
      }
    }
  }

  const isEligible = (a: Anime) => {
    if (a.isAdult && !options.allowAdult) return false;
    if (a.status === "NOT_YET_RELEASED" || a.format === "MUSIC") return false;
    if (!a.coverImage) return false;
    if (selectedIds.has(a.anilistId!) || (a.malId && selectedMalIds.has(a.malId))) return false;
    const franchise = directFranchise.get(a.anilistId!);
    // Only a direct sequel of a pick is a sensible franchise recommendation.
    if (franchise && franchise.type !== "SEQUEL") return false;
    return true;
  };

  const eligible = [...candidates.values()].filter((c) => isEligible(c.anime));
  if (!eligible.length) throw new RecommendationError("We couldn't find anything new to recommend for these picks.");

  const score = (c: Candidate) => scoreCandidate(c, seeds, profile, options);
  const byRank = (a: Scored, b: Scored) => b.rankScore - a.rankScore;
  const ranked = eligible.map(score).sort(byRank);

  // Check franchise ties for the leaders so two seasons of one show (or a
  // spin-off of a pick) can't take multiple slots.
  let shortlist = ranked.slice(0, Math.max(18, count * 6));
  let relations = new Map<number, RelationRef[]>();
  try {
    relations = await getRelations(shortlist.map((s) => s.candidate.anime.anilistId!));
  } catch {
    /* franchise checks fall back to the picks' own relation lists */
  }

  const franchiseIds = new Set<number>([...selectedIds, ...directFranchise.keys()]);
  shortlist = await collapseToFranchiseStart(shortlist, relations, franchiseIds, candidates, isEligible, score);
  shortlist.sort(byRank);

  const picked: Scored[] = [];
  const pickedIds = new Set<number>();
  let franchisePicks = 0;

  for (const entry of shortlist) {
    if (picked.length >= count) break;
    const id = entry.candidate.anime.anilistId!;
    if (pickedIds.has(id)) continue;
    const rels = relations.get(id) ?? [];
    const strongRelIds = rels.filter((r) => STRONG_FRANCHISE.has(r.relationType)).map((r) => r.anilistId);

    if (entry.sequelOf) {
      if (franchisePicks >= 1) continue;
    } else if (strongRelIds.some((rid) => franchiseIds.has(rid))) {
      continue;
    }
    if (rels.some((r) => pickedIds.has(r.anilistId))) continue;
    if (picked.some((p) => (relations.get(p.candidate.anime.anilistId!) ?? []).some((r) => r.anilistId === id))) continue;

    picked.push(entry);
    pickedIds.add(id);
    if (entry.sequelOf) franchisePicks++;
  }

  // Extremely niche picks can exhaust the shortlist; fill from the rest.
  for (const entry of ranked) {
    if (picked.length >= count) break;
    const id = entry.candidate.anime.anilistId!;
    if (pickedIds.has(id) || (entry.sequelOf && franchisePicks >= 1)) continue;
    picked.push(entry);
    pickedIds.add(id);
  }

  picked.sort((a, b) => b.similarity - a.similarity);
  return picked.map((entry) => {
    const relatedSeeds = seeds
      .map((seed) => ({ seed, affinity: entry.affinity[seed.index] }))
      .filter((x) => x.affinity >= 0.3)
      .sort((a, b) => b.affinity - a.affinity)
      .map((x) => x.seed);
    const relatedTo = relatedSeeds.length
      ? relatedSeeds
      : [seeds[entry.affinity.indexOf(Math.max(...entry.affinity))]];

    return {
      anime: entry.candidate.anime,
      score: round(entry.similarity),
      matchPercentage: toMatchPercentage(entry.similarity),
      reasons: buildReasons(entry, seeds, relatedTo),
      relatedTo: relatedTo.map((s) => s.anime),
      sharedGenres: entry.sharedGenres,
      sharedTags: entry.sharedTags.slice(0, 8),
      isFranchiseEntry: Boolean(entry.sequelOf),
      signals: entry.signals,
    };
  });
}

function isRealStartingPoint(root: Anime, later: Anime): boolean {
  const releasedFirst = !root.year || !later.year || root.year <= later.year;
  const established = (root.popularity ?? 0) >= 0.6 * (later.popularity ?? 0);
  return releasedFirst && established;
}

/**
 * Community recs often point at a later season ("86 Part 2"), but someone
 * new to a franchise should start at the beginning. Walk PREQUEL links
 * (up to three hops) and replace the later entry with the franchise's
 * first entry, carrying over its recommendation votes.
 */
async function collapseToFranchiseStart(
  shortlist: Scored[],
  relations: Map<number, RelationRef[]>,
  franchiseIds: Set<number>,
  candidates: Map<number, Candidate>,
  isEligible: (anime: Anime) => boolean,
  score: (candidate: Candidate) => Scored,
): Promise<Scored[]> {
  const prequelOf = (id: number) =>
    (relations.get(id) ?? []).find((r) => r.relationType === "PREQUEL" && !franchiseIds.has(r.anilistId))?.anilistId;

  const roots = new Map<number, number>();
  for (const entry of shortlist) {
    if (entry.sequelOf) continue;
    const id = entry.candidate.anime.anilistId!;
    const prequel = prequelOf(id);
    if (prequel) roots.set(id, prequel);
  }
  if (!roots.size) return shortlist;

  try {
    for (let hop = 0; hop < 2; hop++) {
      const frontier = [...new Set(roots.values())].filter((id) => !relations.has(id));
      if (frontier.length) for (const [id, refs] of await getRelations(frontier)) relations.set(id, refs);
      let moved = false;
      for (const [id, root] of roots) {
        const next = prequelOf(root);
        if (next && next !== id && !roots.has(next)) {
          roots.set(id, next);
          moved = true;
        }
      }
      if (!moved) break;
    }
  } catch {
    /* keep one-hop roots */
  }

  let rootCards = new Map<number, Anime>();
  try {
    rootCards = new Map((await getAnimeByIds([...new Set(roots.values())])).map((a) => [a.anilistId!, a]));
  } catch {
    return shortlist;
  }

  const result: Scored[] = [];
  for (const entry of shortlist) {
    const id = entry.candidate.anime.anilistId!;
    const rootId = roots.get(id);
    const rootAnime = rootId ? rootCards.get(rootId) : undefined;
    if (!rootId || !rootAnime || !isEligible(rootAnime) || franchiseIds.has(rootId)) {
      // Later entries whose starting point is unusable are dropped rather
      // than recommended mid-story.
      if (!rootId) result.push(entry);
      continue;
    }
    if (!isRealStartingPoint(rootAnime, entry.candidate.anime)) {
      // AniList also uses PREQUEL for chronological side stories (e.g. a
      // prequel movie made years later); those aren't where newcomers start.
      result.push(entry);
      continue;
    }
    let root = candidates.get(rootId);
    if (!root) {
      root = { anime: rootAnime, alLinks: new Map(), malLinks: new Map(), fromDiscovery: false, absorbed: [] };
      candidates.set(rootId, root);
    }
    for (const [seed, value] of entry.candidate.alLinks) root.alLinks.set(seed, Math.max(root.alLinks.get(seed) ?? 0, value));
    for (const [seed, value] of entry.candidate.malLinks) root.malLinks.set(seed, Math.max(root.malLinks.get(seed) ?? 0, value));
    if (!root.absorbed.some((a) => a.anilistId === id)) root.absorbed.push(entry.candidate.anime);
    result.push(score(root));
  }

  const best = new Map<number, Scored>();
  for (const entry of result) {
    const id = entry.candidate.anime.anilistId!;
    const existing = best.get(id);
    if (!existing || entry.rankScore > existing.rankScore) best.set(id, entry);
  }
  return [...best.values()];
}
