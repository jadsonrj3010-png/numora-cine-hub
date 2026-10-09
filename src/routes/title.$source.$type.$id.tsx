import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { tmdbDetails, tmdbSeasonDetails } from "@/lib/tmdb.functions";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock, Download, Play, Plus, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MediaRow } from "@/components/media/MediaRow";
import { useToggleFavorite } from "@/hooks/use-library";
import { useAuth } from "@/hooks/use-auth";
import { useTitle } from "@/lib/use-title";
import { fetchLocal, resolveMediaUrl } from "@/lib/local-catalog";
import { supabase } from "@/integrations/supabase/client";
import { typeLabel, type MediaType, type Source } from "@/lib/types";
import { useState, useEffect, useRef } from "react";
import { getEmbedServers } from "@/lib/embed-servers";

export const Route = createFileRoute("/title/$source/$type/$id")({
  beforeLoad: ({ params }) => {
    if (!["tmdb", "local"].includes(params.source) || !["movie", "tv"].includes(params.type)) throw notFound();
  },
  loader: async ({ params }) => {
    if (params.source !== "tmdb" || !/^\d+$/.test(params.id)) return { seo: null };
    try {
      return { seo: await tmdbDetails({ data: { mediaType: params.type as MediaType, id: params.id } }) };
    } catch {
      return { seo: null };
    }
  },
  head: ({ params, loaderData }) => {
    const d = loaderData?.seo;
    const url = `https://numoracine.com.br/title/${params.source}/${params.type}/${params.id}`;
    const kind = params.type === "movie" ? "filme" : "série";
    const title = d ? `${d.title}${d.year ? ` (${d.year})` : ""} — Assistir ${kind} | NUMORA CINE` : "Detalhes — NUMORA CINE";
    const genres = d?.genres.slice(0, 3).join(", ");
    const desc = d
      ? `${d.title}: ${kind}${genres ? ` de ${genres}` : ""}. ${d.overview || "Elenco, avaliação e onde assistir."}`.slice(0, 158)
      : "Sinopse, elenco, avaliação e onde assistir no NUMORA CINE.";
    const image = d?.backdrop?.replace("/original/", "/w1280/") ?? d?.poster ?? null;
    const meta: any[] = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: params.type === "movie" ? "video.movie" : "video.tv_show" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (image) meta.push({ property: "og:image", content: image }, { name: "twitter:image", content: image });
    const ld = d && {
      "@context": "https://schema.org",
      "@type": params.type === "movie" ? "Movie" : "TVSeries",
      name: d.title,
      description: d.overview || undefined,
      image: d.poster ?? undefined,
      datePublished: d.year ? String(d.year) : undefined,
      genre: d.genres.length ? d.genres : undefined,
      director: d.director && params.type === "movie" ? { "@type": "Person", name: d.director } : undefined,
      creator: d.director && params.type === "tv" ? { "@type": "Person", name: d.director } : undefined,
      actor: d.cast.slice(0, 8).map((c) => ({ "@type": "Person", name: c.name })),
      contentRating: d.ageRating ?? undefined,
      aggregateRating: d.rating ? { "@type": "AggregateRating", ratingValue: d.rating, bestRating: 10 } : undefined,
      url,
    };
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: ld ? [{ type: "application/ld+json", children: JSON.stringify(ld) }] : [],
    };
  },
  component: TitlePage,
});

