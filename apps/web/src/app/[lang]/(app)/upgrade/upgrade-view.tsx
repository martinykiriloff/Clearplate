"use client";

import { CheckIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { api, type PaidModule } from "@/lib/api";
import { useBilling } from "@/lib/billing";

const MODULES: PaidModule[] = ["barcode", "insights", "recipes", "data"];

export function UpgradeView() {
  const { t, locale, errorText, shortDate } = useI18n();
  const b = t.billing;
  const params = useSearchParams();
  const { billing, has, mutate } = useBilling();
  const [pending, setPending] = useState<string | null>(null);
  const announced = useRef(false);

  useEffect(() => {
    const result = params.get("checkout");
    if (!result || announced.current) return;
    announced.current = true;
    if (result === "success") {
      toast.success(b.success);
      // The webhook may land a moment after the redirect.
      void mutate();
      setTimeout(() => void mutate(), 2500);
    } else toast(b.canceled);
  }, [params, b, mutate]);

  const returnPath = `/${locale}/upgrade`;
  async function go(path: "/billing/checkout" | "/billing/portal", body: Record<string, unknown>, key: string) {
    setPending(key);
    try {
      const { url } = await api<{ url: string }>(path, { method: "POST", json: { ...body, returnPath } });
      window.location.assign(url);
    } catch (err) {
      toast.error(errorText(err));
      setPending(null);
    }
  }

  const plan = (id: "barcode" | "all") => billing?.plans.find((p) => p.plan === id);
  const hasStripe = billing?.entitlements.some((e) => e.source === "stripe");
  const allActive = MODULES.every((m) => has(m));

  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{b.title}</h1>
        <p className="text-muted-foreground">{b.lead}</p>
      </div>

      {billing && billing.entitlements.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-6">
          <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{b.yourPlan}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {billing.entitlements
              .filter((e) => e.status !== "canceled")
              .map((e, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Badge>{e.module === "all" ? b.all[0] : b.modules[e.module][0]}</Badge>
                  <span className="text-muted-foreground">{b.paidBy(e.source)}</span>
                  {e.currentPeriodEnd && <span className="text-muted-foreground">· {b.until(shortDate(e.currentPeriodEnd.slice(0, 10)))}</span>}
                </li>
              ))}
          </ul>
          {hasStripe && billing.payments && (
            <Button variant="outline" className="self-start" disabled={pending === "portal"} onClick={() => void go("/billing/portal", {}, "portal")}>
              {b.manage}
            </Button>
          )}
        </section>
      )}

      {billing && !billing.payments && !allActive && <p className="rounded-lg border border-dashed border-input p-4 text-sm text-muted-foreground">{b.notConfigured}</p>}

      <section className="grid gap-4 md:grid-cols-2">
        {MODULES.map((m) => {
          const [name, desc, price] = b.modules[m];
          const buyable = m === "barcode" ? plan("barcode") : undefined;
          return (
            <div key={m} className="flex flex-col gap-3 rounded-xl border bg-card p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{name}</h2>
                {has(m) ? (
                  <Badge>
                    <CheckIcon aria-hidden="true" className="size-3.5" />
                    {b.active}
                  </Badge>
                ) : (
                  <span className="tabular text-sm text-muted-foreground">
                    {price} {b.perMonth}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{desc}</p>
              {!has(m) && buyable && buyable.intervals.length > 0 && (
                <div className="mt-auto flex flex-wrap gap-2">
                  {buyable.intervals.map((iv) => (
                    <Button
                      key={iv}
                      variant="outline"
                      disabled={!!pending}
                      onClick={() => void go("/billing/checkout", { plan: "barcode", interval: iv }, `barcode-${iv}`)}
                    >
                      {b.buy(iv === "month" ? b.monthly.toLowerCase() : b.yearly.toLowerCase())}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-primary/50 bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{b.all[0]}</h2>
            <p className="text-sm text-muted-foreground">{b.all[1]}</p>
          </div>
          {allActive ? (
            <Badge>
              <CheckIcon aria-hidden="true" className="size-3.5" />
              {b.includedIn}
            </Badge>
          ) : (
            <p className="tabular text-right text-sm">
              <span className="text-2xl font-semibold">{b.all[2]}</span> {b.perMonth}
              <br />
              <span className="text-muted-foreground">
                {b.all[3]} {b.perYear}
              </span>
            </p>
          )}
        </div>
        {!allActive && (plan("all")?.intervals.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2">
            {plan("all")!.intervals.map((iv) => (
              <Button key={iv} disabled={!!pending} onClick={() => void go("/billing/checkout", { plan: "all", interval: iv }, `all-${iv}`)}>
                {b.buy(iv === "month" ? b.monthly.toLowerCase() : b.yearly.toLowerCase())}
              </Button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
