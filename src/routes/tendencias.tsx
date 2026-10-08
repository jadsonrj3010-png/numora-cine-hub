import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { tmdbList } from "@/lib/tmdb.functions";
import { fetchLocal } from "@/lib/local-catalog";
import { InfiniteGrid } from "@/components/media/InfiniteGrid";
import { MediaRow } from "@/components/media/MediaRow";

export const Route = createFileRoute("/tendencias")({
  head: () => ({
    meta: [
      { title: "Tendências — NUMORA CINE" },
      { name: "description", content: "Os filmes e séries mais vistos e comentados da semana." },
      { property: "og:title", content: "Tendências — NUMORA CINE" },
      { property: "og:description", content: "Os filmes e séries mais vistos e comentados da semana." },
    ],
  }),
  component: Trending,
});

function Trending() {
  const list = useServerFn(tmdbList);
  const mostViewed = useQuery({ queryKey: ["local", "views"], queryFn: () => fetchLocal({ orderBy: "views", limit: 20 }) });
  return (
    <div className="pt-6">
      <h1 className="px-4 text-2xl font-extrabold lg:px-8">Tendências</h1>
      <MediaRow title="Mais assistidos no NUMORA" items={mostViewed.data} ranked />
      <h2 className="mb-3 mt-7 px-4 text-base font-bold sm:text-lg lg:px-8">Em alta nesta semana</h2>
      <InfiniteGrid ranked queryKey={["trending-week"]} fetchPage={(page) => list({ data: { list: "trending_week", page } })} />
    </div>
  );
}
