"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, fetcher, type Profile, type Targets } from "@/lib/api";
import { useUser } from "@/lib/session";
import { fmt, localIsoDate } from "@/lib/utils";

const GOAL: Record<Profile["goal"], string> = { lose: "Lose fat", gain: "Build muscle", habits: "Eat better, same weight" };
const ACTIVITY: Record<Profile["activity"], string> = {
  sedentary: "Mostly sitting",
  light: "Lightly active",
  moderate: "Moderately active",
  active: "Very active",
  very_active: "Athlete or physical job",
};

export function SettingsView() {
  const router = useRouter();
  const { user, mutate: mutateUser } = useUser();
  const { data } = useSWR<{ profile: Profile; targets: Targets | null }>(`/profile?date=${localIsoDate()}`, fetcher);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    await mutateUser(undefined, { revalidate: false });
    router.replace("/login");
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-6">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Account</h2>
        <p>{user?.email}</p>
        <Button variant="outline" className="self-start" onClick={() => void logout()}>
          Log out
        </Button>
      </section>

      {data && (
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-6">
          <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Your plan</h2>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Row k="Goal" v={GOAL[data.profile.goal]} />
            <Row k="Activity" v={ACTIVITY[data.profile.activity]} />
            <Row k="Pace" v={data.profile.pace} />
            <Row k="Units" v={data.profile.unitSystem} />
            {data.targets && <Row k="Daily calories" v={`${fmt(data.targets.calories)} kcal`} />}
            {data.targets && <Row k="Protein / fat / carbs" v={`${fmt(data.targets.proteinG)} / ${fmt(data.targets.fatG)} / ${fmt(data.targets.carbsG)} g`} />}
          </dl>
          <Button asChild variant="outline" className="self-start">
            <Link href="/onboarding">Redo the questionnaire</Link>
          </Button>
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-xl border border-destructive/40 bg-card p-6">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-destructive uppercase">Delete account</h2>
        <p className="text-sm text-muted-foreground">Permanently deletes your account, questionnaire, diary, weigh-ins and recipes. This cannot be undone.</p>
        <Button variant="destructive" className="self-start" onClick={() => setConfirmDelete(true)}>
          Delete my account
        </Button>
      </section>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <form
            className="flex flex-col gap-5"
            onSubmit={async (e) => {
              e.preventDefault();
              await api("/auth/me", { method: "DELETE" });
              await mutateUser(undefined, { revalidate: false });
              router.replace("/");
            }}
          >
            <DialogHeader>
              <DialogTitle>Delete everything?</DialogTitle>
              <DialogDescription>Type DELETE to confirm. All your data is removed right away.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm">Confirmation</Label>
              <Input id="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </div>
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={typed !== "DELETE"}>
                Delete permanently
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
      <dd className="capitalize">{v}</dd>
    </div>
  );
}
