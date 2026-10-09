# Inline player, Netflix-style episode selector, and multi-server embed extraction

The change replaces the navigation-based `/watch/...` flow with an inline player on the title detail page, adds a Netflix-style season tab + episode card selector for TMDB TV content, and extracts the multi-server embed URL list into a shared `embed-servers.ts` module. The `/watch/...` route is kept intact and updated to import from the new shared module. Four embed servers (vidsrc.io, vidsrc.me, vidsrc.xyz, embed.su) are now available in both routes.

**Watch for:** `embedSrc` is derived in `TitlePage` using the state at render time, but `TitlePageInner` receives it as a prop — state updates and prop re-derivation are async across a render boundary, so there is a window where `serverIdx` has already been reset to `0` but `embedSrc` still carries the old URL. Also, `historyLogged.current` reset is coupled to `playingSeason`/`playingEp`/`tmdbId` changing but the `playing` flag itself does not reset the ref, so toggling the player closed and re-opening it on the same episode silently skips history logging.

**Verdict**: NEEDS_CHANGES

---

## High-level view

`TitlePage` computes `embedServers` and `embedSrc` as derived values from `playingSeason`, `playingEp`, and `serverIdx`, then passes them into `TitlePageInner` as props. The split introduces a one-render lag: when `TitlePageInner`'s `useEffect` resets `serverIdx` to `0`, `TitlePage` has not re-derived `embedSrc` yet, so the iframe briefly receives a stale URL and mounts twice in quick succession via its `key={embedSrc}` prop.

The episode selector renders season tabs by counting `data.details.seasons` and episode cards by fetching `tmdbSeasonDetails` per selected season. The selected-season query (`selectedSeason`) is independent from the playing-season state (`playingSeason`), which is the right Netflix-style split: browsing seasons doesn't interrupt playback. Clicking an episode sets all three of `setPlayingSeason`, `setPlayingEp`, and `setPlaying` in one handler — that's correct.

History logging in `TitlePageInner` guards against double-writes with `historyLogged.current`, which is reset inside a `useEffect` keyed on `[playingSeason, playingEp, tmdbId]`. The reset fires correctly when a new episode is selected. However, the ref is **not** reset when `playing` goes from `true` to `false` and back to `true` on the same episode — the second "Assistir" click on the same episode will not log a history entry.

`serverIdx` reset on episode change is handled inside the same `useEffect` in `TitlePageInner`. The one-render lag between the effect firing and `TitlePage` re-deriving `embedSrc` means the iframe briefly sees a stale URL — two sequential mounts in quick succession because `key={embedSrc}` unmounts and remounts on each URL change.

---

<details>
<summary>Issues (4)</summary>

1. **Stale `embedSrc` on episode switch** — `embedSrc` is derived in `TitlePage` from `serverIdx`, but `serverIdx` is reset to `0` inside a `useEffect` in `TitlePageInner`. For one render after an episode change, `embedSrc` carries the old server URL while `serverIdx` shows `0`. Fix by moving `embedSrc` derivation into `TitlePageInner` (after the effect runs), or by also resetting `serverIdx` inside the episode-click handlers before calling `setPlaying`. Confidence: **confirmed** (lines `embedSrc = playing ? (embedServers[serverIdx]?.url ?? null) : null` in `TitlePage` vs. `useEffect([playingSeason, playingEp, tmdbId])` in `TitlePageInner`).

2. **`historyLogged.current` not reset on player close/reopen** — The ref resets on `[playingSeason, playingEp, tmdbId]` change, but if the user closes the player (`setPlaying(false)`) and re-opens it on the same episode, `playing` changes but none of those three values do, so the ref stays `true` and history is never logged for the second session. Fix: include `playing` in the reset effect's dependency array, or reset `historyLogged.current` in the close-player click handler. Confidence: **confirmed**.

3. **Season tab count uses `data.details.seasons` which may be 0 or undefined for in-progress shows** — The expression `Math.min(Math.max(1, data?.details?.seasons ?? 1), 50)` floors at 1, so a show with `seasons: 0` from TMDB (common for shows mid-first-season) will always show exactly one season tab, which may be wrong. The same pattern exists in `/watch/...` so this is a pre-existing issue, but it's now surfaced in both places. Confidence: **confirmed** (code is identical in both files).

