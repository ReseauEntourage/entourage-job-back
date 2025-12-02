import { HttpStatus } from '@nestjs/common';
import { User } from 'src/users/models';

export type RequestWithUser = Request & { user: User };

export type APIResponse<T extends (...args: Parameters<T>) => ReturnType<T>> = {
  body: Awaited<ReturnType<T>>;
  status: HttpStatus;
};
