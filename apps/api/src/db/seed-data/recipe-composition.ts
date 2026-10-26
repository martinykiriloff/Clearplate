/**
 * What each starter recipe is made of, in grams of catalogue foods per
 * serving. Used to derive vitamins and minerals for recipes from the same
 * USDA data as the foods. Herbs, spices and condiments under ~5 g are left out.
 */
export const RECIPE_COMPOSITION: Record<string, [food: string, grams: number][]> = {
  'Greek yogurt bowl with berries and walnuts': [['Greek yogurt, plain 2%', 250], ['Blueberries', 100], ['Walnuts', 15], ['Honey', 5]],
  'Skyr with apple and cinnamon': [['Skyr, plain', 250], ['Apple', 182], ['Almonds', 10]],
  'Three-egg omelette with spinach and feta': [['Egg, whole, raw', 150], ['Spinach, raw', 40], ['Feta cheese', 30], ['Olive oil, extra virgin', 5]],
  'Egg white scramble with tomatoes': [['Egg white, raw', 200], ['Egg, whole, raw', 50], ['Tomato', 150]],
  'Cottage cheese with peach and chia': [['Cottage cheese 2%', 250], ['Peach', 150], ['Chia seeds', 10]],
  'Protein oats with banana': [['Oats, rolled, dry', 40], ['Milk, semi-skimmed 1.5%', 250], ['Banana', 60]],
  'Smoked salmon and egg plate': [['Smoked salmon', 80], ['Egg, hard-boiled', 100], ['Cucumber', 200], ['Lemon juice', 10]],
  'Kefir berry smoothie': [['Kefir, plain', 300], ['Strawberries', 150]],
  'Grilled beef tenderloin with big salad': [['Beef tenderloin, grilled', 140], ['Mixed salad greens', 150], ['Tomato', 123], ['Cucumber', 200], ['Olive oil, extra virgin', 10]],
  'Tuna salad with white beans': [['Tuna, canned in water, drained', 112], ['Beans, white, cooked', 120], ['Onion', 30], ['Olive oil, extra virgin', 10], ['Lemon juice', 10]],
  'Shopska salad with seared beef strips': [['Beef round steak, raw', 150], ['Tomato', 246], ['Cucumber', 200], ['Bell pepper, red', 120], ['White brine cheese (sirene)', 40]],
  'Beef and lentil bowl': [['Ground beef 5% fat, raw', 150], ['Lentils, cooked', 150], ['Spinach, raw', 100]],
  'Salmon poke bowl': [['Salmon, Atlantic, raw', 150], ['Rice, white, cooked', 120], ['Avocado', 100], ['Cucumber', 100]],
  'Sardine and potato salad': [['Sardines, canned in oil, drained', 92], ['Potato, boiled', 200], ['Pickles (gherkins)', 50], ['Mustard', 10]],
  'Beef chili without beans': [['Ground beef 10% fat, raw', 200], ['Tomato', 200], ['Bell pepper, red', 120], ['Onion', 60]],
  'Cod with green beans and lemon': [['Cod, baked', 200], ['Green beans, cooked', 200], ['Butter', 10], ['Lemon juice', 10]],
  'Baked salmon with asparagus': [['Salmon, Atlantic, baked', 180], ['Asparagus', 200], ['Lemon juice', 10]],
  'Beef stir-fry with broccoli': [['Beef sirloin, raw', 180], ['Broccoli, raw', 200], ['Garlic', 6], ['Sunflower oil', 5]],
  'Sea bass with roasted vegetables': [['Sea bass, baked', 200], ['Zucchini', 200], ['Bell pepper, red', 120], ['Olive oil, extra virgin', 10]],
  'Beef meatballs in tomato sauce': [['Ground beef 5% fat, raw', 200], ['Egg white, raw', 33], ['Tomato', 250]],
  'Trout with cauliflower mash': [['Trout, rainbow, baked', 200], ['Cauliflower', 300], ['Butter', 10]],
  'Steak with mushrooms and spinach': [['Beef round steak, raw', 200], ['Mushrooms, white', 150], ['Spinach, raw', 100], ['Olive oil, extra virgin', 5]],
  'Shrimp and zucchini noodles': [['Shrimp, cooked', 200], ['Zucchini', 300], ['Garlic', 6], ['Olive oil, extra virgin', 10]],
  'Mackerel with beetroot salad': [['Mackerel, Atlantic, raw', 150], ['Beetroot, cooked', 150], ['Greek yogurt, plain 2%', 50]],
  'Cottage cheese and cucumber': [['Cottage cheese 2%', 200], ['Cucumber', 200]],
  'Hard-boiled eggs and cherry tomatoes': [['Egg, hard-boiled', 100], ['Tomato', 150]],
  'Beef jerky and an apple': [['Beef jerky', 30], ['Apple', 182]],
  'Protein shake with milk': [['Milk, skim', 300]],
  'Greek yogurt with dark chocolate': [['Greek yogurt, plain 0%', 170], ['Dark chocolate 70-85%', 10]],
  'Tuna cucumber bites': [['Tuna, canned in water, drained', 112], ['Cucumber', 200], ['Greek yogurt, plain 2%', 15]],
};
