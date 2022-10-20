import { SetMetadata } from '@nestjs/common';

export const SELF_KEY = 'self';
export const Self = (...selfIdKeys: string[]) =>
  SetMetadata(SELF_KEY, selfIdKeys);
