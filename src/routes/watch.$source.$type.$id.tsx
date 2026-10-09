import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { PreRollAd } from "@/components/ads/VideoAds";
import { useTitle } from "@/lib/use-title";
import { resolveMediaUrl, youtubeKey } from "@/lib/local-catalog";
import { isEmbedAllowed } from "@/lib/embed";
import { archiveFile, archiveMatch } from "@/lib/archive.functions";
import { tmdbDetails } from "@/lib/tmdb.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { MediaType, Source } from "@/lib/types";

export const Route = createFileRoute("/watch/$source/$type/$id")({
  validateSearch: z.object({ ep: z.string().uuid().optional(), teste: z.coerce.number().optional() }),
  beforeLoad: ({ params }) => {
    if (!["tmdb", "local"].includes(params.source) || !["movie", "tv"].includes(params.type)) throw notFound();
  },
  loader: async ({ params }) => {
    if (params.source !== "tmdb" || !/^\d+$/.test(params.id)) return { seoTitle: null as string | null };
    try {
      const d = await tmdbDetails({ data: { mediaType: params.type as MediaType, id: params.id } });
      return { seoTitle: d?.title ?? null };
    } catch {
      return { seoTitle: null as string | null };
    }
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.seoTitle;
    const title = name ? `Assistir ${name} — NUMORA CINE` : "Assistir — NUMORA CINE";
    const desc = name ? `Assista ${name} (${params.type === "movie" ? "filme" : "série"}) no player do NUMORA CINE.` : "Player do NUMORA CINE.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "video.other" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: Watch,
});

// Vídeo livre (Blender Foundation, licença CC-BY) usado só no modo de teste do player.
const DEMO_SOURCES = [
  { label: "1080p", url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4" },
  { label: "720p", url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4" },
  { label: "360p", url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4" },
];

function Watch() {
  const p = Route.useParams();
  const { ep, teste } = Route.useSearch();
  const source = p.source as Source, type = p.type as MediaType;
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { data, isLoading } = useTitle(source, type, p.id);
  const [adDone, setAdDone] = useState(false);
  const historyLogged = useRef(false);
  const testMode = teste === 1 || isAdmin;

  const episode = data?.episodes.find((e) => e.id === ep) ?? data?.episodes.find((e) => e.video_url || e.iframe_url);
  const iframeRaw = data?.movie ? data.movie.iframe_url : episode?.iframe_url ?? null;
  const iframeSrc = isEmbedAllowed(iframeRaw) ? iframeRaw : null;
  const rawVideo = iframeSrc ? null : data?.movie?.video_url ?? episode?.video_url ?? null;

  // Fallback automático via VidRift quando não há iframe nem vídeo configurado
  const tmdbId = data?.details?.id ?? null;
  const embedFallbackSrc = (() => {
    if (iframeSrc || rawVideo) return null; // já tem player configurado
    if (!tmdbId) return null;
    if (type === "movie") return `https://vidrift.net/movie/${tmdbId}`;
    if (type === "tv") {
      if (episode) return `https://vidrift.net/tv/${tmdbId}/${episode.season_number}/${episode.episode_number}`;
      return `https://vidrift.net/tv/${tmdbId}`;
    }
    return null;
  })();
  const rawSubs = data?.movie?.subtitle_url ?? episode?.subtitle_url ?? null;
  const ytKey = youtubeKey(rawVideo);

  const media = useQuery({
    queryKey: ["media-url", rawVideo, rawSubs, user?.id],
    enabled: !!rawVideo && !ytKey,
    queryFn: async () => ({ video: await resolveMediaUrl(rawVideo), subs: await resolveMediaUrl(rawSubs) }),
    staleTime: 60 * 60_000,
  });

  const archive = useQuery({
    queryKey: ["archive-match", source, type, p.id],
    enabled: !!data && !rawVideo && !iframeSrc && !embedFallbackSrc && source === "tmdb" && type === "movie" && !!data.details.year,
    queryFn: async () => {
      const id = await archiveMatch({ data: { title: data!.details.originalTitle || data!.details.title, year: data!.details.year } });
      return id ? archiveFile({ data: { id } }) : null;
    },
    staleTime: 60 * 60_000,
  });
  const arch = archive.data;

  const progress = useQuery({
    queryKey: ["progress-one", source, type, p.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("watch_progress").select("position_seconds").match({ source, media_type: type, content_id: p.id }).maybeSingle();
      return Number(data?.position_seconds ?? 0);
    },
  });

  useEffect(() => {
    const localId = data?.movie?.id ?? data?.series?.id;
    if (media.data?.video && localId) supabase.rpc("increment_views", { _kind: type, _id: localId });
  }, [media.data?.video]); // eslint-disable-line react-hooks/exhaustive-deps

  const onProgress = useCallback(async (pos: number, dur: number) => {
    if (!user || !data || !isFinite(pos)) return;
    const d = data.details;
    const base = { user_id: user.id, source, media_type: type, content_id: d.id, title: d.title, poster_url: d.poster, episode_id: episode?.id ?? null };
    if (!historyLogged.current) {
      historyLogged.current = true;
      await supabase.from("watch_history").insert(base);
    }
    await supabase.from("watch_progress").upsert(
      { ...base, backdrop_url: d.backdrop, position_seconds: pos, duration_seconds: isFinite(dur) ? dur : 0, updated_at: new Date().toISOString() },
      { onConflict: "user_id,source,media_type,content_id" },
    );
  }, [user, data, source, type, episode?.id]);

  const back = (
    <button onClick={() => router.history.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-5 w-5" /> Voltar
    </button>
  );

  const needsLogin = !!rawVideo && rawVideo.startsWith("storage://") && !user;

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-0 pt-4 sm:px-4 lg:px-8">
      <div className="mb-3 px-4 sm:px-0">{back}</div>
      {isLoading || (rawVideo && media.isLoading && !needsLogin) ? (
        <div className="aspect-video w-full animate-pulse bg-card sm:rounded-xl" />
      ) : needsLogin ? (
        <Message>
          <Link to="/auth" className="font-semibold text-primary">Entre na sua conta</Link> para assistir a este conteúdo.
        </Message>
      ) : iframeSrc ? (
        <iframe
          key={iframeSrc}
          className="aspect-video w-full bg-overlay sm:rounded-xl"
          src={iframeSrc}
          title={data?.details.title ?? "Player"}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : embedFallbackSrc ? (
        <iframe
          key={embedFallbackSrc}
          className="aspect-video w-full bg-overlay sm:rounded-xl"
          src={embedFallbackSrc}
          title={data?.details.title ?? "Player"}
          frameBorder="0"
          scrolling="no"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
        />
      ) : !rawVideo && archive.isLoading ? (
        <div className="aspect-video w-full animate-pulse bg-card sm:rounded-xl" />
      ) : !rawVideo && arch ? (
        <div>
          <VideoPlayer sources={[{ label: "Auto", url: arch.video }]} subtitleUrl={arch.subs} poster={data?.details.backdrop ?? arch.thumb} startAt={progress.data ?? 0} onProgress={onProgress} />
          <p className="mt-2 px-4 text-xs text-muted-foreground sm:px-0">Filme completo em domínio público · Internet Archive</p>
        </div>
      ) : ytKey ? (
        <div>
          <iframe
            className="aspect-video w-full bg-overlay sm:rounded-xl"
            src={`https://www.youtube-nocookie.com/embed/${ytKey}?rel=0`}
            title={data?.details.title ?? "Vídeo"}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
          <p className="mt-2 px-4 text-xs text-muted-foreground sm:px-0">Reproduzindo com o player oficial do YouTube.</p>
        </div>
      ) : !media.data?.video && testMode ? (
        <div>
          <div className="relative">
            <VideoPlayer sources={DEMO_SOURCES} poster={data?.details.backdrop ?? null} />
            <span className="absolute left-3 top-3 rounded-full bg-primary/90 px-3 py-1 text-xs font-bold text-primary-foreground shadow-lg">
              Modo Teste (Admin)
            </span>
          </div>
          <p className="mt-2 px-4 text-xs text-muted-foreground sm:px-0">
            Vídeo de demonstração livre (Big Buck Bunny, Blender Foundation) visível só para você. Os visitantes continuam vendo o trailer oficial ou o vídeo autorizado.
          </p>
        </div>
      ) : !media.data?.video ? (
        data?.details.trailerKey ? (
          <div>
            <iframe
              className="aspect-video w-full bg-overlay sm:rounded-xl"
              src={`https://www.youtube-nocookie.com/embed/${data.details.trailerKey}?autoplay=1&rel=0`}
              title={`Trailer — ${data.details.title}`}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
            <p className="mt-2 px-4 text-xs text-muted-foreground sm:px-0">Exibindo o trailer oficial. O filme completo aparece aqui quando um vídeo autorizado for enviado pelo painel.</p>
          </div>
        ) : (
          <Message>Este conteúdo ainda não possui vídeo disponível.</Message>
        )
      ) : !adDone ? (
        <>
          <div className="aspect-video w-full bg-overlay sm:rounded-xl" />
          <PreRollAd onComplete={() => setAdDone(true)} />
        </>
      ) : (
        <VideoPlayer
          sources={[{ label: "Auto", url: media.data.video }]}
          subtitleUrl={media.data.subs}
          poster={data?.details.backdrop ?? null}
          startAt={progress.data ?? 0}
          onProgress={onProgress}
        />
      )}
      {data && (
        <div className="px-4 py-5 sm:px-0">
          <h1 className="text-xl font-bold sm:text-2xl">{data.details.title}</h1>
          {episode && <p className="text-sm text-muted-foreground">Temporada {episode.season_number} · Episódio {episode.episode_number} — {episode.title}</p>}
          <p className="mt-2 line-clamp-3 text-sm text-foreground/80">{data.details.overview}</p>
          {data.episodes.length > 1 && (
            <div className="scrollbar-none mt-4 flex gap-2 overflow-x-auto">
              {data.episodes.map((e) => (
                <Link key={e.id} to="." search={{ ep: e.id }} replace
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${e.id === episode?.id ? "bg-primary font-bold text-primary-foreground" : "bg-secondary"}`}>
                  T{e.season_number}E{e.episode_number}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid aspect-video w-full place-items-center bg-card px-6 text-center text-sm text-muted-foreground sm:rounded-xl">
      <p>{children}</p>
    </div>
  );
}
