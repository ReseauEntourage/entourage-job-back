import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LINKED_USER_KEY } from './linked-user.decorator';
import { UserRoles } from '../models/user.model';

@Injectable()
export class LinkedUserGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const linkedUserIdKey = this.reflector.get<string>(
      LINKED_USER_KEY,
      context.getHandler(),
    );
    if (!linkedUserIdKey) {
      return false;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return (
      (user.role === UserRoles.CANDIDAT &&
        user.id === request[linkedUserIdKey]) ||
      (user.role === UserRoles.COACH &&
        (user.candidatId === request[linkedUserIdKey] ||
          user.id === request[linkedUserIdKey])) ||
      user.role === UserRoles.ADMIN
    );
  }
}
