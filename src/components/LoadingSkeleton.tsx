import { cn } from "@/lib/utils";

export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,oklch(1_0_0/4%)_0%,oklch(1_0_0/9%)_50%,oklch(1_0_0/4%)_100%)] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}

export function SearchResultSkeleton() {
  return (
    <div className="space-y-1 p-1" aria-label="Loading results">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-1">
          <Shimmer className="h-16 w-11 shrink-0" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-3.5 w-3/4" />
            <Shimmer className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecommendationSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="glass overflow-hidden rounded-3xl animate-fade-up"
      style={{ animationDelay: `${index * 90}ms` }}
      aria-hidden
    >
      <Shimmer className="h-28 rounded-none" />
      <div className="-mt-14 flex gap-4 px-5">
        <Shimmer className="aspect-[2/3] w-28 shrink-0 rounded-xl ring-4 ring-background" />
        <div className="flex-1 space-y-2 pt-16">
          <Shimmer className="h-5 w-4/5" />
          <Shimmer className="h-3.5 w-1/2" />
        </div>
      </div>
      <div className="space-y-3 p-5">
        <div className="flex gap-2">
          <Shimmer className="h-6 w-16 rounded-full" />
          <Shimmer className="h-6 w-20 rounded-full" />
          <Shimmer className="h-6 w-14 rounded-full" />
        </div>
        <Shimmer className="h-3.5 w-full" />
        <Shimmer className="h-3.5 w-11/12" />
        <Shimmer className="h-3.5 w-2/3" />
        <Shimmer className="mt-4 h-24 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function RandomAnimeSkeleton() {
  return (
    <div className="glass flex flex-col gap-6 overflow-hidden rounded-3xl p-5 sm:flex-row sm:p-6" aria-label="Rolling a random anime">
      <Shimmer className="mx-auto aspect-[2/3] w-44 shrink-0 rounded-2xl sm:mx-0 sm:w-52" />
      <div className="flex-1 space-y-3 py-2">
        <Shimmer className="h-8 w-3/4" />
        <Shimmer className="h-4 w-1/3" />
        <div className="flex gap-2 pt-2">
          <Shimmer className="h-6 w-16 rounded-full" />
          <Shimmer className="h-6 w-20 rounded-full" />
        </div>
        <Shimmer className="h-3.5 w-full" />
        <Shimmer className="h-3.5 w-full" />
        <Shimmer className="h-3.5 w-4/5" />
      </div>
    </div>
  );
}

export function ModalSkeleton() {
  return (
    <div aria-label="Loading anime details">
      <Shimmer className="h-40 rounded-none sm:h-56" />
      <div className="-mt-16 flex gap-5 px-5 sm:px-8">
        <Shimmer className="aspect-[2/3] w-28 shrink-0 rounded-xl ring-4 ring-popover sm:w-36" />
        <div className="flex-1 space-y-2 pt-20">
          <Shimmer className="h-6 w-2/3" />
          <Shimmer className="h-4 w-1/3" />
        </div>
      </div>
      <div className="space-y-3 p-5 sm:p-8">
        <Shimmer className="h-4 w-full" />
        <Shimmer className="h-4 w-full" />
        <Shimmer className="h-4 w-3/4" />
        <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Shimmer key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
