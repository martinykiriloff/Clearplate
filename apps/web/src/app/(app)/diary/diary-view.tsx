"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { AddFood } from "@/components/app/add-food";
import { MealList } from "@/components/app/meal-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher, type Today } from "@/lib/api";
import { cn, fmt, formatLongDate, localIsoDate, shiftIsoDate } from "@/lib/utils";

export function DiaryView() {
  const today = localIsoDate();
  const [date, setDate] = useState(today);
  const { data, mutate } = useSWR<Today>(`/today?date=${date}`, fetcher, { keepPreviousData: true });
  const refresh = () => void mutate();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setDate(shiftIsoDate(date, -1))} aria-label="Previous day">
          <ChevronLeftIcon />
        </Button>
        <h1 className="min-w-0 text-2xl font-semibold" aria-live="polite">
          {date === today ? "Today" : formatLongDate(date)}
        </h1>
        <Button variant="outline" size="icon" onClick={() => setDate(shiftIsoDate(date, 1))} disabled={date >= today} aria-label="Next day">
          <ChevronRightIcon />
        </Button>
        {date !== today && (
          <Button variant="link" onClick={() => setDate(today)}>
            Back to today
          </Button>
        )}
      </div>

      {!data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          {data.targets && data.remaining && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Goal" value={`${fmt(data.targets.calories)} kcal`} />
              <Stat label="Food" value={`${fmt(data.eaten.calories)} kcal`} />
              <Stat label={data.remaining.calories < 0 ? "Over" : "Left"} value={`${fmt(Math.abs(data.remaining.calories))} kcal`} accent={data.remaining.calories < 0 ? "over" : "left"} />
              <Stat label="Protein" value={`${fmt(data.eaten.proteinG)} / ${fmt(data.targets.proteinG)} g`} />
            </dl>
          )}
          <div className="flex flex-wrap items-start gap-6">
            <section aria-label="Logged food" className="min-w-0 flex-[999_1_520px] rounded-xl border bg-card p-6">
              <MealList meals={data.meals} onChange={refresh} />
            </section>
            <div className="min-w-0 flex-[1_1_380px]">
              <AddFood key={date} date={date} onAdded={refresh} />
            </div>
          </div>
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
