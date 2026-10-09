import { Link } from "@tanstack/react-router";
import { Play, Star } from "lucide-react";
import { typeLabel, type MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MediaCard({ item, className, rank }: { item: MediaItem; className?: string | undefined; rank?: number | undefined }) {
  return (
    <div className={cn("flex shrink-0 flex-row", className)}>
      {rank != null && (
        <span className="mr-1 self-end mb-2 text-5xl font-black leading-none text-white/30">{rank}</span>
      )}
      <Link
        to="/title/$source/$type/$id"
        params={{ source: item.source, type: item.mediaType, id: item.id }}
        preload="intent"
        className="group block w-[130px] sm:w-[160px] lg:w-[180px] shrink-0"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-card ring-1 ring-border transition-transform duration-200 group-hover:scale-[1.03] group-hover:ring-primary/70">
          {/* Poster vertical do TMDB */}
          <img
            src={item.poster ?? item.backdrop ?? ""}
            alt={item.title}
            loading="lazy"
            decoding="async"
            width={180}
            height={270}
            fetchPriority={rank != null && rank <= 3 ? "high" : "auto"}
            className="h-full w-full object-cover"
          />

          {/* Gradiente inferior */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          {/* HD badge — top left */}
          <span className="absolute left-1.5 top-1.5 rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            HD
          </span>

          {/* Rating — top right */}
          {item.rating != null && (
            <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-yellow-400 backdrop-blur">
              <Star className="h-3 w-3 fill-current" />
              {item.rating.toFixed(1)}
            </span>
          )}

          {/* Play button on hover — center */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
            <div className="rounded-full bg-white/20 p-3 backdrop-blur-sm">
              <Play className="h-5 w-5 fill-white text-white" />
            </div>
          </div>
        </div>

        <p className="mt-1.5 line-clamp-2 text-xs font-semibold text-foreground">
          {item.title}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {typeLabel(item.mediaType)}
          {item.year ? ` · ${item.year}` : ""}
        </p>
      </Link>
    </div>
  );
}

export function MediaCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("w-[130px] shrink-0 sm:w-[160px] lg:w-[180px]", className)}>
      <div className="aspect-[2/3] animate-pulse rounded-lg bg-card" />
      <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-card" />
    </div>
  );
}
