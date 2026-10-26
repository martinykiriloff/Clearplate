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
import { useI18n } from "@/i18n/provider";
import { api, fetcher, MEALS, type Meal, type Recipe, type Today } from "@/lib/api";
import { localIsoDate } from "@/lib/utils";

export function RecipesView() {
  const { t, n, pick } = useI18n();
  const r = t.recipes;
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
        <h1 className="text-2xl font-semibold">{r.title}</h1>
        <p className="text-muted-foreground">{r.lead}</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-56 flex-[2_1_280px] flex-col gap-2">
          <Label htmlFor="recipe-q">{r.search}</Label>
          <Input id="recipe-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={r.searchPlaceholder} />
        </div>
        <div className="flex min-w-40 flex-[1_1_160px] flex-col gap-2">
          <Label htmlFor="recipe-meal">{r.meal}</Label>
          <NativeSelect id="recipe-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal | "")}>
            <option value="">{r.allMeals}</option>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {t.meals[m]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={fitsOnly} onChange={(e) => setFitsOnly(e.target.checked)} disabled={left == null} />
          {r.fits}
          {left != null ? ` (${n(Math.max(0, left))} ${t.common.kcal})` : ""}
        </label>
      </div>

      {!data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.length === 0 ? (
        <p className="text-muted-foreground">{r.noMatch}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((recipe) => (
            <li key={recipe.id} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
              <div className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                {t.meals[recipe.mealType]}
                {recipe.ownerId ? r.yours : ""}
              </div>
              <h2 className="text-lg leading-snug font-semibold">{pick(recipe.name, recipe.nameBg)}</h2>
              <p className="tabular text-sm">{r.macros(n(recipe.kcal), n(recipe.proteinG), n(recipe.fatG), n(recipe.carbsG))}</p>
              <Button variant="outline" className="mt-auto self-start" onClick={() => setOpen(recipe)}>
                {r.viewAdd}
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
  const { t, n, pick, errorText } = useI18n();
  const r = t.recipes;
  const [meal, setMeal] = useState<Meal>(recipe.mealType);
  const [pending, setPending] = useState(false);
  const name = pick(recipe.name, recipe.nameBg);
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await api("/diary", { method: "POST", json: { date, meal, recipeId: recipe.id, servings: 1 } });
          toast.success(t.addFood.addedTo(name, t.mealsInline[meal]));
          onDone();
        } catch (err) {
          toast.error(errorText(err));
          setPending(false);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{name}</DialogTitle>
        <DialogDescription className="tabular">{r.perServingLine(n(recipe.kcal), n(recipe.proteinG), n(recipe.fatG), n(recipe.carbsG))}</DialogDescription>
      </DialogHeader>
      <div>
        <h3 className="text-sm font-semibold">{r.ingredients}</h3>
        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{pick(recipe.ingredients, recipe.ingredientsBg)}</p>
      </div>
      <div>
        <h3 className="text-sm font-semibold">{r.method}</h3>
        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{pick(recipe.method, recipe.methodBg)}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="detail-meal">{r.addTo}</Label>
        <NativeSelect id="detail-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
          {MEALS.map((m) => (
            <option key={m} value={m}>
              {r.todaySuffix(t.meals[m])}
            </option>
          ))}
        </NativeSelect>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {r.addServing}
        </Button>
      </DialogFooter>
    </form>
  );
}
