import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '../users.types';
import { hasPermission } from '../users.utils';
import { User } from 'src/users/models';
import { PERSMISSIONS_KEY } from './user-permissions.decorator';

@Injectable()
export class UserPermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permissions = this.reflector.get<Permission[]>(
      PERSMISSIONS_KEY,
      context.getHandler()
    );
    if (!permissions || permissions.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user: User = request.user;
    return hasPermission(permissions, user.role);
  }
}
