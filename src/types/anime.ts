export type AnimeSource = "anilist" | "mal";

export type AnimeFormat =
  | "TV"
  | "TV_SHORT"
  | "MOVIE"
  | "SPECIAL"
  | "OVA"
  | "ONA"
  | "MUSIC"
  | "UNKNOWN";

export type AnimeStatus =
  | "FINISHED"
  | "RELEASING"
  | "NOT_YET_RELEASED"
  | "CANCELLED"
  | "HIATUS"
  | "UNKNOWN";

export type AnimeSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";

export interface AnimeTag {
  name: string;
  /** 0-100 relevance of the tag to this anime (AniList "rank"). */
  rank: number;
  category: string | null;
  isSpoiler: boolean;
}

export interface FuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AnimeTrailer {
  site: "youtube" | "dailymotion";
  id: string;
  embedUrl: string;
  thumbnail: string | null;
}

/**
 * Source-agnostic anime model. Every provider (AniList, MAL official, Jikan)
 * is normalized into this shape so the rest of the app never needs to know
 * where the data came from.
 */
export interface Anime {
  /** Stable internal key: "al-<anilistId>" when known, otherwise "mal-<malId>". */
  id: string;
  anilistId: number | null;
  malId: number | null;
  title: string;
  titleEnglish: string | null;
  titleRomaji: string | null;
  titleNative: string | null;
  coverImage: string | null;
  coverImageLarge: string | null;
  coverColor: string | null;
  bannerImage: string | null;
  description: string | null;
  genres: string[];
  tags: AnimeTag[];
  /** 0-100 scale. */
  score: number | null;
  popularity: number | null;
  favourites: number | null;
  episodes: number | null;
  /** Minutes per episode. */
  duration: number | null;
  season: AnimeSeason | null;
  year: number | null;
  startDate: FuzzyDate | null;
  endDate: FuzzyDate | null;
  studios: string[];
  format: AnimeFormat;
  status: AnimeStatus;
  isAdult: boolean;
  siteUrl: string | null;
  malUrl: string | null;
  trailer: AnimeTrailer | null;
  sources: AnimeSource[];
}

export type RelationType =
  | "ADAPTATION"
  | "PREQUEL"
  | "SEQUEL"
  | "PARENT"
  | "SIDE_STORY"
  | "CHARACTER"
  | "SUMMARY"
  | "ALTERNATIVE"
  | "SPIN_OFF"
  | "OTHER"
  | "SOURCE"
  | "COMPILATION"
  | "CONTAINS";

export interface AnimeRelation {
  relationType: RelationType;
  anime: Anime;
}

export interface AnimeCharacter {
  name: string;
  image: string | null;
  role: string;
}

export interface SimilarAnime {
  anime: Anime;
  /** Community votes for this recommendation. */
  votes: number;
  source: AnimeSource;
}

export interface AnimeDetails extends Anime {
  relations: AnimeRelation[];
  similar: SimilarAnime[];
  characters: AnimeCharacter[];
  malScore: number | null;
}

/** Minimal reference used to request data for a user's selection. */
export interface AnimeRef {
  anilistId: number | null;
  malId: number | null;
}

export interface RecommendationSignals {
  anilistRecommendations: number;
  malRecommendations: number;
  tagSimilarity: number;
  genreSimilarity: number;
  coverage: number;
  studioMatch: number;
  formatMatch: number;
  eraMatch: number;
  quality: number;
}

export interface Recommendation {
  anime: Anime;
  /** Raw ranking score (0-1, higher is better). */
  score: number;
  /** Human-facing match percentage derived from `score`. */
  matchPercentage: number;
  reasons: string[];
  relatedTo: Anime[];
  sharedGenres: string[];
  sharedTags: string[];
  isFranchiseEntry: boolean;
  signals: RecommendationSignals;
}

export interface RecommendOptions {
  /** Favor less popular titles ("hidden gem" mode). */
  hiddenGems?: boolean;
  /** Include adult content. Defaults to false. */
  allowAdult?: boolean;
}

export interface RandomFilters {
  genre?: string | null;
  minScore?: number | null;
  formats?: AnimeFormat[];
  finishedOnly?: boolean;
  yearFrom?: number | null;
  yearTo?: number | null;
}

export interface ApiErrorBody {
  error: string;
  code?: string;
}
