import { Link, useNavigate } from "@tanstack/react-router";
import { Download, History, Search, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { tmdbSearch } from "@/lib/tmdb.functions";
import { searchLocal } from "@/lib/local-catalog";
import { CATEGORIES } from "@/lib/categories";
import { useAuth } from "@/hooks/use-auth";
import mark from "@/assets/numora-mark.png";

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-extrabold tracking-tight sm:text-xl">
      <img src={mark} alt="" className="h-8 w-8" />
      NUMORA<span className="text-primary"> CINE</span>
    </Link>
  );
}

export function AppHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [open, setOpen] = useState(false);
  const searchFn = useServerFn(tmdbSearch);
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  const live = useQuery({
    queryKey: ["live-search", dq],
    enabled: dq.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [local, tmdb] = await Promise.all([searchLocal(dq).catch(() => []), searchFn({ data: { q: dq, page: 1 } }).then((r) => r.items).catch(() => [])]);
      return [...local, ...tmdb].slice(0, 8);
    },
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    navigate({ to: "/explorar", search: { q: q.trim() || undefined } });
  };
  const iconBtn = "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary/70 text-foreground transition hover:bg-accent";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 lg:px-8">
        <Logo />
        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          <Link to="/" activeOptions={{ exact: true }} className="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "!text-foreground font-semibold" }}>
            Início
          </Link>
          {CATEGORIES.map((c) => (
            <Link key={c.slug} to="/c/$category" params={{ category: c.slug }} className="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "!text-foreground font-semibold" }}>
              {c.label}
            </Link>
          ))}
          <Link to="/classicos" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "!text-foreground font-semibold" }}>Clássicos</Link>
        </nav>
        <form onSubmit={submit} className="relative ml-auto flex min-w-0 flex-1 items-center gap-2 rounded-full bg-secondary/70 px-3 py-2 lg:max-w-xs">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar filmes, séries, atores…" aria-label="Buscar" onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          {open && dq.length >= 2 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-xl sm:min-w-[320px]">
              {live.isLoading && <p className="p-3 text-xs text-muted-foreground">Buscando…</p>}
              {live.data?.length === 0 && <p className="p-3 text-xs text-muted-foreground">Nada encontrado.</p>}
              {live.data?.map((m) => (
                <Link key={m.source + m.mediaType + m.id} to="/title/$source/$type/$id" params={{ source: m.source, type: m.mediaType, id: m.id }} onClick={() => { setOpen(false); setQ(""); }}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent">
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-secondary">{m.poster && <img src={m.poster} alt="" className="h-full w-full object-cover" loading="lazy" />}</div>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{m.title}</p><p className="text-xs text-muted-foreground">{m.mediaType === "movie" ? "Filme" : "Série"}{m.year ? ` · ${m.year}` : ""}{m.rating ? ` · ★ ${m.rating.toFixed(1)}` : ""}</p></div>
                </Link>
              ))}
            </div>
          )}
        </form>
        <Link to="/meu" search={{ tab: "historico" }} className={iconBtn} aria-label="Histórico"><History className="h-4 w-4" /></Link>
        <Link to="/meu" search={{ tab: "downloads" }} className={`${iconBtn} hidden sm:grid`} aria-label="Downloads"><Download className="h-4 w-4" /></Link>
        {user ? (
          <Link to="/meu" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground" aria-label="Perfil">
            {(user.email ?? "U").charAt(0).toUpperCase()}
          </Link>
        ) : (
          <Link to="/auth" className={iconBtn} aria-label="Entrar"><User className="h-4 w-4" /></Link>
        )}
      </div>
      <nav className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-3 lg:hidden">
        <Link to="/" activeOptions={{ exact: true }} className="shrink-0 rounded-full bg-secondary px-3.5 py-1.5 text-sm" activeProps={{ className: "!bg-primary !text-primary-foreground font-semibold" }}>Início</Link>
        {CATEGORIES.map((c) => (
          <Link key={c.slug} to="/c/$category" params={{ category: c.slug }} className="shrink-0 rounded-full bg-secondary px-3.5 py-1.5 text-sm" activeProps={{ className: "!bg-primary !text-primary-foreground font-semibold" }}>
            {c.label}
          </Link>
        ))}
        <Link to="/classicos" className="shrink-0 rounded-full bg-secondary px-3.5 py-1.5 text-sm" activeProps={{ className: "!bg-primary !text-primary-foreground font-semibold" }}>Clássicos</Link>
      </nav>
    </header>
  );
}
