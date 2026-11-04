
import { describe, expect, it } from "vitest";
import { BOOK, clampPage, currentChapter, bookPercent, pagesReadToday, shouldRemindBookTask, groupBookStats, rankReaders, type BookProgress } from "./book";

const row = (page: number, date = "2026-11-04", start = 0, user = "a"): BookProgress => ({ user_id: user, current_page: page, day_start_date: date, day_start_page: start, updated_at: "" });
describe("group book rules", () => {
  it("limits progress to integer pages 0–496", () => {
    expect(BOOK.totalPages).toBe(496);
    expect(clampPage(-1)).toBe(0);
    expect(clampPage(700)).toBe(496);
    expect(clampPage(12.8)).toBe(12);
  });
  it("uses 496 pages for percentages", () => {
    expect(bookPercent(248)).toBe(50);
    expect(bookPercent(496)).toBe(100);
  });
  it("has no chapter before page 3 and chooses the greatest starting page", () => {
    expect(currentChapter(2)).toBeUndefined();
    expect(currentChapter(3)?.[3]).toBe(3);
    expect(currentChapter(124)?.[3]).toBe(91);
    expect(currentChapter(125)?.[3]).toBe(125);
    expect(currentChapter(496)?.[3]).toBe(484);
  });
  it("counts only today's positive page difference", () => {
    expect(pagesReadToday(row(30, "2026-11-04", 20), "2026-11-04")).toBe(10);
    expect(pagesReadToday(row(30, "2026-11-03", 20), "2026-11-04")).toBe(0);
    expect(pagesReadToday(row(10, "2026-11-04", 20), "2026-11-04")).toBe(0);
  });
  it("shows the habit reminder only at 10 or more pages", () => {
    expect(shouldRemindBookTask(9)).toBe(false);
    expect(shouldRemindBookTask(10)).toBe(true);
  });
  it("averages saved readers only, including saved zeroes", () => {
    expect(groupBookStats([row(496), row(0, "2026-11-04", 0, "b")])).toEqual({ readers: 2, percent: 50 });
    expect(groupBookStats([])).toEqual({ readers: 0, percent: 0 });
  });
  it("ranks all profiles, with unsaved profiles at zero", () => {
    expect(rankReaders([{ id: "a", display_name: "А" }, { id: "b", display_name: "Б" }], [row(44, "2026-11-04", 0, "b")]).map((p) => [p.id, p.page])).toEqual([["b", 44], ["a", 0]]);
  });
});

