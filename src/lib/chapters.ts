import raw from "@/data/chapters.json";

export interface ChapterJson {
  section: string;
  number: number | null;
  title: string;
  page: number;
}

export const CHAPTERS: ChapterJson[] = raw;

export function chapterLabel(chapter: ChapterJson): string {
  return `${chapter.number === null ? "" : `${chapter.number}. `}${chapter.title}`;
}

export function chapterAt(page: number): ChapterJson | undefined {
  return [...CHAPTERS].reverse().find((chapter) => chapter.page <= page);
}

export const CHAPTER_SECTIONS = [...new Set(CHAPTERS.map((chapter) => chapter.section))];
