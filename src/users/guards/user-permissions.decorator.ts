import { SetMetadata } from '@nestjs/common';
import { Permission } from '../users.types';

export const PERSMISSIONS_KEY = 'permissions';
export const UserPermissions = (...permissions: Permission[]) =>
  SetMetadata(PERSMISSIONS_KEY, permissions);
