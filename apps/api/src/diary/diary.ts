import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { remaining } from '@clearplate/targets';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { and, asc, desc, eq, isNull, lte, sql } from 'drizzle-orm';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { addDays, parseDateParam } from '../common/dates';
import { Database, InjectDb } from '../db/db.module';
import { DiaryEntry, diaryEntries, MealType, recipes } from '../db/schema';
import { FoodsModule, FoodsService } from '../foods/foods';
import { ProfileModule } from '../profile/profile.module';
import { ProfileService } from '../profile/profile.service';
import { MEALS, RecipesModule, RecipesService } from '../recipes/recipes';
import { WeightsModule, WeightsService } from '../weights/weights';

export class QuickAddDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label: string;

  @IsNumber()
  @Min(0)
  @Max(5000)
  kcal: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  proteinG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  fatG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(800)
  carbsG?: number;
}

/** Log a food (by grams), a recipe (by servings) or a quick estimate. Exactly one source. */
export class AddEntryDto {
  @IsOptional()
  @IsDateString({ strict: true })
  date?: string;

  @ApiProperty({ enum: MEALS })
  @IsIn(MEALS)
  meal: MealType;

  @IsOptional()
  @IsUUID()
  foodId?: string;

  /** Defaults to the food's serving size, or 100 g. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5000)
  grams?: number;

  @IsOptional()
  @IsUUID()
  recipeId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(20)
  servings?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuickAddDto)
  quick?: QuickAddDto;

  /** Mark the amount as an estimate (e.g. "a medium apple"). Quick adds are always estimates. */
  @IsOptional()
  @IsBoolean()
  isEstimate?: boolean;
}

export class UpdateEntryDto {
  @ApiProperty({ enum: MEALS, required: false })
  @IsOptional()
  @IsIn(MEALS)
  meal?: MealType;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5000)
  grams?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(20)
  servings?: number;

  @IsOptional()
  @IsBoolean()
  isEstimate?: boolean;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

type Totals = { calories: number; proteinG: number; fatG: number; carbsG: number };
const emptyTotals = (): Totals => ({ calories: 0, proteinG: 0, fatG: 0, carbsG: 0 });

function sum(entries: Pick<DiaryEntry, 'kcal' | 'proteinG' | 'fatG' | 'carbsG'>[]): Totals {
  const t = entries.reduce((acc, e) => {
    acc.calories += e.kcal;
    acc.proteinG += e.proteinG;
    acc.fatG += e.fatG;
    acc.carbsG += e.carbsG;
    return acc;
  }, emptyTotals());
  return { calories: Math.round(t.calories), proteinG: r1(t.proteinG), fatG: r1(t.fatG), carbsG: r1(t.carbsG) };
}

const entryView = (e: DiaryEntry) => ({
  id: e.id,
  date: e.date,
  meal: e.meal,
  label: e.label,
  foodId: e.foodId,
  recipeId: e.recipeId,
  grams: e.grams,
  servings: e.servings,
  kcal: Math.round(e.kcal),
  proteinG: r1(e.proteinG),
  fatG: r1(e.fatG),
  carbsG: r1(e.carbsG),
  isEstimate: e.isEstimate,
  createdAt: e.createdAt,
});

