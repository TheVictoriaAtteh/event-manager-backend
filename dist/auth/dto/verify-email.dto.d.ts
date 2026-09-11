export declare class VerifyEmailDto {
    email?: string;
    code?: string;
    tokenHash?: string;
    token?: string;
    type?: 'signup' | 'invite' | 'email_change';
}
