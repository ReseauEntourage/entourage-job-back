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

    const user = await this.usersService.findOne(sub);

    /*
          verify if 
            - user exists
            - if user has been deleted
            - email is verified
        */
    if (user && !user.isEmailVerified) {
      throw new UnauthorizedException('UNVERIFIED_EMAIL');
    }
    if (!user || !!user.deletedAt) {
      throw new UnauthorizedException();
    }
    return user.toJSON();
  }
}
