import { SetMetadata } from '@nestjs/common';
import { Permission } from '../users.types';

export const PERSMISSIONS_KEY = 'permissions';
export const Roles = (...permissions: Permission[]) =>
  SetMetadata(PERSMISSIONS_KEY, permissions);
