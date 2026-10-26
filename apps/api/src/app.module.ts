import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { validateEnv } from './config/env';
import { DbModule } from './db/db.module';
import { DiaryModule } from './diary/diary';
import { FoodsModule } from './foods/foods';
import { HealthController } from './health/health.controller';
import { ProfileModule } from './profile/profile.module';
import { RecipesModule } from './recipes/recipes';
import { WeightsModule } from './weights/weights';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: ['.env', '../../.env'] }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 300 }], skipIf: () => process.env.NODE_ENV === 'test' }),
    DbModule,
    BillingModule,
    AuthModule,
    ProfileModule,
    FoodsModule,
    RecipesModule,
    WeightsModule,
    DiaryModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
