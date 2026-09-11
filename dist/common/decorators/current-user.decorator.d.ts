export interface RequestUser {
    id: string;
    supabaseUserId: string;
    email: string;
    role: string;
    name: string;
}
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
