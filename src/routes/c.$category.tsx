import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { findCategory } from "@/lib/categories";
import { tmdbDiscover } from "@/lib/tmdb.functions";
import { fetchLocal } from "@/lib/local-catalog";
import { InfiniteGrid } from "@/components/media/InfiniteGrid";
import { AdSlot } from "@/components/ads/AdSlot";

export const Route = createFileRoute("/c/$category")({
  loader: ({ params }) => {
    const cat = findCategory(params.category);
    if (!cat) throw notFound();
    return { label: cat.label };
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.label} — NUMORA CINE` : "Categoria — NUMORA CINE";
    const d = loaderData ? `Assista e descubra ${loaderData.label.toLowerCase()} no NUMORA CINE.` : "Categoria do NUMORA CINE.";
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }] };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useParams();
  const cat = findCategory(category)!;
  const discover = useServerFn(tmdbDiscover);
  const local = useQuery({ queryKey: ["local", "cat", category], queryFn: () => fetchLocal({ category, limit: 50 }) });

  return (
    <div className="pt-6">
      <h1 className="mb-4 px-4 text-2xl font-extrabold lg:px-8">{cat.label}</h1>
      <InfiniteGrid
        key={category}
        queryKey={["discover", category]}
        prepend={local.data ?? []}
        fetchPage={(page) => discover({ data: { ...cat.discover!, page } })}
      />
      <AdSlot placement="between-sections" />
    </div>
  );
}
