
import { describe, it, expect } from "vitest";
import {
  almatyToday, weekStart, computePoints, currentStreak, bestStreak, levelInfo,
  completionPct, ALL_TASKS, DAILY_TASKS, type Completion,
} from "./habits";

const day = (d: string, u = "u"): Completion[] => DAILY_TASKS.map((t) => ({ user_id: u, task_key: t.key, completed_on: d }));

describe("habits rules", () => {
  it("today uses Almaty timezone (UTC+5)", () => {
    expect(almatyToday(new Date("2026-11-01T20:30:00Z"))).toBe("2026-11-02");
  });
  it("weeks start on Monday", () => {
    expect(weekStart("2026-11-08")).toBe("2026-11-02"); // Sunday -> Monday
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
  });
  it("daily = 10, fasting = 30, tahajjud = 20, perfect day bonus = 20", () => {
    expect(computePoints([{ user_id: "u", task_key: "quran", completed_on: "2026-11-02" }])).toBe(10);
    expect(computePoints([{ user_id: "u", task_key: "fasting", completed_on: "2026-11-02" }])).toBe(30);
    expect(computePoints([{ user_id: "u", task_key: "tahajjud", completed_on: "2026-11-02" }])).toBe(20);
    expect(computePoints(day("2026-11-02"))).toBe(90);
  });
  it("streak counts from yesterday if today unfinished", () => {
    const list = [...day("2026-10-31"), ...day("2026-11-01")];
    expect(currentStreak(list, "2026-11-02")).toBe(2);
    expect(currentStreak(list, "2026-11-03")).toBe(0);
    expect(bestStreak([...list, ...day("2026-11-05")])).toBe(2);
  });
  it("level = floor(sqrt(points/50)) + 1", () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(49).level).toBe(1);
    expect(levelInfo(50).level).toBe(2);
    expect(levelInfo(200).level).toBe(3);
  });
  it("period % = (daily+weekly) / (7×days + 3×weeks)", () => {
    const list = day("2026-11-02").slice(0, 7);
    expect(completionPct(list, "2026-11-02", "2026-11-02")).toBe(70);
  });
  it("scores only active habits, so archiving one daily task changes the day", () => {
    const tasks = ALL_TASKS.map((task) => task.key === "spanish" ? { ...task, archived: true } : task);
    const list = day("2026-11-02").filter((row) => row.task_key !== "spanish");
    expect(computePoints(list, "0000-01-01", "9999-12-31", tasks)).toBe(60 + 20);
    expect(completionPct(list, "2026-11-02", "2026-11-02", tasks)).toBe(67);
  });
});


