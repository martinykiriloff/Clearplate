/**
 * Starter public recipes. Macros are per serving, estimated from the
 * ingredient list using the starter food catalogue.
 */
export interface RecipeSeed {
  name: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  base: string;
  ingredients: string;
  method: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export const RECIPE_SEED: RecipeSeed[] = [
  // Breakfast
  { name: 'Greek yogurt bowl with berries and walnuts', mealType: 'breakfast', base: 'Dairy', ingredients: '250 g Greek yogurt 2%, 100 g blueberries, 15 g walnuts, 5 g honey', method: 'Spoon the yogurt into a bowl, top with berries, crushed walnuts and a drizzle of honey.', kcal: 362, proteinG: 27, fatG: 15, carbsG: 32 },
  { name: 'Skyr with apple and cinnamon', mealType: 'breakfast', base: 'Dairy', ingredients: '250 g skyr, 1 apple, 10 g almonds, cinnamon', method: 'Dice the apple, fold into the skyr, top with chopped almonds and cinnamon.', kcal: 312, proteinG: 30, fatG: 6, carbsG: 37 },
  { name: 'Three-egg omelette with spinach and feta', mealType: 'breakfast', base: 'Eggs', ingredients: '3 eggs, 40 g spinach, 30 g feta, 5 g olive oil', method: 'Wilt the spinach in oil, pour in beaten eggs, add crumbled feta, fold when set.', kcal: 344, proteinG: 24, fatG: 26, carbsG: 3 },
  { name: 'Egg white scramble with tomatoes', mealType: 'breakfast', base: 'Eggs', ingredients: '200 g egg whites, 1 egg, 150 g cherry tomatoes, chives', method: 'Scramble whites and egg on low heat, add halved tomatoes for the last minute.', kcal: 207, proteinG: 29, fatG: 5, carbsG: 8 },
  { name: 'Cottage cheese with peach and chia', mealType: 'breakfast', base: 'Dairy', ingredients: '250 g cottage cheese 2%, 1 peach, 10 g chia seeds', method: 'Slice the peach over the cottage cheese and sprinkle with chia.', kcal: 309, proteinG: 29, fatG: 9, carbsG: 30 },
  { name: 'Protein oats with banana', mealType: 'breakfast', base: 'Dairy', ingredients: '40 g oats, 250 ml semi-skimmed milk, 30 g whey, half banana', method: 'Cook oats in milk for 4 minutes, stir in whey off the heat, top with banana.', kcal: 427, proteinG: 38, fatG: 9, carbsG: 50 },
  { name: 'Smoked salmon and egg plate', mealType: 'breakfast', base: 'Fish', ingredients: '80 g smoked salmon, 2 boiled eggs, 1 cucumber, lemon', method: 'Arrange salmon, halved eggs and cucumber slices; finish with lemon and pepper.', kcal: 271, proteinG: 28, fatG: 15, carbsG: 5 },
  { name: 'Kefir berry smoothie', mealType: 'breakfast', base: 'Dairy', ingredients: '300 ml kefir, 150 g strawberries, 30 g whey', method: 'Blend everything until smooth.', kcal: 324, proteinG: 35, fatG: 8, carbsG: 26 },
  // Lunch
  { name: 'Grilled beef tenderloin with big salad', mealType: 'lunch', base: 'Beef', ingredients: '180 g beef tenderloin, 150 g mixed greens, 1 tomato, 1 cucumber, 10 g olive oil', method: 'Grill the steak 3-4 min per side, rest 5 min, slice over the dressed salad.', kcal: 494, proteinG: 57, fatG: 26, carbsG: 11 },
  { name: 'Tuna salad with white beans', mealType: 'lunch', base: 'Fish', ingredients: '1 can tuna in water, 120 g white beans, red onion, parsley, 10 g olive oil, lemon', method: 'Mix drained tuna and beans with sliced onion, parsley, oil and lemon.', kcal: 384, proteinG: 41, fatG: 11, carbsG: 31 },
  { name: 'Shopska salad with seared beef strips', mealType: 'lunch', base: 'Beef', ingredients: '150 g lean beef strips, 2 tomatoes, 1 cucumber, 1 pepper, 40 g white brine cheese', method: 'Sear the beef strips, chop the vegetables, top with grated cheese and the beef.', kcal: 420, proteinG: 45, fatG: 21, carbsG: 14 },
  { name: 'Beef and lentil bowl', mealType: 'lunch', base: 'Beef', ingredients: '150 g ground beef 5%, 150 g cooked lentils, 100 g spinach, cumin', method: 'Brown the beef with cumin, stir in lentils and spinach until wilted.', kcal: 380, proteinG: 46, fatG: 8, carbsG: 30 },
  { name: 'Salmon poke bowl', mealType: 'lunch', base: 'Fish', ingredients: '150 g salmon, 120 g cooked rice, half avocado, cucumber, soy sauce', method: 'Cube the salmon, serve over rice with avocado, cucumber and soy.', kcal: 628, proteinG: 35, fatG: 31, carbsG: 47 },
  { name: 'Sardine and potato salad', mealType: 'lunch', base: 'Fish', ingredients: '1 can sardines, 200 g boiled potatoes, pickles, mustard, dill', method: 'Toss warm sliced potatoes with mustard, add sardines, pickles and dill.', kcal: 377, proteinG: 27, fatG: 11, carbsG: 41 },
  { name: 'Beef chili without beans', mealType: 'lunch', base: 'Beef', ingredients: '200 g ground beef 10%, 200 g tomatoes, 1 pepper, onion, chili', method: 'Brown beef with onion, add peppers, tomatoes and spices, simmer 20 min.', kcal: 470, proteinG: 43, fatG: 22, carbsG: 20 },
  { name: 'Cod with green beans and lemon', mealType: 'lunch', base: 'Fish', ingredients: '200 g cod, 200 g green beans, 10 g butter, lemon', method: 'Bake cod 12 min at 200 °C; steam beans and toss with butter and lemon.', kcal: 352, proteinG: 46, fatG: 11, carbsG: 16 },
  // Dinner
  { name: 'Baked salmon with asparagus', mealType: 'dinner', base: 'Fish', ingredients: '180 g salmon, 200 g asparagus, lemon, dill', method: 'Roast salmon and asparagus together at 200 °C for 14 minutes.', kcal: 411, proteinG: 41, fatG: 23, carbsG: 8 },
  { name: 'Beef stir-fry with broccoli', mealType: 'dinner', base: 'Beef', ingredients: '180 g beef sirloin, 200 g broccoli, garlic, soy sauce, 5 g oil', method: 'Stir-fry thin beef strips on high heat, add broccoli and garlic, finish with soy.', kcal: 403, proteinG: 46, fatG: 19, carbsG: 14 },
  { name: 'Sea bass with roasted vegetables', mealType: 'dinner', base: 'Fish', ingredients: '200 g sea bass, 200 g zucchini, 1 pepper, 10 g olive oil', method: 'Roast vegetables 20 min, add the fish for the last 12 min.', kcal: 405, proteinG: 51, fatG: 16, carbsG: 15 },
  { name: 'Beef meatballs in tomato sauce', mealType: 'dinner', base: 'Beef', ingredients: '200 g ground beef 5%, 1 egg white, 250 g tomatoes, herbs', method: 'Form small meatballs, bake 15 min, simmer in the tomato sauce 10 min.', kcal: 345, proteinG: 48, fatG: 11, carbsG: 12 },
  { name: 'Trout with cauliflower mash', mealType: 'dinner', base: 'Fish', ingredients: '200 g trout, 300 g cauliflower, 10 g butter', method: 'Bake trout; boil cauliflower and mash with butter.', kcal: 447, proteinG: 52, fatG: 21, carbsG: 15 },
  { name: 'Steak with mushrooms and spinach', mealType: 'dinner', base: 'Beef', ingredients: '200 g beef round steak, 150 g mushrooms, 100 g spinach, 5 g olive oil', method: 'Sear steak, then sauté mushrooms and spinach in the same pan.', kcal: 382, proteinG: 54, fatG: 15, carbsG: 9 },
  { name: 'Shrimp and zucchini noodles', mealType: 'dinner', base: 'Fish', ingredients: '200 g shrimp, 300 g zucchini, garlic, chili, 10 g olive oil', method: 'Spiralise zucchini, sauté shrimp with garlic and chili, toss together 2 min.', kcal: 339, proteinG: 52, fatG: 11, carbsG: 11 },
  { name: 'Mackerel with beetroot salad', mealType: 'dinner', base: 'Fish', ingredients: '150 g mackerel, 150 g cooked beetroot, 50 g Greek yogurt, horseradish', method: 'Grill the mackerel; dress beetroot with yogurt and horseradish.', kcal: 409, proteinG: 34, fatG: 22, carbsG: 17 },
  // Snacks
  { name: 'Cottage cheese and cucumber', mealType: 'snack', base: 'Dairy', ingredients: '200 g cottage cheese 2%, 1 cucumber, pepper', method: 'Slice the cucumber and serve with cottage cheese.', kcal: 192, proteinG: 22, fatG: 5, carbsG: 17 },
  { name: 'Hard-boiled eggs and cherry tomatoes', mealType: 'snack', base: 'Eggs', ingredients: '2 eggs, 150 g cherry tomatoes, salt', method: 'Boil eggs 9 minutes, cool, serve with tomatoes.', kcal: 182, proteinG: 14, fatG: 11, carbsG: 7 },
  { name: 'Beef jerky and an apple', mealType: 'snack', base: 'Beef', ingredients: '30 g beef jerky, 1 apple', method: 'Pack together for an on-the-go snack.', kcal: 218, proteinG: 11, fatG: 8, carbsG: 28 },
  { name: 'Protein shake with milk', mealType: 'snack', base: 'Dairy', ingredients: '30 g whey, 300 ml skim milk', method: 'Shake until smooth.', kcal: 222, proteinG: 34, fatG: 2, carbsG: 18 },
  { name: 'Greek yogurt with dark chocolate', mealType: 'snack', base: 'Dairy', ingredients: '170 g Greek yogurt 0%, 10 g dark chocolate', method: 'Grate the chocolate over the yogurt.', kcal: 160, proteinG: 18, fatG: 5, carbsG: 11 },
  { name: 'Tuna cucumber bites', mealType: 'snack', base: 'Fish', ingredients: '1 can tuna in water, 1 cucumber, 15 g Greek yogurt, dill', method: 'Mix tuna with yogurt and dill; spoon onto thick cucumber slices.', kcal: 168, proteinG: 31, fatG: 2, carbsG: 8 },
];
