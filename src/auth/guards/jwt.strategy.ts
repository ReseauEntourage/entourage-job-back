import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { PayloadUser } from '../auth.types';
import { getTokenFromHeaders } from '../auth.utils';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: getTokenFromHeaders,
      ignoreExpiration: false,
      secretOrKey: `${process.env.JWT_SECRET}`,
    });
  }

  async validate(payload: { sub: string } & PayloadUser) {
    const { sub, ...restPayload } = payload;
    return { id: sub, ...restPayload };
  }
}
