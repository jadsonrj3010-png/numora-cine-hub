import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Internet Archive "feature_films": acervo público e legal de filmes em domínio público.
export interface ArchiveItem { id: string; title: string; year: number | null; thumb: string; description: string }

const BASE = "https://archive.org";
const FILTER = "collection:(feature_films) AND mediatype:(movies) AND -collection:(stream_only)";

function toItem(d: any): ArchiveItem {
  const desc = Array.isArray(d.description) ? d.description[0] : d.description ?? "";
  return {
    id: d.identifier,
    title: Array.isArray(d.title) ? d.title[0] : d.title ?? d.identifier,
    year: d.year ? Number(String(d.year).slice(0, 4)) || null : null,
    thumb: `${BASE}/services/img/${d.identifier}`,
    description: String(desc).replace(/<[^>]+>/g, "").slice(0, 600),
  };
}

async function search(q: string, page: number, rows: number) {
  const u = new URL(`${BASE}/advancedsearch.php`);
  u.searchParams.set("q", q);
  for (const f of ["identifier", "title", "year", "description"]) u.searchParams.append("fl[]", f);
  u.searchParams.set("sort[]", "downloads desc");
  u.searchParams.set("rows", String(rows));
  u.searchParams.set("page", String(page));
  u.searchParams.set("output", "json");
  const r = await fetch(u, { headers: { "User-Agent": "NUMORA-CINE/1.0" } });
  if (!r.ok) throw new Error("Acervo indisponível");
  const j = await r.json();
  return { docs: (j.response?.docs ?? []) as any[], total: Number(j.response?.numFound ?? 0) };
}

const clean = (s: string) => s.replace(/["\\:()]/g, " ").trim();

export const archiveList = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().max(100).optional(), page: z.number().int().min(1).max(100).default(1) }).parse(d))
  .handler(async ({ data }) => {
    const q = data.q?.trim() ? `${FILTER} AND title:(${clean(data.q)})` : FILTER;
    const { docs, total } = await search(q, data.page, 30);
    return { items: docs.map(toItem), page: data.page, totalPages: Math.min(Math.ceil(total / 30), 100) };
  });

export const archiveMatch = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ title: z.string().min(1).max(200), year: z.number().int().nullable() }).parse(d))
  .handler(async ({ data }) => {
    const t = clean(data.title);
    if (!t) return null;
    const yr = data.year ? ` AND year:[${data.year - 1} TO ${data.year + 1}]` : "";
    const { docs } = await search(`${FILTER} AND title:("${t}")${yr}`, 1, 5);
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hit = docs.find((d) => norm(String(d.title)).startsWith(norm(data.title)));
    return hit ? (hit.identifier as string) : null;
  });

export const archiveFile = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().regex(/^[\w.-]{1,120}$/) }).parse(d))
  .handler(async ({ data }) => {
    const r = await fetch(`${BASE}/metadata/${data.id}`);
    if (!r.ok) return null;
    const j = await r.json();
    const files: any[] = j.files ?? [];
    const mp4s = files.filter((f) => /\.mp4$/i.test(f.name));
    const pick = mp4s.find((f) => /h\.264|512kb/i.test(`${f.format} ${f.name}`)) ?? mp4s[0];
    if (!pick) return null;
    const meta = toItem({ ...j.metadata, identifier: data.id });
    return {
      ...meta,
      video: `${BASE}/download/${data.id}/${encodeURIComponent(pick.name)}`,
      subs: null as string | null, // archive.org bloqueia legendas via CORS
    };
  });
