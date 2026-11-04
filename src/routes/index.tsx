
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DAILY_TASKS, WEEKLY_TASKS } from "@/lib/habits";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/today", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden rounded-b-[2.5rem] bg-gradient-hero px-5 pb-12 pt-14 text-primary-foreground">
        <div className="bg-pattern absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-lg text-center">
          <span className="text-6xl">🌙</span>
          <h1 className="font-display mt-3 text-5xl font-bold">Habits</h1>
          <p className="mx-auto mt-4 max-w-sm text-lg opacity-90">
            Маленькие ежедневные шаги — большие перемены. Отмечайте привычки вместе с семьёй и друзьями.
          </p>
          <Button asChild variant="gold" size="xl" className="mt-8 w-full max-w-xs">
            <Link to="/auth">Присоединиться к группе</Link>
          </Button>
        </div>
      </section>

      <div className="mx-auto max-w-lg space-y-6 px-5 py-8">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["✨", "Очки и уровни"], ["🔥", "Серии дней"], ["🏆", "Рейтинг группы"]].map(([e, t]) => (
            <div key={t} className="rounded-2xl border bg-card p-3 shadow-card">
              <div className="text-2xl">{e}</div>
              <div className="mt-1 text-xs font-semibold">{t}</div>
            </div>
          ))}
        </div>
        <div className="rounded-3xl border bg-card p-5 shadow-card">
          <h2 className="font-display text-xl font-bold">Каждый день</h2>
          <ul className="mt-3 space-y-2">
            {DAILY_TASKS.map((t) => (
              <li key={t.key} className="flex items-center gap-3 text-sm"><span className="text-xl">{t.emoji}</span><b>{t.title}</b><span className="text-muted-foreground">{t.description}</span></li>
            ))}
          </ul>
          <h2 className="font-display mt-5 text-xl font-bold">Каждую неделю</h2>
          <ul className="mt-3 space-y-2">
            {WEEKLY_TASKS.map((t) => (
              <li key={t.key} className="flex items-center gap-3 text-sm"><span className="text-xl">{t.emoji}</span><b>{t.title}</b><span className="text-muted-foreground">{t.description}</span></li>
            ))}
          </ul>
        </div>
        <p className="text-center text-sm text-muted-foreground">Пусть Аллах примет ваши старания 🤲</p>
      </div>
    </div>
  );
}


