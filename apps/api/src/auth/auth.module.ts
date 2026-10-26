import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { enabledProviders, FacebookStrategy, GoogleStrategy } from './social.strategies';

/** Instantiating a strategy registers it with Passport, so disabled providers are never created. */
const socialStrategies: Provider[] = [
  {
    provide: 'GOOGLE_STRATEGY',
    inject: [ConfigService, AuthService],
    useFactory: (config: ConfigService, auth: AuthService) => (enabledProviders(config).google ? new GoogleStrategy(config, auth) : null),
  },
  {
    provide: 'FACEBOOK_STRATEGY',
    inject: [ConfigService, AuthService],
    useFactory: (config: ConfigService, auth: AuthService) => (enabledProviders(config).facebook ? new FacebookStrategy(config, auth) : null),
  },
];

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') ?? '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ...socialStrategies, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [AuthService],
})
export class AuthModule {}
