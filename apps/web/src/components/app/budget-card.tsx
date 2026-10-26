"use client";

import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/i18n/provider";
import type { Targets, Totals } from "@/lib/api";
import { cn } from "@/lib/utils";

/** The core equation: Goal − Food = Left today. */
export function BudgetCard({ targets, eaten, remaining }: { targets: Targets; eaten: Totals; remaining: Totals }) {
  const { t, n } = useI18n();
  const b = t.budget;
  const over = remaining.calories < 0;
  const pct = Math.round((eaten.calories / targets.calories) * 100);

  return (
    <section aria-labelledby="budget-title" className="flex flex-col gap-6 rounded-xl border bg-card p-6 sm:p-7">
      <h2 id="budget-title" className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        {b.title}
      </h2>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        {/* "Goal − Food =" stays on one line; the result wraps below it on phones */}
        <div className="flex items-end gap-x-4 sm:gap-x-6">
          <Figure value={n(targets.calories)} label={b.goal} />
          <span aria-hidden="true" className="tabular pb-6 text-2xl text-muted-foreground sm:text-3xl">
            −
          </span>
          <Figure value={n(eaten.calories)} label={b.food} />
          <span aria-hidden="true" className="tabular pb-6 text-2xl text-muted-foreground sm:text-3xl">
            =
          </span>
        </div>
        <div>
          <div className={cn("text-7xl leading-[0.95] font-bold tracking-tight sm:text-8xl", over ? "text-fat" : "text-primary")}>{n(Math.abs(remaining.calories))}</div>
          <div className={cn("mt-2 text-sm font-semibold", over ? "text-fat" : "text-primary")}>{over ? b.over : b.left}</div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Progress value={pct} aria-label={b.progressLabel(pct)} indicatorClassName={over ? "bg-fat" : undefined} />
        <p className="text-sm text-muted-foreground">
          {b.ofGoal(pct)} · {targets.source === "manual" ? b.manual : b.estimated}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Macro label={b.protein} eaten={eaten.proteinG} target={targets.proteinG} className="bg-protein" />
        <Macro label={b.fat} eaten={eaten.fatG} target={targets.fatG} className="bg-fat" />
        <Macro label={b.carbs} eaten={eaten.carbsG} target={targets.carbsG} className="bg-carbs" />
      </div>
    </section>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="tabular text-3xl font-medium sm:text-4xl">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function Macro({ label, eaten, target, className }: { label: string; eaten: number; target: number; className: string }) {
  const { t, n } = useI18n();
  const pct = Math.round((eaten / Math.max(target, 1)) * 100);
  return (
    <div className="rounded-lg bg-background p-4">
      <div className="flex justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular">
          {n(eaten)} / {n(target)} {t.common.g}
        </span>
      </div>
      <Progress value={pct} className="mt-2.5 h-1.5" indicatorClassName={className} aria-label={t.budget.macroLabel(label, n(eaten), n(target))} />
    </div>
  );
}
