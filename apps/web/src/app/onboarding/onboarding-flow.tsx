"use client";

import { computeTargets, type ActivityLevel, type Goal, type Pace, type Sex, type Targets } from "@clearplate/targets";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { mutate } from "swr";
import { ChoiceGroup } from "@/components/app/choice-group";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/session";
import { CM_PER_IN, cn, fmt, fmt1, KG_PER_LB, localIsoDate } from "@/lib/utils";

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

const STEPS = ["Goal", "About you", "Activity", "Pace", "Consent"] as const;

const WARNING_TEXT: Record<string, string> = {
  calorie_floor_applied: "We kept calories at the safe minimum, so progress may be slower than the pace you picked.",
  deficit_capped: "We capped the deficit at 1,000 kcal a day to protect energy and muscle.",
  underweight_no_deficit: "Your BMI is under 18.5, so we set a maintenance plan instead of a deficit.",
  carbs_at_minimum: "Carbs are at the minimum; consider a gentler pace.",
  maintenance_below_floor: "Your maintenance is below our usual minimum, so we set maintenance calories. More activity is the safer lever; talk to a doctor before cutting further.",
};

function ageFrom(birthDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = localIsoDate().split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export function OnboardingFlow() {
  const router = useRouter();
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
      router.replace("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your answers");
      setPending(false);
    }
  }

  function next() {
    if (!stepValid) return;
    if (step === STEPS.length - 1) void submit();
    else setStep(step + 1);
  }

  if (!user) return null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo href="/onboarding" />
        <p className="text-sm text-muted-foreground">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
      </header>
      <Progress value={((step + 1) / STEPS.length) * 100} aria-label="Questionnaire progress" />

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
              <h1 className="text-3xl font-bold tracking-tight">What do you want from Clearplate?</h1>
              <ChoiceGroup<Goal>
                name="goal"
                legend="Pick one. You can change it later."
                value={a.goal}
                onChange={(v) => set("goal", v)}
                choices={[
                  { value: "lose", label: "Lose fat", description: "A moderate deficit with high protein to keep muscle and energy." },
                  { value: "gain", label: "Build muscle", description: "A small surplus so most of the gain is lean." },
                  { value: "habits", label: "Eat better, same weight", description: "Maintenance calories and steady habits." },
                ]}
              />
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">A few facts about you</h1>
              <p className="-mt-4 text-muted-foreground">We use the Mifflin–St Jeor equation, the most accurate of the common formulas for adults.</p>
              <ChoiceGroup<Units>
                name="units"
                legend="Units"
                columns={2}
                value={a.units}
                onChange={(v) => set("units", v)}
                choices={[
                  { value: "metric", label: "Metric", description: "kg, cm" },
                  { value: "imperial", label: "Imperial", description: "lb, ft/in" },
                ]}
              />
              <ChoiceGroup<Sex>
                name="sex"
                legend="Sex (used for the energy equation)"
                columns={2}
                value={a.sex}
                onChange={(v) => set("sex", v)}
                choices={[
                  { value: "female", label: "Female" },
                  { value: "male", label: "Male" },
                ]}
              />
              <div className="flex flex-col gap-2">
                <Label htmlFor="birthDate">Date of birth</Label>
                <Input id="birthDate" type="date" value={a.birthDate} max={localIsoDate()} onChange={(e) => set("birthDate", e.target.value)} required aria-describedby="age-hint" />
                <p id="age-hint" className={cn("text-sm", age != null && age < 18 ? "text-destructive" : "text-muted-foreground")}>
                  {age != null && age < 18 ? "Clearplate is for adults 18 and over." : "You must be 18 or older."}
                </p>
              </div>
              <MeasureInputs units={a.units} heightCm={a.heightCm} weightKg={a.weightKg} onHeight={(v) => set("heightCm", v)} onWeight={(v) => set("weightKg", v)} />
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">How active is a typical week?</h1>
              <ChoiceGroup<ActivityLevel>
                name="activity"
                legend="Count both work and training. When unsure, pick the lower one."
                value={a.activity}
                onChange={(v) => set("activity", v)}
                choices={[
                  { value: "sedentary", label: "Mostly sitting", description: "Desk job, little walking, no training." },
                  { value: "light", label: "Lightly active", description: "Desk job plus walks or 1–3 workouts a week." },
                  { value: "moderate", label: "Moderately active", description: "3–5 workouts a week or an on-your-feet job." },
                  { value: "active", label: "Very active", description: "6–7 hard sessions a week." },
                  { value: "very_active", label: "Athlete or physical job", description: "Training twice a day or heavy manual work." },
                ]}
              />
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">{a.goal === "habits" ? "Anything to aim for?" : "How fast?"}</h1>
              {a.goal !== "habits" && (
                <ChoiceGroup<Pace>
                  name="pace"
                  legend="Faster is harder to sustain. Standard works for most people."
                  value={a.pace}
                  onChange={(v) => set("pace", v)}
                  choices={[
                    { value: "gentle", label: "Gentle", description: a.goal === "lose" ? "About 10% below maintenance." : "Same small surplus." },
                    { value: "standard", label: "Standard", description: a.goal === "lose" ? "About 20% below maintenance." : "About 10% above maintenance." },
                    { value: "fast", label: "Fast", description: a.goal === "lose" ? "About 25% below, capped at 1,000 kcal." : "Same small surplus." },
                  ]}
                />
              )}
              <TargetWeightInput units={a.units} value={a.targetWeightKg} onChange={(v) => set("targetWeightKg", v)} />
            </>
          )}

          {step === 4 && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">Your data, your call</h1>
              <p className="-mt-4 text-muted-foreground">
                Your weight and body details are health data. We store them in the EU, never sell them, and you can delete your account and all data at any time from
                Settings.
              </p>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4">
                <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={a.healthDataConsent} onChange={(e) => set("healthDataConsent", e.target.checked)} required />
                <span>
                  <span className="font-semibold">I agree that Clearplate processes my health data</span>
                  <span className="block text-sm text-muted-foreground">Required to calculate targets and track progress.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4">
                <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={a.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} />
                <span>
                  <span className="font-semibold">Send me occasional product news</span>
                  <span className="block text-sm text-muted-foreground">Optional. Unsubscribe any time.</span>
                </span>
              </label>
              <p className="text-sm text-muted-foreground">Clearplate is a wellness tool, not medical advice. If you are pregnant, have a medical condition or an eating disorder history, talk to a doctor first.</p>
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
                Back
              </Button>
            )}
            <Button type="submit" size="lg" disabled={!stepValid || pending}>
              {step === STEPS.length - 1 ? (pending ? "Saving…" : "Start tracking") : "Continue"}
            </Button>
          </div>
        </form>

        <PlanPreview preview={preview} goal={a.goal} />
      </div>
    </div>
  );
}

