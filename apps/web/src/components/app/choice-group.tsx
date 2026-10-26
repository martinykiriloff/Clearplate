"use client";

import { cn } from "@/lib/utils";

export interface Choice<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/** Accessible radio group rendered as large tappable cards. */
export function ChoiceGroup<T extends string>({
  name,
  legend,
  choices,
  value,
  onChange,
  columns = 1,
}: {
  name: string;
  legend: string;
  choices: Choice<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  columns?: 1 | 2 | 3;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-medium text-muted-foreground">{legend}</legend>
      <div className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}>
        {choices.map((c) => {
          const checked = value === c.value;
          return (
            <label
              key={c.value}
              className={cn(
                "flex min-h-11 cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                checked ? "border-primary bg-primary/10" : "border-border bg-card hover:border-input",
              )}
            >
              <input type="radio" name={name} value={c.value} checked={checked} onChange={() => onChange(c.value)} className="sr-only" />
              <span className="flex items-center justify-between gap-3 font-semibold">
                {c.label}
                <span aria-hidden="true" className={cn("size-4 rounded-full border-2", checked ? "border-primary bg-primary" : "border-input")} />
              </span>
              {c.description && <span className="text-sm text-muted-foreground">{c.description}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
