import { Link } from "@tanstack/react-router";
import { Check, Play, Plus, Star } from "lucide-react";
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

  if (loading) return <div className="aspect-[4/5] w-full animate-pulse bg-card sm:aspect-[16/7]" />;
  const item = items[idx];
  if (!item) return null;
  const fav = isFav(item);

  return (
    <section className="relative isolate aspect-[4/5] w-full overflow-hidden sm:aspect-[16/7]">
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
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-background/90 via-background/30 to-transparent sm:block" />
      <div className="flex h-full max-w-2xl flex-col justify-end gap-3 px-4 pb-8 lg:px-8 lg:pb-14">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded bg-primary px-2 py-0.5 font-bold text-primary-foreground">{typeLabel(item.mediaType)}</span>
          {item.year && <span>{item.year}</span>}
          {item.rating != null && (
            <span className="flex items-center gap-1 text-primary"><Star className="h-3.5 w-3.5 fill-current" />{item.rating.toFixed(1)}</span>
          )}
          {item.genres.slice(0, 2).map((g) => <span key={g}>· {g}</span>)}
        </div>
        <h2 className="text-3xl font-extrabold leading-tight sm:text-5xl">{item.title}</h2>
        <p className="line-clamp-3 max-w-xl text-sm text-foreground/80 sm:text-base">{item.overview}</p>
        <div className="mt-1 flex gap-3">
          <Button asChild size="lg" className="rounded-full font-bold">
            <Link to="/watch/$source/$type/$id" params={{ source: item.source, type: item.mediaType, id: item.id }}>
              <Play className="fill-current" /> Assistir
            </Link>
          </Button>
          <Button size="lg" variant="secondary" className="rounded-full font-bold" onClick={() => toggle(item)}>
            {fav ? <Check /> : <Plus />} Minha Lista
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
