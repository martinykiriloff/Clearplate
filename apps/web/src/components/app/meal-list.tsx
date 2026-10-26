"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useI18n, type I18n } from "@/i18n/provider";
import { api, MEALS, type DiaryEntry, type Meal, type MealGroup } from "@/lib/api";
import { shiftIsoDate } from "@/lib/utils";

function describe(e: DiaryEntry, { t, n, n1 }: I18n) {
  if (e.grams != null) return `${n(e.grams)} ${t.common.g}`;
  if (e.servings != null) return t.mealList.servings(n1(e.servings), e.servings === 1);
  return t.mealList.quickAdd;
}

export function MealList({ meals, date, onChange }: { meals: MealGroup[]; date?: string; onChange: () => void }) {
  const i18n = useI18n();
  const { t, n, n1, pick } = i18n;
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const label = (e: DiaryEntry) => pick(e.label, e.labelBg);

  async function remove(entry: DiaryEntry) {
    await api(`/diary/${entry.id}`, { method: "DELETE" });
    onChange();
    toast(t.mealList.removed(label(entry)), {
      action: {
        label: t.common.undo,
        onClick: async () => {
          await api(`/diary/${entry.id}/restore`, { method: "POST" });
          onChange();
        },
      },
    });
  }

  return (
    <div className="flex flex-col">
      {meals.map((group) => (
        <section key={group.meal} aria-labelledby={`meal-${group.meal}`} className="flex flex-col">
          <h3 id={`meal-${group.meal}`} className="flex justify-between border-b pt-5 pb-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase first:pt-0">
            <span>{t.meals[group.meal]}</span>
            <span className="tabular normal-case">
              {n(group.totals.calories)} {t.common.kcal}
            </span>
          </h3>
          {group.entries.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 py-2">
              <p className="text-sm text-muted-foreground">{t.mealList.nothing}</p>
              {date && <RepeatYesterday date={date} meal={group.meal} onDone={onChange} />}
            </div>
          ) : (
            <ul>
              {group.entries.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b py-2 last:border-b-0">
                  <div className="min-w-0 flex-[1_1_240px] py-1">
                    <div className="font-medium">{label(e)}</div>
                    <div className={e.isEstimate ? "text-sm text-estimate" : "text-sm text-muted-foreground"}>
                      {describe(e, i18n)}
                      {e.isEstimate ? t.mealList.estimateNote : ""}
                    </div>
                  </div>
                  <div className="tabular text-sm">
                    {n(e.kcal)} {t.common.kcal} · {n1(e.proteinG)} {t.common.g} {t.common.pShort}
                  </div>
                  <div className="flex">
                    {(e.grams != null || e.servings != null) && (
                      <Button variant="link" size="sm" onClick={() => setEditing(e)} aria-label={t.mealList.editAria(label(e))}>
                        {t.common.edit}
                      </Button>
                    )}
                    <Button variant="link" size="sm" onClick={() => void remove(e)} aria-label={t.mealList.removeAria(label(e))}>
                      {t.common.remove}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          {editing && (
            <EditEntry
              key={editing.id}
              entry={editing}
              onSaved={() => {
                setEditing(null);
                onChange();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditEntry({ entry, onSaved }: { entry: DiaryEntry; onSaved: () => void }) {
  const { t, pick, errorText } = useI18n();
  const byGrams = entry.grams != null;
  const [amount, setAmount] = useState(String(byGrams ? entry.grams : entry.servings));
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const [estimate, setEstimate] = useState(entry.isEstimate);
  const [pending, setPending] = useState(false);
  const amountN = Number(amount);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await api(`/diary/${entry.id}`, { method: "PATCH", json: { meal, isEstimate: estimate, ...(byGrams ? { grams: amountN } : { servings: amountN }) } });
          onSaved();
        } catch (err) {
          toast.error(errorText(err));
          setPending(false);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{pick(entry.label, entry.labelBg)}</DialogTitle>
        <DialogDescription>{t.mealList.editLead}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="edit-amount">{byGrams ? t.mealList.grams : t.mealList.servingsLabel}</Label>
          <Input id="edit-amount" type="number" inputMode="decimal" min={byGrams ? 1 : 0.25} step={byGrams ? 1 : 0.25} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="edit-meal">{t.mealList.meal}</Label>
          <NativeSelect id="edit-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {t.meals[m]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={estimate} onChange={(e) => setEstimate(e.target.checked)} />
        {t.mealList.isEstimate}
      </label>
      <DialogFooter>
        <Button type="submit" disabled={pending || !(amountN > 0)}>
          {t.common.save}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** One tap to log what you ate for this meal yesterday (the most common repeat). */
function RepeatYesterday({ date, meal, onDone }: { date: string; meal: Meal; onDone: () => void }) {
  const { t, errorText } = useI18n();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="link"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const res = await api<{ copied: number }>("/diary/copy", { method: "POST", json: { fromDate: shiftIsoDate(date, -1), toDate: date, meal } });
          if (res.copied > 0) {
            toast.success(t.repeat.done(res.copied));
            onDone();
          } else toast(t.repeat.nothing);
        } catch (err) {
          toast.error(errorText(err));
        } finally {
          setPending(false);
        }
      }}
    >
      {t.repeat.yesterday(t.mealsInline[meal])}
    </Button>
  );
}
