
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { meQuery, useGroup, useToday } from "@/hooks/use-habits";
import {
  DAILY_COUNT, addDays, bestStreak, computeBadges, computePoints, currentStreak, dailyByDay, levelInfo,
} from "@/lib/habits";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const EMOJIS = ["🙂", "😊", "🌙", "⭐", "🌿", "🦁", "🐎", "🦅", "🌸", "🌻", "📿", "🕌", "🧕", "🧔", "👦", "👧", "👨", "👩", "🐱", "🐻"];

function ProfilePage() {
  const { data: me } = useQuery(meQuery);
  const { data } = useGroup();
  const today = useToday();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const profile = data?.profiles.find((p) => p.id === me?.id);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🙂");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (profile) { setName(profile.display_name); setEmoji(profile.avatar_emoji); }
  }, [profile?.id, profile?.display_name, profile?.avatar_emoji]);

  const mine = useMemo(() => (data?.completions ?? []).filter((c) => c.user_id === me?.id), [data, me]);
  const points = computePoints(mine);
  const lvl = levelInfo(points);
  const badges = computeBadges(mine);
  const byDay = dailyByDay(mine);
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));

  const save = async () => {
    if (!me || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name.trim(), avatar_emoji: emoji }).eq("id", me.id);
    setSaving(false);
    if (error) toast.error("Не удалось сохранить профиль");
    else { toast.success("Профиль сохранён"); qc.invalidateQueries({ queryKey: ["group"] }); }
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="space-y-6 px-4 pt-6">
      <h1 className="font-display text-3xl font-bold">Профиль</h1>

      <section className="rounded-3xl border bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-soft text-4xl">{emoji}</span>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Имя</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-11 rounded-xl" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-10 gap-1">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setEmoji(e)}
              className={`flex aspect-square items-center justify-center rounded-lg text-xl transition-all ${emoji === e ? "bg-gold-soft ring-2 ring-gold" : "hover:bg-muted"}`}>
              {e}
            </button>
          ))}
        </div>
        <Button variant="hero" size="xl" className="mt-4 w-full" onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить"}
        </Button>
      </section>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground">
        <div className="bg-pattern absolute inset-0 opacity-50" />
        <div className="relative">
          <p className="text-sm opacity-80">Уровень {lvl.level}</p>
          <p className="font-display text-2xl font-bold">{lvl.title}</p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-primary-foreground/20">
            <div className="h-full rounded-full bg-gradient-gold" style={{ width: `${lvl.progress}%` }} />
          </div>
          <p className="mt-1 text-xs opacity-80">{points} / {lvl.nextMin} очков до следующего уровня</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Tile label="Всего очков" value={points} />
            <Tile label="Выполнено" value={mine.length} />
            <Tile label="Серия сейчас" value={`🔥 ${currentStreak(mine, today)}`} />
            <Tile label="Лучшая серия" value={`🏅 ${bestStreak(mine)}`} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display mb-3 text-xl font-bold">Последние 30 дней</h2>
        <div className="grid grid-cols-10 gap-1.5 rounded-3xl border bg-card p-3 shadow-card">
          {days.map((d) => {
            const n = byDay.get(d) ?? 0;
            const ratio = n / DAILY_COUNT;
            return (
              <div key={d} title={`${d}: ${n}/${DAILY_COUNT}`}
                className={`flex aspect-square items-center justify-center rounded-md text-[10px] font-semibold ${d === today ? "ring-2 ring-gold" : ""} ${ratio === 0 ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}
                style={ratio > 0 ? { opacity: 0.3 + ratio * 0.7 } : undefined}>
                {Number(d.slice(8))}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display mb-3 text-xl font-bold">Значки</h2>
        <div className="grid grid-cols-3 gap-2">
          {badges.map((b) => (
            <div key={b.key} className={`flex flex-col items-center rounded-2xl border p-3 text-center shadow-card ${b.earned ? "border-gold/60 bg-gradient-done" : "bg-muted opacity-50 grayscale"}`}>
              <span className="text-3xl">{b.emoji}</span>
              <span className="mt-1 text-xs font-bold leading-tight">{b.title}</span>
              <span className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{b.description}</span>
            </div>
          ))}
        </div>
      </section>

      <Button variant="outline" size="xl" className="mb-4 w-full" onClick={signOut}>Выйти</Button>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-primary-foreground/10 p-3">
      <p className="text-xs opacity-80">{label}</p>
      <p className="font-display text-xl font-bold">{value}</p>
    </div>
  );
}


