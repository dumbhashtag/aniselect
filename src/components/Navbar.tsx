import { DicesIcon, SparklesIcon } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-background/60 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <a href="#top" className="group flex items-center gap-2.5">
          <span className="relative flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-pink-400 font-heading text-base font-black text-slate-950 shadow-lg shadow-primary/30 transition-transform group-hover:rotate-[-6deg]">
            A
          </span>
          <span className="font-heading text-lg font-bold tracking-tight">
            Ani <span className="text-primary">Select</span>
          </span>
        </a>
        <div className="flex items-center gap-1 text-sm">
          <a href="#pick" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-muted-foreground transition hover:bg-white/5 hover:text-foreground">
            <SparklesIcon className="size-4" /> <span className="hidden sm:inline">Recommend</span>
          </a>
          <a href="#random" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-muted-foreground transition hover:bg-white/5 hover:text-foreground">
            <DicesIcon className="size-4" /> <span className="hidden sm:inline">Randomizer</span>
          </a>
        </div>
      </nav>
    </header>
  );
}
