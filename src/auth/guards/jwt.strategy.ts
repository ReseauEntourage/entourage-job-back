import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { PayloadUser } from 'src/auth/auth.service';

const getTokenFromHeaders = (
  req: Request & { headers: Request['headers'] & { authorization: string } }
) => {
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

  async validate(payload: { sub: string } & PayloadUser) {
    const { sub, ...restPayload } = payload;
    return { id: sub, ...restPayload };
  }
}
