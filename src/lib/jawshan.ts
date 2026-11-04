import { addDays, diffDays } from "@/lib/habits";

export const JAWSHAN_PARTS = 100;
export const JAWSHAN_EPOCH = "2026-01-01";

export interface JawshanAssignment {
  date: string;
  user_id: string;
  part_from: number;
  part_to: number;
}

export interface JawshanDone {
  date: string;
  user_id: string;
}

export function shareLength(row: { part_from: number; part_to: number }): number {
  return Math.max(0, row.part_to - row.part_from + 1);
}

/**
 * Even contiguous split of parts 1–100.
 * Members are ordered by created_at, then id, then rotated by the Almaty
 * day count since 2026-01-01. The first `100 % n` people in that rotation
 * receive one extra part. This must stay identical to ensure_jawshan_day().
 */
export function splitJawshan<T extends { id: string; created_at: string }>(
  members: readonly T[],
  date: string,
): Omit<JawshanAssignment, "date">[] {
  const ordered = [...members].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const n = ordered.length;
  if (n === 0) return [];
  const shift = diffDays(date, JAWSHAN_EPOCH);
  const offset = ((shift % n) + n) % n;
  const base = Math.floor(JAWSHAN_PARTS / n);
  const extra = JAWSHAN_PARTS % n;
  let start = 1;
  const rows: Omit<JawshanAssignment, "date">[] = [];
  for (let i = 0; i < n; i++) {
    const member = ordered[(i + offset) % n];
    if (!member) continue;
    const len = base + (i < extra ? 1 : 0);
    if (len <= 0) continue;
    rows.push({ user_id: member.id, part_from: start, part_to: start + len - 1 });
    start += len;
  }
  return rows;
}

export function coveredParts(assignments: readonly JawshanAssignment[], dones: readonly JawshanDone[], date: string): number {
  const done = new Set(dones.filter((row) => row.date === date).map((row) => row.user_id));
  const parts = assignments
    .filter((row) => row.date === date && done.has(row.user_id))
    .reduce((sum, row) => sum + shareLength(row), 0);
  return Math.min(JAWSHAN_PARTS, parts);
}

export function closedJawshanDays(assignments: readonly JawshanAssignment[], dones: readonly JawshanDone[]): string[] {
  const dates = [...new Set(assignments.map((row) => row.date))].sort();
  return dates.filter((date) => assignments.some((row) => row.date === date) && coveredParts(assignments, dones, date) >= JAWSHAN_PARTS);
}

export function jawshanStreak(closed: readonly string[], today: string): number {
  const set = new Set(closed);
  let day = set.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (set.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

export function newHabitKey(): string {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `h_${token}`;
}
