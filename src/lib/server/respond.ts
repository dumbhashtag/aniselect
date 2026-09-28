import "server-only";

import { NextResponse } from "next/server";
import { UpstreamError } from "./http";
import { RecommendationError } from "@/services/recommendationEngine";
import type { ApiErrorBody } from "@/types/anime";

export function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json<ApiErrorBody>({ error: message, code }, { status });
}

export function handleRouteError(error: unknown, context: string) {
  if (error instanceof RecommendationError) {
    return jsonError(error.message, error.status, "recommendation");
  }
  if (error instanceof UpstreamError) {
    if (error.isRateLimited) {
      return jsonError(
        `${error.source} is rate limiting requests right now. Give it a few seconds and try again.`,
        429,
        "rate_limited",
      );
    }
    console.error(`[${context}]`, error.message);
    return jsonError(`${error.source} is having trouble responding. Please try again shortly.`, 502, "upstream");
  }
  console.error(`[${context}]`, error);
  return jsonError("Something went wrong on our side.", 500, "internal");
}
