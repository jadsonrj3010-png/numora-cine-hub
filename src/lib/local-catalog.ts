import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { MediaDetails, MediaItem } from "./types";

export type MovieRow = Database["public"]["Tables"]["movies"]["Row"];
export type SeriesRow = Database["public"]["Tables"]["series"]["Row"];
export type EpisodeRow = Database["public"]["Tables"]["episodes"]["Row"];

export function movieToItem(m: MovieRow): MediaItem {
  return {
    source: "local", mediaType: "movie", id: m.id, title: m.title, poster: m.poster_url, backdrop: m.backdrop_url,
    overview: m.description ?? "", year: m.year, rating: m.rating != null ? Number(m.rating) : null, genres: m.genres,
  };
}
export function seriesToItem(s: SeriesRow): MediaItem {
  return {
    source: "local", mediaType: "tv", id: s.id, title: s.title, poster: s.poster_url, backdrop: s.backdrop_url,
    overview: s.description ?? "", year: s.year, rating: s.rating != null ? Number(s.rating) : null, genres: s.genres,
  };
}

export async function fetchLocal(opts: { category?: string; featured?: boolean; limit?: number; orderBy?: "views" | "created_at" } = {}) {
  const build = (table: "movies" | "series") => {
    let q = supabase.from(table).select("*").eq("published", true);
    if (opts.category) q = q.eq("category", opts.category);
    if (opts.featured) q = q.eq("featured", true);
    return q.order(opts.orderBy ?? "created_at", { ascending: false }).limit(opts.limit ?? 30);
  };
  const [m, s] = await Promise.all([build("movies"), build("series")]);
  const items = [
    ...((m.data ?? []) as MovieRow[]).map((r) => ({ item: movieToItem(r), views: r.views, at: r.created_at })),
    ...((s.data ?? []) as SeriesRow[]).map((r) => ({ item: seriesToItem(r), views: r.views, at: r.created_at })),
  ];
  items.sort((a, b) => (opts.orderBy === "views" ? b.views - a.views : b.at.localeCompare(a.at)));
  return items.map((x) => x.item);
}

export async function searchLocal(q: string): Promise<MediaItem[]> {
  const term = q.replace(/[%,()]/g, " ").trim();
  if (!term) return [];
  const isYear = /^(19|20)\d{2}$/.test(term);
  const orFilter = [
    `title.ilike.%${term}%`,
    `director.ilike.%${term}%`,
    `genres.cs.{${term}}`,
    `cast_list.cs.{${term}}`,
    ...(isYear ? [`year.eq.${term}`] : []),
  ].join(",");
  const [m, s] = await Promise.all([
    supabase.from("movies").select("*").eq("published", true).or(orFilter).limit(20),
    supabase.from("series").select("*").eq("published", true).or(orFilter).limit(20),
  ]);
  return [...((m.data ?? []) as MovieRow[]).map(movieToItem), ...((s.data ?? []) as SeriesRow[]).map(seriesToItem)];
}

export async function fetchLocalDetails(mediaType: "movie" | "tv", id: string) {
  if (mediaType === "movie") {
    const { data } = await supabase.from("movies").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const details: MediaDetails = {
      ...movieToItem(data), duration: data.duration_min, ageRating: data.age_rating,
      cast: data.cast_list.map((name) => ({ name })), director: data.director, trailerKey: youtubeKey(data.trailer_url) ?? null, related: [],
    };
    return { details, movie: data, series: null as SeriesRow | null, episodes: [] as EpisodeRow[] };
  }
  const { data } = await supabase.from("series").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: eps } = await supabase.from("episodes").select("*").eq("series_id", id).order("season_number").order("episode_number");
  const details: MediaDetails = {
    ...seriesToItem(data), duration: null, ageRating: data.age_rating, cast: data.cast_list.map((name) => ({ name })),
    director: data.director, trailerKey: youtubeKey(data.trailer_url) ?? null, related: [],
    seasons: new Set((eps ?? []).map((e) => e.season_number)).size || null,
  };
  return { details, movie: null as MovieRow | null, series: data, episodes: (eps ?? []) as EpisodeRow[] };
}

/** Authorized local content attached to a TMDB title (admin sets tmdb_id). */
export async function findLocalForTmdb(mediaType: "movie" | "tv", tmdbId: string) {
  const n = Number(tmdbId);
  if (mediaType === "movie") {
    const { data } = await supabase.from("movies").select("*").eq("tmdb_id", n).eq("published", true).maybeSingle();
    return data ? { movie: data as MovieRow, series: null, episodes: [] as EpisodeRow[] } : null;
  }
  const { data } = await supabase.from("series").select("*").eq("tmdb_id", n).eq("published", true).maybeSingle();
  if (!data) return null;
  const { data: eps } = await supabase.from("episodes").select("*").eq("series_id", data.id).order("season_number").order("episode_number");
  return { movie: null, series: data as SeriesRow, episodes: (eps ?? []) as EpisodeRow[] };
}

export function youtubeKey(url: string | null | undefined) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return m?.[1] ?? null;
}

/** Private storage references are saved as storage://bucket/path and resolved to short-lived signed URLs. */
export async function resolveMediaUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (!url.startsWith("storage://")) return url;
  const rest = url.slice("storage://".length);
  const slash = rest.indexOf("/");
  const bucket = rest.slice(0, slash);
  const path = rest.slice(slash + 1);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 4);
  if (error) return null;
  return data.signedUrl;
}
