"use client";

import { LockIcon, SearchIcon } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError, fetcher, MEAL_LABEL, MEALS, type DiaryEntry, type Food, type Meal, type Recipe } from "@/lib/api";
import { fmt, fmt1 } from "@/lib/utils";

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
  const [meal, setMeal] = useState<Meal>(defaultMeal ?? mealForNow());
  const [picked, setPicked] = useState<Pick | null>(null);

  async function logEntry(body: Record<string, unknown>, label: string) {
    const entry = await api<DiaryEntry>("/diary", { method: "POST", json: { date, meal, ...body } });
    onAdded();
    toast.success(`Added ${label} to ${MEAL_LABEL[meal].toLowerCase()}`, {
      action: {
        label: "Undo",
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
          Add food
        </h2>
        <div className="w-44">
          <Label htmlFor="add-meal" className="sr-only">
            Meal
          </Label>
          <NativeSelect id="add-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <Tabs defaultValue="search">
        <TabsList aria-label="Ways to add food">
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="recipes">Recipes</TabsTrigger>
          <TabsTrigger value="estimate">Estimate</TabsTrigger>
          <TabsTrigger value="barcode">Barcode</TabsTrigger>
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

      <AmountDialog
        picked={picked}
        meal={meal}
        onClose={() => setPicked(null)}
        onConfirm={async (body, label) => {
          await logEntry(body, label);
          setPicked(null);
        }}
      />
    </section>
  );
}

function FoodRow({ food, onPick }: { food: Food; onPick: (f: Food) => void }) {
  const serving = food.servingG ?? 100;
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(food)}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-3 text-left hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="min-w-0 flex-[1_1_220px]">
          <span className="block font-medium">
            {food.name}
            {food.brand ? <span className="text-muted-foreground"> · {food.brand}</span> : null}
          </span>
          <span className="block text-sm text-muted-foreground">
            {food.servingName ? `1 ${food.servingName} = ${fmt(serving)} g` : "per 100 g"} · {food.source === "user" ? "Your food" : "From database"}
          </span>
        </span>
        <span className="tabular text-sm">
          {fmt((food.kcal * serving) / 100)} kcal · {fmt1((food.proteinG * serving) / 100)} g P
        </span>
      </button>
    </li>
  );
}

function FoodSearch({ onPick }: { onPick: (f: Food) => void }) {
  const [q, setQ] = useState("");
  const term = useDeferredValue(q.trim());
  const { data, isLoading } = useSWR<Food[]>(term.length >= 2 ? `/foods?q=${encodeURIComponent(term)}&limit=20` : null, fetcher, { keepPreviousData: true });
  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor="food-q">Food or brand</Label>
      <div className="relative">
        <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id="food-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. greek yogurt" className="pl-10" autoComplete="off" />
      </div>
      {term.length >= 2 && (
        <div aria-live="polite">
          {isLoading && !data ? (
            <p className="py-3 text-sm text-muted-foreground">Searching…</p>
          ) : data && data.length ? (
            <ul className="flex flex-col">{data.map((f) => <FoodRow key={f.id} food={f} onPick={onPick} />)}</ul>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">No match. Try a shorter word, or use Estimate.</p>
          )}
        </div>
      )}
    </div>
  );
}

function RecentFoods({ onPick }: { onPick: (f: Food) => void }) {
  const { data } = useSWR<Food[]>("/foods/recent", fetcher);
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data.length) return <p className="text-sm text-muted-foreground">Foods you log show up here for one-tap logging.</p>;
  return <ul className="flex flex-col">{data.map((f) => <FoodRow key={f.id} food={f} onPick={onPick} />)}</ul>;
}

function RecipePicker({ meal, onPick }: { meal: Meal; onPick: (r: Recipe) => void }) {
  const { data } = useSWR<Recipe[]>(`/recipes?mealType=${meal}&limit=12`, fetcher);
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data.length) return <p className="text-sm text-muted-foreground">No recipes for this meal yet.</p>;
  return (
    <ul className="flex flex-col">
      {data.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onPick(r)}
            className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-3 text-left hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="min-w-0 flex-[1_1_220px] font-medium">{r.name}</span>
            <span className="tabular text-sm">
              {fmt(r.kcal)} kcal · {fmt(r.proteinG)} g P
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function QuickEstimate({ onSubmit }: { onSubmit: (q: { label: string; kcal: number; proteinG?: number }) => Promise<void> }) {
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
          toast.error(err instanceof Error ? err.message : "Could not add");
        } finally {
          setPending(false);
        }
      }}
    >
      <p className="text-sm text-muted-foreground">For restaurant meals or anything you can&apos;t find. It&apos;s marked as an estimate in your diary.</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="est-label">What was it?</Label>
        <Input id="est-label" name="label" required maxLength={120} placeholder="e.g. Burger and side salad" />
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="est-kcal">Calories</Label>
          <Input id="est-kcal" name="kcal" type="number" inputMode="numeric" min={0} max={5000} required />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="est-protein">Protein, g (optional)</Label>
          <Input id="est-protein" name="protein" type="number" inputMode="numeric" min={0} max={500} />
        </div>
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        Add estimate
      </Button>
    </form>
  );
}

