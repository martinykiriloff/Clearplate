import { classifyMeal, isNotFood, portionGramsFor } from './meal-type';

describe('classifyMeal', () => {
  it('uses the source category first', () => {
    expect(classifyMeal('Ябълки с яйца', 'Десерти')).toBe('snack');
    expect(classifyMeal('Нещо', 'Супи')).toBe('lunch');
    expect(classifyMeal('Нещо', 'Закуски')).toBe('breakfast');
  });

  it('falls back to the title', () => {
    expect(classifyMeal('Баница със сирене', null)).toBe('breakfast');
    expect(classifyMeal('Шоколадова торта', null)).toBe('snack');
    expect(classifyMeal('Таратор', null)).toBe('lunch');
    expect(classifyMeal('Свинско с картофи на фурна', null)).toBe('dinner');
    expect(classifyMeal('Мусака', null)).toBe('dinner');
    expect(classifyMeal('Леща с ориз', null)).toBe('lunch');
    expect(classifyMeal('Класически шведски кюфтенца', 'Основни')).toBe('dinner');
  });

  it('gives mains a bigger plate than desserts, and sauces a spoon', () => {
    expect(portionGramsFor('dinner')).toBeGreaterThan(portionGramsFor('snack'));
    expect(portionGramsFor('snack', 'Как се приготвя сос Холандез')).toBe(40);
    expect(portionGramsFor('dinner', 'Свинско с гъби', 'Сосове')).toBe(40);
    expect(portionGramsFor('dinner', 'Сосиски с боб')).toBe(400);
  });

  it('spots how-tos that are not food', () => {
    expect(isNotFood('Как да боядисаме яйца за Великден със спанак')).toBe(true);
    expect(isNotFood('Яйца по панагюрски')).toBe(false);
  });
});
