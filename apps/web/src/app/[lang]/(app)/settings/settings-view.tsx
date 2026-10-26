"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { LocaleSwitch } from "@/components/app/locale-switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/provider";
import { api, fetcher, type Profile, type Targets } from "@/lib/api";
import { useBilling } from "@/lib/billing";
import { hardNavigate, useUser } from "@/lib/session";
import { localIsoDate } from "@/lib/utils";

export function SettingsView() {
  const { t, n, href } = useI18n();
  const s = t.settings;
  const { user } = useUser();
  const { billing } = useBilling();
  const activeModules = billing ? (Object.entries(billing.modules) as [keyof typeof t.billing.modules, boolean][]).filter(([, on]) => on).map(([m]) => t.billing.modules[m][0]) : [];
  const { data } = useSWR<{ profile: Profile; targets: Targets | null }>(`/profile?date=${localIsoDate()}`, fetcher);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");

  async function logout(everywhere = false) {
    await api(everywhere ? "/auth/logout-all" : "/auth/logout", { method: "POST" });
    hardNavigate(href("/login"));
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{s.title}</h1>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-6">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{s.account}</h2>
        <p>{user?.email}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void logout()}>
            {s.logout}
          </Button>
          <Button variant="ghost" onClick={() => void logout(true)}>
            {s.logoutAll}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-6">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t.billing.yourPlan}</h2>
        <p>{activeModules.length ? activeModules.join(" · ") : t.billing.free}</p>
        <Button asChild variant="outline" className="self-start">
          <Link href={href("/upgrade")}>{t.billing.upgrade}</Link>
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-6">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{s.language}</h2>
        <p className="text-sm text-muted-foreground">{s.languageHint}</p>
        <LocaleSwitch signedIn className="self-start" />
      </section>

      {data && (
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-6">
          <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{s.plan}</h2>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Row k={s.goal} v={t.onboarding.goals[data.profile.goal][0]} />
            <Row k={s.activity} v={t.onboarding.activity[data.profile.activity][0]} />
            <Row k={s.pace} v={s.paces[data.profile.pace]} />
            <Row k={s.units} v={s.unitNames[data.profile.unitSystem]} />
            {data.targets && <Row k={s.calories} v={`${n(data.targets.calories)} ${t.common.kcal}`} />}
            {data.targets && <Row k={s.macros} v={`${n(data.targets.proteinG)} / ${n(data.targets.fatG)} / ${n(data.targets.carbsG)} ${t.common.g}`} />}
          </dl>
          <Button asChild variant="outline" className="self-start">
            <Link href={href("/onboarding")}>{s.redo}</Link>
          </Button>
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-xl border border-destructive/40 bg-card p-6">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-destructive uppercase">{s.deleteTitle}</h2>
        <p className="text-sm text-muted-foreground">{s.deleteLead}</p>
        <Button variant="destructive" className="self-start" onClick={() => setConfirmDelete(true)}>
          {s.deleteButton}
        </Button>
      </section>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <form
            className="flex flex-col gap-5"
            onSubmit={async (e) => {
              e.preventDefault();
              await api("/auth/me", { method: "DELETE" });
              hardNavigate(href("/"));
            }}
          >
            <DialogHeader>
              <DialogTitle>{s.confirmTitle}</DialogTitle>
              <DialogDescription>{s.confirmLead}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm">{s.confirmation}</Label>
              <Input id="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </div>
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={typed.trim().toUpperCase() !== s.confirmWord}>
                {s.deleteForever}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
