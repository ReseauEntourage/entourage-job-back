import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SELF_KEY } from './self.decorator';
import { UserRoles } from '../models/user.model';

@Injectable()
export class SelfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const selfIdKey = this.reflector.get<string>(
      SELF_KEY,
      context.getHandler(),
    );
    if (!selfIdKey) {
      return false;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return (
      user.id === request[selfIdKey] ||
      user.email === request[selfIdKey] ||
      user.role === UserRoles.Admin
    );
  }
}
