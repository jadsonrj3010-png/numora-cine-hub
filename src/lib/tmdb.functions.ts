import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { MediaDetails, MediaItem, Paged } from "./types";

const empty = (configured: boolean): Paged<MediaItem> => ({ items: [], page: 1, totalPages: 0, configured });

const LISTS = {
  trending_day: { path: "/trending/all/day" },
  trending_week: { path: "/trending/all/week" },
  popular_movies: { path: "/movie/popular", type: "movie" },
  popular_tv: { path: "/tv/popular", type: "tv" },
  now_playing: { path: "/movie/now_playing", type: "movie" },
  top_rated: { path: "/movie/top_rated", type: "movie" },
  top_rated_tv: { path: "/tv/top_rated", type: "tv" },
} as const;

export const tmdbList = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ list: z.enum(Object.keys(LISTS) as [keyof typeof LISTS]), page: z.number().int().min(1).max(500).default(1) }).parse(d),
  )
  .handler(async ({ data }): Promise<Paged<MediaItem>> => {
    const { tmdb, tmdbConfigured, mapList } = await import("./tmdb.server");
    if (!tmdbConfigured()) return empty(false);
    const def = LISTS[data.list] as { path: string; type?: "movie" | "tv" };
    const r = await tmdb(def.path, { page: data.page, region: "BR" });
    return { items: mapList(r.results ?? [], def.type), page: r.page, totalPages: Math.min(r.total_pages ?? 1, 500), configured: true };
  });

export const tmdbDiscover = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        mediaType: z.enum(["movie", "tv"]),
        genres: z.string().regex(/^[\d,|]*$/).optional(),
        originalLanguage: z.string().max(5).optional(),
        provider: z.string().regex(/^\d*$/).optional(),
        year: z.number().int().min(1900).max(2100).optional(),
        page: z.number().int().min(1).max(500).default(1),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<Paged<MediaItem>> => {
    const { tmdb, tmdbConfigured, mapList } = await import("./tmdb.server");
    if (!tmdbConfigured()) return empty(false);
    const r = await tmdb(`/discover/${data.mediaType}`, {
      page: data.page,
      sort_by: "popularity.desc",
      with_genres: data.genres,
      with_original_language: data.originalLanguage,
      with_watch_providers: data.provider,
      watch_region: data.provider ? "BR" : undefined,
      [data.mediaType === "movie" ? "primary_release_year" : "first_air_date_year"]: data.year,
      include_adult: "false",
    });
    return { items: mapList(r.results ?? [], data.mediaType), page: r.page, totalPages: Math.min(r.total_pages ?? 1, 500), configured: true };
  });

export const tmdbSearch = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().trim().min(1).max(100), page: z.number().int().min(1).max(50).default(1) }).parse(d))
  .handler(async ({ data }): Promise<Paged<MediaItem>> => {
    const { tmdb, tmdbConfigured, mapList } = await import("./tmdb.server");
    if (!tmdbConfigured()) return empty(false);
    const r = await tmdb("/search/multi", { query: data.q, page: data.page, include_adult: "false" });
    const results: any[] = [];
    for (const x of r.results ?? []) {
      if (x.media_type === "person") results.push(...(x.known_for ?? []));
      else results.push(x);
    }
    // Year search, e.g. "2019"
    if (/^(19|20)\d{2}$/.test(data.q) && data.page === 1) {
      const y = await tmdb("/discover/movie", { primary_release_year: data.q, sort_by: "popularity.desc" });
      results.push(...(y.results ?? []).map((m: any) => ({ ...m, media_type: "movie" })));
    }
    const seen = new Set<string>();
    const items = mapList(results).filter((i) => (seen.has(i.mediaType + i.id) ? false : (seen.add(i.mediaType + i.id), true)));
    return { items, page: r.page, totalPages: Math.min(r.total_pages ?? 1, 50), configured: true };
  });

