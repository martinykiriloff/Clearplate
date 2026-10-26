"use client";

import { computeTargets, type ActivityLevel, type Goal, type Pace, type Sex, type Targets } from "@clearplate/targets";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { mutate } from "swr";
import { ChoiceGroup } from "@/components/app/choice-group";
import { LocaleSwitch } from "@/components/app/locale-switch";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/i18n/provider";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/session";
import { CM_PER_IN, cn, KG_PER_LB, localIsoDate } from "@/lib/utils";

type Units = "metric" | "imperial";

interface Answers {
  goal?: Goal;
  units: Units;
  sex?: Sex;
  birthDate: string;
  heightCm?: number;
  weightKg?: number;
  activity?: ActivityLevel;
  pace: Pace;
  targetWeightKg?: number;
  healthDataConsent: boolean;
  marketingConsent: boolean;
}

const STEP_COUNT = 5;
const GOALS: Goal[] = ["lose", "gain", "habits"];
const ACTIVITIES: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];
const PACES: Pace[] = ["gentle", "standard", "fast"];

function ageFrom(birthDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = localIsoDate().split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export function OnboardingFlow() {
  const router = useRouter();
  const { t, href, errorText } = useI18n();
  const o = t.onboarding;
  const { user } = useRequireUser({ allowNotOnboarded: true });
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({ units: "metric", birthDate: "", pace: "standard", healthDataConsent: false, marketingConsent: false });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((prev) => ({ ...prev, [k]: v }));

  const age = ageFrom(a.birthDate);

  // Live plan: recomputed on every answer so the user sees what each one changes.
  const preview: Targets | null = useMemo(() => {
    if (!a.goal || !a.sex || age == null || !a.heightCm || !a.weightKg) return null;
    try {
      return computeTargets({
        sex: a.sex,
        age,
        heightCm: a.heightCm,
        weightKg: a.weightKg,
        activity: a.activity ?? "light",
        goal: a.goal,
        pace: a.pace,
        targetWeightKg: a.targetWeightKg ?? null,
      });
    } catch {
      return null;
    }
  }, [a, age]);

  const stepValid = [
    !!a.goal,
    !!a.sex && age != null && age >= 18 && age <= 100 && !!a.heightCm && a.heightCm >= 120 && a.heightCm <= 230 && !!a.weightKg && a.weightKg >= 35 && a.weightKg <= 350,
    !!a.activity,
    a.targetWeightKg == null || (a.targetWeightKg >= 35 && a.targetWeightKg <= 350),
    a.healthDataConsent,
  ][step];

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await api("/profile", {
        method: "PUT",
        json: {
          sex: a.sex,
          birthDate: a.birthDate,
          heightCm: Math.round(a.heightCm! * 10) / 10,
          weightKg: Math.round(a.weightKg! * 10) / 10,
          activity: a.activity,
          goal: a.goal,
          pace: a.pace,
          ...(a.targetWeightKg ? { targetWeightKg: Math.round(a.targetWeightKg * 10) / 10 } : {}),
          unitSystem: a.units,
          healthDataConsent: a.healthDataConsent,
          marketingConsent: a.marketingConsent,
          today: localIsoDate(),
        },
      });
      // Refresh the cached user so the app shell sees onboarded: true.
      await mutate("/auth/me");
      router.replace(href("/today"));
    } catch (e) {
      setError(errorText(e, { 400: o.couldNotSave }));
      setPending(false);
    }
  }

  function next() {
    if (!stepValid) return;
    if (step === STEP_COUNT - 1) void submit();
    else setStep(step + 1);
  }

  if (!user) return null;

  const paceChoices = a.goal === "gain" ? o.pace.gain : o.pace.lose;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo path="/onboarding" />
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sm text-muted-foreground">{o.step(step + 1, STEP_COUNT, o.steps[step])}</p>
          <LocaleSwitch signedIn />
        </div>
      </header>
      <Progress value={((step + 1) / STEP_COUNT) * 100} aria-label={o.progressLabel} />

      <div className="flex flex-wrap items-start gap-8">
        <form
          className="flex min-w-0 flex-[999_1_520px] flex-col gap-8"
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          {step === 0 && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">{o.goalTitle}</h1>
              <ChoiceGroup<Goal>
                name="goal"
                legend={o.goalLegend}
                value={a.goal}
                onChange={(v) => set("goal", v)}
                choices={GOALS.map((g) => ({ value: g, label: o.goals[g][0], description: o.goals[g][1] }))}
              />
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">{o.aboutTitle}</h1>
              <p className="-mt-4 text-muted-foreground">{o.aboutLead}</p>
              <ChoiceGroup<Units>
                name="units"
                legend={o.units}
                columns={2}
                value={a.units}
                onChange={(v) => set("units", v)}
                choices={[
                  { value: "metric", label: o.metric[0], description: o.metric[1] },
                  { value: "imperial", label: o.imperial[0], description: o.imperial[1] },
                ]}
              />
              <ChoiceGroup<Sex>
                name="sex"
                legend={o.sex}
                columns={2}
                value={a.sex}
                onChange={(v) => set("sex", v)}
                choices={[
                  { value: "female", label: o.female },
                  { value: "male", label: o.male },
                ]}
              />
              <div className="flex flex-col gap-2">
                <Label htmlFor="birthDate">{o.birthDate}</Label>
                <Input id="birthDate" type="date" value={a.birthDate} max={localIsoDate()} onChange={(e) => set("birthDate", e.target.value)} required aria-describedby="age-hint" />
                <p id="age-hint" className={cn("text-sm", age != null && age < 18 ? "text-destructive" : "text-muted-foreground")}>
                  {age != null && age < 18 ? o.adultsOnly : o.mustBeAdult}
                </p>
              </div>
              <MeasureInputs units={a.units} heightCm={a.heightCm} weightKg={a.weightKg} onHeight={(v) => set("heightCm", v)} onWeight={(v) => set("weightKg", v)} />
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">{o.activityTitle}</h1>
              <ChoiceGroup<ActivityLevel>
                name="activity"
                legend={o.activityLegend}
                value={a.activity}
                onChange={(v) => set("activity", v)}
                choices={ACTIVITIES.map((v) => ({ value: v, label: o.activity[v][0], description: o.activity[v][1] }))}
              />
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">{a.goal === "habits" ? o.paceTitleHabits : o.paceTitle}</h1>
              {a.goal !== "habits" && (
                <ChoiceGroup<Pace>
                  name="pace"
                  legend={o.paceLegend}
                  value={a.pace}
                  onChange={(v) => set("pace", v)}
                  choices={PACES.map((p) => ({ value: p, label: paceChoices[p][0], description: paceChoices[p][1] }))}
                />
              )}
              <TargetWeightInput units={a.units} value={a.targetWeightKg} onChange={(v) => set("targetWeightKg", v)} />
            </>
          )}

          {step === 4 && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">{o.consentTitle}</h1>
              <p className="-mt-4 text-muted-foreground">{o.consentLead}</p>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4">
                <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={a.healthDataConsent} onChange={(e) => set("healthDataConsent", e.target.checked)} required />
                <span>
                  <span className="font-semibold">{o.healthConsent}</span>
                  <span className="block text-sm text-muted-foreground">{o.healthConsentHint}</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4">
                <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={a.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} />
                <span>
                  <span className="font-semibold">{o.marketingConsent}</span>
                  <span className="block text-sm text-muted-foreground">{o.marketingConsentHint}</span>
                </span>
              </label>
              <p className="text-sm text-muted-foreground">{o.medicalNote}</p>
            </>
          )}

          {error && (
            <p role="alert" className="rounded-md border border-destructive/40 px-3.5 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {step > 0 && (
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(step - 1)}>
                {t.common.back}
              </Button>
            )}
            <Button type="submit" size="lg" disabled={!stepValid || pending}>
              {step === STEP_COUNT - 1 ? (pending ? o.saving : o.start) : t.common.continue}
            </Button>
          </div>
        </form>

        <PlanPreview preview={preview} goal={a.goal} />
      </div>
    </div>
  );
}

