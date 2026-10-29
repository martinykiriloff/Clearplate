import type { MealType } from '../db/schema';

/**
 * Picks the meal slot of an imported recipe from its title and the source's category.
 * Keyword stems, lower-case, matched by substring. Desserts and drinks are snacks,
 * pastries and egg dishes breakfast, soups and salads lunch, meat and fish mains dinner.
 */
const BREAKFAST = ['закуск', 'баниц', 'мекиц', 'палачинк', 'омлет', 'яйца на очи', 'бъркани яйца', 'мюсли', 'овесена каша', 'овесени ядки', 'гранол', 'тутманик', 'милинк', 'кифл', 'погач', 'сандвич', 'тост', 'гофрет', 'катми', 'бухт', 'пататник', 'сиренк', 'кашкавалк', 'принцес', 'фритат', 'яйца по', 'бъркани', 'каша', 'смути', 'овърнайт', 'крок мадам', 'крок месьо', 'козунак', 'питк', 'хляб', 'бейгъл', 'кроасан', 'флорентин'];
const SNACK = ['десерт', 'торт', 'сладкиш', 'кекс', 'бисквит', 'курабий', 'мъфин', 'кексчет', 'крем ', 'сладолед', 'баклав', 'тулумб', 'реване', 'кадаиф', 'бонбон', 'шоколад', 'компот', 'напитк', 'коктейл', ' сок', 'пай ', 'щрудел', 'еклер', 'пудинг', 'тирамису', 'чийзкейк', 'брауни', ' мус ', 'суфле', 'желе', 'сладко от', 'конфитюр', 'мармалад', 'ликьор', 'лимонад', 'фреш', 'туршия', 'мезе', 'хапк', 'ядки', 'чипс', 'трюфел', 'халва', 'локум', 'тиквеник', 'руло', 'гарнитур', ' сос', 'дип', 'салса', 'лютениц', 'предясти', 'закусчиц', 'ролц', 'бисквитен', 'сироп', 'ванилов', 'карамел', 'блат', 'глазур', 'плодов', 'ягод', 'ябълков', 'череш', 'вишнев', 'банан'];
const LUNCH = ['суп', 'чорб', 'салат', 'таратор', 'боб', 'леща', 'ориз', 'ризото', 'спагети', 'макарон', 'лазан', 'пица', 'бургер', 'дюнер', 'сандвич', 'грах', 'зеленчуков', 'постн', 'нахут', 'кус-кус', 'булгур', 'киноа', 'шкембе', 'курбан', 'гювеч', 'мусак', 'пилаф', 'сарми', 'пълнени чушки', 'манджа', 'яхния', 'кьопоолу', 'шопска', 'снежанк'];
const DINNER = ['месо', 'пиле', 'пилешк', 'риба', 'рибн', 'свинск', 'телешк', 'агнешк', 'кебап', 'кюфте', 'сарми', 'пълнен', 'печен', 'скара', 'задушен', 'яхни', 'кавърм', 'пържол', 'каре', 'филе', 'стек', 'шницел', 'ребр', 'бутч', 'пуешк', 'патиц', 'заек', 'сьомг', 'скумри', 'пъстърв', 'скарид', 'калмар', 'миди', 'октопод', 'шаран', 'на фурна', 'в тава', 'на тиган', 'на плоча', 'котлет', 'кайма', 'мусак', 'гювеч', 'капама', 'чеверме', 'дроб', 'рулад', 'плакия', 'винен кебап', 'сач', 'джолан'];

const SNACK_CATEGORIES = ['десерт', 'сладк', 'торт', 'напитк', 'коктейл', 'сладка', 'конфитюр', 'туршии', 'предястия', 'мезета', 'хапки', 'сосове', 'гарнитури', 'зимнина', 'консерв', 'тестени', 'хляб', 'пасти', 'бонбони', 'сладолед', 'питиета', 'ядки', 'сиропи'];
const BREAKFAST_CATEGORIES = ['закуск', 'баници', 'тестени закуски', 'яйца', 'палачинки', 'мекици', 'кифли', 'сандвичи', 'козунаци'];
const LUNCH_CATEGORIES = ['супи', 'салати', 'чорби', 'бобови', 'постни', 'вегетариански', 'веган', 'ястия с ориз', 'ястия с макарони', 'паста', 'пици', 'бургери', 'зеленчукови'];

const has = (text: string, stems: readonly string[]): boolean => stems.some((s) => text.includes(s));

export function classifyMeal(title: string, category: string | null): MealType {
  const t = ` ${title.toLowerCase()} `;
  const c = ` ${(category ?? '').toLowerCase()} `;
  if (has(c, BREAKFAST_CATEGORIES)) return 'breakfast';
  if (has(c, SNACK_CATEGORIES)) return 'snack';
  if (has(c, LUNCH_CATEGORIES)) return has(t, DINNER) && !has(t, ['салат', 'суп', 'чорб']) ? 'dinner' : 'lunch';
  if (has(t, BREAKFAST) && !has(t, ['торт', 'десерт', 'сладкиш'])) return 'breakfast';
  if (has(t, SNACK)) return 'snack';
  if (has(t, ['суп', 'чорб', 'салат', 'таратор'])) return 'lunch';
  if (has(t, DINNER)) return 'dinner';
  if (has(t, LUNCH)) return 'lunch';
  return 'dinner';
}

const CONDIMENT = /(?<!\p{L})сос(?!\p{L})|сосове|дресинг|майонез|песто|подправка|марината|глазур|сироп|заливка|топинг|паста за|лютениц|кьопоолу|сладко от|конфитюр|мармалад|масло с|намазк|(?<!\p{L})дип(?!\p{L})/iu;

/** Household how-tos that live among the recipes but are not food (dyeing eggs, cleaning, storing). */
const NOT_FOOD = /боядис|как да съхран|как да почист|как да изберем|как да разпозна|как да измерим|как да замраз|как да обелим|как да нарежем|как да сервираме/i;

export const isNotFood = (title: string): boolean => NOT_FOOD.test(title);

/**
 * Typical raw weight of one portion, used when the source gives no servings.
 * Condiments and sauces are eaten by the spoon, not the plate.
 */
export function portionGramsFor(meal: MealType, title = '', category: string | null = null): number {
  if (CONDIMENT.test(`${title} ${category ?? ''}`)) return 40;
  switch (meal) {
    case 'breakfast':
      return 250;
    case 'snack':
      return 120;
    case 'lunch':
    case 'dinner':
      return 400;
  }
}
