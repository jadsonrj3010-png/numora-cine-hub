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
import { Film, Tv, Star, Zap } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "NUMORA CINE — Filmes, séries e animes online grátis" },
      { name: "description", content: "Assista filmes, séries, animes e documentários online grátis. Crie sua conta gratuita e comece agora." },
      { property: "og:title", content: "NUMORA CINE — Filmes, séries e animes online grátis" },
      { property: "og:description", content: "Assista filmes, séries, animes e documentários online grátis. Crie sua conta gratuita e comece agora." },
    ],
  }),
  component: AuthPage,
});

const creds = z.object({ email: z.string().trim().email("E-mail inválido"), password: z.string().min(6, "A senha precisa de 6+ caracteres") });

const FEATURES = [
  { icon: Film, title: "Filmes & Séries", desc: "Catálogo completo com os maiores lançamentos" },
  { icon: Tv, title: "Animes & Novelas", desc: "Os melhores títulos japoneses e nacionais" },
  { icon: Star, title: "Clássicos grátis", desc: "Filmes em domínio público sem custo algum" },
  { icon: Zap, title: "100% gratuito", desc: "Sem mensalidade, sem cartão de crédito" },
];

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
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "https://numora-cine-hub.vercel.app" } });
    if (error) toast.error("Não foi possível entrar com Google");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/10 to-background px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex justify-center"><Logo /></div>
          <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            Filmes, séries e animes<br />
            <span className="text-primary">online e grátis</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            O seu novo streaming gratuito. Assista ao melhor do cinema, séries, animes, novelas e documentários sem pagar nada.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-full bg-secondary px-3 py-1">🎬 Filmes</span>
            <span className="rounded-full bg-secondary px-3 py-1">📺 Séries</span>
            <span className="rounded-full bg-secondary px-3 py-1">⛩️ Animes</span>
            <span className="rounded-full bg-secondary px-3 py-1">🌟 Novelas</span>
            <span className="rounded-full bg-secondary px-3 py-1">🎭 Clássicos</span>
            <span className="rounded-full bg-secondary px-3 py-1">📽️ Documentários</span>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 px-4 py-10 sm:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-4 text-center">
            <f.icon className="mx-auto mb-2 h-7 w-7 text-primary" />
            <p className="font-semibold">{f.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Auth Form */}
      <div className="mx-auto max-w-sm px-4 pb-16">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
          <h2 className="mb-6 text-center text-xl font-extrabold">
            {mode === "login" ? "Entrar na sua conta" : mode === "signup" ? "Criar conta grátis" : "Recuperar senha"}
          </h2>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5"><Label htmlFor="name">Nome</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></div>
            )}
            <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            {mode !== "forgot" && (
              <div className="space-y-1.5"><Label htmlFor="pw">Senha</Label><Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            )}
            <Button type="submit" disabled={busy} className="w-full rounded-full font-bold" size="lg">
              {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta grátis" : "Enviar link"}
            </Button>
          </form>
          {mode !== "forgot" && (
            <>
              <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex-1 border-t border-border" />ou<div className="flex-1 border-t border-border" />
              </div>
              <Button variant="secondary" size="lg" className="w-full rounded-full" onClick={google}>
                Continuar com Google
              </Button>
            </>
          )}
          <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
            {mode === "login" && (
              <>
                <button className="block w-full hover:text-foreground" onClick={() => setMode("forgot")}>Esqueci minha senha</button>
                <p>Novo por aqui? <button className="font-semibold text-primary" onClick={() => setMode("signup")}>Criar conta grátis</button></p>
              </>
            )}
            {mode !== "login" && <button className="font-semibold text-primary" onClick={() => setMode("login")}>Voltar para entrar</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
