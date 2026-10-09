# Implementation Plan — NUMORA CINE Bug Fixes

## Context

- Project: TanStack Start + React 19, Tailwind v4, Supabase, TMDB.
- Build: `npm run build` | Dev: `npm run dev` | Lint: `npm run lint`
- No automated test runner — verification is build success + manual browser check.
- All edits are inside `src/`.

---

## Fix 1 — TV/Desktop dead-space padding

**Problem:** `__root.tsx` uses `pb-24 lg:pb-12` on `<main>` when not-immersive.
`BottomNav` already has `lg:hidden`, so on large screens the 12-unit bottom padding is dead space that pushes content down unnecessarily on TV/desktop.

**Change:** In `RootComponent` inside `__root.tsx`, change the className condition:

```tsx
// BEFORE
<main className={immersive ? "" : "pb-24 lg:pb-12"}>

// AFTER
<main className={immersive ? "" : "pb-24 lg:pb-0"}>
```

- File: `src/routes/__root.tsx`
- Verify: `npm run build` succeeds. On a large screen (`lg:` breakpoint) the bottom of any page no longer has 48px of empty padding below the last content block.

---

## Fix 2 — OAuth bad_oauth_state / LoginWall redirect loop

**Problem:** After Google OAuth, Supabase redirects back to `window.location.origin` (i.e. `/`) with either `?code=...` (PKCE) or `#access_token=...` in the URL. At that instant `user` is still `null` while the auth client exchanges the code. `LoginWall` runs, sees `user=null`, `!open=true` (path is `/`), and immediately pushes to `/auth` — which breaks the OAuth state exchange and causes `bad_oauth_state`.

**Fix:** In `LoginWall` in `__root.tsx`, add a URL guard: if the current `window.location` contains `code=` in the search params OR `access_token` in the hash, skip the redirect entirely and let the Supabase client finish the exchange.

```tsx
function LoginWall({ path }: { path: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const open = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Guard: OAuth callback in-flight — do not redirect while Supabase
  // is exchanging the code/token; the auth state will update shortly.
  const isOAuthCallback =
    typeof window !== "undefined" &&
    (window.location.search.includes("code=") ||
      window.location.hash.includes("access_token") ||
      window.location.search.includes("error="));

  useEffect(() => {
    if (!loading && !user && !open && !isOAuthCallback) {
      router.navigate({ to: "/auth", replace: true });
    }
  }, [loading, user, open, isOAuthCallback, router]);

  return null;
}
```

- File: `src/routes/__root.tsx`
- Verify: `npm run build` succeeds. Manually test Google sign-in: after OAuth redirect lands on `/`, the user is logged in without `bad_oauth_state` error.

---

## Fix 3 — TMDB TV episode navigation (season + episode selector)

**Problem:** `watch.$source.$type.$id.tsx` only renders episode navigation when `data.episodes.length > 1`. For `source=tmdb, type=tv`, `data.episodes` is always `[]` (no local rows), so no navigation ever appears. The embed servers already accept `season`/`episode` params but they are never wired for TMDB TV.

### Step 3a — Add `season` and `epNum` to `validateSearch`

```tsx
// BEFORE
validateSearch: z.object({ ep: z.string().uuid().optional(), teste: z.coerce.number().optional() }),

// AFTER
validateSearch: z.object({
  ep: z.string().uuid().optional(),
  teste: z.coerce.number().optional(),
  season: z.coerce.number().int().min(1).optional(),
  epNum: z.coerce.number().int().min(1).optional(),
}),
```

- File: `src/routes/watch.$source.$type.$id.tsx`

### Step 3b — Derive current season/episode from search params for TMDB TV

Inside `Watch()`, after the existing `const { ep, teste } = Route.useSearch();` line, add:

```tsx
const { ep, teste, season: searchSeason, epNum: searchEpNum } = Route.useSearch();

// For TMDB TV: default to S1E1 if not specified in URL
const isTmdbTv = source === "tmdb" && type === "tv";
const currentSeason = searchSeason ?? 1;
const currentEpNum = searchEpNum ?? 1;
```

### Step 3c — Wire season/episode into `getEmbedServers` for TMDB TV

Change the `embedServers` derivation so TMDB TV passes `currentSeason`/`currentEpNum`:

```tsx
// BEFORE
const embedServers = (() => {
  if (iframeSrc || rawVideo || !tmdbId) return [];
  return getEmbedServers(tmdbId, type, episode?.season_number, episode?.episode_number);
})();

// AFTER
const embedServers = (() => {
  if (iframeSrc || rawVideo || !tmdbId) return [];
  const s = isTmdbTv ? currentSeason : (episode?.season_number ?? 1);
  const e = isTmdbTv ? currentEpNum : (episode?.episode_number ?? 1);
  return getEmbedServers(tmdbId, type, s, e);
})();
```

### Step 3d — Add TMDB TV episode/season navigation UI

After the existing episode list block (the `{data.episodes.length > 1 && ...}` block), add a second block for TMDB TV:

