import { Body, Controller, Delete, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, PublicUser } from './auth.service';
import { AuthUser, CurrentUser, Public } from './decorators';
import { LoginDto, RegisterDto } from './dto';
import { clearSessionCookie, setSessionCookie } from './session';
import { enabledProviders, FacebookGuard, GoogleGuard } from './social.strategies';

const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('providers')
  providers() {
    return { email: true, ...enabledProviders(this.config) };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    return this.startSession(await this.auth.register(dto), res);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.startSession(await this.auth.login(dto), res);
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    clearSessionCookie(res);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.publicUser(user.id);
  }

  /** Permanently deletes the account and all of its data (GDPR Art. 17). */
  @HttpCode(204)
  @Delete('me')
  async deleteMe(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.deleteAccount(user.id);
    clearSessionCookie(res);
  }

  @Public()
  @UseGuards(GoogleGuard)
  @Get('google')
  google() {
    // Passport redirects to Google.
  }

  @Public()
  @UseGuards(GoogleGuard)
  @Get('google/callback')
  googleCallback(@Req() req: Request, @Res() res: Response) {
    this.finishSocial(req, res);
  }

  @Public()
  @UseGuards(FacebookGuard)
  @Get('facebook')
  facebook() {
    // Passport redirects to Facebook.
  }

  @Public()
  @UseGuards(FacebookGuard)
  @Get('facebook/callback')
  facebookCallback(@Req() req: Request, @Res() res: Response) {
    this.finishSocial(req, res);
  }

  private startSession(user: PublicUser, res: Response) {
    const token = this.auth.issueToken(user);
    setSessionCookie(res, token, this.auth.sessionMaxAgeMs);
    // The token is also returned for native clients that cannot use cookies.
    return { user, accessToken: token };
  }

  private finishSocial(req: Request, res: Response) {
    const web = (this.config.get<string>('WEB_URL') ?? '').replace(/\/$/, '');
    const user = req.user as PublicUser | null | undefined;
    if (!user) return res.redirect(`${web}/login?error=social`);
    setSessionCookie(res, this.auth.issueToken(user), this.auth.sessionMaxAgeMs);
    return res.redirect(`${web}${user.onboarded ? '/today' : '/onboarding'}`);
  }
}
