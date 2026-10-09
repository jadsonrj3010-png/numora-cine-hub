# TV episode navigation, extra embed servers, and OAuth callback guard

This change adds TMDB TV season/episode navigation directly on the watch page, expands the embed server list from two to four providers, and fixes an OAuth redirect loop that was bouncing users back to `/auth` mid-callback. The episode navigation replaces the prior implicit defaults with explicit URL search params (`season`, `epNum`) so state is bookmarkable and shareable. The OAuth guard in `LoginWall` checks for `code=`, `access_token`, `error_code=`, and `error=invalid_request` in the URL before triggering a redirect.

Watch for: **episodeCount fallback of 20** (confirmed) — when `tmdbSeasonDetails` hasn't resolved yet the UI renders 20 episode buttons regardless of actual count, which can expose non-existent episodes to the embed servers. Also note that the `seasons` field read from `data?.details?.seasons` is capped at 20 but never validated to be a positive integer, so a `0` or missing value from TMDB would render no season buttons at all while `currentSeason` defaults to 1 — a subtle inconsistency (confirmed).

**Verdict**: NEEDS_CHANGES

---

## High-level view

The episode navigation UI is driven by search params and resets `serverIdx` on season/episode change, which is the right approach. The weak point is that the episode count shown before `seasonDetails` resolves is a hardcoded 20, so a viewer on a show with fewer episodes can select and send a nonexistent episode number to all four embed servers — the servers will return errors or wrong content until the real count arrives.

The four embed servers are appended unconditionally for all TMDB content without a local video or iframe. `vidsrc.xyz` and `embed.su` are newly added; both are well-known aggregator embeds similar to the existing two. No ad or reliability data is available to rank them, so the ordering is arbitrary.

The OAuth callback guard is narrow and correct: it only suppresses the redirect, it doesn't short-circuit the auth flow itself. The four conditions cover Supabase's PKCE code exchange, implicit token hash, and the two error variants, which is the complete set for this provider.

The `seasons` cap at 20 and the `seasons ?? 1` fallback interact poorly: a show that TMDB reports as having 0 or `undefined` seasons renders zero season buttons while the embed still requests season 1 — the UI and the request are out of sync.

---

<details>
<summary>Issues (3)</summary>

1. **Stale episodeCount of 20 during load** — While `seasonDetails` is loading, `episodeCount` defaults to 20. Buttons for episodes beyond the real count send invalid episode numbers to embed servers. Gate the episode row on `!seasonDetails.isLoading` the same way the episode list is already gated, or initialise the default to `null` and show a skeleton instead.

2. **seasons=0 / undefined renders no season buttons** — `data?.details?.seasons ?? 1` is used as the upper bound of `Array.from`, but if TMDB returns `0` or the field is absent the array is empty and no season buttons render, while `currentSeason` defaults to `1`. The embed still fires with season 1 but the user sees nothing to click. Add a `Math.max(1, ...)` guard or use the season count only once `seasonDetails` confirms at least one season exists.

3. **episodeCount default of 20 persists after a season with fewer episodes** — When navigating from a long season to a short one there is a window where the old `episodeCount` (20) is still in state and episode buttons beyond the real count are clickable. The `staleTime` of 1 hour means this window can be long. Resetting `episodeCount` to `null` on season change (alongside the `serverIdx` reset) would close this gap.

</details>

---

<details>
<summary>Details</summary>

### episodeCount fallback exposes phantom episodes

`episodeCount` is initialised as `seasonDetails.data?.episodeCount ?? 20`. The episode button row is already wrapped in `{!seasonDetails.isLoading && (...)}`, so the buttons only appear after the query resolves — which means the fallback of 20 only matters for the prev/next navigation buttons and for the embed URL construction, not for the rendered episode list. However the embed URL is computed unconditionally:

```ts
const s = isTmdbTv ? currentSeason : episode?.season_number;
const e = isTmdbTv ? currentEpNum : episode?.episode_number;
return getEmbedServers(tmdbId, type, s, e);
```

`currentEpNum` comes from `searchEpNum ?? 1`, which is whatever the URL says. If a viewer manually types `epNum=25` for a 10-episode season, all four servers receive episode 25 and will error silently inside the iframe. This is a URL-validation gap, not a loading-race issue — the fix belongs in `validateSearch` (clamping `epNum` to the known episode count) or in the embed URL construction (clamping against `episodeCount` once resolved).

### Season count edge case

```ts
Array.from({ length: Math.min(data?.details?.seasons ?? 1, 20) }, ...)
```

`data?.details?.seasons` is a TMDB field that can be `0` (specials-only shows), `undefined` (missing metadata), or occasionally negative in malformed responses. `?? 1` only catches `null`/`undefined`; `0` passes through and `Math.min(0, 20)` produces zero iterations — no season buttons, user stuck. `Math.max(1, Math.min(..., 20))` fixes it.

### OAuth callback guard

The four-condition check in `LoginWall` covers the Supabase PKCE exchange (`code=` in query), the implicit flow (`access_token` in hash), and both error variants. It correctly reads `window.location` directly rather than the router state, which matters because the hash fragment isn't part of the router's location model. The guard is re-evaluated on every render, so a transient state where none of the four conditions is true would still trigger a redirect — but in practice the conditions are stable for the duration of the callback page render.

### New embed servers

`vidsrc.xyz` and `embed.su` are added as Servidor 3 and Servidor 4. Both are iframe-based aggregators that source streams the same way as `vidsrc.io` and `vidsrc.me`. No structural concern; availability is a runtime property. The `referrerPolicy="strict-origin-when-cross-origin"` and `allow` attributes on the iframe are consistent with the existing embed iframes.

</details>

---

<details>
<summary>File map</summary>

- `src/routes/__root.tsx` — `LoginWall` gains a four-condition OAuth callback guard; `<main>` padding changed from `pb-24 lg:pb-12` to `pb-24 lg:pb-0`.
- `src/routes/watch.$source.$type.$id.tsx` — `validateSearch` adds `season`/`epNum`; `getEmbedServers` expands to four providers; `Watch` component adds TMDB TV episode/season navigation UI and resets `serverIdx` on navigation.
- `src/routes/auth.tsx` — no material changes in this pass.

Full diff: `git diff main -- src/routes/__root.tsx src/routes/watch.\$source.\$type.\$id.tsx`

</details>
