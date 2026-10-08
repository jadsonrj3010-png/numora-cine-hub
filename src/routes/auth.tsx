import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/AppHeader";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — NUMORA CINE" },
      { name: "description", content: "Entre ou crie sua conta no NUMORA CINE." },
      { property: "og:title", content: "Entrar — NUMORA CINE" },
      { property: "og:description", content: "Entre ou crie sua conta no NUMORA CINE." },
    ],
  }),
  component: AuthPage,
});

const creds = z.object({ email: z.string().trim().email("E-mail inválido"), password: z.string().min(6, "A senha precisa de 6+ caracteres") });

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => { if (user) navigate({ to: "/", replace: true }); }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast.success("Enviamos um link de recuperação para seu e-mail.");
        setMode("login");
        return;
      }
      const parsed = creds.safeParse({ email, password });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email, password: parsed.data.password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name.trim() || undefined } },
        });
        if (error) throw error;
        toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw new Error("E-mail ou senha incorretos");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) toast.error("Não foi possível entrar com Google");
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center text-2xl"><Logo /></div>
        <h1 className="text-2xl font-extrabold">{mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha"}</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5"><Label htmlFor="name">Nome</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></div>
          )}
          <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {mode !== "forgot" && (
            <div className="space-y-1.5"><Label htmlFor="pw">Senha</Label><Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          )}
          <Button type="submit" disabled={busy} className="w-full rounded-full font-bold" size="lg">
            {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
          </Button>
        </form>
        {mode !== "forgot" && (
          <Button variant="secondary" size="lg" className="mt-3 w-full rounded-full" onClick={google}>Continuar com Google</Button>
        )}
        <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
          {mode === "login" && (
            <>
              <button className="block w-full hover:text-foreground" onClick={() => setMode("forgot")}>Esqueci minha senha</button>
              <p>Novo por aqui? <button className="font-semibold text-primary" onClick={() => setMode("signup")}>Criar conta</button></p>
            </>
          )}
          {mode !== "login" && <button className="font-semibold text-primary" onClick={() => setMode("login")}>Voltar para entrar</button>}
        </div>
      </div>
    </div>
  );
}
