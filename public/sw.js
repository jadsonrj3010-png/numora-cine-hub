const CACHE_NAME = "numora-cine-v5";
const STATIC_ASSETS = ["/", "/manifest.json", "/favicon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Nao cachear requests de API, Supabase ou servidores embed
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("tmdb.org") ||
    url.hostname.includes("vidsrc") ||
    url.hostname.includes("embed.su") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Network first para JS/CSS — garante sempre versao mais recente
  if (url.pathname.match(/\.(js|css)$/)) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache first para assets estaticos (imagens, fontes)
  if (url.pathname.match(/\.(woff2?|png|svg|ico|webp|jpg|jpeg)$/)) {
    e.respondWith(
      caches.match(e.request).then(
        (cached) => cached ?? fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Network first para paginas HTML
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then((r) => r ?? caches.match("/")))
  );
});
