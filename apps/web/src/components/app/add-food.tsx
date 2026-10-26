"use client";

import { LockIcon, ScanBarcodeIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useDeferredValue, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarcodeScanner } from "@/components/app/barcode-scanner";
import { useI18n } from "@/i18n/provider";
import { api, ApiError, fetcher, MEALS, type DiaryEntry, type Food, type Meal, type Recipe, type ScanQuota } from "@/lib/api";
import { localIsoDate } from "@/lib/utils";

/** Suggest the meal by time of day; the user can always change it. */
function mealForNow(): Meal {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

type Pick = { kind: "food"; food: Food } | { kind: "recipe"; recipe: Recipe };

export function AddFood({ date, onAdded, defaultMeal }: { date: string; onAdded: () => void; defaultMeal?: Meal }) {
  const { t, pick } = useI18n();
  const a = t.addFood;
  const [meal, setMeal] = useState<Meal>(defaultMeal ?? mealForNow());
  const [picked, setPicked] = useState<Pick | null>(null);

  async function logEntry(body: Record<string, unknown>, label: string) {
    const entry = await api<DiaryEntry>("/diary", { method: "POST", json: { date, meal, ...body } });
    onAdded();
    toast.success(a.addedTo(label, t.mealsInline[meal]), {
      action: {
        label: t.common.undo,
        onClick: async () => {
          await api(`/diary/${entry.id}`, { method: "DELETE" });
          onAdded();
        },
      },
    });
  }

  return (
    <section aria-labelledby="add-food-title" className="flex flex-col gap-5 rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="add-food-title" className="text-xl font-semibold">
          {a.title}
        </h2>
        <div className="w-44">
          <Label htmlFor="add-meal" className="sr-only">
            {a.meal}
          </Label>
          <NativeSelect id="add-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {t.meals[m]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <Tabs defaultValue="search">
        <TabsList aria-label={a.ways}>
          <TabsTrigger value="search">{a.search}</TabsTrigger>
          <TabsTrigger value="recent">{a.recent}</TabsTrigger>
          <TabsTrigger value="recipes">{a.recipes}</TabsTrigger>
          <TabsTrigger value="estimate">{a.estimate}</TabsTrigger>
          <TabsTrigger value="barcode">{a.barcode}</TabsTrigger>
        </TabsList>
        <TabsContent value="search">
          <FoodSearch onPick={(food) => setPicked({ kind: "food", food })} />
        </TabsContent>
        <TabsContent value="recent">
          <RecentFoods onPick={(food) => setPicked({ kind: "food", food })} />
        </TabsContent>
        <TabsContent value="recipes">
          <RecipePicker meal={meal} onPick={(recipe) => setPicked({ kind: "recipe", recipe })} />
        </TabsContent>
        <TabsContent value="estimate">
          <QuickEstimate onSubmit={(quick) => logEntry({ quick }, quick.label)} />
        </TabsContent>
        <TabsContent value="barcode">
          <BarcodeLookup onPick={(food) => setPicked({ kind: "food", food })} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!picked} onOpenChange={(open) => !open && setPicked(null)}>
        <DialogContent>
          {picked && (
            <AmountForm
              key={picked.kind === "food" ? picked.food.id : picked.recipe.id}
              picked={picked}
              meal={meal}
              onConfirm={async (body) => {
                const label = picked.kind === "food" ? pick(picked.food.name, picked.food.nameBg) : pick(picked.recipe.name, picked.recipe.nameBg);
                await logEntry(body, label);
                setPicked(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function FoodRow({ food, onPick }: { food: Food; onPick: (f: Food) => void }) {
  const { t, n, n1, pick } = useI18n();
  const serving = food.servingG ?? 100;
  const servingName = food.servingName ? pick(food.servingName, food.servingNameBg) : null;
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(food)}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-3 text-left hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="min-w-0 flex-[1_1_220px]">
          <span className="block font-medium">
            {pick(food.name, food.nameBg)}
            {food.brand ? <span className="text-muted-foreground"> · {food.brand}</span> : null}
          </span>
          <span className="block text-sm text-muted-foreground">
            {servingName ? t.addFood.perServing(servingName, n(serving)) : t.addFood.per100} · {food.source === "user" ? t.addFood.yourFood : t.addFood.fromDb}
          </span>
        </span>
        <span className="tabular text-sm">
          {n((food.kcal * serving) / 100)} {t.common.kcal} · {n1((food.proteinG * serving) / 100)} {t.common.g} {t.common.pShort}
        </span>
      </button>
    </li>
  );
}

function FoodSearch({ onPick }: { onPick: (f: Food) => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const term = useDeferredValue(q.trim());
  const { data, isLoading } = useSWR<Food[]>(term.length >= 2 ? `/foods?q=${encodeURIComponent(term)}&limit=20` : null, fetcher, { keepPreviousData: true });
  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor="food-q">{t.addFood.foodOrBrand}</Label>
      <div className="relative">
        <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id="food-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.addFood.searchPlaceholder} className="pl-10" autoComplete="off" />
      </div>
      {term.length >= 2 && (
        <div aria-live="polite">
          {isLoading && !data ? (
            <p className="py-3 text-sm text-muted-foreground">{t.addFood.searching}</p>
          ) : data && data.length ? (
            <ul className="flex flex-col">{data.map((f) => <FoodRow key={f.id} food={f} onPick={onPick} />)}</ul>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">{t.addFood.noMatch}</p>
          )}
        </div>
      )}
    </div>
  );
}

function RecentFoods({ onPick }: { onPick: (f: Food) => void }) {
  const { t } = useI18n();
  const { data } = useSWR<Food[]>("/foods/recent", fetcher);
  if (!data) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  if (!data.length) return <p className="text-sm text-muted-foreground">{t.addFood.recentEmpty}</p>;
  return <ul className="flex flex-col">{data.map((f) => <FoodRow key={f.id} food={f} onPick={onPick} />)}</ul>;
}

function RecipePicker({ meal, onPick }: { meal: Meal; onPick: (r: Recipe) => void }) {
  const { t, n, pick } = useI18n();
  const { data } = useSWR<Recipe[]>(`/recipes?mealType=${meal}&limit=12`, fetcher);
  if (!data) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  if (!data.length) return <p className="text-sm text-muted-foreground">{t.addFood.noRecipes}</p>;
  return (
    <ul className="flex flex-col">
      {data.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onPick(r)}
            className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-3 text-left hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="min-w-0 flex-[1_1_220px] font-medium">{pick(r.name, r.nameBg)}</span>
            <span className="tabular text-sm">
              {n(r.kcal)} {t.common.kcal} · {n(r.proteinG)} {t.common.g} {t.common.pShort}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function QuickEstimate({ onSubmit }: { onSubmit: (q: { label: string; kcal: number; proteinG?: number }) => Promise<void> }) {
  const { t, errorText } = useI18n();
  const a = t.addFood;
  const [pending, setPending] = useState(false);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setPending(true);
        try {
          await onSubmit({
            label: String(fd.get("label")),
            kcal: Number(fd.get("kcal")),
            ...(fd.get("protein") ? { proteinG: Number(fd.get("protein")) } : {}),
          });
          form.reset();
        } catch (err) {
          toast.error(errorText(err));
        } finally {
          setPending(false);
        }
      }}
    >
      <p className="text-sm text-muted-foreground">{a.estimateLead}</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="est-label">{a.whatWasIt}</Label>
        <Input id="est-label" name="label" required maxLength={120} placeholder={a.whatPlaceholder} />
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="est-kcal">{a.calories}</Label>
          <Input id="est-kcal" name="kcal" type="number" inputMode="numeric" min={0} max={5000} required />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="est-protein">{a.proteinOptional}</Label>
          <Input id="est-protein" name="protein" type="number" inputMode="numeric" min={0} max={500} />
        </div>
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {a.addEstimate}
      </Button>
    </form>
  );
}

function BarcodeLookup({ onPick }: { onPick: (f: Food) => void }) {
  const { t, href } = useI18n();
  const a = t.addFood;
  // The allowance is per local day, so the client says which day it is.
  const today = localIsoDate();
  const { data: quota, mutate: refreshQuota } = useSWR<ScanQuota>(`/foods/scan/quota?today=${today}`, fetcher);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const unlimited = quota?.limit == null;
  const usedUp = !!quota && quota.remaining === 0;

  const lookup = useCallback(
    async (value: string, viaScan: boolean) => {
      setMessage(null);
      try {
        onPick(await api<Food>(viaScan ? `/foods/scan/${value}?today=${today}` : `/foods/barcode/${value}`));
        if (viaScan) void refreshQuota();
      } catch (err) {
        if (err instanceof ApiError && err.status === 402) {
          setMessage(a.scansUsedUp);
          void refreshQuota();
        } else {
          setMessage(err instanceof ApiError && err.status === 404 ? t.scan.notFound(value) : a.lookupFailed);
        }
      }
    },
    [onPick, t, a, today, refreshQuota],
  );

  const onDetected = useCallback(
    (value: string) => {
      setScanning(false);
      void lookup(value, true);
    },
    [lookup],
  );

  return (
    <div className="flex flex-col gap-4">
      {quota &&
        (usedUp ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-input p-4">
            <LockIcon aria-hidden="true" className="text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{a.scansUsedUp}</p>
              <p className="text-sm text-muted-foreground">{a.scanLockedHint(quota.limit ?? 0)}</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={href("/upgrade")}>{t.scan.locked}</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button type="button" size="lg" onClick={() => setScanning(true)}>
              <ScanBarcodeIcon aria-hidden="true" />
              {t.scan.scan}
            </Button>
            {!unlimited && quota.remaining != null && quota.limit != null && (
              <p className="text-sm text-muted-foreground">
                {a.scansLeft(quota.remaining, quota.limit)} ·{" "}
                <Link href={href("/upgrade")} className="underline underline-offset-4 hover:text-foreground">
                  {t.scan.locked}
                </Link>
              </p>
            )}
          </div>
        ))}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(code.trim(), false);
        }}
      >
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <Label htmlFor="barcode">{a.barcodeNumber}</Label>
          <Input id="barcode" inputMode="numeric" pattern="\d{8}|\d{12,14}" title={a.barcodeTitle} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
        </div>
        <Button type="submit" variant="outline">
          {a.lookUp}
        </Button>
      </form>
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}

      <Dialog open={scanning} onOpenChange={setScanning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.scan.title}</DialogTitle>
            <DialogDescription>{t.scan.hint}</DialogDescription>
          </DialogHeader>
          {scanning && <BarcodeScanner onDetected={onDetected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AmountForm({ picked, meal, onConfirm }: { picked: Pick; meal: Meal; onConfirm: (body: Record<string, unknown>) => Promise<void> }) {
  const { t, n, n1, pick, errorText } = useI18n();
  const a = t.addFood;
  const isFood = picked.kind === "food";
  const defaultAmount = isFood ? (picked.food.servingG ?? 100) : 1;
  const [amount, setAmount] = useState<string>(String(defaultAmount));
  const [estimate, setEstimate] = useState(false);
  const [pending, setPending] = useState(false);
  const amountN = Number(amount);
  const valid = Number.isFinite(amountN) && amountN > 0;

  const per = isFood ? picked.food : picked.recipe;
  const factor = isFood ? amountN / 100 : amountN;
  const name = isFood ? pick(picked.food.name, picked.food.nameBg) : pick(picked.recipe.name, picked.recipe.nameBg);
  const servingName = isFood && picked.food.servingName ? pick(picked.food.servingName, picked.food.servingNameBg) : null;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        setPending(true);
        try {
          await onConfirm(isFood ? { foodId: picked.food.id, grams: amountN, isEstimate: estimate } : { recipeId: picked.recipe.id, servings: amountN });
        } catch (err) {
          toast.error(errorText(err));
          setPending(false);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{name}</DialogTitle>
        <DialogDescription>{a.addingTo(t.mealsInline[meal])}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">{isFood ? a.grams : a.servings}</Label>
        <Input id="amount" type="number" inputMode="decimal" min={isFood ? 1 : 0.25} step={isFood ? 1 : 0.25} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        {servingName && isFood && <p className="text-sm text-muted-foreground">{a.servingApprox(servingName, n(picked.food.servingG))}</p>}
      </div>
      {isFood && picked.food.source === "open_food_facts" && <p className="text-xs text-muted-foreground">{t.scan.offCredit}</p>}
      {isFood && (
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={estimate} onChange={(e) => setEstimate(e.target.checked)} />
          {a.guessing}
        </label>
      )}
      <dl className="grid grid-cols-2 gap-2 rounded-lg bg-background p-3 text-sm sm:grid-cols-4">
        {(
          [
            [t.common.kcal, per.kcal, false],
            [a.protein, per.proteinG, true],
            [a.fat, per.fatG, true],
            [a.carbs, per.carbsG, true],
          ] as const
        ).map(([k, v, grams]) => (
          <div key={k}>
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="tabular">{valid ? (grams ? `${n1(v * factor)} ${t.common.g}` : n(v * factor)) : "–"}</dd>
          </div>
        ))}
      </dl>
      <DialogFooter>
        <Button type="submit" disabled={!valid || pending}>
          {pending ? t.common.adding : t.common.add}
        </Button>
      </DialogFooter>
    </form>
  );
}
