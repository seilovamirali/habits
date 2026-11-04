import { describe, expect, it } from "vitest";
import { JAWSHAN_POINTS, type TaskDef } from "./habits";
import { computePoints } from "./habits";
import { closedJawshanDays, coveredParts, jawshanStreak, splitJawshan } from "./jawshan";

const members = [
  { id: "a", created_at: "2026-11-01T00:00:00Z" },
  { id: "b", created_at: "2026-11-02T00:00:00Z" },
  { id: "c", created_at: "2026-11-03T00:00:00Z" },
  { id: "d", created_at: "2026-11-04T00:00:00Z" },
  { id: "e", created_at: "2026-11-05T00:00:00Z" },
];

function coversAll(rows: { part_from: number; part_to: number }[]) {
  const seen = new Set<number>();
  for (const row of rows) {
    for (let part = row.part_from; part <= row.part_to; part++) seen.add(part);
  }
  return seen.size === 100 && Math.min(...seen) === 1 && Math.max(...seen) === 100;
}

describe("jawshan split", () => {
  it("gives five people 20 parts each, in stable order, on the epoch", () => {
    const rows = splitJawshan(members, "2026-01-01");
    expect(rows.map((row) => [row.user_id, row.part_from, row.part_to])).toEqual([
      ["a", 1, 20],
      ["b", 21, 40],
      ["c", 41, 60],
      ["d", 61, 80],
      ["e", 81, 100],
    ]);
    expect(coversAll(rows)).toBe(true);
  });

  it("rotates the starting member each Almaty day", () => {
    const rows = splitJawshan(members, "2026-01-02");
    expect(rows.map((row) => row.user_id)).toEqual(["b", "c", "d", "e", "a"]);
    expect(rows[0]).toMatchObject({ part_from: 1, part_to: 20 });
    expect(rows[4]).toMatchObject({ user_id: "a", part_from: 81, part_to: 100 });
  });

  it("gives the remainder to the first people in the rotation", () => {
    const rows = splitJawshan(members.slice(0, 3), "2026-01-01");
    expect(rows).toEqual([
      { user_id: "a", part_from: 1, part_to: 34 },
      { user_id: "b", part_from: 35, part_to: 67 },
      { user_id: "c", part_from: 68, part_to: 100 },
    ]);
  });

  it("skips members once there are more than 100", () => {
    const crowd = Array.from({ length: 101 }, (_, i) => ({ id: `u${String(i).padStart(3, "0")}`, created_at: `2026-01-01T00:${String(i % 60).padStart(2, "0")}:${String(i).padStart(2, "0")}Z` }));
    const rows = splitJawshan(crowd, "2026-01-01");
    expect(rows).toHaveLength(100);
    expect(coversAll(rows)).toBe(true);
    expect(rows.every((row) => row.part_from === row.part_to)).toBe(true);
  });

  it("returns nothing for an empty group", () => {
    expect(splitJawshan([], "2026-11-04")).toEqual([]);
  });
});

describe("jawshan progress", () => {
  const assignments = splitJawshan(members.slice(0, 2), "2026-11-04").map((row) => ({ ...row, date: "2026-11-04" }));

  it("counts parts only after that person marks the share", () => {
    expect(coveredParts(assignments, [], "2026-11-04")).toBe(0);
    expect(coveredParts(assignments, [{ date: "2026-11-04", user_id: "a" }], "2026-11-04")).toBe(50);
    expect(coveredParts(assignments, [
      { date: "2026-11-04", user_id: "a" },
      { date: "2026-11-04", user_id: "b" },
    ], "2026-11-04")).toBe(100);
  });

  it("closes a day only at 100 parts and streaks backward from today", () => {
    const days = ["2026-11-02", "2026-11-03", "2026-11-04"];
    const all = days.flatMap((date) => splitJawshan(members.slice(0, 2), date).map((row) => ({ ...row, date })));
    const dones = days.filter((date) => date !== "2026-11-04").flatMap((date) => ["a", "b"].map((user_id) => ({ date, user_id })));
    expect(closedJawshanDays(all, dones)).toEqual(["2026-11-02", "2026-11-03"]);
    expect(jawshanStreak(closedJawshanDays(all, dones), "2026-11-04")).toBe(2);
    const withToday = [...dones, { date: "2026-11-04", user_id: "a" }, { date: "2026-11-04", user_id: "b" }];
    expect(jawshanStreak(closedJawshanDays(all, withToday), "2026-11-04")).toBe(3);
  });
});

describe("jawshan points stay outside the habit list", () => {
  it("adds 10 points per completed share inside the period", () => {
    const custom: TaskDef[] = [
      { key: "quran", title: "Коран", description: "", emoji: "📖", kind: "daily", target: 1, points: 10 },
      { key: "old", title: "Старое", description: "", emoji: "🗄️", kind: "daily", target: 1, points: 10, archived: true },
    ];
    const list = [
      { user_id: "u", task_key: "quran", completed_on: "2026-11-04" },
      { user_id: "u", task_key: "old", completed_on: "2026-11-04" },
    ];
    expect(JAWSHAN_POINTS).toBe(10);
    expect(computePoints(list, "2026-11-04", "2026-11-04", custom, ["2026-11-04", "2026-11-03"])).toBe(10 + 20 + 10);
  });
});
