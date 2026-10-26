import { Body, Controller, Get, Global, Headers, HttpCode, Module, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { Request } from 'express';
import { AuthUser, CurrentUser, Public } from '../auth/decorators';
import { EntitlementsService, PAID_MODULES } from './entitlements.service';
import { ModuleGuard } from './requires-module';
import { Interval, PlanId, PLANS, StripeService } from './stripe.service';

class CheckoutDto {
  @ApiProperty({ enum: Object.keys(PLANS) })
  @IsIn(Object.keys(PLANS))
  plan: PlanId;

  @ApiProperty({ enum: ['month', 'year'] })
  @IsIn(['month', 'year'])
  interval: Interval;

  /** Locale-prefixed page to return to, e.g. "/bg/upgrade". Must be a local path. */
  @IsOptional()
  @IsIn(['/en/upgrade', '/bg/upgrade', '/en/settings', '/bg/settings'])
  returnPath?: string;
}

class PortalDto {
  @IsOptional()
  @IsIn(['/en/upgrade', '/bg/upgrade', '/en/settings', '/bg/settings'])
  returnPath?: string;
}

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly entitlements: EntitlementsService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {}

  private url(path = '/en/upgrade') {
    return `${(this.config.get<string>('WEB_URL') ?? 'http://localhost:3000').replace(/\/$/, '')}${path}`;
  }

  /** What the user has and what can be bought. */
  @Get()
  async status(@CurrentUser() user: AuthUser) {
    const active = await this.entitlements.activeModules(user.id);
    return {
      modules: Object.fromEntries(PAID_MODULES.map((m) => [m, active.has(m)])),
      entitlements: await this.entitlements.list(user.id),
      payments: this.stripe.enabled,
      plans: this.stripe.availablePlans(),
    };
  }

  @Post('checkout')
  async checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return { url: await this.stripe.checkout(user.id, dto.plan, dto.interval, this.url(dto.returnPath)) };
  }

  @Post('portal')
  async portal(@CurrentUser() user: AuthUser, @Body() dto: PortalDto) {
    return { url: await this.stripe.portal(user.id, this.url(dto.returnPath ?? '/en/settings')) };
  }

  /** Stripe → us. Signature-verified against the raw body. */
  @Public()
  @HttpCode(200)
  @ApiExcludeEndpoint()
  @Post('webhook')
  async webhook(@Req() req: Request & { rawBody?: Buffer }, @Headers('stripe-signature') signature?: string) {
    const event = this.stripe.parseEvent(req.rawBody ?? Buffer.alloc(0), signature);
    await this.stripe.handleEvent(event);
    return { received: true };
  }
}

@Global()
@Module({
  controllers: [BillingController],
  providers: [EntitlementsService, StripeService, ModuleGuard],
  exports: [EntitlementsService, StripeService, ModuleGuard],
})
export class BillingModule {}
