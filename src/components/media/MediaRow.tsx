import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { MediaItem } from "@/lib/types";
import { MediaCard, MediaCardSkeleton } from "./MediaCard";

export function RowShell({ title, more, children }: { title: string; more?: LinkProps | undefined; children: ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between px-4 lg:px-8">
        <h2 className="text-base font-bold sm:text-lg">{title}</h2>
        {more && (
          <Link {...more} className="flex items-center text-xs font-semibold text-primary">
            Ver mais <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className="scrollbar-none flex gap-3 overflow-x-auto px-4 pb-1 lg:px-8">{children}</div>
    </section>
  );
}

export function MediaRow({ title, items, loading, more, ranked }: { title: string; items?: MediaItem[] | undefined; loading?: boolean; more?: LinkProps; ranked?: boolean }) {
  if (!loading && (!items || items.length === 0)) return null;
  return (
    <RowShell title={title} more={more}>
      {loading
        ? Array.from({ length: 8 }).map((_, i) => <MediaCardSkeleton key={i} />)
        : items!.map((it, i) => <MediaCard key={it.source + it.mediaType + it.id} item={it} rank={ranked ? i + 1 : undefined} />)}
    </RowShell>
  );
}
