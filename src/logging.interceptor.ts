import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import tracer from 'dd-trace';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const clientIp =
      request.headers['x-forwarded-for'] || request.connection.remoteAddress;

    const span = tracer.scope().active();

    if (span) {
      span.setTag('http.client_ip', clientIp);
    }

    return next.handle();
  }
}
