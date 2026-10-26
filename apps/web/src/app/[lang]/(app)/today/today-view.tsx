"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { AddFood } from "@/components/app/add-food";
import { BudgetCard } from "@/components/app/budget-card";
import { MealList } from "@/components/app/meal-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/provider";
import { api, fetcher, type Today } from "@/lib/api";
import { localIsoDate } from "@/lib/utils";

export function TodayView() {
  const { t, href, longDate } = useI18n();
  const [date] = useState(localIsoDate);
  const [hour] = useState(() => new Date().getHours());
  const { data, mutate } = useSWR<Today>(`/today?date=${date}&hour=${hour}`, fetcher);

  if (!data) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const refresh = () => void mutate();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold first-letter:uppercase">{longDate(date)}</h1>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_620px] flex-col gap-6">
          {data.targets && data.remaining ? (
            <BudgetCard targets={data.targets} eaten={data.eaten} remaining={data.remaining} />
          ) : (
            <section className="rounded-xl border bg-card p-6">
              <p>
                {t.today.finishQuestionnaire}{" "}
                <Link className="text-primary underline" href={href("/onboarding")}>
                  {t.today.start}
                </Link>
              </p>
            </section>
          )}
          <AddFood date={date} onAdded={refresh} />
          <section aria-labelledby="eaten-title" className="flex flex-col gap-4 rounded-xl border bg-card p-6">
            <h2 id="eaten-title" className="text-xl font-semibold">
              {t.today.todaysFood}
            </h2>
            <MealList meals={data.meals} onChange={refresh} />
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          <NextBest data={data} date={date} onAdded={refresh} />
          <WeightCard data={data} />
          <section className="rounded-xl border bg-card p-6">
            <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t.today.streak}</h2>
            <p className="mt-3 text-[15px] leading-relaxed">
              {data.streak > 0 ? t.today.streakDays(data.streak) : t.today.streakStart} <span className="text-muted-foreground">{t.today.streakNoGuilt}</span>
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function NextBest({ data, date, onAdded }: { data: Today; date: string; onAdded: () => void }) {
  const { t, n, pick, errorText } = useI18n();
  const [pending, setPending] = useState(false);
  const s = data.nextBestFood;
  if (!s) return null;
  const name = pick(s.name, s.nameBg);
  const reason = s.reason.kind === "protein_gap" ? t.today.reasonProtein(s.reason.coveredG, s.reason.gapG) : t.today.reasonBudget(s.reason.leftKcal);
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-dashed border-input bg-card p-6">
      <h2 className="text-xs font-semibold tracking-[0.06em] text-primary uppercase">{t.today.nextBest}</h2>
      <p className="text-xl leading-snug font-semibold">{name}</p>
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        {reason} {t.today.aboutKcal(t.meals[s.meal], n(s.kcal))}
      </p>
      <Button
        className="self-start"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await api("/diary", { method: "POST", json: { date, meal: s.meal, recipeId: s.recipeId, servings: 1 } });
            toast.success(t.today.added(name));
            onAdded();
          } catch (err) {
            toast.error(errorText(err));
          } finally {
            setPending(false);
          }
        }}
      >
        {t.today.addTo(t.mealsInline[s.meal])}
      </Button>
    </section>
  );
}

function WeightCard({ data }: { data: Today }) {
  const { t, n1, href } = useI18n();
  const w = data.weight;
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-6">
      <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t.today.weightTrend}</h2>
      {w ? (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="tabular text-4xl font-medium">{n1(w.trendKg)}</span>
            <span>{t.common.kg}</span>
            {w.change7dKg != null && (
              <span className="text-sm font-semibold text-primary">
                {w.change7dKg > 0 ? "+" : ""}
                {n1(w.change7dKg)} {t.today.in7Days}
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">{t.today.trendNote(n1(w.weightKg), t.common.kg)}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t.today.noWeighIns}</p>
      )}
      <Button asChild variant="outline" className="self-start">
        <Link href={href("/progress")}>{t.today.logWeight}</Link>
      </Button>
    </section>
  );
}
