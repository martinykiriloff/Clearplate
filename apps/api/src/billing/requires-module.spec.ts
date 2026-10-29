import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { EntitlementsService } from './entitlements.service';
import { ModuleGuard } from './requires-module';

/** Minimal HTTP execution context carrying an optional authenticated user. */
function context(user?: { id: string }): ExecutionContext {
  const handler = () => undefined;
  return {
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('ModuleGuard', () => {
  const has = jest.fn<Promise<boolean>, [string, string]>();
  const entitlements = { has } as unknown as EntitlementsService;
  const reflector = { get: jest.fn() } as unknown as Reflector;
  const guard = new ModuleGuard(reflector, entitlements);

  beforeEach(() => jest.clearAllMocks());

  it('lets routes without @RequiresModule through', async () => {
    (reflector.get as jest.Mock).mockReturnValue(undefined);
    await expect(guard.canActivate(context({ id: 'u1' }))).resolves.toBe(true);
    expect(has).not.toHaveBeenCalled();
  });

  it('allows users with the module', async () => {
    (reflector.get as jest.Mock).mockReturnValue('insights');
    has.mockResolvedValue(true);
    await expect(guard.canActivate(context({ id: 'u1' }))).resolves.toBe(true);
    expect(has).toHaveBeenCalledWith('u1', 'insights');
  });

  it('answers 402 module_required otherwise, naming the module', async () => {
    (reflector.get as jest.Mock).mockReturnValue('insights');
    has.mockResolvedValue(false);
    const err = await guard.canActivate(context({ id: 'u1' })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(402);
    expect((err as HttpException).getResponse()).toMatchObject({ code: 'module_required', module: 'insights' });
  });

  it('answers 402 without a user instead of calling the database', async () => {
    (reflector.get as jest.Mock).mockReturnValue('data');
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(HttpException);
    expect(has).not.toHaveBeenCalled();
  });
});
