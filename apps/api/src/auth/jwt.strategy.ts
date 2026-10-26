import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Database, InjectDb } from '../db/db.module';
import { users } from '../db/schema';
import { SESSION_COOKIE } from './session';
import type { AuthUser } from './decorators';

const fromCookie = (req: Request): string | null => (req?.cookies?.[SESSION_COOKIE] as string | undefined) ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectDb() private readonly db: Database,
  ) {
    super({
      // Native clients send a bearer token; the web uses the httpOnly cookie.
      // Bearer first, so a stale cookie never shadows a valid explicit token.
      jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), fromCookie]),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: { sub: string; email: string; v?: number }): Promise<AuthUser> {
    // Tokens of deleted accounts or revoked sessions must stop working immediately.
    const [user] = await this.db
      .select({ id: users.id, email: users.email, tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (!user || (payload.v ?? 0) !== user.tokenVersion) throw new UnauthorizedException();
    return { id: user.id, email: user.email };
  }
}
