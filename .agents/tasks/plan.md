# Implementation Plan — Performance & Bug Fixes

> **Build command:** `npm run build`
> **Lint:** `npm run lint`
> **Dev preview:** `npm run dev`
> **No test runner configured** — verification is done via `npm run build` (TypeScript compilation) and manual browser inspection.

---

## Context descoberto na exploração

- Framework: TanStack Start (React 19 + TanStack Router 1.170 + TanStack Query 5).
- `<Link>` do TanStack Router aceita a prop `preload` com valores `"intent"` (hover/focus) ou `"viewport"` — sem imports adicionais.
- `__root.tsx` usa a API `head()` com array `links:` para injetar `<link>` no `<head>` — é o único lugar correto para `preconnect`.
- `HeroBanner.tsx` já tem `loading={i === 0 ? "eager" : "lazy"}` mas **falta** `fetchpriority="high"` na primeira imagem.
- `MediaCard.tsx` usa `loading="lazy"` em todas as imagens e não tem `width`/`height` nem `fetchpriority` para os primeiros cards.
- `index.tsx` — `GenreRows` dispara 8 queries TMDB simultâneas na montagem, somadas às 6 queries da `Home` = ~14 queries imediatas. O `STALE` das listas principais é 10 min; o das `GenreRows` já é 30 min.
- `watch.$source.$type.$id.tsx` — os dois iframes de embed (`iframeSrc` e `embedFallbackSrc`) não têm estado de carregamento. Se o iframe trava, o usuário não recebe feedback e precisa recarregar manualmente.

---

## Items

- [ ] 1. **`__root.tsx` — adicionar preconnect para servidores de embed**

  No array `links:` do `head()`, acrescentar quatro entradas `{ rel: "preconnect", href: "..." }` para os domínios dos players externos. Isso instrui o browser a abrir o handshake TCP/TLS antes de o usuário clicar em "assistir", reduzindo a latência inicial do iframe.

  **Arquivo:** `src/routes/__root.tsx`

  Acrescentar ao final do array `links:` existente (após o `preconnect` de `image.tmdb.org`):
  ```ts
  { rel: "preconnect", href: "https://vidsrc.io" },
  { rel: "preconnect", href: "https://vidsrc.me" },
  { rel: "preconnect", href: "https://vidsrc.xyz" },
  { rel: "preconnect", href: "https://embed.su" },
  ```

  **Verify:** `npm run build` — sem erros TypeScript.

---

- [ ] 2. **`HeroBanner.tsx` — fetchpriority na primeira imagem**

  A primeira imagem do banner (i === 0) é LCP candidate. Ela já tem `loading="eager"`, mas o browser ainda precisa da dica de prioridade de fetch. Adicionar `fetchpriority="high"` somente quando `i === 0`.

  **Arquivo:** `src/components/media/HeroBanner.tsx`

  Alterar o `<img>` dentro do `.map` para incluir a prop condicional:
  ```tsx
  fetchPriority={i === 0 ? "high" : undefined}
  ```
  (React 19 usa camelCase `fetchPriority`; o atributo HTML resultante é `fetchpriority`.)

  O atributo `loading` já está correto (`"eager"` para i===0, `"lazy"` para os demais) — não alterar.

  **Verify:** `npm run build` — sem erros. No DevTools Network, a primeira imagem do hero deve aparecer com `Priority: Highest`.

---

- [ ] 3. **`MediaCard.tsx` — width/height, fetchpriority e preload no Link**

  Três melhorias no mesmo componente:

  1. **Dimensões fixas na imagem** — evitam CLS (Cumulative Layout Shift). O poster TMDB é sempre aspect-ratio 2:3. O container já força esse aspect-ratio via CSS, mas o `<img>` não declara as dimensões intrínsecas. Adicionar `width={180}` e `height={270}` (valores maiores que o display máximo de 180px, sem impacto visual).

  2. **fetchpriority para os primeiros cards** — quando `rank` é fornecido e `rank <= 3`, ou quando não há `rank` e o card pode ser visível acima da dobra, adicionar `fetchPriority="high"` e trocar `loading="lazy"` por `loading="eager"`. A regra prática: se `rank != null && rank <= 3` → eager + high; caso contrário → lazy (comportamento atual).

  3. **Preload no Link** — adicionar `preload="intent"` no `<Link>` do TanStack Router para que ao hover/focus o router já prefetch a página `/title/...`, tornando a navegação instantânea.

  **Arquivo:** `src/components/media/MediaCard.tsx`

  Mudanças concretas:
  ```tsx
  // Link — adicionar prop preload
  <Link
    preload="intent"
    to="/title/$source/$type/$id"
    ...
  >

  // img — adicionar width, height e fetchPriority condicional
  <img
    src={item.poster ?? item.backdrop ?? ""}
    alt={item.title}
    width={180}
    height={270}
    loading={rank != null && rank <= 3 ? "eager" : "lazy"}
    fetchPriority={rank != null && rank <= 3 ? "high" : undefined}
    decoding="async"
    className="h-full w-full object-cover"
  />
  ```

  **Verify:** `npm run build` — sem erros TypeScript.

---

