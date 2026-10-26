"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import type { Today } from "@/lib/api";
import { cn } from "@/lib/utils";

type MacroKey = "protein" | "fat" | "carbs";
const MACROS: MacroKey[] = ["protein", "fat", "carbs"];
/** Validated categorical palette (dark surface): distinct for deutan/protan/tritan, ΔE ≥ 13. */
const COLOR: Record<MacroKey, string> = { protein: "var(--protein)", fat: "var(--fat)", carbs: "var(--carbs)" };

/**
 * Where today's calories come from (donut) and the full daily macro table.
 * The donut is backed by the legend and the table, so nothing depends on colour alone.
 */
export function NutritionPanel({ data }: { data: Today }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="nutrition-title" className="flex flex-col gap-6 rounded-xl border bg-card p-6">
      <h2 id="nutrition-title" className="text-xl font-semibold">
        {t.nutrition.title}
      </h2>
      <MacroDonut data={data} />
      <NutrientTable data={data} />
    </section>
  );
}

function MacroDonut({ data }: { data: Today }) {
  const { t, n } = useI18n();
  const [hover, setHover] = useState<MacroKey | null>(null);
  const split = data.split.eaten;
  const grams: Record<MacroKey, number> = { protein: data.eaten.proteinG, fat: data.eaten.fatG, carbs: data.eaten.carbsG };
  const kcal: Record<MacroKey, number> = { protein: grams.protein * 4, fat: grams.fat * 9, carbs: grams.carbs * 4 };
  const total = kcal.protein + kcal.fat + kcal.carbs;
  const label = t.nutrition.splitLabel(split.protein, split.fat, split.carbs);

  // Geometry: r=70 ring, 18 px thick, 2 px surface gap between segments.
  const size = 180;
  const r = 70;
  const stroke = 18;
  const circ = 2 * Math.PI * r;
  const gap = total > 0 && MACROS.filter((m) => kcal[m] > 0).length > 1 ? 3 : 0;
  let offset = 0;
  const arcs = MACROS.map((m) => {
    const len = total > 0 ? (kcal[m] / total) * circ : 0;
    const arc = { m, dash: Math.max(len - gap, 0), offset };
    offset += len;
    return arc;
  });

  return (
    <div className="flex flex-wrap items-center gap-6">
      <figure className="relative m-0 shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={total > 0 ? label : t.nutrition.empty}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
          {total > 0 &&
            arcs.map(({ m, dash, offset: off }) =>
              dash > 0 ? (
                <circle
                  key={m}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={COLOR[m]}
                  strokeWidth={hover === m ? stroke + 4 : stroke}
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={-off}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  opacity={hover && hover !== m ? 0.45 : 1}
                  onMouseEnter={() => setHover(m)}
                  onMouseLeave={() => setHover(null)}
                  style={{ transition: "opacity 120ms, stroke-width 120ms" }}
                />
              ) : null,
            )}
        </svg>
        <figcaption className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {hover ? (
            <>
              <span className="tabular text-2xl font-medium">{split[hover]}%</span>
              <span className="text-xs text-muted-foreground">{t.nutrition[hover]}</span>
            </>
          ) : (
            <>
              <span className="tabular text-2xl font-medium">{n(total)}</span>
              <span className="text-xs text-muted-foreground">{t.common.kcal}</span>
            </>
          )}
        </figcaption>
      </figure>

      {/* Wraps under the donut on phones instead of squeezing beside it */}
      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t.nutrition.splitTitle}</h3>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">{t.nutrition.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {MACROS.map((m) => (
              <li
                key={m}
                className={cn(
                  "grid grid-cols-[0.75rem_minmax(0,1fr)_auto_auto] items-center gap-x-3 rounded-md px-2 py-1.5 text-sm transition-colors sm:grid-cols-[0.75rem_minmax(0,1fr)_auto_auto_auto]",
                  hover === m && "bg-secondary",
                )}
                onMouseEnter={() => setHover(m)}
                onMouseLeave={() => setHover(null)}
              >
                <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ background: COLOR[m] }} />
                <span className="min-w-0 font-medium break-words">{t.nutrition[m]}</span>
                <span className="tabular text-right">{split[m]}%</span>
                <span className="tabular text-right whitespace-nowrap text-muted-foreground">
                  {n(grams[m])} {t.common.g}
                </span>
                {data.split.target && <span className="hidden text-right text-xs whitespace-nowrap text-muted-foreground sm:block">{t.nutrition.target(data.split.target[m])}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type Row = {
  key: string;
  name: string;
  eaten: number;
  unit: string;
  goal: number | null;
  kind: "target" | "min" | "max" | "none";
  note?: string;
  color?: string;
};

function NutrientTable({ data }: { data: Today }) {
  const { t, n, n1 } = useI18n();
  const nt = t.nutrition;
  const g = t.common.g;
  const goals = data.nutrientGoals;
  const tg = data.targets;

  const rows: Row[] = [
    { key: "protein", name: nt.protein, eaten: data.eaten.proteinG, unit: g, goal: tg?.proteinG ?? null, kind: "target", color: COLOR.protein },
    { key: "fat", name: nt.fat, eaten: data.eaten.fatG, unit: g, goal: tg?.fatG ?? null, kind: "target", color: COLOR.fat },
    { key: "carbs", name: nt.carbs, eaten: data.eaten.carbsG, unit: g, goal: tg?.carbsG ?? null, kind: "target", color: COLOR.carbs },
    { key: "fiber", name: nt.fiber, eaten: data.nutrients.fiberG, unit: g, goal: goals?.fiberMinG ?? null, kind: "min" },
    { key: "sugar", name: nt.sugar, eaten: data.nutrients.sugarG, unit: g, goal: null, kind: "none", note: nt.sugarNote },
    { key: "satFat", name: nt.satFat, eaten: data.nutrients.satFatG, unit: g, goal: goals?.satFatMaxG ?? null, kind: "max" },
    { key: "sodium", name: nt.sodium, eaten: data.nutrients.sodiumMg, unit: t.common.mg, goal: goals?.sodiumMaxMg ?? null, kind: "max" },
  ];

  const fmtV = (v: number, unit: string) => `${unit === g ? n1(v) : n(v)} ${unit}`;
  const goalText = (r: Row) => {
    if (r.goal == null || r.kind === "none") return nt.noGoal;
    const v = fmtV(r.goal, r.unit);
    return r.kind === "min" ? nt.atLeast(v) : r.kind === "max" ? nt.atMost(v) : v;
  };
  const status = (r: Row): { text: string; tone: "ok" | "warn" | "muted" } => {
    if (r.goal == null || r.kind === "none") return { text: "", tone: "muted" };
    if (r.kind === "max") return r.eaten > r.goal ? { text: nt.statusHigh, tone: "warn" } : { text: nt.statusOk, tone: "ok" };
    if (r.eaten >= r.goal) return r.kind === "target" && r.eaten > r.goal * 1.1 ? { text: nt.statusHigh, tone: "warn" } : { text: nt.statusOk, tone: "ok" };
    return { text: nt.statusLeft(fmtV(r.goal - r.eaten, r.unit)), tone: "muted" };
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{nt.tableTitle}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 font-medium">
                {nt.nutrient}
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                {nt.eaten}
              </th>
              <th scope="col" className="py-2 pl-4 font-medium">
                {nt.goal}
              </th>
              <th scope="col" className="w-[30%] py-2 pl-4 font-medium">
                {nt.status}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = status(r);
              const pct = r.goal ? Math.min(100, Math.round((r.eaten / r.goal) * 100)) : 0;
              return (
                <tr key={r.key} className="border-t align-top">
                  <th scope="row" className="py-2.5 font-medium">
                    <span className="flex items-center gap-2">
                      {r.color && <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: r.color }} />}
                      {r.name}
                    </span>
                    {r.note && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{r.note}</span>}
                  </th>
                  <td className="tabular py-2.5 text-right whitespace-nowrap">{fmtV(r.eaten, r.unit)}</td>
                  <td className="py-2.5 pl-4 whitespace-nowrap text-muted-foreground">{goalText(r)}</td>
                  <td className="py-2.5 pl-4">
                    {r.goal != null && r.kind !== "none" && (
                      <div className="flex flex-col gap-1.5">
                        <div className="h-1.5 overflow-hidden rounded-full bg-track">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: st.tone === "warn" ? "var(--estimate)" : (r.color ?? "var(--primary)") }}
                          />
                        </div>
                        <span className={cn("text-xs", st.tone === "warn" ? "font-semibold text-estimate" : "text-muted-foreground")}>{st.text}</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data.nutrients.coveragePct < 100 && <p className="text-xs text-muted-foreground">{nt.coverage(data.nutrients.coveragePct)}</p>}
      <p className="text-xs text-muted-foreground">{nt.sources}</p>
    </div>
  );
}
