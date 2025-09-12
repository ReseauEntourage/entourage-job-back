import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
// eslint-disable-next-line import/no-unresolved
import { Observable } from 'rxjs';
import { REQUIRE_API_KEY } from '../decorators/require-api-key.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if API key is required for this route
    const requireApiKey = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_API_KEY,
      [context.getHandler(), context.getClass()]
    );

    // If RequireApiKey decorator is not present, skip this guard
    if (!requireApiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key is missing');
    }

    const isValid = this.validateApiKey(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }

  private validateApiKey(apiKey: string): boolean {
    const validApiKey = process.env.MAILER_API_KEY;

    if (!validApiKey) {
      console.warn('MAILER_API_KEY is not defined in environment variables');
      return false;
    }

    return apiKey === validApiKey;
  }
}
