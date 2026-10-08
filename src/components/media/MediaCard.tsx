import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { typeLabel, type MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MediaCard({ item, className, rank }: { item: MediaItem; className?: string | undefined; rank?: number | undefined }) {
  return (
    <Link
      to="/title/$source/$type/$id"
      params={{ source: item.source, type: item.mediaType, id: item.id }}
      className={cn("group block w-[118px] shrink-0 sm:w-[150px] lg:w-[170px]", className)}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-card ring-1 ring-border transition group-hover:ring-primary/60">
        {item.poster ? (
          <img src={item.poster} alt={item.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center p-3 text-center font-display text-sm text-muted-foreground">{item.title}</div>
        )}
        {item.rating != null && (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-overlay/80 px-1.5 py-0.5 text-[11px] font-bold text-primary backdrop-blur">
            <Star className="h-3 w-3 fill-current" />
            {item.rating.toFixed(1)}
          </span>
        )}
        {rank != null && (
          <span className="absolute bottom-1 left-2 font-display text-4xl font-black text-primary drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">{rank}</span>
        )}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-semibold">{item.title}</p>
      <p className="text-xs text-muted-foreground">
        {typeLabel(item.mediaType)}
        {item.year ? ` · ${item.year}` : ""}
      </p>
    </Link>
  );
}

export function MediaCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("w-[118px] shrink-0 sm:w-[150px] lg:w-[170px]", className)}>
      <div className="aspect-[2/3] animate-pulse rounded-lg bg-card" />
      <div className="mt-2 h-3.5 w-3/4 animate-pulse rounded bg-card" />
      <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-card" />
    </div>
  );
}