@Injectable()
export class DiaryService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly foodsService: FoodsService,
    private readonly recipesService: RecipesService,
  ) {}

  async add(userId: string, dto: AddEntryDto) {
    const sources = [dto.foodId, dto.recipeId, dto.quick].filter((x) => x != null).length;
    if (sources !== 1) throw new BadRequestException('Provide exactly one of foodId, recipeId or quick');
    const date = parseDateParam(dto.date);
    const base = { userId, date, meal: dto.meal };

    let values: typeof diaryEntries.$inferInsert;
    if (dto.foodId) {
      const food = await this.foodsService.byId(userId, dto.foodId);
      const grams = dto.grams ?? food.servingG ?? 100;
      const f = grams / 100;
      values = {
        ...base,
        foodId: food.id,
        label: food.brand ? `${food.name} (${food.brand})` : food.name,
        grams,
        kcal: food.kcal * f,
        proteinG: food.proteinG * f,
        fatG: food.fatG * f,
        carbsG: food.carbsG * f,
        isEstimate: dto.isEstimate ?? false,
      };
    } else if (dto.recipeId) {
      const recipe = await this.recipesService.get(userId, dto.recipeId);
      const servings = dto.servings ?? 1;
      values = {
        ...base,
        recipeId: recipe.id,
        label: recipe.name,
        servings,
        kcal: recipe.kcal * servings,
        proteinG: recipe.proteinG * servings,
        fatG: recipe.fatG * servings,
        carbsG: recipe.carbsG * servings,
        isEstimate: dto.isEstimate ?? false,
      };
    } else {
      const q = dto.quick!;
      values = {
        ...base,
        label: q.label,
        kcal: q.kcal,
        proteinG: q.proteinG ?? 0,
        fatG: q.fatG ?? 0,
        carbsG: q.carbsG ?? 0,
        isEstimate: true,
      };
    }

    const [entry] = await this.db.insert(diaryEntries).values(values).returning();
    return entryView(entry);
  }

  private async own(userId: string, id: string, { includeDeleted = false } = {}) {
    const [entry] = await this.db
      .select()
      .from(diaryEntries)
      .where(and(eq(diaryEntries.id, id), eq(diaryEntries.userId, userId), includeDeleted ? undefined : isNull(diaryEntries.deletedAt)))
      .limit(1);
    if (!entry) throw new NotFoundException('Entry not found');
    return entry;
  }

  /** Changing grams or servings rescales the snapshot proportionally. */
  async update(userId: string, id: string, dto: UpdateEntryDto) {
    const entry = await this.own(userId, id);
    let factor = 1;
    if (dto.grams != null) {
      if (entry.grams == null) throw new BadRequestException('This entry is not measured in grams');
      factor = dto.grams / entry.grams;
    }
    if (dto.servings != null) {
      if (entry.servings == null) throw new BadRequestException('This entry is not measured in servings');
      factor = dto.servings / entry.servings;
    }
    const [updated] = await this.db
      .update(diaryEntries)
      .set({
        meal: dto.meal ?? entry.meal,
        grams: dto.grams ?? entry.grams,
        servings: dto.servings ?? entry.servings,
        kcal: entry.kcal * factor,
        proteinG: entry.proteinG * factor,
        fatG: entry.fatG * factor,
        carbsG: entry.carbsG * factor,
        isEstimate: dto.isEstimate ?? entry.isEstimate,
      })
      .where(eq(diaryEntries.id, id))
      .returning();
    return entryView(updated);
  }

  /** Soft delete so the UI can offer Undo. */
  async remove(userId: string, id: string) {
    await this.own(userId, id);
    await this.db.update(diaryEntries).set({ deletedAt: new Date() }).where(eq(diaryEntries.id, id));
  }

  async restore(userId: string, id: string) {
    const entry = await this.own(userId, id, { includeDeleted: true });
    const [restored] = await this.db.update(diaryEntries).set({ deletedAt: null }).where(eq(diaryEntries.id, entry.id)).returning();
    return entryView(restored);
  }

  async day(userId: string, date: string) {
    const entries = await this.db
      .select()
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.date, date), isNull(diaryEntries.deletedAt)))
      .orderBy(asc(diaryEntries.createdAt));
    const meals = MEALS.map((meal) => {
      const list = entries.filter((e) => e.meal === meal);
      return { meal, totals: sum(list), entries: list.map(entryView) };
    });
    return { date, totals: sum(entries), meals };
  }

  /** Consecutive days with at least one entry, ending today (or yesterday if today is still empty). */
  async streak(userId: string, date: string): Promise<number> {
    const rows = await this.db
      .selectDistinct({ date: diaryEntries.date })
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, userId), isNull(diaryEntries.deletedAt), lte(diaryEntries.date, date)))
      .orderBy(desc(diaryEntries.date))
      .limit(400);
    const days = new Set(rows.map((r) => r.date));
    let cursor = days.has(date) ? date : addDays(date, -1);
    let n = 0;
    while (days.has(cursor)) {
      n++;
      cursor = addDays(cursor, -1);
    }
    return n;
  }
}

export interface NextBestFood {
  recipeId: string;
  name: string;
  meal: MealType;
  kcal: number;
  proteinG: number;
  reason: string;
}

/**
 * Picks one catalogue or own recipe for the next empty meal that closes the
 * protein gap without breaking the calorie budget. Deterministic and explainable.
 */
@Injectable()
export class SuggestionService {
  constructor(@InjectDb() private readonly db: Database) {}

