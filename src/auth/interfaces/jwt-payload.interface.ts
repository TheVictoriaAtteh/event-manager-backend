/**
 * Payload of the JWT issued by THIS backend after a successful Supabase
 * credential check. One consistent mechanism: NestJS issues and validates
 * these tokens; Supabase remains the source of truth for credentials.
 */
export interface JwtPayload {
  /** Local (Prisma) user id. */
  sub: string;
  /** Supabase Auth user id. */
  supabaseUserId: string;
  email: string;
  role: string;
  name: string;
  iat?: number;
  exp?: number;
}
