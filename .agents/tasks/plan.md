# Implementation Plan — NUMORA CINE: Inline Player + Netflix-Style Episode Selector

## Context discovered during exploration

- **Framework**: TanStack Start (React 19 + Vite). Routes live in `src/routes/`. Build: `npm run build`. No test suite configured — verify by running `npm run build` (zero TS/build errors is the acceptance bar).
- **`tmdbSeasonDetails` signature**: `createServerFn` called as `tmdbSeasonDetails({ data: { id: string, season: number } })` → returns `{ episodeCount: number } | null`. It currently returns **only `episodeCount`** — it does NOT return individual episode objects (no `still_path`, no `overview`, no `runtime` per episode). The Netflix-style card requires those fields; we must call the raw TMDB season endpoint through a new server function.
- **`getEmbedServers`** is a plain local function defined inside `watch.$source.$type.$id.tsx` — not exported. It must be moved to `src/lib/embed-servers.ts` and imported in both route files.
- **`useTitle` return shape**: `{ details: MediaDetails, movie: MovieRow|null, series: SeriesRow|null, episodes: EpisodeRow[] }`. `details.id` is the TMDB ID string. `details.seasons` is the number of seasons (used in the watch route).
- **History logging pattern** in `watch.$source.$type.$id.tsx`: uses `useRef<boolean>(false)` (`historyLogged`) + `useEffect` that fires when `embedFallbackSrc` is truthy and inserts into `watch_history`.
- **Server/iframe state pattern**: `serverIdx`, `iframeLoaded`, `slowServer` — reset via `useEffect` when the embed URL changes.
- **AGENTS.md constraint**: do not force-push or rewrite published history; keep main branch working at all times.

---

## Implementation Plan

- [ ] 1. **Extend `tmdbSeasonDetails` in `src/lib/tmdb.functions.ts` to return full episode data.**

  The current function only returns `{ episodeCount }`. The Netflix episode cards need `episode_number`, `name`, `overview`, `runtime`, and `still_path` per episode. Extend the return type to include a typed `episodes` array. Change the handler to map `r.episodes` into objects with those five fields (still keeping `episodeCount` for backward compatibility so the watch route keeps working unchanged).

  **Exact new return shape:**
  ```ts
  type SeasonEpisode = {
    episode_number: number;
    name: string;
    overview: string;
    runtime: number | null;
    still_path: string | null;
  };
  // handler returns:
  { episodeCount: number; episodes: SeasonEpisode[] } | null
  ```

  The handler already has `r.episodes` as an array — map it:
  ```ts
  const episodes: SeasonEpisode[] = Array.isArray(r.episodes)
    ? r.episodes.map((ep: any) => ({
        episode_number: ep.episode_number,
        name: ep.name ?? "",
        overview: ep.overview ?? "",
        runtime: ep.runtime ?? null,
        still_path: ep.still_path ?? null,
      }))
    : [];
  return { episodeCount: episodes.length, episodes };
  ```

  Files: `c:\Users\jadso\Downloads\meu site\numora-cine-hub-main\src\lib\tmdb.functions.ts`

  Verify: `npm run build` — zero TypeScript errors.

---

