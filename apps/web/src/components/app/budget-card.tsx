import { Progress } from "@/components/ui/progress";
import type { Targets, Totals } from "@/lib/api";
import { cn, fmt } from "@/lib/utils";

/** The core equation: Goal − Food = Left today. */
export function BudgetCard({ targets, eaten, remaining }: { targets: Targets; eaten: Totals; remaining: Totals }) {
  const over = remaining.calories < 0;
  const pct = Math.round((eaten.calories / targets.calories) * 100);

  return (
    <section aria-labelledby="budget-title" className="flex flex-col gap-6 rounded-xl border bg-card p-6 sm:p-7">
      <h2 id="budget-title" className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        Daily budget · kcal
      </h2>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        {/* "Goal − Food =" stays on one line; the result wraps below it on phones */}
        <div className="flex items-end gap-x-4 sm:gap-x-6">
          <Figure value={targets.calories} label="Goal" />
          <span aria-hidden="true" className="tabular pb-6 text-2xl text-muted-foreground sm:text-3xl">
            −
          </span>
          <Figure value={eaten.calories} label="Food" />
          <span aria-hidden="true" className="tabular pb-6 text-2xl text-muted-foreground sm:text-3xl">
            =
          </span>
        </div>
        <div>
          <div className={cn("text-7xl leading-[0.95] font-bold tracking-tight sm:text-8xl", over ? "text-fat" : "text-primary")}>{fmt(Math.abs(remaining.calories))}</div>
          <div className={cn("mt-2 text-sm font-semibold", over ? "text-fat" : "text-primary")}>{over ? "Over budget" : "Left today"}</div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Progress value={pct} aria-label={`${pct}% of daily calories eaten`} indicatorClassName={over ? "bg-fat" : undefined} />
        <p className="text-sm text-muted-foreground">
          {pct}% of goal ·{" "}
          {targets.source === "manual" ? "you set this goal yourself" : "your goal is an estimate from your questionnaire; it adjusts with your weight trend"}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Macro label="Protein" eaten={eaten.proteinG} target={targets.proteinG} className="bg-protein" />
        <Macro label="Fat" eaten={eaten.fatG} target={targets.fatG} className="bg-fat" />
        <Macro label="Carbs" eaten={eaten.carbsG} target={targets.carbsG} className="bg-carbs" />
      </div>
    </section>
  );
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="tabular text-3xl font-medium sm:text-4xl">{fmt(value)}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function Macro({ label, eaten, target, className }: { label: string; eaten: number; target: number; className: string }) {
  const pct = Math.round((eaten / Math.max(target, 1)) * 100);
  return (
    <div className="rounded-lg bg-background p-4">
      <div className="flex justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular">
          {fmt(eaten)} / {fmt(target)} g
        </span>
      </div>
      <Progress value={pct} className="mt-2.5 h-1.5" indicatorClassName={className} aria-label={`${label}: ${fmt(eaten)} of ${fmt(target)} grams`} />
    </div>
  );
}
