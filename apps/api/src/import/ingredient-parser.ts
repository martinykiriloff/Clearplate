/**
 * Parses one Bulgarian ingredient line ("500 г кайма", "1-2 бр. домати", "кайма - 500 гр.",
 * "1/2 ч.л. кимион", "сол") into an amount, a unit and the ingredient words.
 * Pure: no catalogue lookup here, see `recipe-nutrition.ts` for the grams.
 */

export type Unit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'cup'
  | 'teacup'
  | 'coffeecup'
  | 'piece'
  | 'clove'
  | 'head'
  | 'bunch'
  | 'stalk'
  | 'pinch'
  | 'pack'
  | 'slice'
  | 'can'
  | 'cube'
  | 'leaf'
  | 'grain'
  | 'tub'
  | 'glass';

export interface ParsedIngredient {
  raw: string;
  /** null = no amount on the line ("сол", "магданоз", "по вкус"). */
  quantity: number | null;
  /** null = a bare count ("2 яйца") or no amount at all. */
  unit: Unit | null;
  /** Ingredient words, lower-cased, without amount, unit, notes in brackets and alternatives after "или". */
  name: string;
  /** Other readings of the words, tried in order when `name` has no catalogue food: "черен или бял пипер" -> "черен пипер". */
  alternatives: string[];
  /** A section header ("За заливката:"), a kitchen tool or a line without any ingredient words. */
  isHeading: boolean;
}

/** Longest aliases first so "чаена лъжичка" wins over "чаена чаша" prefixes. Dots and abbreviation spaces are removed before matching. */
const UNIT_ALIASES: [Unit, string[]][] = [
  ['tsp', ['чаена лъжичка', 'чаени лъжички', 'чаена лъжица', 'чаени лъжици', 'чаени лъжечки', 'кафена лъжичка', 'кафени лъжички', 'чл', 'кл']],
  ['tbsp', ['супена лъжица', 'супени лъжици', 'супени лъжички', 'сл', 'лъжица', 'лъжици', 'лъж']],
  ['teacup', ['чаена чаша', 'чаени чаши', 'чч', 'ччаша', 'ччаши']],
  ['coffeecup', ['кафена чаша', 'кафени чаши', 'кафена чашка', 'кафени чашки', 'кч']],
  ['glass', ['водна чаша', 'водни чаши', 'винена чаша']],
  ['cup', ['чаша', 'чаши', 'чашка', 'чашки', 'cup', 'cups']],
  ['kg', ['килограма', 'килограм', 'кг', 'kg']],
  ['g', ['грама', 'грам', 'гр', 'г', 'g', 'gr']],
  ['ml', ['милилитра', 'милилитър', 'мл', 'ml']],
  ['l', ['литра', 'литър', 'л', 'l']],
  ['piece', ['бройки', 'броя', 'брой', 'бр', 'топки', 'топка', 'топчета', 'топче']],
  ['clove', ['скилидки', 'скилидка', 'скилида', 'скилиди']],
  ['head', ['глави', 'глава', 'главички', 'главичка']],
  ['bunch', ['връзки', 'връзка', 'връзчица', 'китка']],
  ['stalk', ['стръкчета', 'стръкче', 'стръка', 'стрък', 'стебла', 'стебло']],
  ['pinch', ['щипки', 'щипка']],
  ['pack', ['пакетчета', 'пакетче', 'пакета', 'пакет', 'опаковки', 'опаковка', 'пликчета', 'пликче', 'плик']],
  ['slice', ['филийки', 'филийка', 'филии', 'филия', 'резенчета', 'резенче', 'резена', 'резен', 'парчета', 'парче']],
  ['can', ['консерви', 'консерва', 'кутии', 'кутия', 'бурканче', 'буркана', 'буркан']],
  ['cube', ['кубчета', 'кубче', 'бучки', 'бучка']],
  ['leaf', ['листчета', 'листа', 'лист']],
  ['grain', ['зрънца', 'зърна', 'зърно']],
  ['tub', ['кофички', 'кофичка']],
];

const UNIT_LOOKUP: [alias: string, unit: Unit][] = UNIT_ALIASES.flatMap(([unit, aliases]) => aliases.map((a): [string, Unit] => [a, unit])).sort(
  (a, b) => b[0].length - a[0].length,
);

const NUMBER_WORDS: Record<string, number> = {
  половин: 0.5,
  половинка: 0.5,
  четвърт: 0.25,
  един: 1,
  една: 1,
  едно: 1,
  два: 2,
  две: 2,
  три: 3,
  четири: 4,
  пет: 5,
  шест: 6,
  седем: 7,
  осем: 8,
  девет: 9,
  десет: 10,
  дузина: 12,
  няколко: 3,
};

