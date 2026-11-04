
// Pure habit logic: tasks, Almaty dates, points, streaks, levels, badges.

export type TaskKey = string;

export interface TaskDef {
  key: string;
  title: string;
  description: string;
  emoji: string;
  kind: "daily" | "weekly";
  target: number; // 1 for daily, weekly_target for weekly
  points: number;
  sortOrder?: number;
  archived?: boolean;
}

export const DAILY_TASKS: TaskDef[] = [
  { key: "quran", title: "Коран", description: "1 страница", emoji: "📖", kind: "daily", target: 1, points: 10, sortOrder: 10 },
  { key: "salawat", title: "Салауат", description: "100 раз", emoji: "🤲", kind: "daily", target: 1, points: 10, sortOrder: 20 },
  { key: "istighfar", title: "Истигфар", description: "100 раз", emoji: "📿", kind: "daily", target: 1, points: 10, sortOrder: 30 },
  { key: "reading", title: "Чтение книги", description: "10 страниц или 30 минут аудиокниги", emoji: "📚", kind: "daily", target: 1, points: 10, sortOrder: 40 },
  { key: "sport", title: "Спорт", description: "Тренировка в зале или 10 000 шагов", emoji: "💪", kind: "daily", target: 1, points: 10, sortOrder: 50 },
  { key: "english", title: "Английский", description: "30 минут", emoji: "🇬🇧", kind: "daily", target: 1, points: 10, sortOrder: 60 },
  { key: "spanish", title: "Испанский", description: "10 минут", emoji: "🇪🇸", kind: "daily", target: 1, points: 10, sortOrder: 70 },
];

export const WEEKLY_TASKS: TaskDef[] = [
  { key: "fasting", title: "Ораза", description: "1 раз в неделю", emoji: "🌙", kind: "weekly", target: 1, points: 30, sortOrder: 80 },
  { key: "tahajjud", title: "Тахаджуд", description: "2 раза в неделю", emoji: "⭐", kind: "weekly", target: 2, points: 20, sortOrder: 90 },
];

export const ALL_TASKS = [...DAILY_TASKS, ...WEEKLY_TASKS];
export const TASK_MAP = Object.fromEntries(ALL_TASKS.map((t) => [t.key, t])) as Record<string, TaskDef>;
export const DAILY_KEYS = new Set<string>(DAILY_TASKS.map((t) => t.key));
export const DAILY_COUNT = DAILY_TASKS.length;
export const WEEKLY_TARGET_TOTAL = WEEKLY_TASKS.reduce((s, t) => s + t.target, 0); // 3
export const PERFECT_DAY_BONUS = 20;
export const JAWSHAN_POINTS = 10;

function bySort(a: TaskDef, b: TaskDef): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.key.localeCompare(b.key);
}

export function activeTasks(tasks: readonly TaskDef[] = ALL_TASKS): TaskDef[] {
  return tasks.filter((task) => !task.archived).sort(bySort);
}

export function activeDaily(tasks: readonly TaskDef[] = ALL_TASKS): TaskDef[] {
  return activeTasks(tasks).filter((task) => task.kind === "daily");
}

export function activeWeekly(tasks: readonly TaskDef[] = ALL_TASKS): TaskDef[] {
  return activeTasks(tasks).filter((task) => task.kind === "weekly");
}

function catalog(tasks: readonly TaskDef[]) {
  const active = activeTasks(tasks);
  const daily = active.filter((task) => task.kind === "daily");
  const weekly = active.filter((task) => task.kind === "weekly");
  return {
    map: new Map(active.map((task) => [task.key, task])),
    dailyKeys: new Set(daily.map((task) => task.key)),
    weeklyKeys: new Set(weekly.map((task) => task.key)),
    dailyCount: daily.length,
    weeklyTarget: weekly.reduce((sum, task) => sum + task.target, 0),
  };
}

export interface Completion {
  id?: string;
  user_id: string;
  task_key: string;
  completed_on: string; // YYYY-MM-DD (Almaty)
}

