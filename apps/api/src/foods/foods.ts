import { Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { and, desc, eq, ilike, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { Database, InjectDb } from '../db/db.module';
import { diaryEntries, foods } from '../db/schema';

export class SearchFoodsQuery {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

/** Custom food, values per 100 g. */
export class CreateFoodDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  /** EAN-8, UPC-A, EAN-13 or GTIN-14 digits. */
  @IsOptional()
  @Matches(/^\d{8}$|^\d{12,14}$/, { message: 'barcode must be 8, 12, 13 or 14 digits' })
  barcode?: string;

  @IsNumber()
  @Min(0)
  @Max(900)
  kcal: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  proteinG: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  fatG: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  carbsG: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(2000)
  servingG?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  servingName?: string;
}

const publicColumns = {
  id: foods.id,
  name: foods.name,
  nameBg: foods.nameBg,
  brand: foods.brand,
  barcode: foods.barcode,
  category: foods.category,
  kcal: foods.kcal,
  proteinG: foods.proteinG,
  fatG: foods.fatG,
  carbsG: foods.carbsG,
  fiberG: foods.fiberG,
  servingG: foods.servingG,
  servingName: foods.servingName,
  servingNameBg: foods.servingNameBg,
  source: foods.source,
  verified: foods.verified,
};

@Injectable()
export class FoodsService {
  constructor(@InjectDb() private readonly db: Database) {}

  /** Catalogue foods plus the user's own custom foods. */
  private visibleTo(userId: string) {
    return or(isNull(foods.createdById), eq(foods.createdById, userId));
  }

  /**
   * Searches English and Bulgarian names. Prefix matches first, then substring,
   * then trigram similarity (typo tolerant). Uses the GIN trigram indexes.
   */
  async search(userId: string, q: string | undefined, limit = 20) {
    const term = (q ?? '').trim();
    if (!term) {
      return this.db.select(publicColumns).from(foods).where(this.visibleTo(userId)).orderBy(foods.name).limit(limit);
    }
    const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    const prefix = `${term.replace(/[\\%_]/g, '\\$&')}%`;
    return this.db
      .select(publicColumns)
      .from(foods)
      .where(
        and(
          this.visibleTo(userId),
          or(ilike(foods.name, like), ilike(foods.nameBg, like), ilike(foods.brand, like), sql`${foods.name} % ${term}`, sql`${foods.nameBg} % ${term}`),
        ),
      )
      .orderBy(
        desc(sql`(${foods.name} ilike ${prefix} or coalesce(${foods.nameBg}, '') ilike ${prefix})`),
        desc(sql`greatest(similarity(${foods.name}, ${term}), similarity(coalesce(${foods.nameBg}, ''), ${term}))`),
        foods.name,
      )
      .limit(limit);
  }

  /** The user's own entry for a barcode wins over the catalogue's. */
  async byBarcode(userId: string, code: string) {
    const [food] = await this.db
      .select(publicColumns)
      .from(foods)
      .where(and(eq(foods.barcode, code), this.visibleTo(userId)))
      .orderBy(sql`${foods.createdById} is null`)
      .limit(1);
    if (!food) throw new NotFoundException('No food with this barcode yet');
    return food;
  }

  async byId(userId: string, id: string) {
    const [food] = await this.db
      .select(publicColumns)
      .from(foods)
      .where(and(eq(foods.id, id), this.visibleTo(userId)))
      .limit(1);
    if (!food) throw new NotFoundException('Food not found');
    return food;
  }

  async create(userId: string, dto: CreateFoodDto) {
    try {
      const [food] = await this.db
        .insert(foods)
        .values({ ...dto, source: 'user', verified: false, createdById: userId })
        .returning(publicColumns);
      return food;
    } catch (e) {
      if ((e as { cause?: { code?: string }; code?: string }).cause?.code === '23505' || (e as { code?: string }).code === '23505') {
        throw new ConflictException('You already have a food with this barcode');
      }
      throw e;
    }
  }

  /** Foods the user logged most recently, newest first. */
  async recent(userId: string, limit = 15) {
    const lastUsed = sql<string>`max(${diaryEntries.createdAt})`;
    return this.db
      .select({ ...publicColumns, lastUsedAt: lastUsed })
      .from(diaryEntries)
      .innerJoin(foods, eq(foods.id, diaryEntries.foodId))
      .where(and(eq(diaryEntries.userId, userId), isNull(diaryEntries.deletedAt), isNotNull(diaryEntries.foodId)))
      .groupBy(foods.id)
      .orderBy(desc(lastUsed))
      .limit(limit);
  }
}

@ApiTags('foods')
@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Get()
  search(@CurrentUser() user: AuthUser, @Query() query: SearchFoodsQuery) {
    return this.foodsService.search(user.id, query.q, query.limit);
  }

  @Get('recent')
  recent(@CurrentUser() user: AuthUser) {
    return this.foodsService.recent(user.id);
  }

  /** Free lookup by the number printed under a barcode. Camera scanning is the paid module. */
  @Get('barcode/:code')
  byBarcode(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    if (!/^\d{8,14}$/.test(code)) throw new NotFoundException('No food with this barcode yet');
    return this.foodsService.byBarcode(user.id, code);
  }

  @Get(':id')
  byId(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.foodsService.byId(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFoodDto) {
    return this.foodsService.create(user.id, dto);
  }
}

@Module({
  controllers: [FoodsController],
  providers: [FoodsService],
  exports: [FoodsService],
})
export class FoodsModule {}
