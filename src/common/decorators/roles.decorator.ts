import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given user roles. Must be combined with
 * `RolesGuard`, e.g. `@UseGuards(RolesGuard)` after the JWT guard.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