4. **`embedSrc` can be `null` while `playing === true`** — If `source !== "tmdb"` or `tmdbId` is null and there's no local video, `embedServers` is `[]`, so `embedSrc` is `null`. The render correctly shows the "Nenhum servidor disponível" fallback message in that case, so this is not a crash — but the player area is shown without actually playing anything when the user clicks "Assistir" on a local-source title with no `video_url`. The "Assistir" button is disabled via `!hasVideo` for local titles with no video, but for `source === "local"` with a video URL that resolves to `null` at runtime, the disable check on `hasVideo` passes (it checks the URL string, not the resolved value). Confidence: **likely** (depends on what `resolveMediaUrl` returns for broken storage paths, which is not in scope of this diff).

</details>

---

<details>
<summary>Details</summary>

## State split across the TitlePage/TitlePageInner boundary

`TitlePage` holds all state (`playing`, `playingSeason`, `playingEp`, `serverIdx`) and derives `embedServers` and `embedSrc` inline before passing everything down to `TitlePageInner` as props. The derivation is:

```ts
const embedServers = (() => {
  if (!tmdbId || source !== "tmdb") return [];
  if (type === "movie") return getEmbedServers(tmdbId, type);
  return getEmbedServers(tmdbId, type, playingSeason, playingEp);
})();
const embedSrc = playing ? (embedServers[serverIdx]?.url ?? null) : null;
```

`TitlePageInner` then resets `serverIdx` in a `useEffect`:

```ts
useEffect(() => {
  setServerIdx(0);
  setIframeLoaded(false);
  setSlowServer(false);
  historyLogged.current = false;
}, [playingSeason, playingEp, tmdbId]);
```

When an episode changes, React schedules the effect after the paint. `TitlePage` re-renders with the new `playingSeason`/`playingEp` but with the old `serverIdx` (still not `0` if the user had switched servers), computes the wrong `embedSrc`, passes it down, and the iframe renders with the stale URL. On the following render, after the effect fires and `setServerIdx(0)` propagates, `TitlePage` recomputes `embedSrc` correctly. The `key={embedSrc}` on the iframe means the element is destroyed and recreated on both renders, so the user sees two iframe mounts in quick succession. Moving `serverIdx` state and `embedSrc` derivation into `TitlePageInner` would eliminate the lag.

## historyLogged.current reset gap

The reset effect keys on `[playingSeason, playingEp, tmdbId]`. The logging effect keys on `[embedSrc, user, data]`. When the user:

1. Clicks "Assistir" → `playing = true`, `embedSrc` becomes non-null → history logged, `historyLogged.current = true`
2. Clicks "Fechar player" → `playing = false`, `embedSrc = null` → ref stays `true`
3. Clicks "Assistir" again on the same episode → `playing = true`, `embedSrc` is non-null again, `historyLogged.current` is `true` → **no log**

The logging effect's guard `if (historyLogged.current) return` short-circuits before writing. This means repeat-watch sessions on the same episode within the same page load are silently dropped from history.

## Episode click handler

All three setters (`setPlayingSeason`, `setPlayingEp`, `setPlaying`) are called in one handler before `setPlaying(true)`, so on the next render both season and episode are current when `embedSrc` is derived. The `isActive` highlight uses `playing && playingSeason === selectedSeason && playingEp === ep.episode_number`, which is correct.

</details>

---

<details>
<summary>File map</summary>

- `src/lib/embed-servers.ts` — new shared module; exports `EmbedServer` type and `getEmbedServers()` function with four servers for both movies and TV
- `src/routes/title.$source.$type.$id.tsx` — inline player, Netflix-style season/episode selector, history logging, server switching added; imports `getEmbedServers` from the new module
- `src/routes/watch.$source.$type.$id.tsx` — removed inline server array; imports `getEmbedServers` from new module; behavior otherwise unchanged

Full diff: `git diff main -- src/lib/embed-servers.ts src/routes/title.$source.$type.$id.tsx src/routes/watch.$source.$type.$id.tsx`

</details>
