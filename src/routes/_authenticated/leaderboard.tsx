
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { meQuery, useGroup, useHabits, useToday } from "@/hooks/use-habits";
import { useJawshan } from "@/hooks/use-jawshan";
import { Bar } from "@/components/ProgressRing";
import {
  ALL_TASKS, activeDaily, completionPct, computePoints, currentStreak, periodRange, type Period,
} from "@/lib/habits";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
});

const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "all", label: "Всё время" },
];
const MEDALS = ["🥇", "🥈", "🥉"];

function LeaderboardPage() {
  const { data: me } = useQuery(meQuery);
  const { data, isLoading } = useGroup();
  const habitsQ = useHabits();
  const today = useToday();
  const jawshan = useJawshan(today);
  const tasks = habitsQ.data ?? ALL_TASKS;
  const dailyTasks = activeDaily(tasks);
  const [period, setPeriod] = useState<Period>("week");

  const rows = useMemo(() => {
    if (!data) return [];
    const dailyKeys = new Set(dailyTasks.map((task) => task.key));
    return data.profiles
      .map((p) => {
        const list = data.completions.filter((c) => c.user_id === p.id);
        const jawshanDates = (jawshan.data?.done ?? []).filter((row) => row.user_id === p.id).map((row) => row.date);
        const first = list[0]?.completed_on ?? p.created_at.slice(0, 10);
        const [from, to] = periodRange(period, today, first);
        const todayDone = new Set(list.filter((c) => c.completed_on === today && dailyKeys.has(c.task_key)).map((c) => c.task_key));
        return {
          ...p,
          points: computePoints(list, from, to, tasks, jawshanDates),
          pct: completionPct(list, from, to, tasks),
          streak: currentStreak(list, today, tasks),
          todayDone,
        };
      })
      .sort((a, b) => b.points - a.points || b.pct - a.pct);
  }, [dailyTasks, data, jawshan.data, period, tasks, today]);

  const podium = [rows[1], rows[0], rows[2]];

  return (
    <div className="px-4 pt-6">
      <h1 className="font-display text-3xl font-bold">Рейтинг</h1>

      <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`h-11 rounded-xl text-sm font-semibold transition-all ${period === p.key ? "bg-card text-primary shadow-card" : "text-muted-foreground"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-muted-foreground">Загрузка…</p>
      ) : (
        <>
          <div className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-hero px-3 pt-6 text-primary-foreground">
            <div className="bg-pattern absolute inset-0 opacity-50" />
            <div className="relative grid grid-cols-3 items-end gap-2">
              {podium.map((r, i) => {
                const place = i === 1 ? 0 : i === 0 ? 1 : 2;
                const h = ["h-28", "h-20", "h-14"][place];
                return (
                  <div key={i} className="flex flex-col items-center">
                    {r ? (
                      <>
                        <span className="text-3xl">{r.avatar_emoji}</span>
                        <span className="mt-1 w-full truncate text-center text-xs font-semibold">{r.display_name}</span>
                        <span className="text-xs opacity-80">{r.points} оч.</span>
                      </>
                    ) : <span className="text-xs opacity-50">—</span>}
                    <div className={`mt-2 flex w-full items-start justify-center rounded-t-xl pt-2 text-2xl ${h} ${place === 0 ? "bg-gradient-gold" : "bg-primary-foreground/15"}`}>
                      {MEDALS[place]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {rows.map((r, i) => {
              const isMe = r.id === me?.id;
              return (
                <li key={r.id} className={`flex items-center gap-3 rounded-2xl border p-3 shadow-card ${isMe ? "border-gold bg-gold-soft" : "bg-card"}`}>
                  <span className="w-7 text-center text-lg font-bold text-muted-foreground">{MEDALS[i] ?? i + 1}</span>
                  <span className="text-2xl">{r.avatar_emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {r.display_name} {isMe && <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Вы</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.pct}% · 🔥 {r.streak}</p>
                  </div>
                  <span className="font-display text-lg font-bold text-primary">{r.points}</span>
                </li>
              );
            })}
          </ul>

          <h2 className="font-display mb-3 mt-8 text-xl font-bold">Сегодня в группе</h2>
          <ul className="space-y-2 pb-4">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl border bg-card p-3 shadow-card">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{r.avatar_emoji}</span>
                  <span className="flex-1 truncate font-medium">{r.display_name}</span>
                  <span className="text-sm font-bold">{r.todayDone.size}/{dailyTasks.length}</span>
                </div>
                <Bar value={dailyTasks.length === 0 ? 0 : (r.todayDone.size / dailyTasks.length) * 100} className="mt-2" />
                <div className="mt-2 flex flex-wrap gap-1">
                  {dailyTasks.map((t) => (
                    <span key={t.key} title={t.title}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${r.todayDone.has(t.key) ? "bg-done" : "bg-muted opacity-40 grayscale"}`}>
                      {t.emoji}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}


