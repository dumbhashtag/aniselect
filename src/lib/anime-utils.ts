import type { Anime } from "@/types/anime";

export function isSameAnime(a: Pick<Anime, "anilistId" | "malId">, b: Pick<Anime, "anilistId" | "malId">): boolean {
  if (a.anilistId && b.anilistId) return a.anilistId === b.anilistId;
  if (a.malId && b.malId) return a.malId === b.malId;
  return false;
}

export function containsAnime(list: (Anime | null)[], anime: Anime): boolean {
  return list.some((item) => item !== null && isSameAnime(item, anime));
}
