import { ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { Strategy as FacebookStrategyBase, Profile as FacebookProfile } from 'passport-facebook';
import { Strategy as GoogleStrategyBase, Profile as GoogleProfile } from 'passport-google-oauth20';
import { AuthService, PublicUser, SocialProvider } from './auth.service';

/**
 * Social providers are optional: each one is enabled only when its credentials
 * are present in the environment. OAuth callbacks go through the web origin
 * (Next.js proxies /api), so the session cookie is first-party.
 */
export function callbackUrl(config: ConfigService, provider: SocialProvider): string {
  const base = config.get<string>('OAUTH_CALLBACK_BASE') ?? config.get<string>('WEB_URL') ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/api/auth/${provider}/callback`;
}

export function enabledProviders(config: ConfigService): Record<SocialProvider, boolean> {
  return {
    google: !!(config.get('GOOGLE_CLIENT_ID') && config.get('GOOGLE_CLIENT_SECRET')),
    facebook: !!(config.get('FACEBOOK_APP_ID') && config.get('FACEBOOK_APP_SECRET')),
  };
}

export class GoogleStrategy extends PassportStrategy(GoogleStrategyBase, 'google') {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      clientID: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: callbackUrl(config, 'google'),
      scope: ['email', 'profile'],
    });
  }

  async validate(_access: string, _refresh: string, profile: GoogleProfile): Promise<PublicUser> {
    const email = profile.emails?.[0]?.value;
    const verified = profile._json?.email_verified === true;
    return this.auth.socialLogin('google', profile.id, email, verified, profile.displayName);
  }
}

export class FacebookStrategy extends PassportStrategy(FacebookStrategyBase, 'facebook') {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      clientID: config.getOrThrow<string>('FACEBOOK_APP_ID'),
      clientSecret: config.getOrThrow<string>('FACEBOOK_APP_SECRET'),
      callbackURL: callbackUrl(config, 'facebook'),
      scope: ['email'],
      profileFields: ['id', 'emails', 'name', 'displayName'],
      graphAPIVersion: 'v21.0',
    });
  }

  async validate(_access: string, _refresh: string, profile: FacebookProfile): Promise<PublicUser> {
    // Facebook only returns emails the user has confirmed.
    const email = profile.emails?.[0]?.value;
    return this.auth.socialLogin('facebook', profile.id, email, !!email, profile.displayName);
  }
}

function socialGuard(provider: SocialProvider) {
  @Injectable()
  class SocialGuard extends AuthGuard(provider) {
    constructor(private readonly config: ConfigService) {
      super({ session: false });
    }

    canActivate(context: ExecutionContext) {
      if (!enabledProviders(this.config)[provider]) throw new NotFoundException(`${provider} sign-in is not enabled`);
      return super.canActivate(context);
    }

    /** Never throw on the callback: the controller redirects back to the login page instead. */
    handleRequest<T>(err: unknown, user: T): T | null {
      return err || !user ? null : user;
    }
  }
  return SocialGuard;
}

export const GoogleGuard = socialGuard('google');
export const FacebookGuard = socialGuard('facebook');
