import type { MediaType } from "./types";

export interface DiscoverQuery {
  mediaType: MediaType;
  genres?: string;
  originalLanguage?: string;
}

export interface Category {
  slug: string;
  label: string;
  /** TMDB discover filter used to fill this category */
  discover?: DiscoverQuery;
}

/**
 * Main navigation categories. Add a new entry here to create a new category
 * page automatically (/c/<slug>) and a new option in the admin panel.
 */
export const CATEGORIES: Category[] = [
  { slug: "series", label: "Séries", discover: { mediaType: "tv" } },
  { slug: "filmes", label: "Filmes", discover: { mediaType: "movie" } },
  { slug: "animes", label: "Animes", discover: { mediaType: "tv", genres: "16", originalLanguage: "ja" } },
  { slug: "novelas", label: "Novelas", discover: { mediaType: "tv", genres: "10766" } },
  { slug: "dramas", label: "Dramas", discover: { mediaType: "tv", genres: "18" } },
  { slug: "infantil", label: "Infantil", discover: { mediaType: "movie", genres: "10751" } },
  { slug: "documentarios", label: "Documentários", discover: { mediaType: "movie", genres: "99" } },
  { slug: "brasileiros", label: "Brasileiros", discover: { mediaType: "movie", originalLanguage: "pt" } },
];

export const findCategory = (slug: string) => CATEGORIES.find((c) => c.slug === slug);

/** Streaming services are used ONLY as "where it is available" filters (TMDB watch providers, Brazil). */
const LOGO = "https://image.tmdb.org/t/p/w154";
export const STREAMING_FILTERS = [
  { id: "8", name: "Netflix", logo: `${LOGO}/rK1KljqmbvO9HQa1PBFLILWah72.png` },
  { id: "119", name: "Prime Video", logo: `${LOGO}/gMZdpavHmxFNnLpMHwVxfqeux2g.png` },
  { id: "337", name: "Disney+", logo: `${LOGO}/5eZ872CghnHFLB1j8grszbrx0dx.png` },
  { id: "1899", name: "Max", logo: `${LOGO}/skypuy7SXuugIQeYg0IglmzoKaS.png` },
  { id: "307", name: "Globoplay", logo: `${LOGO}/9A6Oxd3F7iXm7mds7CxYOBicojs.png` },
  { id: "350", name: "Apple TV+", logo: `${LOGO}/9icYBfYFcwgCbky5VdGUIKJ4C5i.png` },
  { id: "531", name: "Paramount+", logo: `${LOGO}/pkx3klJlwW5JdtaulvDx6hDNtch.png` },
];