  /**
   * @param hour the user's local hour, if the day is today: meals whose time has
   *             passed are skipped (no breakfast suggestions at 2 pm).
   */
  async nextBestFood(userId: string, meals: { meal: MealType; entries: unknown[] }[], left: Totals, hour?: number): Promise<NextBestFood | null> {
    if (left.calories < 120) return null;
    const firstSlot = hour == null ? 0 : hour < 11 ? 0 : hour < 16 ? 1 : hour < 21 ? 2 : 3;
    const order: MealType[] = ['breakfast', 'lunch', 'dinner'];
    const nextMeal = order.slice(firstSlot).find((m) => meals.find((g) => g.meal === m)?.entries.length === 0) ?? 'snack';
    const budget = nextMeal === 'snack' ? Math.min(left.calories, 350) : left.calories;
    const proteinGap = Math.max(left.proteinG, 0);

    const candidates = await this.db
      .select()
      .from(recipes)
      .where(
        and(
          eq(recipes.mealType, nextMeal),
          sql`(${recipes.ownerId} is null or ${recipes.ownerId} = ${userId})`,
          sql`${recipes.kcal} <= ${budget}`,
        ),
      )
      .limit(200);
    if (!candidates.length) return null;

    // Protein that actually counts towards the gap, per kcal; small bonus for using the budget well.
    const score = (r: (typeof candidates)[number]) => Math.min(r.proteinG, proteinGap || r.proteinG) / Math.max(r.kcal, 1) + (r.kcal / budget) * 0.02;
    const best = candidates.reduce((a, b) => (score(b) > score(a) ? b : a));

    const covered = Math.round(Math.min(best.proteinG, proteinGap));
    const reason =
      proteinGap >= 10
        ? `Covers ${covered} g of your remaining ${Math.round(proteinGap)} g protein and keeps you within budget.`
        : `Fits your remaining ${Math.round(left.calories)} kcal with plenty of protein.`;
    return { recipeId: best.id, name: best.name, meal: nextMeal, kcal: Math.round(best.kcal), proteinG: Math.round(best.proteinG), reason };
  }
}

@Injectable()
export class TodayService {
  constructor(
    private readonly diary: DiaryService,
    private readonly profiles: ProfileService,
    private readonly weights: WeightsService,
    private readonly suggestions: SuggestionService,
  ) {}

  async today(userId: string, date: string, hour?: number) {
    const [day, targets, weight, streak] = await Promise.all([
      this.diary.day(userId, date),
      this.profiles.targetsFor(userId, date),
      this.weights.latest(userId, date),
      this.diary.streak(userId, date),
    ]);
    const left = targets ? remaining(targets, day.totals) : null;
    const nextBestFood = left ? await this.suggestions.nextBestFood(userId, day.meals, left, hour) : null;
    return {
      date,
      targets,
      eaten: day.totals,
      remaining: left,
      progress: targets ? Math.round((day.totals.calories / targets.calories) * 100) : null,
      meals: day.meals,
      nextBestFood,
      weight,
      streak,
    };
  }
}

@ApiTags('diary')
@Controller()
export class DiaryController {
  constructor(
    private readonly diary: DiaryService,
    private readonly todayService: TodayService,
  ) {}

  /**
   * Everything the Today screen needs in one call: Goal − Food = Left.
   * `hour` (0-23) is the user's local hour, used to suggest the next meal.
   */
  @Get('today')
  today(@CurrentUser() user: AuthUser, @Query('date') date?: string, @Query('hour') hour?: string) {
    const h = hour != null && /^\d{1,2}$/.test(hour) && Number(hour) < 24 ? Number(hour) : undefined;
    return this.todayService.today(user.id, parseDateParam(date), h);
  }

  @Get('diary')
  day(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.diary.day(user.id, parseDateParam(date));
  }

  @Post('diary')
  add(@CurrentUser() user: AuthUser, @Body() dto: AddEntryDto) {
    return this.diary.add(user.id, dto);
  }

  @Patch('diary/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEntryDto) {
    return this.diary.update(user.id, id, dto);
  }

  @HttpCode(204)
  @Delete('diary/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.diary.remove(user.id, id);
  }

  /** Undo a delete. */
  @Post('diary/:id/restore')
  restore(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.diary.restore(user.id, id);
  }
}

@Module({
  imports: [FoodsModule, RecipesModule, WeightsModule, ProfileModule],
  controllers: [DiaryController],
  providers: [DiaryService, SuggestionService, TodayService],
})
export class DiaryModule {}
