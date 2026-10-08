import type { MediaItem, MediaType } from "./types";

const IMG = "https://image.tmdb.org/t/p/";

export const GENRES: Record<number, string> = {
  28: "Ação", 12: "Aventura", 16: "Animação", 35: "Comédia", 80: "Crime", 99: "Documentário",
  18: "Drama", 10751: "Família", 14: "Fantasia", 36: "História", 27: "Terror", 10402: "Música",
  9648: "Mistério", 10749: "Romance", 878: "Ficção científica", 10770: "Filme de TV", 53: "Suspense",
  10752: "Guerra", 37: "Faroeste", 10759: "Ação e Aventura", 10762: "Infantil", 10763: "Notícias",
  10764: "Reality", 10765: "Sci-Fi e Fantasia", 10766: "Novela", 10767: "Talk show", 10768: "Guerra e Política",
};

export function tmdbConfigured() {
  return !!process.env["TMDB_API_KEY"];
}

export async function tmdb<T = any>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const key = process.env["TMDB_API_KEY"];
  if (!key) throw new Error("TMDB_NOT_CONFIGURED");
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("language", "pt-BR");
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { accept: "application/json" };
  // Supports both v4 read tokens (JWT) and v3 API keys
  if (key.startsWith("eyJ")) headers["Authorization"] = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return (await res.json()) as T;
}

export const img = (p: string | null | undefined, size: string) => (p ? `${IMG}${size}${p}` : null);

export function mapItem(r: any, forced?: MediaType): MediaItem | null {
  const mediaType: MediaType | undefined = forced ?? (r.media_type === "tv" ? "tv" : r.media_type === "movie" ? "movie" : undefined);
  if (!mediaType) return null;
  const date: string | undefined = r.release_date ?? r.first_air_date;
  return {
    source: "tmdb",
    mediaType,
    id: String(r.id),
    title: r.title ?? r.name ?? "Sem título",
    poster: img(r.poster_path, "w342"),
    backdrop: img(r.backdrop_path, "w1280"),
    overview: r.overview ?? "",
    year: date ? Number(date.slice(0, 4)) || null : null,
    rating: typeof r.vote_average === "number" && r.vote_average > 0 ? Math.round(r.vote_average * 10) / 10 : null,
    genres: (r.genre_ids ?? r.genres?.map((g: any) => g.id) ?? []).map((id: number) => GENRES[id]).filter(Boolean),
  };
}

export function mapList(results: any[], forced?: MediaType): MediaItem[] {
  return results.map((r) => mapItem(r, forced)).filter((x): x is MediaItem => !!x && !!x.poster);
}
