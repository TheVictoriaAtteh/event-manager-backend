import { ConfigService } from '@nestjs/config';
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
import { SupabaseService } from './supabase.service';
export declare class AuthService {
    private readonly supabase;
    private readonly usersService;
    private readonly config;
    private readonly logger;
    private readonly frontendUrl;
    constructor(supabase: SupabaseService, usersService: UsersService, config: ConfigService);
    private get emailRedirectTo();
    private get resetPasswordRedirectTo();
    register(dto: RegisterDto): Promise<{
        message: string;
        emailVerificationRequired: boolean;
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        user: AuthUserDto;
    } | {
        message: string;
        emailVerificationRequired: boolean;
        accessToken?: undefined;
        refreshToken?: undefined;
        expiresIn?: undefined;
        user?: undefined;
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        tokenType: string;
        expiresIn: number;
        refreshToken: string;
        user: AuthUserDto;
    }>;
    verifyEmail(dto: VerifyEmailDto): Promise<{
        verified: boolean;
        message: string;
        user: AuthUserDto;
    }>;
    verifySession(dto: VerifySessionDto): Promise<{
        accessToken: string;
        tokenType: string;
        expiresIn: number;
        refreshToken: string;
        user: AuthUserDto;
    }>;
    resendVerification(dto: ResendVerificationDto): Promise<{
        message: string;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    initiateOAuth(provider: 'google'): Promise<{
        url: string;
    }>;
    handleOAuthCallback(code: string): Promise<{
        accessToken: string;
        tokenType: string;
        expiresIn: number;
        refreshToken: string;
        user: AuthUserDto;
    }>;
    refresh(dto: RefreshTokenDto): Promise<{
        accessToken: string;
        tokenType: string;
        expiresIn: number;
        refreshToken: string;
        user: AuthUserDto;
    }>;
    me(userId: string): Promise<AuthUserDto>;
    private resolveVerifiedUser;
    private requireCredential;
    private invalidResetLink;
    private syncUser;
    private toAuthUser;
    private rateLimited;
    private throwRegisterError;
    private throwLoginError;
}
