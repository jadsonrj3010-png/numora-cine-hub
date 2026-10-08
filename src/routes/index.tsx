import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HeroBanner } from "@/components/media/HeroBanner";
import { MediaRow, RowShell } from "@/components/media/MediaRow";
import { TmdbNotice } from "@/components/media/TmdbNotice";
import { AdSlot } from "@/components/ads/AdSlot";
import { tmdbList } from "@/lib/tmdb.functions";
import { fetchLocal } from "@/lib/local-catalog";
import { STREAMING_FILTERS } from "@/lib/categories";
import { useContinueWatching } from "@/hooks/use-library";
import { archiveList } from "@/lib/archive.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NUMORA CINE — Filmes, séries e animes" },
      { name: "description", content: "Descubra filmes, séries, animes, novelas e documentários no NUMORA CINE." },
      { property: "og:title", content: "NUMORA CINE — Filmes, séries e animes" },
      { property: "og:description", content: "Descubra filmes, séries, animes, novelas e documentários no NUMORA CINE." },
    ],
  }),
  component: Home,
});

const STALE = 10 * 60_000;

function useList(list: "trending_day" | "trending_week" | "popular_movies" | "popular_tv" | "now_playing" | "top_rated") {
  const fn = useServerFn(tmdbList);
  return useQuery({ queryKey: ["tmdb", list], queryFn: () => fn({ data: { list, page: 1 } }), staleTime: STALE });
}

function Home() {
  const local = useQuery({ queryKey: ["local", "home"], queryFn: () => fetchLocal({ limit: 20 }), staleTime: 60_000 });
  const featured = useQuery({ queryKey: ["local", "featured"], queryFn: () => fetchLocal({ featured: true, limit: 6 }), staleTime: 60_000 });
  const trendDay = useList("trending_day");
  const trendWeek = useList("trending_week");
  const movies = useList("popular_movies");
  const tv = useList("popular_tv");
  const latest = useList("now_playing");
  const top = useList("top_rated");

  const heroItems = [...(featured.data ?? []), ...(trendDay.data?.items ?? []).filter((i) => i.backdrop)].slice(0, 6);
  const recommended = [...(local.data ?? []), ...(trendDay.data?.items ?? [])].slice(0, 20);
  const configured = trendDay.data?.configured ?? true;

  return (
    <div>
      <h1 className="sr-only">NUMORA CINE — Filmes, Séries e Animes</h1>
      <HeroBanner items={heroItems} loading={featured.isLoading || trendDay.isLoading} />
      {!configured && <div className="px-4 pt-6 lg:px-8"><TmdbNotice /></div>}

      <ContinueRow />

      <section className="mt-7">
        <h2 className="mb-1 px-4 text-base font-bold sm:text-lg lg:px-8">Streaming</h2>
        <p className="mb-3 px-4 text-xs text-muted-foreground lg:px-8">Filtre títulos pelo serviço onde estão disponíveis</p>
        <div className="scrollbar-none flex gap-2.5 overflow-x-auto px-4 lg:px-8">
          {STREAMING_FILTERS.map((s) => (
            <Link key={s.id} to="/explorar" search={{ provider: s.id }} aria-label={s.name} title={s.name}
              className="block h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border transition hover:scale-105 hover:border-primary sm:h-20 sm:w-20">
              <img src={s.logo} alt={s.name} loading="lazy" className="h-full w-full object-cover" />
            </Link>
          ))}
        </div>
      </section>

      <AdSlot placement="home-banner" />
      <MediaRow title="Recomendados para você" items={recommended} loading={trendDay.isLoading || local.isLoading} more={{ to: "/indicacoes" }} />
      <MediaRow title="Em alta" items={trendWeek.data?.items} loading={trendWeek.isLoading} more={{ to: "/tendencias" }} ranked />
      <MediaRow title="Filmes populares" items={movies.data?.items} loading={movies.isLoading} more={{ to: "/c/$category", params: { category: "filmes" } }} />
      <AdSlot placement="between-sections" />
      <MediaRow title="Séries populares" items={tv.data?.items} loading={tv.isLoading} more={{ to: "/c/$category", params: { category: "series" } }} />
      <MediaRow title="Lançamentos" items={latest.data?.items} loading={latest.isLoading} />
      <MediaRow title="Melhores avaliados" items={top.data?.items} loading={top.isLoading} />
      <ClassicsRow />
    </div>
  );
}

function ContinueRow() {
  const { data } = useContinueWatching();
  if (!data?.length) return null;
  return (
    <RowShell title="Continuar assistindo" more={{ to: "/meu", search: { tab: "continuar" } }}>
      {data.map((p) => {
        const pct = p.duration_seconds ? Math.min(100, (p.position_seconds / p.duration_seconds) * 100) : 0;
        return (
          <Link key={p.id} to="/watch/$source/$type/$id" params={{ source: p.source as "tmdb", type: p.media_type as "movie", id: p.content_id }}
            className="w-[220px] shrink-0 sm:w-[260px]">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-card ring-1 ring-border">
              {(p.backdrop_url || p.poster_url) && <img src={p.backdrop_url ?? p.poster_url!} alt={p.title} loading="lazy" className="h-full w-full object-cover" />}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-foreground/20"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
            </div>
            <p className="mt-2 line-clamp-1 text-sm font-semibold">{p.title}</p>
          </Link>
        );
      })}
    </RowShell>
  );
}

function ClassicsRow() {
  const { data } = useQuery({ queryKey: ["archive-home"], queryFn: () => archiveList({ data: { page: 1 } }), staleTime: 30 * 60_000 });
  if (!data?.items.length) return null;
  return (
    <RowShell title="Clássicos grátis — filme completo" more={{ to: "/classicos" }}>
      {data.items.slice(0, 18).map((it) => (
        <Link key={it.id} to="/classico/$id" params={{ id: it.id }} className="w-[130px] shrink-0 sm:w-[160px]">
          <div className="aspect-[2/3] overflow-hidden rounded-lg bg-card ring-1 ring-border">
            <img src={it.thumb} alt={it.title} loading="lazy" className="h-full w-full object-cover" />
          </div>
          <p className="mt-2 line-clamp-1 text-sm font-semibold">{it.title}</p>
          <p className="text-xs text-muted-foreground">{it.year ?? "—"}</p>
        </Link>
      ))}
    </RowShell>
  );
}
