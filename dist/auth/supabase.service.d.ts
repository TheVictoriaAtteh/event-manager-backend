import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AuthResponse, type User, type UserResponse } from '@supabase/supabase-js';
export interface SupabaseSignUpParams {
    email: string;
    password: string;
    name: string;
    emailRedirectTo: string;
}
export declare class SupabaseService implements OnModuleInit {
    private readonly config;
    private anonClient;
    private adminClient;
    constructor(config: ConfigService);
    onModuleInit(): void;
    signUp(params: SupabaseSignUpParams): Promise<AuthResponse>;
    signInWithPassword(email: string, password: string): Promise<AuthResponse>;
    refreshSession(refreshToken: string): Promise<AuthResponse>;
    resendConfirmationEmail(email: string, emailRedirectTo: string): Promise<import("@supabase/supabase-js").AuthOtpResponse>;
    resetPasswordForEmail(email: string, emailRedirectTo: string): Promise<{
        data: {};
        error: null;
    } | {
        data: null;
        error: import("@supabase/supabase-js").AuthError;
    }>;
    verifyOtp(params: {
        email?: string;
        tokenHash?: string;
        token?: string;
        type: 'signup' | 'invite' | 'email_change' | 'recovery';
    }): Promise<AuthResponse>;
    updateUserPassword(userId: string, password: string): Promise<UserResponse>;
    exchangeCodeForSession(code: string): Promise<AuthResponse>;
    getUserById(id: string): Promise<UserResponse>;
    getUserByAccessToken(accessToken: string): Promise<UserResponse>;
    uploadEventBanner(file: any): Promise<string>;
    signInWithOAuth(provider: 'google'): Promise<{
        url: string;
    }>;
}
export type SupabaseUser = User;
