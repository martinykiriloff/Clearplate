"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { AddFood } from "@/components/app/add-food";
import { MealList } from "@/components/app/meal-list";
import { NutritionPanel } from "@/components/app/nutrition-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/provider";
import { fetcher, type Today } from "@/lib/api";
import { cn, localIsoDate, shiftIsoDate } from "@/lib/utils";

export function DiaryView() {
  const { t, n, longDate } = useI18n();
  const d = t.diary;
  const today = localIsoDate();
  const [date, setDate] = useState(today);
  const { data, mutate } = useSWR<Today>(`/today?date=${date}`, fetcher, { keepPreviousData: true });
  const refresh = () => void mutate();
  const kcal = (v: number) => `${n(v)} ${t.common.kcal}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setDate(shiftIsoDate(date, -1))} aria-label={d.prevDay}>
          <ChevronLeftIcon />
        </Button>
        <h1 className="min-w-0 text-2xl font-semibold first-letter:uppercase" aria-live="polite">
          {date === today ? d.today : longDate(date)}
        </h1>
        <Button variant="outline" size="icon" onClick={() => setDate(shiftIsoDate(date, 1))} disabled={date >= today} aria-label={d.nextDay}>
          <ChevronRightIcon />
        </Button>
        {date !== today && (
          <Button variant="link" onClick={() => setDate(today)}>
            {d.backToToday}
          </Button>
        )}
      </div>

      {/* Previous day's data is kept while loading, but never shown under the new date */}
      {!data || data.date !== date ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          {data.targets && data.remaining && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={d.goal} value={kcal(data.targets.calories)} />
              <Stat label={d.food} value={kcal(data.eaten.calories)} />
              <Stat label={data.remaining.calories < 0 ? d.over : d.left} value={kcal(Math.abs(data.remaining.calories))} accent={data.remaining.calories < 0 ? "over" : "left"} />
              <Stat label={d.protein} value={`${n(data.eaten.proteinG)} / ${n(data.targets.proteinG)} ${t.common.g}`} />
            </dl>
          )}
          <div className="flex flex-wrap items-start gap-6">
            <section aria-label={d.logged} className="min-w-0 flex-[999_1_520px] rounded-xl border bg-card p-6">
              <MealList meals={data.meals} date={date} onChange={refresh} />
            </section>
            <div className="min-w-0 flex-[1_1_380px]">
              <AddFood key={date} date={date} onAdded={refresh} />
            </div>
          </div>
          <NutritionPanel data={data} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "left" | "over" }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("tabular mt-1 text-lg font-medium", accent === "left" && "text-primary", accent === "over" && "text-fat")}>{value}</dd>
    </div>
  );
}