const VULGAR: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };

/** Words that describe preparation, not the ingredient. Removed before catalogue matching. */
const FILLER = /(?<!\p{L})(?:ситно|едро|на ситно|на едро|нарязан\p{L}*|настърган\p{L}*|обелен\p{L}*|сварен\p{L}*|изпечен\p{L}*|размразен\p{L}*|пресен|прясна|прясно|пресни|пресно|сух|суха|сухи|сухо|смлян\p{L}*|смлен\p{L}*|узрел\p{L}*|узрял|зрели|зрял|зряла|почистен\p{L}*|филиран\p{L}*|накълцан\p{L}*|разтопен\p{L}*|стерилизиран\p{L}*|фино|равна|равни|счукан\p{L}*|пресован\p{L}*|цели|цял|цяла|едри|едър|дребни|дребен|средни|средна|среден|големи|голям|голяма|малки|малък|малка|около|приблизително|по вкус|на вкус|по желание|за пържене|за поръсване|за намазване|за гарнитура|за украса|за сервиране|за овкусяване|за запържване|за заливката|за тестото|за плънката|за соса|за глазурата|за крема|по избор|топла|топло|студена|студено|хладка|леко|добре|много|малко|домашн\p{L}*|желателно|задължително|ако има|ако желаете|или повече|или по-малко)(?!\p{L})/gu;

/** Kitchen tools and wrappings that some authors list among the ingredients. They are not food and must not count against coverage. */
const TOOL = /^(?:дървени |бамбукови |метални |кухненск\p{L}* )?(?:шишчета|шишове|шиш|клечки|клечка|хартия за печене|пергамент|алуминиево фолио|фолио|стреч фолио|плик за печене|пликове за печене|тензух|гевгир|тенджера|тиган|четка|тава|форма за|формички|форми за|кухненска хартия|салфетк\p{L}*|конец|канап|целофан|хартиени форм\p{L}*|капсули за мъфини|хартиени кошнички|шприц|пош)(?!\p{L})/u;

