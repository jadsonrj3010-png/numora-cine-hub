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
      { label: "Servidor 1", url: `https://vidsrc.to/embed/movie/${tmdbId}?lang=pt-BR` },
      { label: "Servidor 2", url: `https://vidsrcme.su/embed/movie/${tmdbId}?lang=pt-BR` },
      { label: "Servidor 3", url: `https://vidsrc.pro/embed/movie?tmdb=${tmdbId}&lang=pt-BR` },
      { label: "Servidor 4", url: `https://to.vidsrc.party/embed/movie/${tmdbId}?lang=pt-BR` },
    ];
  }
  const s = season ?? 1;
  const e = episode ?? 1;
  return [
    { label: "Servidor 1", url: `https://vidsrc.to/embed/tv/${tmdbId}/${s}/${e}?lang=pt-BR` },
    { label: "Servidor 2", url: `https://vidsrcme.su/embed/tv/${tmdbId}/${s}/${e}?lang=pt-BR` },
    { label: "Servidor 3", url: `https://vidsrc.pro/embed/tv?tmdb=${tmdbId}&season=${s}&episode=${e}&lang=pt-BR` },
    { label: "Servidor 4", url: `https://to.vidsrc.party/embed/tv/${tmdbId}/${s}/${e}?lang=pt-BR` },
  ];
}
