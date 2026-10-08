import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — NUMORA CINE" },
      { name: "description", content: "Defina uma nova senha para sua conta NUMORA CINE." },
      { property: "og:title", content: "Nova senha — NUMORA CINE" },
      { property: "og:description", content: "Defina uma nova senha para sua conta NUMORA CINE." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const submit = async (e: React.FormEvent): Promise<any> => {
    e.preventDefault();
    if (pw.length < 6) return toast.error("A senha precisa de 6+ caracteres");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error("Link inválido ou expirado. Solicite um novo.");
    toast.success("Senha atualizada!");
    navigate({ to: "/" });
  };
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-extrabold">Definir nova senha</h1>
        <div className="space-y-1.5"><Label htmlFor="pw">Nova senha</Label><Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Button type="submit" disabled={busy} className="w-full rounded-full font-bold" size="lg">Salvar</Button>
      </form>
    </div>
  );
}
