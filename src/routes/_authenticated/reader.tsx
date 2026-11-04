import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { meQuery } from "@/hooks/use-habits";
import { useBookProgress, useSaveBookProgress } from "@/hooks/use-book";
import { BOOK, clampPage } from "@/lib/book";
import { CHAPTER_SECTIONS, CHAPTERS, chapterAt, chapterLabel } from "@/lib/chapters";
import { supabase } from "@/integrations/supabase/client";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

export const Route = createFileRoute("/_authenticated/reader")({
  component: ReaderPage,
});

type PdfModules = Pick<typeof import("react-pdf"), "Document" | "Page">;

function ReaderPage() {
  const { data: me, isLoading: meLoading } = useQuery(meQuery);
  const progress = useBookProgress();
  const save = useSaveBookProgress(me?.id);
  const mine = progress.data?.find((row) => row.user_id === me?.id);
  const [page, setPage] = useState<number | null>(null);
  const [numPages, setNumPages] = useState<number>(BOOK.totalPages);
  const [width, setWidth] = useState(360);
  const [pdf, setPdf] = useState<PdfModules | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  const signed = useQuery({
    queryKey: ["book-pdf-url", me?.id],
    enabled: !!me?.id,
    staleTime: 50 * 60 * 1000,
    refetchInterval: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("book").createSignedUrl("gulen-glubina.pdf", 3600);
      if (error || !data.signedUrl) throw error ?? new Error("Не удалось получить ссылку на книгу");
      return data.signedUrl;
    },
  });

  useEffect(() => {
    if (opened.current || progress.isLoading || meLoading) return;
    const saved = mine?.current_page ?? 0;
    setPage(saved > 0 ? saved : 1);
    opened.current = true;
  }, [meLoading, mine?.current_page, progress.isLoading]);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(280, el.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void import("react-pdf").then((mod) => {
      mod.pdfjs.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.js`;
      if (!cancelled) setPdf({ Document: mod.Document, Page: mod.Page });
    }).catch(() => {
      if (!cancelled) setPdfError("Не удалось загрузить читалку");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = page ?? 1;
  const chapter = chapterAt(current);
  const maxPage = Math.max(1, numPages);

  const go = (next: number) => {
    if (!Number.isFinite(next)) return;
    setPage(Math.min(maxPage, Math.max(1, Math.trunc(next))));
  };

  const Document = pdf?.Document;
  const PdfPage = pdf?.Page;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="shrink-0 rounded-xl">
            <Link to="/book">← Книга</Link>
          </Button>
          <h1 className="font-display min-w-0 flex-1 truncate text-center text-sm font-bold">{BOOK.title}</h1>
          <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{current}/{maxPage}</span>
        </div>
        <label className="mt-2 block">
          <span className="sr-only">Глава</span>
          <select
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            value={chapter ? String(chapter.page) : ""}
            onChange={(event) => go(Number(event.target.value))}
          >
            {CHAPTER_SECTIONS.map((section) => (
              <optgroup key={section} label={section}>
                {CHAPTERS.filter((item) => item.section === section).map((item) => (
                  <option key={`${item.page}-${item.title}`} value={item.page}>
                    {chapterLabel(item)} · стр. {item.page}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </header>

      <div ref={frame} className="flex flex-1 justify-center px-2 py-3">
        {signed.isError || pdfError ? (
          <div className="max-w-sm px-4 pt-10 text-center">
            <p className="text-sm">{pdfError ?? "Не удалось открыть книгу. Проверьте, что вы вошли в аккаунт."}</p>
            <Button variant="outline" className="mt-3" onClick={() => signed.refetch()}>Повторить</Button>
          </div>
        ) : !signed.data || !Document || !PdfPage || page === null ? (
          <p className="pt-10 text-sm text-muted-foreground">Загрузка книги…</p>
        ) : (
          <Document
            file={signed.data}
            onLoadSuccess={(doc) => setNumPages(doc.numPages)}
            onLoadError={() => setPdfError("Не удалось открыть PDF")}
            loading={<p className="pt-10 text-sm text-muted-foreground">Загрузка книги…</p>}
            error={<p className="pt-10 text-sm">Не удалось открыть PDF</p>}
          >
            <PdfPage
              pageNumber={current}
              width={Math.min(width - 8, 860)}
              renderAnnotationLayer
              renderTextLayer
              loading={<p className="py-10 text-sm text-muted-foreground">Страница {current}…</p>}
            />
          </Document>
        )}
      </div>

      <div className="sticky bottom-0 z-30 border-t border-border bg-card/95 px-3 py-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <Button variant="outline" size="xl" className="px-3" disabled={current <= 1} onClick={() => go(current - 1)}>
            Назад
          </Button>
          <label className="flex items-center justify-center gap-2 text-sm">
            <span className="sr-only">Номер страницы</span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={maxPage}
              value={page ?? ""}
              className="h-12 w-20 rounded-xl text-center"
              onChange={(event) => {
                const next = Number(event.target.value);
                if (event.target.value !== "" && Number.isFinite(next)) go(next);
              }}
            />
            <span className="text-muted-foreground">/ {maxPage}</span>
          </label>
          <Button variant="outline" size="xl" className="px-3" disabled={current >= maxPage} onClick={() => go(current + 1)}>
            Дальше
          </Button>
        </div>
        <Button
          variant="gold"
          size="xl"
          className="mt-2 w-full"
          disabled={!me || save.isPending || page === null}
          onClick={() => page !== null && save.mutate(clampPage(page))}
        >
          {save.isPending ? "Сохраняем…" : `Сохранить: я на странице ${page ?? current}`}
        </Button>
      </div>
    </div>
  );
}
