import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import tracer from 'dd-trace';
import { tap } from 'rxjs/operators';

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

    return next.handle().pipe(
      tap({
        next: () => {
          if (span) {
            span.finish();
          }
        },
        error: (error) => {
          if (span) {
            span.setTag('error', true);
            span.setTag('error.message', error.message);
            span.finish();
          }
        },
      })
    );
  }
}
