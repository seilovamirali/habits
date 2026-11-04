
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import cover from "@/assets/book-cover.jpg";
import { Button } from "@/components/ui/button";
import { useBookProgress } from "@/hooks/use-book";
import { BOOK, bookPercent } from "@/lib/book";

export function BookTeaser({ userId }: { userId: string | undefined }) {
  const { data } = useBookProgress();
  const page = data?.find((row) => row.user_id === userId)?.current_page ?? 0;
  return (
    <section className="flex items-center gap-4 rounded-2xl border border-gold/40 bg-card p-4 shadow-card">
      <img src={cover} alt={`Обложка: ${BOOK.title}`} width={405} height={600} className="h-auto w-16 shrink-0 rounded-lg shadow-elegant" />
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg font-bold">Книга группы</h2>
        <p className="mt-1 text-sm text-muted-foreground">Мой прогресс · <span className="font-bold text-primary">{bookPercent(page)}%</span></p>
        <Button asChild variant="link" className="mt-1 h-10 px-0"><Link to="/book">К книге <ArrowRight /></Link></Button>
      </div>
    </section>
  );
}

