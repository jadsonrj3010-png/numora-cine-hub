import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites, useDownloads, useHistory } from "@/hooks/use-library";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "lista", label: "Minha Lista" },
  { id: "historico", label: "Histórico" },
  { id: "downloads", label: "Downloads" },
] as const;

export const Route = createFileRoute("/_authenticated/meu")({
  validateSearch: z.object({ tab: z.enum(["lista", "historico", "downloads"]).optional() }),
  head: () => ({
    meta: [
      { title: "Meu perfil — NUMORA CINE" },
      { name: "description", content: "Sua lista, histórico e downloads no NUMORA CINE." },
      { property: "og:title", content: "Meu perfil — NUMORA CINE" },
      { property: "og:description", content: "Sua lista, histórico e downloads no NUMORA CINE." },
    ],
  }),
  component: Me,
});

type Row = { id: string; source: string; media_type: string; content_id: string; title: string; poster_url: string | null };

function Grid({ rows, empty }: { rows?: Row[] | undefined; empty: string }) {
  if (!rows?.length) return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {rows.map((r) => (
        <Link key={r.id} to="/title/$source/$type/$id" params={{ source: r.source, type: r.media_type, id: r.content_id }}>
          <div className="aspect-[2/3] overflow-hidden rounded-lg bg-card">
            {r.poster_url && <img src={r.poster_url} alt={r.title} loading="lazy" className="h-full w-full object-cover" />}
          </div>
          <p className="mt-1.5 line-clamp-1 text-xs font-semibold">{r.title}</p>
        </Link>
      ))}
    </div>
  );
}

function Me() {
  const { tab = "lista" } = Route.useSearch();
  const { user, isAdmin, signOut } = useAuth();
  const favs = useFavorites(), hist = useHistory(), dls = useDownloads();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 lg:px-8">
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary font-display text-xl font-bold text-primary-foreground">
          {(user?.email ?? "U").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{user?.user_metadata?.["display_name"] ?? user?.email}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
        {isAdmin && <Button asChild variant="secondary" size="sm"><Link to="/admin"><Shield /> Admin</Link></Button>}
        <Button variant="ghost" size="sm" onClick={signOut}><LogOut /> Sair</Button>
      </div>
      <div className="scrollbar-none mt-6 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <Link key={t.id} to="/meu" search={{ tab: t.id }} className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm", tab === t.id ? "bg-primary font-bold text-primary-foreground" : "bg-secondary")}>{t.label}</Link>
        ))}
      </div>
      <div className="mt-6">
        {tab === "lista" && <Grid rows={favs.data} empty="Sua lista está vazia." />}
        {tab === "historico" && <Grid rows={hist.data} empty="Você ainda não assistiu nada." />}
      {tab === "downloads" && (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">Filmes e séries que você salvou para assistir depois.</p>
          <Grid rows={dls.data} empty="Nada salvo ainda. Na página de um filme, clique no ícone de download para salvar." />
        </div>
      )}
      </div>
    </div>
  );
}
