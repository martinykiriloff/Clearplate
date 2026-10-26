"use client";

import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, fetcher, MEAL_LABEL, MEALS, type Meal, type Recipe, type Today } from "@/lib/api";
import { fmt, localIsoDate } from "@/lib/utils";

export function RecipesView() {
  const [q, setQ] = useState("");
  const [meal, setMeal] = useState<Meal | "">("");
  const [fitsOnly, setFitsOnly] = useState(false);
  const [open, setOpen] = useState<Recipe | null>(null);
  const term = useDeferredValue(q.trim());
  const date = localIsoDate();

  const { data: today } = useSWR<Today>(`/today?date=${date}`, fetcher);
  const left = today?.remaining?.calories;

  const params = new URLSearchParams({ limit: "60" });
  if (term) params.set("q", term);
  if (meal) params.set("mealType", meal);
  if (fitsOnly && left != null) params.set("maxKcal", String(Math.max(0, Math.floor(left))));
  const { data } = useSWR<Recipe[]>(`/recipes?${params}`, fetcher, { keepPreviousData: true });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Recipes</h1>
        <p className="text-muted-foreground">Sorted by protein per calorie, so the most filling options come first.</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-56 flex-[2_1_280px] flex-col gap-2">
          <Label htmlFor="recipe-q">Search</Label>
          <Input id="recipe-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. salmon" />
        </div>
        <div className="flex min-w-40 flex-[1_1_160px] flex-col gap-2">
          <Label htmlFor="recipe-meal">Meal</Label>
          <NativeSelect id="recipe-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal | "")}>
            <option value="">All meals</option>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={fitsOnly} onChange={(e) => setFitsOnly(e.target.checked)} disabled={left == null} />
          Fits what&apos;s left today{left != null ? ` (${fmt(Math.max(0, left))} kcal)` : ""}
        </label>
      </div>

      {!data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.length === 0 ? (
        <p className="text-muted-foreground">No recipes match. Try another word or meal.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
              <div className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                {MEAL_LABEL[r.mealType]}
                {r.ownerId ? " · Yours" : ""}
              </div>
              <h2 className="text-lg leading-snug font-semibold">{r.name}</h2>
              <p className="tabular text-sm">
                {fmt(r.kcal)} kcal · {fmt(r.proteinG)} g P · {fmt(r.fatG)} g F · {fmt(r.carbsG)} g C
              </p>
              <Button variant="outline" className="mt-auto self-start" onClick={() => setOpen(r)}>
                View &amp; add
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>{open && <RecipeDetail recipe={open} date={date} onDone={() => setOpen(null)} />}</DialogContent>
      </Dialog>
    </div>
  );
}

function RecipeDetail({ recipe, date, onDone }: { recipe: Recipe; date: string; onDone: () => void }) {
  const [meal, setMeal] = useState<Meal>(recipe.mealType);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await api("/diary", { method: "POST", json: { date, meal, recipeId: recipe.id, servings: 1 } });
          toast.success(`Added ${recipe.name} to ${MEAL_LABEL[meal].toLowerCase()}`);
          onDone();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not add");
          setPending(false);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{recipe.name}</DialogTitle>
        <DialogDescription className="tabular">
          Per serving: {fmt(recipe.kcal)} kcal · {fmt(recipe.proteinG)} g protein · {fmt(recipe.fatG)} g fat · {fmt(recipe.carbsG)} g carbs
        </DialogDescription>
      </DialogHeader>
      <div>
        <h3 className="text-sm font-semibold">Ingredients</h3>
        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{recipe.ingredients}</p>
      </div>
      <div>
        <h3 className="text-sm font-semibold">Method</h3>
        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{recipe.method}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="detail-meal">Add to</Label>
        <NativeSelect id="detail-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
          {MEALS.map((m) => (
            <option key={m} value={m}>
              {MEAL_LABEL[m]} today
            </option>
          ))}
        </NativeSelect>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          Add 1 serving
        </Button>
      </DialogFooter>
    </form>
  );
}
