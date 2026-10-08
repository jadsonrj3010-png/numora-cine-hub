import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminUser = { id: string; email: string | null; name: string | null; provider: string; created_at: string; last_sign_in_at: string | null; confirmed: boolean };

export const listSiteUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Acesso negado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: AdminUser[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      for (const u of data.users) {
        const m = (u.user_metadata ?? {}) as Record<string, unknown>;
        out.push({
          id: u.id, email: u.email ?? null,
          name: (m["display_name"] as string) ?? (m["full_name"] as string) ?? null,
          provider: (u.app_metadata?.["provider"] as string) ?? "email",
          created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null, confirmed: !!u.email_confirmed_at,
        });
      }
      if (data.users.length < 200) break;
    }
    return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  });