function PlanPreview({ preview, goal }: { preview: Targets | null; goal?: Goal }) {
  const { t, n, n1 } = useI18n();
  const o = t.onboarding;
  return (
    <aside aria-live="polite" className="flex min-w-0 flex-[1_1_300px] flex-col gap-5 rounded-xl border bg-card p-6">
      <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{o.planTitle}</h2>
      {!preview ? (
        <p className="text-sm text-muted-foreground">{o.planEmpty}</p>
      ) : (
        <>
          <div>
            <div className="tabular text-5xl font-medium text-primary">{n(preview.calories)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{o.perDay(n(preview.tdee))}</div>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            {(
              [
                [o.protein, preview.proteinG],
                [o.fat, preview.fatG],
                [o.carbs, preview.carbsG],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="min-w-0 rounded-lg bg-background p-3">
                <dt className="truncate text-muted-foreground">{k}</dt>
                <dd className="tabular mt-1 text-base whitespace-nowrap">
                  {n(v)} {t.common.g}
                </dd>
              </div>
            ))}
          </dl>
          {goal !== "habits" && preview.expectedWeeklyChangeKg !== 0 && (
            <p className="text-sm">
              {o.expected}{" "}
              <span className="tabular">
                {preview.expectedWeeklyChangeKg > 0 ? "+" : ""}
                {n1(preview.expectedWeeklyChangeKg)} {t.common.kg}
              </span>{" "}
              {o.perWeek} <span className="text-muted-foreground">{o.estimateNote}</span>
            </p>
          )}
          {preview.warnings.map((w) => (
            <p key={w} className="rounded-md border border-estimate/40 px-3 py-2 text-sm text-estimate">
              {o.warnings[w] ?? w}
            </p>
          ))}
        </>
      )}
    </aside>
  );
}

function NumberField({ id, label, unit, value, onChange, step = 0.1 }: { id: string; label: string; unit: string; value?: number; onChange: (v?: number) => void; step?: number }) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          value={value == null || Number.isNaN(value) ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          className="pr-12"
        />
        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function MeasureInputs({ units, heightCm, weightKg, onHeight, onWeight }: { units: Units; heightCm?: number; weightKg?: number; onHeight: (v?: number) => void; onWeight: (v?: number) => void }) {
  const { t } = useI18n();
  const o = t.onboarding;
  if (units === "metric") {
    return (
      <div className="flex flex-wrap gap-4">
        <NumberField id="height" label={o.height} unit={t.common.cm} step={1} value={heightCm} onChange={onHeight} />
        <NumberField id="weight" label={o.weight} unit={t.common.kg} value={weightKg} onChange={onWeight} />
      </div>
    );
  }
  const totalIn = heightCm ? heightCm / CM_PER_IN : undefined;
  const ft = totalIn != null ? Math.floor(totalIn / 12) : undefined;
  const inch = totalIn != null ? Math.round(totalIn - (ft ?? 0) * 12) : undefined;
  const setFtIn = (f?: number, i?: number) => onHeight(f == null && i == null ? undefined : ((f ?? 0) * 12 + (i ?? 0)) * CM_PER_IN);
  return (
    <div className="flex flex-wrap gap-4">
      <NumberField id="height-ft" label={o.heightFt} unit="ft" step={1} value={ft} onChange={(v) => setFtIn(v, inch)} />
      <NumberField id="height-in" label={o.heightIn} unit="in" step={1} value={inch} onChange={(v) => setFtIn(ft, v)} />
      <NumberField id="weight" label={o.weight} unit={t.common.lb} value={weightKg ? round1(weightKg / KG_PER_LB) : undefined} onChange={(v) => onWeight(v == null ? undefined : v * KG_PER_LB)} />
    </div>
  );
}

function TargetWeightInput({ units, value, onChange }: { units: Units; value?: number; onChange: (v?: number) => void }) {
  const { t } = useI18n();
  const imperial = units === "imperial";
  return (
    <div className="flex max-w-xs flex-col gap-2">
      <NumberField
        id="target"
        label={t.onboarding.targetWeight}
        unit={imperial ? t.common.lb : t.common.kg}
        value={value ? (imperial ? round1(value / KG_PER_LB) : value) : undefined}
        onChange={(v) => onChange(v == null ? undefined : imperial ? v * KG_PER_LB : v)}
      />
      <p className="text-sm text-muted-foreground">{t.onboarding.targetWeightHint}</p>
    </div>
  );
}
