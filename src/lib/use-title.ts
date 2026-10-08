import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { tmdbDetails } from "./tmdb.functions";
import { fetchLocalDetails, findLocalForTmdb, type EpisodeRow, type MovieRow, type SeriesRow } from "./local-catalog";
import type { MediaDetails, MediaType, Source } from "./types";

export interface TitleData {
  details: MediaDetails;
  movie: MovieRow | null;
  series: SeriesRow | null;
  episodes: EpisodeRow[];
}

/** Loads metadata (TMDB or local) plus any authorized local video attached to it. */
export function useTitle(source: Source, mediaType: MediaType, id: string) {
  const details = useServerFn(tmdbDetails);
  return useQuery({
    queryKey: ["title", source, mediaType, id],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TitleData | null> => {
      if (source === "local") return fetchLocalDetails(mediaType, id);
      const [d, local] = await Promise.all([details({ data: { mediaType, id } }), findLocalForTmdb(mediaType, id)]);
      if (!d) return null;
      return { details: d, movie: local?.movie ?? null, series: local?.series ?? null, episodes: local?.episodes ?? [] };
    },
  });
}
