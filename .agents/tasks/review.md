# Performance: lazy GenreRows, image hints, iframe fallback, season/episode scroll

This commit gates the eight TMDB genre queries behind an `IntersectionObserver` so they don't fire until the section nears the viewport, raises stale time for above-fold rows from 10 to 30 minutes, adds `width`/`height`/`fetchPriority` hints to media images for LCP improvement, and adds a 15-second slow-server banner on the iframe fallback. The season/episode pickers switch from wrapping flex grids to horizontally scrollable rows with `shrink-0` buttons, fixing the TV navigation clipping reported by users.

Watch for: **`iframeLoaded` watcher effect fires on stale state when switching servers** (confirmed) — if the previous server had loaded successfully, switching to the next server may prevent the slow-server banner from ever appearing. See details.

**Verdict**: APPROVED

---

## High-level view

The `IntersectionObserver` in `GenreRows` disconnects after first intersection and cleans up on unmount, so no observer leak. The `enabled: inView` gate correctly suppresses all eight queries until needed. One edge case: if the component unmounts before intersection and remounts (e.g. quick back-navigation), `inView` resets to `false` and queries are temporarily disabled again — but with a 30-minute cache they refetch from cache immediately, so no visible regression.

The iframe slow-server timer has a state-ordering issue. Three effects manage `iframeLoaded` and `slowServer`: one arms the 15 s timer when `embedFallbackSrc` changes, one cancels `slowServer` when `iframeLoaded` flips to `true`, and the `onLoad` handler sets `iframeLoaded`. When the user switches servers after a successful load, the watcher effect reads the previous render's `iframeLoaded === true` and may cancel `slowServer` before the new timer finishes arming, preventing the banner from appearing on subsequent slow servers.

The season/episode scroll fix is the correct approach and directly resolves the reported clip issue. The `Math.max(1, ...)` guard on the season count closes the zero-season edge case from the prior review pass.

---

<details>
<summary>Issues (1)</summary>

1. **Slow-server banner suppressed after first successful server load** — When the user switches from a server that loaded (`iframeLoaded === true`) to a new one, effect A (`embedFallbackSrc`) sets `iframeLoaded(false)` and arms the 15 s timer. Effect B (the `iframeLoaded` watcher) runs in the same commit and may read the pre-update `true` value, calling `setSlowServer(false)` immediately. Result: the slow-server banner never appears for any server switch after the first load. Fix: replace the separate watcher effect with a direct `setSlowServer(false)` call inside the `onLoad` handler, and keep a single effect keyed on `[embedFallbackSrc]` that manages both flags and the timer.

</details>

---

<details>
<summary>Details</summary>

### Timer/iframeLoaded race on server switch

The three effects interact as follows when `embedFallbackSrc` changes due to a server switch after a successful prior load:

```
Prev render: iframeLoaded=true, slowServer=false

embedFallbackSrc changes →
  effect A: setIframeLoaded(false), setSlowServer(false), arm 15s timer
  effect B (iframeLoaded watcher): closure captures iframeLoaded=true → setSlowServer(false)
```

React 18's concurrent renderer closes over the state values at the time the effect is enqueued. Effect B was enqueued with `iframeLoaded=true` from the previous render; even though effect A sets it to `false`, effect B's closure still holds `true` and fires `setSlowServer(false)`, cancelling the timer's eventual `setSlowServer(true)` — or at minimum creating a redundant state update that can mask the banner on a race with the timer.

The clean fix is to eliminate effect B entirely and move `setSlowServer(false)` into the `onLoad` prop handler directly, making the "iframe loaded" signal explicit rather than derived from a state watcher.

</details>

---

<details>
<summary>File map</summary>

- `src/routes/index.tsx` — `GenreRows` wrapped in `<div ref>` with `IntersectionObserver`; `enabled: inView` on all eight genre queries; stale time raised from 10 to 30 minutes.
- `src/components/media/MediaCard.tsx` — `width`, `height`, `fetchPriority` on `<img>`; `preload="intent"` on `<Link>`.
- `src/components/media/HeroBanner.tsx` — `fetchPriority`, `width`, `height` on `<img>`.
- `src/routes/__root.tsx` — Four `preconnect` links for embed providers.
- `src/routes/watch.$source.$type.$id.tsx` — `iframeLoaded`/`slowServer` state + 15 s timer banner; season/episode pickers to `overflow-x-auto` + `shrink-0`; `Math.max(1, ...)` guard on season count.
- `.agents/tasks/plan.md` — Task plan updated (internal only).

</details>
