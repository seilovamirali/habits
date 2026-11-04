import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorText, useHabits } from "@/hooks/use-habits";
import { activeTasks, type TaskDef } from "@/lib/habits";
import { newHabitKey } from "@/lib/jawshan";

export const Route = createFileRoute("/_authenticated/manage")({
  component: ManagePage,
});

const EMOJIS = ["✨", "📖", "🤲", "📿", "📚", "💪", "🌙", "⭐", "🕌", "🌿", "💧", "🏃", "✍️", "🇬🇧", "🇪🇸"];

interface Draft {
  key: string | null;
  title: string;
  description: string;
  emoji: string;
  kind: "daily" | "weekly";
  target: string;
  points: string;
}

const emptyDraft = (): Draft => ({
  key: null,
  title: "",
  description: "",
  emoji: "✨",
  kind: "daily",
  target: "1",
  points: "10",
});

function ManagePage() {
  const habitsQ = useHabits();
  const qc = useQueryClient();
  const tasks = habitsQ.data ?? [];
  const active = activeTasks(tasks);
  const archived = tasks.filter((task) => task.archived).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!draft) return;
    const title = draft.title.trim();
    const points = Number(draft.points);
    const target = Number(draft.target);
    if (!title) {
      toast.error("Введите название");
      return;
    }
    if (!Number.isInteger(points) || points < 1 || points > 1000) {
      toast.error("Очки — целое число от 1 до 1000");
      return;
    }
    if (draft.kind === "weekly" && (!Number.isInteger(target) || target < 1 || target > 14)) {
      toast.error("Сколько раз в неделю: от 1 до 14");
      return;
    }
    const payload = {
      title,
      description: draft.description.trim(),
      emoji: draft.emoji.trim() || "✨",
      kind: draft.kind,
      weekly_target: draft.kind === "weekly" ? target : null,
      points,
    };
    setBusy(true);
    const result = draft.key
      ? await supabase.from("habits").update(payload).eq("key", draft.key)
      : await supabase.from("habits").insert({
          ...payload,
          key: newHabitKey(),
          sort_order: Math.max(0, ...tasks.map((task) => task.sortOrder ?? 0)) + 10,
        });
    setBusy(false);
    if (result.error) {
      toast.error(errorText(result.error) || "Не удалось сохранить привычку");
      return;
    }
    toast.success(draft.key ? "Привычка обновлена" : "Привычка добавлена");
    setDraft(null);
    await qc.invalidateQueries({ queryKey: ["habits"] });
  };

  const patch = async (key: string, values: { archived?: boolean; sort_order?: number }) => {
    const { error } = await supabase.from("habits").update(values).eq("key", key);
    if (error) toast.error(errorText(error) || "Не удалось изменить привычку");
    await qc.invalidateQueries({ queryKey: ["habits"] });
  };

  const move = async (key: string, direction: -1 | 1) => {
    const index = active.findIndex((task) => task.key === key);
    const next = index + direction;
    const current = active[index];
    if (!current || next < 0 || next >= active.length) return;
    const copy = active.slice();
    copy.splice(index, 1);
    copy.splice(next, 0, current);
    setBusy(true);
    const results = await Promise.all(copy.map((task, order) => supabase.from("habits").update({ sort_order: (order + 1) * 10 }).eq("key", task.key)));
    setBusy(false);
    const failed = results.find((result) => result.error);
    if (failed?.error) toast.error(errorText(failed.error) || "Не удалось изменить порядок");
    await qc.invalidateQueries({ queryKey: ["habits"] });
  };

  return (
    <div className="space-y-5 px-4 pb-6 pt-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Привычки</h1>
        <p className="mt-1 text-sm text-muted-foreground">Общий список группы. Любой участник может добавить, изменить, переставить или убрать в архив. Удалять совсем нельзя: старые отметки остаются.</p>
      </header>

      {habitsQ.isError && (
        <Button variant="outline" onClick={() => habitsQ.refetch()}>Не удалось загрузить. Повторить</Button>
      )}

      <section className="space-y-2">
        {active.map((task, index) => (
          <article key={task.key} className="rounded-2xl border bg-card p-3 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-2xl">{task.emoji}</span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{task.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {task.kind === "daily" ? "Каждый день" : `${task.target}× в неделю`} · +{task.points}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" disabled={busy || index === 0} onClick={() => move(task.key, -1)}>Выше</Button>
              <Button variant="outline" size="sm" className="rounded-xl" disabled={busy || index === active.length - 1} onClick={() => move(task.key, 1)}>Ниже</Button>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setDraft(draftFrom(task))}>Изменить</Button>
              <Button variant="undo" size="sm" className="rounded-xl" onClick={() => patch(task.key, { archived: true })}>В архив</Button>
            </div>
          </article>
        ))}
      </section>

      {draft ? (
        <form className="space-y-3 rounded-3xl border bg-card p-4 shadow-card" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <h2 className="font-display text-xl font-bold">{draft.key ? "Изменить" : "Новая привычка"}</h2>
          <label className="block text-sm font-medium">Название
            <Input value={draft.title} maxLength={80} className="mt-1 h-12 rounded-xl" onChange={(event) => setDraft({ ...draft, title: event.target.value })} required />
          </label>
          <label className="block text-sm font-medium">Пояснение
            <Input value={draft.description} maxLength={200} className="mt-1 h-12 rounded-xl" onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </label>
          <div>
            <p className="text-sm font-medium">Значок</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {EMOJIS.map((emoji) => (
                <button key={emoji} type="button" className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl ${draft.emoji === emoji ? "bg-gold-soft ring-2 ring-gold" : "bg-muted"}`} onClick={() => setDraft({ ...draft, emoji })}>{emoji}</button>
              ))}
            </div>
            <Input value={draft.emoji} maxLength={8} className="mt-2 h-12 rounded-xl" onChange={(event) => setDraft({ ...draft, emoji: event.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
            {(["daily", "weekly"] as const).map((kind) => (
              <button key={kind} type="button" className={`h-11 rounded-xl text-sm font-semibold ${draft.kind === kind ? "bg-card text-primary shadow-card" : "text-muted-foreground"}`} onClick={() => setDraft({ ...draft, kind })}>
                {kind === "daily" ? "Каждый день" : "Каждую неделю"}
              </button>
            ))}
          </div>
          {draft.kind === "weekly" && (
            <label className="block text-sm font-medium">Сколько раз в неделю
              <Input type="number" inputMode="numeric" min={1} max={14} value={draft.target} className="mt-1 h-12 rounded-xl" onChange={(event) => setDraft({ ...draft, target: event.target.value })} />
            </label>
          )}
          <label className="block text-sm font-medium">Очки
            <Input type="number" inputMode="numeric" min={1} max={1000} value={draft.points} className="mt-1 h-12 rounded-xl" onChange={(event) => setDraft({ ...draft, points: event.target.value })} />
          </label>
          <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить"}</Button>
          <Button type="button" variant="outline" size="xl" className="w-full" onClick={() => setDraft(null)}>Отмена</Button>
        </form>
      ) : (
        <Button variant="gold" size="xl" className="w-full" onClick={() => setDraft(emptyDraft())}>Новая привычка</Button>
      )}

      {archived.length > 0 && (
        <section>
          <h2 className="font-display mb-3 text-xl font-bold">Архив</h2>
          <ul className="space-y-2">
            {archived.map((task) => (
              <li key={task.key} className="flex items-center gap-3 rounded-2xl border bg-muted/50 p-3">
                <span className="text-2xl grayscale">{task.emoji}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => patch(task.key, { archived: false })}>Вернуть</Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function draftFrom(task: TaskDef): Draft {
  return {
    key: task.key,
    title: task.title,
    description: task.description,
    emoji: task.emoji,
    kind: task.kind,
    target: String(task.target),
    points: String(task.points),
  };
}
