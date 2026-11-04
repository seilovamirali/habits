import { describe, expect, it } from "vitest";
import { BOOK } from "./book";
import { CHAPTERS, chapterAt, chapterLabel } from "./chapters";

describe("chapters.json", () => {
  it("matches the book table of contents", () => {
    expect(CHAPTERS.length).toBe(BOOK.chapters.length);
    CHAPTERS.forEach((chapter, index) => {
      const row = BOOK.chapters[index];
      expect(row).toBeDefined();
      if (!row) return;
      expect(chapter.section).toBe(row[0]);
      expect(chapter.number).toBe(row[1]);
      expect(chapter.title).toBe(row[2]);
      expect(chapter.page).toBe(row[3]);
    });
  });

  it("jumps to the chapter that starts on or before the page", () => {
    expect(chapterAt(2)).toBeUndefined();
    expect(chapterAt(3)?.page).toBe(3);
    expect(chapterLabel(CHAPTERS[0]!)).toBe("Вместо предисловия");
    expect(chapterAt(125)?.title).toBe("Ихлас и искренность");
  });
});
