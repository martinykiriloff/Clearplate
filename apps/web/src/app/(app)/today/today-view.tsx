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
import { api, fetcher, MEAL_LABEL, type Today } from "@/lib/api";
import { fmt, fmt1, formatLongDate, localIsoDate } from "@/lib/utils";

export function TodayView() {
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
      <h1 className="text-2xl font-semibold">{formatLongDate(date)}</h1>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_620px] flex-col gap-6">
          {data.targets && data.remaining ? (
            <BudgetCard targets={data.targets} eaten={data.eaten} remaining={data.remaining} />
          ) : (
            <section className="rounded-xl border bg-card p-6">
              <p>
                Finish the questionnaire to get your daily budget.{" "}
                <Link className="text-primary underline" href="/onboarding">
                  Start
                </Link>
              </p>
            </section>
          )}
          <AddFood date={date} onAdded={refresh} />
          <section aria-labelledby="eaten-title" className="flex flex-col gap-4 rounded-xl border bg-card p-6">
            <h2 id="eaten-title" className="text-xl font-semibold">
              Today&apos;s food
            </h2>
            <MealList meals={data.meals} onChange={refresh} />
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          <NextBest data={data} date={date} onAdded={refresh} />
          <WeightCard data={data} />
          <section className="rounded-xl border bg-card p-6">
            <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Streak</h2>
            <p className="mt-3 text-[15px] leading-relaxed">
              {data.streak > 0 ? (
                <>
                  <span className="tabular font-medium">{data.streak}</span> {data.streak === 1 ? "day" : "days"} in a row with a logged diary.
                </>
              ) : (
                "Log something today to start a streak."
              )}{" "}
              <span className="text-muted-foreground">Miss a day and the count simply starts again, no guilt.</span>
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function NextBest({ data, date, onAdded }: { data: Today; date: string; onAdded: () => void }) {
  const [pending, setPending] = useState(false);
  const s = data.nextBestFood;
  if (!s) return null;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-dashed border-input bg-card p-6">
      <h2 className="text-xs font-semibold tracking-[0.06em] text-primary uppercase">Next best food</h2>
      <p className="text-xl leading-snug font-semibold">{s.name}</p>
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        {s.reason} {MEAL_LABEL[s.meal]}, about <span className="tabular">{fmt(s.kcal)}</span> kcal.
      </p>
      <Button
        className="self-start"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await api("/diary", { method: "POST", json: { date, meal: s.meal, recipeId: s.recipeId, servings: 1 } });
            toast.success(`Added ${s.name}`);
            onAdded();
          } finally {
            setPending(false);
          }
        }}
      >
        Add to {MEAL_LABEL[s.meal].toLowerCase()}
      </Button>
    </section>
  );
}

function WeightCard({ data }: { data: Today }) {
  const w = data.weight;
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-6">
      <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Weight · trend</h2>
      {w ? (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="tabular text-4xl font-medium">{fmt1(w.trendKg)}</span>
            <span>kg</span>
            {w.change7dKg != null && (
              <span className="text-sm font-semibold text-primary">
                {w.change7dKg > 0 ? "+" : ""}
                {fmt1(w.change7dKg)} in 7 days
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">Smoothed trend, not a single weigh-in. Last weigh-in {fmt1(w.weightKg)} kg.</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No weigh-ins yet.</p>
      )}
      <Button asChild variant="outline" className="self-start">
        <Link href="/progress">Log weight</Link>
      </Button>
    </section>
  );
}
