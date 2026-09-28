import { NextResponse, type NextRequest } from "next/server";
import { handleRouteError } from "@/lib/server/respond";
import { searchAnime } from "@/services/animeService";

export async function GET(request: NextRequest) {
  const term = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 8, 1), 15);
  if (term.length < 2) return NextResponse.json({ results: [], source: "anilist" });
  if (term.length > 100) return NextResponse.json({ error: "Search term is too long." }, { status: 400 });

  try {
    const response = await searchAnime(term, limit);
    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
    });
  } catch (error) {
    return handleRouteError(error, "search");
  }
}
