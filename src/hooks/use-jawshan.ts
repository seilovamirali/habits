import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { JAWSHAN_POINTS } from "@/lib/habits";
import type { JawshanAssignment, JawshanDone } from "@/lib/jawshan";
import { errorText } from "@/hooks/use-habits";

export interface JawshanData {
  assignments: JawshanAssignment[];
  done: JawshanDone[];
}

async function loadJawshan(today: string): Promise<JawshanData> {
  const ensured = await supabase.rpc("ensure_jawshan_day", { p_date: today });
  if (ensured.error) throw ensured.error;
  const [assignments, done] = await Promise.all([
    supabase.from("jawshan_assignments").select("date,user_id,part_from,part_to").order("date").order("part_from"),
    supabase.from("jawshan_done").select("date,user_id").order("date"),
  ]);
  if (assignments.error) throw assignments.error;
  if (done.error) throw done.error;
  return { assignments: assignments.data ?? [], done: done.data ?? [] };
}

export function useJawshan(today: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`jawshan-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jawshan_assignments" }, () => {
        qc.invalidateQueries({ queryKey: ["jawshan"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "jawshan_done" }, () => {
        qc.invalidateQueries({ queryKey: ["jawshan"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
  return useQuery({
    queryKey: ["jawshan", today],
    queryFn: () => loadJawshan(today),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
}

export function useToggleJawshan(userId: string | undefined, today: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (done: boolean) => {
      if (!userId) throw new Error("Войдите, чтобы отметить Джевшен");
      if (done) {
        const { error } = await supabase.from("jawshan_done").delete().eq("user_id", userId).eq("date", today);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("jawshan_done").insert({ user_id: userId, date: today });
        if (error) throw error;
      }
    },
    onSuccess: (_data, done) => {
      toast.success(done ? "Отметка Джевшена снята" : `Доля прочитана — +${JAWSHAN_POINTS} очков`);
    },
    onError: (err) => {
      const msg = errorText(err);
      toast.error(msg || "Не удалось сохранить Джевшен");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jawshan"] }),
  });
}
