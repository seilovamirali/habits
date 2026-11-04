-- Jawshan (Джевшен аль-Кабир) and shared editable habits.
-- Idempotent: safe to run again on the live Habits database.
-- Does not drop tables, rows, or existing completions.
-- Run once in the Supabase SQL editor as an admin (postgres).
--
-- After it succeeds, check:
--   select count(*) from public.habits;                 -- 9 seeded rows
--   select key from public.habits order by sort_order;  -- the original 9 keys
--   select ensure_jawshan_day((now() at time zone 'Asia/Almaty')::date);
-- The split must cover parts 1–100 with no overlaps. Signing up later the same
-- day must not change those rows.

-- ---------------------------------------------------------------------------
-- Habits. completions.task_key will reference habits.key.
-- description is extra display copy (the cards already show it).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.habits (
  key text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  emoji text NOT NULL,
  kind text NOT NULL,
  weekly_target integer,
  points integer NOT NULL DEFAULT 10,
  sort_order integer NOT NULL DEFAULT 100,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT habits_key_check CHECK (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  CONSTRAINT habits_title_check CHECK (char_length(title) BETWEEN 1 AND 80),
  CONSTRAINT habits_description_check CHECK (char_length(description) <= 200),
  CONSTRAINT habits_emoji_check CHECK (char_length(emoji) BETWEEN 1 AND 8),
  CONSTRAINT habits_kind_check CHECK (kind = ANY (ARRAY['daily'::text, 'weekly'::text])),
  CONSTRAINT habits_points_check CHECK (points BETWEEN 1 AND 1000),
  CONSTRAINT habits_weekly_target_check CHECK (
    (kind = 'daily' AND weekly_target IS NULL)
    OR (kind = 'weekly' AND weekly_target BETWEEN 1 AND 14)
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'habits_created_by_fkey'
  ) THEN
    ALTER TABLE public.habits
      ADD CONSTRAINT habits_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Original nine habits. ON CONFLICT does nothing, so a later edit is kept.
INSERT INTO public.habits (key, title, description, emoji, kind, weekly_target, points, sort_order)
VALUES
  ('quran', 'Коран', '1 страница', '📖', 'daily', NULL, 10, 10),
  ('salawat', 'Салауат', '100 раз', '🤲', 'daily', NULL, 10, 20),
  ('istighfar', 'Истигфар', '100 раз', '📿', 'daily', NULL, 10, 30),
  ('reading', 'Чтение книги', '10 страниц или 30 минут аудиокниги', '📚', 'daily', NULL, 10, 40),
  ('sport', 'Спорт', 'Тренировка в зале или 10 000 шагов', '💪', 'daily', NULL, 10, 50),
  ('english', 'Английский', '30 минут', '🇬🇧', 'daily', NULL, 10, 60),
  ('spanish', 'Испанский', '10 минут', '🇪🇸', 'daily', NULL, 10, 70),
  ('fasting', 'Ораза', '1 раз в неделю', '🌙', 'weekly', 1, 30, 80),
  ('tahajjud', 'Тахаджуд', '2 раза в неделю', '⭐', 'weekly', 2, 20, 90)
ON CONFLICT (key) DO NOTHING;

-- Existing completions only use those nine keys, so this FK cannot fail on current data.
ALTER TABLE public.completions DROP CONSTRAINT IF EXISTS completions_task_key_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'completions_task_key_fkey'
  ) THEN
    ALTER TABLE public.completions
      ADD CONSTRAINT completions_task_key_fkey
      FOREIGN KEY (task_key) REFERENCES public.habits(key);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.habits_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.key IS DISTINCT FROM OLD.key THEN
    RAISE EXCEPTION 'Ключ привычки нельзя менять';
  END IF;
  IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS habits_guard ON public.habits;
CREATE TRIGGER habits_guard
  BEFORE INSERT OR UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.habits_guard();

-- Weekly cap now comes from habits.weekly_target. Archived habits cannot be marked.
CREATE OR REPLACE FUNCTION public.validate_completion_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  today date := (now() AT TIME ZONE 'Asia/Almaty')::date;
  wk date;
  cnt int;
  hab public.habits%ROWTYPE;
BEGIN
  IF NEW.completed_on <> today THEN
    RAISE EXCEPTION 'Можно отмечать только сегодняшний день';
  END IF;
  SELECT * INTO hab FROM public.habits WHERE key = NEW.task_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Неизвестная привычка';
  END IF;
  IF hab.archived THEN
    RAISE EXCEPTION 'Эта привычка в архиве';
  END IF;
  IF hab.kind = 'weekly' THEN
    wk := date_trunc('week', today)::date;
    SELECT count(*) INTO cnt FROM public.completions
      WHERE user_id = NEW.user_id
        AND task_key = NEW.task_key
        AND completed_on >= wk
        AND completed_on < wk + 7;
    IF cnt >= hab.weekly_target THEN
      RAISE EXCEPTION 'Недельная цель уже достигнута';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "habits read" ON public.habits;
CREATE POLICY "habits read" ON public.habits
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "habits insert" ON public.habits;
CREATE POLICY "habits insert" ON public.habits
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "habits update" ON public.habits;
CREATE POLICY "habits update" ON public.habits
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- No DELETE policy: archive instead of hard delete. Completions stay.

GRANT SELECT, INSERT, UPDATE ON public.habits TO authenticated;
GRANT ALL ON public.habits TO service_role;

-- ---------------------------------------------------------------------------
-- Jawshan. 100 parts, frozen per Almaty day.
-- Client calls ensure_jawshan_day(today) once; later sign-ups do not reshuffle.
-- Algorithm matches splitJawshan() in src/lib/jawshan.ts.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.jawshan_assignments (
  date date NOT NULL,
  user_id uuid NOT NULL,
  part_from integer NOT NULL,
  part_to integer NOT NULL,
  CONSTRAINT jawshan_assignments_pkey PRIMARY KEY (date, user_id),
  CONSTRAINT jawshan_assignments_range_check CHECK (
    part_from BETWEEN 1 AND 100
    AND part_to BETWEEN 1 AND 100
    AND part_from <= part_to
  )
);

CREATE TABLE IF NOT EXISTS public.jawshan_done (
  date date NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jawshan_done_pkey PRIMARY KEY (date, user_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jawshan_assignments_user_id_fkey'
  ) THEN
    ALTER TABLE public.jawshan_assignments
      ADD CONSTRAINT jawshan_assignments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jawshan_done_user_id_fkey'
  ) THEN
    ALTER TABLE public.jawshan_done
      ADD CONSTRAINT jawshan_done_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.jawshan_assignments REPLICA IDENTITY FULL;
ALTER TABLE public.jawshan_done REPLICA IDENTITY FULL;
ALTER TABLE public.habits REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.ensure_jawshan_day(p_date date)
RETURNS SETOF public.jawshan_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  today date := (now() AT TIME ZONE 'Asia/Almaty')::date;
  ids uuid[];
  n int;
  offset_n int;
  base int;
  extra int;
  i int;
  idx int;
  len int;
  start_part int := 1;
BEGIN
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'Укажите дату Джевшена';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('jawshan:' || p_date::text));

  IF EXISTS (SELECT 1 FROM public.jawshan_assignments WHERE date = p_date) THEN
    RETURN QUERY
      SELECT * FROM public.jawshan_assignments
      WHERE date = p_date
      ORDER BY part_from;
    RETURN;
  END IF;

  IF p_date <> today THEN
    RAISE EXCEPTION 'Джевшен можно распределить только на сегодня';
  END IF;

  SELECT coalesce(array_agg(id ORDER BY created_at, id), '{}')
    INTO ids
  FROM public.profiles;

  n := coalesce(cardinality(ids), 0);
  IF n = 0 THEN
    RETURN;
  END IF;

  offset_n := mod((p_date - DATE '2026-01-01'), n);
  IF offset_n < 0 THEN
    offset_n := offset_n + n;
  END IF;
  base := 100 / n;
  extra := 100 % n;

  FOR i IN 0..(n - 1) LOOP
    idx := ((i + offset_n) % n) + 1;
    len := base + CASE WHEN i < extra THEN 1 ELSE 0 END;
    IF len > 0 THEN
      INSERT INTO public.jawshan_assignments (date, user_id, part_from, part_to)
      VALUES (p_date, ids[idx], start_part, start_part + len - 1);
      start_part := start_part + len;
    END IF;
  END LOOP;

  IF start_part <> 101 THEN
    RAISE EXCEPTION 'Джевшен распределён не полностью';
  END IF;

  RETURN QUERY
    SELECT * FROM public.jawshan_assignments
    WHERE date = p_date
    ORDER BY part_from;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_jawshan_day(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_jawshan_day(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_jawshan_done_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  today date := (now() AT TIME ZONE 'Asia/Almaty')::date;
BEGIN
  IF NEW.date <> today THEN
    RAISE EXCEPTION 'Можно отмечать только сегодняшний день';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.jawshan_assignments
    WHERE date = NEW.date AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'На сегодня доля Джевшена не назначена';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_jawshan_done_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.date <> (now() AT TIME ZONE 'Asia/Almaty')::date AND current_user = 'authenticated' THEN
    RAISE EXCEPTION 'Отменить можно только сегодняшнюю долю';
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS jawshan_done_validate_insert ON public.jawshan_done;
CREATE TRIGGER jawshan_done_validate_insert
  BEFORE INSERT ON public.jawshan_done
  FOR EACH ROW EXECUTE FUNCTION public.validate_jawshan_done_insert();

DROP TRIGGER IF EXISTS jawshan_done_validate_delete ON public.jawshan_done;
CREATE TRIGGER jawshan_done_validate_delete
  BEFORE DELETE ON public.jawshan_done
  FOR EACH ROW EXECUTE FUNCTION public.validate_jawshan_done_delete();

ALTER TABLE public.jawshan_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jawshan_done ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jawshan assignments read" ON public.jawshan_assignments;
CREATE POLICY "jawshan assignments read" ON public.jawshan_assignments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "jawshan done read" ON public.jawshan_done;
CREATE POLICY "jawshan done read" ON public.jawshan_done
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "jawshan done insert own" ON public.jawshan_done;
CREATE POLICY "jawshan done insert own" ON public.jawshan_done
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "jawshan done delete own" ON public.jawshan_done;
CREATE POLICY "jawshan done delete own" ON public.jawshan_done
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Assignments are written only by ensure_jawshan_day (security definer).
-- Members cannot insert or edit the day's split.

GRANT SELECT ON public.jawshan_assignments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.jawshan_done TO authenticated;
GRANT ALL ON public.jawshan_assignments, public.jawshan_done TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'habits'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.habits;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'jawshan_assignments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.jawshan_assignments;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'jawshan_done'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.jawshan_done;
    END IF;
  END IF;
END $$;
