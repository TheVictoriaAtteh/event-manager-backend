import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * Shape of the user object attached to the request by the JWT strategy.
 */
export interface RequestUser {
  /** Local (Prisma) user id. */
  id: string;
  /** Supabase Auth user id. */
  supabaseUserId: string;
  email: string;
  role: string;
  name: string;
}

/**
 * Extracts the authenticated user (populated by JwtStrategy) from the
 * request. Usage: `someEndpoint(@CurrentUser() user: RequestUser)`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as RequestUser;
  },
);
