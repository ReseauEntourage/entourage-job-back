import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as _ from 'lodash';
import { Permissions } from '../users.types';
import { hasPermission } from '../users.utils';
import { ADMIN_OVERRIDE } from './admin-override.decorator';
import { SELF_KEY } from './self.decorator';

@Injectable()
export class SelfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const selfIdKeys = this.reflector.get<string[]>(
      SELF_KEY,
      context.getHandler()
    );

    const adminOverride =
      this.reflector.get<boolean>(ADMIN_OVERRIDE, context.getHandler()) ||
      false;

    if (!selfIdKeys || selfIdKeys.length === 0) {
      return false;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const isSelf = selfIdKeys.some((key) => {
      const requestId = _.get(request, key);
      return user.id === requestId || user.email === requestId;
    });

    return (
      isSelf || (adminOverride && hasPermission(Permissions.ADMIN, user.role))
    );
  }
}
