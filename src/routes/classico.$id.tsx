import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { archiveFile } from "@/lib/archive.functions";

export const Route = createFileRoute("/classico/$id")({
  loader: async ({ params }) => {
    try {
      return { seo: await archiveFile({ data: { id: params.id } }) };
    } catch {
      return { seo: null };
    }
  },
  head: ({ params, loaderData }) => {
    const d: any = loaderData?.seo;
    const url = `https://numoracine.com.br/classico/${params.id}`;
    const title = d ? `${d.title}${d.year ? ` (${d.year})` : ""} — Clássico completo grátis | NUMORA CINE` : "Assistir clássico — NUMORA CINE";
    const desc = d
      ? `Assista ${d.title}, filme clássico completo em domínio público. ${d.description ?? ""}`.slice(0, 158)
      : "Filme completo em domínio público no NUMORA CINE.";
    const meta: any[] = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "video.movie" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    const image = d?.thumb ?? d?.poster;
    if (image) meta.push({ property: "og:image", content: image }, { name: "twitter:image", content: image });
    const ld = d && {
      "@context": "https://schema.org",
      "@type": "Movie",
      name: d.title,
      description: d.description || undefined,
      image: image || undefined,
      datePublished: d.year ? String(d.year) : undefined,
      url,
    };
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: ld ? [{ type: "application/ld+json", children: JSON.stringify(ld) }] : [],
    };
  },
  component: Classico,
});

function Classico() {
  const { id } = Route.useParams();
  const router = useRouter();
  const q = useQuery({ queryKey: ["archive-file", id], queryFn: () => archiveFile({ data: { id } }), staleTime: 60 * 60_000 });

  return (
    <div className="mx-auto min-h-screen max-w-6xl pt-4 sm:px-4 lg:px-8">
      <button onClick={() => router.history.back()} className="mb-3 flex items-center gap-2 px-4 text-sm text-muted-foreground hover:text-foreground sm:px-0">
        <ArrowLeft className="h-5 w-5" /> Voltar
      </button>
      {q.isLoading ? (
        <div className="aspect-video w-full animate-pulse bg-card sm:rounded-xl" />
      ) : !q.data ? (
        <div className="grid aspect-video place-items-center bg-card px-6 text-center text-sm text-muted-foreground sm:rounded-xl">
          <p>Este conteúdo ainda não possui vídeo disponível. <Link to="/classicos" className="font-semibold text-primary">Ver outros clássicos</Link></p>
        </div>
      ) : (
        <VideoPlayer sources={[{ label: "Auto", url: q.data.video }]} subtitleUrl={q.data.subs} poster={q.data.thumb} />
      )}
      {q.data && (
        <div className="px-4 py-5 sm:px-0">
          <h1 className="text-xl font-bold sm:text-2xl">{q.data.title}</h1>
          <p className="text-sm text-muted-foreground">{q.data.year ?? ""} · Domínio público · Internet Archive</p>
          <p className="mt-2 text-sm text-foreground/80">{q.data.description}</p>
        </div>
      )}
    </div>
  );
}