function BarcodeLookup({ onPick }: { onPick: (f: Food) => void }) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-input p-4">
        <LockIcon aria-hidden="true" className="text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Camera scanning is part of the Barcode module</p>
          <p className="text-sm text-muted-foreground">Coming soon. Looking a product up by the number under the barcode is free.</p>
        </div>
        <Badge variant="outline">Paid</Badge>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setMessage(null);
          try {
            onPick(await api<Food>(`/foods/barcode/${code.trim()}`));
          } catch (err) {
            setMessage(err instanceof ApiError && err.status === 404 ? "We don't have this product yet. Use Estimate for now." : "Lookup failed");
          }
        }}
      >
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <Label htmlFor="barcode">Barcode number</Label>
          <Input id="barcode" inputMode="numeric" pattern="\d{8}|\d{12,14}" title="8, 12, 13 or 14 digits" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
        </div>
        <Button type="submit" variant="outline">
          Look up
        </Button>
      </form>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

function AmountDialog({
  picked,
  meal,
  onClose,
  onConfirm,
}: {
  picked: Pick | null;
  meal: Meal;
  onClose: () => void;
  onConfirm: (body: Record<string, unknown>, label: string) => Promise<void>;
}) {
  return (
    <Dialog open={!!picked} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{picked && <AmountForm key={picked.kind === "food" ? picked.food.id : picked.recipe.id} picked={picked} meal={meal} onConfirm={onConfirm} />}</DialogContent>
    </Dialog>
  );
}

function AmountForm({ picked, meal, onConfirm }: { picked: Pick; meal: Meal; onConfirm: (body: Record<string, unknown>, label: string) => Promise<void> }) {
  const isFood = picked.kind === "food";
  const defaultAmount = isFood ? (picked.food.servingG ?? 100) : 1;
  const [amount, setAmount] = useState<string>(String(defaultAmount));
  const [estimate, setEstimate] = useState(false);
  const [pending, setPending] = useState(false);
  const n = Number(amount);
  const valid = Number.isFinite(n) && n > 0;

  const per = isFood ? picked.food : picked.recipe;
  const factor = isFood ? n / 100 : n;
  const name = isFood ? picked.food.name : picked.recipe.name;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        setPending(true);
        try {
          await onConfirm(isFood ? { foodId: picked.food.id, grams: n, isEstimate: estimate } : { recipeId: picked.recipe.id, servings: n }, name);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not add");
          setPending(false);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{name}</DialogTitle>
        <DialogDescription>Adding to {MEAL_LABEL[meal].toLowerCase()}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">{isFood ? "Amount in grams" : "Servings"}</Label>
        <Input id="amount" type="number" inputMode="decimal" min={isFood ? 1 : 0.25} step={isFood ? 1 : 0.25} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        {isFood && picked.food.servingName && (
          <p className="text-sm text-muted-foreground">
            1 {picked.food.servingName} ≈ {fmt(picked.food.servingG)} g
          </p>
        )}
      </div>
      {isFood && (
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={estimate} onChange={(e) => setEstimate(e.target.checked)} />
          I&apos;m guessing the amount (mark as estimate)
        </label>
      )}
      <dl className="grid grid-cols-4 gap-2 rounded-lg bg-background p-3 text-sm">
        {(
          [
            ["kcal", per.kcal],
            ["Protein", per.proteinG],
            ["Fat", per.fatG],
            ["Carbs", per.carbsG],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="tabular">{valid ? (k === "kcal" ? fmt(v * factor) : `${fmt1(v * factor)} g`) : "–"}</dd>
          </div>
        ))}
      </dl>
      <DialogFooter>
        <Button type="submit" disabled={!valid || pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </DialogFooter>
    </form>
  );
}
