
import { useEffect, useState } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { almatyToday, TASK_MAP, type Completion, type TaskKey } from "@/lib/habits";

export interface Profile {
  id: string;
  display_name: string;
  avatar_emoji: string;
  created_at: string;
}

export interface GroupData {
  profiles: Profile[];
  completions: Completion[];
}

async function fetchAllCompletions(): Promise<Completion[]> {
  const out: Completion[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("completions")
      .select("id,user_id,task_key,completed_on")
      .order("completed_on", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return out;
}

export const groupQuery = queryOptions({
  queryKey: ["group"],
  queryFn: async (): Promise<GroupData> => {
    const [p, completions] = await Promise.all([
      supabase.from("profiles").select("id,display_name,avatar_emoji,created_at").order("created_at"),
      fetchAllCompletions(),
    ]);
    if (p.error) throw p.error;
    return { profiles: p.data ?? [], completions };
  },
  staleTime: 15_000,
  refetchOnWindowFocus: true,
  refetchInterval: 30_000,
});

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },
  staleTime: Infinity,
});

export function useGroup() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`group-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "completions" }, () => {
        qc.invalidateQueries({ queryKey: ["group"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        qc.invalidateQueries({ queryKey: ["group"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
  return useQuery(groupQuery);
}

/** Today's Almaty date, refreshed every minute so midnight rollovers apply. */
export function useToday() {
  const [today, setToday] = useState(() => almatyToday());
  useEffect(() => {
    const id = setInterval(() => setToday(almatyToday()), 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

export function useToggleTask(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, done }: { key: TaskKey; done: boolean }) => {
      if (!userId) throw new Error("no user");
      const today = almatyToday();
      if (done) {
        const { error } = await supabase
          .from("completions")
          .delete()
          .eq("user_id", userId)
          .eq("task_key", key)
          .eq("completed_on", today);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("completions").insert({ user_id: userId, task_key: key, completed_on: today });
        if (error) throw error;
      }
    },
    onMutate: async ({ key, done }) => {
      await qc.cancelQueries({ queryKey: ["group"] });
      const prev = qc.getQueryData<GroupData>(["group"]);
      const today = almatyToday();
      if (prev && userId) {
        qc.setQueryData<GroupData>(["group"], {
          ...prev,
          completions: done
            ? prev.completions.filter((c) => !(c.user_id === userId && c.task_key === key && c.completed_on === today))
            : [...prev.completions, { user_id: userId, task_key: key, completed_on: today }],
        });
      }
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["group"], ctx.prev);
      const msg = err instanceof Error ? err.message : "";
      toast.error(msg.includes("Недельная") || msg.includes("Можно") || msg.includes("Отменить") ? msg : "Не удалось сохранить. Попробуйте ещё раз.");
    },
    onSuccess: (_d, { key, done }) => {
      const t = TASK_MAP[key];
      if (done) toast(`${t.title}: отметка отменена`);
      else toast.success(`${t.emoji} ${t.title} — +${t.points} очков!`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["group"] }),
  });
}