export const tmdbDetails = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ mediaType: z.enum(["movie", "tv"]), id: z.string().regex(/^\d+$/) }).parse(d))
  .handler(async ({ data }): Promise<MediaDetails | null> => {
    const { tmdb, tmdbConfigured, mapItem, mapList, img } = await import("./tmdb.server");
    if (!tmdbConfigured()) return null;
    const append = data.mediaType === "movie" ? "credits,videos,recommendations,release_dates,watch/providers" : "credits,videos,recommendations,content_ratings,watch/providers";
    const r = await tmdb(`/${data.mediaType}/${data.id}`, { append_to_response: append, include_video_language: "pt,en" });
    const base = mapItem(r, data.mediaType)!;
    base.backdrop = img(r.backdrop_path, "original") ?? base.backdrop;
    let age: string | null = null;
    if (data.mediaType === "movie") {
      const br = r.release_dates?.results?.find((x: any) => x.iso_3166_1 === "BR");
      age = br?.release_dates?.find((d: any) => d.certification)?.certification ?? null;
    } else {
      age = r.content_ratings?.results?.find((x: any) => x.iso_3166_1 === "BR")?.rating ?? null;
    }
    const director =
      data.mediaType === "movie"
        ? r.credits?.crew?.find((c: any) => c.job === "Director")?.name ?? null
        : r.created_by?.map((c: any) => c.name).join(", ") || null;
    const trailer = (r.videos?.results ?? []).find((v: any) => v.site === "YouTube" && v.type === "Trailer");
    return {
      ...base,
      originalTitle: r.original_title ?? r.original_name ?? null,
      duration: data.mediaType === "movie" ? r.runtime ?? null : r.episode_run_time?.[0] ?? null,
      ageRating: age,
      cast: (r.credits?.cast ?? []).slice(0, 15).map((c: any) => ({ name: c.name, character: c.character, photo: img(c.profile_path, "w185") })),
      director,
      trailerKey: trailer?.key ?? null,
      seasons: r.number_of_seasons ?? null,
      related: mapList(r.recommendations?.results ?? []).slice(0, 18),
      ...(() => {
        const br = r["watch/providers"]?.results?.BR;
        const seen = new Set<string>();
        const providers: { name: string; logo: string; kind: string }[] = [];
        for (const [k, label] of [["flatrate", "Assinatura"], ["free", "Grátis"], ["ads", "Com anúncios"], ["rent", "Aluguel"], ["buy", "Compra"]] as const)
          for (const x of br?.[k] ?? []) if (!seen.has(x.provider_name) && x.logo_path) { seen.add(x.provider_name); providers.push({ name: x.provider_name, logo: `https://image.tmdb.org/t/p/w92${x.logo_path}`, kind: label }); }
        return { providers, watchLink: (br?.link as string) ?? null };
      })(),
    };
  });

export const tmdbRecommendFor = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ items: z.array(z.object({ mediaType: z.enum(["movie", "tv"]), id: z.string().regex(/^\d+$/) })).max(5) }).parse(d),
  )
  .handler(async ({ data }): Promise<Paged<MediaItem>> => {
    const { tmdb, tmdbConfigured, mapList } = await import("./tmdb.server");
    if (!tmdbConfigured()) return empty(false);
    const lists = await Promise.all(
      data.items.map((i) => tmdb(`/${i.mediaType}/${i.id}/recommendations`).then((r) => mapList(r.results ?? [], i.mediaType)).catch(() => [])),
    );
    const exclude = new Set(data.items.map((i) => i.mediaType + i.id));
    const seen = new Set<string>();
    const out: MediaItem[] = [];
    const max = Math.max(0, ...lists.map((l) => l.length));
    for (let k = 0; k < max; k++)
      for (const l of lists) {
        const it = l[k];
        if (!it) continue;
        const key = it.mediaType + it.id;
        if (exclude.has(key) || seen.has(key)) continue;
        seen.add(key);
        out.push(it);
      }
    return { items: out, page: 1, totalPages: 1, configured: true };
  });

export type SeasonEpisode = {
  episode_number: number;
  name: string;
  overview: string;
  runtime: number | null;
  still_path: string | null;
};

export const tmdbSeasonDetails = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().regex(/^\d+$/), season: z.number().int().min(1) }).parse(d))
  .handler(async ({ data }): Promise<{ episodeCount: number; episodes: SeasonEpisode[] } | null> => {
    const { tmdb, tmdbConfigured } = await import("./tmdb.server");
    if (!tmdbConfigured()) return null;
    try {
      const r = await tmdb(`/tv/${data.id}/season/${data.season}`, {});
      const episodes: SeasonEpisode[] = Array.isArray(r.episodes)
        ? r.episodes.map((ep: any) => ({
            episode_number: ep.episode_number,
            name: ep.name ?? "",
            overview: ep.overview ?? "",
            runtime: ep.runtime ?? null,
            still_path: ep.still_path ?? null,
          }))
        : [];
      return { episodeCount: episodes.length, episodes };
    } catch {
      return null;
    }
  });

