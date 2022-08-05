/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpStatus } from '@nestjs/common';
import { Model } from 'sequelize-typescript';
import { User } from 'src/users';

export type AnyToFix = any;
export type AnyCantFix = any;

export type RequestWithUser = Request & { user: User };

export type APIResponse<T extends (...args: Parameters<T>) => ReturnType<T>> = {
  body: Awaited<ReturnType<T>>;
  status: HttpStatus;
};

export class WrapperModel extends Model {}
