import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Validates the JWT issued by THIS backend (HS256, JWT_SECRET).
 * Validation is stateless: the payload is trusted because the signature has
 * been verified by passport-jwt.
 *
 * Expiry is enforced manually in `validate` (with `ignoreExpiration: true`)
 * so that expired tokens surface as a distinct TOKEN_EXPIRED error instead
 * of passport's generic authentication failure.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): RequestUser {
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException({
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      });
    }
    return {
      id: payload.sub,
      supabaseUserId: payload.supabaseUserId,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
  }
}
