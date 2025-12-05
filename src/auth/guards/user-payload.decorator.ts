import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from 'src/users/models';
import { JWTUserPayloadAttribute } from 'src/users/users.types';

export const UserPayload = createParamDecorator(
  (data: JWTUserPayloadAttribute, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: User = request.user;

    return data ? user?.[data] : user;
  }
);
