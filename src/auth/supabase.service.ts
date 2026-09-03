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

  
  signInWithPassword(email: string, password: string): Promise<AuthResponse> {
    return this.anonClient.auth.signInWithPassword({ email, password });
  }

  
  refreshSession(refreshToken: string): Promise<AuthResponse> {
    return this.anonClient.auth.refreshSession({ refresh_token: refreshToken });
  }

  
  resendConfirmationEmail(email: string, emailRedirectTo: string) {
    return this.anonClient.auth.resend({
      email,
      type: 'signup',
      options: { emailRedirectTo },
    });
  }

  
  resetPasswordForEmail(email: string, emailRedirectTo: string) {
    return this.anonClient.auth.resetPasswordForEmail(email, {
      redirectTo: emailRedirectTo,
    });
  }

  
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

  
  updateUserPassword(userId: string, password: string): Promise<UserResponse> {
    return this.adminClient.auth.admin.updateUserById(userId, { password });
  }

  
  exchangeCodeForSession(code: string): Promise<AuthResponse> {
    return this.anonClient.auth.exchangeCodeForSession(code);
  }

  
  getUserById(id: string): Promise<UserResponse> {
    return this.adminClient.auth.admin.getUserById(id);
  }

  
  getUserByAccessToken(accessToken: string): Promise<UserResponse> {
    return this.anonClient.auth.getUser(accessToken);
  }

  /**
   * Initiate OAuth sign-in with Google.
   * Returns the authorization URL to redirect the user to.
   */
  async signInWithOAuth(provider: 'google'): Promise<{ url: string }> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const { data, error } = await this.anonClient.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${frontendUrl.replace(/\/$/, '')}/auth/callback`,
      },
    });

    if (error || !data.url) {
      throw new Error(`OAuth initialization failed: ${error?.message ?? 'No URL returned'}`);
    }

    return { url: data.url };
  }
}

export type SupabaseUser = User;
