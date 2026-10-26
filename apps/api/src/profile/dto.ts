import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export const SEXES = ['male', 'female'] as const;
export const GOALS = ['lose', 'gain', 'habits'] as const;
export const PACES = ['gentle', 'standard', 'fast'] as const;
export const ACTIVITY = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
export const UNITS = ['metric', 'imperial'] as const;

/** Onboarding questionnaire. All measures are metric; clients convert. */
export class OnboardingDto {
  @ApiProperty({ enum: SEXES })
  @IsIn(SEXES)
  sex: (typeof SEXES)[number];

  /** YYYY-MM-DD. Users must be 18 or older. */
  @IsDateString({ strict: true })
  birthDate: string;

  @IsNumber()
  @Min(120)
  @Max(230)
  heightCm: number;

  @IsNumber()
  @Min(35)
  @Max(350)
  weightKg: number;

  @ApiProperty({ enum: ACTIVITY })
  @IsIn(ACTIVITY)
  activity: (typeof ACTIVITY)[number];

  @ApiProperty({ enum: GOALS })
  @IsIn(GOALS)
  goal: (typeof GOALS)[number];

  @ApiProperty({ enum: PACES, required: false })
  @IsOptional()
  @IsIn(PACES)
  pace?: (typeof PACES)[number];

  @IsOptional()
  @IsNumber()
  @Min(35)
  @Max(350)
  targetWeightKg?: number;

  @ApiProperty({ enum: UNITS, required: false })
  @IsOptional()
  @IsIn(UNITS)
  unitSystem?: (typeof UNITS)[number];

  /** Explicit consent to process health data (GDPR Art. 9). Must be true. */
  @Equals(true, { message: 'Consent to process health data is required' })
  healthDataConsent: boolean;

  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  /** The user's local date, YYYY-MM-DD. Defaults to the server's date. */
  @IsOptional()
  @IsDateString({ strict: true })
  today?: string;
}

/** Manual override of the computed targets. */
export class ManualTargetsDto {
  @IsInt()
  @Min(1200)
  @Max(6000)
  calories: number;

  @IsInt()
  @Min(30)
  @Max(400)
  proteinG: number;

  @IsInt()
  @Min(20)
  @Max(300)
  fatG: number;

  @IsInt()
  @Min(0)
  @Max(800)
  carbsG: number;

  @IsOptional()
  @IsDateString({ strict: true })
  today?: string;
}
