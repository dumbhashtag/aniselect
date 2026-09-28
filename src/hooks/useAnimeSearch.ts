"use client";

import { useEffect, useState } from "react";
import { ApiError, searchAnime } from "@/lib/api-client";
import type { Anime } from "@/types/anime";

interface SearchState {
  results: Anime[];
  loading: boolean;
  error: string | null;
  /** The term the current results belong to. */
  settledTerm: string;
}

const IDLE: SearchState = { results: [], loading: false, error: null, settledTerm: "" };

export function useAnimeSearch(term: string, debounceMs = 220) {
  const [state, setState] = useState<SearchState>(IDLE);
  const trimmed = term.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const results = await searchAnime(trimmed, controller.signal);
        setState({ results, loading: false, error: null, settledTerm: trimmed });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          results: [],
          loading: false,
          error: error instanceof ApiError ? error.message : "Search failed. Try again.",
          settledTerm: trimmed,
        });
      }
    }, debounceMs);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmed, debounceMs]);

  if (trimmed.length < 2) return IDLE;
  // While the debounce is pending, show a loading state rather than stale results.
  const pending = state.settledTerm !== trimmed;
  return { ...state, loading: state.loading || pending };
}
