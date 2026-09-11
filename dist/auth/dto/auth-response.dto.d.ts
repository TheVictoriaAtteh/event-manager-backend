export declare class AuthUserDto {
    id: string;
    supabaseUserId: string;
    email: string;
    name: string;
    role: string;
    avatarUrl?: string | null;
    createdAt: Date;
}
export declare class RegisterResponseDto {
    message: string;
    emailVerificationRequired: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    user?: AuthUserDto;
}
export declare class LoginResponseDto {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
    refreshToken: string;
    user: AuthUserDto;
}
export declare class MessageResponseDto {
    message: string;
}
export declare class VerifyEmailResponseDto {
    verified: boolean;
    message: string;
    user?: AuthUserDto;
}
