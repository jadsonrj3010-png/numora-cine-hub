import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { archiveList } from "@/lib/archive.functions";

export const Route = createFileRoute("/classicos")({
  head: () => ({
    meta: [
      { title: "Clássicos grátis — NUMORA CINE" },
      { name: "description", content: "Filmes completos em domínio público para assistir grátis e legalmente no NUMORA CINE." },
      { property: "og:title", content: "Clássicos grátis — NUMORA CINE" },
      { property: "og:description", content: "Filmes completos em domínio público para assistir grátis e legalmente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Classicos,
});

function Classicos() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => { const t = setTimeout(() => setTerm(q), 400); return () => clearTimeout(t); }, [q]);
  const list = useInfiniteQuery({
    queryKey: ["archive", term],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => archiveList({ data: { q: term || undefined, page: pageParam } }),
    getNextPageParam: (l) => (l.page < l.totalPages ? l.page + 1 : undefined),
    staleTime: 30 * 60_000,
  });
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting && list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage(); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [list]);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Clássicos grátis</h1>
      <p className="mt-1 text-sm text-muted-foreground">Filmes completos em domínio público, do acervo do Internet Archive. Assista inteiro, grátis e legalmente.</p>
      <label className="mt-4 flex max-w-md items-center gap-2 rounded-full bg-secondary/70 px-4 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar clássicos (em inglês)…" className="flex-1 bg-transparent text-sm outline-none" />
      </label>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((it) => (
          <Link key={it.id} to="/classico/$id" params={{ id: it.id }} className="group">
            <div className="aspect-[2/3] overflow-hidden rounded-lg bg-card ring-1 ring-border">
              <img src={it.thumb} alt={it.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-semibold">{it.title}</p>
            <p className="text-xs text-muted-foreground">{it.year ?? "—"} · Filme completo</p>
          </Link>
        ))}
        {(list.isLoading || list.isFetchingNextPage) && Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-card" />)}
      </div>
      {list.isError && <p className="mt-6 text-sm text-muted-foreground">O acervo está indisponível agora. Tente novamente em instantes.</p>}
      {!list.isLoading && items.length === 0 && !list.isError && <p className="mt-6 text-sm text-muted-foreground">Nenhum clássico encontrado.</p>}
      <div ref={sentinel} className="h-10" />
    </div>
  );
}
