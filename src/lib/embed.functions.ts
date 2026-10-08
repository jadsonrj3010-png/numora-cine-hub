import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { embedUrlProblem } from "./embed";

/** Lê os cabeçalhos da página para saber se o dono permite incorporação. Não contorna nada. */
export const checkEmbeddable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().url().max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Acesso negado");
    const problem = embedUrlProblem(data.url);
    if (problem) return { ok: false, reason: problem };
    try {
      const r = await fetch(data.url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000) });
      const xfo = (r.headers.get("x-frame-options") ?? "").toLowerCase();
      const csp = (r.headers.get("content-security-policy") ?? "").toLowerCase();
      const fa = csp.match(/frame-ancestors([^;]*)/)?.[1]?.trim() ?? "";
      const blocked = xfo.includes("deny") || xfo.includes("sameorigin") || (fa && !fa.includes("*") && !fa.includes("https:"));
      if (blocked) return { ok: false, reason: "Esta fonte não permite incorporação por iframe." };
      if (!r.ok) return { ok: false, reason: `A página respondeu com erro ${r.status}.` };
      return { ok: true, reason: null };
    } catch {
      return { ok: true, reason: "Não foi possível verificar automaticamente — confira a prévia." };
    }
  });
