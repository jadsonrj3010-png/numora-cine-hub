import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Code2, Copy, Eye, ListVideo, Pencil, Play, Plus, Search, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { tmdbAutoRow, tmdbSearch } from "@/lib/tmdb.functions";
import { checkEmbeddable } from "@/lib/embed.functions";
import { embedUrlProblem, iframeCode } from "@/lib/embed";
import { CATEGORIES } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/gerenciar")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("is_admin", { _user_id: context.user.id });
    if (!data) throw redirect({ to: "/meu" });
  },
  head: () => ({
    meta: [
      { title: "Gerenciar Conteúdo — NUMORA CINE" },
      { name: "description", content: "Cadastre e gerencie filmes, séries e animes do NUMORA CINE." },
      { property: "og:title", content: "Gerenciar Conteúdo — NUMORA CINE" },
      { property: "og:description", content: "Ferramenta administrativa do NUMORA CINE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Manage,
});

type Tab = "filmes" | "series" | "animes" | "outros";
type Kind = "movie" | "series";
type Form = any;
const TABS: { id: Tab; label: string; add: string }[] = [
  { id: "filmes", label: "Filmes", add: "Adicionar Filme" },
  { id: "series", label: "Séries", add: "Adicionar Série" },
  { id: "animes", label: "Animes", add: "Adicionar Anime" },
  { id: "outros", label: "Outros", add: "Adicionar Outro" },
];
const EMPTY: Form = { title: "", original_title: "", description: "", year: "", release_date: "", duration_min: "", genres: "", age_rating: "", director: "", cast_list: "", poster_url: "", backdrop_url: "", iframe_url: "", trailer_url: "", tmdb_id: "", rating: "", published: true, featured: false };
const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR");

function Manage() {
  const [tab, setTab] = useState<Tab>("filmes");
  const [form, setForm] = useState<{ kind: Kind; data: Form } | null>(null);
  const [epsFor, setEpsFor] = useState<any>(null);
  const [gen, setGen] = useState<string | null>(null);
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["manage", tab],
    queryFn: async () => {
      if (tab === "filmes" || tab === "outros") {
        let q = supabase.from("movies").select("*").order("created_at", { ascending: false });
        q = tab === "filmes" ? q.eq("category", "filmes") : q.neq("category", "filmes");
        const m = (await q).data ?? [];
        if (tab === "filmes") return m.map((r) => ({ ...r, kind: "movie" as Kind }));
        const s = (await supabase.from("series").select("*").not("category", "in", "(series,animes)").order("created_at", { ascending: false })).data ?? [];
        return [...m.map((r) => ({ ...r, kind: "movie" as Kind })), ...s.map((r) => ({ ...r, kind: "series" as Kind }))];
      }
      let q = supabase.from("series").select("*").order("created_at", { ascending: false });
      q = tab === "animes" ? q.eq("category", "animes") : q.eq("category", "series");
      return ((await q).data ?? []).map((r) => ({ ...r, kind: "series" as Kind }));
    },
  });

  const table = (k: Kind) => (k === "movie" ? "movies" : "series");
  const toggle = async (r: any) => {
    await supabase.from(table(r.kind)).update({ published: !r.published } as never).eq("id", r.id);
    qc.invalidateQueries();
  };
  const remove = async (r: any) => {
    if (!confirm(`Excluir "${r.title}"?`)) return;
    if (r.kind === "series") await supabase.from("episodes").delete().eq("series_id", r.id);
    const { error } = await supabase.from(table(r.kind)).delete().eq("id", r.id);
    if (error) toast.error(error.message); else toast.success("Excluído");
    qc.invalidateQueries();
  };
  const openNew = () => {
    const kind: Kind = tab === "series" || tab === "animes" ? "series" : "movie";
    const category = tab === "animes" ? "animes" : tab === "series" ? "series" : tab === "filmes" ? "filmes" : "documentarios";
    setForm({ kind, data: { ...EMPTY, category } });
  };
  const openEdit = (r: any) => setForm({
    kind: r.kind,
    data: { ...EMPTY, ...r, genres: r.genres.join(", "), cast_list: r.cast_list.join(", "), year: r.year ?? "", rating: r.rating ?? "", tmdb_id: r.tmdb_id ?? "", duration_min: r.duration_min ?? "", release_date: r.release_date ?? "", iframe_url: r.iframe_url ?? "", original_title: r.original_title ?? "" },
  });
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 lg:px-8">
      <Link to="/admin" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Painel</Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-extrabold">Gerenciar Conteúdo</h1>
        <Button onClick={openNew}><Plus /> {current.add}</Button>
      </div>
      <div className="scrollbar-none mt-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => <Button key={t.id} size="sm" variant={tab === t.id ? "default" : "secondary"} onClick={() => setTab(t.id)}>{t.label}</Button>)}
      </div>

      <section className="mt-4 rounded-xl border border-border bg-card">
        <div className="hidden grid-cols-[1fr_80px_60px_100px_100px_220px] gap-2 px-4 py-2 text-[11px] uppercase text-muted-foreground md:grid">
          <span>Título</span><span>Tipo</span><span>Ano</span><span>Status</span><span>Cadastro</span><span className="text-right">Ações</span>
        </div>
        {list.isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>}
        {list.data?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nada cadastrado aqui ainda.</p>}
        {list.data?.map((r: any) => (
          <div key={r.id} className="grid grid-cols-1 items-center gap-2 border-t border-border px-4 py-3 md:grid-cols-[1fr_80px_60px_100px_100px_220px]">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-secondary">{r.poster_url && <img src={r.poster_url} alt="" className="h-full w-full object-cover" loading="lazy" />}</div>
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{r.title}</p><p className="truncate text-xs text-muted-foreground">{r.kind === "movie" ? (r.iframe_url || r.video_url ? "com player" : "sem player") : r.category}</p></div>
            </div>
            <span className="text-xs">{r.kind === "movie" ? "Filme" : r.category === "animes" ? "Anime" : "Série"}</span>
            <span className="text-sm">{r.year ?? "—"}</span>
            <button onClick={() => toggle(r)} className={`w-fit rounded px-2 py-0.5 text-xs font-semibold ${r.published ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{r.published ? "Publicado" : "Rascunho"}</button>
            <span className="text-xs text-muted-foreground">{fmt(r.created_at)}</span>
            <div className="flex flex-wrap justify-start gap-0.5 md:justify-end">
              <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => openEdit(r)}><Pencil /></Button>
              <Button size="icon" variant="ghost" aria-label="Visualizar" asChild>
                <Link to="/title/$source/$type/$id" params={{ source: "local", type: r.kind === "movie" ? "movie" : "tv", id: r.id }} target="_blank"><Eye /></Link>
              </Button>
              {r.kind === "series" && <Button size="icon" variant="ghost" aria-label="Gerenciar episódios" onClick={() => setEpsFor(r)}><ListVideo /></Button>}
              {r.kind === "movie" && <Button size="icon" variant="ghost" aria-label="Gerar iframe" onClick={() => setGen(r.iframe_url ?? "")}><Code2 /></Button>}
              <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => remove(r)}><Trash2 className="text-destructive" /></Button>
            </div>
          </div>
        ))}
      </section>

      {form && <ContentForm kind={form.kind} initial={form.data} onClose={() => setForm(null)} onSaved={(row) => { setForm(null); qc.invalidateQueries(); if (row && form.kind === "series" && !form.data.id) setEpsFor(row); }} />}
      {epsFor && <SeasonsDialog series={epsFor} onClose={() => setEpsFor(null)} />}
      <Dialog open={gen !== null} onOpenChange={(o) => !o && setGen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Gerador de iframe</DialogTitle></DialogHeader>
          {gen !== null && <IframeTool value={gen} onChange={setGen} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IframeTool({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const check = useServerFn(checkEmbeddable);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const url = value.trim();
  const problem = url ? embedUrlProblem(url) : null;
  const test = async () => {
    const p = embedUrlProblem(url);
    if (p) { setStatus({ ok: false, msg: p }); setPreview(null); return; }
    setBusy(true);
    try {
      const r = await check({ data: { url } });
      setStatus({ ok: r.ok, msg: r.reason });
      setPreview(r.ok ? url : null);
    } catch (e) { setStatus({ ok: false, msg: (e as Error).message }); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div><Label>URL do iframe</Label>
        <div className="flex gap-2">
          <Input value={value} onChange={(e) => { onChange(e.target.value); setStatus(null); setPreview(null); }} placeholder="https://exemplo.com/player/filme" maxLength={1000} />
          <Button type="button" variant="secondary" disabled={!url || busy} onClick={test}><Play /> {busy ? "Testando…" : "Testar player"}</Button>
        </div>
        {problem && <p className="mt-1 text-xs text-destructive">{problem}</p>}
        {status && <p className={`mt-1 text-xs ${status.ok ? "text-muted-foreground" : "text-destructive"}`}>{status.ok ? status.msg ?? "Fonte permite incorporação." : status.msg}</p>}
      </div>
      {preview && <iframe src={preview} title="Prévia" className="aspect-video w-full rounded-md bg-overlay" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen loading="lazy" />}
      {url && !problem && (
        <div>
          <Label className="text-xs text-muted-foreground">Código gerado</Label>
          <pre className="mt-1 overflow-x-auto rounded-md bg-secondary p-2 text-xs">{iframeCode(url)}</pre>
          <Button type="button" size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(iframeCode(url)); toast.success("Iframe copiado"); }}><Copy /> Copiar iframe</Button>
          <p className="text-[11px] text-muted-foreground">Não precisa colar esse código: ao salvar, o player do NUMORA usa a URL automaticamente.</p>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Use apenas fontes que permitem incorporação legalmente (conteúdo seu, canais oficiais ou licenciados).</p>
    </div>
  );
}

function ContentForm({ kind, initial, onClose, onSaved }: { kind: Kind; initial: Form; onClose: () => void; onSaved: (row: any) => void }) {
  const [f, setF] = useState<Form>(initial);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const searchFn = useServerFn(tmdbSearch);
  const rowFn = useServerFn(tmdbAutoRow);
  const mediaType = kind === "movie" ? "movie" : "tv";
  const results = useQuery({
    queryKey: ["manage-search", mediaType, q],
    enabled: q.trim().length >= 2,
    queryFn: async () => (await searchFn({ data: { q: q.trim(), page: 1 } })).items.filter((i) => i.mediaType === mediaType).slice(0, 6),
  });
  const set = (k: string, v: any) => setF((x: Form) => ({ ...x, [k]: v }));
  const fill = async (id: string) => {
    try {
      const m = await rowFn({ data: { mediaType, id } });
      setF((x: Form) => ({
        ...x, title: m.title, description: m.description ?? "", year: m.year ?? "", rating: m.rating ?? "", age_rating: m.age_rating ?? "",
        director: m.director ?? "", cast_list: m.cast_list.join(", "), genres: m.genres.join(", "), duration_min: m.duration_min ?? "",
        poster_url: m.poster_url ?? "", backdrop_url: m.backdrop_url ?? "", trailer_url: m.trailer_url ?? "", tmdb_id: m.tmdb_id,
        category: x.category === "animes" ? "animes" : m.category,
      }));
      setQ("");
      toast.success("Informações preenchidas");
    } catch (e) { toast.error((e as Error).message); }
  };
  const save = async () => {
    if (!String(f.title).trim()) { toast.error("Informe o título"); return; }
    const iframe = String(f.iframe_url ?? "").trim();
    if (kind === "movie" && iframe && embedUrlProblem(iframe)) { toast.error(embedUrlProblem(iframe)!); return; }
    const num = (v: any) => (v === "" || v == null ? null : Number(v));
    const arr = (v: any) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);
    const row: Form = {
      title: String(f.title).trim(), original_title: f.original_title || null, description: f.description || null, category: f.category,
      year: num(f.year), rating: num(f.rating), age_rating: f.age_rating || null, director: f.director || null,
      cast_list: arr(f.cast_list), genres: arr(f.genres), poster_url: f.poster_url || null, backdrop_url: f.backdrop_url || null,
      trailer_url: f.trailer_url || null, tmdb_id: num(f.tmdb_id), published: !!f.published, featured: !!f.featured,
    };
    if (kind === "movie") Object.assign(row, { duration_min: num(f.duration_min), release_date: f.release_date || null, iframe_url: iframe || null });
    setBusy(true);
    const t = kind === "movie" ? "movies" : "series";
    const { data, error } = f.id
      ? await supabase.from(t).update(row as never).eq("id", f.id).select("*").single()
      : await supabase.from(t).insert(row as never).select("*").single();
    setBusy(false);
    if (error) { toast.error(error.message.includes("duplicate") ? "Esse título já está cadastrado." : error.message); return; }
    toast.success(kind === "movie" ? "Filme salvo" : "Salvo");
    onSaved(data ? { ...(data as object), kind } : null);
  };
  const label = kind === "movie" ? "filme" : f.category === "animes" ? "anime" : "série";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{f.id ? "Editar" : "Adicionar"} {label}</DialogTitle></DialogHeader>
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Label>Buscar informações</Label>
          <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: Homem-Aranha" maxLength={100} />
          </div>
          {results.data && results.data.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {results.data.map((r) => (
                <button key={r.id} type="button" onClick={() => fill(r.id)} className="text-left">
                  <div className="aspect-[2/3] overflow-hidden rounded bg-secondary">{r.poster && <img src={r.poster} alt="" className="h-full w-full object-cover" />}</div>
                  <p className="mt-1 line-clamp-2 text-[11px]">{r.title} {r.year ? `(${r.year})` : ""}</p>
                </button>
              ))}
            </div>
          )}
          {results.data?.length === 0 && <p className="text-xs text-muted-foreground">Nada encontrado.</p>}
        </div>

        <h3 className="text-sm font-bold">Informações</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Título</Label><Input value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={200} /></div>
          <div className="sm:col-span-2"><Label>Título original</Label><Input value={f.original_title ?? ""} onChange={(e) => set("original_title", e.target.value)} maxLength={200} /></div>
          <div className="sm:col-span-2"><Label>Sinopse</Label><Textarea value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} maxLength={3000} /></div>
          <div><Label>Ano</Label><Input type="number" value={f.year} onChange={(e) => set("year", e.target.value)} /></div>
          {kind === "movie" && <div><Label>Data de lançamento</Label><Input type="date" value={f.release_date} onChange={(e) => set("release_date", e.target.value)} /></div>}
          {kind === "movie" && <div><Label>Duração (min)</Label><Input type="number" value={f.duration_min} onChange={(e) => set("duration_min", e.target.value)} /></div>}
          <div><Label>Gêneros (vírgula)</Label><Input value={f.genres} onChange={(e) => set("genres", e.target.value)} /></div>
          <div><Label>Classificação</Label><Input value={f.age_rating ?? ""} onChange={(e) => set("age_rating", e.target.value)} placeholder="L, 10, 12, 14, 16, 18" /></div>
          <div><Label>Diretor</Label><Input value={f.director ?? ""} onChange={(e) => set("director", e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Elenco (vírgula)</Label><Input value={f.cast_list} onChange={(e) => set("cast_list", e.target.value)} /></div>
          <div><Label>URL do poster</Label><Input value={f.poster_url ?? ""} onChange={(e) => set("poster_url", e.target.value)} /></div>
          <div><Label>URL do backdrop</Label><Input value={f.backdrop_url ?? ""} onChange={(e) => set("backdrop_url", e.target.value)} /></div>
        </div>

        {kind === "movie" && (<><h3 className="text-sm font-bold">Fonte do vídeo</h3><IframeTool value={f.iframe_url ?? ""} onChange={(v) => set("iframe_url", v)} /></>)}

        <h3 className="text-sm font-bold">Configurações</h3>
        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!f.published} onCheckedChange={(v) => set("published", v)} /> Publicado</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!f.featured} onCheckedChange={(v) => set("featured", v)} /> Destaque</label>
          <select value={f.category} onChange={(e) => set("category", e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm">
            {CATEGORIES.map((c) => <option key={c.slug} value={c.slug} className="bg-popover">{c.label}</option>)}
          </select>
        </div>
        <Button disabled={busy} onClick={save}>{busy ? "Salvando…" : `Salvar ${label}`}</Button>
      </DialogContent>
    </Dialog>
  );
}

const EP_EMPTY: Form = { episode_number: 1, title: "", description: "", duration_min: "", still_url: "", iframe_url: "", published: true };

function SeasonsDialog({ series, onClose }: { series: any; onClose: () => void }) {
  const qc = useQueryClient();
  const key = ["manage-eps", series.id];
  const data = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [s, e] = await Promise.all([
        supabase.from("seasons").select("*").eq("series_id", series.id).order("season_number"),
        supabase.from("episodes").select("*").eq("series_id", series.id).order("season_number").order("episode_number"),
      ]);
      const eps = e.data ?? [];
      const nums = new Set<number>([...(s.data ?? []).map((x) => x.season_number), ...eps.map((x) => x.season_number)]);
      return { seasons: [...nums].sort((a, b) => a - b), eps };
    },
  });
  const [edit, setEdit] = useState<{ season: number; data: Form } | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["title"] }); };

  const addSeason = async () => {
    const n = Math.max(0, ...(data.data?.seasons ?? [])) + 1;
    const { error } = await supabase.from("seasons").insert({ series_id: series.id, season_number: n });
    if (error) toast.error(error.message); else refresh();
  };
  const saveEp = async () => {
    if (!edit) return;
    const e = edit.data;
    if (!String(e.title).trim()) { toast.error("Informe o título do episódio"); return; }
    const iframe = String(e.iframe_url ?? "").trim();
    if (iframe && embedUrlProblem(iframe)) { toast.error(embedUrlProblem(iframe)!); return; }
    const row = {
      series_id: series.id, season_number: edit.season, episode_number: Number(e.episode_number), title: String(e.title).trim(),
      description: e.description || null, duration_min: e.duration_min ? Number(e.duration_min) : null, still_url: e.still_url || null,
      iframe_url: iframe || null, published: !!e.published,
    };
    const { error } = e.id ? await supabase.from("episodes").update(row).eq("id", e.id) : await supabase.from("episodes").insert(row);
    if (error) { toast.error(error.message.includes("duplicate") ? "Já existe um episódio com esse número." : error.message); return; }
    toast.success("Episódio salvo");
    setEdit(null);
    refresh();
  };
  const delEp = async (id: string) => { if (!confirm("Excluir episódio?")) return; await supabase.from("episodes").delete().eq("id", id); refresh(); };
  const delSeason = async (n: number) => {
    if (!confirm(`Excluir a temporada ${n} e seus episódios?`)) return;
    await supabase.from("episodes").delete().eq("series_id", series.id).eq("season_number", n);
    await supabase.from("seasons").delete().eq("series_id", series.id).eq("season_number", n);
    refresh();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Temporadas — {series.title}</DialogTitle></DialogHeader>
        {data.data?.seasons.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma temporada ainda.</p>}
        {data.data?.seasons.map((n) => {
          const eps = data.data!.eps.filter((e) => e.season_number === n);
          return (
            <div key={n} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="mr-auto font-bold">Temporada {n}</h3>
                <Button size="sm" variant="secondary" onClick={() => setEdit({ season: n, data: { ...EP_EMPTY, episode_number: Math.max(0, ...eps.map((e) => e.episode_number)) + 1 } })}><Plus /> Adicionar episódio</Button>
                <Button size="icon" variant="ghost" aria-label="Excluir temporada" onClick={() => delSeason(n)}><Trash2 className="text-destructive" /></Button>
              </div>
              {eps.map((e) => (
                <div key={e.id} className="flex items-center gap-2 border-t border-border py-1.5 text-sm">
                  <span className="flex-1 truncate">Episódio {e.episode_number} — {e.title}{!e.published && <span className="ml-2 text-xs text-muted-foreground">(rascunho)</span>}</span>
                  <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEdit({ season: n, data: { ...EP_EMPTY, ...e, description: e.description ?? "", duration_min: e.duration_min ?? "", still_url: e.still_url ?? "", iframe_url: e.iframe_url ?? "" } })}><Pencil /></Button>
                  <Button size="icon" variant="ghost" aria-label="Visualizar" asChild>
                    <Link to="/watch/$source/$type/$id" params={{ source: "local", type: "tv", id: series.id }} search={{ ep: e.id }} target="_blank"><Eye /></Link>
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => delEp(e.id)}><Trash2 className="text-destructive" /></Button>
                </div>
              ))}
            </div>
          );
        })}
        <Button variant="secondary" onClick={addSeason}><Plus /> Adicionar temporada</Button>

        {edit && (
          <div className="space-y-3 rounded-lg border border-primary/40 p-3">
            <h3 className="font-bold">{edit.data.id ? "Editar" : "Novo"} episódio · Temporada {edit.season}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Número do episódio</Label><Input type="number" min={1} value={edit.data.episode_number} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, episode_number: e.target.value } })} /></div>
              <div><Label>Duração (min)</Label><Input type="number" value={edit.data.duration_min} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, duration_min: e.target.value } })} /></div>
              <div className="sm:col-span-2"><Label>Título</Label><Input value={edit.data.title} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, title: e.target.value } })} maxLength={200} /></div>
              <div className="sm:col-span-2"><Label>Sinopse</Label><Textarea value={edit.data.description} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, description: e.target.value } })} maxLength={2000} /></div>
              <div className="sm:col-span-2"><Label>Thumbnail (URL)</Label><Input value={edit.data.still_url} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, still_url: e.target.value } })} /></div>
            </div>
            <IframeTool value={edit.data.iframe_url} onChange={(v) => setEdit((x) => x && { ...x, data: { ...x.data, iframe_url: v } })} />
            <label className="flex items-center gap-2 text-sm"><Switch checked={!!edit.data.published} onCheckedChange={(v) => setEdit({ ...edit, data: { ...edit.data, published: v } })} /> Publicado</label>
            <div className="flex gap-2"><Button onClick={saveEp}>Salvar episódio</Button><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
