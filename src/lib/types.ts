export type Source = "tmdb" | "local";
export type MediaType = "movie" | "tv";

export interface MediaItem {
  source: Source;
  mediaType: MediaType;
  id: string;
  title: string;
  poster: string | null;
  backdrop: string | null;
  overview: string;
  year: number | null;
  rating: number | null;
  genres: string[];
}

export interface MediaDetails extends MediaItem {
  duration: number | null;
  ageRating: string | null;
  cast: { name: string; character?: string; photo?: string | null }[];
  director: string | null;
  trailerKey: string | null;
  seasons?: number | null;
  related: MediaItem[];
  providers?: { name: string; logo: string; kind: string }[];
  watchLink?: string | null;
  originalTitle?: string | null;
}

export interface Paged<T> {
  items: T[];
  page: number;
  totalPages: number;
  configured: boolean;
}

export const typeLabel = (t: MediaType) => (t === "movie" ? "Filme" : "Série");