```tsx
{isTmdbTv && data && data.details.seasons && data.details.seasons > 0 && (
  <TmdbEpisodeNav
    seasons={data.details.seasons}
    currentSeason={currentSeason}
    currentEpNum={currentEpNum}
  />
)}
```

Define `TmdbEpisodeNav` as a new component in the same file (below `Message`):

```tsx
function TmdbEpisodeNav({
  seasons,
  currentSeason,
  currentEpNum,
}: {
  seasons: number;
  currentSeason: number;
  currentEpNum: number;
}) {
  // Simple fallback: show 20 episodes per season.
  // Real episode counts require an extra TMDB call we avoid here for simplicity.
  const EP_COUNT = 20;
  const seasonList = Array.from({ length: seasons }, (_, i) => i + 1);
  const epList = Array.from({ length: EP_COUNT }, (_, i) => i + 1);

  return (
    <div className="mt-6">
      {/* Season selector */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-muted-foreground">Temporada:</span>
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          {seasonList.map((s) => (
            <Link
              key={s}
              to="."
              search={{ season: s, epNum: 1 }}
              replace
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                s === currentSeason ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              T{s}
            </Link>
          ))}
        </div>
      </div>

      {/* Episode selector */}
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-semibold text-muted-foreground">Episódio:</span>
      </div>
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        {epList.map((e) => (
          <Link
            key={e}
            to="."
            search={{ season: currentSeason, epNum: e }}
            replace
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              e === currentEpNum ? "bg-primary text-primary-foreground" : "bg-secondary"
            }`}
          >
            E{e}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- File: `src/routes/watch.$source.$type.$id.tsx`
- Verify: `npm run build` succeeds. Navigate to a TMDB TV title, click "Assistir" — season and episode pill rows appear. Clicking T2 changes the embed URL to `…/tv/{id}/2/1`. Clicking E3 changes it to `…/2/3`.

---

## Fix 4 — Additional embed servers (Servidor 3 and 4)

**Problem:** Only 2 embed servers exist; when both fail the content appears unavailable. Two ad-light providers can be added.

**Change:** In `getEmbedServers` in `watch.$source.$type.$id.tsx`, add two more entries to each return:

```tsx
function getEmbedServers(tmdbId: string, type: MediaType, season?: number, episode?: number) {
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

- File: `src/routes/watch.$source.$type.$id.tsx`
- Verify: `npm run build` succeeds. On any TMDB title the player shows four server buttons. Clicking "Servidor 3" loads the vidsrc.xyz embed; "Servidor 4" loads embed.su.

---

## Fix 5 — "Próximo episódio" button for TMDB TV

**Problem:** Iframes are cross-origin so `ended` events are unavailable. A manual "Próximo episódio" button is the correct workaround.

**Change:** In `Watch()`, after `const embedFallbackSrc = ...` and the `ServerButtons` JSX, add a `NextEpisodeButton` computed value for TMDB TV:

```tsx
const totalSeasons = data?.details.seasons ?? 0;

const NextEpisodeButton =
  isTmdbTv && embedFallbackSrc ? (
    <div className="mt-3 flex justify-end px-4 sm:px-0">
      <Link
        to="."
        search={
          currentEpNum < 20
            ? { season: currentSeason, epNum: currentEpNum + 1 }
            : currentSeason < totalSeasons
              ? { season: currentSeason + 1, epNum: 1 }
              : { season: currentSeason, epNum: currentEpNum } // last episode — no-op
        }
        replace
        className="flex min-h-[44px] items-center gap-2 rounded-full bg-secondary px-5 py-2 text-sm font-semibold hover:bg-primary/20"
      >
        Próximo episódio →
      </Link>
    </div>
  ) : null;
```

Then render `{NextEpisodeButton}` directly after `{ServerButtons}` in the JSX (inside the `embedFallbackSrc` branch):

```tsx
) : embedFallbackSrc ? (
  <>
    <iframe ... />
    {ServerButtons}
    {NextEpisodeButton}
    <p className="mt-1 px-4 text-xs text-muted-foreground sm:px-0">Se o vídeo não carregar, tente outro servidor acima.</p>
  </>
```

Note: `totalSeasons` must be computed after `data` is available; place it after `const embedServers = ...` so it can safely reference `data?.details.seasons`. Because `data` can be `null` during loading, the `?? 0` default prevents crashes.

- File: `src/routes/watch.$source.$type.$id.tsx`
- Verify: `npm run build` succeeds. On a TMDB TV watch page a "Próximo episódio →" button appears below the player. Clicking it increments the episode number in the URL (and season, at season boundary).

---

## Execution order

All five fixes are in at most two files (`__root.tsx` and `watch.$source.$type.$id.tsx`). Recommended order:

1. Fix 1 (1-line change, `__root.tsx`)
2. Fix 2 (LoginWall guard, `__root.tsx`)
3. Fix 3a + 3b + 3c + 3d together (all in `watch.$source.$type.$id.tsx` — they are interdependent; do them as one atomic edit)
4. Fix 4 (`getEmbedServers` — extend the array, same file)
5. Fix 5 (next-episode button, same file)

After all edits: run `npm run build` — zero TypeScript errors is the acceptance gate.
