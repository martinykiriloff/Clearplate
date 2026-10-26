import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { computeTargets, TargetsInputError } from '@clearplate/targets';
import { and, desc, eq, lte } from 'drizzle-orm';
import { ageOn, clientToday, todayIso } from '../common/dates';
import { Database, InjectDb } from '../db/db.module';
import { profiles, TargetSet, targetSets, weightEntries } from '../db/schema';
import { ManualTargetsDto, OnboardingDto } from './dto';

export interface TargetsView {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  bmr: number;
  tdee: number;
  source: TargetSet['source'];
  effectiveFrom: string;
  warnings: string[];
}

const toView = (t: TargetSet): TargetsView => ({
  calories: t.calories,
  proteinG: t.proteinG,
  fatG: t.fatG,
  carbsG: t.carbsG,
  bmr: t.bmr,
  tdee: t.tdee,
  source: t.source,
  effectiveFrom: t.effectiveFrom,
  warnings: t.warnings,
});

@Injectable()
export class ProfileService {
  constructor(@InjectDb() private readonly db: Database) {}

  async onboard(userId: string, dto: OnboardingDto) {
    const today = clientToday(dto.today);
    const age = ageOn(dto.birthDate, today);
    if (age < 18) throw new BadRequestException('Clearplate is for adults 18 and over');

    let computed;
    try {
      computed = computeTargets({
        sex: dto.sex,
        age,
        heightCm: dto.heightCm,
        weightKg: dto.weightKg,
        activity: dto.activity,
        goal: dto.goal,
        pace: dto.pace,
        targetWeightKg: dto.targetWeightKg ?? null,
      });
    } catch (e) {
      if (e instanceof TargetsInputError) throw new BadRequestException(e.message);
      throw e;
    }

    const values = {
      sex: dto.sex,
      birthDate: dto.birthDate,
      heightCm: dto.heightCm,
      activity: dto.activity,
      goal: dto.goal,
      pace: dto.pace ?? 'standard',
      targetWeightKg: dto.targetWeightKg ?? null,
      unitSystem: dto.unitSystem ?? 'metric',
      marketingConsent: dto.marketingConsent ?? false,
    } as const;

    await this.db.transaction(async (tx) => {
      await tx
        .insert(profiles)
        .values({ userId, ...values, healthDataConsentAt: new Date() })
        .onConflictDoUpdate({ target: profiles.userId, set: values });
      await tx
        .insert(weightEntries)
        .values({ userId, date: today, weightKg: dto.weightKg })
        .onConflictDoUpdate({ target: [weightEntries.userId, weightEntries.date], set: { weightKg: dto.weightKg } });
      await tx.insert(targetSets).values({
        userId,
        effectiveFrom: today,
        source: 'questionnaire',
        calories: computed.calories,
        proteinG: computed.proteinG,
        fatG: computed.fatG,
        carbsG: computed.carbsG,
        bmr: computed.bmr,
        tdee: computed.tdee,
        warnings: computed.warnings,
      });
    });

    return { ...(await this.get(userId, today)), expectedWeeklyChangeKg: computed.expectedWeeklyChangeKg };
  }

  async get(userId: string, date = todayIso()) {
    const [profile] = await this.db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    if (!profile) throw new NotFoundException('Complete the questionnaire first');
    const { healthDataConsentAt, createdAt, updatedAt, ...rest } = profile;
    return { profile: { ...rest, healthDataConsentAt }, targets: await this.targetsFor(userId, date) };
  }

  /** Targets in force on a date; null before onboarding. */
  async targetsFor(userId: string, date: string): Promise<TargetsView | null> {
    const [row] = await this.db
      .select()
      .from(targetSets)
      .where(and(eq(targetSets.userId, userId), lte(targetSets.effectiveFrom, date)))
      .orderBy(desc(targetSets.effectiveFrom), desc(targetSets.createdAt))
      .limit(1);
    if (row) return toView(row);
    // Logged before the first target date (e.g. a back-dated entry): use the earliest set.
    const [first] = await this.db.select().from(targetSets).where(eq(targetSets.userId, userId)).orderBy(targetSets.effectiveFrom).limit(1);
    return first ? toView(first) : null;
  }

  async setManualTargets(userId: string, dto: ManualTargetsDto) {
    const today = clientToday(dto.today);
    const current = await this.targetsFor(userId, today);
    if (!current) throw new NotFoundException('Complete the questionnaire first');
    const [profile] = await this.db.select({ sex: profiles.sex }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
    const floor = profile?.sex === 'female' ? 1200 : 1500;
    if (dto.calories < floor) throw new BadRequestException(`Calories cannot go below ${floor} kcal`);

    await this.db.insert(targetSets).values({
      userId,
      effectiveFrom: today,
      source: 'manual',
      calories: dto.calories,
      proteinG: dto.proteinG,
      fatG: dto.fatG,
      carbsG: dto.carbsG,
      bmr: current.bmr,
      tdee: current.tdee,
      warnings: [],
    });
    return this.targetsFor(userId, today);
  }
}
