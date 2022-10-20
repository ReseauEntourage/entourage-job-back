import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as _ from 'lodash';
import { UserRoles } from '../users.types';
import { SELF_KEY } from './self.decorator';

@Injectable()
export class SelfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const selfIdKeys = this.reflector.get<string[]>(
      SELF_KEY,
      context.getHandler()
    );
    if (!selfIdKeys || selfIdKeys.length === 0) {
      return false;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const isSelf = selfIdKeys.some((key) => {
      const requestId = _.get(request, key);
      return user.id === requestId || user.email === requestId;
    });

    return isSelf || user.role === UserRoles.ADMIN;
  }
}
