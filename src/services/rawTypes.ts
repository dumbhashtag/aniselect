/** Raw response shapes for upstream providers. Only the normalizer should consume these. */

export interface AniListFuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AniListMedia {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage?: { extraLarge: string | null; large: string | null; medium: string | null; color: string | null } | null;
  bannerImage?: string | null;
  description?: string | null;
  genres?: string[] | null;
  tags?: { name: string; rank: number | null; category: string | null; isMediaSpoiler: boolean | null; isGeneralSpoiler?: boolean | null }[] | null;
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  favourites?: number | null;
  episodes?: number | null;
  duration?: number | null;
  season?: string | null;
  seasonYear?: number | null;
  startDate?: AniListFuzzyDate | null;
  endDate?: AniListFuzzyDate | null;
  studios?: { nodes: { name: string; isAnimationStudio: boolean }[] } | null;
  format?: string | null;
  status?: string | null;
  isAdult?: boolean | null;
  siteUrl?: string | null;
  trailer?: { id: string | null; site: string | null; thumbnail: string | null } | null;
  relations?: {
    edges: { relationType: string; node: AniListMedia | null }[];
  } | null;
  recommendations?: {
    nodes: { rating: number | null; mediaRecommendation: AniListMedia | null }[];
  } | null;
  characters?: {
    edges: { role: string; node: { name: { full: string | null }; image: { medium: string | null } | null } | null }[];
  } | null;
}

export interface JikanNamed {
  mal_id: number;
  name: string;
}

export interface JikanAnime {
  mal_id: number;
  url: string;
  images?: {
    jpg?: { image_url?: string | null; large_image_url?: string | null };
    webp?: { image_url?: string | null; large_image_url?: string | null };
  };
  trailer?: { youtube_id: string | null; embed_url?: string | null; images?: { maximum_image_url?: string | null } } | null;
  title: string;
  title_english?: string | null;
  title_japanese?: string | null;
  type?: string | null;
  episodes?: number | null;
  status?: string | null;
  aired?: {
    prop?: {
      from?: { day: number | null; month: number | null; year: number | null };
      to?: { day: number | null; month: number | null; year: number | null };
    };
  };
  duration?: string | null;
  rating?: string | null;
  score?: number | null;
  members?: number | null;
  favorites?: number | null;
  synopsis?: string | null;
  season?: string | null;
  year?: number | null;
  studios?: JikanNamed[];
  genres?: JikanNamed[];
  explicit_genres?: JikanNamed[];
  themes?: JikanNamed[];
  demographics?: JikanNamed[];
}

export interface JikanRecommendation {
  entry: {
    mal_id: number;
    url: string;
    title: string;
    images?: JikanAnime["images"];
  };
  votes: number;
}

export interface MalOfficialAnime {
  id: number;
  title: string;
  main_picture?: { medium?: string; large?: string };
  alternative_titles?: { en?: string; ja?: string; synonyms?: string[] };
  start_date?: string;
  end_date?: string;
  synopsis?: string;
  mean?: number;
  num_list_users?: number;
  media_type?: string;
  status?: string;
  genres?: { id: number; name: string }[];
  num_episodes?: number;
  start_season?: { year: number; season: string };
  average_episode_duration?: number;
  studios?: { id: number; name: string }[];
  rating?: string;
  nsfw?: string;
  recommendations?: {
    node: { id: number; title: string; main_picture?: { medium?: string; large?: string } };
    num_recommendations: number;
  }[];
}
