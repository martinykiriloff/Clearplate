import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { and, eq } from 'drizzle-orm';
import { Database, InjectDb } from '../db/db.module';
import { oauthAccounts, profiles, users } from '../db/schema';
import { LoginDto, RegisterDto } from './dto';
import { durationMs } from './session';

export type SocialProvider = 'google' | 'facebook';

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  onboarded: boolean;
}


@Injectable()
export class AuthService {
  readonly sessionMaxAgeMs: number;
  // Verifying against a dummy hash keeps response time equal for unknown emails.
  private readonly dummyHash = argon2.hash('clearplate-timing-equalizer', { type: argon2.argon2id });

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.sessionMaxAgeMs = durationMs(config.get<string>('JWT_EXPIRES_IN') ?? '7d');
  }

  async register(dto: RegisterDto): Promise<PublicUser> {
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const inserted = await this.db
      .insert(users)
      .values({ email: dto.email, passwordHash, name: dto.name ?? null })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (!inserted.length) throw new ConflictException('An account with this email already exists');
    return this.publicUser(inserted[0].id);
  }

  async login(dto: LoginDto): Promise<PublicUser> {
    const [user] = await this.db.select().from(users).where(eq(users.email, dto.email)).limit(1);
    const hash = user?.passwordHash ?? (await this.dummyHash);
    const ok = await argon2.verify(hash, dto.password).catch(() => false);
    if (!user || !user.passwordHash || !ok) throw new UnauthorizedException('Wrong email or password');
    return this.publicUser(user.id);
  }

  /**
   * Signs in with a social account. Links to an existing user with the same email
   * only when the provider says the email is verified (prevents account takeover).
   */
  async socialLogin(
    provider: SocialProvider,
    providerAccountId: string,
    email: string | undefined,
    emailVerified: boolean,
    name?: string,
  ): Promise<PublicUser> {
    const [linked] = await this.db
      .select({ userId: oauthAccounts.userId })
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, providerAccountId)))
      .limit(1);
    if (linked) return this.publicUser(linked.userId);

    if (!email) throw new UnauthorizedException(`${provider} did not share an email address`);
    const normalized = email.trim().toLowerCase();

    const userId = await this.db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
      if (existing && !emailVerified) {
        throw new ConflictException(`Sign in with your password first, then connect ${provider}`);
      }
      const id = existing?.id ?? (await tx.insert(users).values({ email: normalized, name: name ?? null }).returning({ id: users.id }))[0].id;
      await tx.insert(oauthAccounts).values({ userId: id, provider, providerAccountId }).onConflictDoNothing();
      return id;
    });
    return this.publicUser(userId);
  }

  async publicUser(userId: string): Promise<PublicUser> {
    const [row] = await this.db
      .select({ id: users.id, email: users.email, name: users.name, profileUserId: profiles.userId })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) throw new UnauthorizedException();
    return { id: row.id, email: row.email, name: row.name, onboarded: row.profileUserId != null };
  }

  issueToken(user: { id: string; email: string }): string {
    return this.jwt.sign({ sub: user.id, email: user.email });
  }

  /** GDPR erasure: cascades to profile, targets, diary, weights, own recipes and OAuth links. */
  async deleteAccount(userId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, userId));
  }
}
