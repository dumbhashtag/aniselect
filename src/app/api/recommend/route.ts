import { NextResponse, type NextRequest } from "next/server";
import { handleRouteError, jsonError } from "@/lib/server/respond";
import { recommendAnime } from "@/services/recommendationEngine";
import type { AnimeRef, RecommendOptions } from "@/types/anime";
import { REQUIRED_PICKS } from "@/lib/constants";

interface RecommendBody {
  selections?: unknown;
  options?: RecommendOptions;
}

function parseRefs(value: unknown): AnimeRef[] | null {
  if (!Array.isArray(value)) return null;
  const refs: AnimeRef[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { anilistId, malId } = item as Record<string, unknown>;
    const ref: AnimeRef = {
      anilistId: typeof anilistId === "number" && Number.isInteger(anilistId) && anilistId > 0 ? anilistId : null,
      malId: typeof malId === "number" && Number.isInteger(malId) && malId > 0 ? malId : null,
    };
    if (!ref.anilistId && !ref.malId) return null;
    refs.push(ref);
  }
  return refs;
}

export async function POST(request: NextRequest) {
  let body: RecommendBody;
  try {
    body = (await request.json()) as RecommendBody;
  } catch {
    return jsonError("Request body must be JSON.", 400);
  }

  const refs = parseRefs(body.selections);
  if (!refs) return jsonError("`selections` must be a list of { anilistId, malId } objects.", 400);

  const unique = new Set(refs.map((r) => (r.anilistId ? `al-${r.anilistId}` : `mal-${r.malId}`)));
  if (refs.length !== REQUIRED_PICKS || unique.size !== REQUIRED_PICKS) {
    return jsonError(`Pick exactly ${REQUIRED_PICKS} different anime.`, 400);
  }

  try {
    const recommendations = await recommendAnime(refs, {
      hiddenGems: Boolean(body.options?.hiddenGems),
      allowAdult: false,
    });
    return NextResponse.json({ recommendations });
  } catch (error) {
    return handleRouteError(error, "recommend");
  }
}
