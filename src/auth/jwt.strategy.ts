import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

const getTokenFromHeaders = (req) => {
  const {
    headers: { authorization },
  } = req;

  if (authorization && authorization.split(' ')[0] === 'Token') {
    return authorization.split(' ')[1];
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: getTokenFromHeaders,
      ignoreExpiration: false,
      secretOrKey: `${process.env.JWT_SECRET_KEY}`,
    });
  }

  async validate(payload: any) {
    const { sub, ...restPayload } = payload;
    return { id: sub, ...restPayload };
  }
}
