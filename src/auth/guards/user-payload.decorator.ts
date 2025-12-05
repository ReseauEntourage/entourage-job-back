import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from 'src/users/models';

export const UserPayload = createParamDecorator(
  (data: 'email' | 'id' | 'role', ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: User = request.user;

    return data ? user[data] : user;
  }
);