/** Candidatos para o envio automático: identifica o título a partir do nome/arquivo. */
export const tmdbCandidates = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ name: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { tmdb, tmdbConfigured, img } = await import("./tmdb.server");
    if (!tmdbConfigured()) return [];
    const raw = data.name.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[._]+/g, " ");
    const ym = raw.match(/\b(19[0-9]{2}|20[0-9]{2})\b/);
    const year = ym ? Number(ym[1]) : null;
    const q = raw.replace(/\b(19|20)\d{2}\b.*$/, "").replace(/\b(1080p|720p|480p|2160p|4k|bluray|web[- ]?dl|webrip|hdrip|dublado|legendado|dual|x264|x265|hevc)\b.*$/i, "").replace(/[\[\]()-]+/g, " ").trim() || raw;
    const r = await tmdb("/search/multi", { query: q, include_adult: "false" });
    const list = (r.results ?? []).filter((x: any) => x.media_type === "movie" || x.media_type === "tv").map((x: any) => {
      const d: string = x.release_date ?? x.first_air_date ?? "";
      return { mediaType: x.media_type as "movie" | "tv", id: String(x.id), title: x.title ?? x.name, year: d ? Number(d.slice(0, 4)) : null, poster: img(x.poster_path, "w185"), popularity: x.popularity ?? 0 };
    });
    if (year) list.sort((a: any, b: any) => Number(b.year === year) - Number(a.year === year));
    return list.slice(0, 6).map(({ popularity, ...x }: any) => x) as { mediaType: "movie" | "tv"; id: string; title: string; year: number | null; poster: string | null }[];
  });

/** Monta todos os dados do cadastro (categoria, gêneros, capa etc.) a partir da TMDB. */
export const tmdbAutoRow = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ mediaType: z.enum(["movie", "tv"]), id: z.string().regex(/^\d+$/) }).parse(d))
  .handler(async ({ data }) => {
    const { tmdb, img, GENRES } = await import("./tmdb.server");
    const append = data.mediaType === "movie" ? "credits,videos,release_dates" : "credits,videos,content_ratings";
    const r = await tmdb(`/${data.mediaType}/${data.id}`, { append_to_response: append, include_video_language: "pt,en" });
    const ids: number[] = (r.genres ?? []).map((g: any) => g.id);
    const lang: string = r.original_language ?? "";
    let category = data.mediaType === "movie" ? "filmes" : "series";
    if (ids.includes(16) && lang === "ja") category = "animes";
    else if (ids.includes(10766)) category = "novelas";
    else if (ids.includes(99)) category = "documentarios";
    else if (ids.includes(10751) || ids.includes(10762)) category = "infantil";
    else if (data.mediaType === "tv" && ids.includes(18)) category = "dramas";
    const d: string = r.release_date ?? r.first_air_date ?? "";
    const age = data.mediaType === "movie"
      ? r.release_dates?.results?.find((x: any) => x.iso_3166_1 === "BR")?.release_dates?.find((x: any) => x.certification)?.certification ?? null
      : r.content_ratings?.results?.find((x: any) => x.iso_3166_1 === "BR")?.rating ?? null;
    const trailer = (r.videos?.results ?? []).find((v: any) => v.site === "YouTube" && v.type === "Trailer");
    return {
      title: (r.title ?? r.name) as string,
      description: (r.overview as string) || null,
      category,
      year: d ? Number(d.slice(0, 4)) : null,
      rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
      age_rating: age as string | null,
      director: (data.mediaType === "movie" ? r.credits?.crew?.find((c: any) => c.job === "Director")?.name : r.created_by?.map((c: any) => c.name).join(", ")) || null,
      cast_list: (r.credits?.cast ?? []).slice(0, 10).map((c: any) => c.name as string),
      genres: ids.map((i) => GENRES[i]).filter(Boolean) as string[],
      duration_min: (data.mediaType === "movie" ? r.runtime : r.episode_run_time?.[0]) ?? null,
      poster_url: img(r.poster_path, "w500"),
      backdrop_url: img(r.backdrop_path, "original"),
      trailer_url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
      tmdb_id: Number(data.id),
    };
  });
