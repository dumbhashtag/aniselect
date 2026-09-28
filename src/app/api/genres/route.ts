import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/server/respond";
import { getGenres } from "@/services/animeService";

export async function GET() {
  try {
    const genres = await getGenres();
    return NextResponse.json({ genres }, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch (error) {
    return handleRouteError(error, "genres");
  }
}
