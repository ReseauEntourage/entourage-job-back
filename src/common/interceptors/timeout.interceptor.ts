import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
// eslint-disable-next-line import/no-unresolved
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { TIMEOUT_KEY } from '../decorators/timeout.decorator';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Valeur par défaut du timeout (en ms)
    const DEFAULT_TIMEOUT = 30000;

    // Récupération du timeout défini dans le décorateur, ou utilisation de la valeur par défaut
    const customTimeout =
      this.reflector.get<number>(TIMEOUT_KEY, context.getHandler()) ||
      DEFAULT_TIMEOUT;

    return next.handle().pipe(
      timeout(customTimeout),
      catchError((err) => {
        // Vérification du message d'erreur pour détecter un timeout
        if (err.name === 'TimeoutError') {
          return throwError(
            () => new RequestTimeoutException('Request timeout')
          );
        }
        return throwError(() => err);
      })
    );
  }
}
