import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, Search, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { tmdbAutoRow, tmdbCandidates } from "@/lib/tmdb.functions";
import { uploadWithProgress } from "@/lib/upload";
import { youtubeKey } from "@/lib/local-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Cand = { mediaType: "movie" | "tv"; id: string; title: string; year: number | null; poster: string | null };

export function QuickUpload({ open, onClose }: { open: boolean; onClose: () => void }) {
  const findFn = useServerFn(tmdbCandidates);
  const rowFn = useServerFn(tmdbAutoRow);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [ytUrl, setYtUrl] = useState("");
  const [cands, setCands] = useState<Cand[] | null>(null);
  const [pick, setPick] = useState<Cand | null>(null);
  const [searching, setSearching] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const [step, setStep] = useState("");

  const reset = () => { setName(""); setFile(null); setYtUrl(""); setCands(null); setPick(null); setPct(null); setStep(""); };
  const same = (c: Cand) => pick?.id === c.id && pick.mediaType === c.mediaType;

  const search = async (n = name) => {
    if (!n.trim()) return;
    setSearching(true);
    try {
      const r = await findFn({ data: { name: n } });
      setCands(r); setPick(r[0] ?? null);
      } catch { /* busca silenciosa durante a digitação */ }
    finally { setSearching(false); }
  };

  // Prévia automática enquanto digita o nome.
  useEffect(() => {
    if (name.trim().length < 2 || step) return;
    const t = setTimeout(() => search(name), 400);
    return () => clearTimeout(t);
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  const ytLink = ytUrl.trim();
  const ytValid = !!youtubeKey(ytLink);

  const publish = async () => {
    if (!pick || (!file && !ytValid)) return;
    try {
      setStep("Preparando…");
      const table = pick.mediaType === "movie" ? "movies" : "series";
      const { data: existing } = await supabase.from(table).select("id").eq("tmdb_id", Number(pick.id)).maybeSingle();
      if (existing && pick.mediaType === "movie") { toast.error("Esse filme já está cadastrado."); setStep(""); return; }
      // Informações e envio do vídeo correm ao mesmo tempo.
      const metaP = rowFn({ data: { mediaType: pick.mediaType, id: pick.id } });
      if (!ytValid) { setStep("Enviando vídeo…"); setPct(0); }
      const [meta, video] = await Promise.all([metaP, ytValid ? Promise.resolve(ytLink) : uploadWithProgress("videos", file!, setPct)]);
      setStep("Publicando…");
      const { duration_min, ...common } = meta;
      if (pick.mediaType === "movie") {
        const { error } = await supabase.from("movies").insert({ ...common, duration_min, video_url: video, published: true } as never);
        if (error) throw error;
      } else {
        let seriesId = existing?.id as string | undefined;
        if (!seriesId) {
          const { data, error } = await supabase.from("series").insert({ ...common, published: true } as never).select("id").single();
          if (error) throw error;
          seriesId = (data as { id: string }).id;
        }
        const { data: eps } = await supabase.from("episodes").select("season_number,episode_number").eq("series_id", seriesId);
        const next = Math.max(0, ...(eps ?? []).filter((e) => e.season_number === 1).map((e) => e.episode_number)) + 1;
        const { error } = await supabase.from("episodes").insert({ series_id: seriesId, season_number: 1, episode_number: next, title: `Episódio ${next}`, video_url: video, duration_min });
        if (error) throw error;
      }
      toast.success(`"${meta.title}" publicado em ${meta.category}!`);
      qc.invalidateQueries();
      reset(); onClose();
    } catch (e) {
      toast.error((e as Error).message || "Falha ao publicar");
      setStep(""); setPct(null);
    }
  };

  const busy = !!step;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) { reset(); onClose(); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" /> Envio automático</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Envie o vídeo e o nome. Capa, banner, sinopse, categoria, gêneros, ano, nota, elenco e diretor são preenchidos sozinhos.</p>
        <div className="space-y-3">
          <div><Label>Vídeo</Label>
            <Input type="file" accept="video/*" disabled={busy} onChange={(e) => {
              const f = e.target.files?.[0] ?? null; setFile(f);
              if (f && !name) setName(f.name.replace(/\.[^.]+$/, "").replace(/[._-]+/g, " "));
            }} />
          </div>
          <div><Label>Ou cole um link do YouTube</Label>
            <Input value={ytUrl} disabled={busy} onChange={(e) => setYtUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" maxLength={300} />
            {ytLink && !ytValid && <p className="mt-1 text-xs text-destructive">Link do YouTube inválido.</p>}
            {ytValid && <p className="mt-1 text-xs text-primary">Link do YouTube válido — o arquivo de vídeo será ignorado.</p>}
          </div>
          <div><Label>Nome do filme ou série</Label>
            <div className="flex gap-2">
              <Input value={name} disabled={busy} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Ex.: Clube da Luta 1999" maxLength={200} />
              <Button variant="secondary" aria-label="Buscar" onClick={() => search()} disabled={searching || busy}>{searching ? <Loader2 className="animate-spin" /> : <Search />}</Button>
            </div>
          </div>
          {cands && cands.length > 0 && (
            <div>
              <Label>Confirme o título certo</Label>
              <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {cands.map((c) => (
                  <button key={c.mediaType + c.id} disabled={busy} onClick={() => setPick(c)}
                    className={`relative overflow-hidden rounded-md border-2 text-left ${same(c) ? "border-primary" : "border-transparent"}`}>
                    <div className="aspect-[2/3] bg-secondary">{c.poster && <img src={c.poster} alt="" className="h-full w-full object-cover" />}</div>
                    <p className="truncate px-1 pt-1 text-[11px] font-semibold">{c.title}</p>
                    <p className="px-1 pb-1 text-[10px] text-muted-foreground">{c.year ?? "—"} · {c.mediaType === "movie" ? "Filme" : "Série"}</p>
                    {same(c) && <Check className="absolute right-1 top-1 h-5 w-5 rounded-full bg-primary p-0.5 text-primary-foreground" />}
                  </button>
                ))}
              </div>
              {pick?.mediaType === "tv" && <p className="mt-2 text-xs text-muted-foreground">Série: o vídeo entra como o próximo episódio da 1ª temporada.</p>}
            </div>
          )}
          {step && <div className="space-y-1"><p className="text-sm">{step}</p>{pct !== null && <Progress value={pct} />}</div>}
          <Button className="w-full" disabled={(!file && !ytValid) || !pick || busy} onClick={publish}>
            {busy ? <Loader2 className="animate-spin" /> : <Wand2 />} Enviar e publicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
