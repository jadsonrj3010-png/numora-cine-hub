import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { tmdbDiscover, tmdbSearch } from "@/lib/tmdb.functions";
import { searchLocal } from "@/lib/local-catalog";
import { STREAMING_FILTERS } from "@/lib/categories";
import { InfiniteGrid } from "@/components/media/InfiniteGrid";
import { MediaCard, MediaCardSkeleton } from "@/components/media/MediaCard";
import { cn } from "@/lib/utils";

const GENRE_CHIPS = [
  { id: "28", label: "Ação" }, { id: "35", label: "Comédia" }, { id: "18", label: "Drama" }, { id: "27", label: "Terror" },
  { id: "10749", label: "Romance" }, { id: "878", label: "Ficção científica" }, { id: "16", label: "Animação" },
  { id: "53", label: "Suspense" }, { id: "80", label: "Crime" }, { id: "99", label: "Documentário" }, { id: "10751", label: "Família" },
];

const searchSchema = z.object({
  q: z.string().optional(),
  genre: z.string().optional(),
  provider: z.string().optional(),
  type: z.enum(["movie", "tv"]).optional(),
});

export const Route = createFileRoute("/explorar")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Explorar — NUMORA CINE" },
      { name: "description", content: "Pesquise por título, gênero, ano, atores ou diretor no NUMORA CINE." },
      { property: "og:title", content: "Explorar — NUMORA CINE" },
      { property: "og:description", content: "Pesquise por título, gênero, ano, atores ou diretor no NUMORA CINE." },
    ],
  }),
  component: Explore,
});

function Explore() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/explorar" });
  const [text, setText] = useState(search.q ?? "");
  const [debounced, setDebounced] = useState(search.q ?? "");
  const searchFn = useServerFn(tmdbSearch);
  const discover = useServerFn(tmdbDiscover);
  const type = search.type ?? "movie";

  useEffect(() => setText(search.q ?? ""), [search.q]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => {
    if ((search.q ?? "") !== debounced) navigate({ search: (p) => ({ ...p, q: debounced || undefined }), replace: true });
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useQuery({
    queryKey: ["search", debounced],
    enabled: debounced.length > 0,
    queryFn: async () => {
      const [local, remote] = await Promise.all([searchLocal(debounced), searchFn({ data: { q: debounced, page: 1 } }).catch(() => null)]);
      return [...local, ...(remote?.items ?? [])];
    },
    staleTime: 5 * 60_000,
  });

  const chip = (active: boolean) => cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition", active ? "border-primary bg-primary text-primary-foreground font-semibold" : "border-border bg-secondary");

  return (
    <div className="pt-5">
      <div className="px-4 lg:px-8">
        <h1 className="mb-3 text-2xl font-extrabold sm:text-3xl">Explorar filmes e séries</h1>
        <div className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Título, gênero, ano, ator ou diretor"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" aria-label="Pesquisar" />
          {text && <button onClick={() => setText("")} aria-label="Limpar"><X className="h-5 w-5 text-muted-foreground" /></button>}
        </div>
      </div>

      {debounced ? (
        <div className="mt-6 px-4 lg:px-8">
          <h2 className="mb-4 text-sm text-muted-foreground">Resultados para “{debounced}”</h2>
          <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {results.isLoading
              ? Array.from({ length: 12 }).map((_, i) => <MediaCardSkeleton key={i} className="w-full sm:w-full lg:w-full" />)
              : results.data?.map((it) => <MediaCard key={it.source + it.mediaType + it.id} item={it} className="w-full sm:w-full lg:w-full" />)}
          </div>
          {!results.isLoading && results.data?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nada encontrado.</p>}
        </div>
      ) : (
        <>
          <div className="scrollbar-none mt-5 flex gap-2 overflow-x-auto px-4 lg:px-8">
            <button className={chip(type === "movie")} onClick={() => navigate({ search: (p) => ({ ...p, type: "movie" }) })}>Filmes</button>
            <button className={chip(type === "tv")} onClick={() => navigate({ search: (p) => ({ ...p, type: "tv" }) })}>Séries</button>
            <span className="mx-1 w-px shrink-0 bg-border" />
            {GENRE_CHIPS.map((g) => (
              <button key={g.id} className={chip(search.genre === g.id)} onClick={() => navigate({ search: (p) => ({ ...p, genre: p.genre === g.id ? undefined : g.id }) })}>{g.label}</button>
            ))}
          </div>
          <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto px-4 lg:px-8">
            <span className="shrink-0 self-center text-xs text-muted-foreground">Disponível em:</span>
            {STREAMING_FILTERS.map((s) => (
              <button key={s.id} className={`${chip(search.provider === s.id)} inline-flex items-center gap-1.5`} onClick={() => navigate({ search: (p) => ({ ...p, provider: p.provider === s.id ? undefined : s.id }) })}><img src={s.logo} alt="" className="h-5 w-5 rounded" />{s.name}</button>
            ))}
          </div>
          <div className="mt-6">
            <InfiniteGrid
              queryKey={["explore", type, search.genre, search.provider]}
              fetchPage={(page) => discover({ data: { mediaType: type, genres: search.genre, provider: search.provider, page } })}
            />
          </div>
        </>
      )}
    </div>
  );
}
