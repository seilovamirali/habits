
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ProgressRing, Bar } from "@/components/ProgressRing";
import { Confetti } from "@/components/Confetti";
import { BookTeaser } from "@/components/BookTeaser";
import { meQuery, useGroup, useHabits, useToday, useToggleTask } from "@/hooks/use-habits";
import { useToggleJawshan, useJawshan } from "@/hooks/use-jawshan";
import { useMarkMessageRead, useTodayReminder, useUnreadMessages, type PersonalMessage, type DailyReminder } from "@/hooks/use-reminders";
import {
  ALL_TASKS, activeDaily, activeWeekly, computePoints, currentStreak, formatRuDate,
  levelInfo, weekStart, type TaskDef,
} from "@/lib/habits";
import { coveredParts } from "@/lib/jawshan";

export const Route = createFileRoute("/_authenticated/today")({
  component: TodayPage,
});

function TodayPage() {
  const { data: me } = useQuery(meQuery);
  const { data, isLoading } = useGroup();
  const habitsQ = useHabits();
  const today = useToday();
  const toggle = useToggleTask(me?.id);
  const jawshan = useJawshan(today);
  const markJawshan = useToggleJawshan(me?.id, today);
  const tasks = habitsQ.data ?? ALL_TASKS;
  const dailyTasks = activeDaily(tasks);
  const weeklyTasks = activeWeekly(tasks);
  const dailyCount = dailyTasks.length;

  const mine = useMemo(() => (data?.completions ?? []).filter((c) => c.user_id === me?.id), [data, me]);
  const jawshanDates = useMemo(
    () => (jawshan.data?.done ?? []).filter((row) => row.user_id === me?.id).map((row) => row.date),
    [jawshan.data, me?.id],
  );
  const profile = data?.profiles.find((p) => p.id === me?.id);
  const todaySet = new Set(mine.filter((c) => c.completed_on === today).map((c) => c.task_key));
  const doneDaily = dailyTasks.filter((t) => todaySet.has(t.key)).length;
  const pct = dailyCount === 0 ? 0 : Math.round((doneDaily / dailyCount) * 100);
  const points = computePoints(mine, "0000-01-01", "9999-12-31", tasks, jawshanDates);
  const lvl = levelInfo(points);
  const streak = currentStreak(mine, today, tasks);
  const ws = weekStart(today);
  const reminder = useTodayReminder(today);
  const unread = useUnreadMessages(me?.id, today);
  const markRead = useMarkMessageRead(me?.id);

  const [celebrate, setCelebrate] = useState(false);
  const prevDone = useRef<number | null>(null);
  useEffect(() => {
    if (isLoading) return;
    const prev = prevDone.current;
    prevDone.current = doneDaily;
    if (prev !== null && dailyCount > 0 && prev < dailyCount && doneDaily === dailyCount) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 3500);
    }
  }, [dailyCount, doneDaily, isLoading]);

  const onToggle = (t: TaskDef, done: boolean) => toggle.mutate({ key: t.key, done });

  return (
    <div>
      {celebrate && <Confetti />}
      <header className="relative overflow-hidden rounded-b-[2rem] bg-gradient-hero px-5 pb-6 pt-8 text-primary-foreground">
        <div className="bg-pattern absolute inset-0 opacity-60" />
        <div className="relative">
          <p className="text-sm capitalize opacity-80">{formatRuDate(today)}</p>
          <h1 className="font-display mt-1 text-2xl font-bold leading-tight">
            Ассаляму алейкум, {profile?.display_name ?? "…"}!
          </h1>
          <div className="mt-5 flex items-center gap-5">
            <ProgressRing value={pct} label={`${doneDaily}/${dailyCount}`} />
            <div className="flex-1 space-y-2.5">
              <Stat label="Серия" value={`🔥 ${streak}`} />
              <Stat label="Очки" value={`✨ ${points}`} />
              <div>
                <div className="flex justify-between text-xs opacity-90">
                  <span>Ур. {lvl.level} · {lvl.title}</span>
                  <span>{points}/{lvl.nextMin}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-primary-foreground/20">
                  <div className="h-full rounded-full bg-gradient-gold transition-all duration-700" style={{ width: `${lvl.progress}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-6 px-4 pt-5">
        {reminder.data && <ReminderCard reminder={reminder.data} />}
        {unread.data && unread.data.length > 0 && (
          <PersonalWords messages={unread.data} onRead={(id) => markRead.mutate(id)} busy={markRead.isPending} />
        )}

        {dailyCount > 0 && doneDaily === dailyCount && (
          <div className="animate-pop rounded-2xl bg-gradient-gold p-4 text-center font-semibold text-gold-foreground shadow-gold">
            Все задания на сегодня выполнены! МашаАллах 🎉
          </div>
        )}

        <JawshanToday
          data={jawshan.data}
          loading={jawshan.isLoading}
          error={jawshan.isError}
          userId={me?.id}
          today={today}
          busy={markJawshan.isPending || !me}
          onToggle={(done) => markJawshan.mutate(done)}
          onRetry={() => jawshan.refetch()}
        />

        <section>
          <h2 className="font-display mb-3 text-xl font-bold">Ежедневные задания</h2>
          <div className="space-y-3">
            {dailyTasks.map((t, i) => {
              const done = todaySet.has(t.key);
              if (t.key === "reading") {
                return (
                  <ReadingTaskCard
                    key={t.key}
                    task={t}
                    done={done}
                    index={i}
                    disabled={isLoading || !me}
                    onClick={() => onToggle(t, done)}
                  />
                );
              }
              return (
                <TaskCard key={t.key} task={t} done={done} index={i} disabled={isLoading || !me}
                  onClick={() => onToggle(t, done)} />
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="font-display mb-3 text-xl font-bold">На этой неделе</h2>
          <div className="space-y-3">
            {weeklyTasks.map((t) => {
              const weekCount = mine.filter((c) => c.task_key === t.key && c.completed_on >= ws && c.completed_on <= today).length;
              const doneToday = todaySet.has(t.key);
              const full = weekCount >= t.target;
              return (
                <div key={t.key} className={`rounded-2xl border p-4 shadow-card transition-all ${full ? "border-gold/60 bg-gradient-done" : "bg-card"}`}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-2xl">{t.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-semibold">{t.title}</h3>
                        <span className="text-sm font-bold text-primary">{weekCount}/{t.target}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{t.description} · +{t.points}</p>
                    </div>
                  </div>
                  <Bar value={(weekCount / t.target) * 100} className="mt-3" />
                  <div className="mt-3">
                    {doneToday ? (
                      <Button variant="undo" size="xl" className="w-full" onClick={() => onToggle(t, true)}>Отменить</Button>
                    ) : (
                      <Button variant={full ? "undo" : "hero"} size="xl" className="w-full" disabled={full || isLoading}
                        onClick={() => onToggle(t, false)}>
                        {full ? "Цель недели достигнута ✓" : "Выполнено"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <BookTeaser userId={me?.id} />
      </div>
    </div>
  );
}

function JawshanToday({ data, loading, error, userId, today, busy, onToggle, onRetry }: {
  data: { assignments: { date: string; user_id: string; part_from: number; part_to: number }[]; done: { date: string; user_id: string }[] } | undefined;
  loading: boolean;
  error: boolean;
  userId: string | undefined;
  today: string;
  busy: boolean;
  onToggle: (done: boolean) => void;
  onRetry: () => void;
}) {
  const mine = data?.assignments.find((row) => row.date === today && row.user_id === userId);
  const done = !!data?.done.some((row) => row.date === today && row.user_id === userId);
  const covered = data ? coveredParts(data.assignments, data.done, today) : 0;
  return (
    <section className="rounded-2xl border border-gold/40 bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold leading-snug">
            {mine ? `Джевшен: ваши части ${mine.part_from}–${mine.part_to}` : "Джевшен"}
          </h2>
          {(loading || error || !mine) && (
            <p className="mt-1 text-sm">
              {loading ? "Считаем доли на сегодня…" : error ? "Не удалось распределить Джевшен." : "Сегодня вам не досталась доля."}
            </p>
          )}
        </div>
        <span className="text-3xl" aria-hidden>📿</span>
      </div>
      {!error && <p className="mt-2 text-sm text-muted-foreground">Группа прочитала {covered}/100 · +10 очков за свою долю</p>}
      <Bar value={covered} className="mt-2" />
      <div className="mt-3 grid grid-cols-1 gap-2">
        {error ? (
          <Button variant="outline" size="xl" onClick={onRetry}>Повторить</Button>
        ) : mine ? (
          done ? (
            <Button variant="undo" size="xl" disabled={busy} onClick={() => onToggle(true)}>Отменить</Button>
          ) : (
            <Button variant="hero" size="xl" disabled={busy || loading} onClick={() => onToggle(false)}>Моя доля прочитана</Button>
          )
        ) : null}
        <Button asChild variant="link" className="h-10 px-0">
          <Link to="/jawshan">Прогресс группы</Link>
        </Button>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-primary-foreground/10 px-3 py-1.5">
      <span className="text-xs opacity-80">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function ReadingTaskCard({ task, done, index, disabled, onClick }: { task: TaskDef; done: boolean; index: number; disabled: boolean; onClick: () => void }) {
  return (
    <div
      className={`animate-fade-up rounded-2xl border p-3.5 shadow-card transition-all duration-300 ${done ? "border-gold/60 bg-gradient-done" : "bg-card"}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-center gap-3">
        <span className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${done ? "bg-primary" : "bg-secondary"}`}>
          {done ? <span className="animate-pop text-xl font-bold text-primary-foreground">✓</span> : task.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={`font-semibold ${done ? "text-primary" : ""}`}>{task.title}</h3>
          <p className="text-sm leading-snug text-muted-foreground">{task.description}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button asChild variant="gold" size="xl" className="px-2">
          <Link to="/reader">📖 Читать</Link>
        </Button>
        {done ? (
          <Button variant="undo" size="xl" className="px-2" onClick={onClick} disabled={disabled}>Отменить</Button>
        ) : (
          <Button variant="hero" size="xl" className="px-2" onClick={onClick} disabled={disabled}>Выполнено</Button>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, done, index, disabled, onClick }: { task: TaskDef; done: boolean; index: number; disabled: boolean; onClick: () => void }) {
  return (
    <div
      className={`animate-fade-up flex items-center gap-3 rounded-2xl border p-3.5 shadow-card transition-all duration-300 ${done ? "border-gold/60 bg-gradient-done" : "bg-card"}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <span className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${done ? "bg-primary" : "bg-secondary"}`}>
        {done ? <span className="animate-pop text-xl font-bold text-primary-foreground">✓</span> : task.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className={`font-semibold ${done ? "text-primary" : ""}`}>{task.title}</h3>
        <p className="text-sm leading-snug text-muted-foreground">{task.description}</p>
      </div>
      {done ? (
        <Button variant="undo" size="xl" className="px-4" onClick={onClick} disabled={disabled}>Отменить</Button>
      ) : (
        <Button variant="hero" size="xl" className="px-4" onClick={onClick} disabled={disabled}>Выполнено</Button>
      )}
    </div>
  );
}

function ReminderCard({ reminder }: { reminder: DailyReminder }) {
  return (
    <section className="animate-fade-up overflow-hidden rounded-2xl border border-gold/40 bg-card shadow-card">
      <div className="relative flex items-center gap-2 bg-gradient-hero px-4 py-2.5 text-primary-foreground">
        <div className="bg-pattern absolute inset-0 opacity-40" />
        <span className="relative text-lg">🌙</span>
        <h2 className="relative font-display text-sm font-bold tracking-wide">
          Напоминание дня · {reminder.kind === "ayah" ? "Аят" : "Хадис"}
        </h2>
      </div>
      <div className="space-y-3 p-4">
        {reminder.arabic && (
          <p dir="rtl" lang="ar" className="font-arabic text-right text-3xl leading-[2] text-primary">
            {reminder.arabic}
          </p>
        )}
        <p className="text-[15px] leading-relaxed">{reminder.text_ru}</p>
        <p className="text-xs text-muted-foreground">{reminder.source}</p>
        {reminder.lesson_ru && (
          <div className="rounded-xl bg-gold-soft/60 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gold-foreground">
              <span>💡</span> Урок
            </p>
            <p className="text-sm leading-relaxed text-foreground/90">{reminder.lesson_ru}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function PersonalWords({ messages, onRead, busy }: { messages: PersonalMessage[]; onRead: (id: string) => void; busy: boolean }) {
  return (
    <section className="animate-fade-up rounded-2xl border border-gold/40 bg-gradient-done p-4 shadow-card">
      <h2 className="font-display mb-1 flex items-center gap-2 text-base font-bold">
        <span>💌</span> Личное слово для вас
      </h2>
      <div className="mt-3 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className="rounded-xl bg-card p-3.5 shadow-card">
            <p className="text-[15px] leading-relaxed">{m.text_ru}</p>
            <Button variant="hero" size="xl" className="mt-3 w-full" disabled={busy} onClick={() => onRead(m.id)}>
              Прочитано
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}