function TitlePage() {
  const p = Route.useParams();
  const source = p.source as Source, type = p.type as MediaType;
  const { data, isLoading, isError } = useTitle(source, type, p.id);
  const { toggle, isFav } = useToggleFavorite();
  const { user } = useAuth();
  const more = useQuery({ queryKey: ["local", "home"], queryFn: () => fetchLocal({ limit: 20 }), enabled: source === "local" });

  // ── Inline player ──────────────────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [playingSeason, setPlayingSeason] = useState(1);
  const [playingEp, setPlayingEp] = useState(1);
  const [serverIdx, setServerIdx] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [slowServer, setSlowServer] = useState(false);
  const historyLogged = useRef(false);

  // ── Season/episode selector state ──────────────────────────────────
  const [selectedSeason, setSelectedSeason] = useState(1);

  if (isLoading) return <DetailsSkeleton />;
  if (isError || !data) return <p className="px-4 py-20 text-center text-muted-foreground">Não foi possível carregar este título.</p>;

  const d = data.details;
  const fav = isFav(d);
  const hasVideo = !!data.movie?.video_url || !!data.movie?.iframe_url || data.episodes.some((e) => e.video_url || e.iframe_url) || source === "tmdb";
  const canDownload = !!data.movie?.downloadable && !!data.movie.video_url;
  const related = d.related.length ? d.related : (more.data ?? []).filter((x) => x.id !== d.id);

  const isTmdbTv = source === "tmdb" && type === "tv";
  const tmdbId = d.id ?? null;

  const embedServers = (() => {
    if (!tmdbId || source !== "tmdb") return [];
    if (type === "movie") return getEmbedServers(tmdbId, type);
    return getEmbedServers(tmdbId, type, playingSeason, playingEp);
  })();
  const embedSrc = playing ? (embedServers[serverIdx]?.url ?? null) : null;

  const download = async (): Promise<any> => {
    if (!user) return toast.error("Entre na sua conta para salvar");
    if (canDownload) {
      const url = await resolveMediaUrl(data.movie!.video_url);
      if (!url) return toast.error("Download indisponível");
      await supabase.from("downloads").upsert(
        { user_id: user.id, source, media_type: type, content_id: d.id, title: d.title, poster_url: d.poster },
        { onConflict: "user_id,source,media_type,content_id" },
      );
      const a = document.createElement("a");
      a.href = url; a.download = d.title; a.click();
      toast.success("Download iniciado");
    } else {
      await supabase.from("downloads").upsert(
        { user_id: user.id, source, media_type: type, content_id: d.id, title: d.title, poster_url: d.poster },
        { onConflict: "user_id,source,media_type,content_id" },
      );
      toast.success("Salvo em Downloads!");
    }
  };

  return (
    <TitlePageInner
      p={p}
      source={source}
      type={type}
      data={data}
      d={d}
      fav={fav}
      hasVideo={hasVideo}
      canDownload={canDownload}
      related={related}
      isTmdbTv={isTmdbTv}
      tmdbId={tmdbId}
      playing={playing}
      setPlaying={setPlaying}
      playingSeason={playingSeason}
      setPlayingSeason={setPlayingSeason}
      playingEp={playingEp}
      setPlayingEp={setPlayingEp}
      serverIdx={serverIdx}
      setServerIdx={setServerIdx}
      iframeLoaded={iframeLoaded}
      setIframeLoaded={setIframeLoaded}
      slowServer={slowServer}
      setSlowServer={setSlowServer}
      historyLogged={historyLogged}
      selectedSeason={selectedSeason}
      setSelectedSeason={setSelectedSeason}
      embedServers={embedServers}
      embedSrc={embedSrc}
      toggle={toggle}
      user={user}
      download={download}
    />
  );
}