- [ ] 2. **Create `src/lib/embed-servers.ts` — extracted and exported embed server factory.**

  Move `getEmbedServers` out of the watch route into a shared utility so both route files can import it without duplication.

  **Exact file content:**
  ```ts
  import type { MediaType } from "@/lib/types";

  export type EmbedServer = { label: string; url: string };

  export function getEmbedServers(
    tmdbId: string,
    type: MediaType,
    season?: number,
    episode?: number,
  ): EmbedServer[] {
    if (type === "movie") {
      return [
        { label: "Servidor 1", url: `https://vidsrc.io/embed/movie/${tmdbId}` },
        { label: "Servidor 2", url: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}` },
        { label: "Servidor 3", url: `https://vidsrc.xyz/embed/movie/${tmdbId}` },
        { label: "Servidor 4", url: `https://embed.su/embed/movie/${tmdbId}` },
      ];
    }
    const s = season ?? 1;
    const e = episode ?? 1;
    return [
      { label: "Servidor 1", url: `https://vidsrc.io/embed/tv/${tmdbId}/${s}/${e}` },
      { label: "Servidor 2", url: `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${s}&episode=${e}` },
      { label: "Servidor 3", url: `https://vidsrc.xyz/embed/tv/${tmdbId}/${s}/${e}` },
      { label: "Servidor 4", url: `https://embed.su/embed/tv/${tmdbId}/${s}/${e}` },
    ];
  }
  ```

  Files: `c:\Users\jadso\Downloads\meu site\numora-cine-hub-main\src\lib\embed-servers.ts` *(create new)*

  Verify: `npm run build` — file compiles cleanly, no errors introduced.

---

- [ ] 3. **Update `watch.$source.$type.$id.tsx` to import `getEmbedServers` from the new utility.**

  - Remove the local `getEmbedServers` function definition (lines ~64–79 in the current file).
  - Add import at the top: `import { getEmbedServers } from "@/lib/embed-servers";`
  - All call sites inside the file stay unchanged — the function signature is identical.

  Files: `c:\Users\jadso\Downloads\meu site\numora-cine-hub-main\src\routes\watch.$source.$type.$id.tsx`

  Verify: `npm run build` — watch route still compiles, no regressions. The `/watch/...` URL must continue to work exactly as before.

---

- [ ] 4. **Rewrite `title.$source.$type.$id.tsx` — add inline player state variables and updated imports.**

  This step adds the state + imports that the next steps depend on. Do not change rendering yet.

  **New imports to add** (alongside existing ones):
  ```ts
  import { useState, useEffect, useRef, useCallback } from "react";
  import { getEmbedServers } from "@/lib/embed-servers";
  import { tmdbSeasonDetails } from "@/lib/tmdb.functions";  // already unused in this file — add it
  import { supabase } from "@/integrations/supabase/client";
  import { isEmbedAllowed } from "@/lib/embed";
  import { X } from "lucide-react";  // for the close button icon
  ```

  **New state variables** to declare at the top of `TitlePage()`, after the existing hooks:
  ```ts
  // ── Inline player ──────────────────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [playingSeason, setPlayingSeason] = useState(1);
  const [playingEp, setPlayingEp] = useState(1);
  const [serverIdx, setServerIdx] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [slowServer, setSlowServer] = useState(false);
  const historyLogged = useRef(false);

  // ── Season/episode selector state ──────────────────────────────────
  const [selectedSeason, setSelectedSeason] = useState(1);
  ```

  **Computed values** (derived, not state) — add after state declarations:
  ```ts
  const isTmdbTv = source === "tmdb" && type === "tv";
  const tmdbId = data?.details?.id ?? null;

  const embedServers = (() => {
    if (!tmdbId) return [];
    if (type === "movie") return getEmbedServers(tmdbId, type);
    return getEmbedServers(tmdbId, type, playingSeason, playingEp);
  })();
  const embedSrc = playing ? (embedServers[serverIdx]?.url ?? null) : null;
  ```

  Files: `c:\Users\jadso\Downloads\meu site\numora-cine-hub-main\src\routes\title.$source.$type.$id.tsx`

  Verify: `npm run build` — no TypeScript errors (unused imports will be used in later steps, but TS won't error on them because they appear in expressions already written in this step).

---

- [ ] 5. **Add `useEffect` hooks for server reset, slow-server timer, and history logging.**

  Place these immediately after the computed values from step 4, still inside `TitlePage()`:

  ```ts
  // Reset server state whenever the playing target changes
  useEffect(() => {
    setServerIdx(0);
    setIframeLoaded(false);
    setSlowServer(false);
    historyLogged.current = false;
  }, [playingSeason, playingEp, tmdbId]);

  // Slow-server warning — fires 15 s after embed URL becomes active
  useEffect(() => {
    if (!embedSrc) return;
    setIframeLoaded(false);
    setSlowServer(false);
    const t = setTimeout(() => setSlowServer(true), 15_000);
    return () => clearTimeout(t);
  }, [embedSrc]);

  useEffect(() => {
    if (iframeLoaded) setSlowServer(false);
  }, [iframeLoaded]);

  // Log to watch_history when embed starts
  useEffect(() => {
    if (!user || !data || !embedSrc) return;
    if (historyLogged.current) return;
    historyLogged.current = true;
    const det = data.details;
    supabase.from("watch_history").insert({
      user_id: user.id,
      source,
      media_type: type,
      content_id: det.id,
      title: det.title,
      poster_url: det.poster,
      episode_id: null,
    }).then(() => {});
  }, [embedSrc, user, data]); // eslint-disable-line react-hooks/exhaustive-deps
  ```

  Files: `c:\Users\jadso\Downloads\meu site\numora-cine-hub-main\src\routes\title.$source.$type.$id.tsx`

  Verify: `npm run build` — no errors.

---

- [ ] 6. **Add the season details query for the episode selector.**

  Add this `useQuery` call inside `TitlePage()`, after the effects from step 5 and before the `return`:

  ```ts
  const seasonDetailsQuery = useQuery({
    queryKey: ["tmdb-season-detail", p.id, selectedSeason],
    enabled: isTmdbTv && !!tmdbId,
    queryFn: async () => tmdbSeasonDetails({ data: { id: p.id, season: selectedSeason } }),
    staleTime: 60 * 60_000,
  });
  const seasonEpisodes = seasonDetailsQuery.data?.episodes ?? [];
  ```

  Files: `c:\Users\jadso\Downloads\meu site\numora-cine-hub-main\src\routes\title.$source.$type.$id.tsx`

  Verify: `npm run build` — no errors.

---

- [ ] 7. **Replace the "Assistir" button with an inline `onClick` that sets `playing(true)` instead of navigating.**

  In the existing JSX, the "Assistir" button is currently:
  ```tsx
  <Button asChild size="lg" className="min-h-[44px] min-w-[44px] rounded-full font-bold">
    <Link to="/watch/$source/$type/$id" params={{ source, type, id: d.id }}><Play className="fill-current" /> Assistir</Link>
  </Button>
  ```

  Replace it with:
  ```tsx
  <Button
    size="lg"
    className="min-h-[44px] min-w-[44px] rounded-full font-bold"
    onClick={() => {
      setPlayingSeason(1);
      setPlayingEp(1);
      setPlaying(true);
      // Scroll to top so the player is visible
      window.scrollTo({ top: 0, behavior: "smooth" });
    }}
    disabled={!hasVideo}
  >
    <Play className="fill-current" /> Assistir
  </Button>
  ```

  The `hasVideo` variable is already defined in the file.

  Files: `c:\Users\jadso\Downloads\meu site\numora-cine-hub-main\src\routes\title.$source.$type.$id.tsx`

  Verify: `npm run build` — no errors.

---

- [ ] 8. **Replace the backdrop/hero section with a conditional: show backdrop when `playing === false`, show inline player when `playing === true`.**

  The current hero/backdrop section starts at `<div className="relative isolate">`. Replace the entire `<div className="relative isolate"> ... </div>` block with the following conditional structure:

  **When `playing === false`** — render the existing backdrop + title + buttons unchanged (copy the current block as-is, no visual changes).

  **When `playing === true`** — render:

  ```tsx
  {playing ? (
    <div className="mx-auto max-w-6xl px-0 pt-4 sm:px-4 lg:px-8">
      {/* Close button */}
      <div className="mb-3 flex items-center justify-between px-4 sm:px-0">
        <h2 className="font-semibold text-foreground">{data?.details.title ?? ""}</h2>
        <button
          onClick={() => setPlaying(false)}
          className="flex min-h-[44px] items-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" /> Fechar player
        </button>
      </div>

      {/* Embed iframe */}
      {embedSrc ? (
        <div className="relative">
          <iframe
            key={embedSrc}
            className="aspect-video w-full bg-overlay sm:rounded-xl"
            src={embedSrc}
            title={data?.details.title ?? "Player"}
            frameBorder="0"
            scrolling="no"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setIframeLoaded(true)}
          />
          {slowServer && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 rounded-b-xl bg-black/80 px-4 py-3 text-sm">
              <span className="text-yellow-400">⚠ O servidor está demorando. Tente outro servidor abaixo.</span>
              <button onClick={() => setSlowServer(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid aspect-video w-full place-items-center bg-card px-6 text-center text-sm text-muted-foreground sm:rounded-xl">
          <p>Nenhum servidor disponível para este conteúdo.</p>
        </div>
      )}

      {/* Server-switch buttons */}
      {embedServers.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2 px-4 sm:px-0">
          <span className="self-center text-xs text-muted-foreground">Trocar servidor:</span>
          {embedServers.map((sv, i) => (
            <button
              key={i}
              onClick={() => setServerIdx(i)}
              className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-semibold transition ${
                i === serverIdx
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-primary/20"
              }`}
            >
              {sv.label}
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 px-4 text-xs text-muted-foreground sm:px-0">
        Se o vídeo não carregar, tente outro servidor acima.
      </p>
    </div>
  ) : (
    /* ── existing backdrop / title / button block — copy verbatim ── */
    <div className="relative isolate">
      {/* ... all existing content unchanged ... */}
    </div>
  )}
  ```

  **Important**: the existing episode list section (`data.episodes.length > 0`) inside the two-column grid below the hero is for local-catalog episodes and must remain intact.

  Files: `c:\Users\jadso\Downloads\meu site\numora-cine-hub-main\src\routes\title.$source.$type.$id.tsx`

  Verify: `npm run build` — no errors.

---

- [ ] 9. **Add the Netflix-style episode selector section (season tabs + episode cards).**

  Insert this section **after** the player block (or after the hero block when `playing === false`) and **before** the existing two-column grid (`<div className="mx-auto mt-8 grid max-w-6xl...">`). Only render it when `isTmdbTv` is true.

  ```tsx
  {isTmdbTv && tmdbId && (
    <div className="mx-auto mt-6 max-w-6xl px-4 lg:px-8">
      {/* Season tabs */}
      <div className="mb-4">
        <h2 className="mb-3 text-lg font-bold">Temporadas</h2>
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {Array.from(
            { length: Math.min(Math.max(1, data?.details?.seasons ?? 1), 50) },
            (_, i) => i + 1,
          ).map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSeason(s)}
              className={`min-h-[40px] shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                selectedSeason === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-primary/20"
              }`}
            >
              Temporada {s}
            </button>
          ))}
        </div>
      </div>

      {/* Episode cards */}
      <div className="mb-2">
        <h2 className="mb-3 text-lg font-bold">
          Episódios — Temporada {selectedSeason}
        </h2>
        {seasonDetailsQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 animate-pulse rounded-xl bg-card" />
            ))}
          </div>
        ) : seasonEpisodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum episódio encontrado.</p>
        ) : (
          <div className="space-y-2">
            {seasonEpisodes.map((ep) => {
              const isActive =
                playing &&
                playingSeason === selectedSeason &&
                playingEp === ep.episode_number;
              return (
                <button
                  key={ep.episode_number}
                  onClick={() => {
                    setSelectedSeason(selectedSeason);
                    setPlayingSeason(selectedSeason);
                    setPlayingEp(ep.episode_number);
                    setPlaying(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`flex w-full items-start gap-4 rounded-xl p-3 text-left transition hover:bg-accent ${
                    isActive ? "ring-2 ring-primary bg-accent" : "bg-card"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-secondary sm:h-20 sm:w-36">
                    {ep.still_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                        alt={ep.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center">
                        <Play className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    {isActive && (
                      <div className="absolute inset-0 grid place-items-center bg-black/50">
                        <Play className="h-6 w-6 fill-current text-primary" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {ep.episode_number}. {ep.name}
                    </p>
                    {ep.runtime != null && (
                      <p className="text-xs text-muted-foreground">{ep.runtime} min</p>
                    )}
                    <p className="mt-1 line-clamp-2 text-xs text-foreground/70">
                      {ep.overview || "Descrição não disponível."}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )}
  ```

  Files: `c:\Users\jadso\Downloads\meu site\numora-cine-hub-main\src\routes\title.$source.$type.$id.tsx`

  Verify: `npm run build` — no TypeScript errors. Open a TV series detail page in the dev server (`npm run dev`) and confirm: season tabs appear, clicking a tab loads that season's episodes, each card shows thumbnail + title + runtime + overview, clicking a card scrolls to top and starts the player inline.

---

## Summary of all files touched

| File | Change |
|---|---|
| `src/lib/tmdb.functions.ts` | Extend `tmdbSeasonDetails` return type to include `episodes` array |
| `src/lib/embed-servers.ts` | **New file** — exports `getEmbedServers` and `EmbedServer` type |
| `src/routes/watch.$source.$type.$id.tsx` | Remove local `getEmbedServers`, import from `embed-servers.ts` |
| `src/routes/title.$source.$type.$id.tsx` | Main rewrite: inline player, server buttons, Netflix episode selector |

## Dependency order

Steps 1 and 2 are independent of each other and can be done in either order, but both must complete before step 3 (watch route import swap) and step 4 (title route additions). Steps 4 → 5 → 6 → 7 → 8 → 9 are strictly ordered: each builds on state/queries declared in the previous step.

## Constraints to keep in mind

- `tmdbSeasonDetails` currently returns `{ episodeCount }` — the watch route reads only that field. Adding `episodes` to the return is additive and backward-compatible; do not remove `episodeCount`.
- The `/watch/...` route must keep working exactly as before. Steps 1 and 3 are the only touches to that route; they are purely mechanical (add a field, swap an import).
- Do not force-push or rewrite published git history (AGENTS.md).
- `getEmbedServers` in `embed-servers.ts` must have the same runtime behavior as the original — same four providers, same URL patterns.
