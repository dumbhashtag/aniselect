import type { Anime } from "@/types/anime";

/** Slowly drifting wall of trending posters behind the hero. Purely decorative. */
export function PosterWall({ anime }: { anime: Anime[] }) {
  const posters = anime.filter((a) => a.coverImage);
  if (posters.length < 6) return null;
  const rows = [posters, [...posters].reverse(), [...posters.slice(4), ...posters.slice(0, 4)]];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 flex w-[180%] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg] flex-col gap-4 opacity-[0.22]">
        {rows.map((row, r) => (
          <div
            key={r}
            className="flex w-max gap-4 motion-safe:animate-[drift_90s_linear_infinite]"
            style={{ animationDirection: r % 2 ? "reverse" : "normal" }}
          >
            {[...row, ...row].map((a, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- decorative, many tiny images
              <img
                key={`${a.id}-${i}`}
                src={a.coverImage!}
                alt=""
                loading={r === 0 ? "eager" : "lazy"}
                className="h-52 w-36 rounded-2xl object-cover sm:h-64 sm:w-44"
              />
            ))}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.155_0.022_262/0.55),oklch(0.155_0.022_262/0.97)_70%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
