export const REQUIRED_PICKS = 5;
export const RECOMMENDATION_COUNT = 3;

export const RANDOM_FORMAT_OPTIONS = [
  { value: "TV", label: "TV" },
  { value: "MOVIE", label: "Movie" },
  { value: "OVA", label: "OVA" },
  { value: "ONA", label: "ONA" },
  { value: "TV_SHORT", label: "Short series" },
] as const;

export const MIN_YEAR = 1960;
export const MAX_YEAR = new Date().getFullYear() + 1;
