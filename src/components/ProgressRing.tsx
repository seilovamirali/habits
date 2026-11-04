
export function ProgressRing({ value, size = 120, stroke = 10, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, value) / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-primary-foreground/20" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          className="stroke-gold transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold">{value}%</span>
        {label && <span className="text-xs opacity-80">{label}</span>}
      </div>
    </div>
  );
}

export function Bar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-full bg-muted ${className}`}>
      <div className="h-full rounded-full bg-gradient-gold transition-all duration-700" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}


