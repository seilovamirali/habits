import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Bar } from "@/components/ProgressRing";
import { meQuery, useGroup, useToday } from "@/hooks/use-habits";
import { useJawshan } from "@/hooks/use-jawshan";
import { closedJawshanDays, coveredParts, jawshanStreak } from "@/lib/jawshan";
import { formatRuDate } from "@/lib/habits";

export const Route = createFileRoute("/_authenticated/jawshan")({
  component: JawshanPage,
});

function JawshanPage() {
  const today = useToday();
  const { data: me } = useQuery(meQuery);
  const group = useGroup();
  const jawshan = useJawshan(today);
  const assignments = jawshan.data?.assignments ?? [];
  const dones = jawshan.data?.done ?? [];
  const todayRows = assignments.filter((row) => row.date === today).sort((a, b) => a.part_from - b.part_from);
  const doneToday = new Set(dones.filter((row) => row.date === today).map((row) => row.user_id));
  const covered = coveredParts(assignments, dones, today);
  const streak = jawshanStreak(closedJawshanDays(assignments, dones), today);
  const profiles = new Map((group.data?.profiles ?? []).map((profile) => [profile.id, profile]));
  const assigned = new Set(todayRows.map((row) => row.user_id));
  const waiting = (group.data?.profiles ?? []).filter((profile) => !assigned.has(profile.id));

  return (
    <div className="space-y-5 px-4 pb-4 pt-6">
      <header>
        <p className="text-sm capitalize text-muted-foreground">{formatRuDate(today)}</p>
        <h1 className="font-display text-3xl font-bold">Джевшен</h1>
        <p className="mt-1 text-sm text-muted-foreground">Джевшен аль-Кабир, 100 частей. Текст здесь не показывается — только доли группы.</p>
      </header>

      {jawshan.isError ? (
        <div>
          <p className="text-sm">Не удалось загрузить доли на сегодня.</p>
          <Button variant="outline" className="mt-2" onClick={() => jawshan.refetch()}>Повторить</Button>
        </div>
      ) : jawshan.isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : (
        <>
          <section className="rounded-3xl border bg-card p-4 shadow-card">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Прочитано сегодня</span>
              <span className="font-display text-2xl font-bold text-primary">{covered}/100</span>
            </div>
            <Bar value={covered} className="mt-2" />
            <p className="mt-3 text-sm font-semibold">Серия закрытых дней: {streak}</p>
          </section>

          {covered >= 100 && (
            <div className="animate-pop rounded-2xl bg-gradient-gold p-4 text-center font-semibold text-gold-foreground shadow-gold">
              Джевшен сегодня закрыт
            </div>
          )}

          <section>
            <h2 className="font-display mb-3 text-xl font-bold">Доли на сегодня</h2>
            <ul className="space-y-2">
              {todayRows.map((row) => {
                const profile = profiles.get(row.user_id);
                const done = doneToday.has(row.user_id);
                const isMe = row.user_id === me?.id;
                return (
                  <li key={row.user_id} className={`rounded-2xl border p-3 shadow-card ${isMe ? "border-gold/60 bg-gradient-done" : "bg-card"}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{profile?.avatar_emoji ?? "🙂"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {profile?.display_name ?? "Участник"}
                          {isMe && <span className="ml-2 text-xs text-primary">Вы</span>}
                        </p>
                        <p className="text-sm text-muted-foreground">части {row.part_from}–{row.part_to}</p>
                      </div>
                      <span className={`text-sm font-semibold ${done ? "text-primary" : "text-muted-foreground"}`}>
                        {done ? "Прочитано" : "Ещё нет"}
                      </span>
                    </div>
                  </li>
                );
              })}
              {waiting.map((profile) => (
                <li key={profile.id} className="rounded-2xl border bg-muted/40 p-3 text-sm text-muted-foreground">
                  <span className="mr-2">{profile.avatar_emoji}</span>
                  {profile.display_name}: сегодня без доли
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
