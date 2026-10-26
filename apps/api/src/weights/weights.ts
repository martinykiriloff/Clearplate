import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { weightTrend } from '@clearplate/targets';
import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { and, asc, eq, lte } from 'drizzle-orm';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { addDays, isIsoDate, parseDateParam } from '../common/dates';
import { Database, InjectDb } from '../db/db.module';
import { weightEntries } from '../db/schema';

export class LogWeightDto {
  /** YYYY-MM-DD, defaults to today. One weigh-in per day: logging again replaces it. */
  @IsOptional()
  @IsDateString({ strict: true })
  date?: string;

  @IsNumber()
  @Min(35)
  @Max(350)
  weightKg: number;
}

export class WeightRangeQuery {
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}

@Injectable()
export class WeightsService {
  constructor(@InjectDb() private readonly db: Database) {}

  async log(userId: string, dto: LogWeightDto) {
    const date = parseDateParam(dto.date);
    const [row] = await this.db
      .insert(weightEntries)
      .values({ userId, date, weightKg: dto.weightKg })
      .onConflictDoUpdate({ target: [weightEntries.userId, weightEntries.date], set: { weightKg: dto.weightKg } })
      .returning({ date: weightEntries.date, weightKg: weightEntries.weightKg });
    return row;
  }

  /**
   * Weigh-ins with a smoothed trend. The trend is computed over the whole
   * history so the first visible point is not distorted, then cut to the range.
   */
  async range(userId: string, from?: string, to?: string) {
    const end = to ?? parseDateParam(undefined);
    const start = from ?? addDays(end, -89);
    const all = await this.db
      .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
      .from(weightEntries)
      .where(and(eq(weightEntries.userId, userId), lte(weightEntries.date, end)))
      .orderBy(asc(weightEntries.date));
    const points = weightTrend(all).filter((p) => p.date >= start);
    return { from: start, to: end, points, summary: this.summarize(points) };
  }

  /** Latest trend value and change over the last 7 days of trend. */
  async latest(userId: string, date: string) {
    const { points } = await this.range(userId, addDays(date, -30), date);
    return this.summarize(points);
  }

  private summarize(points: { date: string; weightKg: number; trendKg: number }[]) {
    if (!points.length) return null;
    const last = points[points.length - 1];
    // Compare with the trend about a week ago; null until there is enough history.
    const weekAgo = addDays(last.date, -7);
    const base = [...points].reverse().find((p) => p.date <= weekAgo && p.date >= addDays(weekAgo, -3));
    return {
      date: last.date,
      weightKg: last.weightKg,
      trendKg: last.trendKg,
      change7dKg: base ? Math.round((last.trendKg - base.trendKg) * 10) / 10 : null,
    };
  }

  async remove(userId: string, date: string) {
    const deleted = await this.db
      .delete(weightEntries)
      .where(and(eq(weightEntries.userId, userId), eq(weightEntries.date, date)))
      .returning({ id: weightEntries.id });
    if (!deleted.length) throw new NotFoundException('No weigh-in on that date');
  }
}

@ApiTags('weights')
@Controller('weights')
export class WeightsController {
  constructor(private readonly weights: WeightsService) {}

  @Put()
  log(@CurrentUser() user: AuthUser, @Body() dto: LogWeightDto) {
    return this.weights.log(user.id, dto);
  }

  @Get()
  range(@CurrentUser() user: AuthUser, @Query() query: WeightRangeQuery) {
    return this.weights.range(user.id, query.from, query.to);
  }

  @HttpCode(204)
  @Delete(':date')
  remove(@CurrentUser() user: AuthUser, @Param('date') date: string) {
    if (!isIsoDate(date)) throw new NotFoundException('No weigh-in on that date');
    return this.weights.remove(user.id, date);
  }
}

@Module({
  controllers: [WeightsController],
  providers: [WeightsService],
  exports: [WeightsService],
})
export class WeightsModule {}
