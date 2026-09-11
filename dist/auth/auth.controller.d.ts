import { type RequestUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { OAuthCallbackDto } from './dto/oauth-callback.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifySessionDto } from './dto/verify-session.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto): Promise<{
        message: string;
        emailVerificationRequired: boolean;
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        user: import("./dto/auth-response.dto").AuthUserDto;
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
        user: import("./dto/auth-response.dto").AuthUserDto;
    }>;
    verifyEmail(dto: VerifyEmailDto): Promise<{
        verified: boolean;
        message: string;
        user: import("./dto/auth-response.dto").AuthUserDto;
    }>;
    verifySession(dto: VerifySessionDto): Promise<{
        accessToken: string;
        tokenType: string;
        expiresIn: number;
        refreshToken: string;
        user: import("./dto/auth-response.dto").AuthUserDto;
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
    refresh(dto: RefreshTokenDto): Promise<{
        accessToken: string;
        tokenType: string;
        expiresIn: number;
        refreshToken: string;
        user: import("./dto/auth-response.dto").AuthUserDto;
    }>;
    initiateGoogleOAuth(): Promise<{
        url: string;
    }>;
    handleOAuthCallback(dto: OAuthCallbackDto): Promise<{
        accessToken: string;
        tokenType: string;
        expiresIn: number;
        refreshToken: string;
        user: import("./dto/auth-response.dto").AuthUserDto;
    }>;
    me(user: RequestUser): Promise<import("./dto/auth-response.dto").AuthUserDto>;
}
