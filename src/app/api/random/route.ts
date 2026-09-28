import { NextResponse, type NextRequest } from "next/server";
import { handleRouteError, jsonError } from "@/lib/server/respond";
import { getRandomAnime } from "@/services/animeService";
import type { AnimeFormat, RandomFilters } from "@/types/anime";

const FORMATS = new Set<AnimeFormat>(["TV", "TV_SHORT", "MOVIE", "OVA", "ONA", "SPECIAL"]);

function toInt(value: string | null, min: number, max: number): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(Math.round(n), min), max);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const currentYear = new Date().getFullYear();

  const formats = (params.get("formats") ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f): f is AnimeFormat => FORMATS.has(f as AnimeFormat));

  const filters: RandomFilters =
    params.get("mode") === "surprise"
      ? {}
      : {
          genre: params.get("genre")?.slice(0, 40) || null,
          minScore: toInt(params.get("minScore"), 0, 100),
          formats,
          finishedOnly: params.get("finished") === "1",
          yearFrom: toInt(params.get("yearFrom"), 1940, currentYear + 1),
          yearTo: toInt(params.get("yearTo"), 1940, currentYear + 1),
        };

  if (filters.yearFrom && filters.yearTo && filters.yearFrom > filters.yearTo) {
    return jsonError("The start year must be before the end year.", 400);
  }

  const exclude = (params.get("exclude") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 50);

  try {
    const anime = await getRandomAnime(filters, exclude);
    if (!anime) {
      return jsonError("No anime match those filters. Try loosening them a little.", 404, "no_match");
    }
    return NextResponse.json({ anime }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleRouteError(error, "random");
  }
}
