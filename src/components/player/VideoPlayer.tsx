import { Captions, Maximize, Minimize, Pause, Play, Settings, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shouldPlayMidRoll } from "@/components/ads/VideoAds";
import { cn } from "@/lib/utils";

const fmt = (s: number) => {
  if (!isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return (h ? `${h}:${String(m).padStart(2, "0")}` : `${m}`) + `:${String(sec).padStart(2, "0")}`;
};

async function toVttBlobUrl(url: string) {
  const res = await fetch(url);
  let text = await res.text();
  if (!text.trimStart().startsWith("WEBVTT")) {
    text = "WEBVTT\n\n" + text.replace(/\r/g, "").replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  }
  return URL.createObjectURL(new Blob([text], { type: "text/vtt" }));
}

export interface VideoSource { label: string; url: string }

export function VideoPlayer({
  sources, subtitleUrl, startAt = 0, onProgress, poster,
}: {
  sources: VideoSource[];
  subtitleUrl?: string | null;
  startAt?: number;
  poster?: string | null;
  onProgress?: (pos: number, dur: number) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [full, setFull] = useState(false);
  const [subsOn, setSubsOn] = useState(true);
  const [subsBlob, setSubsBlob] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [quality, setQuality] = useState(0);
  const [showUi, setShowUi] = useState(true);
  const [error, setError] = useState(false);
  const lastBreak = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSaved = useRef(0);

  useEffect(() => {
    if (!subtitleUrl) return;
    let url: string | null = null;
    toVttBlobUrl(subtitleUrl).then((u) => { url = u; setSubsBlob(u); }).catch(() => setSubsBlob(null));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [subtitleUrl]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const tracks = v.textTracks;
    for (let i = 0; i < tracks.length; i++) tracks[i]!.mode = subsOn ? "showing" : "hidden";
  }, [subsOn, subsBlob]);

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Save progress on unmount
  useEffect(() => () => {
    const v = video.current;
    if (v && onProgress && v.currentTime > 0) onProgress(v.currentTime, v.duration || 0);
  }, [onProgress]);

  const toggle = () => {
    const v = video.current!;
    if (v.paused) v.play().catch(() => setError(true)); else v.pause();
  };
  const poke = () => {
    setShowUi(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => video.current && !video.current.paused && setShowUi(false), 3000);
  };
  const changeQuality = (i: number) => {
    const v = video.current!;
    const t = v.currentTime, wasPlaying = !v.paused;
    setQuality(i);
    requestAnimationFrame(() => {
      v.currentTime = t;
      if (wasPlaying) v.play().catch(() => {});
    });
  };

  if (error) {
    return <div className="grid aspect-video w-full place-items-center rounded-xl bg-card text-sm text-muted-foreground">Não foi possível reproduzir este vídeo.</div>;
  }

  return (
    <div ref={wrap} onMouseMove={poke} onTouchStart={poke} className={cn("group relative aspect-video w-full overflow-hidden bg-overlay", full ? "" : "rounded-xl")}>
      <video
        ref={video}
        key={sources[quality]?.url}
        src={sources[quality]?.url}
        poster={poster ?? undefined}
        playsInline
        preload="metadata"
        className="h-full w-full"
        onClick={toggle}
        onLoadedMetadata={(e) => {
          setDur(e.currentTarget.duration);
          if (startAt > 0 && startAt < e.currentTarget.duration - 5 && e.currentTarget.currentTime < 1) e.currentTarget.currentTime = startAt;
          e.currentTarget.playbackRate = speed;
          e.currentTarget.volume = volume;
        }}
        onPlay={() => { setPlaying(true); poke(); }}
        onPause={(e) => { setPlaying(false); setShowUi(true); onProgress?.(e.currentTarget.currentTime, e.currentTarget.duration); }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setTime(t);
          if (Math.abs(t - lastSaved.current) >= 10) { lastSaved.current = t; onProgress?.(t, e.currentTarget.duration); }
          if (shouldPlayMidRoll(t, lastBreak.current)) { lastBreak.current = t; /* trigger mid-roll ad break here */ }
        }}
        onError={() => setError(true)}
      >
        {subsBlob && <track kind="subtitles" src={subsBlob} srcLang="pt" label="Português" default />}
      </video>

      {!playing && (
        <button onClick={toggle} aria-label="Reproduzir" className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-2xl">
          <Play className="h-7 w-7 translate-x-0.5 fill-current" />
        </button>
      )}

      <div className={cn("absolute inset-x-0 bottom-0 bg-gradient-to-t from-overlay/95 to-transparent px-3 pb-2 pt-10 transition-opacity", showUi ? "opacity-100" : "pointer-events-none opacity-0")}>
        <input
          type="range" min={0} max={dur || 0} step={0.1} value={time} aria-label="Progresso"
          onChange={(e) => { video.current!.currentTime = Number(e.target.value); setTime(Number(e.target.value)); }}
          className="h-1 w-full cursor-pointer accent-primary"
        />
        <div className="mt-1 flex items-center gap-2 text-foreground">
          <button onClick={toggle} aria-label={playing ? "Pausar" : "Reproduzir"} className="p-1.5">{playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}</button>
          <button onClick={() => { const v = video.current!; v.muted = !muted; setMuted(!muted); }} aria-label="Mudo" className="p-1.5">
            {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} aria-label="Volume"
            onChange={(e) => { const v = video.current!; v.volume = Number(e.target.value); v.muted = false; setMuted(false); setVolume(Number(e.target.value)); }}
            className="hidden w-20 accent-primary sm:block" />
          <span className="ml-1 text-xs tabular-nums text-foreground/80">{fmt(time)} / {fmt(dur)}</span>
          <div className="ml-auto flex items-center gap-1">
            {subsBlob && (
              <button onClick={() => setSubsOn(!subsOn)} aria-label="Legendas" className={cn("p-1.5", subsOn && "text-primary")}><Captions className="h-5 w-5" /></button>
            )}
            <div className="relative">
              <button onClick={() => setMenu(!menu)} aria-label="Configurações" className="p-1.5"><Settings className="h-5 w-5" /></button>
              {menu && (
                <div className="absolute bottom-10 right-0 w-48 rounded-lg border border-border bg-popover p-2 text-sm shadow-xl">
                  <p className="px-2 pb-1 text-xs text-muted-foreground">Qualidade</p>
                  {sources.map((s, i) => (
                    <button key={s.url} onClick={() => { changeQuality(i); setMenu(false); }} className={cn("block w-full rounded px-2 py-1 text-left hover:bg-accent", i === quality && "text-primary")}>{s.label}</button>
                  ))}
                  <p className="mt-2 px-2 pb-1 text-xs text-muted-foreground">Velocidade</p>
                  <div className="grid grid-cols-3 gap-1 px-1">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                      <button key={r} onClick={() => { video.current!.playbackRate = r; setSpeed(r); }} className={cn("rounded px-1 py-1 hover:bg-accent", r === speed && "bg-primary text-primary-foreground")}>{r}x</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => (document.fullscreenElement ? document.exitFullscreen() : wrap.current?.requestFullscreen?.())}
              aria-label="Tela cheia" className="p-1.5"
            >
              {full ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
