import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { MediaItem, Paged } from "@/lib/types";
import { MediaCard, MediaCardSkeleton } from "./MediaCard";
import { TmdbNotice } from "./TmdbNotice";

const gridCls = "grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8";

export function InfiniteGrid({ queryKey, fetchPage, prepend = [], ranked }: {
  queryKey: unknown[];
  fetchPage: (page: number) => Promise<Paged<MediaItem>>;
  prepend?: MediaItem[];
  ranked?: boolean;
}) {
  const q = useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (last) => (last.configured && last.page < last.totalPages ? last.page + 1 : undefined),
    staleTime: 5 * 60_000,
  });
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e[0]?.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q]);

  const seen = new Set<string>();
  const items = [...prepend, ...(q.data?.pages.flatMap((p) => p.items) ?? [])].filter((i) => {
    const k = i.source + i.mediaType + i.id;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const configured = q.data?.pages[0]?.configured ?? true;

  if (q.isError) return <p className="px-4 py-10 text-center text-sm text-muted-foreground">Não foi possível carregar o catálogo. Tente novamente.</p>;

  return (
    <div className="px-4 lg:px-8">
      {!configured && <TmdbNotice />}
      <div className={gridCls}>
        {items.map((it, i) => <MediaCard key={it.source + it.mediaType + it.id} item={it} className="w-full sm:w-full lg:w-full" rank={ranked ? i + 1 : undefined} />)}
        {(q.isLoading || q.isFetchingNextPage) && Array.from({ length: 12 }).map((_, i) => <MediaCardSkeleton key={`s${i}`} className="w-full sm:w-full lg:w-full" />)}
      </div>
      {!q.isLoading && items.length === 0 && configured && <p className="py-10 text-center text-sm text-muted-foreground">Nenhum conteúdo encontrado.</p>}
      <div ref={sentinel} className="h-10" />
    </div>
  );
}
