
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        if (!name.trim()) { toast.error("Введите имя"); return; }
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href,
          },
        });
        if (error) throw error;
        if (!data.session) { toast.success("Проверьте почту для подтверждения"); return; }
        toast.success("Добро пожаловать в группу!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      qc.clear();
      navigate({ to: "/today", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Invalid login")) toast.error("Неверный email или пароль");
      else if (msg.includes("already registered")) toast.error("Этот email уже зарегистрирован");
      else if (msg.toLowerCase().includes("password")) toast.error("Пароль должен быть не короче 6 символов");
      else toast.error("Ошибка: " + msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-hero px-4 py-10 text-primary-foreground">
      <div className="bg-pattern absolute inset-0 opacity-50" />
      <div className="relative mx-auto max-w-sm">
        <div className="text-center">
          <span className="text-5xl">🌙</span>
          <h1 className="font-display mt-2 text-4xl font-bold">Habits</h1>
          <p className="mt-1 text-sm opacity-80">Вместе — к лучшим привычкам</p>
        </div>
        <div className="mt-8 rounded-3xl bg-card p-5 text-card-foreground shadow-elegant">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
            {(["in", "up"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`h-11 rounded-xl text-sm font-semibold transition-all ${mode === m ? "bg-card text-primary shadow-card" : "text-muted-foreground"}`}>
                {m === "in" ? "Вход" : "Регистрация"}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="mt-5 space-y-3">
            {mode === "up" && (
              <Field label="Имя"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-12 rounded-xl" required /></Field>
            )}
            <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" required autoComplete="email" /></Field>
            <Field label="Пароль"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} className="h-12 rounded-xl" required autoComplete={mode === "in" ? "current-password" : "new-password"} /></Field>
            <Button type="submit" variant="gold" size="xl" className="w-full" disabled={busy}>
              {busy ? "Подождите…" : mode === "in" ? "Войти" : "Зарегистрироваться"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}


