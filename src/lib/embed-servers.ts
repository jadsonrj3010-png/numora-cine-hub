import type { MediaType } from "@/lib/types";

export type EmbedServer = { label: string; url: string };

export function getEmbedServers(
  tmdbId: string,
  type: MediaType,
  season?: number,
  episode?: number,
): EmbedServer[] {
  if (type === "movie") {
    return [
      { label: "Servidor 1", url: `https://vidsrc.io/embed/movie/${tmdbId}` },
      { label: "Servidor 2", url: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}` },
      { label: "Servidor 3", url: `https://vidsrc.xyz/embed/movie/${tmdbId}` },
      { label: "Servidor 4", url: `https://embed.su/embed/movie/${tmdbId}` },
    ];
  }
  const s = season ?? 1;
  const e = episode ?? 1;
  return [
    { label: "Servidor 1", url: `https://vidsrc.io/embed/tv/${tmdbId}/${s}/${e}` },
    { label: "Servidor 2", url: `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${s}&episode=${e}` },
    { label: "Servidor 3", url: `https://vidsrc.xyz/embed/tv/${tmdbId}/${s}/${e}` },
    { label: "Servidor 4", url: `https://embed.su/embed/tv/${tmdbId}/${s}/${e}` },
  ];
}
