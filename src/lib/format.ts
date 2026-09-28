import type { Anime, AnimeFormat, AnimeStatus, FuzzyDate } from "@/types/anime";

const FORMAT_LABELS: Record<AnimeFormat, string> = {
  TV: "TV",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music",
  UNKNOWN: "Unknown",
};

const STATUS_LABELS: Record<AnimeStatus, string> = {
  FINISHED: "Finished",
  RELEASING: "Airing",
  NOT_YET_RELEASED: "Not yet aired",
  CANCELLED: "Cancelled",
  HIATUS: "On hiatus",
  UNKNOWN: "Unknown",
};

export const formatLabel = (format: AnimeFormat) => FORMAT_LABELS[format] ?? format;
export const statusLabel = (status: AnimeStatus) => STATUS_LABELS[status] ?? status;

export function episodesLabel(anime: Pick<Anime, "episodes" | "format" | "status">): string | null {
  if (anime.format === "MOVIE") return anime.episodes && anime.episodes > 1 ? `${anime.episodes} parts` : null;
  if (!anime.episodes) return anime.status === "RELEASING" ? "Ongoing" : null;
  return `${anime.episodes} ep${anime.episodes === 1 ? "" : "s"}`;
}

export function durationLabel(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dateLabel(date: FuzzyDate | null): string | null {
  if (!date?.year) return null;
  if (!date.month) return String(date.year);
  if (!date.day) return `${MONTHS[date.month - 1]} ${date.year}`;
  return `${MONTHS[date.month - 1]} ${date.day}, ${date.year}`;
}

export function seasonLabel(anime: Pick<Anime, "season" | "year">): string | null {
  if (!anime.year) return null;
  if (!anime.season) return String(anime.year);
  return `${anime.season.charAt(0)}${anime.season.slice(1).toLowerCase()} ${anime.year}`;
}

export function compactNumber(value: number | null): string | null {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function scoreLabel(score: number | null): string | null {
  return score ? `${score}%` : null;
}

/** Secondary title shown under the main one, if it adds information. */
export function altTitle(anime: Pick<Anime, "title" | "titleRomaji" | "titleEnglish">): string | null {
  const alt = anime.titleRomaji && anime.titleRomaji !== anime.title ? anime.titleRomaji : null;
  return alt;
}

export function shortDescription(text: string | null, max = 260): string | null {
  if (!text) return null;
  const clean = text.replace(/\(Source:[^)]*\)/gi, "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}