function TitlePageInner({
  p, source, type, data, d, fav, hasVideo, canDownload, related,
  isTmdbTv, tmdbId,
  playing, setPlaying, playingSeason, setPlayingSeason, playingEp, setPlayingEp,
  serverIdx, setServerIdx, iframeLoaded, setIframeLoaded, slowServer, setSlowServer,
  historyLogged, selectedSeason, setSelectedSeason, embedServers, embedSrc,
  toggle, user, download,
}: any) {

  // Reset server state whenever the playing target changes
  useEffect(() => {
    setServerIdx(0);
    setIframeLoaded(false);
    setSlowServer(false);
    historyLogged.current = false;
  }, [playingSeason, playingEp, tmdbId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Slow-server warning — fires 15 s after embed URL becomes active
  useEffect(() => {
    if (!embedSrc) return;
    setIframeLoaded(false);
    setSlowServer(false);
    const t = setTimeout(() => setSlowServer(true), 15_000);
    return () => clearTimeout(t);
  }, [embedSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (iframeLoaded) setSlowServer(false);
  }, [iframeLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Log to watch_history when embed starts
  useEffect(() => {
    if (!user || !data || !embedSrc) return;
    if (historyLogged.current) return;
    historyLogged.current = true;
    supabase.from("watch_history").insert({
      user_id: user.id,
      source,
      media_type: type,
      content_id: d.id,
      title: d.title,
      poster_url: d.poster,
      episode_id: null,
    }).then(() => {});
  }, [embedSrc, user, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const seasonDetailsQuery = useQuery({
    queryKey: ["tmdb-season-detail", p.id, selectedSeason],
    enabled: isTmdbTv && !!tmdbId,
    queryFn: async () => tmdbSeasonDetails({ data: { id: p.id, season: selectedSeason } }),
    staleTime: 60 * 60_000,
  });
  const seasonEpisodes = seasonDetailsQuery.data?.episodes ?? [];

  return (
    <div>
      {playing ? (
        <div className="mx-auto max-w-6xl px-0 pt-4 sm:px-4 lg:px-8">
          {/* Close button */}
          <div className="mb-3 flex items-center justify-between px-4 sm:px-0">
            <h2 className="font-semibold text-foreground">{d.title}</h2>
            <button
              onClick={() => setPlaying(false)}
              className="flex min-h-[44px] items-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" /> Fechar player
            </button>
          </div>

          {/* Embed iframe */}
          {embedSrc ? (
            <div className="relative">
              <iframe
                key={embedSrc}
                className="aspect-video w-full bg-overlay sm:rounded-xl"
                src={embedSrc}
                title={d.title ?? "Player"}
                frameBorder="0"
                scrolling="no"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                loading="eager"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setIframeLoaded(true)}
              />
              {slowServer && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 rounded-b-xl bg-black/80 px-4 py-3 text-sm">
                  <span className="text-yellow-400">⚠ O servidor está demorando. Tente outro servidor abaixo.</span>
                  <button onClick={() => setSlowServer(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid aspect-video w-full place-items-center bg-card px-6 text-center text-sm text-muted-foreground sm:rounded-xl">
              <p>Nenhum servidor disponível para este conteúdo.</p>
            </div>
          )}

          {/* Server-switch buttons */}
          {embedServers.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-2 px-4 sm:px-0">
              <span className="self-center text-xs text-muted-foreground">Trocar servidor:</span>
              {embedServers.map((sv: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setServerIdx(i)}
                  className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-semibold transition ${
                    i === serverIdx
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground hover:bg-primary/20"
                  }`}
                >
                  {sv.label}
                </button>
              ))}
            </div>
          )}
          <p className="mt-1 px-4 text-xs text-muted-foreground sm:px-0">
            Se o vídeo não carregar, tente outro servidor acima.
          </p>
        </div>
      ) : (
        <div className="relative isolate">
          <div className="absolute inset-0 -z-10 h-[40vh] max-h-[420px] overflow-hidden sm:h-[60vh] sm:max-h-[620px]">
            {d.backdrop && <img src={d.backdrop} alt="" className="h-full w-full object-cover opacity-60" />}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
          </div>
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-[20vh] sm:flex-row sm:items-end sm:pt-40 lg:px-8">
            {d.poster && <img src={d.poster} alt={d.title} className="hidden w-52 shrink-0 rounded-xl shadow-2xl ring-1 ring-border sm:block" />}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-primary px-2 py-0.5 font-bold text-primary-foreground">{typeLabel(type)}</span>
                {d.ageRating && <span className="rounded border border-border px-1.5 py-0.5 font-semibold text-foreground">{d.ageRating}</span>}
                {d.year && <span>{d.year}</span>}
                {d.duration && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{d.duration} min</span>}
                {d.seasons && <span>{d.seasons} temporada{d.seasons > 1 ? "s" : ""}</span>}
                {d.rating != null && <span className="flex items-center gap-1 font-bold text-primary"><Star className="h-3.5 w-3.5 fill-current" />{d.rating.toFixed(1)}</span>}
              </div>
              <h1 className="mt-2 text-3xl font-extrabold sm:text-5xl">{d.title}</h1>
              {d.genres.length > 0 && <p className="mt-2 text-sm text-muted-foreground">{d.genres.join(" · ")}</p>}
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="min-h-[44px] min-w-[44px] rounded-full font-bold"
                  onClick={() => {
                    setPlayingSeason(1);
                    setPlayingEp(1);
                    setPlaying(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={!hasVideo}
                >
                  <Play className="fill-current" /> Assistir
                </Button>
                <Button size="lg" variant="secondary" className="min-h-[44px] min-w-[44px] rounded-full font-bold" onClick={() => toggle(d)}>{fav ? <Check /> : <Plus />} Minha Lista</Button>
                {canDownload && <Button size="lg" variant="outline" className="min-h-[44px] min-w-[44px] rounded-full font-bold" onClick={download}><Download /> Baixar</Button>}
                {!canDownload && <Button size="lg" variant="outline" className="min-h-[44px] min-w-[44px] rounded-full font-bold" onClick={download}><Download /> Salvar</Button>}
              </div>
              {!hasVideo && <p className="mt-3 text-xs text-muted-foreground">Este conteúdo ainda não possui vídeo disponível.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Netflix-style episode selector — only for TMDB TV */}
      {isTmdbTv && tmdbId && (
        <div className="mx-auto mt-6 max-w-6xl px-4 lg:px-8">
          {/* Season tabs */}
          <div className="mb-4">
            <h2 className="mb-3 text-lg font-bold">Temporadas</h2>
            <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
              {Array.from(
                { length: Math.min(Math.max(1, data?.details?.seasons ?? 1), 50) },
                (_, i) => i + 1,
              ).map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSeason(s)}
                  className={`min-h-[40px] shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    selectedSeason === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground hover:bg-primary/20"
                  }`}
                >
                  Temporada {s}
                </button>
              ))}
            </div>
          </div>

          {/* Episode cards */}
          <div className="mb-2">
            <h2 className="mb-3 text-lg font-bold">
              Episódios — Temporada {selectedSeason}
            </h2>
            {seasonDetailsQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-24 animate-pulse rounded-xl bg-card" />
                ))}
              </div>
            ) : seasonEpisodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum episódio encontrado.</p>
            ) : (
              <div className="space-y-2">
                {seasonEpisodes.map((ep: any) => {
                  const isActive =
                    playing &&
                    playingSeason === selectedSeason &&
                    playingEp === ep.episode_number;
                  return (
                    <button
                      key={ep.episode_number}
                      onClick={() => {
                        setPlayingSeason(selectedSeason);
                        setPlayingEp(ep.episode_number);
                        setPlaying(true);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`flex w-full items-start gap-4 rounded-xl p-3 text-left transition hover:bg-accent ${
                        isActive ? "ring-2 ring-primary bg-accent" : "bg-card"
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-secondary sm:h-20 sm:w-36">
                        {ep.still_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                            alt={ep.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center">
                            <Play className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        {isActive && (
                          <div className="absolute inset-0 grid place-items-center bg-black/50">
                            <Play className="h-6 w-6 fill-current text-primary" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          {ep.episode_number}. {ep.name}
                        </p>
                        {ep.runtime != null && (
                          <p className="text-xs text-muted-foreground">{ep.runtime} min</p>
                        )}
                        <p className="mt-1 line-clamp-2 text-xs text-foreground/70">
                          {ep.overview || "Descrição não disponível."}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto mt-8 grid max-w-6xl gap-8 px-4 lg:grid-cols-[2fr_1fr] lg:px-8">
        <div>
          <h2 className="mb-2 text-lg font-bold">Sinopse</h2>
          <p className="leading-relaxed text-foreground/85">{d.overview || "Sinopse não disponível."}</p>
          {d.trailerKey && (
            <div className="mt-6">
              <h2 className="mb-2 text-lg font-bold">Trailer</h2>
              <div className="aspect-video overflow-hidden rounded-xl bg-card">
                <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${d.trailerKey}`} title="Trailer" loading="lazy" allowFullScreen allow="encrypted-media; picture-in-picture" />
              </div>
            </div>
          )}
          {data.episodes.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-lg font-bold">Episódios</h2>
              <div className="space-y-2">
                {data.episodes.map((e: any) => (
                  <Link key={e.id} to="/watch/$source/$type/$id" params={{ source, type, id: d.id }} search={{ ep: e.id }}
                    className="flex items-center gap-3 rounded-lg bg-card p-3 hover:bg-accent">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">T{e.season_number}E{e.episode_number}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{e.title}</p>
                      {e.duration_min && <p className="text-xs text-muted-foreground">{e.duration_min} min</p>}
                    </div>
                    <Play className="h-4 w-4 text-primary" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <aside className="space-y-5 px-4 text-sm lg:px-0">
          {!!d.providers?.length && (
            <div>
              <p className="mb-2 text-muted-foreground">Onde assistir</p>
              <div className="flex flex-wrap gap-3">
                {d.providers.map((pr: any) => (
                  <a key={pr.name} href={d.watchLink ?? "#"} target="_blank" rel="noopener noreferrer" title={`${pr.name} · ${pr.kind}`} className="w-16 text-center">
                    <img src={pr.logo} alt={pr.name} loading="lazy" className="mx-auto h-12 w-12 rounded-xl ring-1 ring-border transition hover:scale-105" />
                    <p className="mt-1 text-[10px] text-muted-foreground">{pr.kind}</p>
                  </a>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Dados de disponibilidade: JustWatch via TMDB.</p>
            </div>
          )}
          {d.director && <div><p className="text-muted-foreground">{type === "movie" ? "Direção" : "Criação"}</p><p className="font-semibold">{d.director}</p></div>}
          {d.cast.length > 0 && (
            <div>
              <p className="mb-2 text-muted-foreground">Elenco</p>
              <div className="scrollbar-none flex gap-3 overflow-x-auto lg:flex-wrap">
                {d.cast.map((c: any) => (
                  <div key={c.name} className="w-20 shrink-0 text-center">
                    <div className="mx-auto h-16 w-16 overflow-hidden rounded-full bg-card">
                      {c.photo && <img src={c.photo} alt={c.name} loading="lazy" className="h-full w-full object-cover" />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold">{c.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <MediaRow title="Você também pode gostar" items={related} />
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-40 lg:px-8">
      <div className="h-8 w-2/3 animate-pulse rounded bg-card" />
      <div className="mt-4 h-4 w-1/3 animate-pulse rounded bg-card" />
      <div className="mt-8 h-24 animate-pulse rounded bg-card" />
    </div>
  );
}
