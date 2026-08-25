import { Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createClient,
  type AuthResponse,
  type SupabaseClient,
  type User,
  type UserResponse,
} from '@supabase/supabase-js';

export interface SupabaseSignUpParams {
  email: string;
  password: string;
  name: string;
  emailRedirectTo: string;
}

/**
 * Thin, typed wrapper around the Supabase Auth API.
 *
 * Two clients are created from environment variables:
 * - an **anon** client for public flows (sign-up, sign-in, refresh);
 * - an **admin** client (service-role key, SERVER-SIDE ONLY) for OTP
 *   verification and authoritative user lookups.
 *
 * Keys are read from the environment once and are never logged or returned
 * in any response.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private anonClient!: SupabaseClient;
  private adminClient!: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL');
    const anonKey = this.config.get<string>('SUPABASE_ANON_KEY');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !anonKey || !serviceRoleKey) {
      // Do not print the values themselves, only which variables are missing.
      const missing = [
        !url && 'SUPABASE_URL',
        !anonKey && 'SUPABASE_ANON_KEY',
        !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
      ]
        .filter(Boolean)
        .join(', ');
      throw new ServiceUnavailableException(
        `Supabase is not configured. Missing environment variables: ${missing}`,
      );
    }

    this.anonClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /**
   * Public sign-up: creates the user in Supabase Auth and triggers the
   * confirmation email (when "Confirm email" is enabled in the dashboard).
   */
  signUp(params: SupabaseSignUpParams): Promise<AuthResponse> {
    return this.anonClient.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        emailRedirectTo: params.emailRedirectTo,
        data: { name: params.name },
      },
    });
  }

  /** Public password sign-in. */
  signInWithPassword(email: string, password: string): Promise<AuthResponse> {
    return this.anonClient.auth.signInWithPassword({ email, password });
  }

  /** Exchanges a Supabase refresh token for a fresh session. */
  refreshSession(refreshToken: string): Promise<AuthResponse> {
    return this.anonClient.auth.refreshSession({ refresh_token: refreshToken });
  }

  /** Re-sends the signup confirmation email (generic success by design). */
  resendConfirmationEmail(email: string, emailRedirectTo: string) {
    return this.anonClient.auth.resend({
      email,
      type: 'signup',
      options: { emailRedirectTo },
    });
  }

  /** Sends the Supabase-managed "reset password" email. */
  resetPasswordForEmail(email: string, emailRedirectTo: string) {
    return this.anonClient.auth.resetPasswordForEmail(email, {
      redirectTo: emailRedirectTo,
    });
  }

  /** Server-side OTP verification (token_hash / legacy token). */
  verifyOtp(params: {
    email?: string;
    tokenHash?: string;
    token?: string;
    type: 'signup' | 'invite' | 'email_change' | 'recovery';
  }): Promise<AuthResponse> {
    return params.tokenHash
      ? this.adminClient.auth.verifyOtp({
          token_hash: params.tokenHash,
          type: params.type,
        })
      : this.adminClient.auth.verifyOtp({
          email: params.email ?? '',
          token: params.token as string,
          type: params.type,
        });
  }

  /** Updates a user's password (service-role). Used for password resets. */
  updateUserPassword(userId: string, password: string): Promise<UserResponse> {
    return this.adminClient.auth.admin.updateUserById(userId, { password });
  }

  /** PKCE flow: exchanges the `code` from the verification link. */
  exchangeCodeForSession(code: string): Promise<AuthResponse> {
    return this.anonClient.auth.exchangeCodeForSession(code);
  }

  /** Authoritative lookup of a Supabase Auth user (service-role). */
  getUserById(id: string): Promise<UserResponse> {
    return this.adminClient.auth.admin.getUserById(id);
  }

  /**
   * Validates a Supabase access_token that the user's browser received
   * directly in the confirmation URL hash (implicit-flow "already signed in"
   * link). supabase-js verifies the JWT and returns the user.
   */
  getUserByAccessToken(accessToken: string): Promise<UserResponse> {
    return this.anonClient.auth.getUser(accessToken);
  }
}

export type SupabaseUser = User;
