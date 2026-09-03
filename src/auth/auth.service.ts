import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, type User } from '@prisma/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { UsersService } from '../users/users.service';
import type { AuthUserDto } from './dto/auth-response.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResendVerificationDto } from './dto/resend-verification.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { VerifyEmailDto } from './dto/verify-email.dto';
import type { VerifySessionDto } from './dto/verify-session.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import { SupabaseService } from './supabase.service';

interface SupabaseErrorLike {
  message?: string;
  status?: number;
}

/**
 * Authentication orchestration.
 *
 * ALL credential management and ALL email verification live in Supabase
 * Auth â€” this backend never stores, hashes or verifies passwords itself and
 * never sends verification emails itself. After a successful Supabase
 * credential check, this backend issues its own JWT (single consistent
 * token mechanism for the API).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = (
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
    ).replace(/\/+$/, '');
  }

  /** Target of the link inside the verification email. */
  private get emailRedirectTo(): string {
    return `${this.frontendUrl}/auth/verify`;
  }

  /** Target of the link inside the reset-password email. */
  private get resetPasswordRedirectTo(): string {
    return `${this.frontendUrl}/auth/reset-password`;
  }

  // ---------------------------------------------------------------------
  // Registration (Supabase sends the confirmation email)
  // ---------------------------------------------------------------------

  async register(dto: RegisterDto) {
    const { data, error } = await this.supabase.signUp({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      emailRedirectTo: this.emailRedirectTo,
    });

    if (error) {
      this.throwRegisterError(error);
    }

    const supabaseUser = data.user;
    if (!supabaseUser) {
      throw new InternalServerErrorException('Registration failed unexpectedly');
    }

    // Supabase returns an "empty" user (no identities) when the email is
    // already registered and confirmed.
    if (supabaseUser.identities && supabaseUser.identities.length === 0) {
      throw new ConflictException({
        message: 'An account with this email already exists',
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }

    const verified = Boolean(supabaseUser.email_confirmed_at);

    // Email confirmation disabled in the dashboard -> Supabase returned a
    // session immediately; sync the user and issue our JWT right away.
    if (verified && data.session) {
      // SECURITY: Public registration always creates ATTENDEE users; ignore
      // any client-supplied role to prevent privilege escalation.
      const localUser = await this.syncUser(
        supabaseUser,
        dto.name,
        UserRole.ATTENDEE,
      );
      const expiresIn = this.expiresInSeconds();
      return {
        message: 'Registration successful. You are now signed in.',
        emailVerificationRequired: false,
        accessToken: await this.signToken(localUser),
        refreshToken: data.session.refresh_token,
        expiresIn,
        user: this.toAuthUser(localUser),
      };
    }

    // Email verification required -> no session returned yet.
    return {
      message: 'Registration successful. Please check your inbox and verify your email before signing in.',
      emailVerificationRequired: true,
    };
  }

  // ---------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------

  async login(dto: LoginDto) {
    const { data, error } = await this.supabase.signInWithPassword(
      dto.email,
      dto.password,
    );

    if (error) {
      this.throwLoginError(error);
    }

    const supabaseUser = data.user;
    const session = data.session;
    if (!supabaseUser || !session) {
      throw new UnauthorizedException({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Security policy: unverified users may not sign in.
    if (!supabaseUser.email_confirmed_at) {
      throw new ForbiddenException({
        message: 'Email not verified. Please verify your email before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const localUser = await this.syncUser(supabaseUser);
    return {
      accessToken: await this.signToken(localUser),
      tokenType: 'Bearer',
      expiresIn: this.expiresInSeconds(),
      refreshToken: session.refresh_token,
      user: this.toAuthUser(localUser),
    };
  }

  // ---------------------------------------------------------------------
  // Email verification (Supabase owns the tokens; we only relay them)
  // ---------------------------------------------------------------------

  async verifyEmail(dto: VerifyEmailDto) {
    this.requireCredential(dto.code, dto.tokenHash, dto.token);
    const supabaseUser = await this.resolveVerifiedUser(dto);
    const localUser = await this.syncUser(supabaseUser);
    return {
      verified: true,
      message: 'Email verified successfully. You can now sign in.',
      user: this.toAuthUser(localUser),
    };
  }

  /**
   * Handles the implicit-flow confirmation link whose URL hash carries an
   * `access_token` (no relay-able `token_hash`). The browser sends that
   * Supabase token here; we validate it, sync the local user and issue our
   * own JWT so the user is signed in immediately.
   */
  async verifySession(dto: VerifySessionDto) {
    let supabaseUser: SupabaseUser;
    try {
      const { data, error } = await this.supabase.getUserByAccessToken(
        dto.accessToken,
      );
      if (error || !data.user) throw error ?? new Error('No user returned');
      supabaseUser = data.user;
    } catch (err) {
      this.logger.warn(`Session verification failed: ${(err as Error)?.message}`);
      throw new BadRequestException({
        message: 'This verification link is invalid or has expired',
        code: 'INVALID_VERIFICATION',
      });
    }

    const localUser = await this.syncUser(supabaseUser);
    return {
      accessToken: await this.signToken(localUser),
      tokenType: 'Bearer',
      expiresIn: this.expiresInSeconds(),
      refreshToken: dto.refreshToken,
      user: this.toAuthUser(localUser),
    };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const { error } = await this.supabase.resendConfirmationEmail(
      dto.email,
      this.emailRedirectTo,
    );

    if (error && /rate limit/i.test(error.message ?? '')) {
      throw this.rateLimited(
        'Too many verification emails requested. Please try again later.',
      );
    }

    // Always return the same response to avoid account enumeration.
    return {
      message:
        'If an account exists for this email and has not been verified yet, a new verification email has been sent.',
    };
  }

  // ---------------------------------------------------------------------
  // Password reset (Supabase-native recovery flow)
  // ---------------------------------------------------------------------

  async forgotPassword(dto: ForgotPasswordDto) {
    const { error } = await this.supabase.resetPasswordForEmail(
      dto.email,
      this.resetPasswordRedirectTo,
    );

    if (error && /rate limit/i.test(error.message ?? '')) {
      throw this.rateLimited('Too many requests. Please try again later.');
    }

    // Always return the same response to avoid account enumeration.
    return {
      message:
        'If an account exists for this email, a password reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    this.requireCredential(dto.code, dto.tokenHash, dto.token);

    // 1. Resolve the Supabase user behind the recovery credential.
    let supabaseUser: SupabaseUser;
    if (dto.code) {
      const { data, error } = await this.supabase.exchangeCodeForSession(dto.code);
      if (error || !data.user) {
        throw this.invalidResetLink();
      }
      supabaseUser = data.user;
    } else {
      const { data, error } = await this.supabase.verifyOtp({
        email: dto.email,
        tokenHash: dto.tokenHash,
        token: dto.token,
        type: 'recovery',
      });
      if (error || !data.user) {
        throw this.invalidResetLink();
      }
      supabaseUser = data.user;
    }

    // 2. Set the new password in Supabase (the ONLY credential store).
    const { error: updateError } = await this.supabase.updateUserPassword(
      supabaseUser.id,
      dto.newPassword,
    );
    if (updateError) {
      if (/password/i.test(updateError.message ?? '')) {
        throw new BadRequestException({
          message: 'Password does not meet the security requirements',
          code: 'WEAK_PASSWORD',
        });
      }
      throw this.invalidResetLink();
    }

    return {
      message: 'Password updated successfully. You can now sign in with your new password.',
    };
  }

  // ---------------------------------------------------------------------
  // OAuth (Google Sign-In)
  // ---------------------------------------------------------------------

  /**
   * Initiate OAuth flow with Google.
   * Returns the authorization URL for the frontend to redirect to.
   */
  async initiateOAuth(provider: 'google'): Promise<{ url: string }> {
    return this.supabase.signInWithOAuth(provider);
  }

  /**
   * Handle OAuth callback after Google authentication.
   * Exchanges the authorization code for a Supabase session,
   * syncs the user to the local database, and issues a JWT.
   */
  async handleOAuthCallback(code: string) {
    // Exchange code for session
    const { data, error } = await this.supabase.exchangeCodeForSession(code);

    if (error || !data.session?.user) {
      this.logger.error(`OAuth callback failed: ${error?.message ?? 'No session'}`);
      throw new UnauthorizedException({
        message: 'OAuth authentication failed',
        code: 'OAUTH_FAILED',
      });
    }

    const supabaseUser = data.session.user;

    // Sync user to local database (OAuth users default to ATTENDEE role)
    const localUser = await this.syncUser(supabaseUser, UserRole.ATTENDEE);

    // Issue backend JWT
    const accessToken = await this.signToken(localUser);
    const expiresIn = this.expiresInSeconds();

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      refreshToken: data.session.refresh_token ?? '',
      user: this.toAuthUser(localUser),
    };
  }

  // ---------------------------------------------------------------------
  // Token refresh
  // ---------------------------------------------------------------------

  async refresh(dto: RefreshTokenDto) {
    const { data, error } = await this.supabase.refreshSession(dto.refreshToken);

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException({
        message: 'Refresh token is invalid or expired',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    const localUser = await this.syncUser(data.user);
    return {
      accessToken: await this.signToken(localUser),
      tokenType: 'Bearer',
      expiresIn: this.expiresInSeconds(),
      refreshToken: data.session.refresh_token,
      user: this.toAuthUser(localUser),
    };
  }

  // ---------------------------------------------------------------------
  // Current user
  // ---------------------------------------------------------------------

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        message: 'User no longer exists',
        code: 'USER_NOT_FOUND',
      });
    }
    return this.toAuthUser(user);
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  /**
   * Resolves the Supabase user for a verification credential
   * (token_hash / legacy token / PKCE code). Throws 400 on anything
   * invalid, expired or already used.
   */
  private async resolveVerifiedUser(dto: VerifyEmailDto): Promise<SupabaseUser> {
    try {
      if (dto.code) {
        const { data, error } = await this.supabase.exchangeCodeForSession(dto.code);
        if (error || !data.user) throw error ?? new Error('No user returned');
        return data.user;
      }
      const { data, error } = await this.supabase.verifyOtp({
        email: dto.email,
        tokenHash: dto.tokenHash,
        token: dto.token,
        type: dto.type ?? 'signup',
      });
      if (error || !data.user) throw error ?? new Error('No user returned');
      return data.user;
    } catch (err) {
      this.logger.warn(`Email verification failed: ${(err as Error)?.message}`);
      throw new BadRequestException({
        message: 'This verification link is invalid or has expired',
        code: 'INVALID_VERIFICATION',
      });
    }
  }

  private requireCredential(
    code?: string,
    tokenHash?: string,
    token?: string,
  ): void {
    if (!code && !tokenHash && !token) {
      throw new BadRequestException({
        message: 'Provide one of: code, tokenHash or token',
        code: 'MISSING_VERIFICATION_CREDENTIAL',
      });
    }
  }

  private invalidResetLink(): BadRequestException {
    return new BadRequestException({
      message: 'This reset link is invalid or has expired',
      code: 'INVALID_RESET_LINK',
    });
  }

  private async syncUser(
    supabaseUser: SupabaseUser,
    fallbackName?: string,
    role?: UserRole,
  ): Promise<User> {
    const metadata = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>;
    const email = supabaseUser.email ?? '';

    const name =
      (typeof metadata.name === 'string' && metadata.name) ||
      fallbackName ||
      email.split('@')[0] ||
      'User';

    const avatarUrl =
      typeof metadata.avatar_url === 'string' && metadata.avatar_url
        ? metadata.avatar_url
        : typeof metadata.picture === 'string' && metadata.picture
          ? metadata.picture
          : undefined;

    return this.usersService.createOrUpdate(
      { supabaseUserId: supabaseUser.id, email, name, avatarUrl },
      role,
    );
  }

  private async signToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      supabaseUserId: user.supabaseUserId,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    return this.jwtService.signAsync(payload);
  }

  private expiresInSeconds(): number {
    const raw = this.config.get<string>('JWT_EXPIRES_IN') ?? '1d';
    const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(raw.trim());
    if (!match) return 86400;
    const value = Number(match[1]);
    switch ((match[2] ?? 's').toLowerCase()) {
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return value;
    }
  }

  private toAuthUser(user: User): AuthUserDto {
    return {
      id: user.id,
      supabaseUserId: user.supabaseUserId,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: user.createdAt,
    };
  }

  private rateLimited(message: string): HttpException {
    return new HttpException(
      { message, code: 'RATE_LIMITED' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private throwRegisterError(error: SupabaseErrorLike): never {
    const message = error.message ?? '';
    if (/already registered|already exists/i.test(message)) {
      throw new ConflictException({
        message: 'An account with this email already exists',
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }
    if (/rate limit/i.test(message)) {
      throw this.rateLimited('Too many requests. Please try again later.');
    }
    if (/password/i.test(message)) {
      throw new BadRequestException({
        message: 'Password does not meet the security requirements',
        code: 'WEAK_PASSWORD',
      });
    }
    this.logger.error(`Supabase sign-up failed: ${message}`);
    throw new BadGatewayException({
      message: 'Registration could not be completed. Please try again.',
      code: 'PROVIDER_ERROR',
    });
  }

  private throwLoginError(error: SupabaseErrorLike): never {
    const message = error.message ?? '';
    if (/email not confirmed|confirm your email/i.test(message)) {
      throw new ForbiddenException({
        message: 'Email not verified. Please verify your email before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    if (/rate limit/i.test(message)) {
      throw this.rateLimited('Too many attempts. Please try again later.');
    }
    // Everything else (wrong password, unknown email, provider outage...)
    // collapses into one generic response so nothing is leaked.
    throw new UnauthorizedException({
      message: 'Invalid email or password',
      code: 'INVALID_CREDENTIALS',
    });
  }
}
