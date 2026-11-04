
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save, Check, BookOpen, RefreshCw } from "lucide-react";
import cover from "@/assets/book-cover.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Bar } from "@/components/ProgressRing";
import { meQuery, useGroup, useToday } from "@/hooks/use-habits";
import { useBookProgress, useSaveBookProgress } from "@/hooks/use-book";
import { BOOK, BOOK_SECTIONS, bookPercent, clampPage, currentChapter, chapterTitle, pagesReadToday, shouldRemindBookTask, groupBookStats, rankReaders } from "@/lib/book";

export const Route = createFileRoute("/_authenticated/book")({
  component: BookPage,
});

function BookPage() {
  const { data: me } = useQuery(meQuery);
  const group = useGroup();
  const progress = useBookProgress();
  const save = useSaveBookProgress(me?.id);
  const today = useToday();
  const [draft, setDraft] = useState<string | null>(null);
  const mine = progress.data?.find((row) => row.user_id === me?.id);
  const page = mine?.current_page ?? 0;
  const chapter = currentChapter(page);
  const readToday = pagesReadToday(mine, today);
  const stats = groupBookStats(progress.data ?? []);
  const ranked = rankReaders(group.data?.profiles ?? [], progress.data ?? []);
  const busy = progress.isLoading || save.isPending || !me;

  return (
    <div>
      <header className="relative overflow-hidden rounded-b-[2rem] bg-gradient-hero px-5 pb-7 pt-8 text-primary-foreground">
        <div className="bg-pattern absolute inset-0 opacity-40" />
        <div className="relative">
          <p className="mb-5 flex items-center gap-2 text-sm opacity-80"><BookOpen className="size-4" /> Книга группы</p>
          <img src={cover} alt={`Обложка: ${BOOK.title}`} width={405} height={600} className="mx-auto mb-5 h-auto w-36 rounded-lg shadow-elegant" />
          <h1 className="font-display text-2xl font-bold leading-tight">{BOOK.title}</h1>
          <p className="mt-2 text-base leading-snug text-gold">{BOOK.subtitle}</p>
          <p className="mt-4 font-semibold">{BOOK.author}</p>
          <div className="mt-1 space-y-1 text-sm opacity-80">
            <p>Перевод: {BOOK.translator}</p><p>{BOOK.city_year} · {BOOK.totalPages} страниц</p>
          </div>
          <Button asChild variant="gold" size="xl" className="mt-5 w-full">
            <Link to="/reader">Читать</Link>
          </Button>
        </div>
      </header>

      <div className="space-y-7 px-4 pt-6">
        <section aria-labelledby="my-book-progress">
          <h2 id="my-book-progress" className="font-display text-xl font-bold">Мой прогресс</h2>
          {progress.isError ? <div className="mt-3 text-sm"><p>Не удалось загрузить прогресс чтения.</p><Button variant="outline" className="mt-2" onClick={() => progress.refetch()}><RefreshCw /> Повторить</Button></div> : <>
            <form className="mt-4" onSubmit={(event) => {
              event.preventDefault();
              const next = clampPage(Number(draft ?? page));
              setDraft(String(next));
              save.mutate(next, { onSuccess: () => setDraft(null) });
            }}>
              <label htmlFor="book-page" className="text-sm font-medium">Текущая страница</label>
              <div className="mt-2 flex items-center gap-3">
                <Input id="book-page" type="number" inputMode="numeric" min={0} max={BOOK.totalPages} step={1} className="h-12 min-w-0 flex-1 bg-card text-base" value={draft ?? String(page)} disabled={busy}
                  onChange={(event) => setDraft(event.target.value === "" ? "" : String(clampPage(Number(event.target.value))))}
                  onBlur={() => setDraft(String(clampPage(Number(draft ?? page))))} />
                <Button type="submit" variant="hero" size="xl" className="shrink-0 px-4" disabled={busy}><Save /> {save.isPending ? "Сохраняем…" : "Сохранить"}</Button>
              </div>
            </form>
            <div className="mt-4 flex items-baseline justify-between"><span className="text-sm text-muted-foreground">{page} / {BOOK.totalPages} стр.</span><span className="text-xl font-bold text-primary">{bookPercent(page)}%</span></div>
            <Bar value={bookPercent(page)} className="mt-2" />
            <p className="mt-4 text-sm leading-relaxed">{chapter ? <>Сейчас вы читаете: <span className="font-semibold">{chapter[0]} — {chapterTitle(chapter)}</span></> : "Ещё не начато"}</p>
            <p className="mt-3 text-sm font-semibold text-primary">Сегодня прочитано: {readToday} стр.</p>
            {shouldRemindBookTask(readToday) && <div className="mt-3 rounded-xl bg-gold-soft p-3 text-sm leading-relaxed text-gold-foreground">Вы прочитали 10+ страниц сегодня — не забудьте отметить «Чтение книги» на странице «Сегодня»<Button asChild variant="link" className="mt-1 h-10 px-0"><Link to="/today">Перейти к «Сегодня»</Link></Button></div>}
          </>}
        </section>

        <section aria-labelledby="group-book-progress">
          <h2 id="group-book-progress" className="font-display text-xl font-bold">Прогресс группы</h2>
          <div className="mb-4 mt-3 flex items-center justify-between text-sm"><span className="text-muted-foreground">Читателей: {stats.readers}</span><span className="font-bold text-primary">В среднем {stats.percent}%</span></div>
          {group.isError && <Button variant="outline" onClick={() => group.refetch()}><RefreshCw /> Обновить участников</Button>}
          <ol className="space-y-2">
            {ranked.map((reader, index) => {
              const current = currentChapter(reader.page);
              const isMe = reader.id === me?.id;
              return <li key={reader.id} className={`flex items-start gap-2.5 rounded-xl border p-3 ${isMe ? "border-gold/60 bg-gradient-done" : "bg-card"}`}>
                <span className="w-6 shrink-0 pt-1 text-center text-lg">{["🥇", "🥈", "🥉"][index] ?? index + 1}</span>
                <span className="shrink-0 pt-1 text-xl">{reader.avatar_emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold">{reader.display_name}{isMe && <span className="ml-2 text-xs text-primary">Вы</span>}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{reader.page} / {BOOK.totalPages} стр. · {bookPercent(reader.page)}%</p>
                  <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{current?.[2] ?? "Ещё не начато"}</p>
                </div>
              </li>;
            })}
          </ol>
        </section>

        <section aria-labelledby="book-contents">
          <h2 id="book-contents" className="font-display text-xl font-bold">Содержание</h2>
          <Accordion type="multiple" defaultValue={chapter ? [chapter[0]] : BOOK_SECTIONS.slice(0, 1)} className="mt-2">
            {BOOK_SECTIONS.map((section) => <AccordionItem value={section} key={section}>
              <AccordionTrigger className="gap-3 text-base font-semibold"><span className="min-w-0 leading-snug">{section}</span></AccordionTrigger>
              <AccordionContent className="space-y-1">
                {BOOK.chapters.filter((item) => item[0] === section).map((item) => {
                  const active = item[3] === chapter?.[3];
                  const passed = !!chapter && item[3] < chapter[3];
                  return <div key={item[3]} aria-current={active ? "location" : undefined} className={`flex items-start gap-2 rounded-lg px-2 py-3 ${active ? "bg-secondary font-semibold text-primary" : ""}`}>
                    <span className="mt-0.5 w-4 shrink-0 text-primary">{passed && <Check className="size-4" aria-label="Пройдено" />}</span>
                    <span className="min-w-0 flex-1 break-words leading-relaxed">{chapterTitle(item)}</span>
                    <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">{item[3]}</span>
                  </div>;
                })}
              </AccordionContent>
            </AccordionItem>)}
          </Accordion>
        </section>
      </div>
    </div>
  );
}

