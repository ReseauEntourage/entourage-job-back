import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { getTokenFromHeaders } from '../auth.utils';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: getTokenFromHeaders,
      ignoreExpiration: false,
      secretOrKey: `${process.env.JWT_SECRET}`,
    });
  }

  async validate(payload: { sub: string }) {
    const { sub } = payload;

    const user = await this.usersService.findOneForJwtPayload(sub);

    const hasPassword = !!user?.password;

    /*
          verify if 
            - user exists
            - if user has been deleted
            - email is verified, for accounts that have a password
        */
    // An account without a password (e.g. a refered candidate who has not
    // finalized their account yet) is let through even with an unverified
    // email: `JwtAuthGuard` then restricts its session to the routes marked
    // with `@AllowWithoutPassword()` until it sets one on `finalize-account`.
    if (user && !user.isEmailVerified && hasPassword) {
      throw new UnauthorizedException('UNVERIFIED_EMAIL');
    }
    if (!user || !!user.deletedAt) {
      throw new UnauthorizedException();
    }
    // Built field by field so that the password hash never reaches `request.user`.
    return {
      id: user.id,
      email: user.email,
      role: user.role, // used for permission guards
      hasPassword,
    };
  }
}
