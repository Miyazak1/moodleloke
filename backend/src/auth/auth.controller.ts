import { Body, Controller, Get, Headers, HttpException, Logger, Patch, Post, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { CurrentUser } from './current-user.decorator';
import { RequiredUserGuard } from './auth.guards';
import {
  assertCookieCsrf,
  assertTrustedCookieOrigin,
  buildClearCsrfCookie,
  buildClearOAuthStateCookie,
  buildClearRefreshCookie,
  buildCsrfCookie,
  buildOAuthStateCookie,
  buildRefreshCookie,
  isLegacyRefreshFallbackEnabled,
  readOAuthStateCookie,
  readRefreshCookie
} from './auth.cookies';
import { AuthService } from './auth.service';
import { AuthPayload, ForgotPasswordInput, MePasswordUpdateInput, MeProfileUpdateInput, ResetPasswordInput } from './auth.types';

type AuthHttpRequest = {
  headers: Record<string, string | string[] | undefined>;
};

type AuthHttpResponse = {
  setHeader(name: string, value: string | string[]): void;
  redirect(url: string): void;
};

@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post(['auth/login', 'api/v1/auth/login'])
  async login(@Body() payload: AuthPayload, @Headers('user-agent') userAgent: string | undefined, @Res({ passthrough: true }) response: AuthHttpResponse) {
    const result = await this.authService.login(payload, userAgent);
    this.setRefreshCookie(response, result.tokens.refreshToken);
    return result;
  }

  @Post(['auth/register', 'api/v1/auth/register'])
  async register(@Body() payload: AuthPayload, @Headers('user-agent') userAgent: string | undefined, @Res({ passthrough: true }) response: AuthHttpResponse) {
    const result = await this.authService.register(payload, userAgent);
    this.setRefreshCookie(response, result.tokens.refreshToken);
    return result;
  }

  @Post(['auth/refresh', 'api/v1/auth/refresh'])
  async refresh(
    @Req() request: AuthHttpRequest,
    @Headers('authorization') authorization: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) response: AuthHttpResponse
  ) {
    const cookieToken = readRefreshCookie(this.header(request, 'cookie'));
    const result = cookieToken
      ? await this.refreshFromCookie(request, cookieToken, userAgent)
      : await this.refreshFromBearerFallback(authorization, userAgent);
    this.setRefreshCookie(response, result.tokens.refreshToken);
    return result;
  }

  @Get(['auth/google/start', 'api/v1/auth/google/start'])
  googleStart(
    @Query('redirect') redirect: string | undefined,
    @Res() response: AuthHttpResponse
  ) {
    try {
      const result = this.authService.createGoogleOAuthStart(redirect);
      this.setCookies(response, [buildOAuthStateCookie(result.stateCookie)]);
      response.redirect(result.authorizationUrl);
    } catch (nextError) {
      response.redirect(this.authService.buildOAuthErrorRedirect(this.mapGoogleAuthError(nextError), redirect));
    }
  }

  @Post(['auth/google/link/start', 'api/v1/auth/google/link/start'])
  @UseGuards(RequiredUserGuard)
  googleLinkStart(
    @CurrentUser() user: PrismaUser,
    @Query('redirect') redirect: string | undefined,
    @Res({ passthrough: true }) response: AuthHttpResponse
  ) {
    const result = this.authService.createGoogleOAuthLinkStart(user, redirect);
    this.setCookies(response, [buildOAuthStateCookie(result.stateCookie)]);
    return { authorizationUrl: result.authorizationUrl };
  }

  @Get(['auth/google/callback', 'api/v1/auth/google/callback'])
  async googleCallback(
    @Req() request: AuthHttpRequest,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res() response: AuthHttpResponse
  ) {
    const stateCookie = readOAuthStateCookie(this.header(request, 'cookie'));
    try {
      if (error) {
        response.setHeader('Set-Cookie', buildClearOAuthStateCookie());
        response.redirect(this.authService.buildOAuthErrorRedirect(error === 'access_denied' ? 'google_denied' : 'google_failed'));
        return;
      }
      const result = await this.authService.completeGoogleOAuth({ code, state, stateCookie, userAgent });
      this.setRefreshCookie(response, result.result.tokens.refreshToken, [buildClearOAuthStateCookie()]);
      response.redirect(this.authService.buildOAuthSuccessRedirect(result.redirectTo));
    } catch (nextError) {
      const mappedError = this.mapGoogleAuthError(nextError);
      this.logger.warn(`Google OAuth callback failed: ${this.formatGoogleAuthLog(nextError)}; mappedError=${mappedError}`);
      this.setCookies(response, [buildClearOAuthStateCookie()]);
      response.redirect(this.authService.buildOAuthErrorRedirect(mappedError));
    }
  }

  @Post(['auth/email/verification/resend', 'api/v1/auth/email/verification/resend'])
  @UseGuards(RequiredUserGuard)
  resendEmailVerification(@CurrentUser() user: PrismaUser) {
    return this.authService.resendEmailVerificationForUser(user);
  }

  @Get(['auth/email/verify', 'api/v1/auth/email/verify'])
  async verifyEmail(@Query('token') token: string | undefined, @Res() response: AuthHttpResponse) {
    try {
      await this.authService.verifyEmailToken(token);
      response.redirect(this.authService.buildEmailVerificationSuccessRedirect());
    } catch {
      response.redirect(this.authService.buildEmailVerificationErrorRedirect());
    }
  }

  @Post(['auth/password/forgot', 'api/v1/auth/password/forgot'])
  forgotPassword(@Body() payload: ForgotPasswordInput) {
    return this.authService.forgotPassword(payload);
  }

  @Post(['auth/password/reset', 'api/v1/auth/password/reset'])
  resetPassword(@Body() payload: ResetPasswordInput) {
    return this.authService.resetPassword(payload);
  }

  @Post(['auth/logout', 'api/v1/auth/logout'])
  async logout(@Req() request: AuthHttpRequest, @Headers('authorization') authorization: string | undefined, @Res({ passthrough: true }) response: AuthHttpResponse) {
    const cookieToken = readRefreshCookie(this.header(request, 'cookie'));
    const result = cookieToken ? await this.logoutCookie(request, cookieToken) : authorization ? await this.authService.logout(authorization) : { revoked: true };
    this.clearRefreshCookie(response);
    return result;
  }

  @Post(['auth/logout-all', 'api/v1/auth/logout-all'])
  @UseGuards(RequiredUserGuard)
  async logoutAll(@CurrentUser() user: PrismaUser, @Res({ passthrough: true }) response: AuthHttpResponse) {
    const result = await this.authService.logoutAllForUser(user.id);
    this.clearRefreshCookie(response);
    return result;
  }

  @Get(['me', 'auth/me', 'api/v1/auth/me'])
  @UseGuards(RequiredUserGuard)
  me(@CurrentUser() user: PrismaUser) {
    return this.authService.meForUser(user);
  }

  @Patch(['auth/me/profile', 'api/v1/auth/me/profile'])
  @UseGuards(RequiredUserGuard)
  updateMeProfile(@CurrentUser() user: PrismaUser, @Body() payload: MeProfileUpdateInput) {
    return this.authService.updateMeProfileForUser(user.id, payload);
  }

  @Patch(['auth/me/password', 'api/v1/auth/me/password'])
  @UseGuards(RequiredUserGuard)
  updateMePassword(@CurrentUser() user: PrismaUser, @Body() payload: MePasswordUpdateInput) {
    return this.authService.updateMePasswordForUser(user, payload);
  }

  private async refreshFromCookie(request: AuthHttpRequest, token: string, userAgent?: string) {
    assertTrustedCookieOrigin(request.headers);
    assertCookieCsrf(request.headers);
    return this.authService.refreshToken(token, userAgent);
  }

  private async logoutCookie(request: AuthHttpRequest, token: string) {
    assertTrustedCookieOrigin(request.headers);
    assertCookieCsrf(request.headers);
    return this.authService.logoutToken(token);
  }

  private refreshFromBearerFallback(authorization: string | undefined, userAgent?: string) {
    if (!isLegacyRefreshFallbackEnabled()) {
      throw new UnauthorizedException('请重新登录。');
    }
    return this.authService.refresh(authorization, userAgent);
  }

  private setRefreshCookie(response: AuthHttpResponse, token: string, extraCookies: string[] = []) {
    const cookie = buildRefreshCookie(token);
    const csrfCookie = buildCsrfCookie();
    this.setCookies(response, [cookie, csrfCookie?.cookie, ...extraCookies]);
  }

  private clearRefreshCookie(response: AuthHttpResponse) {
    const cookie = buildClearRefreshCookie();
    const csrfCookie = buildClearCsrfCookie();
    this.setCookies(response, [cookie, csrfCookie]);
  }

  private setCookies(response: AuthHttpResponse, cookies: Array<string | undefined>) {
    const safeCookies = cookies.filter((item): item is string => Boolean(item));
    if (safeCookies.length) response.setHeader('Set-Cookie', safeCookies);
  }

  private header(request: AuthHttpRequest, name: string) {
    const value = request.headers[name] ?? request.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  private mapGoogleAuthError(error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (/停用/.test(message)) return 'account_disabled';
    if (/管理员/.test(message)) return 'admin_google_binding_required';
    if (/未配置/.test(message)) return 'google_not_configured';
    if (/邮箱未验证/.test(message)) return 'google_email_unverified';
    if (/已绑定|已经绑定|属于另一个/.test(message)) return 'google_account_conflict';
    return 'google_failed';
  }

  private formatGoogleAuthLog(error: unknown) {
    if (!(error instanceof Error)) return 'type=unknown message=unknown';
    const status = error instanceof HttpException ? error.getStatus() : undefined;
    const safeMessage = error.message.replace(/\s+/g, ' ').slice(0, 300);
    return `type=${error.constructor.name}${status ? ` status=${status}` : ''} message="${safeMessage}"`;
  }
}
