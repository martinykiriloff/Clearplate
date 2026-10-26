import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { and, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { Database, InjectDb } from '../db/db.module';
import { MealType, recipes } from '../db/schema';

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export class ListRecipesQuery {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiProperty({ enum: MEALS, required: false })
  @IsOptional()
  @IsIn(MEALS)
  mealType?: MealType;

  /** Only recipes that fit within this many kcal per serving. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxKcal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/** Macros are per serving. */
export class CreateRecipeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: MEALS })
  @IsIn(MEALS)
  mealType: MealType;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  base?: string;

  @IsString()
  @MaxLength(2000)
  ingredients: string;

  @IsString()
  @MaxLength(4000)
  method: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  servings?: number;

  @IsNumber()
  @Min(0)
  @Max(3000)
  kcal: number;

  @IsNumber()
  @Min(0)
  @Max(300)
  proteinG: number;

  @IsNumber()
  @Min(0)
  @Max(300)
  fatG: number;

  @IsNumber()
  @Min(0)
  @Max(500)
  carbsG: number;
}

@Injectable()
export class RecipesService {
  constructor(@InjectDb() private readonly db: Database) {}

  private visibleTo(userId: string) {
    return or(isNull(recipes.ownerId), eq(recipes.ownerId, userId));
  }

  list(userId: string, query: ListRecipesQuery) {
    const term = query.q?.trim();
    const conditions = [this.visibleTo(userId)];
    if (term) conditions.push(ilike(recipes.name, `%${term.replace(/[\\%_]/g, '\\$&')}%`));
    if (query.mealType) conditions.push(eq(recipes.mealType, query.mealType));
    if (query.maxKcal != null) conditions.push(sql`${recipes.kcal} <= ${query.maxKcal}`);
    return this.db
      .select()
      .from(recipes)
      .where(and(...conditions))
      // Highest protein per kcal first: the most useful default for fat loss.
      .orderBy(sql`${recipes.proteinG} / greatest(${recipes.kcal}, 1) desc`, recipes.name)
      .limit(query.limit ?? 50);
  }

  async get(userId: string, id: string) {
    const [recipe] = await this.db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, id), this.visibleTo(userId)))
      .limit(1);
    if (!recipe) throw new NotFoundException('Recipe not found');
    return recipe;
  }

  async create(userId: string, dto: CreateRecipeDto) {
    const [recipe] = await this.db
      .insert(recipes)
      .values({ ...dto, servings: dto.servings ?? 1, ownerId: userId })
      .returning();
    return recipe;
  }

  async remove(userId: string, id: string) {
    const deleted = await this.db
      .delete(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.ownerId, userId)))
      .returning({ id: recipes.id });
    if (!deleted.length) throw new NotFoundException('Recipe not found');
  }
}

@ApiTags('recipes')
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListRecipesQuery) {
    return this.recipesService.list(user.id, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.recipesService.get(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRecipeDto) {
    return this.recipesService.create(user.id, dto);
  }

  /** Only your own recipes can be deleted. */
  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.recipesService.remove(user.id, id);
  }
}

@Module({
  controllers: [RecipesController],
  providers: [RecipesService],
  exports: [RecipesService],
})
export class RecipesModule {}
