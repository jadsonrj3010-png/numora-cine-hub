import { Link } from "@tanstack/react-router";
import { Play, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToggleFavorite } from "@/hooks/use-library";
import { typeLabel, type MediaItem } from "@/lib/types";

export function HeroBanner({ items, loading }: { items: MediaItem[]; loading?: boolean }) {
  const [idx, setIdx] = useState(0);
  const { toggle, isFav } = useToggleFavorite();
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 8000);
    return () => clearInterval(t);
  }, [items.length]);

  if (loading) return <div className="min-h-[70vh] w-full animate-pulse bg-card" />;
  const item = items[idx];
  if (!item) return null;
  const fav = isFav(item);

  return (
    <section className="relative isolate min-h-[70vh] w-full overflow-hidden">
      {items.map((it, i) => (
        <img
          key={it.id}
          src={it.backdrop ?? it.poster ?? ""}
          alt={it.title}
          aria-hidden={i !== idx}
          loading={i === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 -z-10 h-full w-full object-cover transition-opacity duration-1000 ${i === idx ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      {/* Gradient bottom-to-top */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/60 to-transparent" />
      {/* Gradient left-to-right (sm+) */}
      <div className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-[#0d1117]/95 via-[#0d1117]/40 to-transparent sm:block" />

      <div className="flex min-h-[70vh] max-w-2xl flex-col justify-end gap-3 pb-10 px-6 lg:pb-16 lg:px-12">
        {/* Server label */}
        <p className="text-xs tracking-widest text-primary/80 uppercase font-semibold mb-1">SERVIDOR 1</p>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="rounded bg-primary px-2 py-0.5 font-bold text-primary-foreground">{typeLabel(item.mediaType)}</span>
          {item.year && <span>{item.year}</span>}
          {item.rating != null && (
            <span className="flex items-center gap-1 text-primary"><Star className="h-3.5 w-3.5 fill-current" />{item.rating.toFixed(1)}</span>
          )}
          {item.genres.slice(0, 2).map((g) => <span key={g}>· {g}</span>)}
        </div>

        <h2 className="text-4xl font-extrabold leading-tight text-white sm:text-6xl mb-2">{item.title}</h2>
        <p className="line-clamp-3 max-w-xl text-sm text-foreground/80 sm:text-base">{item.overview}</p>

        <div className="mt-1 flex gap-3">
          <Button asChild size="lg" className="rounded-full font-bold bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/watch/$source/$type/$id" params={{ source: item.source, type: item.mediaType, id: item.id }}>
              <Play className="fill-current" /> Assistir agora
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="rounded-full font-bold">
            <Link to="/title/$source/$type/$id" params={{ source: item.source, type: item.mediaType, id: item.id }}>
              Mais info
            </Link>
          </Button>
        </div>

        {items.length > 1 && (
          <div className="mt-3 flex gap-1.5">
            {items.map((it, i) => (
              <button key={it.id} onClick={() => setIdx(i)} aria-label={`Destaque ${i + 1}`} className={`h-1 rounded-full transition-all ${i === idx ? "w-6 bg-primary" : "w-2 bg-foreground/30"}`} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
