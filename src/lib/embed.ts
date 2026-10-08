/** Hosts conhecidos por exibir filmes/séries sem licença — nunca aceitos como fonte de iframe. */
const BLOCKED_HOSTS = [
  "myembed.biz", "embedmovies", "superflix", "warezcdn", "vidsrc", "2embed", "multiembed", "autoembed",
  "smashystream", "vidplay", "filemoon", "streamtape", "doodstream", "dood.", "mixdrop", "embedder", "moviesapi",
];

export function embedUrlProblem(url: string | null | undefined): string | null {
  const u = (url ?? "").trim();
  if (!u) return "Informe a URL do iframe.";
  let parsed: URL;
  try { parsed = new URL(u); } catch { return "URL inválida."; }
  if (parsed.protocol !== "https:") return "Use uma URL https://.";
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.some((b) => host.includes(b))) return "Esta fonte exibe conteúdo sem licença e não é aceita.";
  return null;
}

export const isEmbedAllowed = (url: string | null | undefined) => !!url && embedUrlProblem(url) === null;

export const iframeCode = (url: string) =>
  `<iframe\n  src="${url.replace(/"/g, "&quot;")}"\n  width="100%"\n  height="600"\n  frameborder="0"\n  allowfullscreen\n  loading="lazy">\n</iframe>`;
