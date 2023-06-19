import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, UserPermissions, UserRole } from '../users.types';
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
    const user = request.user;
    const userPermission = UserPermissions[user.role as UserRole];
    return permissions.includes(userPermission);
  }
}
