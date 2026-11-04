
import { useMemo } from "react";

const PIECES = ["✨", "🎉", "⭐", "🌙", "💛", "🟡", "🟢"];

export function Confetti() {
  const items = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dx: `${(Math.random() - 0.5) * 120}px`,
        size: 14 + Math.random() * 14,
        ch: PIECES[i % PIECES.length],
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {items.map((p, i) => (
        <span
          key={i}
          className="animate-confetti absolute top-0"
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, fontSize: p.size, ["--dx" as string]: p.dx }}
        >
          {p.ch}
        </span>
      ))}
    </div>
  );
}


