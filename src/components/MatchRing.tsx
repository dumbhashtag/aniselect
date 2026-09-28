import { cn } from "@/lib/utils";

export function MatchRing({ value, className }: { value: number; className?: string }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  return (
    <div
      className={cn("relative flex size-16 items-center justify-center rounded-full bg-black/55 backdrop-blur-md", className)}
      role="img"
      aria-label={`${value}% match`}
    >
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="oklch(1 0 0 / 12%)" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="var(--color-match)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="relative text-center leading-none">
        <span className="font-heading text-lg font-bold text-white">{value}</span>
        <span className="text-[10px] font-semibold text-white/80">%</span>
        <span className="block text-[9px] font-medium tracking-wider text-match uppercase">match</span>
      </div>
    </div>
  );
}
