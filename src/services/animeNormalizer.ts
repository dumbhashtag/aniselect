import type {
  Anime,
  AnimeFormat,
  AnimeSeason,
  AnimeStatus,
  AnimeTag,
  AnimeTrailer,
  FuzzyDate,
} from "@/types/anime";
import type { AniListMedia, JikanAnime, MalOfficialAnime } from "./rawTypes";

const ANILIST_GENRES = new Set([
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Hentai",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
]);

/** MAL genre names that differ from AniList's vocabulary. */
const MAL_GENRE_ALIASES: Record<string, string> = {
  "Mahou Shoujo": "Mahou Shoujo",
  "Magical Girl": "Mahou Shoujo",
  Suspense: "Thriller",
};

export function animeKey(anilistId: number | null, malId: number | null): string {
  if (anilistId) return `al-${anilistId}`;
  if (malId) return `mal-${malId}`;
  return `unknown-${Math.random().toString(36).slice(2)}`;
}

export function cleanDescription(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/\[Written by MAL Rewrite\]/gi, "")
    .replace(/~!|!~/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > 0 ? text : null;
}

function normalizeFormat(format: string | null | undefined): AnimeFormat {
  switch ((format ?? "").toUpperCase().replace(/\s+/g, "_")) {
    case "TV":
      return "TV";
    case "TV_SHORT":
      return "TV_SHORT";
    case "MOVIE":
      return "MOVIE";
    case "SPECIAL":
    case "TV_SPECIAL":
      return "SPECIAL";
    case "OVA":
      return "OVA";
    case "ONA":
      return "ONA";
    case "MUSIC":
      return "MUSIC";
    default:
      return "UNKNOWN";
  }
}

function normalizeStatus(status: string | null | undefined): AnimeStatus {
  switch ((status ?? "").toUpperCase().replace(/\s+/g, "_")) {
    case "FINISHED":
    case "FINISHED_AIRING":
      return "FINISHED";
    case "RELEASING":
    case "CURRENTLY_AIRING":
      return "RELEASING";
    case "NOT_YET_RELEASED":
    case "NOT_YET_AIRED":
      return "NOT_YET_RELEASED";
    case "CANCELLED":
      return "CANCELLED";
    case "HIATUS":
      return "HIATUS";
    default:
      return "UNKNOWN";
  }
}

function normalizeSeason(season: string | null | undefined): AnimeSeason | null {
  const s = (season ?? "").toUpperCase();
  if (s === "WINTER" || s === "SPRING" || s === "SUMMER" || s === "FALL") return s;
  if (s === "AUTUMN") return "FALL";
  return null;
}

function fuzzy(date: { year?: number | null; month?: number | null; day?: number | null } | null | undefined): FuzzyDate | null {
  if (!date || !date.year) return null;
  return { year: date.year ?? null, month: date.month ?? null, day: date.day ?? null };
}

function parseIsoDate(value: string | undefined): FuzzyDate | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map((part) => Number(part));
  if (!y) return null;
  return { year: y, month: m || null, day: d || null };
}

