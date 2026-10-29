import { parseIngredientLine } from './ingredient-parser';

const parse = (line: string) => {
  const p = parseIngredientLine(line);
  return [p.quantity, p.unit, p.name] as const;
};

describe('parseIngredientLine', () => {
  it('reads a leading amount with a metric unit', () => {
    expect(parse('500 г кайма')).toEqual([500, 'g', 'кайма']);
    expect(parse('1 кг картофи')).toEqual([1, 'kg', 'картофи']);
    expect(parse('50 мл олио')).toEqual([50, 'ml', 'олио']);
    expect(parse('400 гр. домати от консерва')).toEqual([400, 'g', 'домати от консерва']);
  });

  it('understands spoon, cup and count abbreviations in every spelling', () => {
    expect(parse('1 ч.л. червен пипер')).toEqual([1, 'tsp', 'червен пипер']);
    expect(parse('2 с. л. брашно')).toEqual([2, 'tbsp', 'брашно']);
    expect(parse('1 и 1/2 ч . ч. настъргано сирене')).toEqual([1.5, 'teacup', 'сирене']);
    expect(parse('1 ч.ч. майонеза')).toEqual([1, 'teacup', 'майонеза']);
    expect(parse('2 бр. яйца')).toEqual([2, 'piece', 'яйца']);
    expect(parse('2 скилидки чесън')).toEqual([2, 'clove', 'чесън']);
    expect(parse('една връзка магданоз')).toEqual([1, 'bunch', 'магданоз']);
  });

  it('averages ranges and reads fractions, words and vulgar fractions', () => {
    expect(parse('1-2 бр. домати или няколко с.л. доматено пюре')).toEqual([1.5, 'piece', 'домати']);
    expect(parse('1/2 ч.л. кимион')).toEqual([0.5, 'tsp', 'кимион']);
    expect(parse('1 1/2 ч.л. лук на прах')).toEqual([1.5, 'tsp', 'лук на прах']);
    expect(parse('½ чаша ориз')).toEqual([0.5, 'cup', 'ориз']);
    expect(parse('половин лимон')).toEqual([0.5, null, 'лимон']);
    expect(parse('около 300 мл вода')).toEqual([300, 'ml', 'вода']);
    expect(parse('3 яйца')).toEqual([3, null, 'яйца']);
  });

  it('reads an amount at the end of the line', () => {
    expect(parse('кайма - 500 гр.')).toEqual([500, 'g', 'кайма']);
    expect(parse('месо 1 кг')).toEqual([1, 'kg', 'месо']);
    expect(parse('лук - 2 глави')).toEqual([2, 'head', 'лук']);
  });

  it('prefers an explicit mass in brackets over the spoon count', () => {
    expect(parse('2 с.л. (50 г) масло')).toEqual([50, 'g', 'масло']);
    expect(parse('1 кофичка кисело мляко (400 г)')).toEqual([400, 'g', 'кисело мляко']);
  });

  it('drops preparation notes, alternatives and "to taste"', () => {
    expect(parse('олио за пържене')).toEqual([null, null, 'олио']);
    expect(parse('50 мл бяло вино, по желание')).toEqual([50, 'ml', 'бяло вино']);
    expect(parse('150 г краве масло или маргарин')).toEqual([150, 'g', 'краве масло']);
    expect(parse('сол и черен пипер на вкус')).toEqual([null, null, 'сол и черен пипер']);
  });

  it('marks section headers, empty lines and kitchen tools as headings', () => {
    expect(parseIngredientLine('За заливката:').isHeading).toBe(true);
    expect(parseIngredientLine('   ').isHeading).toBe(true);
    expect(parseIngredientLine('сол').isHeading).toBe(false);
    expect(parseIngredientLine('дървени шишчета').isHeading).toBe(true);
    expect(parseIngredientLine('хартия за печене').isHeading).toBe(true);
    expect(parseIngredientLine('месо за шишчета').isHeading).toBe(false);
  });

  it('ignores soft hyphens', () => {
    expect(parse('2 с.л. браш\u00ADно')).toEqual([2, 'tbsp', 'брашно']);
  });

  it('offers alternative readings for "или" and notes after a comma', () => {
    expect(parseIngredientLine('черен или бял пипер').alternatives).toEqual(['черен пипер', 'бял пипер']);
    expect(parseIngredientLine('80 г печени, солени фъстъци').alternatives).toEqual(['печени солени фъстъци']);
    // Both alternatives were only adjectives: the noun they share is the name.
    expect(parse('1/2 бр. голям или 1 бр. малък патладжан')).toEqual([0.5, 'piece', 'патладжан']);
    expect(parseIngredientLine('150 г краве масло').alternatives).toEqual([]);
  });
});
