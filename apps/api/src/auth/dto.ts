import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const LOCALES = ['en', 'bg'] as const;
export type LocaleCode = (typeof LOCALES)[number];

const normalizeEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class RegisterDto {
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** At least 10 characters. */
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  /** UI language chosen at sign-up. */
  @IsOptional()
  @IsIn(LOCALES)
  locale?: LocaleCode;
}

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn(LOCALES)
  locale?: LocaleCode;
}

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(128)
  password: string;
}
