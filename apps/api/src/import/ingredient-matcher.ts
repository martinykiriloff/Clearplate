import { INGREDIENT_DICTIONARY, IngredientEntry } from './ingredient-dictionary';
import type { ParsedIngredient } from './ingredient-parser';

interface CompiledEntry {
  entry: IngredientEntry;
  words: string[];
}

const compiled: CompiledEntry[] = INGREDIENT_DICTIONARY.flatMap((entry) => entry.stems.map((stem) => ({ entry, words: stem.toLowerCase().split(/\s+/) })));

const tokenise = (name: string): string[] =>
  name
    .toLowerCase()
    .split(/[\s\-/]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}%]/gu, ''))
    .filter(Boolean);

/**
 * Finds the dictionary entry for an ingredient name. Every stem word must prefix-match
 * a consecutive word of the name; the match with the most words, then the longest stems,
 * wins ("доматено пюре" beats "домат"). null = no catalogue food for this ingredient.
 */
export function matchIngredient(name: string): IngredientEntry | null {
  const tokens = tokenise(name);
  if (!tokens.length) return null;
  let best: { entry: IngredientEntry; score: number } | null = null;
  for (const { entry, words } of compiled) {
    if (words.length > tokens.length) continue;
    for (let i = 0; i + words.length <= tokens.length; i++) {
      let ok = true;
      for (let k = 0; k < words.length; k++) {
        if (!tokens[i + k].startsWith(words[k])) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      // Prefer a stem that starts the name ("свинско филе" over "филе ... свинско") only as a tie-break.
      const score = words.length * 1000 + words.join('').length * 10 - i;
      if (!best || score > best.score) best = { entry, score };
      break;
    }
  }
  return best?.entry ?? null;
}

/** Matches the primary reading of a parsed line, then its alternatives in order. */
export function matchParsed(parsed: ParsedIngredient): IngredientEntry | null {
  for (const name of [parsed.name, ...parsed.alternatives]) {
    const entry = matchIngredient(name);
    if (entry) return entry;
  }
  return null;
}
