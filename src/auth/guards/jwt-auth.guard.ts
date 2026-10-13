import {
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

/**
 * Global JWT guard (registered via APP_GUARD). Every route is protected by
 * default; routes decorated with `@Public()` bypass authentication.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      // Preserve structured errors thrown by the strategy (e.g. TOKEN_EXPIRED).
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException({
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }
    return user;
  }
}
