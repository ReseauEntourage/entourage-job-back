import { SetMetadata } from '@nestjs/common';

export const ADMIN_OVERRIDE = 'adminOverride';
export const AdminOverride = (adminOverride = true) =>
  SetMetadata(ADMIN_OVERRIDE, adminOverride);
