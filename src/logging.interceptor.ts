/* eslint-disable no-console */
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
    console.log('LoggingInterceptor');
    const request = context.switchToHttp().getRequest();
    const clientIp =
      request.headers['x-forwarded-for'] || request.connection.remoteAddress;

    const span = tracer.scope().active();

    console.log('clientIp', clientIp);
    if (span) {
      console.log('span', span);
      const res = span.setTag('http.client_ip', clientIp);
      console.log('res', res);
    }

    return next.handle();
  }
}
