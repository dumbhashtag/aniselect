"use client";

import { RotateCcwIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { MAX_YEAR, MIN_YEAR, RANDOM_FORMAT_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AnimeFormat, RandomFilters } from "@/types/anime";

export const DEFAULT_RANDOM_FILTERS: RandomFilters = {
  genre: null,
  minScore: 0,
  formats: [],
  finishedOnly: false,
  yearFrom: MIN_YEAR,
  yearTo: MAX_YEAR,
};

interface FilterMenuProps {
  filters: RandomFilters;
  genres: string[];
  onChange: (filters: RandomFilters) => void;
}

export function activeFilterCount(filters: RandomFilters): number {
  let count = 0;
  if (filters.genre) count++;
  if (filters.minScore) count++;
  if (filters.formats?.length) count++;
  if (filters.finishedOnly) count++;
  if ((filters.yearFrom ?? MIN_YEAR) > MIN_YEAR || (filters.yearTo ?? MAX_YEAR) < MAX_YEAR) count++;
  return count;
}

function Label({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-2">
      <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</span>
      {hint && <span className="text-xs font-medium text-foreground tabular-nums">{hint}</span>}
    </div>
  );
}

export function FilterMenu({ filters, genres, onChange }: FilterMenuProps) {
  const set = (patch: Partial<RandomFilters>) => onChange({ ...filters, ...patch });
  const formats = filters.formats ?? [];
  const yearFrom = filters.yearFrom ?? MIN_YEAR;
  const yearTo = filters.yearTo ?? MAX_YEAR;
  const genreItems = [{ value: "any", label: "Any genre" }, ...genres.map((g) => ({ value: g, label: g }))];

  const toggleFormat = (format: AnimeFormat) =>
    set({ formats: formats.includes(format) ? formats.filter((f) => f !== format) : [...formats, format] });

  return (
    <div className="glass space-y-6 rounded-3xl p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold">Filters</h3>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_RANDOM_FILTERS)}
          disabled={activeFilterCount(filters) === 0}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <RotateCcwIcon className="size-3" /> Reset
        </button>
      </div>

      <div>
        <Label>Genre</Label>
        <Select
          items={genreItems}
          value={filters.genre ?? "any"}
          onValueChange={(value) => set({ genre: !value || value === "any" ? null : String(value) })}
        >
          <SelectTrigger className="h-10 w-full rounded-xl bg-black/20" aria-label="Genre">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {genreItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Format</Label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Formats">
          {RANDOM_FORMAT_OPTIONS.map((option) => {
            const active = formats.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => toggleFormat(option.value)}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-medium transition-all",
                  active
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground/70">
          {formats.length ? "Only the selected formats." : "None selected means any format."}
        </p>
      </div>

      <div>
        <Label hint={filters.minScore ? `${filters.minScore}%+` : "Any"}>Minimum score</Label>
        <Slider
          min={0}
          max={90}
          step={5}
          value={[filters.minScore ?? 0]}
          onValueChange={(value) => set({ minScore: Array.isArray(value) ? value[0] : (value as number) })}
          aria-label="Minimum score"
        />
      </div>

      <div>
        <Label hint={`${yearFrom} – ${yearTo}`}>Release years</Label>
        <Slider
          min={MIN_YEAR}
          max={MAX_YEAR}
          step={1}
          value={[yearFrom, yearTo]}
          minStepsBetweenValues={0}
          onValueChange={(value) => {
            if (Array.isArray(value)) set({ yearFrom: value[0], yearTo: value[1] });
          }}
          aria-label="Release year range"
        />
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
        <span className="text-sm">Finished airing only</span>
        <Switch checked={Boolean(filters.finishedOnly)} onCheckedChange={(checked) => set({ finishedOnly: checked })} />
      </label>
    </div>
  );
}
