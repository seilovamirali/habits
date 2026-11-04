
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { almatyToday } from "@/lib/habits";

export interface DailyReminder {
  id: string;
  date: string;
  kind: string;
  arabic: string | null;
  text_ru: string;
  source: string;
  lesson_ru: string | null;
}

export interface PersonalMessage {
  id: string;
  user_id: string;
  date: string;
  text_ru: string;
  read_at: string | null;
}

/** Latest reminder with date <= today (Almaty), or null when there is none. */
export function useTodayReminder(today: string) {
  return useQuery({
    queryKey: ["today-reminder", today],
    queryFn: async (): Promise<DailyReminder | null> => {
      const { data, error } = await supabase
        .from("daily_reminders")
        .select("id,date,kind,arabic,text_ru,source,lesson_ru")
        .lte("date", today)
        .order("date", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    staleTime: 60_000,
  });
}

/** Unread personal messages for the current user, dated today (Almaty). */
export function useUnreadMessages(userId: string | undefined, today: string) {
  return useQuery({
    queryKey: ["unread-messages", userId, today],
    enabled: !!userId,
    queryFn: async (): Promise<PersonalMessage[]> => {
      const { data, error } = await supabase
        .from("personal_messages")
        .select("id,user_id,date,text_ru,read_at")
        .eq("user_id", userId!)
        .eq("date", today)
        .is("read_at", null)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

/** Marks one message as read (read_at = now) with an optimistic removal from the list. */
export function useMarkMessageRead(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("personal_messages").update({ read_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      const today = almatyToday();
      const key = ["unread-messages", userId, today];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PersonalMessage[]>(key);
      if (prev) qc.setQueryData<PersonalMessage[]>(key, prev.filter((m) => m.id !== id));
      return { key, prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
      toast.error("Не удалось отметить прочитанным. Попробуйте ещё раз.");
    },
    onSuccess: () => toast.success("Прочитано ✓"),
    onSettled: (_d, _e, id) => qc.invalidateQueries({ queryKey: ["unread-messages"] }),
  });
}