function trailerFrom(site: string | null | undefined, id: string | null | undefined, thumbnail?: string | null): AnimeTrailer | null {
  if (!site || !id) return null;
  if (site.toLowerCase() === "youtube") {
    return {
      site: "youtube",
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      thumbnail: thumbnail ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }
  if (site.toLowerCase() === "dailymotion") {
    return {
      site: "dailymotion",
      id,
      embedUrl: `https://www.dailymotion.com/embed/video/${id}`,
      thumbnail: thumbnail ?? null,
    };
  }
  return null;
}

export function malUrlFor(malId: number | null | undefined): string | null {
  return malId ? `https://myanimelist.net/anime/${malId}` : null;
}

export function normalizeAniList(media: AniListMedia): Anime {
  const tags: AnimeTag[] = (media.tags ?? [])
    .map((tag) => ({
      name: tag.name,
      rank: tag.rank ?? 0,
      category: tag.category,
      isSpoiler: Boolean(tag.isMediaSpoiler || tag.isGeneralSpoiler),
    }))
    .sort((a, b) => b.rank - a.rank);

  const animationStudios = (media.studios?.nodes ?? []).filter((s) => s.isAnimationStudio).map((s) => s.name);
  const title = media.title.english || media.title.romaji || media.title.native || "Untitled";

  return {
    id: animeKey(media.id, media.idMal),
    anilistId: media.id,
    malId: media.idMal ?? null,
    title,
    titleEnglish: media.title.english,
    titleRomaji: media.title.romaji,
    titleNative: media.title.native,
    coverImage: media.coverImage?.large ?? media.coverImage?.medium ?? null,
    coverImageLarge: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    coverColor: media.coverImage?.color ?? null,
    bannerImage: media.bannerImage ?? null,
    description: cleanDescription(media.description),
    genres: media.genres ?? [],
    tags,
    score: media.averageScore ?? media.meanScore ?? null,
    popularity: media.popularity ?? null,
    favourites: media.favourites ?? null,
    episodes: media.episodes ?? null,
    duration: media.duration ?? null,
    season: normalizeSeason(media.season),
    year: media.seasonYear ?? media.startDate?.year ?? null,
    startDate: fuzzy(media.startDate),
    endDate: fuzzy(media.endDate),
    studios: animationStudios,
    format: normalizeFormat(media.format),
    status: normalizeStatus(media.status),
    isAdult: Boolean(media.isAdult),
    siteUrl: media.siteUrl ?? `https://anilist.co/anime/${media.id}`,
    malUrl: malUrlFor(media.idMal),
    trailer: trailerFrom(media.trailer?.site, media.trailer?.id, media.trailer?.thumbnail),
    sources: ["anilist"],
  };
}

function splitMalGenres(names: string[]): { genres: string[]; tags: AnimeTag[] } {
  const genres: string[] = [];
  const tags: AnimeTag[] = [];
  for (const raw of names) {
    const name = MAL_GENRE_ALIASES[raw] ?? raw;
    if (ANILIST_GENRES.has(name)) {
      if (!genres.includes(name)) genres.push(name);
    } else {
      tags.push({ name, rank: 60, category: "MyAnimeList", isSpoiler: false });
    }
  }
  return { genres, tags };
}

function parseJikanDuration(value: string | null | undefined): number | null {
  if (!value) return null;
  const hours = /(\d+)\s*hr/.exec(value);
  const minutes = /(\d+)\s*min/.exec(value);
  const total = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
  return total > 0 ? total : null;
}

export function normalizeJikan(anime: JikanAnime): Anime {
  const { genres, tags } = splitMalGenres([
    ...(anime.genres ?? []).map((g) => g.name),
    ...(anime.explicit_genres ?? []).map((g) => g.name),
    ...(anime.themes ?? []).map((g) => g.name),
    ...(anime.demographics ?? []).map((g) => g.name),
  ]);
  const image = anime.images?.webp?.large_image_url ?? anime.images?.jpg?.large_image_url ?? anime.images?.jpg?.image_url ?? null;
  const start = fuzzy(anime.aired?.prop?.from);

  return {
    id: animeKey(null, anime.mal_id),
    anilistId: null,
    malId: anime.mal_id,
    title: anime.title_english || anime.title,
    titleEnglish: anime.title_english ?? null,
    titleRomaji: anime.title,
    titleNative: anime.title_japanese ?? null,
    coverImage: image,
    coverImageLarge: image,
    coverColor: null,
    bannerImage: null,
    description: cleanDescription(anime.synopsis),
    genres,
    tags,
    score: anime.score ? Math.round(anime.score * 10) : null,
    popularity: anime.members ?? null,
    favourites: anime.favorites ?? null,
    episodes: anime.episodes ?? null,
    duration: parseJikanDuration(anime.duration),
    season: normalizeSeason(anime.season),
    year: anime.year ?? start?.year ?? null,
    startDate: start,
    endDate: fuzzy(anime.aired?.prop?.to),
    studios: (anime.studios ?? []).map((s) => s.name),
    format: normalizeFormat(anime.type),
    status: normalizeStatus(anime.status),
    isAdult: /hentai|rx/i.test(anime.rating ?? "") || (anime.explicit_genres ?? []).length > 0,
    siteUrl: null,
    malUrl: anime.url ?? malUrlFor(anime.mal_id),
    trailer: trailerFrom("youtube", anime.trailer?.youtube_id ?? null, anime.trailer?.images?.maximum_image_url ?? null),
    sources: ["mal"],
  };
}

export function normalizeMalOfficial(anime: MalOfficialAnime): Anime {
  const { genres, tags } = splitMalGenres((anime.genres ?? []).map((g) => g.name));
  const start = parseIsoDate(anime.start_date);
  const image = anime.main_picture?.large ?? anime.main_picture?.medium ?? null;

  return {
    id: animeKey(null, anime.id),
    anilistId: null,
    malId: anime.id,
    title: anime.alternative_titles?.en || anime.title,
    titleEnglish: anime.alternative_titles?.en || null,
    titleRomaji: anime.title,
    titleNative: anime.alternative_titles?.ja || null,
    coverImage: image,
    coverImageLarge: image,
    coverColor: null,
    bannerImage: null,
    description: cleanDescription(anime.synopsis),
    genres,
    tags,
    score: anime.mean ? Math.round(anime.mean * 10) : null,
    popularity: anime.num_list_users ?? null,
    favourites: null,
    episodes: anime.num_episodes || null,
    duration: anime.average_episode_duration ? Math.round(anime.average_episode_duration / 60) : null,
    season: normalizeSeason(anime.start_season?.season),
    year: anime.start_season?.year ?? start?.year ?? null,
    startDate: start,
    endDate: parseIsoDate(anime.end_date),
    studios: (anime.studios ?? []).map((s) => s.name),
    format: normalizeFormat(anime.media_type),
    status: normalizeStatus(anime.status),
    isAdult: anime.nsfw === "black" || anime.rating === "rx",
    siteUrl: null,
    malUrl: malUrlFor(anime.id),
    trailer: null,
    sources: ["mal"],
  };
}

function pick<T>(primary: T | null | undefined, fallback: T | null | undefined): T | null {
  if (primary === null || primary === undefined) return fallback ?? null;
  if (Array.isArray(primary) && primary.length === 0) return fallback ?? primary;
  return primary;
}

/**
 * Merge two records for the same title. `primary` wins for every field it
 * has; `secondary` fills gaps (e.g. MAL trailer when AniList has none).
 */
export function mergeAnime(primary: Anime, secondary: Anime): Anime {
  const tagNames = new Set(primary.tags.map((t) => t.name.toLowerCase()));
  const extraTags = secondary.tags.filter((t) => !tagNames.has(t.name.toLowerCase()));
  const anilistId = primary.anilistId ?? secondary.anilistId;
  const malId = primary.malId ?? secondary.malId;

  return {
    ...primary,
    id: animeKey(anilistId, malId),
    anilistId,
    malId,
    titleEnglish: pick(primary.titleEnglish, secondary.titleEnglish),
    titleRomaji: pick(primary.titleRomaji, secondary.titleRomaji),
    titleNative: pick(primary.titleNative, secondary.titleNative),
    coverImage: pick(primary.coverImage, secondary.coverImage),
    coverImageLarge: pick(primary.coverImageLarge, secondary.coverImageLarge),
    bannerImage: pick(primary.bannerImage, secondary.bannerImage),
    description: pick(primary.description, secondary.description),
    genres: pick(primary.genres, secondary.genres) ?? [],
    tags: [...primary.tags, ...extraTags],
    score: pick(primary.score, secondary.score),
    episodes: pick(primary.episodes, secondary.episodes),
    duration: pick(primary.duration, secondary.duration),
    year: pick(primary.year, secondary.year),
    startDate: pick(primary.startDate, secondary.startDate),
    endDate: pick(primary.endDate, secondary.endDate),
    studios: pick(primary.studios, secondary.studios) ?? [],
    siteUrl: pick(primary.siteUrl, secondary.siteUrl),
    malUrl: pick(primary.malUrl, secondary.malUrl),
    trailer: pick(primary.trailer, secondary.trailer),
    isAdult: primary.isAdult || secondary.isAdult,
    sources: Array.from(new Set([...primary.sources, ...secondary.sources])),
  };
}

export function normalizeTitle(title: string | null | undefined): string {
  return (title ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Collapse records that describe the same anime. Matches on AniList ID,
 * MAL ID, and finally normalized title + year, so an AniList entry and a
 * Jikan entry for the same show become one merged record.
 */
export function dedupeAnime(list: Anime[]): Anime[] {
  const result: Anime[] = [];
  const byAniList = new Map<number, number>();
  const byMal = new Map<number, number>();
  const byTitle = new Map<string, number>();

  const titleKeys = (a: Anime) =>
    [a.titleRomaji, a.titleEnglish, a.title]
      .map(normalizeTitle)
      .filter((t) => t.length > 2)
      .map((t) => `${t}:${a.year ?? "?"}`);

  for (const anime of list) {
    let index =
      (anime.anilistId ? byAniList.get(anime.anilistId) : undefined) ??
      (anime.malId ? byMal.get(anime.malId) : undefined);
    if (index === undefined) {
      for (const key of titleKeys(anime)) {
        const hit = byTitle.get(key);
        if (hit !== undefined) {
          index = hit;
          break;
        }
      }
    }

    if (index === undefined) {
      index = result.length;
      result.push(anime);
    } else {
      const existing = result[index];
      result[index] =
        existing.sources.includes("anilist") || !anime.sources.includes("anilist")
          ? mergeAnime(existing, anime)
          : mergeAnime(anime, existing);
    }

    const merged = result[index];
    if (merged.anilistId) byAniList.set(merged.anilistId, index);
    if (merged.malId) byMal.set(merged.malId, index);
    for (const key of titleKeys(merged)) byTitle.set(key, index);
  }
  return result;
}
