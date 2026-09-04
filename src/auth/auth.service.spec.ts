import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, type User } from '@prisma/client';
import { AuthService } from './auth.service';
import type { SupabaseService } from './supabase.service';
import type { UsersService } from '../users/users.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUPABASE_USER_BASE = {
  id: 'supa-user-123',
  email: 'jane.doe@example.com',
  email_confirmed_at: null as string | null,
  user_metadata: { name: 'Jane Doe' },
  identities: [{ id: 'identity-1' }],
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
};

const VERIFIED_SUPABASE_USER = {
  ...SUPABASE_USER_BASE,
  email_confirmed_at: '2026-01-01T00:00:00Z',
};

const LOCAL_USER: User = {
  id: 'local-user-1',
  supabaseUserId: 'supa-user-123',
  email: 'jane.doe@example.com',
  name: 'Jane Doe',
  role: UserRole.ATTENDEE,
  avatarUrl: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const REGISTER_DTO = {
  name: 'Jane Doe',
  email: 'jane.doe@example.com',
  password: 'S3cure!password',
};

const LOGIN_DTO = { email: REGISTER_DTO.email, password: REGISTER_DTO.password };

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

async function expectStatus(
  promise: Promise<unknown>,
  status: number,
): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected promise to reject with status ${status}`);
  } catch (err) {
    if (err instanceof HttpException) {
      expect(err.getStatus()).toBe(status);
      return;
    }
    throw err;
  }
}

function createService() {
  const supabase = {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    refreshSession: jest.fn(),
    resendConfirmationEmail: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    verifyOtp: jest.fn(),
    exchangeCodeForSession: jest.fn(),
    updateUserPassword: jest.fn(),
    getUserById: jest.fn(),
    getUserByAccessToken: jest.fn(),
  };

  const usersService = {
    createOrUpdate: jest.fn().mockResolvedValue(LOCAL_USER),
    findById: jest.fn().mockResolvedValue(LOCAL_USER),
    findBySupabaseUserId: jest.fn().mockResolvedValue(LOCAL_USER),
    findByEmail: jest.fn().mockResolvedValue(LOCAL_USER),
  };

  const config = new ConfigService({
    FRONTEND_URL: 'http://localhost:5173/',
    JWT_EXPIRES_IN: '1d',
  });

  const service = new AuthService(
    supabase as unknown as SupabaseService,
    usersService as unknown as UsersService,
    config,
  );

  return { service, supabase, usersService };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('AuthService.register', () => {
  it('registers a valid user and requires email verification', async () => {
    const { service, supabase, usersService } = createService();
    supabase.signUp.mockResolvedValue({
      data: { user: { ...SUPABASE_USER_BASE }, session: null },
      error: null,
    });

    const result = await service.register(REGISTER_DTO);

    expect(supabase.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: REGISTER_DTO.email,
        password: REGISTER_DTO.password,
        name: REGISTER_DTO.name,
        emailRedirectTo: 'http://localhost:5173/auth/verify',
      }),
    );
    expect(result.emailVerificationRequired).toBe(true);
    expect(result.accessToken).toBeUndefined();
    // No local sync before verification.
    expect(usersService.createOrUpdate).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(REGISTER_DTO.password);
  });

  it('rejects duplicate registration of a confirmed account (409)', async () => {
    const { service, supabase } = createService();
    supabase.signUp.mockResolvedValue({
      data: { user: { ...SUPABASE_USER_BASE, identities: [] }, session: null },
      error: null,
    });

    await expect(service.register(REGISTER_DTO)).rejects.toThrow(ConflictException);
  });

  it('maps an "already registered" provider error to 409', async () => {
    const { service, supabase } = createService();
    supabase.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered', status: 422 },
    });

    await expect(service.register(REGISTER_DTO)).rejects.toThrow(ConflictException);
  });

  it('rejects weak passwords reported by Supabase (400)', async () => {
    const { service, supabase } = createService();
    supabase.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Signup requires a valid password', status: 422 },
    });

    await expect(service.register(REGISTER_DTO)).rejects.toThrow(BadRequestException);
  });

  it('maps a Supabase sign-up failure to 502 without leaking details', async () => {
    const { service, supabase } = createService();
    supabase.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'internal: something exploded in gotrue', status: 500 },
    });

    const promise = service.register(REGISTER_DTO);
    await expect(promise).rejects.toThrow(BadGatewayException);
    await expect(promise).rejects.not.toThrow('exploded');
  });

  it('issues a token immediately when email confirmation is disabled', async () => {
    const { service, supabase, usersService } = createService();
    supabase.signUp.mockResolvedValue({
      data: { user: { ...VERIFIED_SUPABASE_USER }, session: { access_token: 'supa-token-reg', expires_in: 3600, refresh_token: 'rt-1' } },
      error: null,
    });

    const result = await service.register({ ...REGISTER_DTO, role: UserRole.ADMIN });

    expect(result.emailVerificationRequired).toBe(false);
    expect(result.accessToken).toBe('supa-token-reg');
    expect(result.expiresIn).toBe(3600);
    expect(usersService.createOrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ supabaseUserId: 'supa-user-123' }),
      UserRole.ADMIN,
    );
  });
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

describe('AuthService.login', () => {
  it('authenticates valid credentials and returns a JWT (no secrets leaked)', async () => {
    const { service, supabase, usersService } = createService();
    supabase.signInWithPassword.mockResolvedValue({
      data: {
        user: VERIFIED_SUPABASE_USER,
        session: { refresh_token: 'refresh-1', access_token: 'supa-token', expires_in: 3600 },
      },
      error: null,
    });

    const result = await service.login(LOGIN_DTO);

    expect(result.accessToken).toBe('supa-token');
    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresIn).toBe(3600);
    expect(result.refreshToken).toBe('refresh-1');
    expect(result.user.email).toBe(LOCAL_USER.email);
    // Frontend contract: user shape includes id/name/email/role/avatarUrl.
    expect(result.user).toEqual(
      expect.objectContaining({
        id: LOCAL_USER.id,
        name: LOCAL_USER.name,
        email: LOCAL_USER.email,
        role: LOCAL_USER.role,
        avatarUrl: null,
      }),
    );
    expect(usersService.createOrUpdate).toHaveBeenCalled();
    // Never leak password hashes.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain(LOGIN_DTO.password);
  });

  it('rejects invalid credentials (401)', async () => {
    const { service, supabase } = createService();
    supabase.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', status: 400 },
    });

    const promise = service.login({ ...LOGIN_DTO, password: 'wrong-password!' });
    await expect(promise).rejects.toThrow(UnauthorizedException);
    await expect(promise).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_CREDENTIALS' }),
    });
  });

  it('rejects non-existent accounts with the same generic 401', async () => {
    // Supabase intentionally returns the same error for unknown emails.
    const { service, supabase } = createService();
    supabase.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', status: 400 },
    });

    await expect(
      service.login({ email: 'ghost@example.com', password: 'whatever123!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects unverified accounts (403, EMAIL_NOT_VERIFIED)', async () => {
    const { service, supabase } = createService();
    supabase.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Email not confirmed', status: 400 },
    });

    const promise = service.login(LOGIN_DTO);
    await expect(promise).rejects.toThrow(ForbiddenException);
    await expect(promise).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' }),
    });
  });

  it('maps a Supabase authentication failure to a generic 401', async () => {
    const { service, supabase } = createService();
    supabase.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'unexpected provider outage', status: 500 },
    });

    await expect(service.login(LOGIN_DTO)).rejects.toThrow(UnauthorizedException);
  });
});

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

describe('AuthService.verifyEmail', () => {
  it('verifies a valid token_hash and syncs the user', async () => {
    const { service, supabase, usersService } = createService();
    supabase.verifyOtp.mockResolvedValue({
      data: { user: VERIFIED_SUPABASE_USER, session: null },
      error: null,
    });

    const result = await service.verifyEmail({ tokenHash: 'hash-123' });

    expect(supabase.verifyOtp).toHaveBeenCalledWith({
      email: undefined,
      tokenHash: 'hash-123',
      token: undefined,
      type: 'signup',
    });
    expect(result.verified).toBe(true);
    expect(usersService.createOrUpdate).toHaveBeenCalled();
  });

  it('verifies a PKCE code via exchangeCodeForSession', async () => {
    const { service, supabase } = createService();
    supabase.exchangeCodeForSession.mockResolvedValue({
      data: { user: VERIFIED_SUPABASE_USER, session: { refresh_token: 'rt' } },
      error: null,
    });

    const result = await service.verifyEmail({ code: 'pkce-code' });
    expect(result.verified).toBe(true);
  });

  it('rejects an invalid verification token (400)', async () => {
    const { service, supabase } = createService();
    supabase.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Token has expired or is invalid', status: 403 },
    });

    const promise = service.verifyEmail({ tokenHash: 'bad-hash' });
    await expect(promise).rejects.toThrow(BadRequestException);
    await expect(promise).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_VERIFICATION' }),
    });
  });

  it('rejects an expired verification token (400)', async () => {
    const { service, supabase } = createService();
    supabase.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Token has expired', status: 403 },
    });

    await expect(service.verifyEmail({ tokenHash: 'expired-hash' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a request with no verification credential (400)', async () => {
    const { service, supabase } = createService();
    const promise = service.verifyEmail({});
    await expect(promise).rejects.toThrow(BadRequestException);
    await expect(promise).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'MISSING_VERIFICATION_CREDENTIAL',
      }),
    });
    expect(supabase.verifyOtp).not.toHaveBeenCalled();
    expect(supabase.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('rejects an unknown PKCE code (400)', async () => {
    const { service, supabase } = createService();
    supabase.exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid code', status: 400 },
    });

    await expect(service.verifyEmail({ code: 'nope' })).rejects.toThrow(
      BadRequestException,
    );
  });
});

// ---------------------------------------------------------------------------
// Resend verification
// ---------------------------------------------------------------------------

describe('AuthService.resendVerification', () => {
  it('returns a generic success message (no account enumeration)', async () => {
    const { service, supabase } = createService();
    supabase.resendConfirmationEmail.mockResolvedValue({
      data: { message_id: 'm-1' },
      error: null,
    });

    const result = await service.resendVerification({ email: 'jane.doe@example.com' });
    expect(result.message).toContain('If an account exists');
  });

  it('returns 429 when rate limited', async () => {
    const { service, supabase } = createService();
    supabase.resendConfirmationEmail.mockResolvedValue({
      data: null,
      error: { message: 'Email rate limit exceeded', status: 429 },
    });

    await expectStatus(
      service.resendVerification({ email: 'jane.doe@example.com' }),
      429,
    );
  });
});

// ---------------------------------------------------------------------------
// Forgot / reset password (Supabase-native recovery)
// ---------------------------------------------------------------------------

describe('AuthService.forgotPassword', () => {
  it('sends the Supabase recovery email and returns a generic message', async () => {
    const { service, supabase } = createService();
    supabase.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const result = await service.forgotPassword({ email: 'jane.doe@example.com' });

    expect(supabase.resetPasswordForEmail).toHaveBeenCalledWith(
      'jane.doe@example.com',
      'http://localhost:5173/auth/reset-password',
    );
    expect(result.message).toContain('If an account exists');
  });
});

describe('AuthService.resetPassword', () => {
  it('sets a new password for a valid recovery token_hash', async () => {
    const { service, supabase } = createService();
    supabase.verifyOtp.mockResolvedValue({
      data: { user: VERIFIED_SUPABASE_USER, session: null },
      error: null,
    });
    supabase.updateUserPassword.mockResolvedValue({
      data: { user: VERIFIED_SUPABASE_USER },
      error: null,
    });

    const result = await service.resetPassword({
      tokenHash: 'recovery-hash',
      newPassword: 'N3w!password',
    });

    expect(supabase.verifyOtp).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: 'recovery-hash', type: 'recovery' }),
    );
    expect(supabase.updateUserPassword).toHaveBeenCalledWith(
      'supa-user-123',
      'N3w!password',
    );
    expect(result.message).toContain('Password updated');
  });

  it('sets a new password for a valid PKCE code', async () => {
    const { service, supabase } = createService();
    supabase.exchangeCodeForSession.mockResolvedValue({
      data: { user: VERIFIED_SUPABASE_USER, session: {} },
      error: null,
    });
    supabase.updateUserPassword.mockResolvedValue({
      data: { user: VERIFIED_SUPABASE_USER },
      error: null,
    });

    const result = await service.resetPassword({
      code: 'recovery-code',
      newPassword: 'N3w!password',
    });
    expect(result.message).toContain('Password updated');
  });

  it('rejects a request with no recovery credential (400)', async () => {
    const { service } = createService();
    await expect(
      service.resetPassword({ newPassword: 'N3w!password' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an invalid/expired recovery link (400)', async () => {
    const { service, supabase } = createService();
    supabase.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Token has expired', status: 403 },
    });

    const promise = service.resetPassword({
      tokenHash: 'stale',
      newPassword: 'N3w!password',
    });
    await expect(promise).rejects.toThrow(BadRequestException);
    await expect(promise).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_RESET_LINK' }),
    });
    expect(supabase.updateUserPassword).not.toHaveBeenCalled();
  });

  it('rejects a weak new password reported by Supabase (400)', async () => {
    const { service, supabase } = createService();
    supabase.verifyOtp.mockResolvedValue({
      data: { user: VERIFIED_SUPABASE_USER, session: null },
      error: null,
    });
    supabase.updateUserPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Password should be at least 6 characters', status: 422 },
    });

    await expect(
      service.resetPassword({ tokenHash: 'ok-hash', newPassword: 'N3w!password' }),
    ).rejects.toThrow(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// Session verification (implicit-flow "already signed in" link)
// ---------------------------------------------------------------------------

describe('AuthService.verifySession', () => {
  it('validates the Supabase token, syncs the user and passes the token', async () => {
    const { service, supabase } = createService();
    supabase.getUserByAccessToken.mockResolvedValue({
      data: { user: VERIFIED_SUPABASE_USER },
      error: null,
    });

    const result = await service.verifySession({
      accessToken: 'supa.access.token',
      refreshToken: 'supa-refresh-1',
    });

    expect(result.accessToken).toBe('supa.access.token');
    expect(result.tokenType).toBe('Bearer');
    expect(result.refreshToken).toBe('supa-refresh-1');
    expect(result.user.email).toBe(LOCAL_USER.email);
  });

  it('rejects an invalid or expired access token (400)', async () => {
    const { service, supabase } = createService();
    supabase.getUserByAccessToken.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired', status: 401 },
    });

    const promise = service.verifySession({
      accessToken: 'stale',
      refreshToken: 'supa-refresh-1',
    });
    await expect(promise).rejects.toThrow(BadRequestException);
    await expect(promise).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_VERIFICATION' }),
    });
  });
});

// ---------------------------------------------------------------------------
// Refresh & current user
// ---------------------------------------------------------------------------

describe('AuthService.refresh', () => {
  it('exchanges a valid refresh token for a new token', async () => {
    const { service, supabase } = createService();
    supabase.refreshSession.mockResolvedValue({
      data: { user: VERIFIED_SUPABASE_USER, session: { access_token: 'supa-access-2', expires_in: 3600, refresh_token: 'refresh-2' } },
      error: null,
    });

    const result = await service.refresh({ refreshToken: 'refresh-1' });
    expect(result.accessToken).toBe('supa-access-2');
    expect(result.expiresIn).toBe(3600);
    expect(result.refreshToken).toBe('refresh-2');
  });

  it('rejects an invalid/expired refresh token (401)', async () => {
    const { service, supabase } = createService();
    supabase.refreshSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid Refresh Token', status: 400 },
    });

    const promise = service.refresh({ refreshToken: 'stale' });
    await expect(promise).rejects.toThrow(UnauthorizedException);
    await expect(promise).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_REFRESH_TOKEN' }),
    });
  });
});

describe('AuthService.me', () => {
  it('returns the profile of an existing user', async () => {
    const { service } = createService();
    const result = await service.me('local-user-1');
    expect(result.email).toBe(LOCAL_USER.email);
    expect(result.supabaseUserId).toBe(LOCAL_USER.supabaseUserId);
  });

  it('rejects when the user no longer exists (401)', async () => {
    const { service, usersService } = createService();
    usersService.findById.mockResolvedValue(null);
    await expect(service.me('gone')).rejects.toThrow(UnauthorizedException);
  });
});
