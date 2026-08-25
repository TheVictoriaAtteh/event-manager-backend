import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as publicly accessible, bypassing the global
 * {@link JwtAuthGuard}. Use sparingly (e.g. /auth/register, /auth/login).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
