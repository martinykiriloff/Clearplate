"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { TrendChart } from "@/components/app/trend-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/provider";
import { api, fetcher, type Profile, type Targets, type WeightRange } from "@/lib/api";
import { KG_PER_LB, localIsoDate } from "@/lib/utils";

export function ProgressView() {
  const { t, n1, shortDate, errorText } = useI18n();
  const p = t.progress;
  const today = localIsoDate();
  const { data, mutate } = useSWR<WeightRange>(`/weights?to=${today}`, fetcher);
  const { data: profile } = useSWR<{ profile: Profile; targets: Targets | null }>(`/profile?date=${today}`, fetcher);
  const imperial = profile?.profile.unitSystem === "imperial";
  const unit = imperial ? t.common.lb : t.common.kg;
  const conv = (kg: number) => (imperial ? kg / KG_PER_LB : kg);
  const show = (kg: number) => n1(conv(kg));

  const [date, setDate] = useState(today);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{p.title}</h1>
      <div className="flex flex-wrap items-start gap-6">
        <section aria-labelledby="trend-title" className="flex min-w-0 flex-[999_1_560px] flex-col gap-5 rounded-xl border bg-card p-6">
          <h2 id="trend-title" className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {p.trendTitle}
          </h2>
          {!data ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              {data.summary && (
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <span className="tabular text-4xl font-medium">{show(data.summary.trendKg)}</span>
                  <span>
                    {unit} {p.trend}
                  </span>
                  {data.summary.change7dKg != null && (
                    <span className="text-sm font-semibold text-primary">
                      {data.summary.change7dKg > 0 ? "+" : ""}
                      {show(data.summary.change7dKg)} {unit} {p.in7Days}
                    </span>
                  )}
                </p>
              )}
              <TrendChart
                points={data.points.map((pt) => ({ ...pt, weightKg: conv(pt.weightKg), trendKg: conv(pt.trendKg) }))}
                unit={unit}
                label={p.chartLabel(data.points.length)}
              />
              <p className="text-sm text-muted-foreground">{p.chartNote}</p>
            </>
          )}
        </section>

        <section aria-labelledby="log-title" className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 rounded-xl border bg-card p-6">
          <h2 id="log-title" className="text-xl font-semibold">
            {p.logTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{p.logHint}</p>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const v = Number(value);
              if (!(v > 0)) return;
              setPending(true);
              try {
                await api("/weights", { method: "PUT", json: { date, weightKg: Math.round((imperial ? v * KG_PER_LB : v) * 10) / 10 } });
                setValue("");
                toast.success(p.saved);
                void mutate();
              } catch (err) {
                toast.error(errorText(err));
              } finally {
                setPending(false);
              }
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="w-date">{p.date}</Label>
              <Input id="w-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="w-value">{p.weight(unit)}</Label>
              <Input id="w-value" type="number" inputMode="decimal" step="0.1" min={imperial ? 77 : 35} max={imperial ? 770 : 350} value={value} onChange={(e) => setValue(e.target.value)} required />
            </div>
            <Button type="submit" disabled={pending} className="self-start">
              {t.common.save}
            </Button>
          </form>
        </section>
      </div>

      {data && data.points.length > 0 && (
        <section aria-labelledby="history-title" className="rounded-xl border bg-card p-6">
          <h2 id="history-title" className="mb-3 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {p.weighIns}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 font-medium">
                    {p.date}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    {p.weightCol}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    {p.trendCol}
                  </th>
                  <th scope="col" className="py-2">
                    <span className="sr-only">{p.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...data.points].reverse().map((pt) => (
                  <tr key={pt.date} className="border-t">
                    <td className="py-2">{shortDate(pt.date)}</td>
                    <td className="tabular py-2">
                      {show(pt.weightKg)} {unit}
                    </td>
                    <td className="tabular py-2 text-muted-foreground">
                      {show(pt.trendKg)} {unit}
                    </td>
                    <td className="py-1 text-right">
                      <Button
                        variant="link"
                        size="sm"
                        aria-label={p.deleteAria(shortDate(pt.date))}
                        onClick={async () => {
                          await api(`/weights/${pt.date}`, { method: "DELETE" });
                          void mutate();
                        }}
                      >
                        {t.common.delete}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
