import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { tmdbList, tmdbRecommendFor } from "@/lib/tmdb.functions";
import { InfiniteGrid } from "@/components/media/InfiniteGrid";
import { MediaCard, MediaCardSkeleton } from "@/components/media/MediaCard";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites, useHistory } from "@/hooks/use-library";

export const Route = createFileRoute("/indicacoes")({
  head: () => ({
    meta: [
      { title: "Indicações — NUMORA CINE" },
      { name: "description", content: "Recomendações personalizadas com base no que você assiste e salva." },
      { property: "og:title", content: "Indicações — NUMORA CINE" },
      { property: "og:description", content: "Recomendações personalizadas com base no que você assiste e salva." },
    ],
  }),
  component: Picks,
});

function Picks() {
  const { user } = useAuth();
  const favs = useFavorites();
  const hist = useHistory();
  const rec = useServerFn(tmdbRecommendFor);
  const list = useServerFn(tmdbList);

  const seeds = [...(hist.data ?? []), ...(favs.data ?? [])]
    .filter((x) => x.source === "tmdb")
    .map((x) => ({ mediaType: x.media_type as "movie" | "tv", id: x.content_id }))
    .filter((x, i, a) => a.findIndex((y) => y.id === x.id && y.mediaType === x.mediaType) === i)
    .slice(0, 5);

  const personal = useQuery({
    queryKey: ["recs", seeds],
    enabled: seeds.length > 0,
    queryFn: () => rec({ data: { items: seeds } }),
    staleTime: 10 * 60_000,
  });

  return (
    <div className="pt-6">
      <h1 className="px-4 text-2xl font-extrabold lg:px-8">Indicações</h1>
      {!user ? (
        <p className="mt-2 px-4 text-sm text-muted-foreground lg:px-8">
          <Link to="/auth" className="font-semibold text-primary">Entre na sua conta</Link> para receber indicações baseadas no seu histórico e na Minha Lista.
        </p>
      ) : seeds.length === 0 ? (
        <p className="mt-2 px-4 text-sm text-muted-foreground lg:px-8">Assista ou adicione títulos à Minha Lista para personalizar suas indicações.</p>
      ) : (
        <div className="mt-5 px-4 lg:px-8">
          <h2 className="mb-3 text-base font-bold">Porque você assistiu e salvou</h2>
          <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {personal.isLoading
              ? Array.from({ length: 12 }).map((_, i) => <MediaCardSkeleton key={i} className="w-full sm:w-full lg:w-full" />)
              : personal.data?.items.map((it) => <MediaCard key={it.mediaType + it.id} item={it} className="w-full sm:w-full lg:w-full" />)}
          </div>
        </div>
      )}
      <h2 className="mb-3 mt-8 px-4 text-base font-bold lg:px-8">Aclamados pela crítica</h2>
      <InfiniteGrid queryKey={["top-rated-all"]} fetchPage={(page) => list({ data: { list: "top_rated", page } })} />
    </div>
  );
}