- [ ] 4. **`index.tsx` — lazy GenreRows via IntersectionObserver + STALE 30 min**

  Dois problemas em um arquivo:

  **4a. STALE das listas principais:** a constante `STALE` vale `10 * 60_000` (10 min). Aumentar para `30 * 60_000` (30 min) — as GenreRows já usam 30 min; uniformizar reduz re-fetches desnecessários nas seções superiores.

  **4b. Lazy GenreRows:** atualmente `<GenreRows />` é montado imediatamente e dispara 8 queries TMDB assim que a home carrega, mesmo que o usuário nunca role até lá. A solução é usar `IntersectionObserver` para só montar `<GenreRows />` quando o placeholder entrar na viewport.

  Estratégia de implementação:
  - Criar um hook interno `useInView(ref)` que retorna `boolean` usando `IntersectionObserver` com `rootMargin: "200px"` (pré-carrega 200px antes de entrar na tela).
  - Substituir `<GenreRows />` por um wrapper que renderiza um `<div ref={sentinelRef}>` com altura mínima enquanto não está em view, e monta `<GenreRows />` apenas quando `inView === true`. Uma vez montado, permanece montado (sem desmontar ao rolar para cima).

  Código do wrapper a inserir em `index.tsx`:
  ```tsx
  function LazyGenreRows() {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
      if (inView) return; // já disparou, não re-observar
      const el = ref.current;
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setInView(true); },
        { rootMargin: "200px" }
      );
      obs.observe(el);
      return () => obs.disconnect();
    }, [inView]);
    return (
      <div ref={ref}>
        {inView ? <GenreRows /> : <div style={{ minHeight: "400px" }} />}
      </div>
    );
  }
  ```

  Substituir `<GenreRows />` por `<LazyGenreRows />` no JSX de `Home`.

  Imports necessários: `useRef` já está disponível no React (adicionar ao import existente se não estiver); `useState` e `useEffect` também já são usados no arquivo.

  **Arquivo:** `src/routes/index.tsx`

  **Verify:** `npm run build` — sem erros. No DevTools Network ao carregar a home, as queries `tmdb/animes`, `tmdb/comedia`, etc., **não devem aparecer** até o usuário rolar para perto da seção de gêneros.

---

- [ ] 5. **`watch.$source.$type.$id.tsx` — estado iframeLoaded + timeout de 15s para sugestão de troca de servidor**

  Atualmente os dois iframes de embed (`iframeSrc` e `embedFallbackSrc`) são renderizados sem feedback de carregamento. Se o servidor externo não responder, o player fica em branco e o usuário não sabe o que fazer.

  **Lógica a implementar:**

  1. Adicionar estado `iframeLoaded` (boolean, inicia `false`) e `showServerHint` (boolean, inicia `false`).
  2. Resetar ambos os estados sempre que o iframe mudar (`key` já é a URL do iframe — adicionar um `useEffect` que observe `iframeSrc` e `embedFallbackSrc` e resete).
  3. No evento `onLoad` do iframe, setar `iframeLoaded = true` (e cancelar o timer se existir).
  4. Iniciar um `setTimeout` de 15 000 ms quando o iframe for renderizado. Se `iframeLoaded` ainda for `false` após 15s, setar `showServerHint = true`.
  5. Exibir o hint somente quando `showServerHint && !iframeLoaded`:
     ```tsx
     {showServerHint && !iframeLoaded && (
       <p className="mt-2 px-4 text-sm text-yellow-400 sm:px-0">
         O vídeo está demorando para carregar. Tente outro servidor acima.
       </p>
     )}
     ```
  6. Aplicar a mesma lógica aos dois blocos de iframe (`iframeSrc` e `embedFallbackSrc`). O `embedFallbackSrc` já tem `{ServerButtons}` e a dica estática — substituir a dica estática pela dica condicional de timeout.

  **Implementação concreta dos estados e refs:**
  ```tsx
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showServerHint, setShowServerHint] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset ao trocar de iframe
  useEffect(() => {
    setIframeLoaded(false);
    setShowServerHint(false);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    const activeSrc = iframeSrc ?? embedFallbackSrc;
    if (!activeSrc) return;
    hintTimerRef.current = setTimeout(() => {
      setShowServerHint(true);
    }, 15_000);
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, [iframeSrc, embedFallbackSrc]);
  ```

  No `onLoad` dos iframes:
  ```tsx
  onLoad={() => {
    setIframeLoaded(true);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  }}
  ```

  A dica condicional abaixo dos iframes:
  ```tsx
  {showServerHint && !iframeLoaded && (
    <p className="mt-2 px-4 text-sm text-yellow-400 sm:px-0">
      O vídeo está demorando para carregar.{" "}
      {embedServers.length > 1 ? "Tente outro servidor acima." : "Tente recarregar a página."}
    </p>
  )}
  ```

  Remover a dica estática `"Se o vídeo não carregar, tente outro servidor acima."` existente no bloco `embedFallbackSrc`, pois é substituída pela dica condicional.

  **Arquivo:** `src/routes/watch.$source.$type.$id.tsx`

  **Verify:** `npm run build` — sem erros TypeScript. Teste manual: abrir um conteúdo que use servidor embed, desconectar da rede ou usar um servidor sabidamente lento, aguardar 15s sem `onLoad` disparar — a dica amarela deve aparecer.

---

## Ordem de dependência

Os 5 items são **independentes entre si** — nenhum depende do output de outro. Podem ser implementados em qualquer ordem. A ordem acima é da mudança mais simples (1 linha) para a mais complexa (lógica de estado).

## Notas finais

- O projeto não tem test runner configurado. A verificação formal é `npm run build` (compila TypeScript) em cada item.
- `fetchPriority` (camelCase) é a prop React correta para React 19; o atributo HTML gerado é `fetchpriority` (minúsculo).
- O `IntersectionObserver` é nativo em todos os browsers modernos — sem polyfill necessário.
- `preload="intent"` no TanStack Router Link é tipado corretamente no pacote `@tanstack/react-router@1.170` já instalado.
