import { NextResponse, type NextRequest } from "next/server";
import { handleRouteError, jsonError } from "@/lib/server/respond";
import { getAnimeByIds } from "@/services/animeService";

/** Batch lookup by AniList ID — used to restore picks from a shared URL. */
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return jsonError("Provide one or more AniList ids.", 400);
  if (ids.length > 10) return jsonError("Too many ids.", 400);

  try {
    const results = await getAnimeByIds(ids);
    return NextResponse.json({ results });
  } catch (error) {
    return handleRouteError(error, "anime-batch");
  }
}