// ---------- Dates (Asia/Almaty) ----------
const almatyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" });
export function almatyToday(now: Date = new Date()): string {
  return almatyFmt.format(now);
}
const toUtc = (d: string) => new Date(d + "T00:00:00Z");
const fromUtc = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(d: string, n: number): string {
  const x = toUtc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUtc(x);
}
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(a).getTime() - toUtc(b).getTime()) / 86400000);
}
export function weekStart(d: string): string {
  const dow = (toUtc(d).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(d, -dow);
}
export function monthStart(d: string): string {
  return d.slice(0, 8) + "01";
}
export function formatRuDate(d: string): string {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(toUtc(d));
}

// ---------- Stats ----------
export type Period = "today" | "week" | "month" | "all";

export function periodRange(period: Period, today: string, firstDate?: string): [string, string] {
  if (period === "today") return [today, today];
  if (period === "week") return [weekStart(today), today];
  if (period === "month") return [monthStart(today), today];
  return [firstDate && firstDate < today ? firstDate : today, today];
}

function inRange(c: Completion, from: string, to: string) {
  return c.completed_on >= from && c.completed_on <= to;
}

export function dailyByDay(list: Completion[], tasks: readonly TaskDef[] = ALL_TASKS): Map<string, number> {
  const keys = catalog(tasks).dailyKeys;
  const m = new Map<string, number>();
  for (const c of list) if (keys.has(c.task_key)) m.set(c.completed_on, (m.get(c.completed_on) ?? 0) + 1);
  return m;
}

export function perfectDays(list: Completion[], tasks: readonly TaskDef[] = ALL_TASKS): string[] {
  const count = catalog(tasks).dailyCount;
  if (count <= 0) return [];
  return [...dailyByDay(list, tasks)].filter(([, n]) => n >= count).map(([d]) => d).sort();
}

export function computePoints(
  list: Completion[],
  from = "0000-01-01",
  to = "9999-12-31",
  tasks: readonly TaskDef[] = ALL_TASKS,
  jawshanDates: readonly string[] = [],
): number {
  const { map } = catalog(tasks);
  const sub = list.filter((c) => inRange(c, from, to));
  let pts = 0;
  for (const c of sub) pts += map.get(c.task_key)?.points ?? 0;
  pts += perfectDays(sub, tasks).length * PERFECT_DAY_BONUS;
  for (const date of jawshanDates) if (date >= from && date <= to) pts += JAWSHAN_POINTS;
  return pts;
}

/** Count Monday-start weeks overlapping [from, to]. */
export function weeksTouched(from: string, to: string): number {
  return Math.floor(diffDays(weekStart(to), weekStart(from)) / 7) + 1;
}

/** (daily done + weekly done) / (active dailies × days + weekly targets × weeks touched) */
export function completionPct(list: Completion[], from: string, to: string, tasks: readonly TaskDef[] = ALL_TASKS): number {
  const days = diffDays(to, from) + 1;
  if (days <= 0) return 0;
  const { dailyKeys, weeklyKeys, dailyCount, weeklyTarget } = catalog(tasks);
  const sub = list.filter((c) => inRange(c, from, to));
  const daily = sub.filter((c) => dailyKeys.has(c.task_key)).length;
  const weekly = sub.filter((c) => weeklyKeys.has(c.task_key)).length;
  const denom = dailyCount * days + weeklyTarget * weeksTouched(from, to);
  if (denom <= 0) return 0;
  return Math.min(100, Math.round(((daily + weekly) / denom) * 100));
}

export function currentStreak(list: Completion[], today: string, tasks: readonly TaskDef[] = ALL_TASKS): number {
  const perfect = new Set(perfectDays(list, tasks));
  let d = perfect.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (perfect.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(list: Completion[], tasks: readonly TaskDef[] = ALL_TASKS): number {
  const days = perfectDays(list, tasks);
  let best = 0, run = 0, prev: string | null = null;
  for (const d of days) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

// ---------- Levels ----------
export const LEVEL_TITLES = [
  "Новичок", "Ученик", "Стремящийся", "Усердный", "Стойкий",
  "Мастер", "Наставник", "Мудрец", "Светоч", "Легенда",
];
export function levelInfo(points: number) {
  const level = Math.floor(Math.sqrt(Math.max(0, points) / 50)) + 1;
  const curMin = 50 * (level - 1) ** 2;
  const nextMin = 50 * level ** 2;
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    curMin,
    nextMin,
    progress: Math.round(((points - curMin) / (nextMin - curMin)) * 100),
  };
}

// ---------- Badges ----------
export interface Badge { key: string; emoji: string; title: string; description: string; earned: boolean }

export function computeBadges(list: Completion[], tasks: readonly TaskDef[] = ALL_TASKS): Badge[] {
  const { map, dailyCount } = catalog(tasks);
  const scoped = list.filter((c) => map.has(c.task_key));
  const count = (k: string) => new Set(scoped.filter((c) => c.task_key === k).map((c) => c.completed_on)).size;
  const best = bestStreak(scoped, tasks);
  const fastingWeeks = new Set(scoped.filter((c) => c.task_key === "fasting").map((c) => weekStart(c.completed_on))).size;
  return [
    { key: "first", emoji: "👣", title: "Первый шаг", description: "Первое выполненное задание", earned: scoped.length >= 1 },
    { key: "perfect", emoji: "🌟", title: "Идеальный день", description: dailyCount > 0 ? `Все ${dailyCount} ежедневных заданий за день` : "Все ежедневные задания за день", earned: perfectDays(scoped, tasks).length >= 1 },
    { key: "week_fire", emoji: "🔥", title: "Неделя огня", description: "Серия 7 дней", earned: best >= 7 },
    { key: "month", emoji: "🏔️", title: "Месяц стойкости", description: "Серия 30 дней", earned: best >= 30 },
    { key: "faster", emoji: "🌙", title: "Постящийся", description: "Ораза 4 недели", earned: fastingWeeks >= 4 },
    { key: "night", emoji: "✨", title: "Ночная молитва", description: "10 раз Тахаджуд", earned: count("tahajjud") >= 10 },
    { key: "quran", emoji: "📖", title: "Чтец Корана", description: "Коран 30 дней", earned: count("quran") >= 30 },
    { key: "polyglot", emoji: "🗣️", title: "Полиглот", description: "Английский и испанский по 30 дней", earned: count("english") >= 30 && count("spanish") >= 30 },
    { key: "hundred", emoji: "💯", title: "Сотня", description: "100 выполненных заданий", earned: scoped.length >= 100 },
  ];
}


