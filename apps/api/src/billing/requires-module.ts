import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../auth/decorators';
import type { PaidModule } from '../db/schema';
import { EntitlementsService } from './entitlements.service';

const MODULE_KEY = 'requiresModule';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const module = this.reflector.get<Exclude<PaidModule, 'all'>>(MODULE_KEY, ctx.getHandler());
    if (!module) return true;
    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    if (user && (await this.entitlements.has(user.id, module))) return true;
    // 402 with a stable code so clients can show the right upgrade screen.
    throw new HttpException({ statusCode: 402, code: 'module_required', module, message: `The ${module} module is required` }, HttpStatus.PAYMENT_REQUIRED);
  }
}

/** Route needs an active paid module (runs after the global auth guard). */
export const RequiresModule = (module: Exclude<PaidModule, 'all'>) => applyDecorators(SetMetadata(MODULE_KEY, module), UseGuards(ModuleGuard));
