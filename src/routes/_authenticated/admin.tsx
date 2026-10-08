import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Star, Trash2, Users, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { tmdbAutoRow } from "@/lib/tmdb.functions";
import { listSiteUsers } from "@/lib/admin-users.functions";
import { youtubeKey } from "@/lib/local-catalog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CATEGORIES } from "@/lib/categories";
import { uploadWithProgress, type Bucket } from "@/lib/upload";
import { QuickUpload } from "@/components/admin/QuickUpload";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("is_admin", { _user_id: context.user.id });
    if (!data) throw redirect({ to: "/meu" });
  },
  head: () => ({
    meta: [
      { title: "Painel administrativo — NUMORA CINE" },
      { name: "description", content: "Gerencie o catálogo do NUMORA CINE." },
      { property: "og:title", content: "Painel administrativo — NUMORA CINE" },
      { property: "og:description", content: "Gerencie o catálogo do NUMORA CINE." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

type Kind = "movies" | "series";
type Form = any;

const EMPTY: Form = { title: "", description: "", category: "filmes", year: "", rating: "", age_rating: "", director: "", cast_list: "", genres: "", duration_min: "", poster_url: "", backdrop_url: "", video_url: "", subtitle_url: "", trailer_url: "", tmdb_id: "", published: false, featured: false, downloadable: false };

function Upload({ label, bucket, accept, onDone }: { label: string; bucket: Bucket; accept: string; onDone: (v: string) => void }) {
  const [pct, setPct] = useState<number | null>(null);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="file" accept={accept} onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        try { setPct(0); onDone(await uploadWithProgress(bucket, f, setPct)); toast.success("Arquivo enviado"); }
        catch (err) { toast.error((err as Error).message); }
        finally { setTimeout(() => setPct(null), 800); }
      }} />
      {pct !== null && <Progress value={pct} />}
    </div>
  );
}

function Admin() {
  const [kind, setKind] = useState<Kind>("movies");
  const [form, setForm] = useState<Form | null>(null);
  const [epFor, setEpFor] = useState<any>(null);
  const [quick, setQuick] = useState(false);
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin", kind],
    queryFn: async () => (await supabase.from(kind).select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f!, [k]: v }));

  const save = async (): Promise<void> => {
    if (!form?.title?.trim()) { toast.error("Informe o título"); return; }
    const num = (v: any) => (v === "" || v == null ? null : Number(v));
    const arr = (v: any) => (Array.isArray(v) ? v : String(v || "").split(",").map((s) => s.trim()).filter(Boolean));
    const row: Form = {
      title: form.title.trim(), description: form.description || null, category: form.category, year: num(form.year), rating: num(form.rating),
      age_rating: form.age_rating || null, director: form.director || null, cast_list: arr(form.cast_list), genres: arr(form.genres),
      poster_url: form.poster_url || null, backdrop_url: form.backdrop_url || null, trailer_url: form.trailer_url || null, tmdb_id: num(form.tmdb_id),
      published: form.published, featured: form.featured, downloadable: form.downloadable,
    };
    if (kind === "movies") Object.assign(row, { duration_min: num(form.duration_min), video_url: form.video_url || null, subtitle_url: form.subtitle_url || null });
    const q = form.id ? supabase.from(kind).update(row as never).eq("id", form.id) : supabase.from(kind).insert(row as never);
    const { error } = await q;
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
    setForm(null);
    qc.invalidateQueries();
  };

  const patch = async (id: string, v: Form) => { await supabase.from(kind).update(v as never).eq("id", id); qc.invalidateQueries({ queryKey: ["admin", kind] }); };
  const remove = async (id: string) => { if (!confirm("Excluir este conteúdo?")) return; await supabase.from(kind).delete().eq("id", id); qc.invalidateQueries(); };

  const [tab, setTab] = useState<"catalogo" | "usuarios">("catalogo");
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-extrabold">Painel administrativo</h1>
        <Button asChild><Link to="/gerenciar">Gerenciar Conteúdo</Link></Button>
        <Button variant={tab === "catalogo" ? "default" : "secondary"} onClick={() => setTab("catalogo")}>Catálogo</Button>
        <Button variant={tab === "usuarios" ? "default" : "secondary"} onClick={() => setTab("usuarios")}><Users /> Usuários</Button>
      </div>
      {tab === "usuarios" ? <UsersPanel /> : (
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
            <div className="mr-auto"><h2 className="font-bold">Filmes, séries e animes</h2><p className="text-xs text-muted-foreground">Alterações aparecem automaticamente no app.</p></div>
            <Button size="sm" variant={kind === "movies" ? "default" : "secondary"} onClick={() => setKind("movies")}>Filmes</Button>
            <Button size="sm" variant={kind === "series" ? "default" : "secondary"} onClick={() => setKind("series")}>Séries</Button>
            <Button size="sm" variant="secondary" onClick={() => setQuick(true)}><Wand2 /> Enviar vídeo</Button>
            <Button size="sm" variant="secondary" onClick={() => setForm({ ...EMPTY, category: kind === "movies" ? "filmes" : "series" })}><Plus /> Manual</Button>
          </div>
          <div className="hidden grid-cols-[1fr_90px_60px_110px_120px] gap-2 px-4 py-2 text-[11px] uppercase text-muted-foreground sm:grid"><span>Título</span><span>Categoria</span><span>Ano</span><span>Status</span><span className="text-right">Ações</span></div>
          {list.data?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhum conteúdo cadastrado.</p>}
          {list.data?.map((r: any) => (
            <div key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-border px-4 py-2.5 sm:grid-cols-[1fr_90px_60px_110px_120px]">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-16 shrink-0 overflow-hidden rounded bg-secondary">{(r.backdrop_url || r.poster_url) && <img src={r.backdrop_url || r.poster_url} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{r.title}</p><p className="truncate text-xs text-muted-foreground">{r.video_url ? "com vídeo" : "sem vídeo"} · {r.views} views</p></div>
              </div>
              <span className="hidden text-xs sm:block"><span className="rounded bg-secondary px-2 py-0.5">{r.category}</span></span>
              <span className="hidden text-sm sm:block">{r.year ?? "—"}</span>
              <span className="hidden sm:block">
                <button onClick={() => patch(r.id, { published: !r.published })} className={`rounded px-2 py-0.5 text-xs font-semibold ${r.featured ? "bg-primary text-primary-foreground" : r.published ? "border border-border" : "bg-secondary text-muted-foreground"}`}>
                  {r.featured ? "Destaque" : r.published ? "Publicado" : "Rascunho"}
                </button>
              </span>
              <div className="flex justify-end">
                {kind === "series" && <Button size="sm" variant="ghost" onClick={() => setEpFor(r)}>Eps</Button>}
                <Button size="icon" variant="ghost" aria-label="Destaque" onClick={() => patch(r.id, { featured: !r.featured })}><Star className={r.featured ? "fill-primary text-primary" : ""} /></Button>
                <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setForm({ ...EMPTY, ...r, cast_list: r.cast_list.join(", "), genres: r.genres.join(", "), year: r.year ?? "", rating: r.rating ?? "", tmdb_id: r.tmdb_id ?? "", duration_min: r.duration_min ?? "" })}><Pencil /></Button>
                <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => remove(r.id)}><Trash2 className="text-destructive" /></Button>
              </div>
            </div>
          ))}
        </section>
        <AddPanel />
      </div>
      )}


      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{form?.id ? "Editar" : "Adicionar"} {kind === "movies" ? "filme" : "série"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Título</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} /></div>
              <div className="sm:col-span-2"><Label>Descrição</Label><Textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} maxLength={3000} /></div>
              <div><Label>Categoria</Label>
                <select value={form.category} onChange={(e) => set("category", e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
                  {CATEGORIES.map((c) => <option key={c.slug} value={c.slug} className="bg-popover">{c.label}</option>)}
                </select>
              </div>
              <div><Label>Gêneros (separados por vírgula)</Label><Input value={form.genres} onChange={(e) => set("genres", e.target.value)} /></div>
              <div><Label>Ano</Label><Input type="number" value={form.year} onChange={(e) => set("year", e.target.value)} /></div>
              <div><Label>Nota (0–10)</Label><Input type="number" step="0.1" min={0} max={10} value={form.rating} onChange={(e) => set("rating", e.target.value)} /></div>
              <div><Label>Classificação</Label><Input value={form.age_rating ?? ""} onChange={(e) => set("age_rating", e.target.value)} placeholder="L, 10, 12, 14, 16, 18" /></div>
              {kind === "movies" && <div><Label>Duração (min)</Label><Input type="number" value={form.duration_min} onChange={(e) => set("duration_min", e.target.value)} /></div>}
              <div><Label>Diretor</Label><Input value={form.director ?? ""} onChange={(e) => set("director", e.target.value)} /></div>
              <div><Label>Elenco (vírgula)</Label><Input value={form.cast_list} onChange={(e) => set("cast_list", e.target.value)} /></div>
              <div><Label>ID TMDB (opcional)</Label><Input type="number" value={form.tmdb_id} onChange={(e) => set("tmdb_id", e.target.value)} /></div>
              <div><Label>URL do trailer (YouTube)</Label><Input value={form.trailer_url ?? ""} onChange={(e) => set("trailer_url", e.target.value)} /></div>
              <div><Label>URL da capa</Label><Input value={form.poster_url ?? ""} onChange={(e) => set("poster_url", e.target.value)} /></div>
              <Upload label="…ou enviar capa" bucket="artwork" accept="image/*" onDone={(v) => set("poster_url", v)} />
              <div><Label>URL do banner</Label><Input value={form.backdrop_url ?? ""} onChange={(e) => set("backdrop_url", e.target.value)} /></div>
              <Upload label="…ou enviar banner" bucket="artwork" accept="image/*" onDone={(v) => set("backdrop_url", v)} />
              {kind === "movies" && (
                <>
                  <div><Label>URL de vídeo autorizada</Label><Input value={form.video_url ?? ""} onChange={(e) => set("video_url", e.target.value)} /></div>
                  <Upload label="…ou enviar vídeo" bucket="videos" accept="video/*" onDone={(v) => set("video_url", v)} />
                  <div><Label>URL da legenda (.vtt/.srt)</Label><Input value={form.subtitle_url ?? ""} onChange={(e) => set("subtitle_url", e.target.value)} /></div>
                  <Upload label="…ou enviar legenda" bucket="subtitles" accept=".vtt,.srt" onDone={(v) => set("subtitle_url", v)} />
                </>
              )}
              <div className="flex flex-wrap gap-5 sm:col-span-2">
                {(["published", "featured", "downloadable"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm"><Switch checked={form[k]} onCheckedChange={(v) => set(k, v)} />{{ published: "Publicado", featured: "Destaque", downloadable: "Download autorizado" }[k]}</label>
                ))}
              </div>
              <Button className="sm:col-span-2" onClick={save}>Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <QuickUpload open={quick} onClose={() => setQuick(false)} />
      {epFor && <Episodes series={epFor} onClose={() => setEpFor(null)} />}
    </div>
  );
}

