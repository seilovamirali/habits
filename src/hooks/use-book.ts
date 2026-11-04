
import { useEffect } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { clampPage, type BookProgress } from "@/lib/book";

export const bookProgressQuery = queryOptions({
  queryKey: ["book-progress"],
  queryFn: async (): Promise<BookProgress[]> => {
    const rows: BookProgress[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("book_progress").select("user_id,current_page,day_start_date,day_start_page,updated_at").order("user_id").range(from, from + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) return rows;
    }
  },
  staleTime: 15_000,
  refetchOnWindowFocus: true,
  refetchInterval: 30_000,
});

export function useBookProgress() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel(`book-progress-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "book_progress" }, () => {
        qc.invalidateQueries({ queryKey: ["book-progress"] });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
  return useQuery(bookProgressQuery);
}

export function useSaveBookProgress(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (page: number) => {
      if (!userId) throw new Error("Войдите, чтобы сохранить прогресс");
      const { data, error } = await supabase.from("book_progress")
        .upsert({ user_id: userId, current_page: clampPage(page) }, { onConflict: "user_id" })
        .select("user_id,current_page,day_start_date,day_start_page,updated_at").single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (row) => {
      qc.setQueryData<BookProgress[]>(["book-progress"], (rows = []) => [...rows.filter((p) => p.user_id !== row.user_id), row]);
      await qc.invalidateQueries({ queryKey: ["book-progress"] });
      toast.success("Прогресс чтения сохранён");
    },
    onError: () => toast.error("Не удалось сохранить прогресс. Попробуйте ещё раз."),
  });
}

