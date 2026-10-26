"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { api, MEAL_LABEL, MEALS, type DiaryEntry, type Meal, type MealGroup } from "@/lib/api";
import { fmt, fmt1 } from "@/lib/utils";

function describe(e: DiaryEntry) {
  if (e.grams != null) return `${fmt(e.grams)} g`;
  if (e.servings != null) return `${fmt1(e.servings)} serving${e.servings === 1 ? "" : "s"}`;
  return "Quick add";
}

export function MealList({ meals, onChange }: { meals: MealGroup[]; onChange: () => void }) {
  const [editing, setEditing] = useState<DiaryEntry | null>(null);

  async function remove(entry: DiaryEntry) {
    await api(`/diary/${entry.id}`, { method: "DELETE" });
    onChange();
    toast(`Removed ${entry.label}`, {
      action: {
        label: "Undo",
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
            <span>{MEAL_LABEL[group.meal]}</span>
            <span className="tabular normal-case">{fmt(group.totals.calories)} kcal</span>
          </h3>
          {group.entries.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <ul>
              {group.entries.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b py-2 last:border-b-0">
                  <div className="min-w-0 flex-[1_1_240px] py-1">
                    <div className="font-medium">{e.label}</div>
                    <div className={e.isEstimate ? "text-sm text-estimate" : "text-sm text-muted-foreground"}>
                      {describe(e)}
                      {e.isEstimate ? " · Estimate — adjust if you know the amount" : ""}
                    </div>
                  </div>
                  <div className="tabular text-sm">
                    {fmt(e.kcal)} kcal · {fmt1(e.proteinG)} g P
                  </div>
                  <div className="flex">
                    {(e.grams != null || e.servings != null) && (
                      <Button variant="link" size="sm" onClick={() => setEditing(e)} aria-label={`Edit ${e.label}`}>
                        Edit
                      </Button>
                    )}
                    <Button variant="link" size="sm" onClick={() => void remove(e)} aria-label={`Remove ${e.label}`}>
                      Remove
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
  const byGrams = entry.grams != null;
  const [amount, setAmount] = useState(String(byGrams ? entry.grams : entry.servings));
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const [estimate, setEstimate] = useState(entry.isEstimate);
  const [pending, setPending] = useState(false);
  const n = Number(amount);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await api(`/diary/${entry.id}`, { method: "PATCH", json: { meal, isEstimate: estimate, ...(byGrams ? { grams: n } : { servings: n }) } });
          onSaved();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save");
          setPending(false);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{entry.label}</DialogTitle>
        <DialogDescription>Change the amount or move it to another meal.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="edit-amount">{byGrams ? "Grams" : "Servings"}</Label>
          <Input id="edit-amount" type="number" inputMode="decimal" min={byGrams ? 1 : 0.25} step={byGrams ? 1 : 0.25} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="edit-meal">Meal</Label>
          <NativeSelect id="edit-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={estimate} onChange={(e) => setEstimate(e.target.checked)} />
        This amount is an estimate
      </label>
      <DialogFooter>
        <Button type="submit" disabled={pending || !(n > 0)}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