function Episodes({ series, onClose }: { series: any; onClose: () => void }) {
  const qc = useQueryClient();
  const eps = useQuery({
    queryKey: ["admin-eps", series.id],
    queryFn: async () => (await supabase.from("episodes").select("*").eq("series_id", series.id).order("season_number").order("episode_number")).data ?? [],
  });
  const lastSeason = Math.max(1, ...(eps.data ?? []).map((e) => e.season_number));
  const [f, setF] = useState<Form>({ season_number: 1, episode_number: 1, title: "", video_url: "", subtitle_url: "", duration_min: "" });
  const add = async (): Promise<void> => {
    if (!f.title.trim()) { toast.error("Informe o título do episódio"); return; }
    const { error } = await supabase.from("episodes").insert({
      series_id: series.id, season_number: Number(f.season_number), episode_number: Number(f.episode_number), title: f.title.trim(),
      video_url: f.video_url || null, subtitle_url: f.subtitle_url || null, duration_min: f.duration_min ? Number(f.duration_min) : null,
    });
    if (error) { toast.error(error.message); return; }
    setF({ ...f, episode_number: Number(f.episode_number) + 1, title: "", video_url: "", subtitle_url: "" });
    qc.invalidateQueries({ queryKey: ["admin-eps", series.id] });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Episódios — {series.title}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {eps.data?.map((e) => (
            <div key={e.id} className="flex items-center gap-2 rounded bg-secondary p-2 text-sm">
              <span className="font-bold">T{e.season_number}E{e.episode_number}</span><span className="flex-1 truncate">{e.title}</span>
              <Button size="icon" variant="ghost" onClick={async () => { await supabase.from("episodes").delete().eq("id", e.id); qc.invalidateQueries({ queryKey: ["admin-eps", series.id] }); }}><Trash2 className="text-destructive" /></Button>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Temporada</Label><Input type="number" min={1} value={f.season_number} onChange={(e) => setF({ ...f, season_number: e.target.value })} /></div>
          <div><Label>Episódio</Label><Input type="number" min={1} value={f.episode_number} onChange={(e) => setF({ ...f, episode_number: e.target.value })} /></div>
          <Button variant="secondary" className="sm:col-span-2" onClick={() => setF({ ...f, season_number: lastSeason + 1, episode_number: 1 })}>Nova temporada</Button>
          <div className="sm:col-span-2"><Label>Título</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><Label>URL de vídeo autorizada</Label><Input value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} /></div>
          <Upload label="…ou enviar vídeo" bucket="videos" accept="video/*" onDone={(v) => setF((x: any) => ({ ...x, video_url: v }))} />
          <div><Label>Legenda</Label><Input value={f.subtitle_url} onChange={(e) => setF({ ...f, subtitle_url: e.target.value })} /></div>
          <Upload label="…ou enviar legenda" bucket="subtitles" accept=".vtt,.srt" onDone={(v) => setF((x: any) => ({ ...x, subtitle_url: v }))} />
          <Button className="sm:col-span-2" onClick={add}><Plus /> Adicionar episódio</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const isAllowedVideo = (u: string) => !!youtubeKey(u) || /^https:\/\/\S+\.(mp4|webm|m3u8)(\?\S*)?$/i.test(u);

function AddPanel() {
  const rowFn = useServerFn(tmdbAutoRow);
  const qc = useQueryClient();
  const [type, setType] = useState<"movie" | "tv" | "anime">("movie");
  const [tmdbId, setTmdbId] = useState("");
  const [video, setVideo] = useState("");
  const [cover, setCover] = useState("");
  const [desc, setDesc] = useState("");
  const [featured, setFeatured] = useState(false);
  const [busy, setBusy] = useState(false);
  const v = video.trim();
  const submit = async () => {
    if (!/^\d+$/.test(tmdbId.trim())) { toast.error("Informe o ID TMDB (só números)"); return; }
    if (v && !isAllowedVideo(v)) { toast.error("Use link do YouTube ou link direto .mp4/.webm/.m3u8"); return; }
    setBusy(true);
    try {
      const mediaType = type === "movie" ? "movie" : "tv";
      const meta = await rowFn({ data: { mediaType, id: tmdbId.trim() } });
      const { duration_min, ...common } = meta;
      const extra = { ...(cover.trim() ? { poster_url: cover.trim() } : {}), ...(desc.trim() ? { description: desc.trim() } : {}), ...(type === "anime" ? { category: "animes" } : {}), published: true, featured };
      if (mediaType === "movie") {
        const { error } = await supabase.from("movies").insert({ ...common, ...extra, duration_min, video_url: v || null } as never);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("series").insert({ ...common, ...extra } as never).select("id").single();
        if (error) throw error;
        if (v) await supabase.from("episodes").insert({ series_id: (data as { id: string }).id, season_number: 1, episode_number: 1, title: "Episódio 1", video_url: v });
      }
      toast.success(`"${meta.title}" publicado!`);
      setTmdbId(""); setVideo(""); setCover(""); setDesc(""); setFeatured(false);
      qc.invalidateQueries();
    } catch (e) { toast.error((e as Error).message?.includes("duplicate") ? "Esse título já está cadastrado." : (e as Error).message || "Falha ao publicar"); }
    finally { setBusy(false); }
  };
  return (
    <section className="h-fit space-y-3 rounded-xl border border-border bg-card p-4">
      <div><h2 className="font-bold">Adicionar conteúdo</h2><p className="text-xs text-muted-foreground">Publique um novo item no catálogo.</p></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Tipo de conteúdo</Label>
          <select value={type} onChange={(e) => setType(e.target.value as never)} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
            <option value="movie" className="bg-popover">Filme</option><option value="tv" className="bg-popover">Série</option><option value="anime" className="bg-popover">Anime</option>
          </select>
        </div>
        <div><Label>ID TMDB</Label><Input value={tmdbId} onChange={(e) => setTmdbId(e.target.value)} placeholder="Ex.: 550" inputMode="numeric" maxLength={10} /></div>
      </div>
      <div><Label>Link do vídeo autorizado</Label><Input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="YouTube ou https://…/filme.mp4" maxLength={500} />
        {v && !isAllowedVideo(v) && <p className="mt-1 text-xs text-destructive">Aceita só YouTube ou link direto de vídeo.</p>}</div>
      <div><Label>URL da capa (opcional)</Label><Input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…/capa.jpg" maxLength={500} /></div>
      <div><Label>Descrição (opcional)</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Deixe vazio para usar a sinopse oficial" maxLength={3000} /></div>
      <p className="rounded-md border border-border p-2 text-xs text-muted-foreground">Título, banner, gêneros, ano, nota, elenco, diretor e trailer são preenchidos sozinhos pelo ID TMDB. Sem vídeo, o trailer oficial é exibido.</p>
      <label className="flex items-center gap-2 text-sm"><Switch checked={featured} onCheckedChange={setFeatured} /> Destaque na página inicial</label>
      <Button className="w-full" disabled={busy} onClick={submit}><Plus /> {busy ? "Publicando…" : "Publicar"}</Button>
    </section>
  );
}

function UsersPanel() {
  const fn = useServerFn(listSiteUsers);
  const q = useQuery({ queryKey: ["admin-users"], queryFn: () => fn() });
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
  const week = (q.data ?? []).filter((u) => Date.now() - new Date(u.created_at).getTime() < 7 * 864e5).length;
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Contas criadas</p><p className="text-2xl font-extrabold">{q.data?.length ?? "…"}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Novas nos últimos 7 dias</p><p className="text-2xl font-extrabold">{q.data ? week : "…"}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Assinaturas</p><p className="text-2xl font-extrabold">0</p><p className="text-xs text-muted-foreground">Disponível quando as assinaturas forem ativadas.</p></div>
      </div>
      <section className="overflow-x-auto rounded-xl border border-border bg-card">
        {q.isError && <p className="p-4 text-sm text-destructive">Não foi possível carregar os usuários.</p>}
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase text-muted-foreground"><tr><th className="p-3">Nome / e-mail</th><th className="p-3">Entrou com</th><th className="p-3">Conta criada</th><th className="p-3">Último acesso</th><th className="p-3">E-mail confirmado</th></tr></thead>
          <tbody>
            {q.data?.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3"><p className="font-semibold">{u.name ?? "—"}</p><p className="text-xs text-muted-foreground">{u.email}</p></td>
                <td className="p-3 capitalize">{u.provider}</td><td className="p-3">{fmt(u.created_at)}</td><td className="p-3">{fmt(u.last_sign_in_at)}</td><td className="p-3">{u.confirmed ? "Sim" : "Não"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