const normaliseAbbrev = (s: string): string =>
  s
    .toLowerCase()
    .replace(/ /g, ' ')
    // "ч. л." / "с.л." / "ч.ч." -> "чл" / "сл" / "чч" so one alias covers every spelling.
    .replace(/(?<![\p{L}])([а-я])\s*\.\s*([а-я])\s*\.?(?![\p{L}])/gu, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();

const parseNumber = (token: string): number | null => {
  const t = token.replace(',', '.');
  if (VULGAR[t] != null) return VULGAR[t];
  const mixed = /^(\d+)\s*(?:и\s*)?(\d+)\/(\d+)$/.exec(t);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const mixedVulgar = /^(\d+)\s*([½¼¾⅓⅔⅛])$/.exec(t);
  if (mixedVulgar) return Number(mixedVulgar[1]) + VULGAR[mixedVulgar[2]];
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac && Number(frac[2]) !== 0) return Number(frac[1]) / Number(frac[2]);
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** One amount: "2", "1,5", "1/2", "1 1/2", "2-3", "1 - 2", "2 до 3", "½", "две", "половин". Returns the matched length. */
const AMOUNT_RE = /^(?:около|приблизително|~)?\s*(\d+\/\d+|\d+(?:[.,]\d+)?(?:\s*(?:и\s*)?\d+\/\d+|\s*[½¼¾⅓⅔⅛])?|[½¼¾⅓⅔⅛]|[а-я]+)(?:\s*(?:-|–|—|до)\s*(\d+(?:[.,]\d+)?(?:\s*\d+\/\d+)?|\d+\/\d+))?/u;

function readAmount(text: string): { quantity: number; rest: string } | null {
  const m = AMOUNT_RE.exec(text);
  if (!m) return null;
  const first = /^[а-я]+$/u.test(m[1]) ? (NUMBER_WORDS[m[1]] ?? null) : parseNumber(m[1]);
  if (first == null) return null;
  const second = m[2] ? parseNumber(m[2]) : null;
  const quantity = second != null ? (first + second) / 2 : first;
  return { quantity, rest: text.slice(m[0].length).trim() };
}

function readUnit(text: string): { unit: Unit; rest: string } | null {
  for (const [alias, unit] of UNIT_LOOKUP) {
    if (text.startsWith(alias)) {
      const after = text.slice(alias.length);
      // A unit must end the token ("гр." / "гр " / "гр"), otherwise "глава" would match "гладък".
      if (after === '' || /^[.\s]/.test(after)) return { unit, rest: after.replace(/^[.\s]+/, '') };
    }
  }
  return null;
}

const tidy = (text: string): string =>
  text
    .replace(FILLER, ' ')
    .replace(/[^\p{L}\p{N}%\- ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Readings of the ingredient words, most literal first. The primary reading stops at the first comma
 * and before "или"; the alternatives recover "черен или бял пипер" (the adjective belongs to the second
 * noun), "печени, солени фъстъци" (the note carries the food) and "голям или малък патладжан" (the first
 * alternative was only an adjective). Empty readings and duplicates are dropped.
 */
function nameCandidates(text: string): string[] {
  const words = (s: string): string[] => s.replace(/[^\p{L}\p{N}%\- ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  // "голям или 1 бр. малък патладжан": the second alternative may repeat an amount.
  const withoutAmount = (s: string): string => {
    const amount = readAmount(s.trim());
    if (!amount) return s;
    return readUnit(amount.rest)?.rest ?? amount.rest;
  };
  const parts = text.replace(/[()[\]"„“”]/g, ' ').split(/\s+или\s+/);
  const alternatives = parts.map((alt, i) => (i === 0 ? alt : withoutAmount(alt)).split(',')[0]);
  const out = [tidy(alternatives[0])];
  const first = words(alternatives[0]);
  const second = alternatives[1] ? words(alternatives[1]) : [];
  if (first.length === 1 && second.length > 1) out.push(tidy([first[0], ...second.slice(1)].join(' ')));
  for (const alt of alternatives.slice(1)) out.push(tidy(alt));
  out.push(tidy(parts[0].replace(/,/g, ' ')));
  return [...new Set(out.filter(Boolean))];
}

/** Explicit grams in brackets ("2 с.л. (50 г) масло") beat the spoon count. */
function bracketedMass(text: string): { quantity: number; unit: Unit } | null {
  for (const m of text.matchAll(/\(([^)]*)\)/g)) {
    const inner = normaliseAbbrev(m[1]);
    const amount = readAmount(inner);
    if (!amount) continue;
    const unit = readUnit(amount.rest);
    if (unit && ['g', 'kg', 'ml', 'l'].includes(unit.unit)) return { quantity: amount.quantity, unit: unit.unit };
  }
  return null;
}

export function parseIngredientLine(raw: string): ParsedIngredient {
  // receptite.com hyphenates long words with soft hyphens ("браш\u00ADно").
  const stripped = raw.replace(/[\u00AD\u200B\u200C\u200D\uFEFF]/g, '').replace(/ /g, ' ').replace(/^[\s•·\-–*]+/, '').trim();
  const heading: ParsedIngredient = { raw, quantity: null, unit: null, name: '', alternatives: [], isHeading: true };
  if (!stripped || /:\s*$/.test(stripped) || !/\p{L}/u.test(stripped)) return heading;

  const mass = bracketedMass(stripped);
  const text = normaliseAbbrev(stripped.replace(/\([^)]*\)/g, ' '));

  let quantity: number | null = null;
  let unit: Unit | null = null;
  let nameText = text;

  const lead = readAmount(text);
  if (lead) {
    quantity = lead.quantity;
    const u = readUnit(lead.rest);
    unit = u?.unit ?? null;
    nameText = u ? u.rest : lead.rest;
  } else {
    // Trailing amount: "кайма - 500 гр." or "месо 1 кг".
    const tail = /^(.*?)\s*(?:[-–—:]\s*)?((?:\d+(?:[.,]\d+)?(?:\s*(?:-|–|до)\s*\d+(?:[.,]\d+)?)?|\d+\/\d+)\s*[а-я.]*)\s*$/u.exec(text);
    if (tail) {
      const amount = readAmount(tail[2]);
      if (amount) {
        const u = amount.rest ? readUnit(amount.rest) : null;
        if (!amount.rest || u) {
          quantity = amount.quantity;
          unit = u?.unit ?? 'piece';
          nameText = tail[1];
        }
      }
    }
  }

  if (mass) {
    quantity = mass.quantity;
    unit = mass.unit;
  }

  const [name = '', ...alternatives] = nameCandidates(nameText);
  if (!name) return { raw, quantity, unit, name: '', alternatives: [], isHeading: quantity == null };
  if (TOOL.test(name)) return { raw, quantity, unit, name, alternatives: [], isHeading: true };
  return { raw, quantity, unit, name, alternatives, isHeading: false };
}