function PlanPreview({ preview, goal }: { preview: Targets | null; goal?: Goal }) {
  return (
    <aside aria-live="polite" className="flex min-w-0 flex-[1_1_300px] flex-col gap-5 rounded-xl border bg-card p-6">
      <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Your plan so far</h2>
      {!preview ? (
        <p className="text-sm text-muted-foreground">Answer the first two steps and your daily budget appears here. It updates as you answer.</p>
      ) : (
        <>
          <div>
            <div className="tabular text-5xl font-medium text-primary">{fmt(preview.calories)}</div>
            <div className="mt-1 text-sm text-muted-foreground">kcal a day · maintenance about {fmt(preview.tdee)}</div>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            {(
              [
                ["Protein", preview.proteinG],
                ["Fat", preview.fatG],
                ["Carbs", preview.carbsG],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-background p-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="tabular mt-1 text-base whitespace-nowrap">{fmt(v)} g</dd>
              </div>
            ))}
          </dl>
          {goal !== "habits" && preview.expectedWeeklyChangeKg !== 0 && (
            <p className="text-sm">
              Expected change: <span className="tabular">{preview.expectedWeeklyChangeKg > 0 ? "+" : ""}{fmt1(preview.expectedWeeklyChangeKg)} kg</span> a week.{" "}
              <span className="text-muted-foreground">An estimate; we adjust it with your weight trend.</span>
            </p>
          )}
          {preview.warnings.map((w) => (
            <p key={w} className="rounded-md border border-estimate/40 px-3 py-2 text-sm text-estimate">
              {WARNING_TEXT[w] ?? w}
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

const round1 = (n: number) => Math.round(n * 10) / 10;

function MeasureInputs({ units, heightCm, weightKg, onHeight, onWeight }: { units: Units; heightCm?: number; weightKg?: number; onHeight: (v?: number) => void; onWeight: (v?: number) => void }) {
  if (units === "metric") {
    return (
      <div className="flex flex-wrap gap-4">
        <NumberField id="height" label="Height" unit="cm" step={1} value={heightCm} onChange={onHeight} />
        <NumberField id="weight" label="Current weight" unit="kg" value={weightKg} onChange={onWeight} />
      </div>
    );
  }
  const totalIn = heightCm ? heightCm / CM_PER_IN : undefined;
  const ft = totalIn != null ? Math.floor(totalIn / 12) : undefined;
  const inch = totalIn != null ? Math.round(totalIn - (ft ?? 0) * 12) : undefined;
  const setFtIn = (f?: number, i?: number) => onHeight(f == null && i == null ? undefined : ((f ?? 0) * 12 + (i ?? 0)) * CM_PER_IN);
  return (
    <div className="flex flex-wrap gap-4">
      <NumberField id="height-ft" label="Height (feet)" unit="ft" step={1} value={ft} onChange={(v) => setFtIn(v, inch)} />
      <NumberField id="height-in" label="Height (inches)" unit="in" step={1} value={inch} onChange={(v) => setFtIn(ft, v)} />
      <NumberField id="weight" label="Current weight" unit="lb" value={weightKg ? round1(weightKg / KG_PER_LB) : undefined} onChange={(v) => onWeight(v == null ? undefined : v * KG_PER_LB)} />
    </div>
  );
}

function TargetWeightInput({ units, value, onChange }: { units: Units; value?: number; onChange: (v?: number) => void }) {
  const imperial = units === "imperial";
  return (
    <div className="flex max-w-xs flex-col gap-2">
      <NumberField
        id="target"
        label="Goal weight (optional)"
        unit={imperial ? "lb" : "kg"}
        value={value ? (imperial ? round1(value / KG_PER_LB) : value) : undefined}
        onChange={(v) => onChange(v == null ? undefined : imperial ? v * KG_PER_LB : v)}
      />
      <p className="text-sm text-muted-foreground">Helps us set protein. Leave empty if you&apos;re not sure.</p>
    </div>
  );
}
