import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ALLOW_WITHOUT_PASSWORD_KEY } from './allow-without-password.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      try {
        return (await super.canActivate(context)) as boolean;
      } catch {
        return true;
      }
    }
    const isAuthenticated = (await super.canActivate(context)) as boolean;

    // A session whose account has no password is restricted to the routes
    // needed to set one: it must not reach the rest of the API.
    const { user } = context.switchToHttp().getRequest();
    const isAllowedWithoutPassword = this.reflector.getAllAndOverride<boolean>(
      ALLOW_WITHOUT_PASSWORD_KEY,
      [context.getHandler(), context.getClass()]
    );
    if (user && user.hasPassword === false && !isAllowedWithoutPassword) {
      throw new ForbiddenException('PASSWORD_SETUP_REQUIRED');
    }

    return isAuthenticated;
  }
}
