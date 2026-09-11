export interface JwtPayload {
    sub: string;
    supabaseUserId: string;
    email: string;
    role: string;
    name: string;
    iat?: number;
    exp?: number;
}
