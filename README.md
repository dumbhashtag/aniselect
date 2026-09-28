# Ani Select — find your next anime

Pick five anime you love and get three recommendations you should watch next, each with a match percentage and a plain-English explanation of *why* it was picked. There's also a randomizer that pulls a genuinely random title from AniList's full catalogue, with optional filters.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 and shadcn/ui (Base UI primitives). All anime data is live from **AniList** (GraphQL) and **MyAnimeList** (official API or Jikan).

## Running locally

```bash
npm install
npm run dev        # http://localhost:4317
```

Other scripts:

```bash
npm run build && npm start   # production build on port 4317
npm run lint
npm run typecheck
npm run smoke:recs      # runs the engine against real APIs for a few taste profiles
```

### Optional: official MyAnimeList API

No credentials are needed. By default MAL data comes from [Jikan](https://jikan.moe), a keyless MAL mirror. To use the official MAL API instead, create `.env.local`:

```bash
MAL_CLIENT_ID=your_client_id   # https://myanimelist.net/apiconfig
```

MAL is a secondary signal: if it's slow or down, recommendations still work using AniList alone (a circuit breaker stops calling MAL for a few minutes after repeated outages).

## How recommendations work

`src/services/recommendationEngine.ts` exposes `recommendAnime(selected, options)`:

1. **Seeds**: for each pick, one batched AniList query fetches its tags, genres, studios, franchise relations and top 25 community recommendations (with full candidate data). In parallel, MAL/Jikan community recommendations are fetched per pick.
2. **Taste profile**: weighted tag and genre vectors (tag rank × category weight; cast/technical tags count less), boosted super-linearly when several picks share a theme, plus studios, release years and formats.
3. **Candidate pool**: AniList recs + MAL recs (resolved to AniList via `idMal_in`) + tag-pair discovery queries built from the profile's most shared themes (all sent as aliases of one GraphQL request).
4. **Scoring** (weights sum to 1, so the result is a 0–1 similarity):

   | Signal | Weight |
   | --- | --- |
   | Community recommendations (AniList + MAL votes, compounding across picks) | 0.30 |
   | Tag similarity (cosine vs. profile) | 0.27 |
   | Coverage: how many of your 5 picks it relates to | 0.16 |
   | Genre similarity | 0.10 |
   | Quality (average score) | 0.07 |
   | Studio / format / era | 0.04 / 0.03 / 0.03 |

   The match percentage is a fixed monotonic mapping of this similarity. Ranking adjustments (hidden-gem mode, specials, sequels) change the order but not the percentage.
5. **Franchise handling**: picks and their related entries are excluded; later seasons of an unpicked franchise are collapsed to its real starting point (carrying their votes); at most one direct sequel of a pick may appear; no two results may share a franchise.

Each result includes `reasons`, `relatedTo`, `sharedTags`, `sharedGenres` and the raw `signals` breakdown.

## Random anime

AniList no longer reports result totals and caps pagination at 5,000 entries, so "random page" would only ever reach a slice of the catalogue. Instead `/api/random` samples 1,500 random IDs across the full ID space (three aliased `id_in` batches in one request) and lets AniList apply the filters, so every matching anime has an equal chance of being picked. Very narrow filters fall back to a random page within the (then small) filtered set.

## Project structure

```
src/
  app/
    page.tsx                 server component (trending backdrop) + client home
    api/search               GET  ?q=           autocomplete (AniList, MAL fallback)
    api/recommend            POST {selections}  exactly 5 picks → 3 recommendations
    api/random               GET  filters|mode=surprise
    api/anime/[id]           GET  details (AniList + MAL score/trailer/similar)
    api/anime                GET  ?ids=         batch lookup (shared links)
    api/genres               GET
  services/
    anilist.ts               GraphQL client, rate limiting, caching, random sampling
    mal.ts                   MalSource interface: official MAL API or Jikan
    animeNormalizer.ts       provider payloads → common Anime model, merge + dedupe
    recommendationEngine.ts  scoring, franchise logic, explanations
    animeService.ts          facade combining providers for the routes
  lib/server/                TTL/LRU cache, rate limiters, fetch with retries
  lib/api-client.ts          the only place the browser calls the API
  components/                AnimeSearch, SelectedAnime, RecommendationCard, AnimeModal, …
  types/anime.ts             Anime, AnimeDetails, Recommendation, RandomFilters, …
```

## Rate limits and caching

AniList currently allows 30 requests/minute. Every upstream call goes through a shared sliding-window limiter that also honours `Retry-After` and `X-RateLimit-Remaining`. Results are held in an in-memory TTL cache (search 6h, cards/seeds 12h, genres 24h) with in-flight de-duplication. A cold recommendation costs about 4–6 AniList requests; repeats are served from cache. If AniList's queue gets long, search transparently switches to MAL.

## Extending

The model and services are provider-agnostic, so the planned features slot in without touching the UI's data flow:

- **Accounts / favourites / watchlist / history**: persist `AnimeRef[]` and `Recommendation[]`; the engine already accepts refs.
- **Import AniList/MAL lists**: add a `MediaListCollection` query or MAL `animelist` call that returns `AnimeRef[]` and pass them to `recommendAnime`.
- **Share links**: already supported via `?picks=<anilistIds>`.
- **Hidden gems**: implemented as `RecommendOptions.hiddenGems`; `allowAdult` is wired through for an NSFW toggle.
- **Seasonal / trending**: `getTrending` and `discover` in `anilist.ts` are the building blocks.
- **Light theme**: tokens live in `globals.css` (`:root` vs `.dark`).
