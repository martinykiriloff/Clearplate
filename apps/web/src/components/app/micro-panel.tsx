"use client";

import { useMemo, useState } from "react";
import { MICRO_KEYS, MICRO_UNITS, type MicroKey } from "@clearplate/targets";
import { useI18n } from "@/i18n/provider";
import type { Today } from "@/lib/api";
import { cn } from "@/lib/utils";

const MINERAL_KEYS = new Set<MicroKey>(["calcium", "iron", "magnesium", "phosphorus", "potassium", "zinc", "copper", "manganese", "selenium"]);
const VITAMINS: MicroKey[] = MICRO_KEYS.filter((k) => !MINERAL_KEYS.has(k));
const MINERALS: MicroKey[] = MICRO_KEYS.filter((k) => MINERAL_KEYS.has(k));
/** Rows shown before "show all": the ones most often short in Western diets. */
const KEY_ROWS = new Set<MicroKey>(["vitaminD", "vitaminA", "vitaminC", "folate", "vitaminB12", "vitaminK", "calcium", "iron", "magnesium", "potassium", "zinc", "selenium"]);

/**
 * Vitamins and minerals against the person's Dietary Reference Intakes.
 * Each row carries the number, the % and a text status, so the bar is never the only signal.
 */
export function MicroPanel({ data }: { data: Today }) {
  const { t, n, n1, pick } = useI18n();
  const mt = t.micros;
  const [all, setAll] = useState(false);
  const totals = data.nutrients.micros ?? {};

  // Which logged item contributed most of each nutrient.
  const top = useMemo(() => {
    const best: Partial<Record<MicroKey, { label: string; v: number }>> = {};
    for (const meal of data.meals)
      for (const e of meal.entries) {
        if (!e.micros) continue;
        for (const k of MICRO_KEYS) {
          const v = e.micros[k] ?? 0;
          if (v > 0 && v > (best[k]?.v ?? 0)) best[k] = { label: pick(e.label, e.labelBg), v };
        }
      }
    return best;
  }, [data.meals, pick]);

  const unit = (k: MicroKey) => (MICRO_UNITS[k] === "mg" ? mt.unitMg : mt.unitUg);
  const fmt = (v: number) => (v >= 100 ? n(v) : v >= 10 ? n1(v) : n1(Math.round(v * 100) / 100));

  const group = (title: string, keys: MicroKey[]) => {
    const shown = all ? keys : keys.filter((k) => KEY_ROWS.has(k));
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <h4 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{title}</h4>
        <ul className="flex flex-col">
          {shown.map((k) => {
            const eaten = totals[k] ?? 0;
            const goal = data.microTargets?.[k];
            const pct = goal ? Math.round((eaten / goal.amount) * 100) : null;
            const met = pct != null && pct >= 100;
            const src = top[k];
            return (
              <li key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t py-2.5 text-sm">
                <span className="min-w-0 font-medium break-words">{mt.names[k]}</span>
                <span className="tabular text-right whitespace-nowrap">
                  {fmt(eaten)}
                  {goal && <span className="text-muted-foreground"> / {fmt(goal.amount)}</span>} {unit(k)}
                </span>
                {goal && (
                  <div className="col-span-2 flex items-center gap-3">
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-track">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
                    </div>
                    <span className={cn("tabular min-w-16 shrink-0 text-right text-xs whitespace-nowrap", met ? "font-semibold text-primary" : "text-muted-foreground")}>
                      {met ? `${mt.met} · ${pct}%` : `${pct}%`}
                      <span className="ml-1 text-muted-foreground" title={goal.kind === "RDA" ? "Recommended Dietary Allowance" : "Adequate Intake"}>
                        {goal.kind === "RDA" ? mt.rda : mt.ai}
                      </span>
                    </span>
                  </div>
                )}
                <span className="col-span-2 truncate text-xs text-muted-foreground">{src ? mt.topSource(src.label) : mt.noSource}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{mt.title}</h3>
        <button type="button" onClick={() => setAll((v) => !v)} className="text-sm font-medium text-primary underline-offset-4 hover:underline" aria-expanded={all}>
          {all ? mt.showLess : mt.showAll}
        </button>
      </div>
      {!data.microTargets && <p className="text-sm text-muted-foreground">{mt.noProfile}</p>}
      <div className="grid gap-6 md:grid-cols-2">
        {group(mt.vitamins, VITAMINS)}
        {group(mt.minerals, MINERALS)}
      </div>
      {data.nutrients.microCoveragePct < 100 && <p className="text-xs text-muted-foreground">{mt.coverage(data.nutrients.microCoveragePct)}</p>}
      <p className="text-xs text-muted-foreground">{mt.sources}</p>
    </div>
  );
}
