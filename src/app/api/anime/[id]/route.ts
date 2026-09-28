import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/server/respond";
import { getAnimeDetails } from "@/services/animeService";

export async function GET(_request: Request, ctx: RouteContext<"/api/anime/[id]">) {
  const { id } = await ctx.params;
  const anilistId = Number(id);
  if (!Number.isInteger(anilistId) || anilistId <= 0) return jsonError("Invalid anime id.", 400);

  try {
    const details = await getAnimeDetails(anilistId);
    if (!details) return jsonError("That anime couldn't be found.", 404, "not_found");
    return NextResponse.json(
      { anime: details },
      { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    return handleRouteError(error, "anime-details");
  }
}
